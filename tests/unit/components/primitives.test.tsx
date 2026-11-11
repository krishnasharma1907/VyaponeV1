import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Button,
  Field,
  Input,
  Textarea,
  Select,
  Checkbox,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableContainer,
  TableCaption,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  EmptyState,
  Skeleton,
  ToastCard,
  Nav,
  NavList,
  NavItem,
  NavLink,
} from "@/components/ui";

describe("Accessible Shared UI Primitives (VO-013)", () => {
  describe("Button Primitive", () => {
    it("renders default primary button with md size and type='button'", () => {
      const html = renderToStaticMarkup(<Button>Submit</Button>);
      expect(html).toContain('type="button"');
      expect(html).toContain("ui-btn-primary");
      expect(html).toContain("ui-btn-md");
      expect(html).toContain("Submit");
    });

    it("renders custom variants and sizes correctly", () => {
      const html = renderToStaticMarkup(
        <Button variant="destructive" size="lg" type="submit">
          Delete Item
        </Button>,
      );
      expect(html).toContain('type="submit"');
      expect(html).toContain("ui-btn-destructive");
      expect(html).toContain("ui-btn-lg");
      expect(html).toContain("Delete Item");
    });

    it("renders accent variant for secondary brand action", () => {
      const html = renderToStaticMarkup(<Button variant="accent">Order Now</Button>);
      expect(html).toContain("ui-btn-accent");
    });

    it("handles isLoading state with aria-busy and disabled attributes", () => {
      const html = renderToStaticMarkup(
        <Button isLoading loadingText="Saving...">
          Save
        </Button>,
      );
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("disabled");
      expect(html).toContain("ui-btn-spinner");
      expect(html).toContain("Saving...");
      expect(html).not.toContain(">Save<");
    });

    it("renders left and right icons with aria-hidden='true'", () => {
      const html = renderToStaticMarkup(
        <Button
          leftIcon={<span data-testid="left">←</span>}
          rightIcon={<span data-testid="right">→</span>}
        >
          Navigate
        </Button>,
      );
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain("ui-btn-icon-left");
      expect(html).toContain("ui-btn-icon-right");
    });
  });

  describe("Form Field Primitives", () => {
    it("associates label with input using explicit id and htmlFor", () => {
      const html = renderToStaticMarkup(
        <Field id="customer-phone" label="Mobile Number">
          <Input placeholder="Enter 10-digit mobile" />
        </Field>,
      );
      expect(html).toContain('for="customer-phone"');
      expect(html).toContain('id="customer-phone"');
      expect(html).toContain("Mobile Number");
    });

    it("indicates required state with aria-required and visual indicator", () => {
      const html = renderToStaticMarkup(
        <Field id="gstin" label="GSTIN" required>
          <Input />
        </Field>,
      );
      expect(html).toContain('aria-required="true"');
      expect(html).toContain("ui-field-required");
      expect(html).toContain("*");
    });

    it("associates helper text using aria-describedby", () => {
      const html = renderToStaticMarkup(
        <Field id="notes" label="Notes" helperText="Maximum 500 characters">
          <Textarea />
        </Field>,
      );
      expect(html).toContain('id="notes-helper"');
      expect(html).toContain('aria-describedby="notes-helper"');
      expect(html).toContain("Maximum 500 characters");
    });

    it("associates error message with role='alert' and marks field invalid", () => {
      const html = renderToStaticMarkup(
        <Field id="amount" label="Invoice Amount" errorMessage="Amount must be greater than zero">
          <Input />
        </Field>,
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain('id="amount-error"');
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('aria-describedby="amount-error"');
      expect(html).toContain("Amount must be greater than zero");
      expect(html).toContain("ui-field-invalid");
    });

    it("renders Select primitive with aria attributes", () => {
      const html = renderToStaticMarkup(
        <Field id="payment-mode" label="Payment Mode">
          <Select>
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
          </Select>
        </Field>,
      );
      expect(html).toContain('id="payment-mode"');
      expect(html).toContain("<select");
      expect(html).toContain("ui-select");
      expect(html).toContain("UPI");
    });

    it("renders accessible Checkbox with linked label", () => {
      const html = renderToStaticMarkup(
        <Checkbox id="tax-inclusive" label="Prices are inclusive of GST" />,
      );
      expect(html).toContain('type="checkbox"');
      expect(html).toContain('for="tax-inclusive"');
      expect(html).toContain('id="tax-inclusive"');
      expect(html).toContain("Prices are inclusive of GST");
    });
  });

  describe("Card Primitive", () => {
    it("renders structured card with header, title, content and footer", () => {
      const html = renderToStaticMarkup(
        <Card variant="elevated">
          <CardHeader>
            <CardTitle as="h2">Monthly Revenue</CardTitle>
            <CardDescription>Consolidated across all stores</CardDescription>
          </CardHeader>
          <CardContent>
            <p>₹1,45,000</p>
          </CardContent>
          <CardFooter>
            <span>Updated 5m ago</span>
            <CardAction>
              <Button size="sm">View Report</Button>
            </CardAction>
          </CardFooter>
        </Card>,
      );
      expect(html).toContain("ui-card-elevated");
      expect(html).toContain("<h2");
      expect(html).toContain("Monthly Revenue");
      expect(html).toContain("Consolidated across all stores");
      expect(html).toContain("₹1,45,000");
      expect(html).toContain("ui-card-footer");
    });

    it("renders glass variant correctly", () => {
      const html = renderToStaticMarkup(
        <Card variant="glass">
          <CardContent>Glass Surface</CardContent>
        </Card>,
      );
      expect(html).toContain("ui-card-glass");
    });
  });

  describe("Dialog & Modal Primitives", () => {
    it("renders trigger button with aria-haspopup and aria-expanded", () => {
      const html = renderToStaticMarkup(
        <Dialog>
          <DialogTrigger>Open Invoice Modal</DialogTrigger>
        </Dialog>,
      );
      expect(html).toContain('aria-haspopup="dialog"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain("Open Invoice Modal");
    });

    it("renders open dialog with role='dialog', aria-modal='true', and linked labels", () => {
      const html = renderToStaticMarkup(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Refund</DialogTitle>
              <DialogDescription>
                This action will credit ₹500 back to the customer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose>Cancel</DialogClose>
              <Button variant="destructive">Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain("aria-labelledby");
      expect(html).toContain("aria-describedby");
      expect(html).toContain("Confirm Refund");
      expect(html).toContain("This action will credit ₹500 back to the customer.");
      expect(html).toContain("ui-dialog-close");
    });
  });

  describe("Drawer / Bottom-Sheet Primitive", () => {
    it("renders drawer trigger with aria-haspopup and aria-expanded", () => {
      const html = renderToStaticMarkup(
        <Drawer>
          <DrawerTrigger>Open Bottom Sheet</DrawerTrigger>
        </Drawer>,
      );
      expect(html).toContain('aria-haspopup="dialog"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain("Open Bottom Sheet");
    });

    it("renders open bottom sheet with mobile drag handle and dialog semantics", () => {
      const html = renderToStaticMarkup(
        <Drawer open={true}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Quick Actions</DrawerTitle>
              <DrawerDescription>Counter POS Shortcuts</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose>Dismiss</DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>,
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain("ui-drawer-handle");
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain("Quick Actions");
    });
  });

  describe("Tabs Primitive", () => {
    it("renders tablist with tab and tabpanel ARIA roles", () => {
      const html = renderToStaticMarkup(
        <Tabs defaultValue="overview">
          <TabsList aria-label="Dashboard views">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Overview Panel Content</TabsContent>
          <TabsContent value="sales">Sales Panel Content</TabsContent>
        </Tabs>,
      );
      expect(html).toContain('role="tablist"');
      expect(html).toContain('aria-label="Dashboard views"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('aria-selected="false"');
      expect(html).toContain('role="tabpanel"');
      expect(html).toContain("Overview Panel Content");
      expect(html).not.toContain("Sales Panel Content");
    });
  });

  describe("Table Primitive", () => {
    it("renders responsive scroll container with role='region' and tabIndex=0", () => {
      const html = renderToStaticMarkup(
        <TableContainer aria-label="Sales transactions">
          <Table>
            <TableCaption>Daily Cashier Register</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Bill No.</TableHead>
                <TableHead scope="col">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>INV-001</TableCell>
                <TableCell>₹1,200</TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell>₹1,200</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>,
      );
      expect(html).toContain('role="region"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('aria-label="Sales transactions"');
      expect(html).toContain("<caption");
      expect(html).toContain('scope="col"');
      expect(html).toContain("INV-001");
      expect(html).toContain("₹1,200");
    });
  });

  describe("Badge Primitive", () => {
    it("renders semantic status badges with visible text", () => {
      const html = renderToStaticMarkup(<Badge variant="success">Paid</Badge>);
      expect(html).toContain("ui-badge-success");
      expect(html).toContain("Paid");
    });

    it("renders badge with decorative icon", () => {
      const html = renderToStaticMarkup(
        <Badge variant="warning" icon={<span>⚠</span>}>
          Pending Verification
        </Badge>,
      );
      expect(html).toContain("ui-badge-warning");
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain("Pending Verification");
    });
  });

  describe("EmptyState Primitive", () => {
    it("renders empty state with role='region', title, description and action", () => {
      const html = renderToStaticMarkup(
        <EmptyState
          icon={<span>📦</span>}
          title="No Products Found"
          description="Add your first product to begin billing customers."
          action={<Button>Create Product</Button>}
        />,
      );
      expect(html).toContain('role="region"');
      expect(html).toContain('aria-label="No Products Found"');
      expect(html).toContain("ui-empty-state-icon");
      expect(html).toContain("No Products Found");
      expect(html).toContain("Add your first product to begin billing customers.");
      expect(html).toContain("Create Product");
    });
  });

  describe("Skeleton Primitive", () => {
    it("renders skeleton loader with aria-hidden='true'", () => {
      const html = renderToStaticMarkup(
        <Skeleton variant="rectangular" width="100%" height={200} />,
      );
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain("ui-skeleton-rectangular");
      expect(html).toContain("width:100%");
      expect(html).toContain("height:200px");
    });
  });

  describe("Toast Notification Primitive", () => {
    it("renders info toast with role='status' and aria-live='polite'", () => {
      const html = renderToStaticMarkup(
        <ToastCard
          toast={{
            id: "t1",
            title: "Saved",
            description: "Changes saved to database.",
            variant: "info",
          }}
          onDismiss={() => {}}
        />,
      );
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain("Saved");
      expect(html).toContain("Changes saved to database.");
      expect(html).toContain('aria-label="Dismiss notification"');
    });

    it("renders error toast with role='alert' and aria-live='assertive'", () => {
      const html = renderToStaticMarkup(
        <ToastCard
          toast={{
            id: "t2",
            title: "Error",
            description: "Failed to connect to payment gateway.",
            variant: "error",
          }}
          onDismiss={() => {}}
        />,
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain('aria-live="assertive"');
      expect(html).toContain("ui-toast-error");
      expect(html).toContain("Failed to connect to payment gateway.");
    });
  });

  describe("Navigation Landmark Primitive", () => {
    it("renders navigation landmark with required aria-label and links with aria-current", () => {
      const html = renderToStaticMarkup(
        <Nav variant="horizontal" aria-label="Main Navigation">
          <NavList>
            <NavItem>
              <NavLink href="/dashboard" isActive={true}>
                Dashboard
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="/billing" isActive={false}>
                Billing
              </NavLink>
            </NavItem>
          </NavList>
        </Nav>,
      );
      expect(html).toContain('<nav aria-label="Main Navigation"');
      expect(html).toContain("<ul");
      expect(html).toContain("<li");
      expect(html).toContain('aria-current="page"');
      expect(html).toContain("ui-nav-link-active");
      expect(html).toContain('href="/dashboard"');
      expect(html).toContain('href="/billing"');
    });
  });
});
