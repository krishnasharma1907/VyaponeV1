import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { loadIsolatedStagingEnv, PRODUCTION_SUPABASE_PROJECT_REF } from "./staging/env-loader.mjs";

const REQUIRED_BUCKETS = [
  {
    name: "vyapone-public-media",
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  },
  {
    name: "vyapone-private-media",
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
];

// Deterministic Auth personas aligned with supabase/seed.sql IDs when --seed-users is used.
const SEED_PERSONAS = [
  {
    id: "00000000-0000-4000-a000-000000000001",
    email: "demo.admin@example.vyapone.internal",
    phone: "+919800000001",
    displayName: "VyapOne Platform Admin",
    preferredLanguage: "en",
  },
  {
    id: "00000000-0000-4000-a000-000000000002",
    email: "demo.reseller@example.vyapone.internal",
    phone: "+919800000002",
    displayName: "Apex Agency Owner",
    preferredLanguage: "en",
  },
  {
    id: "00000000-0000-4000-a000-000000000003",
    email: "ramesh@example.vyapone.internal",
    phone: "+919800000003",
    displayName: "Ramesh Rao",
    preferredLanguage: "kn",
  },
  {
    id: "00000000-0000-4000-a000-000000000004",
    email: "demo.staff@example.vyapone.internal",
    phone: "+919800000004",
    displayName: "Pooja Hegde",
    preferredLanguage: "kn",
  },
];

function parseArgs(argv) {
  let apply = false;
  let provisionUsers = false;
  let envFile = ".env.staging.local";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") apply = true;
    else if (arg === "--seed-users") provisionUsers = true;
    else if (arg === "--env-file") {
      const nextVal = argv[i + 1];
      if (!nextVal) throw new Error("--env-file requires a path.");
      envFile = nextVal;
      i += 1;
    }
  }

  return { apply, provisionUsers, envFile };
}

async function ensureBuckets(supabase, apply) {
  const { data: existing, error: listErr } = apply
    ? await supabase.storage.listBuckets()
    : { data: [], error: null };
  if (listErr) {
    throw new Error(`Failed to list staging storage buckets: ${listErr.message}`);
  }
  const existingNames = new Set((existing ?? []).map((b) => b.name));

  for (const spec of REQUIRED_BUCKETS) {
    if (!apply) {
      console.info(
        `[staging-bootstrap] [dry-run] Would ensure bucket "${spec.name}" (public=${spec.public}, limit=${spec.fileSizeLimit}B).`,
      );
      continue;
    }

    if (existingNames.has(spec.name)) {
      console.info(`[staging-bootstrap] Bucket "${spec.name}" already exists.`);
      continue;
    }

    const { error: createErr } = await supabase.storage.createBucket(spec.name, {
      public: spec.public,
      fileSizeLimit: spec.fileSizeLimit,
      allowedMimeTypes: spec.allowedMimeTypes,
    });
    if (createErr) {
      throw new Error(`Failed to create bucket "${spec.name}": ${createErr.message}`);
    }
    console.info(`[staging-bootstrap] Created staging bucket "${spec.name}".`);
  }
}

async function ensureSeedAuthUsers(supabase, apply, testPassword) {
  if (apply && (!testPassword || testPassword.length < 12)) {
    throw new Error(
      "Set STAGING_TEST_USER_PASSWORD in your shell (min 12 chars, never commit to files) before using --apply --seed-users.",
    );
  }

  for (const persona of SEED_PERSONAS) {
    if (!apply) {
      console.info(
        `[staging-bootstrap] [dry-run] Would ensure Auth user id=${persona.id} email=${persona.email}.`,
      );
      continue;
    }

    const { data: existing, error: getErr } = await supabase.auth.admin.getUserById(persona.id);
    if (getErr && !String(getErr.message).toLowerCase().includes("not found")) {
      throw new Error(`Failed checking Auth user ${persona.id}: ${getErr.message}`);
    }

    if (existing?.user) {
      console.info(
        `[staging-bootstrap] Auth user already exists: ${persona.email} (${persona.id}).`,
      );
      continue;
    }

    const { error: createErr } = await supabase.auth.admin.createUser({
      id: persona.id,
      email: persona.email,
      phone: persona.phone,
      password: testPassword,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        display_name: persona.displayName,
        preferred_language: persona.preferredLanguage,
      },
    });
    if (createErr) {
      throw new Error(`Failed creating Auth user ${persona.email}: ${createErr.message}`);
    }
    console.info(`[staging-bootstrap] Created staging Auth user ${persona.email} (${persona.id}).`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const testPassword = process.env.STAGING_TEST_USER_PASSWORD || "";

  const loaded = loadIsolatedStagingEnv({
    envFile: options.envFile,
    command: "start",
    rejectPlaceholders: options.apply,
    requireCoreCredentials: options.apply,
  });

  if (!loaded.stagingProjectRef || loaded.stagingProjectRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error(
      "Refusing staging bootstrap: missing verified non-production staging project ref.",
    );
  }

  console.info(
    `[staging-bootstrap] Target staging ref="${loaded.stagingProjectRef}", mode=${options.apply ? "APPLY" : "DRY-RUN"}.`,
  );

  const supabase = options.apply
    ? createClient(loaded.env.NEXT_PUBLIC_SUPABASE_URL, loaded.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

  await ensureBuckets(supabase, options.apply);

  if (options.provisionUsers) {
    await ensureSeedAuthUsers(supabase, options.apply, testPassword);
  } else {
    console.info(
      "[staging-bootstrap] Pass --seed-users (with STAGING_TEST_USER_PASSWORD in shell) to provision deterministic Auth logins for seed.sql personas.",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
