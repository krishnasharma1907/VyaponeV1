import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { loadIsolatedStagingEnv } from "./staging/env-loader.mjs";

const require = createRequire(import.meta.url);
const VALID_COMMANDS = new Set(["dev", "build", "start"]);
const STAGING_BUILD_MANIFEST_REL = path.join(".next", ".vyapone-staging-manifest.json");

function parseCliArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    return {
      help: true,
      command: null,
      envFile: ".env.staging.local",
      checkOnly: false,
      nextArgs: [],
    };
  }
  if (!VALID_COMMANDS.has(command)) {
    throw new Error(
      `Unsupported staging command "${command}". Expected one of: dev, build, start.`,
    );
  }

  let envFile = ".env.staging.local";
  let checkOnly = false;
  const nextArgs = [];

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === "--check-only") {
      checkOnly = true;
      continue;
    }
    if (arg === "--env-file") {
      const nextVal = rest[i + 1];
      if (!nextVal) {
        throw new Error("--env-file requires a file path argument.");
      }
      envFile = nextVal;
      i += 1;
      continue;
    }
    nextArgs.push(arg);
  }

  return { help: false, command, envFile, checkOnly, nextArgs };
}

function writeStagingBuildManifest(rootDir, result) {
  const manifestPath = path.join(rootDir, STAGING_BUILD_MANIFEST_REL);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  const payload = {
    mode: "staging",
    appEnv: "staging",
    projectRef: result.stagingProjectRef || "unassigned",
    appOriginHost: result.appOriginHost,
    builtAt: new Date().toISOString(),
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function assertStagingBuildManifest(rootDir, expectedProjectRef) {
  const manifestPath = path.join(rootDir, STAGING_BUILD_MANIFEST_REL);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Missing staging build manifest at "${manifestPath}". Run "pnpm build:staging" before "pnpm start:staging" so production builds are never served in staging mode.`,
    );
  }
  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (parsed?.mode !== "staging" || parsed?.appEnv !== "staging") {
    throw new Error(
      `Invalid build manifest at "${manifestPath}". Rebuild using "pnpm build:staging".`,
    );
  }
  if (expectedProjectRef && parsed.projectRef && parsed.projectRef !== expectedProjectRef) {
    throw new Error(
      `Existing ".next" build targets staging project "${parsed.projectRef}", which does not match current target "${expectedProjectRef}". Run "pnpm build:staging" first.`,
    );
  }
}

function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    console.info(
      [
        "VyapOne Isolated Staging Runner",
        "",
        "Usage:",
        "  node scripts/run-staging.mjs <dev|build|start> [--env-file .env.staging.local] [--check-only] [next args...]",
      ].join("\n"),
    );
    return;
  }

  const rootDir = process.cwd();
  const loaded = loadIsolatedStagingEnv({
    rootDir,
    envFile: options.envFile,
    command: options.command,
    rejectPlaceholders: true,
    requireCoreCredentials: true,
  });

  if (options.command === "start") {
    assertStagingBuildManifest(rootDir, loaded.stagingProjectRef);
  }

  console.info(
    `[staging-runner] Verified isolated staging env (${path.basename(loaded.envPath)}), ref="${loaded.stagingProjectRef || "custom"}", origin="${loaded.appOriginHost || "configured"}", nodeEnv="${loaded.env.NODE_ENV}", scrubbedKeys=${loaded.scrubbedKeyCount}.`,
  );

  if (options.checkOnly) {
    console.info("[staging-runner] --check-only succeeded; skipping Next.js launch.");
    return;
  }

  const nextBin = require.resolve("next/dist/bin/next");
  const child = spawnSync(process.execPath, [nextBin, options.command, ...options.nextArgs], {
    cwd: rootDir,
    env: loaded.env,
    stdio: "inherit",
  });

  if (child.error) {
    throw child.error;
  }

  const exitCode = child.status ?? 1;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }

  if (options.command === "build") {
    writeStagingBuildManifest(rootDir, loaded);
    console.info(
      `[staging-runner] Wrote isolated staging build manifest at ${STAGING_BUILD_MANIFEST_REL}.`,
    );
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
