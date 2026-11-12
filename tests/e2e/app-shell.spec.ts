import { test, expect } from "@playwright/test";

test.describe("App Shell & Core Route Navigation [VO-019]", () => {
  test("renders root landing page with primary headings and portal links", async ({ page }) => {
    await page.goto("/");

    // Verify title and main heading
    await expect(page).toHaveTitle(/VyapOne/);
    const mainHeading = page.locator("h1");
    await expect(mainHeading).toContainText("VyapOne");

    // Verify essential portal links exist
    const ownerLink = page.getByRole("link", { name: /Open Business Owner Dashboard/ });
    await expect(ownerLink).toBeVisible();

    const counterLink = page.getByRole("link", { name: /Open Staff Counter POS/ });
    await expect(counterLink).toBeVisible();

    const resellerLink = page.getByRole("link", { name: /Open Reseller Workspace/ });
    await expect(resellerLink).toBeVisible();

    const adminLink = page.getByRole("link", { name: /Open Platform Admin/ });
    await expect(adminLink).toBeVisible();
  });

  test("navigates to login shell and renders authentication form structure", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("h1")).toContainText("Sign In");
    await expect(page.getByRole("button", { name: /Sign In/ })).toBeVisible();
  });

  test("renders privacy policy with clean readability", async ({ page }) => {
    await page.goto("/privacy");

    await expect(page.locator("h1")).toContainText("Privacy Policy");
  });
});
