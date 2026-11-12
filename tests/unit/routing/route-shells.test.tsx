import React from "react";
import { describe, expect, it, vi } from "vitest";

// Mock next/navigation for client components rendered during route shell validation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  redirect: vi.fn(),
}));

// Mock auth server actions to isolate UI tests from server-only backend code
vi.mock("@/lib/auth/actions", () => ({
  signUpAction: vi.fn(),
  signInWithPasswordAction: vi.fn(),
  requestPhoneOtpAction: vi.fn(),
  verifyPhoneOtpAction: vi.fn(),
  requestPasswordResetAction: vi.fn(),
  updatePasswordAction: vi.fn(),
  signOutAction: vi.fn(),
}));

import { render, screen, within } from "@testing-library/react";
import HomePage from "@/app/page";
import AuthLayout from "@/app/(auth)/layout";
import LoginPage from "@/app/(auth)/login/page";
import RegisterPage from "@/app/(auth)/register/page";
import PublicStorefrontLayout from "@/app/(public)/layout";
import SubdomainStorefrontPage from "@/app/(public)/s/[subdomain]/page";
import PrivacyPolicyPage from "@/app/(public)/privacy/page";
import ResellerWorkspaceLayout from "@/app/(reseller)/workspace/layout";
import ResellerOverviewPage from "@/app/(reseller)/workspace/page";
import ResellerClientsPage from "@/app/(reseller)/workspace/clients/page";
import ResellerBillingPage from "@/app/(reseller)/workspace/billing/page";
import ResellerTeamPage from "@/app/(reseller)/workspace/team/page";
import ResellerSettingsPage from "@/app/(reseller)/workspace/settings/page";
import BusinessOwnerLayout from "@/app/(owner)/dashboard/layout";
import BusinessOwnerOverviewPage from "@/app/(owner)/dashboard/page";
import OwnerCataloguePage from "@/app/(owner)/dashboard/catalogue/page";
import OwnerOrdersPage from "@/app/(owner)/dashboard/orders/page";
import OwnerBillingPage from "@/app/(owner)/dashboard/billing/page";
import OwnerCustomersPage from "@/app/(owner)/dashboard/customers/page";
import OwnerWhatsAppComponent from "@/app/(owner)/dashboard/whatsapp/page";
import OwnerWebsitePage from "@/app/(owner)/dashboard/website/page";
import OwnerAnalyticsPage from "@/app/(owner)/dashboard/analytics/page";
import OwnerSettingsPage from "@/app/(owner)/dashboard/settings/page";
import StaffCounterLayout from "@/app/(staff)/counter/layout";
import StaffCounterHomePage from "@/app/(staff)/counter/page";
import StaffCounterPOSPage from "@/app/(staff)/counter/pos/page";
import StaffCounterUnlockPage from "@/app/(staff)/counter/unlock/page";
import PlatformAdminLayout from "@/app/(admin)/platform-admin/layout";
import PlatformAdminOverviewPage from "@/app/(admin)/platform-admin/page";
import AdminTenantsPage from "@/app/(admin)/platform-admin/tenants/page";
import AdminPlansPage from "@/app/(admin)/platform-admin/plans/page";
import AdminTaxesPage from "@/app/(admin)/platform-admin/taxes/page";
import AdminAuditLogsPage from "@/app/(admin)/platform-admin/audit-logs/page";
import AdminAbusePage from "@/app/(admin)/platform-admin/abuse/page";

