import fs from "node:fs";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

const DEFAULT_LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const ALLOWED_LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function assertLocalDatabaseUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  if (!ALLOWED_LOCAL_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `Refusing to run migration tests against non-local host "${parsed.hostname}". Only local isolated databases are permitted.`,
    );
  }
  return rawUrl;
}

function recordResult(results, name, passed, detail) {
  results.push({ Check: name, Result: passed ? "PASS" : "FAIL", Detail: detail });
}

async function runSchemaAndPrivilegeChecks(client, results) {
  const tablesRes = await client.query(`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('site_domains', 'qr_codes')
    ORDER BY c.relname;
  `);

  const tableMap = new Map(tablesRes.rows.map((r) => [r.table_name, r.rls_enabled]));
  recordResult(
    results,
    "Table public.site_domains with RLS",
    tableMap.get("site_domains") === true,
    `rls_enabled=${String(tableMap.get("site_domains"))}`,
  );
  recordResult(
    results,
    "Table public.qr_codes with RLS",
    tableMap.get("qr_codes") === true,
    `rls_enabled=${String(tableMap.get("qr_codes"))}`,
  );

  const procsRes = await client.query(`
    SELECT
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args,
      p.prosecdef,
      p.proconfig,
      has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
      has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc_exec
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'accept_workspace_invitation_atomic',
        'accept_business_invitation_atomic',
        'create_business_with_setup_atomic',
        'confirm_business_import_atomic',
        'assert_and_lock_workspace_capacity',
        'transition_site_status_atomic',
        'save_site_draft_configuration_atomic',
        'rollback_published_site_version_atomic',
        'publish_site_draft_atomic'
      )
    ORDER BY p.proname;
  `);

  const expectedRpcs = new Map([
    ["accept_workspace_invitation_atomic", { anonExec: false, authExec: true, svcExec: true }],
    ["accept_business_invitation_atomic", { anonExec: false, authExec: true, svcExec: true }],
    ["create_business_with_setup_atomic", { anonExec: false, authExec: true, svcExec: false }],
    ["confirm_business_import_atomic", { anonExec: false, authExec: true, svcExec: false }],
    ["assert_and_lock_workspace_capacity", { anonExec: false, authExec: true, svcExec: true }],
    ["transition_site_status_atomic", { anonExec: false, authExec: true, svcExec: true }],
    ["save_site_draft_configuration_atomic", { anonExec: false, authExec: true, svcExec: false }],
    ["rollback_published_site_version_atomic", { anonExec: false, authExec: true, svcExec: true }],
    ["publish_site_draft_atomic", { anonExec: false, authExec: true, svcExec: true }],
  ]);

  const seenRpcs = new Map(procsRes.rows.map((r) => [r.proname, r]));
  for (const [name, expected] of expectedRpcs) {
    const row = seenRpcs.get(name);
    const hasSearchPath = Array.isArray(row?.proconfig)
      ? row.proconfig.some((item) => item === "search_path=" || item === "search_path=''")
      : false;
    const passed =
      Boolean(row) &&
      row.prosecdef === true &&
      hasSearchPath &&
      row.anon_exec === expected.anonExec &&
      row.auth_exec === expected.authExec &&
      row.svc_exec === expected.svcExec;
    recordResult(
      results,
      `RPC ${name} metadata & grants`,
      passed,
      row
        ? `args=(${row.args}), secdef=${row.prosecdef}, config=${JSON.stringify(row.proconfig)}, anon=${row.anon_exec}, auth=${row.auth_exec}, svc=${row.svc_exec}`
        : "Function not found in pg_proc",
    );
  }

  const tablePrivRes = await client.query(`
    SELECT
      has_table_privilege('anon', 'public.site_domains', 'SELECT') AS anon_domains_select,
      has_table_privilege('authenticated', 'public.site_domains', 'SELECT,INSERT,UPDATE,DELETE') AS auth_domains_crud,
      has_table_privilege('anon', 'public.qr_codes', 'SELECT') AS anon_qr_select,
      has_table_privilege('anon', 'public.qr_codes', 'INSERT') AS anon_qr_insert,
      has_table_privilege('authenticated', 'public.qr_codes', 'SELECT,INSERT,UPDATE,DELETE') AS auth_qr_crud;
  `);
  const priv = tablePrivRes.rows[0];
  const privOk =
    priv.anon_domains_select === false &&
    priv.auth_domains_crud === true &&
    priv.anon_qr_select === true &&
    priv.anon_qr_insert === false &&
    priv.auth_qr_crud === true;
  recordResult(results, "Table privileges (site_domains & qr_codes)", privOk, JSON.stringify(priv));

  const notifTrigRes = await client.query(`
    SELECT p.proname AS fn_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public'
      AND c.relname = 'notifications'
      AND t.tgname = 'trg_notifications_updated_at';
  `);
  const notifFn = notifTrigRes.rows[0]?.fn_name;
  recordResult(
    results,
    "Trigger trg_notifications_updated_at uses set_updated_at()",
    notifFn === "set_updated_at",
    `fn_name=${String(notifFn)}`,
  );
}

