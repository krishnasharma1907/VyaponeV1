/**
 * VyapOne — Cross-Platform Production Build Script
 *
 * Coordinates Next.js build compilation with OpenNext Cloudflare packaging:
 * 1. Runs Next.js production build (`next build`) across all platforms.
 * 2. In Cloudflare Workers Builds / Linux CI deployment environments, executes
 *    `opennextjs-cloudflare build --skipNextBuild` to generate `.open-next/worker.js`
 *    and `.open-next/assets` for Wrangler deployment.
 * 3. On Windows developer hosts, safely completes after `next build` to prevent
 *    NTFS symlink and native `@ast-grep/napi` MSVC driver crashes.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

console.log("[build] Executing Next.js production build...");

// 1. Run Next.js production build with standalone mode enabled
const nextBin = path.resolve("node_modules/next/dist/bin/next");
const nextResult = spawnSync(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PRIVATE_STANDALONE: "true",
  },
});

if (nextResult.status !== 0) {
  process.exit(nextResult.status ?? 1);
}

// 2. Detect target deployment environment
const isLinux = process.platform === "linux";
const isGitHubActions = Boolean(process.env.GITHUB_ACTIONS);
const isCloudflareBuild = Boolean(
  process.env.CF_PAGES || process.env.CLOUDFLARE_BUILD || (!isGitHubActions && isLinux),
);

// 3. In Cloudflare Workers Builds, package with OpenNext for Wrangler
if (isCloudflareBuild) {
  const openNextCli = path.resolve("node_modules/@opennextjs/cloudflare/dist/cli/index.js");

  if (fs.existsSync(openNextCli)) {
    console.log(
      "[build] Cloudflare Linux environment detected. Packaging with opennextjs-cloudflare...",
    );
    const openNextResult = spawnSync(process.execPath, [openNextCli, "build", "--skipNextBuild"], {
      stdio: "inherit",
      env: process.env,
    });

    if (openNextResult.status !== 0) {
      console.error(
        "[build] opennextjs-cloudflare packaging failed with exit code:",
        openNextResult.status,
      );
      process.exit(openNextResult.status ?? 1);
    }
    console.log("[build] OpenNext Cloudflare worker successfully packaged in .open-next/");
  }
} else {
  console.log(
    "[build] Next.js build completed successfully. (Cloudflare Worker packaging targets Linux deployment containers).",
  );
}
