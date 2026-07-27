import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const frontendRoot = path.resolve(import.meta.dirname, "..");

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2"),
        ];
      }),
  );
}

function configuredPort() {
  if (process.env.HOSTLY_FRONTEND_PORT) {
    return process.env.HOSTLY_FRONTEND_PORT;
  }

  const localEnvironment = readEnvFile(
    path.join(frontendRoot, ".env.local"),
  );
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    localEnvironment.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3100";

  try {
    return new URL(appUrl).port || "3100";
  } catch {
    return "3100";
  }
}

const [mode, ...forwardedArguments] = process.argv.slice(2);
if (mode !== "dev" && mode !== "start") {
  console.error("Usage: node scripts/run-next.mjs <dev|start> [Next.js options]");
  process.exit(1);
}

const hasExplicitPort = forwardedArguments.some(
  (argument) =>
    argument === "-p" ||
    argument === "--port" ||
    argument.startsWith("--port="),
);
const nextArguments = [
  require.resolve("next/dist/bin/next"),
  mode,
  ...(mode === "dev" ? ["--turbopack"] : []),
  ...forwardedArguments,
  ...(hasExplicitPort ? [] : ["--port", configuredPort()]),
];

const child = spawn(process.execPath, nextArguments, {
  cwd: frontendRoot,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

child.on("error", (error) => {
  console.error(`Unable to start Next.js: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
