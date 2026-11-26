import fs from "node:fs";
import path from "node:path";

export const PRODUCTION_SUPABASE_PROJECT_REF = "fjoezwoyowihbxacmoyp";

const PRODUCTION_APP_HOSTS = new Set([
  "vyapone.in",
  "www.vyapone.in",
  "app.vyapone.in",
  "vyapone.kssharma2022krish.workers.dev",
]);

const DEFAULT_SIBLING_ENV_FILES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
  ".env.test",
  ".env.test.local",
  ".dev.vars",
  ".dev.vars.local",
];

const SCHEMA_ENV_KEYS = [
  "VYAPONE_STAGING_PROJECT_REF",
  "VYAPONE_STAGING_MODE",
  "NEXT_PUBLIC_APP_ENV",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NODE_ENV",
  "PORT",
  "SESSION_SECRET",
  "DATABASE_URL",
  "DATABASE_DIRECT_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REDIS_URL",
  "STORAGE_ENDPOINT",
  "STORAGE_BUCKET",
  "STORAGE_REGION",
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_SECRET_ACCESS_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "META_WHATSAPP_TOKEN",
  "META_WHATSAPP_PHONE_NUMBER_ID",
  "META_WHATSAPP_BUSINESS_ACCOUNT_ID",
  "META_WEBHOOK_VERIFY_TOKEN",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
];

const SCRUBBED_KEY_PREFIXES = [
  "NEXT_PUBLIC_",
  "SUPABASE_",
  "DATABASE_",
  "REDIS_",
  "STORAGE_",
  "RAZORPAY_",
  "META_",
  "ANTHROPIC_",
  "GEMINI_",
  "VYAPONE_STAGING_",
];

const PLACEHOLDER_MARKERS = [
  "placeholder-staging-project-ref",
  "placeholder-staging-",
  "-replace-me",
  "replace-before-running",
];

/**
 * Parses dotenv-formatted contents without interpolating or executing shell expressions.
 * @param {string} contents
 * @returns {Record<string, string>}
 */
export function parseEnvContents(contents) {
  /** @type {Record<string, string>} */
  const result = {};
  const lines = contents.replace(/\r\n?/g, "\n").split("\n");

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const withoutExport = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trimStart()
      : trimmed;
    const eqIndex = withoutExport.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }

    const key = withoutExport.slice(0, eqIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key)) {
      continue;
    }

    let value = withoutExport.slice(eqIndex + 1).trim();
    const quoteChar = value[0];
    if (
      (quoteChar === '"' || quoteChar === "'" || quoteChar === "`") &&
      value.endsWith(quoteChar) &&
      value.length >= 2
    ) {
      value = value.slice(1, -1);
      if (quoteChar === '"') {
        value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
      }
    } else {
      const commentIdx = value.search(/\s+#/);
      if (commentIdx >= 0) {
        value = value.slice(0, commentIdx).trimEnd();
      }
    }

    result[key] = value;
  }

  return result;
}

/**
 * Extracts key names only (never values) from a dotenv file if present.
 */
export function readEnvKeyNamesOnly(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const contents = fs.readFileSync(filePath, "utf8");
  return Object.keys(parseEnvContents(contents));
}

export function extractSupabaseRefFromJwt(token) {
  if (!token || typeof token !== "string") {
    return null;
  }
  const parts = token.trim().split(".");
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (typeof parsed?.ref === "string" && parsed.ref.trim().length > 0) {
      return parsed.ref.trim().toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}

export function extractSupabaseProjectRef(value, allowRawRef = false) {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const jwtRef = extractSupabaseRefFromJwt(trimmed);
  if (jwtRef) {
    return jwtRef;
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname.endsWith(".supabase.co")) {
      const parts = hostname.split(".");
      if (parts[0] === "db" && parts.length >= 4 && parts[1]) {
        return parts[1];
      }
      if (parts.length >= 3 && parts[0] && parts[0] !== "db") {
        return parts[0];
      }
    }
    if (hostname.endsWith(".supabase.com") && parsed.username.startsWith("postgres.")) {
      const ref = parsed.username.slice("postgres.".length).trim().toLowerCase();
      return ref.length > 0 ? ref : null;
    }
  } catch {
    if (allowRawRef && /^[a-z0-9-]{6,40}$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }
  }

  return null;
}

