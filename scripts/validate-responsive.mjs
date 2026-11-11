import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobileSmall", width: 320, height: 568 },
  { name: "mobileStandard", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1024, height: 768 },
  { name: "desktopLarge", width: 1440, height: 900 },
];

const ROUTES = [
  { path: "/login", name: "login" },
  { path: "/s/demo-store", name: "storefront" },
  { path: "/workspace", name: "workspace" },
  { path: "/dashboard", name: "dashboard" },
  { path: "/dashboard/billing", name: "billing" },
  { path: "/counter/pos", name: "counter_pos" },
  { path: "/platform-admin", name: "platform_admin" },
];

const SCREENSHOT_DIR = path.resolve(process.cwd(), "docs/evidence/screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const PORT = 3005;

async function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200 || res.status === 404) {
        return true;
      }
    } catch {
      // server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeout}ms`);
}

async function main() {
  console.info(`Starting Next.js production server on port ${PORT}...`);
  const server = spawn(`pnpm exec next start -p ${PORT}`, {
    stdio: "inherit",
    shell: true,
  });

  const cleanup = () => {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", server.pid.toString(), "/f", "/t"]);
      } else {
        server.kill("SIGTERM");
      }
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  };

  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  try {
    await waitForServer(`http://localhost:${PORT}`);
    console.info(`Next.js server is ready at http://localhost:${PORT}`);

    console.info("Launching Chromium (channel: chrome)...");
    const browser = await chromium.launch({
      channel: "chrome",
      headless: true,
    });

    const results = [];
    let totalChecks = 0;
    let passedChecks = 0;

    for (const vp of VIEWPORTS) {
      console.info(`\n=== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();

      for (const route of ROUTES) {
        totalChecks++;
        const targetUrl = `http://localhost:${PORT}${route.path}`;
        await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(300); // Allow styles to settle

        const metrics = await page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          const docScrollWidth = doc.scrollWidth;
          const bodyScrollWidth = body.scrollWidth;
          const winInnerWidth = window.innerWidth;

          // Check bottom bar and desktop nav
          const bottomBar = document.querySelector(".ui-nav-bottom-bar");
          const desktopNav = document.querySelector(".owner-desktop-nav");

          const isVisible = (el) => {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            return style.display !== "none" && style.visibility !== "hidden" && el.offsetHeight > 0;
          };

          return {
            docScrollWidth,
            bodyScrollWidth,
            winInnerWidth,
            hasDocOverflow: docScrollWidth > winInnerWidth,
            hasBodyOverflow: bodyScrollWidth > winInnerWidth,
            bottomBarVisible: isVisible(bottomBar),
            desktopNavVisible: isVisible(desktopNav),
          };
        });

        const hasOverflow = metrics.hasDocOverflow || metrics.hasBodyOverflow;
        const status = !hasOverflow ? "PASS" : "FAIL";
        if (!hasOverflow) {
          passedChecks++;
        }

        console.info(
          `  [${status}] ${route.path} -> doc: ${metrics.docScrollWidth}px, body: ${metrics.bodyScrollWidth}px, viewport: ${metrics.winInnerWidth}px`,
        );

        if (hasOverflow) {
          console.error(
            `    OVERFLOW DETECTED: docScrollWidth=${metrics.docScrollWidth}, bodyScrollWidth=${metrics.bodyScrollWidth}, winWidth=${metrics.winInnerWidth}`,
          );
        }

        // Validate responsive nav rules on dashboard
        if (route.name === "dashboard") {
          if (vp.width <= 768) {
            if (!metrics.bottomBarVisible) {
              console.warn(`    WARNING: Bottom bar expected visible on mobile (${vp.width}px)`);
            }
            if (metrics.desktopNavVisible) {
              console.warn(`    WARNING: Desktop nav expected hidden on mobile (${vp.width}px)`);
            }
          } else {
            if (metrics.bottomBarVisible) {
              console.warn(`    WARNING: Bottom bar expected hidden on desktop (${vp.width}px)`);
            }
            if (!metrics.desktopNavVisible) {
              console.warn(`    WARNING: Desktop nav expected visible on desktop (${vp.width}px)`);
            }
          }
        }

        // Capture screenshot
        const screenshotFileName = `${route.name}_${vp.width}x${vp.height}.png`;
        const screenshotPath = path.join(SCREENSHOT_DIR, screenshotFileName);
        await page.screenshot({ path: screenshotPath, fullPage: false });

        results.push({
          viewport: vp.name,
          dimensions: `${vp.width}x${vp.height}`,
          route: route.path,
          name: route.name,
          docScrollWidth: metrics.docScrollWidth,
          bodyScrollWidth: metrics.bodyScrollWidth,
          viewportWidth: metrics.winInnerWidth,
          zeroOverflow: !hasOverflow,
          bottomBarVisible: metrics.bottomBarVisible,
          desktopNavVisible: metrics.desktopNavVisible,
          screenshot: screenshotFileName,
        });
      }

      await context.close();
    }

    await browser.close();

    console.info(`\n==============================================`);
    console.info(`Responsive Viewport Validation Complete!`);
    console.info(
      `Checks: ${passedChecks}/${totalChecks} passed (${Math.round((passedChecks / totalChecks) * 100)}%)`,
    );
    console.info(`Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.info(`==============================================\n`);

    // Write validation results JSON
    const reportPath = path.resolve(
      process.cwd(),
      "docs/evidence/responsive_viewport_results.json",
    );
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ summary: { total: totalChecks, passed: passedChecks }, results }, null, 2),
    );
    console.info(`Validation results written to ${reportPath}`);

    if (passedChecks !== totalChecks) {
      process.exit(1);
    }
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
