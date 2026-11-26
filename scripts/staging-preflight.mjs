import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { loadIsolatedStagingEnv } from "./staging/env-loader.mjs";

const HISTORICAL_END_TIMESTAMP = "20261120000003";
const HISTORICAL_BOOTSTRAP_DEFECT_FILE = "20261117000002_audit_and_notification_foundation.sql";
const REMEDIATION_FILE = "20261125000001_remediate_historical_schema_and_rpc_defects.sql";

function parseArgs(argv) {
  let envFile = ".env.staging.local";
  let allowPlaceholders = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--allow-placeholders") {
      allowPlaceholders = true;
      continue;
    }
    if (arg === "--env-file") {
      const val = argv[i + 1];
      if (!val) {
        throw new Error("--env-file requires a path.");
      }
      envFile = val;
      i += 1;
    }
  }

  return { envFile, allowPlaceholders };
}

function checkGitignore(rootDir) {
  const gitignorePath = path.join(rootDir, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    return { ok: false, detail: ".gitignore not found" };
  }
  const lines = fs
    .readFileSync(gitignorePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim());
  const ignoresStagingLocal = lines.includes(".env.staging.local");
  const tracksTemplate = lines.includes("!.env.staging.local.example");
  return {
    ok: ignoresStagingLocal && tracksTemplate,
    detail: `ignores_.env.staging.local=${ignoresStagingLocal}, allows_.env.staging.local.example=${tracksTemplate}`,
  };
}

function inspectMigrations(rootDir) {
  const migrationsDir = path.join(rootDir, "supabase", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const historical = [];
  const forwardOrPending = [];

  for (const file of files) {
    const prefix = file.split("_")[0] ?? "";
    if (prefix <= HISTORICAL_END_TIMESTAMP) {
      historical.push(file);
    } else {
      forwardOrPending.push(file);
    }
  }

  const defectPath = path.join(migrationsDir, HISTORICAL_BOOTSTRAP_DEFECT_FILE);
  const defectSql = fs.existsSync(defectPath) ? fs.readFileSync(defectPath, "utf8") : "";
  const hasHistoricalUpdateUpdatedAtCall = defectSql.includes("public.update_updated_at_column()");

  const remediationPath = path.join(migrationsDir, REMEDIATION_FILE);
  const hasRemediation = fs.existsSync(remediationPath);

  const compatPath = path.join(rootDir, "scripts", "staging", "clean-db-bootstrap-compat.sql");
  const hasStagingCompatHelper = fs.existsSync(compatPath);

  return {
    totalCount: files.length,
    historicalCount: historical.length,
    pendingCount: forwardOrPending.length,
    hasHistoricalUpdateUpdatedAtCall,
    hasRemediation,
    hasStagingCompatHelper,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const gitignoreStatus = checkGitignore(rootDir);
  const migrationStatus = inspectMigrations(rootDir);

  if (!gitignoreStatus.ok) {
    throw new Error(`.gitignore staging safeguard check failed: ${gitignoreStatus.detail}`);
  }

  console.info("[staging-preflight] Repository & Migration Inspection:");
  console.info(`  - .gitignore safety: PASS (${gitignoreStatus.detail})`);
  console.info(
    `  - Migrations found: ${migrationStatus.totalCount} total (${migrationStatus.historicalCount} historical 1..25 immutable, ${migrationStatus.pendingCount} forward/pending 26..29)`,
  );
  console.info(
    `  - Historical #13 (${HISTORICAL_BOOTSTRAP_DEFECT_FILE}) calls public.update_updated_at_column(): ${migrationStatus.hasHistoricalUpdateUpdatedAtCall}`,
  );
  console.info(
    `  - Forward remediation (${REMEDIATION_FILE}): ${migrationStatus.hasRemediation ? "PRESENT" : "MISSING"}`,
  );
  console.info(
    `  - Staging-only bootstrap SQL helper (scripts/staging/clean-db-bootstrap-compat.sql): ${migrationStatus.hasStagingCompatHelper ? "PRESENT" : "MISSING"}`,
  );

  const envPath = path.isAbsolute(options.envFile)
    ? options.envFile
    : path.join(rootDir, options.envFile);

  if (!fs.existsSync(envPath)) {
    console.info("[staging-preflight] Environment status: NOT CONFIGURED YET");
    console.info(
      `  - "${options.envFile}" does not exist yet. Copy ".env.staging.local.example" to "${options.envFile}" before linking or running staging.`,
    );
    return;
  }

  const loaded = loadIsolatedStagingEnv({
    rootDir,
    envFile: options.envFile,
    command: "start",
    rejectPlaceholders: !options.allowPlaceholders,
    requireCoreCredentials: !options.allowPlaceholders,
  });

  const hasDirectUrl = Boolean(loaded.env.DATABASE_DIRECT_URL?.trim());
  console.info("[staging-preflight] Staging Environment Isolation: PASS");
  console.info(`  - Target project ref: ${loaded.stagingProjectRef || "(unspecified)"}`);
  console.info(`  - Target origin host: ${loaded.appOriginHost || "(unspecified)"}`);
  console.info(`  - DATABASE_DIRECT_URL present: ${hasDirectUrl}`);
  console.info(`  - Scrubbed sibling/inherited env keys: ${loaded.scrubbedKeyCount}`);
  console.info("");
  console.info("[staging-preflight] Safe Next Steps for Isolated VyapOne-Staging:");
  console.info(
    `  1. Verify target link: supabase link --project-ref ${loaded.stagingProjectRef || "<staging-ref>"}`,
  );
  console.info(
    "  2. On an EMPTY VyapOne-Staging database, apply scripts/staging/clean-db-bootstrap-compat.sql (STAGE 1 only) before migration #13 so immutable historical migrations 1-25 run cleanly.",
  );
  console.info("  3. Dry-run migrations first: supabase db push --dry-run");
  console.info(
    "  4. Push migrations sequentially: supabase db push (NEVER run supabase db reset --remote)",
  );
  console.info(
    "  5. Remove temporary shim using STAGE 2 of scripts/staging/clean-db-bootstrap-compat.sql after #29 applies.",
  );
  console.info(
    "  6. Run local check & app: pnpm dev:staging  (or pnpm build:staging && pnpm start:staging)",
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