describe("VO-014 Application Route Shells & Role-Aware Navigation", () => {
  // ==========================================================================
  // ROOT PAGE & PORTAL NAVIGATOR
  // ==========================================================================
  describe("Root Landing Page (/)", () => {
    it("renders root landing page with links to all core application shells", () => {
      render(<HomePage />);
      expect(screen.getByRole("heading", { name: "VyapOne", level: 1 })).toBeTruthy();
      expect(screen.getByRole("main").getAttribute("id")).toBe("main-content");
      expect(
        screen.getByRole("link", { name: /Open Business Owner Dashboard/ }).getAttribute("href"),
      ).toBe("/dashboard");
      expect(
        screen.getByRole("link", { name: /Open Staff Counter Terminal/ }).getAttribute("href"),
      ).toBe("/counter");
      expect(
        screen.getByRole("link", { name: /Open Reseller Agency Workspace/ }).getAttribute("href"),
      ).toBe("/workspace");
      expect(
        screen.getByRole("link", { name: /Open Platform Administration/ }).getAttribute("href"),
      ).toBe("/platform-admin");
      expect(
        screen
          .getByRole("link", { name: /Open Public Storefront Touchpoint/ })
          .getAttribute("href"),
      ).toBe("/s/demo-store");
    });
  });

  // ==========================================================================
  // AUTH ROUTE GROUP: (auth)
  // ==========================================================================
  describe("Auth Route Group (auth)", () => {
    it("renders auth layout with accessible main landmark and brand mark", () => {
      render(
        <AuthLayout>
          <div>Auth Child Component</div>
        </AuthLayout>,
      );
      expect(screen.getByRole("link", { name: "VyapOne" }).getAttribute("href")).toBe("/");
      expect(screen.getByRole("main").getAttribute("id")).toBe("main-content");
      expect(screen.getByText("Auth Child Component")).toBeTruthy();
    });

    it("renders login page with mobile input and OTP trigger", () => {
      render(<LoginPage />);
      expect(screen.getByRole("heading", { name: "Sign In", level: 1 })).toBeTruthy();
      expect(screen.getByLabelText(/Mobile Number/)).toBeTruthy();
      expect(screen.getByRole("button", { name: /Send OTP/ })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Create Account" }).getAttribute("href")).toBe(
        "/register",
      );
    });

    it("renders register page with account type selector", () => {
      render(<RegisterPage />);
      expect(screen.getByRole("heading", { name: "Get Started", level: 1 })).toBeTruthy();
      expect(screen.getByLabelText(/Account Type/)).toBeTruthy();
      expect(screen.getByLabelText(/Business or Agency Name/)).toBeTruthy();
      expect(screen.getByRole("link", { name: "Sign In" }).getAttribute("href")).toBe("/login");
    });
  });

  // ==========================================================================
  // PUBLIC STOREFRONT ROUTE GROUP: (public)
  // ==========================================================================
  describe("Public Storefront Route Group (public)", () => {
    it("renders storefront layout with public navigation landmark and footer", () => {
      render(
        <PublicStorefrontLayout>
          <div>Storefront Child</div>
        </PublicStorefrontLayout>,
      );
      const nav = screen.getByRole("navigation", { name: "Storefront Navigation" });
      expect(nav).toBeTruthy();
      expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/s/demo-store");
      expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy");
      expect(screen.getByRole("link", { name: "Merchant Sign In" }).getAttribute("href")).toBe(
        "/login",
      );

      // Verify ZERO back-office navigation items exist in public storefront
      expect(screen.queryByText("Daily Pulse")).toBeNull();
      expect(screen.queryByText("Wholesale Billing")).toBeNull();
      expect(screen.queryByText("Fast POS Punch")).toBeNull();
      expect(screen.queryByText("Platform Governance")).toBeNull();
    });

    it("renders dynamic storefront page placeholder with subdomain header", async () => {
      const page = await SubdomainStorefrontPage({
        params: Promise.resolve({ subdomain: "chai-junction" }),
      });
      render(page);
      expect(screen.getByRole("heading", { name: "Chai Junction Store", level: 1 })).toBeTruthy();
      expect(screen.getByText(/chai-junction.vyapone.in/)).toBeTruthy();
      expect(screen.getByRole("button", { name: /Browse Catalogue/ })).toBeTruthy();
    });

    it("renders DPDP privacy policy page with grievance redressal desk", () => {
      render(<PrivacyPolicyPage />);
      expect(
        screen.getByRole("heading", {
          name: "Privacy Policy & Grievance Redressal",
          level: 1,
        }),
      ).toBeTruthy();
      expect(screen.getByText(/grievance-desk-pending-registration@vyapone.in/)).toBeTruthy();
    });
  });

  // ==========================================================================
  // RESELLER WORKSPACE ROUTE GROUP: (reseller)
  // ==========================================================================
  describe("Reseller Workspace Route Group (reseller)", () => {
    it("renders reseller layout with agency navigation landmark", () => {
      render(
        <ResellerWorkspaceLayout>
          <div>Agency Workspace Child</div>
        </ResellerWorkspaceLayout>,
      );
      const nav = screen.getByRole("navigation", { name: "Reseller Workspace Navigation" });
      expect(nav).toBeTruthy();
      expect(screen.getByRole("link", { name: "Overview" }).getAttribute("href")).toBe(
        "/workspace",
      );
      expect(screen.getByRole("link", { name: "Client Businesses" }).getAttribute("href")).toBe(
        "/workspace/clients",
      );
      expect(screen.getByRole("link", { name: "Wholesale Billing" }).getAttribute("href")).toBe(
        "/workspace/billing",
      );
      expect(screen.getByRole("link", { name: "Agency Team" }).getAttribute("href")).toBe(
        "/workspace/team",
      );
      expect(screen.getByRole("link", { name: "Branding Settings" }).getAttribute("href")).toBe(
        "/workspace/settings",
      );

      // Verify ZERO merchant internal operations or platform super-admin controls
      expect(screen.queryByText("Fast POS Punch")).toBeNull();
      expect(screen.queryByText("Statutory GST Rate Master Tables")).toBeNull();
    });

    it("renders reseller overview page with active clients and wholesale metrics", () => {
      render(<ResellerOverviewPage />);
      expect(
        screen.getByRole("heading", { name: "Agency Workspace Overview", level: 1 }),
      ).toBeTruthy();
      expect(screen.getByText("-- Active Stores")).toBeTruthy();
    });

    it("renders reseller client businesses directory", () => {
      render(<ResellerClientsPage />);
      expect(screen.getByRole("heading", { name: "Client Businesses", level: 1 })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Add New Client/ })).toBeTruthy();
    });

    it("renders reseller wholesale billing page with settlement statements", () => {
      render(<ResellerBillingPage />);
      expect(
        screen.getByRole("heading", { name: "Wholesale Billing & Payouts", level: 1 }),
      ).toBeTruthy();
      expect(screen.getByText("Settlement Statements")).toBeTruthy();
    });

    it("renders reseller team members page", () => {
      render(<ResellerTeamPage />);
      expect(screen.getByRole("heading", { name: "Agency Team Members", level: 1 })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Invite Team Member/ })).toBeTruthy();
    });

    it("renders reseller white-label branding settings", () => {
      render(<ResellerSettingsPage />);
      expect(
        screen.getByRole("heading", { name: "White-Label & Agency Settings", level: 1 }),
      ).toBeTruthy();
      expect(screen.getByLabelText("Agency Display Name")).toBeTruthy();
    });
  });

  // ==========================================================================
  // BUSINESS OWNER WORKSPACE ROUTE GROUP: (owner)
  // ==========================================================================
  describe("Business Owner Route Group (owner)", () => {
    it("renders owner layout with both desktop navigation and mobile bottom bar", () => {
      render(
        <BusinessOwnerLayout>
          <div>Owner Child</div>
        </BusinessOwnerLayout>,
      );
      const desktopNav = screen.getByRole("navigation", { name: "Business Owner Navigation" });
      const mobileNav = screen.getByRole("navigation", { name: "Mobile Bottom Navigation" });
      expect(desktopNav).toBeTruthy();
      expect(mobileNav).toBeTruthy();

      expect(
        within(desktopNav).getByRole("link", { name: "Daily Pulse" }).getAttribute("href"),
      ).toBe("/dashboard");
      expect(within(desktopNav).getByRole("link", { name: "Products" }).getAttribute("href")).toBe(
        "/dashboard/catalogue",
      );
      expect(within(desktopNav).getByRole("link", { name: "Orders" }).getAttribute("href")).toBe(
        "/dashboard/orders",
      );
      expect(
        within(desktopNav).getByRole("link", { name: "GST Billing" }).getAttribute("href"),
      ).toBe("/dashboard/billing");
      expect(within(desktopNav).getByRole("link", { name: "Customers" }).getAttribute("href")).toBe(
        "/dashboard/customers",
      );
      expect(within(desktopNav).getByRole("link", { name: "WhatsApp" }).getAttribute("href")).toBe(
        "/dashboard/whatsapp",
      );
      expect(within(desktopNav).getByRole("link", { name: "Website" }).getAttribute("href")).toBe(
        "/dashboard/website",
      );
      expect(within(desktopNav).getByRole("link", { name: "Analytics" }).getAttribute("href")).toBe(
        "/dashboard/analytics",
      );
      expect(within(desktopNav).getByRole("link", { name: "Settings" }).getAttribute("href")).toBe(
        "/dashboard/settings",
      );

      // Verify mobile bottom bar has mobile items including touch navigation
      expect(within(mobileNav).getByRole("link", { name: "Pulse" }).getAttribute("href")).toBe(
        "/dashboard",
      );
      expect(within(mobileNav).getByRole("link", { name: "Orders" }).getAttribute("href")).toBe(
        "/dashboard/orders",
      );

      // Verify ZERO reseller wholesale margins or super-admin controls
      expect(screen.queryByText("Wholesale Billing & Payouts")).toBeNull();
      expect(screen.queryByText("Global System Governance")).toBeNull();
    });

    it("renders business owner daily pulse with Vya morning briefing", () => {
      render(<BusinessOwnerOverviewPage />);
      expect(screen.getByRole("heading", { name: "Daily Business Pulse", level: 1 })).toBeTruthy();
      expect(screen.getByText(/Vya Morning Briefing/)).toBeTruthy();
      expect(screen.getByText("--")).toBeTruthy();
    });

    it("renders owner catalogue page placeholder", () => {
      render(<OwnerCataloguePage />);
      expect(screen.getByRole("heading", { name: "Products & Services", level: 1 })).toBeTruthy();
    });

    it("renders owner orders page placeholder", () => {
      render(<OwnerOrdersPage />);
      expect(screen.getByRole("heading", { name: "Orders & Fulfillment", level: 1 })).toBeTruthy();
    });

    it("renders owner billing page with sequential GST invoice status", () => {
      render(<OwnerBillingPage />);
      expect(screen.getByRole("heading", { name: "GST Invoices & Bills", level: 1 })).toBeTruthy();
      expect(screen.getByText("Billing Shell")).toBeTruthy();
    });

    it("renders owner customers page placeholder", () => {
      render(<OwnerCustomersPage />);
      expect(screen.getByRole("heading", { name: "Customers & Khata", level: 1 })).toBeTruthy();
    });

    it("renders owner WhatsApp page with quiet hours indicator", () => {
      render(<OwnerWhatsAppComponent />);
      expect(
        screen.getByRole("heading", { name: "WhatsApp Customer Desk", level: 1 }),
      ).toBeTruthy();
      expect(screen.getByText("Quiet Hours: 9 PM - 9 AM")).toBeTruthy();
    });

    it("renders owner website builder page placeholder", () => {
      render(<OwnerWebsitePage />);
      expect(
        screen.getByRole("heading", { name: "Storefront Website Builder", level: 1 }),
      ).toBeTruthy();
    });

    it("renders owner analytics page placeholder", () => {
      render(<OwnerAnalyticsPage />);
      expect(
        screen.getByRole("heading", { name: "Store Insights & Analytics", level: 1 }),
      ).toBeTruthy();
    });

    it("renders owner business settings page with GSTIN and UPI VPAs", () => {
      render(<OwnerSettingsPage />);
      expect(
        screen.getByRole("heading", { name: "Business & Statutory Settings", level: 1 }),
      ).toBeTruthy();
      expect(screen.getByLabelText(/Trade Name/)).toBeTruthy();
      expect(screen.getByLabelText(/GSTIN/)).toBeTruthy();
      expect(screen.getByLabelText(/UPI VPA/)).toBeTruthy();
    });
  });

  // ==========================================================================
  // STAFF COUNTER MODE ROUTE GROUP: (staff)
  // ==========================================================================
  describe("Staff Counter Mode Route Group (staff)", () => {
    it("renders staff counter layout with role-aware POS navigation", () => {
      render(
        <StaffCounterLayout>
          <div>Counter Child</div>
        </StaffCounterLayout>,
      );
      const nav = screen.getByRole("navigation", { name: "Staff Counter Navigation" });
      expect(nav).toBeTruthy();
      expect(screen.getByRole("link", { name: "Station Home" }).getAttribute("href")).toBe(
        "/counter",
      );
      expect(screen.getByRole("link", { name: "Fast POS Punch" }).getAttribute("href")).toBe(
        "/counter/pos",
      );
      expect(screen.getByRole("link", { name: "Lock / Switch PIN" }).getAttribute("href")).toBe(
        "/counter/unlock",
      );

      // Verify ZERO business settings, bank VPAs, P&L analytics, or WhatsApp broadcasts
      expect(screen.queryByText("Business & Statutory Settings")).toBeNull();
      expect(screen.queryByText("WhatsApp Customer Desk")).toBeNull();
      expect(screen.queryByText("Wholesale Billing & Payouts")).toBeNull();
      expect(screen.queryByText("Platform Governance")).toBeNull();
    });

    it("renders staff counter station overview", () => {
      render(<StaffCounterHomePage />);
      expect(screen.getByRole("heading", { name: "Counter POS Station", level: 1 })).toBeTruthy();
      expect(screen.getByText("Counter Station Shell")).toBeTruthy();
    });

    it("renders staff fast POS screen placeholder", () => {
      render(<StaffCounterPOSPage />);
      expect(screen.getByRole("heading", { name: "Fast Billing Terminal", level: 1 })).toBeTruthy();
    });

    it("renders station PIN unlock screen", () => {
      render(<StaffCounterUnlockPage />);
      expect(
        screen.getByRole("heading", { name: "Unlock Counter Terminal", level: 1 }),
      ).toBeTruthy();
      expect(screen.getByLabelText(/4-Digit Staff PIN/)).toBeTruthy();
    });
  });

  // ==========================================================================
  // PLATFORM ADMINISTRATION ROUTE GROUP: (admin)
  // ==========================================================================
  describe("Platform Administration Route Group (admin)", () => {
    it("renders platform admin layout with governance navigation", () => {
      render(
        <PlatformAdminLayout>
          <div>Admin Child</div>
        </PlatformAdminLayout>,
      );
      const nav = screen.getByRole("navigation", { name: "Platform Administration Navigation" });
      expect(nav).toBeTruthy();
      expect(screen.getByRole("link", { name: "System Health" }).getAttribute("href")).toBe(
        "/platform-admin",
      );
      expect(screen.getByRole("link", { name: "Tenants" }).getAttribute("href")).toBe(
        "/platform-admin/tenants",
      );
      expect(screen.getByRole("link", { name: "Master Plans" }).getAttribute("href")).toBe(
        "/platform-admin/plans",
      );
      expect(screen.getByRole("link", { name: "GST Master" }).getAttribute("href")).toBe(
        "/platform-admin/taxes",
      );
      expect(screen.getByRole("link", { name: "Audit Trail" }).getAttribute("href")).toBe(
        "/platform-admin/audit-logs",
      );
      expect(screen.getByRole("link", { name: "Abuse Defense" }).getAttribute("href")).toBe(
        "/platform-admin/abuse",
      );
    });

    it("renders platform overview page with tenant count and gap-free sequence status", () => {
      render(<PlatformAdminOverviewPage />);
      expect(
        screen.getByRole("heading", { name: "Global System Governance", level: 1 }),
      ).toBeTruthy();
      expect(screen.getByText("-- Tenants")).toBeTruthy();
      expect(screen.getByText("-- Sequence Audit")).toBeTruthy();
    });

    it("renders platform tenant inspector placeholder", () => {
      render(<AdminTenantsPage />);
      expect(
        screen.getByRole("heading", { name: "Global Tenant Inspector", level: 1 }),
      ).toBeTruthy();
    });

    it("renders platform master plans page placeholder", () => {
      render(<AdminPlansPage />);
      expect(
        screen.getByRole("heading", { name: "Master Plan Tiers & Quotas", level: 1 }),
      ).toBeTruthy();
    });

    it("renders canonical statutory GST rate master tables", () => {
      render(<AdminTaxesPage />);
      expect(
        screen.getByRole("heading", { name: "Statutory GST Rate Master Tables", level: 1 }),
      ).toBeTruthy();
      expect(screen.getByRole("region", { name: "Statutory GST Tax Slabs" })).toBeTruthy();
      expect(screen.getByText("Fresh grains, unprocessed vegetables, milk")).toBeTruthy();
    });

    it("renders tamper-evident global audit logs page", () => {
      render(<AdminAuditLogsPage />);
      expect(
        screen.getByRole("heading", { name: "Tamper-Evident Global Audit Trail", level: 1 }),
      ).toBeTruthy();
    });

    it("renders abuse defense & quiet-hour compliance monitor", () => {
      render(<AdminAbusePage />);
      expect(
        screen.getByRole("heading", { name: "Abuse Defense & Compliance Monitor", level: 1 }),
      ).toBeTruthy();
      expect(screen.getByText("TRAI / Meta Rules Active")).toBeTruthy();
    });
  });
});
