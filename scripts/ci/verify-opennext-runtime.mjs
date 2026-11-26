import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const HOST = "127.0.0.1";
const PORT = 8787;
const BASE_URL = `http://${HOST}:${PORT}`;
const STARTUP_TIMEOUT_MS = 90_000;
const REQUEST_TIMEOUT_MS = 10_000;

const DUMMY_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9." +
  "CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const SANITIZED_RUNTIME_ENV = {
  NEXT_PUBLIC_APP_ENV: "preview",
  NEXT_PUBLIC_APP_URL: BASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: DUMMY_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: "dummy-ci-service-role-key-not-for-production",
  SESSION_SECRET: "ci-local-dummy-session-secret-minimum-32-chars",
};

/**
 * Route expectation matrix for the local Cloudflare Worker runtime smoke test.
 */
const ROUTE_CHECKS = [
  {
    route: "/",
    expectedStatuses: [200],
    expectedContentType: "text/html",
    verify: (res) =>
      res.body.includes("VyapOne") &&
      !res.body.includes("Application error: a server-side exception"),
    note: "Home portal landing page renders SSR/static HTML",
  },
  {
    route: "/login",
    expectedStatuses: [200],
    expectedContentType: "text/html",
    verify: (res) =>
      /vyapone|sign in|login/i.test(res.body) &&
      !res.body.includes("Application error: a server-side exception"),
    note: "Login page renders HTML form without Worker exception",
  },
  {
    route: "/dashboard",
    expectedStatuses: [302, 303, 307, 308],
    expectedContentType: "",
    verify: (res) => res.location.includes("/login") && res.location.includes("next=%2Fdashboard"),
    note: "Unauthenticated dashboard access redirects to /login with next=%2Fdashboard",
  },
  {
    route: "/robots.txt",
    expectedStatuses: [200],
    expectedContentType: "text/plain",
    verify: (res) =>
      /User-Agent:/i.test(res.body) &&
      res.body.includes("Disallow: /dashboard/") &&
      res.body.includes("Sitemap:"),
    note: "Robots metadata route returns text/plain rules and sitemap directive",
  },
  {
    route: "/sitemap.xml",
    expectedStatuses: [200],
    expectedContentType: "xml",
    verify: (res) => res.body.includes("<urlset") && res.body.includes("<loc>"),
    note: "Sitemap falls back cleanly to static URLs when DB is isolated",
  },
  {
    route: "/s/preview",
    expectedStatuses: [200, 404],
    expectedContentType: "text/html",
    verify: (res) =>
      res.body.trim().length > 0 &&
      !res.body.includes("Application error: a server-side exception"),
    note: "Isolated DB limitation: returns graceful storefront not-found HTML instead of HTTP 500",
  },
  {
    route: "/privacy",
    expectedStatuses: [200],
    expectedContentType: "text/html",
    verify: (res) =>
      /privacy/i.test(res.body) &&
      /dpdp|vyapone/i.test(res.body) &&
      !res.body.includes("Application error: a server-side exception"),
    note: "Privacy notice renders expected DPDP and VyapOne HTML content",
  },
  {
    route: "/auth/callback",
    expectedStatuses: [302, 303, 307, 308],
    expectedContentType: "",
    verify: (res) => res.location.includes("/login"),
    note: "Auth callback without code redirects safely to /login",
  },
  {
    route: "/counter",
    expectedStatuses: [302, 303, 307, 308],
    expectedContentType: "",
    verify: (res) => res.location.includes("/login") && res.location.includes("next=%2Fcounter"),
    note: "Unauthenticated counter access redirects to /login with next=%2Fcounter",
  },
  {
    route: "/workspace",
    expectedStatuses: [302, 303, 307, 308],
    expectedContentType: "",
    verify: (res) => res.location.includes("/login") && res.location.includes("next=%2Fworkspace"),
    note: "Unauthenticated workspace access redirects to /login with next=%2Fworkspace",
  },
  {
    route: "/qr/test-slug",
    expectedStatuses: [404, 503],
    expectedContentType: "",
    verify: (res) => res.status !== 500,
    note: "Isolated DB limitation: returns 404/503 without crashing Worker (no live Supabase DB)",
  },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
    });
    const body = await response.text();
    return {
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      location: response.headers.get("location") ?? "",
      body,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForWorkerReady(logState) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (logState.exited) {
      throw new Error(`opennextjs-cloudflare preview exited early with code ${logState.exitCode}`);
    }
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/robots.txt`);
      if (res.status > 0) {
        return;
      }
    } catch {
      // Server still booting
    }
    await delay(1000);
  }
  throw new Error(`Timed out after ${STARTUP_TIMEOUT_MS}ms waiting for ${BASE_URL}`);
}

function terminateChildProcess(child) {
  if (!child || child.exitCode !== null) {
    return;
  }
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], { stdio: "ignore" });
    } else if (child.pid) {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
      // Ignore already exited child process
    }
  }
}

async function main() {
  const workerFile = path.resolve(process.cwd(), ".open-next", "worker.js");
  if (!fs.existsSync(workerFile)) {
    throw new Error(
      `Missing build output at ${workerFile}. Run opennextjs-cloudflare build first.`,
    );
  }

  const devVarsPath = path.resolve(process.cwd(), ".dev.vars");
  let createdDevVars = false;
  if (!fs.existsSync(devVarsPath)) {
    const devVarsContent = Object.entries(SANITIZED_RUNTIME_ENV)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    fs.writeFileSync(devVarsPath, `${devVarsContent}\n`, "utf8");
    createdDevVars = true;
  }

  const logPath = path.join(process.env.RUNNER_TEMP || os.tmpdir(), "opennext-preview.log");
  const logStream = fs.createWriteStream(logPath, { flags: "w" });

  const child = spawn(
    "pnpm",
    ["exec", "opennextjs-cloudflare", "preview", "--port", String(PORT), "--ip", HOST],
    {
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...SANITIZED_RUNTIME_ENV,
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  );

  const logState = {
    exited: false,
    exitCode: null,
    chunks: [],
  };

  child.stdout?.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    logState.chunks.push(text);
    logStream.write(text);
  });

  child.stderr?.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    logState.chunks.push(text);
    logStream.write(text);
  });

  child.on("exit", (code) => {
    logState.exited = true;
    logState.exitCode = code;
  });

  const results = [];
  let fatalLogErrors = [];

  try {
    await waitForWorkerReady(logState);
    await delay(500);

    for (const check of ROUTE_CHECKS) {
      const targetUrl = `${BASE_URL}${check.route}`;
      try {
        const res = await fetchWithTimeout(targetUrl);
        const statusOk = check.expectedStatuses.includes(res.status);
        const contentTypeOk =
          check.expectedContentType === "" ||
          res.contentType.toLowerCase().includes(check.expectedContentType);
        const behaviorOk = check.verify(res);
        const passed = statusOk && contentTypeOk && behaviorOk;

        results.push({
          route: check.route,
          status: res.status,
          location: res.location || "-",
          contentType: res.contentType || "-",
          passed,
          note: passed
            ? check.note
            : `FAILED check (expected status ${check.expectedStatuses.join("/")}, type "${check.expectedContentType || "any"}")`,
        });
      } catch (err) {
        results.push({
          route: check.route,
          status: "ERR",
          location: "-",
          contentType: "-",
          passed: false,
          note: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const fullLogs = logState.chunks.join("");
    const lines = fullLogs.split(/\r?\n/);
    fatalLogErrors = lines.filter((line) =>
      /(UnhandledPromiseRejection|ReferenceError:|SyntaxError:|TypeError: Cannot|FATAL ERROR|workerd.*crashed)/i.test(
        line,
      ),
    );
  } finally {
    terminateChildProcess(child);
    logStream.end();
    if (createdDevVars && fs.existsSync(devVarsPath)) {
      fs.unlinkSync(devVarsPath);
    }
  }

  console.info("\n=== Local Cloudflare Worker Runtime Route Verification ===");
  for (const r of results) {
    console.info(
      `[${r.passed ? "PASS" : "FAIL"}] ${r.route} -> status=${r.status}, location=${r.location}, contentType=${r.contentType} | ${r.note}`,
    );
  }

  if (fatalLogErrors.length > 0) {
    console.error("\nDetected fatal Worker runtime log lines:");
    for (const line of fatalLogErrors) {
      console.error(`  ${line}`);
    }
  } else {
    console.info(`\nNo fatal Worker runtime crashes detected in ${logPath}.`);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const summaryLines = [
      "## Local Cloudflare Worker Runtime Route Matrix",
      "",
      "| Route | Status | Redirect Location | Content-Type | Result | Notes |",
      "|---|---|---|---|---|---|",
      ...results.map(
        (r) =>
          `| \`${r.route}\` | \`${r.status}\` | \`${r.location}\` | \`${r.contentType}\` | ${r.passed ? "PASS" : "FAIL"} | ${r.note} |`,
      ),
      "",
      `Fatal Worker runtime log errors: ${fatalLogErrors.length}`,
    ];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summaryLines.join("\n")}\n`, "utf8");
  }

  const anyFailed = results.some((r) => !r.passed) || fatalLogErrors.length > 0;
  if (anyFailed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("OpenNext runtime verification failed:", error);
  process.exitCode = 1;
});