export function isProductionSupabaseValue(value) {
  if (!value || typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.toLowerCase().includes(PRODUCTION_SUPABASE_PROJECT_REF)) {
    return true;
  }
  const extractedRef = extractSupabaseProjectRef(trimmed);
  return extractedRef === PRODUCTION_SUPABASE_PROJECT_REF;
}

export function isProductionAppUrl(value) {
  if (!value || typeof value !== "string") {
    return false;
  }
  try {
    const parsed = new URL(value.trim());
    return PRODUCTION_APP_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function hasPlaceholderValue(value) {
  if (!value || typeof value !== "string") {
    return false;
  }
  const lower = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

function collectKeysToScrub(rootDir, baseEnv) {
  const keys = new Set(SCHEMA_ENV_KEYS);

  for (const filename of DEFAULT_SIBLING_ENV_FILES) {
    const fileKeys = readEnvKeyNamesOnly(path.join(rootDir, filename));
    for (const key of fileKeys) {
      keys.add(key);
    }
  }

  for (const existingKey of Object.keys(baseEnv)) {
    if (
      existingKey === "SESSION_SECRET" ||
      SCRUBBED_KEY_PREFIXES.some((prefix) => existingKey.startsWith(prefix))
    ) {
      keys.add(existingKey);
    }
  }

  return keys;
}

/**
 * Loads `.env.staging.local` strictly without falling back to `.env`, scrubs inherited and
 * sibling dotenv keys to `""`, prevents `@next/env` hydration from `.env`, and enforces
 * production reference & cross-variable isolation guards.
 *
 * @param {{
 *   rootDir?: string;
 *   envFile?: string;
 *   command?: "dev" | "build" | "start";
 *   baseEnv?: Record<string, string | undefined>;
 *   rejectPlaceholders?: boolean;
 *   requireCoreCredentials?: boolean;
 * }} [options]
 * @returns {{
 *   env: Record<string, string>;
 *   envPath: string;
 *   stagingProjectRef: string;
 *   appOriginHost: string;
 *   loadedKeys: string[];
 *   scrubbedKeyCount: number;
 * }}
 */
export function loadIsolatedStagingEnv({
  rootDir = process.cwd(),
  envFile = ".env.staging.local",
  command = "dev",
  baseEnv = process.env,
  rejectPlaceholders = true,
  requireCoreCredentials = true,
} = {}) {
  const resolvedEnvPath = path.isAbsolute(envFile) ? envFile : path.join(rootDir, envFile);
  const envBasename = path.basename(resolvedEnvPath);

  if (
    envBasename === ".env" ||
    envBasename === ".env.production" ||
    envBasename === ".env.production.local"
  ) {
    throw new Error(
      `Refusing to load "${envBasename}" in staging mode. Use an isolated ".env.staging.local" file.`,
    );
  }

  if (!fs.existsSync(resolvedEnvPath)) {
    throw new Error(
      `Missing staging environment file at "${resolvedEnvPath}". Copy ".env.staging.local.example" to ".env.staging.local" and populate isolated VyapOne-Staging credentials. Staging refuses to fall back to ".env".`,
    );
  }

  const parsedStaging = parseEnvContents(fs.readFileSync(resolvedEnvPath, "utf8"));
  const scrubKeys = collectKeysToScrub(rootDir, baseEnv);

  /** @type {Record<string, string>} */
  const isolatedEnv = {};
  for (const [key, val] of Object.entries(baseEnv)) {
    if (!scrubKeys.has(key) && val !== undefined) {
      isolatedEnv[key] = val;
    }
  }

  // Shadow all known schema and sibling `.env*` keys to empty string so Next.js `@next/env`
  // cannot hydrate omitted variables from `.env` or `.env.local`.
  for (const key of scrubKeys) {
    isolatedEnv[key] = "";
  }

  for (const [key, val] of Object.entries(parsedStaging)) {
    isolatedEnv[key] = val;
  }

  // Enforce deterministic Next.js command NODE_ENV, safe non-secret defaults, and active isolation flags.
  isolatedEnv.NODE_ENV = command === "build" || command === "start" ? "production" : "development";
  isolatedEnv.NEXT_PUBLIC_APP_ENV = parsedStaging.NEXT_PUBLIC_APP_ENV?.trim() || "staging";
  isolatedEnv.PORT = parsedStaging.PORT?.trim() || "3000";
  isolatedEnv.STORAGE_REGION = parsedStaging.STORAGE_REGION?.trim() || "ap-south-1";
  isolatedEnv.VYAPONE_STAGING_MODE = "1";
  isolatedEnv.__NEXT_PROCESSED_ENV = "true";

  const errors = [];

  if (isolatedEnv.NEXT_PUBLIC_APP_ENV !== "staging") {
    errors.push(
      `NEXT_PUBLIC_APP_ENV must be "staging" (found "${isolatedEnv.NEXT_PUBLIC_APP_ENV}").`,
    );
  }

  if (isProductionAppUrl(isolatedEnv.NEXT_PUBLIC_APP_URL)) {
    errors.push("NEXT_PUBLIC_APP_URL points to a production VyapOne origin.");
  }

  const checkedKeys = [
    "VYAPONE_STAGING_PROJECT_REF",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "DATABASE_URL",
    "DATABASE_DIRECT_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STORAGE_ENDPOINT",
  ];

  const discoveredRefs = new Map();
  for (const key of checkedKeys) {
    const val = isolatedEnv[key];
    if (!val) {
      continue;
    }
    if (isProductionSupabaseValue(val)) {
      errors.push(
        `${key} resolves to production Supabase project "${PRODUCTION_SUPABASE_PROJECT_REF}".`,
      );
      continue;
    }
    if (key !== "STORAGE_ENDPOINT") {
      const ref = extractSupabaseProjectRef(val, key === "VYAPONE_STAGING_PROJECT_REF");
      if (ref) {
        discoveredRefs.set(key, ref);
      }
    }
  }

  // Also scan all loaded staging entries as a belt-and-suspenders guard against hidden prod refs.
  for (const [key, val] of Object.entries(parsedStaging)) {
    if (typeof val === "string" && isProductionSupabaseValue(val)) {
      if (!errors.some((msg) => msg.startsWith(`${key} `))) {
        errors.push(
          `${key} contains production Supabase project reference "${PRODUCTION_SUPABASE_PROJECT_REF}".`,
        );
      }
    }
  }

  const uniqueRefs = new Set(discoveredRefs.values());
  if (uniqueRefs.size > 1) {
    errors.push(
      `Staging Supabase project reference mismatch across keys: ${Array.from(discoveredRefs.keys()).join(", ")}.`,
    );
  }

  if (requireCoreCredentials) {
    for (const reqKey of [
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "DATABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      if (!isolatedEnv[reqKey] || isolatedEnv[reqKey].trim().length === 0) {
        errors.push(`${reqKey} is required in ${envBasename}.`);
      }
    }

    const secret = isolatedEnv.SESSION_SECRET || "";
    if (
      secret.trim().length < 32 ||
      secret === "dev-only-secret-do-not-use-in-production-min-32-chars"
    ) {
      errors.push("SESSION_SECRET must be a unique 32+ character staging secret.");
    }
  }

  if (rejectPlaceholders) {
    for (const checkKey of [
      "VYAPONE_STAGING_PROJECT_REF",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SESSION_SECRET",
      "DATABASE_URL",
      "DATABASE_DIRECT_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      if (hasPlaceholderValue(isolatedEnv[checkKey])) {
        errors.push(
          `${checkKey} still contains an unedited template placeholder in ${envBasename}.`,
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `[VyapOne Staging Isolation Error]\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  const stagingProjectRef =
    discoveredRefs.values().next().value ||
    extractSupabaseProjectRef(isolatedEnv.NEXT_PUBLIC_SUPABASE_URL) ||
    "";

  let appOriginHost = "";
  try {
    appOriginHost = new URL(isolatedEnv.NEXT_PUBLIC_APP_URL).host;
  } catch {
    appOriginHost = "";
  }

  return {
    env: isolatedEnv,
    envPath: resolvedEnvPath,
    stagingProjectRef,
    appOriginHost,
    loadedKeys: Object.keys(parsedStaging),
    scrubbedKeyCount: scrubKeys.size,
  };
}
