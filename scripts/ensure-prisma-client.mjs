import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const sourceSchemaPath = path.join(repositoryRoot, "backend", "prisma", "schema.prisma");
const generatedSchemaPath = path.join(
  repositoryRoot,
  "node_modules",
  ".prisma",
  "client",
  "schema.prisma",
);
const generatedClientPath = path.join(
  repositoryRoot,
  "node_modules",
  "@prisma",
  "client",
  "index.js",
);

const clientIsCurrent =
  existsSync(sourceSchemaPath) &&
  existsSync(generatedSchemaPath) &&
  existsSync(generatedClientPath) &&
  statSync(generatedSchemaPath).mtimeMs >= statSync(sourceSchemaPath).mtimeMs;

if (clientIsCurrent) {
  console.log("[Hostly] Prisma Client matches the current schema.");
  process.exit(0);
}

console.log("[Hostly] Prisma schema changed; generating Prisma Client...");

const npmCliPath =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const result = spawnSync(
  process.execPath,
  [npmCliPath, "run", "prisma:generate", "--workspace", "backend"],
  {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  },
);

if (result.error) {
  console.error(
    `[Hostly] Unable to start Prisma Client generation: ${result.error.message}`,
  );
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    "[Hostly] Prisma Client generation failed. On Windows, stop any running Hostly API process if Prisma reports an EPERM lock, then retry.",
  );
  process.exit(result.status ?? 1);
}
