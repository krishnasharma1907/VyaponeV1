import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import prettier from "prettier";

describe("CLOUD-006 Linux Cloudflare & Supabase Validation Workflow", () => {
  const rootDir = process.cwd();
  const workflowPath = path.join(rootDir, ".github", "workflows", "cloudflare-validation.yml");
  const runtimeScriptPath = path.join(rootDir, "scripts", "ci", "verify-opennext-runtime.mjs");
  const migrationScriptPath = path.join(rootDir, "scripts", "ci", "verify-supabase-migrations.mjs");

  it("defines .github/workflows/cloudflare-validation.yml and helper verification scripts", () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
    expect(fs.existsSync(runtimeScriptPath)).toBe(true);
    expect(fs.existsSync(migrationScriptPath)).toBe(true);
  });

  const workflowContent = fs.readFileSync(workflowPath, "utf-8");
  const runtimeScriptContent = fs.readFileSync(runtimeScriptPath, "utf-8");
  const migrationScriptContent = fs.readFileSync(migrationScriptPath, "utf-8");

  it("validates YAML syntax via Prettier yaml parser", async () => {
    await expect(prettier.format(workflowContent, { parser: "yaml" })).resolves.toBeTypeOf(
      "string",
    );
  });

  it("restricts trigger strictly to workflow_dispatch only", () => {
    expect(workflowContent).toMatch(/^on:\s*\n\s+workflow_dispatch:/m);
    expect(workflowContent).not.toMatch(/^\s*(push|pull_request|pull_request_target|schedule):/m);
  });

  it("enforces read-only GITHUB_TOKEN permissions, concurrency, and timeouts", () => {
    expect(workflowContent).toMatch(/^permissions:\s*\n\s+contents:\s*read\b/m);
    expect(workflowContent).not.toContain("write-all");
    expect(workflowContent).toContain("concurrency:");
    expect(workflowContent).toContain("cancel-in-progress: true");
    expect(workflowContent).toContain("timeout-minutes:");
  });

  it("pins all third-party GitHub Actions to 40-char commit SHAs and runs on Linux with Node 24", () => {
    const usesMatches = [...workflowContent.matchAll(/uses:\s*([^\s#]+)/g)].map((m) => m[1]);
    expect(usesMatches.length).toBeGreaterThanOrEqual(9);
    for (const actionRef of usesMatches) {
      expect(actionRef).toMatch(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+@[0-9a-f]{40}$/);
    }
    expect(workflowContent).toContain("runs-on: ubuntu-latest");
    expect(workflowContent).toContain('node-version-file: ".nvmrc"');
    expect(workflowContent).toContain("persist-credentials: false");
    expect(workflowContent).toContain("pnpm install --frozen-lockfile");
  });

  it("does not deploy, use --remote, or invoke linked/production Supabase commands", () => {
    const forbiddenPatterns = [
      /\bwrangler\s+deploy\b/i,
      /\bopennextjs-cloudflare\s+deploy\b/i,
      /\bsupabase\s+db\s+push\b/i,
      /--remote\b/i,
      /--linked\b/i,
      /SUPABASE_ACCESS_TOKEN/i,
      /CLOUDFLARE_API_TOKEN/i,
      /git\s+push\b/i,
    ];
    for (const pattern of forbiddenPatterns) {
      expect(workflowContent).not.toMatch(pattern);
      expect(runtimeScriptContent).not.toMatch(pattern);
      expect(migrationScriptContent).not.toMatch(pattern);
    }
  });

  it("runs all quality gates, Next/OpenNext builds, and inspects .open-next artifacts", () => {
    expect(workflowContent).toContain("pnpm format:check");
    expect(workflowContent).toContain("pnpm lint");
    expect(workflowContent).toContain("pnpm typecheck");
    expect(workflowContent).toContain("pnpm test");
    expect(workflowContent).toContain("pnpm build");
    expect(workflowContent).toContain("pnpm exec opennextjs-cloudflare build");
    expect(workflowContent).toContain(".open-next/worker.js");
    expect(workflowContent).toContain(".open-next/assets");
    expect(workflowContent).toContain("node scripts/ci/verify-opennext-runtime.mjs");
  });

  it("verifies all 11 required routes in the OpenNext local Worker runtime script", () => {
    const requiredRoutes = [
      "/",
      "/login",
      "/dashboard",
      "/robots.txt",
      "/sitemap.xml",
      "/s/preview",
      "/privacy",
      "/auth/callback",
      "/counter",
      "/workspace",
      "/qr/test-slug",
    ];
    for (const route of requiredRoutes) {
      expect(runtimeScriptContent).toContain(`"${route}"`);
    }
    expect(runtimeScriptContent).toContain('"opennextjs-cloudflare", "preview"');
  });

  it("installs checksum-verified pinned Supabase CLI and verifies isolated local DB & pending RPCs", () => {
    expect(workflowContent).toContain('SUPABASE_CLI_VERSION: "2.54.11"');
    expect(workflowContent).toContain("sha256sum --check");
    expect(workflowContent).toContain("supabase start");
    expect(workflowContent).toContain("supabase db reset --local --yes");
    expect(workflowContent).toContain("supabase migration list --local");
    expect(workflowContent).toContain("supabase test db");
    expect(workflowContent).toContain("node scripts/ci/verify-supabase-migrations.mjs");
    expect(migrationScriptContent).toContain("127.0.0.1");
    expect(migrationScriptContent).toContain("save_site_draft_configuration_atomic");
    expect(migrationScriptContent).toContain("rollback_published_site_version_atomic");
    expect(migrationScriptContent).toContain("publish_site_draft_atomic");
    expect(migrationScriptContent).toContain("mainQrCode");
    expect(migrationScriptContent).toContain("VY001");
    expect(migrationScriptContent).toContain("VY013");
    expect(migrationScriptContent).toContain("VY049");
    expect(migrationScriptContent).toContain("accept_workspace_invitation_atomic");
    expect(migrationScriptContent).toContain("accept_business_invitation_atomic");
    expect(migrationScriptContent).toContain("create_business_with_setup_atomic");
    expect(migrationScriptContent).toContain("confirm_business_import_atomic");
    expect(migrationScriptContent).toContain("transition_site_status_atomic");
  });
});
