import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import CounterPosPage from "@/app/(staff)/counter/pos/page";
import DashboardLayout from "@/app/(owner)/dashboard/layout";
import DashboardPage from "@/app/(owner)/dashboard/page";
import PlatformAdminLayout from "@/app/(admin)/platform-admin/layout";
import {
  ConfigurationError,
  publicEnvSchema,
  serverCoreEnvSchema,
  validateEnvironment,
} from "@/config/env";
import { getPublicConfig } from "@/config/public";

describe("Integration: Core App Shell & Server Configuration Validation [VO-019]", () => {
  describe("Server & Public Environment Validation Integration", () => {
    it("validates server configuration and extracts client-safe public configuration without secrets", () => {
      const validEnv = {
        NODE_ENV: "development",
        PORT: "3000",
        NEXT_PUBLIC_APP_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_SUPABASE_URL: "https://mockproject.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyMockAnonKeyForIntegrationTesting019",
      };

      const validatedConfig = validateEnvironment(validEnv);
      expect(validatedConfig.server.nodeEnv).toBe("development");
      expect(validatedConfig.server.port).toBe(3000);
      expect(validatedConfig.server.isDevelopment).toBe(true);

      const publicConfig = getPublicConfig(validEnv);
      expect(publicConfig.appEnv).toBe("development");
      expect(publicConfig.appUrl).toBe("http://localhost:3000");
      expect(publicConfig.supabaseUrl).toBe("https://mockproject.supabase.co");
      expect(publicConfig.supabaseAnonKey).toBe("eyMockAnonKeyForIntegrationTesting019");

      // Verify that privileged database URL and server keys are NOT part of publicConfig
      expect("databaseUrl" in publicConfig).toBe(false);
      expect("serviceRoleKey" in publicConfig).toBe(false);
    });

    it("rejects invalid server environment before shell rendering can occur", () => {
      const malformedEnv = {
        NODE_ENV: "development",
        PORT: "999999", // invalid port out of range
      };

      expect(() => validateEnvironment(malformedEnv)).toThrow(ConfigurationError);
    });

    it("rejects malformed public URLs", () => {
      expect(() =>
        publicEnvSchema.parse({
          NEXT_PUBLIC_APP_URL: "not-a-valid-url",
        }),
      ).toThrow();
    });

    it("rejects non-PostgreSQL connection protocols", () => {
      expect(() =>
        serverCoreEnvSchema.parse({
          DATABASE_URL: "mysql://user:pass@localhost:3306/db",
        }),
      ).toThrow(/Must be a valid PostgreSQL connection string/);
    });
  });

  describe("Protected Route Shells Rendering with Validated Context", () => {
    it("renders the Owner Dashboard shell layout with role-aware navigation and main content", () => {
      render(
        <DashboardLayout>
          <DashboardPage />
        </DashboardLayout>,
      );

      // Verify layout brand and navigation
      expect(screen.getByText("Merchant Dashboard")).toBeTruthy();
      expect(screen.getByText("Owner Portal")).toBeTruthy();

      // Verify main content heading and description
      expect(screen.getByRole("heading", { level: 1, name: "Daily Business Pulse" })).toBeTruthy();
      expect(
        screen.getByText(/Real-time sales, active counter orders, and Vya daily intelligence/),
      ).toBeTruthy();

      // Verify navigation links for business management
      const analyticsLink = screen.getByRole("link", { name: "Analytics" });
      expect(analyticsLink.getAttribute("href")).toBe("/dashboard/analytics");

      const billingLink = screen.getByRole("link", { name: "GST Billing" });
      expect(billingLink.getAttribute("href")).toBe("/dashboard/billing");
    });

    it("renders the Counter Staff POS shell with essential high-speed counter controls", () => {
      render(<CounterPosPage />);

      expect(screen.getByRole("heading", { level: 1, name: "Fast Billing Terminal" })).toBeTruthy();
      expect(screen.getByText(/Active Bill Cart & SKU Scanner/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Print Bill (F2) (VO-110)" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "POS Offline (VO-110)" })).toBeTruthy();
    });

    it("renders the Platform Admin shell layout with security and governance navigation", () => {
      render(
        <PlatformAdminLayout>
          <div data-testid="admin-content">Governance Metric Dashboard</div>
        </PlatformAdminLayout>,
      );

      expect(screen.getByText("VyapOne Governance")).toBeTruthy();
      expect(screen.getByText("Platform Super-Admin")).toBeTruthy();
      expect(screen.getByTestId("admin-content")).toBeTruthy();

      // Verify platform administration links
      const tenantsLink = screen.getByRole("link", { name: "Tenants" });
      expect(tenantsLink.getAttribute("href")).toBe("/platform-admin/tenants");

      const auditLogsLink = screen.getByRole("link", { name: "Audit Trail" });
      expect(auditLogsLink.getAttribute("href")).toBe("/platform-admin/audit-logs");

      const abuseLink = screen.getByRole("link", { name: "Abuse Defense" });
      expect(abuseLink.getAttribute("href")).toBe("/platform-admin/abuse");
    });
  });
});
