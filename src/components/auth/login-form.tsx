"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Field,
  Input,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui";
import {
  signInWithPasswordAction,
  requestPhoneOtpAction,
  verifyPhoneOtpAction,
} from "@/lib/auth/actions";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next") || "/dashboard";
  const errorParam = searchParams.get("error");

  const [activeTab, setActiveTab] = useState<string>("otp");
  const [isPending, startTransition] = useTransition();

  // OTP flow state
  const [phone, setPhone] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // Password flow state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Feedback state
  const [errorMessage, setErrorMessage] = useState<string | null>(errorParam);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await requestPhoneOtpAction(null, { phone });
      if (!result.success) {
        setErrorMessage(result.error || "Failed to send OTP.");
      } else {
        setOtpSent(true);
        setSuccessMessage(result.message || "OTP code sent to your mobile.");
      }
    });
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await verifyPhoneOtpAction(null, {
        phone,
        token: otpToken,
        redirectTo: nextParam,
      });

      if (!result.success) {
        setErrorMessage(result.error || "Verification failed.");
      } else {
        setSuccessMessage("Authenticated successfully. Redirecting...");
        router.push(result.redirectTo || nextParam);
        router.refresh();
      }
    });
  };

  const handlePasswordSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await signInWithPasswordAction(null, {
        email,
        password,
        redirectTo: nextParam,
      });

      if (!result.success) {
        setErrorMessage(result.error || "Invalid credentials.");
      } else {
        setSuccessMessage("Signed in successfully. Redirecting...");
        router.push(result.redirectTo || nextParam);
        router.refresh();
      }
    });
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <CardTitle as="h1">Sign In</CardTitle>
          <Badge variant="default">Secure Auth</Badge>
        </div>
        <CardDescription>
          Sign in to your VyapOne back-office workspace using phone OTP or credentials.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: "var(--space-3)",
              marginBottom: "var(--space-4)",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-status-error-bg, #fee2e2)",
              color: "var(--color-status-error-text, #991b1b)",
              fontSize: "var(--font-size-body-sm)",
              border: "1px solid var(--color-status-error-border, #f87171)",
            }}
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            style={{
              padding: "var(--space-3)",
              marginBottom: "var(--space-4)",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-status-success-bg, #dcfce7)",
              color: "var(--color-status-success-text, #166534)",
              fontSize: "var(--font-size-body-sm)",
              border: "1px solid var(--color-status-success-border, #86efac)",
            }}
          >
            {successMessage}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList aria-label="Sign-in methods" style={{ marginBottom: "var(--space-4)" }}>
            <TabsTrigger value="otp">Mobile OTP</TabsTrigger>
            <TabsTrigger value="password">Email & Password</TabsTrigger>
          </TabsList>

          {/* Mobile OTP Tab */}
          <TabsContent value="otp">
            {!otpSent ? (
              <form
                onSubmit={handleRequestOtp}
                style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
              >
                <Field
                  id="login-phone"
                  label="Mobile Number"
                  required
                  helperText="Enter 10-digit Indian mobile number (e.g. 98765 43210)"
                >
                  <Input
                    type="tel"
                    id="login-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98765 43210"
                    autoComplete="tel"
                    required
                    disabled={isPending}
                  />
                </Field>
                <Button
                  type="submit"
                  variant="primary"
                  style={{ width: "100%" }}
                  disabled={isPending || !phone.trim()}
                >
                  {isPending ? "Sending OTP..." : "Send OTP"}
                </Button>
              </form>
            ) : (
              <form
                onSubmit={handleVerifyOtp}
                style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
              >
                <Field
                  id="login-otp"
                  label="6-Digit Verification Code"
                  required
                  helperText={`Sent to ${phone}`}
                >
                  <Input
                    type="text"
                    id="login-otp"
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    autoComplete="one-time-code"
                    required
                    disabled={isPending}
                  />
                </Field>
                <Button
                  type="submit"
                  variant="primary"
                  style={{ width: "100%" }}
                  disabled={isPending || otpToken.length < 6}
                >
                  {isPending ? "Verifying..." : "Verify & Sign In"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpToken("");
                  }}
                  disabled={isPending}
                >
                  Change Mobile Number
                </Button>
              </form>
            )}
          </TabsContent>

          {/* Email & Password Tab */}
          <TabsContent value="password">
            <form
              onSubmit={handlePasswordSignIn}
              style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
            >
              <Field id="login-email" label="Email Address" required>
                <Input
                  type="email"
                  id="login-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="merchant@example.com"
                  autoComplete="email"
                  required
                  disabled={isPending}
                />
              </Field>

              <Field id="login-password" label="Password" required>
                <Input
                  type="password"
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={isPending}
                />
              </Field>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Link
                  href="/forgot-password"
                  style={{
                    fontSize: "var(--font-size-body-sm)",
                    color: "var(--color-brand-primary)",
                    textDecoration: "none",
                  }}
                >
                  Forgot Password?
                </Link>
              </div>

              <Button
                type="submit"
                variant="primary"
                style={{ width: "100%" }}
                disabled={isPending || !email.trim() || !password}
              >
                {isPending ? "Signing In..." : "Sign In with Password"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter style={{ display: "flex", justifyContent: "center", gap: "var(--space-2)" }}>
        <span
          style={{ fontSize: "var(--font-size-body-sm)", color: "var(--color-text-secondary)" }}
        >
          Don&apos;t have an account?
        </span>
        <Link
          href="/register"
          style={{
            fontSize: "var(--font-size-body-sm)",
            color: "var(--color-brand-primary)",
            fontWeight: "var(--font-weight-medium)",
            textDecoration: "none",
          }}
        >
          Create Account
        </Link>
      </CardFooter>
    </Card>
  );
}
