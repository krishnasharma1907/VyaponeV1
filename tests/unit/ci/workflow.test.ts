import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("CI & Pull-Request Validation Architecture [VO-018]", () => {
  const rootDir = process.cwd();
  const workflowPath = path.join(rootDir, ".github/workflows/ci.yml");
  const dependabotPath = path.join(rootDir, ".github/dependabot.yml");
  const nvmrcPath = path.join(rootDir, ".nvmrc");
  const packageJsonPath = path.join(rootDir, "package.json");

  it("verifies .github/workflows/ci.yml exists and defines correct triggers", () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
    const content = fs.readFileSync(workflowPath, "utf8");

    // Must trigger on push and pull_request to main branch
    expect(content).toMatch(/push:\s*\n\s*branches:\s*\[main\]/);
    expect(content).toMatch(/pull_request:\s*\n\s*branches:\s*\[main\]/);
    expect(content).toContain("workflow_dispatch:");
  });

  it("enforces least-privilege permissions and concurrency control", () => {
    const content = fs.readFileSync(workflowPath, "utf8");

    // Read-only contents permission
    expect(content).toMatch(/permissions:\s*\n\s*contents:\s*read/);

    // Concurrency control with PR cancellation
    expect(content).toContain("concurrency:");
    expect(content).toContain("group: ${{ github.workflow }}-${{ github.ref }}");
    expect(content).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
  });

  it("pins all third-party actions to 40-character commit SHAs with version comments", () => {
    const content = fs.readFileSync(workflowPath, "utf8");

    // Verified pinned SHAs
    const usesLines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("uses:"));

    expect(usesLines.length).toBeGreaterThan(0);

    for (const line of usesLines) {
      const match = line.match(/^uses:\s*([\w\-./]+)@([0-9a-f]{40})\s*#\s*(v[0-9.]+)/i);
      expect(
        match,
        `Action "${line}" must be pinned to a full 40-character commit SHA with a version comment`,
      ).not.toBeNull();
    }

    // Specific verified actions
    expect(content).toContain("actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0");
    expect(content).toContain(
      "pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v5.0.0",
    );
    expect(content).toContain(
      "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0",
    );
    expect(content).toContain("persist-credentials: false");
  });

  it("configures all required quality gates and production build", () => {
    const content = fs.readFileSync(workflowPath, "utf8");

    // Required gates in quality-checks job
    expect(content).toContain("pnpm install --frozen-lockfile");
    expect(content).toContain("pnpm format:check");
    expect(content).toContain("pnpm lint");
    expect(content).toContain("pnpm typecheck");
    expect(content).toContain("pnpm test");

    // Required production build in production-build job
    expect(content).toContain("pnpm build");
    expect(content).toContain("needs: [quality-checks]");
  });

  it("verifies Dependabot configuration exists with github-actions and npm ecosystems", () => {
    expect(fs.existsSync(dependabotPath)).toBe(true);
    const content = fs.readFileSync(dependabotPath, "utf8");

    expect(content).toContain('package-ecosystem: "github-actions"');
    expect(content).toContain('package-ecosystem: "npm"');
    expect(content).toContain('interval: "weekly"');
  });

  it("verifies reproducible Node.js and pnpm version configuration", () => {
    expect(fs.existsSync(nvmrcPath)).toBe(true);
    const nvmrcContent = fs.readFileSync(nvmrcPath, "utf8").trim();
    expect(nvmrcContent).toBe("24");

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    expect(packageJson.packageManager).toBe("pnpm@11.21.0");
    expect(packageJson.engines.node).toBe(">=24.0.0");
  });

  it("verifies pnpm-workspace.yaml defines valid packages array and approved builds for CI and Cloudflare Workers Builds", () => {
    const workspacePath = path.join(rootDir, "pnpm-workspace.yaml");
    expect(fs.existsSync(workspacePath)).toBe(true);
    const content = fs.readFileSync(workspacePath, "utf8");

    // Must define packages with root package '.' to avoid ERR_PNPM_PACKAGES_FIELD_MISSING_OR_EMPTY
    expect(content).toMatch(/packages:\s*\n\s*-\s*["']?\./);
    // Must approve esbuild and workerd builds for Cloudflare deployment
    expect(content).toContain("esbuild: true");
    expect(content).toContain("workerd: true");
    expect(content).toContain("- esbuild");
    expect(content).toContain("- workerd");
  });
});