async function setAuthenticatedSession(client, userId) {
  await client.query("SET LOCAL ROLE authenticated");
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
  await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
}

async function runBehavioralChecks(client, results) {
  const ids = {
    ownerUser: "11111111-1111-4111-8111-111111111101",
    strangerUser: "11111111-1111-4111-8111-111111111102",
    workspace: "22222222-2222-4222-8222-222222222201",
    business: "33333333-3333-4333-8333-333333333301",
    site: "44444444-4444-4444-8444-444444444401",
    version1: "55555555-5555-4555-8555-555555555501",
    version2: "55555555-5555-4555-8555-555555555502",
  };

  await client.query("BEGIN");
  try {
    await client.query(
      `
      INSERT INTO auth.users (id, aud, role, email)
      VALUES ($1, 'authenticated', 'authenticated', 'ci-owner@example.invalid'),
             ($2, 'authenticated', 'authenticated', 'ci-stranger@example.invalid')
      ON CONFLICT (id) DO NOTHING;
      `,
      [ids.ownerUser, ids.strangerUser],
    );

    await client.query(
      `
      INSERT INTO public.users (id, display_name, email, status)
      VALUES ($1, 'CI Sovereign Owner', 'ci-owner@example.invalid', 'active'),
             ($2, 'CI Stranger User', 'ci-stranger@example.invalid', 'active');
      `,
      [ids.ownerUser, ids.strangerUser],
    );

    await client.query(
      `
      INSERT INTO public.workspaces (id, name, slug, owner_user_id, status, plan)
      VALUES ($1, 'CI Test Workspace', 'ci-test-ws', $2, 'active', 'starter');
      `,
      [ids.workspace, ids.ownerUser],
    );

    await client.query(
      `
      INSERT INTO public.businesses (
        id, workspace_id, legal_name, trade_name, slug, sovereign_owner_id, status
      )
      VALUES ($1, $2, 'CI Test Store Legal', 'CI Test Store', 'ci-test-store', $3, 'active');
      `,
      [ids.business, ids.workspace, ids.ownerUser],
    );

    await client.query(
      `
      INSERT INTO public.sites (id, business_id, subdomain, status)
      VALUES ($1, $2, 'ci-test-store', 'draft');
      `,
      [ids.site, ids.business],
    );

    await client.query(
      `
      INSERT INTO public.site_versions (
        id, site_id, business_id, version_number, schema_version, configuration, change_summary, created_by
      )
      VALUES (
        $1, $2, $3, 1, 'v1', '{"title":"CI Store V1"}'::jsonb, 'Initial draft', $4
      );
      `,
      [ids.version1, ids.site, ids.business, ids.ownerUser],
    );

    await client.query(
      `
      UPDATE public.sites
      SET current_draft_version_id = $1
      WHERE id = $2;
      `,
      [ids.version1, ids.site],
    );

    // 1. Unauthorized publish denial
    await client.query("SAVEPOINT sp_unauth_publish");
    try {
      await setAuthenticatedSession(client, ids.strangerUser);
      await client.query(`SELECT public.publish_site_draft_atomic($1, $2, $3, $4, $5);`, [
        ids.site,
        ids.business,
        ids.strangerUser,
        ids.version1,
        1,
      ]);
      recordResult(
        results,
        "Behavior: Unauthorized publish denied",
        false,
        "Expected authorization error, but RPC succeeded",
      );
      await client.query("RELEASE SAVEPOINT sp_unauth_publish");
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT sp_unauth_publish");
      const msg = err instanceof Error ? err.message : String(err);
      const isExpectedAuthErr =
        msg.includes("Unauthorized") || msg.includes("Access denied") || msg.includes("VY020");
      recordResult(results, "Behavior: Unauthorized publish denied", isExpectedAuthErr, msg);
    }

    // 1b. Unauthorized rollback denial
    await client.query("SAVEPOINT sp_unauth_rollback");
    try {
      await setAuthenticatedSession(client, ids.strangerUser);
      await client.query(
        `SELECT public.rollback_published_site_version_atomic($1, $2, $3, $4, $5);`,
        [ids.site, ids.business, ids.strangerUser, ids.version1, null],
      );
      recordResult(
        results,
        "Behavior: Unauthorized rollback denied",
        false,
        "Expected authorization error, but RPC succeeded",
      );
      await client.query("RELEASE SAVEPOINT sp_unauth_rollback");
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT sp_unauth_rollback");
      const msg = err instanceof Error ? err.message : String(err);
      const isExpectedAuthErr =
        msg.includes("Unauthorized") || msg.includes("Access denied") || msg.includes("VY020");
      recordResult(results, "Behavior: Unauthorized rollback denied", isExpectedAuthErr, msg);
    }

    // 2. Draft save & optimistic concurrency check (20261122000001)
    await client.query("SAVEPOINT sp_draft_save");
    try {
      await setAuthenticatedSession(client, ids.ownerUser);
      const saveRes = await client.query(
        `SELECT public.save_site_draft_configuration_atomic($1, $2, $3, 'v1', '{"title":"CI Store V2"}'::jsonb, 'Second draft', ARRAY[]::uuid[], 1) AS payload;`,
        [ids.site, ids.business, ids.ownerUser],
      );
      recordResult(
        results,
        "Behavior: Draft save increments version atomically",
        Boolean(saveRes.rows[0]?.payload),
        JSON.stringify(saveRes.rows[0]?.payload),
      );
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT sp_draft_save");
      recordResult(
        results,
        "Behavior: Draft save increments version atomically",
        false,
        err instanceof Error ? err.message : String(err),
      );
    }

    // Stale expected version should raise VY049
    await client.query("SAVEPOINT sp_draft_conflict");
    try {
      await setAuthenticatedSession(client, ids.ownerUser);
      await client.query(
        `SELECT public.save_site_draft_configuration_atomic($1, $2, $3, 'v1', '{"title":"Stale"}'::jsonb, 'Conflict', ARRAY[]::uuid[], 1);`,
        [ids.site, ids.business, ids.ownerUser],
      );
      recordResult(
        results,
        "Behavior: Draft save optimistic lock (VY049)",
        false,
        "Expected VY049 conflict on stale expected_base_version_number=1",
      );
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT sp_draft_conflict");
      const msg = err instanceof Error ? err.message : String(err);
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      recordResult(
        results,
        "Behavior: Draft save optimistic lock (VY049)",
        code === "VY049" || msg.includes("conflict"),
        `${code}: ${msg}`,
      );
    }

    // 3. Valid owner publish via publish_site_draft_atomic (20261122000003)
    await client.query("SAVEPOINT sp_publish_valid");
    let publishedV1 = false;
    try {
      await setAuthenticatedSession(client, ids.ownerUser);
      const pubRes = await client.query(
        `SELECT public.publish_site_draft_atomic($1, $2, $3, $4, $5) AS payload;`,
        [ids.site, ids.business, ids.ownerUser, ids.version1, 1],
      );
      const payload = pubRes.rows[0]?.payload;
      const qrPayload = payload?.mainQrCode;
      const contractOk =
        Boolean(payload?.site) &&
        payload.site.status === "published" &&
        Boolean(payload?.publishedVersion?.published_at) &&
        Boolean(qrPayload?.public_slug) &&
        qrPayload?.destination_configuration?.type === "storefront";
      publishedV1 = contractOk;
      recordResult(
        results,
        "Behavior: Valid owner publish returns mainQrCode & type=storefront",
        contractOk,
        JSON.stringify(payload),
      );
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT sp_publish_valid");
      const msg = err instanceof Error ? err.message : String(err);
      recordResult(
        results,
        "Behavior: Valid owner publish returns mainQrCode & type=storefront",
        false,
        msg,
      );
    }

    // 3b. Direct UPDATE public.sites SET status = 'published' without GUC must fail (20261125000001 trigger fix)
    await client.query("SAVEPOINT sp_direct_status_block");
    try {
      await client.query("RESET ROLE");
      await client.query(`UPDATE public.sites SET status = 'draft' WHERE id = $1;`, [ids.site]);
      await client.query(`UPDATE public.sites SET status = 'published' WHERE id = $1;`, [ids.site]);
      recordResult(
        results,
        "Behavior: Direct sites.status='published' without atomic GUC blocked",
        false,
        "Expected trigger VY003 exception when vyapone.in_atomic_site_transition is unset",
      );
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT sp_direct_status_block");
      const msg = err instanceof Error ? err.message : String(err);
      recordResult(
        results,
        "Behavior: Direct sites.status='published' without atomic GUC blocked",
        msg.includes("prohibited") || msg.includes("VY003"),
        msg,
      );
    }

    // 3c. Zero capacity_overrides row must enforce starter limit=3 (no NULL bypass)
    await client.query("SAVEPOINT sp_capacity_no_override");
    try {
      await client.query("RESET ROLE");
      for (let i = 2; i <= 4; i++) {
        const extraBiz = `33333333-3333-4333-8333-33333333330${i}`;
        const extraSite = `44444444-4444-4444-8444-44444444440${i}`;
        const extraVer = `55555555-5555-4555-8555-55555555550${i + 1}`;
        await client.query(
          `INSERT INTO public.businesses (id, workspace_id, legal_name, trade_name, slug, sovereign_owner_id, status)
           VALUES ($1, $2, $3, $3, $4, $5, 'active')`,
          [extraBiz, ids.workspace, `CI Biz ${i}`, `ci-biz-${i}`, ids.ownerUser],
        );
        await client.query(
          `INSERT INTO public.sites (id, business_id, subdomain, status) VALUES ($1, $2, $3, 'draft')`,
          [extraSite, extraBiz, `ci-sub-${i}`],
        );
        await client.query(
          `INSERT INTO public.site_versions (id, site_id, business_id, version_number, schema_version, configuration, created_by)
           VALUES ($1, $2, $3, 1, 'v1', '{"title":"Draft"}'::jsonb, $4)`,
          [extraVer, extraSite, extraBiz, ids.ownerUser],
        );
        await setAuthenticatedSession(client, ids.ownerUser);
        if (i <= 3) {
          await client.query(`SELECT public.publish_site_draft_atomic($1, $2, $3, $4, 1);`, [
            extraSite,
            extraBiz,
            ids.ownerUser,
            extraVer,
          ]);
          await client.query("RESET ROLE");
        } else {
          let blockedCode = "";
          try {
            await client.query(`SELECT public.publish_site_draft_atomic($1, $2, $3, $4, 1);`, [
              extraSite,
              extraBiz,
              ids.ownerUser,
              extraVer,
            ]);
          } catch (capErr) {
            blockedCode =
              capErr && typeof capErr === "object" && "code" in capErr ? String(capErr.code) : "";
          }
          recordResult(
            results,
            "Behavior: Zero capacity_overrides row enforces starter=3 limit (VY001)",
            blockedCode === "VY001",
            `4th business publish blockedCode=${blockedCode}`,
          );
        }
      }
      await client.query("ROLLBACK TO SAVEPOINT sp_capacity_no_override");
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT sp_capacity_no_override");
      recordResult(
        results,
        "Behavior: Zero capacity_overrides row enforces starter=3 limit (VY001)",
        false,
        err instanceof Error ? err.message : String(err),
      );
    }

    // 4. Seed two published versions and test rollback RPC (20261122000002)
    await client.query("SAVEPOINT sp_rollback");
    try {
      await client.query("RESET ROLE");
      await client.query(
        `
        INSERT INTO public.site_versions (
          id, site_id, business_id, version_number, schema_version, configuration, change_summary, created_by, published_at
        )
        VALUES (
          $1, $2, $3, 99, 'v1', '{"title":"CI Store V99"}'::jsonb, 'Seeded live v99', $4, now()
        );
        `,
        [ids.version2, ids.site, ids.business, ids.ownerUser],
      );
      await client.query(
        `UPDATE public.site_versions SET published_at = COALESCE(published_at, now() - interval '1 hour') WHERE id = $1;`,
        [ids.version1],
      );

      // Force published pointer only if not already set by publish step
      await client.query(
        `SELECT pg_catalog.set_config('vyapone.in_atomic_site_transition', 'true', true);`,
      );
      await client.query(
        `UPDATE public.sites SET published_version_id = $1, status = 'published' WHERE id = $2;`,
        [ids.version2, ids.site],
      );

      await setAuthenticatedSession(client, ids.ownerUser);
      const rbRes = await client.query(
        `SELECT public.rollback_published_site_version_atomic($1, $2, $3, $4, $5) AS payload;`,
        [ids.site, ids.business, ids.ownerUser, ids.version1, ids.version2],
      );
      await client.query("RESET ROLE");
      const siteCheck = await client.query(
        `SELECT published_version_id FROM public.sites WHERE id = $1;`,
        [ids.site],
      );
      const rolledBackOk =
        siteCheck.rows[0]?.published_version_id === ids.version1 && Boolean(rbRes.rows[0]?.payload);
      recordResult(
        results,
        "Behavior: Rollback switches published pointer & preserves history",
        rolledBackOk,
        `published_version_id=${siteCheck.rows[0]?.published_version_id}, v1_published_flag=${publishedV1}`,
      );
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT sp_rollback");
      recordResult(
        results,
        "Behavior: Rollback switches published pointer & preserves history",
        false,
        err instanceof Error ? err.message : String(err),
      );
    }

    // 5. QR active/inactive & sovereign owner RLS verification
    await client.query("SAVEPOINT sp_rls_qr_domains");
    try {
      await client.query("RESET ROLE");
      await client.query(
        `
        INSERT INTO public.qr_codes (site_id, business_id, type, public_slug, title, status, destination_configuration)
        VALUES
          ($1, $2, 'main_storefront', 'ci-active-qr', 'Active QR', 'active', '{"type":"storefront"}'::jsonb),
          ($1, $2, 'custom', 'ci-paused-qr', 'Paused QR', 'inactive', '{"type":"storefront"}'::jsonb);
        `,
        [ids.site, ids.business],
      );
      await client.query(
        `
        INSERT INTO public.site_domains (site_id, business_id, domain, status, verification_token, verification_target)
        VALUES ($1, $2, 'ci-test-store.example.invalid', 'pending_verification', 'tok_ci', 'cname.vyapone.invalid');
        `,
        [ids.site, ids.business],
      );

      await client.query("SET LOCAL ROLE anon");
      const anonQr = await client.query(
        `SELECT public_slug FROM public.qr_codes WHERE site_id = $1 ORDER BY public_slug;`,
        [ids.site],
      );
      const anonSlugs = anonQr.rows.map((r) => r.public_slug);

      await client.query("RESET ROLE");
      await setAuthenticatedSession(client, ids.ownerUser);
      const ownerDomains = await client.query(
        `SELECT domain FROM public.site_domains WHERE site_id = $1;`,
        [ids.site],
      );

      await client.query("RESET ROLE");
      await setAuthenticatedSession(client, ids.strangerUser);
      const strangerDomains = await client.query(
        `SELECT domain FROM public.site_domains WHERE site_id = $1;`,
        [ids.site],
      );

      const rlsOk =
        anonSlugs.length === 1 &&
        anonSlugs[0] === "ci-active-qr" &&
        ownerDomains.rows.length === 1 &&
        strangerDomains.rows.length === 0;
      recordResult(
        results,
        "Behavior: QR anon active filter & Sovereign Owner RLS isolation",
        rlsOk,
        `anonSlugs=${JSON.stringify(anonSlugs)}, ownerDomains=${ownerDomains.rows.length}, strangerDomains=${strangerDomains.rows.length}`,
      );
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT sp_rls_qr_domains");
      recordResult(
        results,
        "Behavior: QR anon active filter & Sovereign Owner RLS isolation",
        false,
        err instanceof Error ? err.message : String(err),
      );
    }

    // 6. Rollback capacity behavior: already-published succeeds at 3/3 limit, suspended->published rejects VY001
    await client.query("SAVEPOINT sp_rollback_capacity");
    try {
      await client.query("RESET ROLE");
      await client.query(
        `SELECT pg_catalog.set_config('vyapone.in_atomic_site_transition', 'true', true);`,
      );
      await client.query(
        `UPDATE public.site_versions SET published_at = COALESCE(published_at, now()) WHERE id = $1;`,
        [ids.version1],
      );
      await client.query(
        `UPDATE public.sites SET status = 'published', published_version_id = $1 WHERE id = $2;`,
        [ids.version1, ids.site],
      );
      await client.query(
        `INSERT INTO public.site_versions (id, site_id, business_id, version_number, schema_version, configuration, created_by, published_at)
         VALUES ('55555555-5555-4555-8555-555555555510', $1, $2, 100, 'v1', '{"title":"Live"}'::jsonb, $3, now())
         ON CONFLICT DO NOTHING;`,
        [ids.site, ids.business, ids.ownerUser],
      );
      for (let i = 5; i <= 7; i++) {
        const bId = `33333333-3333-4333-8333-33333333330${i}`;
        const sId = `44444444-4444-4444-8444-44444444440${i}`;
        const vId = `55555555-5555-4555-8555-55555555551${i}`;
        await client.query(
          `INSERT INTO public.businesses (id, workspace_id, legal_name, trade_name, slug, sovereign_owner_id, status)
           VALUES ($1, $2, $3, $3, $4, $5, 'active')`,
          [bId, ids.workspace, `RB Biz ${i}`, `rb-biz-${i}`, ids.ownerUser],
        );
        await client.query(
          `INSERT INTO public.sites (id, business_id, subdomain, status) VALUES ($1, $2, $3, $4)`,
          [sId, bId, `rb-sub-${i}`, i < 7 ? "published" : "suspended"],
        );
        await client.query(
          `INSERT INTO public.site_versions (id, site_id, business_id, version_number, schema_version, configuration, created_by, published_at)
           VALUES ($1, $2, $3, 1, 'v1', '{"title":"RB"}'::jsonb, $4, now())`,
          [vId, sId, bId, ids.ownerUser],
        );
      }

      // Now workspace has 3 published businesses (ids.site, b5, b6). Capacity-neutral rollback on ids.site must pass:
      await setAuthenticatedSession(client, ids.ownerUser);
      await client.query(
        `SELECT public.rollback_published_site_version_atomic($1, $2, $3, '55555555-5555-4555-8555-555555555510', $4);`,
        [ids.site, ids.business, ids.ownerUser, ids.version1],
      );

      // Rolling back when published_version_id is already set must reject NULL or stale expected version with VY049:
      let nullRollbackErrCode = "";
      try {
        await client.query(
          `SELECT public.rollback_published_site_version_atomic($1, $2, $3, $4, NULL);`,
          [ids.site, ids.business, ids.ownerUser, ids.version1],
        );
      } catch (rbNullErr) {
        nullRollbackErrCode =
          rbNullErr && typeof rbNullErr === "object" && "code" in rbNullErr
            ? String(rbNullErr.code)
            : "";
      }

      // Rolling back suspended 4th business site must raise VY001:
      let suspendedErrCode = "";
      try {
        await client.query(
          `SELECT public.rollback_published_site_version_atomic('44444444-4444-4444-8444-444444444407', '33333333-3333-4333-8333-333333333307', $1, '55555555-5555-4555-8555-555555555517', NULL);`,
          [ids.ownerUser],
        );
      } catch (rbCapErr) {
        suspendedErrCode =
          rbCapErr && typeof rbCapErr === "object" && "code" in rbCapErr
            ? String(rbCapErr.code)
            : "";
      }
      recordResult(
        results,
        "Behavior: Rollback allows capacity-neutral swap, enforces VY049 on NULL, & rejects VY001",
        suspendedErrCode === "VY001" && nullRollbackErrCode === "VY049",
        `suspendedRollbackCode=${suspendedErrCode}, nullRollbackErrCode=${nullRollbackErrCode}`,
      );
      await client.query("ROLLBACK TO SAVEPOINT sp_rollback_capacity");
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT sp_rollback_capacity");
      recordResult(
        results,
        "Behavior: Rollback allows capacity-neutral swap, enforces VY049 on NULL, & rejects VY001",
        false,
        err instanceof Error ? err.message : String(err),
      );
    }

    // 7. Forward remediation & CLOUD-009 checks: notifications trigger, invitation security/capacity, VY049 publish, manager/staff parity
    await client.query("SAVEPOINT sp_remediation_runtime");
    try {
      await client.query("RESET ROLE");
      const extraUsers = [
        ["11111111-1111-4111-8111-111111111103", "ci-third@example.invalid", "CI Third User"],
        ["11111111-1111-4111-8111-111111111104", "ci-manager@example.invalid", "CI Manager"],
        ["11111111-1111-4111-8111-111111111105", "ci-staff@example.invalid", "CI Staff"],
      ];
      for (const [uId, uEmail, uName] of extraUsers) {
        await client.query(
          `INSERT INTO auth.users (id, aud, role, email) VALUES ($1, 'authenticated', 'authenticated', $2) ON CONFLICT (id) DO NOTHING;`,
          [uId, uEmail],
        );
        await client.query(
          `INSERT INTO public.users (id, display_name, email, status) VALUES ($1, $2, $3, 'active') ON CONFLICT (id) DO NOTHING;`,
          [uId, uName, uEmail],
        );
      }
      await client.query(
        `INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
         VALUES ($1, $2, 'workspace_owner', 'active')
         ON CONFLICT (workspace_id, user_id) DO NOTHING;`,
        [ids.workspace, ids.ownerUser],
      );
      await client.query(
        `INSERT INTO public.business_members (business_id, user_id, role, status)
         VALUES ($1, '11111111-1111-4111-8111-111111111104', 'manager', 'active'),
                ($1, '11111111-1111-4111-8111-111111111105', 'staff', 'active')
         ON CONFLICT (business_id, user_id) DO NOTHING;`,
        [ids.business],
      );

      await client.query(
        `INSERT INTO public.notifications (id, recipient_user_id, type, title, message)
         VALUES ('66666666-6666-4666-8666-666666666601', $1, 'system_announcement', 'CI Note', 'Hello');`,
        [ids.ownerUser],
      );
      await client.query(
        `UPDATE public.notifications SET read = true WHERE id = '66666666-6666-4666-8666-666666666601';`,
      );

      // Seed invitations: valid 2nd seat, 3rd seat over starter limit=2, expired, business invite
      await client.query(
        `INSERT INTO public.workspace_invitations (workspace_id, email, role, token_hash, invited_by, expires_at)
         VALUES
           ($1, 'ci-stranger@example.invalid', 'reseller_staff', 'tok_ci_invite_hash', $2, now() + interval '1 day'),
           ($1, 'ci-third@example.invalid', 'reseller_staff', 'tok_ci_invite_full', $2, now() + interval '1 day'),
           ($1, 'ci-third@example.invalid', 'reseller_staff', 'tok_ci_invite_expired', $2, now() - interval '1 hour');`,
        [ids.workspace, ids.ownerUser],
      );
      await client.query(
        `INSERT INTO public.business_invitations (business_id, email, role, token_hash, invited_by, expires_at)
         VALUES ($1, 'ci-third@example.invalid', 'manager', 'tok_ci_biz_invite', $2, now() + interval '1 day');`,
        [ids.business, ids.ownerUser],
      );

      // 7a. Spoofed email/caller must fail VY013; valid 2nd seat must succeed
      let spoofErr = "";
      try {
        await setAuthenticatedSession(client, ids.strangerUser);
        await client.query(
          `SELECT public.accept_workspace_invitation_atomic('tok_ci_invite_full', $1, 'ci-third@example.invalid');`,
          [ids.strangerUser],
        );
      } catch (err) {
        spoofErr = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      }
      await client.query("RESET ROLE");
      await setAuthenticatedSession(client, ids.strangerUser);
      await client.query(
        `SELECT public.accept_workspace_invitation_atomic('tok_ci_invite_hash', $1, 'ci-stranger@example.invalid');`,
        [ids.strangerUser],
      );

      // 7b. Replay must fail VY011, expired VY012, and 3rd seat over starter=2 limit must fail VY001
      let replayErr = "";
      try {
        await client.query(
          `SELECT public.accept_workspace_invitation_atomic('tok_ci_invite_hash', $1, 'ci-stranger@example.invalid');`,
          [ids.strangerUser],
        );
      } catch (err) {
        replayErr = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      }

      let expiredErr = "";
      try {
        await client.query("RESET ROLE");
        await setAuthenticatedSession(client, "11111111-1111-4111-8111-111111111103");
        await client.query(
          `SELECT public.accept_workspace_invitation_atomic('tok_ci_invite_expired', '11111111-1111-4111-8111-111111111103', 'ci-third@example.invalid');`,
        );
      } catch (err) {
        expiredErr = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      }

      let seatLimitErr = "";
      try {
        await client.query("RESET ROLE");
        await setAuthenticatedSession(client, "11111111-1111-4111-8111-111111111103");
        await client.query(
          `SELECT public.accept_workspace_invitation_atomic('tok_ci_invite_full', '11111111-1111-4111-8111-111111111103', 'ci-third@example.invalid');`,
        );
      } catch (err) {
        seatLimitErr = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      }

      // 7c. accept_business_invitation_atomic valid & spoof rejection
      let bizSpoofErr = "";
      try {
        await client.query("RESET ROLE");
        await setAuthenticatedSession(client, ids.strangerUser);
        await client.query(
          `SELECT public.accept_business_invitation_atomic('tok_ci_biz_invite', '11111111-1111-4111-8111-111111111103', 'ci-third@example.invalid');`,
        );
      } catch (err) {
        bizSpoofErr = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      }
      await client.query("RESET ROLE");
      await setAuthenticatedSession(client, "11111111-1111-4111-8111-111111111103");
      await client.query(
        `SELECT public.accept_business_invitation_atomic('tok_ci_biz_invite', '11111111-1111-4111-8111-111111111103', 'ci-third@example.invalid');`,
      );

      // 7d. Staff denied publish (VY020) & domain INSERT (42501); Manager allowed publish, denied NULL VY049
      let staffPublishErr = "";
      try {
        await client.query("RESET ROLE");
        await setAuthenticatedSession(client, "11111111-1111-4111-8111-111111111105");
        await client.query(`SELECT public.publish_site_draft_atomic($1, $2, $3, $4, 1);`, [
          ids.site,
          ids.business,
          "11111111-1111-4111-8111-111111111105",
          ids.version1,
        ]);
      } catch (err) {
        staffPublishErr = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      }

      let staffDomainErr = "";
      try {
        await client.query("RESET ROLE");
        await setAuthenticatedSession(client, "11111111-1111-4111-8111-111111111105");
        await client.query(
          `INSERT INTO public.site_domains (site_id, business_id, domain, status, verification_token, verification_target)
           VALUES ($1, $2, 'ci-staff-denied.example.invalid', 'pending_verification', 't', 'c');`,
          [ids.site, ids.business],
        );
      } catch (err) {
        staffDomainErr = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      }

      let pubNullErr = "";
      try {
        await client.query("RESET ROLE");
        await setAuthenticatedSession(client, "11111111-1111-4111-8111-111111111104");
        await client.query(`SELECT public.publish_site_draft_atomic($1, $2, $3, $4, NULL);`, [
          ids.site,
          ids.business,
          "11111111-1111-4111-8111-111111111104",
          ids.version1,
        ]);
      } catch (err) {
        pubNullErr = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      }

      await client.query("RESET ROLE");
      await client.query(`UPDATE public.sites SET status = 'draft' WHERE id = $1;`, [ids.site]);
      await setAuthenticatedSession(client, ids.ownerUser);
      const transRes = await client.query(
        `SELECT * FROM public.transition_site_status_atomic($1, 'published');`,
        [ids.site],
      );
      const transOk =
        transRes.rows[0]?.success === true &&
        transRes.rows[0]?.status === "published" &&
        spoofErr === "VY013" &&
        replayErr === "VY011" &&
        expiredErr === "VY012" &&
        seatLimitErr === "VY001" &&
        bizSpoofErr === "VY013" &&
        staffPublishErr === "VY020" &&
        staffDomainErr === "42501" &&
        pubNullErr === "VY049";
      recordResult(
        results,
        "Behavior: Invitations (VY001/VY011-013), roles, NULL VY049, notif trigger, & transitions",
        transOk,
        JSON.stringify({
          trans: transRes.rows[0],
          spoofErr,
          replayErr,
          expiredErr,
          seatLimitErr,
          bizSpoofErr,
          staffPublishErr,
          staffDomainErr,
          pubNullErr,
        }),
      );
      await client.query("ROLLBACK TO SAVEPOINT sp_remediation_runtime");
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT sp_remediation_runtime");
      recordResult(
        results,
        "Behavior: Invitations (VY001/VY011-013), roles, NULL VY049, notif trigger, & transitions",
        false,
        err instanceof Error ? err.message : String(err),
      );
    }
  } finally {
    await client.query("ROLLBACK");
  }
}

async function main() {
  const dbUrl = assertLocalDatabaseUrl(process.env.DATABASE_URL || DEFAULT_LOCAL_DB_URL);
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  const results = [];
  try {
    await runSchemaAndPrivilegeChecks(client, results);
    await runBehavioralChecks(client, results);
  } finally {
    await client.end();
  }

  console.info("\n=== Isolated PostgreSQL Migration & Behavioral Verification ===");
  for (const r of results) {
    console.info(`[${r.Result}] ${r.Check} | ${r.Detail}`);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const summaryLines = [
      "## Isolated PostgreSQL Migration Verification",
      "",
      "| Check | Result | Detail |",
      "|---|---|---|",
      ...results.map((r) => `| ${r.Check} | ${r.Result} | \`${r.Detail}\` |`),
    ];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summaryLines.join("\n")}\n`, "utf8");
  }

  if (results.some((r) => r.Result === "FAIL")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Isolated PostgreSQL migration verification failed:", error);
  process.exitCode = 1;
});
