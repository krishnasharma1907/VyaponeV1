import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Database Migration Framework [VO-020]", () => {
  const rootDir = process.cwd();
  const migrationsDir = path.join(rootDir, "supabase", "migrations");
  const configPath = path.join(rootDir, "supabase", "config.toml");
  const seedPath = path.join(rootDir, "supabase", "seed.sql");
  const pgTapTestPath = path.join(rootDir, "supabase", "tests", "00001_schema_test.sql");

  it("verifies the Supabase local configuration file exists and has valid settings", () => {
    expect(fs.existsSync(configPath)).toBe(true);
    const content = fs.readFileSync(configPath, "utf-8");

    expect(content).toContain('id = "vyapone"');
    expect(content).toContain("[api]");
    expect(content).toContain("[db]");
    expect(content).toContain("[db.pooler]");
    expect(content).toContain('pool_mode = "transaction"');
    expect(content).toContain("[auth]");
    expect(content).toContain("[storage]");
  });

  it("verifies migration directory exists and contains deterministically named migrations", () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));

    expect(files.length).toBeGreaterThanOrEqual(1);

    const migrationNamePattern = /^\d{14}_[a-z0-9_]+\.sql$/;
    for (const file of files) {
      expect(file).toMatch(migrationNamePattern);
    }
  });

  describe("Initial Core Schema Migration (20261112000001_initial_schema.sql)", () => {
    const initialMigrationPath = path.join(migrationsDir, "20261112000001_initial_schema.sql");
    let sql: string;

    it("verifies the initial schema migration file exists", () => {
      expect(fs.existsSync(initialMigrationPath)).toBe(true);
      sql = fs.readFileSync(initialMigrationPath, "utf-8");
    });

    it("creates all 14 canonical database tables", () => {
      if (!sql) sql = fs.readFileSync(initialMigrationPath, "utf-8");

      const requiredTables = [
        "users",
        "user_auth_identities",
        "workspaces",
        "workspace_members",
        "businesses",
        "locations",
        "business_members",
        "sites",
        "catalogue_items",
        "customers",
        "orders",
        "invoice_sequences",
        "bills",
        "audit_logs",
      ];

      for (const table of requiredTables) {
        const createTableRegex = new RegExp(`CREATE\\s+TABLE\\s+public\\.${table}\\s*\\(`, "i");
        expect(sql).toMatch(createTableRegex);
      }
    });

    it("enforces UUID primary keys with gen_random_uuid() across tables", () => {
      if (!sql) sql = fs.readFileSync(initialMigrationPath, "utf-8");

      // Verify gen_random_uuid is used as default primary key
      const uuidPkMatches = sql.match(
        /id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/gi,
      );
      expect(uuidPkMatches).not.toBeNull();
      expect(uuidPkMatches!.length).toBe(14); // All 14 tables have UUID PK
    });

    it("enforces integer minor units for monetary amounts and bans floating-point numbers", () => {
      if (!sql) sql = fs.readFileSync(initialMigrationPath, "utf-8");

      // Check minor units columns are BIGINT
      expect(sql).toMatch(/price_minor\s+BIGINT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/total_spend_minor\s+BIGINT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/total_minor\s+BIGINT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/amount_minor\s+BIGINT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/tax_minor\s+BIGINT\s+NOT\s+NULL/i);

      // Verify no floating-point financial columns exist
      expect(sql).not.toMatch(/price\s+REAL/i);
      expect(sql).not.toMatch(/price\s+FLOAT/i);
      expect(sql).not.toMatch(/amount\s+DOUBLE\s+PRECISION/i);
      expect(sql).not.toMatch(/total\s+FLOAT/i);
    });

    it("enables Row-Level Security on all 14 tables for Default Deny security posture", () => {
      if (!sql) sql = fs.readFileSync(initialMigrationPath, "utf-8");

      const rlsMatches = sql.match(
        /ALTER\s+TABLE\s+public\.\w+\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/gi,
      );
      expect(rlsMatches).not.toBeNull();
      expect(rlsMatches!.length).toBe(14);
    });

    it("creates composite B-tree indexes for multi-tenant scalability", () => {
      if (!sql) sql = fs.readFileSync(initialMigrationPath, "utf-8");

      expect(sql).toContain("idx_catalogue_items_business_created");
      expect(sql).toContain("idx_customers_business_created");
      expect(sql).toContain("idx_orders_business_created");
      expect(sql).toContain("idx_bills_business_created");
      expect(sql).toContain("idx_audit_logs_business_created");
    });
  });

  describe("Seed Data Invariants (seed.sql)", () => {
    it("verifies seed.sql exists and contains valid RFC 4122 v4 UUIDs", () => {
      expect(fs.existsSync(seedPath)).toBe(true);
      const seedContent = fs.readFileSync(seedPath, "utf-8");

      // Extract all UUID literals
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
      const matchedUuids = seedContent.match(uuidRegex);

      expect(matchedUuids).not.toBeNull();
      expect(matchedUuids!.length).toBeGreaterThanOrEqual(14);
    });

    it("verifies seed.sql does not leak live customer PII or production credentials", () => {
      const seedContent = fs.readFileSync(seedPath, "utf-8");

      // Verify all emails use RFC 2606 reserved .internal domains
      const emailMatches = seedContent.match(/'[^']+@[^']+'/g) || [];
      expect(emailMatches.length).toBeGreaterThan(0);
      for (const email of emailMatches) {
        expect(email).toContain(".vyapone.internal");
      }

      // Verify no live passwords or API secrets
      expect(seedContent).not.toContain("AKIA");
      expect(seedContent).not.toContain("eyJhbGciOi");
      expect(seedContent).not.toContain("live_secret");
    });
  });

  describe("pgTAP Test Suite (00001_schema_test.sql)", () => {
    it("verifies pgTAP test file exists and contains valid test assertions", () => {
      expect(fs.existsSync(pgTapTestPath)).toBe(true);
      const pgTapContent = fs.readFileSync(pgTapTestPath, "utf-8");

      expect(pgTapContent).toContain("BEGIN;");
      expect(pgTapContent).toContain("SELECT plan(32);");
      expect(pgTapContent).toContain("has_table(");
      expect(pgTapContent).toContain("col_type_is(");
      expect(pgTapContent).toContain("row_level_security_is_active(");
      expect(pgTapContent).toContain("SELECT * FROM finish();");
      expect(pgTapContent).toContain("ROLLBACK;");
    });
  });
});
