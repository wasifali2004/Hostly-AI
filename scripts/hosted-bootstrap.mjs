import { spawn } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const backendEnvPath = path.join(repositoryRoot, "backend", ".env");
const frontendEnvPath = path.join(repositoryRoot, "frontend", ".env.local");
const flags = new Set(process.argv.slice(2));
const setupOnly = flags.has("--setup-only");
const skipMigrations = flags.has("--no-migrate");

const npmInvocation = process.env.npm_execpath
  ? { command: process.execPath, prefix: [process.env.npm_execpath] }
  : {
      command: process.platform === "win32" ? "npm.cmd" : "npm",
      prefix: [],
    };

if (flags.has("--help")) {
  console.log(`Hostly AI hosted-service bootstrap

Usage:
  npm run dev
  npm run setup

Options:
  --setup-only   Validate configuration and prepare Prisma, then exit
  --no-migrate   Skip applying committed database migrations
  --help         Show this message
`);
  process.exit(0);
}

function status(message) {
  console.log(`[Hostly hosted] ${message}`);
}

function ensureEnvironmentFile(destination, source) {
  if (existsSync(destination)) return;
  copyFileSync(source, destination);
  status(`Created ${path.relative(repositoryRoot, destination)} from its example.`);
}

function readEnvironment(filePath) {
  const values = {};
  const seen = new Set();

  for (const originalLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = originalLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    if (seen.has(key)) {
      throw new Error(
        `${path.relative(repositoryRoot, filePath)} defines ${key} more than once. Keep exactly one value so the active connection is unambiguous.`,
      );
    }
    seen.add(key);

    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

function parsedUrl(rawValue, variableName, allowedProtocols) {
  if (!rawValue) {
    throw new Error(`${variableName} is missing from backend/.env.`);
  }

  let value;
  try {
    value = new URL(rawValue);
  } catch {
    throw new Error(`${variableName} is not a valid URL.`);
  }

  if (!allowedProtocols.includes(value.protocol)) {
    throw new Error(
      `${variableName} must use ${allowedProtocols.join(" or ")}.`,
    );
  }

  const hostname = value.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    throw new Error(
      `${variableName} still points to ${hostname}. Hostly is configured for hosted infrastructure only.`,
    );
  }

  return value;
}

function validateHostedEnvironment(environment) {
  parsedUrl(environment.DATABASE_URL, "DATABASE_URL", [
    "postgres:",
    "postgresql:",
  ]);
  parsedUrl(environment.DIRECT_URL, "DIRECT_URL", [
    "postgres:",
    "postgresql:",
  ]);

  if (environment.REDIS_URL) {
    parsedUrl(environment.REDIS_URL, "REDIS_URL", ["redis:", "rediss:"]);
  }

  const hasRestUrl = Boolean(environment.UPSTASH_REDIS_REST_URL);
  const hasRestToken = Boolean(environment.UPSTASH_REDIS_REST_TOKEN);
  if (hasRestUrl !== hasRestToken) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must either both be set or both be empty.",
    );
  }
  if (hasRestUrl) {
    parsedUrl(
      environment.UPSTASH_REDIS_REST_URL,
      "UPSTASH_REDIS_REST_URL",
      ["https:"],
    );
  }

  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
    if (!environment[key] || environment[key].length < 32) {
      throw new Error(`${key} must contain at least 32 characters.`);
    }
  }
}

function start(command, arguments_, options = {}) {
  const child = spawn(command, arguments_, {
    cwd: repositoryRoot,
    env: options.env ?? process.env,
    stdio: "inherit",
    windowsHide: true,
  });

  const completion = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${arguments_.join(" ")} exited ${
            signal ? `with signal ${signal}` : `with code ${code}`
          }.`,
        ),
      );
    });
  });

  return { child, completion };
}

function run(command, arguments_, options) {
  return start(command, arguments_, options).completion;
}

function runNpm(arguments_) {
  return run(npmInvocation.command, [...npmInvocation.prefix, ...arguments_]);
}

async function prepareDatabase() {
  status("Checking the generated Prisma client...");
  await run(process.execPath, [
    path.join(repositoryRoot, "scripts", "ensure-prisma-client.mjs"),
  ]);

  if (skipMigrations) {
    status("Database migrations skipped by --no-migrate.");
    return;
  }

  status("Applying committed migrations through DIRECT_URL...");
  await runNpm(["run", "db:deploy"]);
}

async function launchApplications() {
  status("Starting the NestJS API and Next.js frontend...");
  const execution = start(npmInvocation.command, [
    ...npmInvocation.prefix,
    "run",
    "dev:apps",
  ]);
  await execution.completion;
}

async function main() {
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (nodeMajor < 20) {
    throw new Error(
      `Node.js 20 or newer is required; current version is ${process.versions.node}.`,
    );
  }

  ensureEnvironmentFile(
    backendEnvPath,
    path.join(repositoryRoot, "backend", ".env.example"),
  );
  ensureEnvironmentFile(
    frontendEnvPath,
    path.join(repositoryRoot, "frontend", ".env.example"),
  );

  const environment = readEnvironment(backendEnvPath);
  validateHostedEnvironment(environment);
  status("Supabase/PostgreSQL configuration is valid.");
  if (environment.UPSTASH_REDIS_REST_URL) {
    status("Upstash REST caching is configured.");
  }
  if (environment.REDIS_URL) {
    status("Native Redis/BullMQ transport is configured.");
  } else {
    status(
      "REDIS_URL is empty; reminders will use the durable PostgreSQL scheduler fallback.",
    );
  }
  if (environment.GEMINI_API_KEY) {
    status("Gemini credentials are present.");
  }

  await prepareDatabase();
  if (setupOnly) {
    status("Hosted-service setup is complete.");
    return;
  }
  await launchApplications();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n[Hostly hosted] Startup stopped: ${message}`);
  process.exitCode = 1;
});
