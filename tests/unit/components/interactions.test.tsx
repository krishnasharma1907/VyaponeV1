import React, { useState } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import {
  Button,
  Field,
  Input,
  Textarea,
  Checkbox,
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
  TableRow,
  TableHead,
  TableCell,
  Badge,
  EmptyState,
  Skeleton,
  ToastProvider,
  useToast,
  Nav,
  NavList,
  NavItem,
  NavLink,
} from "@/components/ui";

describe("VO-013 Component Interactions & Accessibility Audit", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    document.body.style.overflow = "";
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    document.body.innerHTML = "";
    document.body.style.overflow = "";
  });

  // ==========================================================================
  // A. BUTTON INTERACTIONS
  // ==========================================================================
  describe("A. Button Interactions", () => {
    it("activates via mouse click", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);
      const btn = screen.getByRole("button", { name: "Click Me" });
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("activates via Enter and Space keyboard keys", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Press Me</Button>);
      const btn = screen.getByRole("button", { name: "Press Me" });
      btn.focus();
      expect(document.activeElement).toBe(btn);

      // In HTML, buttons trigger click on Enter and Space
      fireEvent.keyDown(btn, { key: "Enter", code: "Enter" });
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(btn, { key: " ", code: "Space" });
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it("disabled button cannot activate and ignores clicks", () => {
      const handleClick = vi.fn();
      render(
        <Button disabled onClick={handleClick}>
          Disabled Action
        </Button>,
      );
      const btn = screen.getByRole("button", { name: "Disabled Action" }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute("aria-disabled")).toBe("true");

      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("loading button cannot trigger repeated submission and sets aria-busy", () => {
      const handleClick = vi.fn();
      render(
        <Button isLoading loadingText="Processing..." onClick={handleClick}>
          Submit Order
        </Button>,
      );
      const btn = screen.getByRole("button") as HTMLButtonElement;
      expect(btn.getAttribute("aria-busy")).toBe("true");
      expect(btn.disabled).toBe(true);
      expect(screen.getByText("Processing...")).toBeTruthy();

      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("enforces explicit button types (type='button' default, type='submit')", () => {
      const { rerender } = render(<Button>Default</Button>);
      expect(screen.getByRole("button").getAttribute("type")).toBe("button");

      rerender(<Button type="submit">Submit Form</Button>);
      expect(screen.getByRole("button").getAttribute("type")).toBe("submit");
    });

    it("icon-only button provides accessible name via aria-label", () => {
      render(<Button aria-label="Print Invoice" leftIcon={<span aria-hidden="true">🖨</span>} />);
      const btn = screen.getByRole("button", { name: "Print Invoice" });
      expect(btn).toBeTruthy();
      expect(btn.getAttribute("aria-label")).toBe("Print Invoice");
    });
  });

  // ==========================================================================
  // B. FORM FIELDS INTERACTIONS
  // ==========================================================================
  describe("B. Form Fields Interactions", () => {
    it("associates label correctly with input control via explicit htmlFor and id", () => {
      render(
        <Field id="biz-gstin" label="GSTIN Number">
          <Input placeholder="27AAAAA0000A1Z5" />
        </Field>,
      );
      const label = screen.getByText("GSTIN Number");
      const input = screen.getByPlaceholderText("27AAAAA0000A1Z5") as HTMLInputElement;
      expect(label.getAttribute("for")).toBe("biz-gstin");
      expect(input.id).toBe("biz-gstin");
      expect(screen.getByLabelText("GSTIN Number")).toBe(input);
    });

    it("correctly exposes required state and native required attribute", () => {
      render(
        <Field id="customer-name" label="Customer Name" required>
          <Input />
        </Field>,
      );
      const input = screen.getByLabelText(/Customer Name/) as HTMLInputElement;
      expect(input.required).toBe(true);
      expect(input.getAttribute("aria-required")).toBe("true");
    });

    it("connects error description via aria-describedby and exposes role='alert'", () => {
      render(
        <Field id="invoice-total" label="Total Amount" errorMessage="Total must be greater than ₹0">
          <Input />
        </Field>,
      );
      const input = screen.getByLabelText(/Total Amount/);
      const errorMsg = screen.getByRole("alert");

      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(input.getAttribute("aria-describedby")).toBe("invoice-total-error");
      expect(errorMsg.id).toBe("invoice-total-error");
      expect(errorMsg.textContent).toContain("Total must be greater than ₹0");
    });

    it("disabled state prevents user input on Input and Textarea", () => {
      render(
        <Field id="disabled-notes" label="Notes" disabled>
          <Textarea placeholder="Cannot type here" />
        </Field>,
      );
      const textarea = screen.getByPlaceholderText("Cannot type here") as HTMLTextAreaElement;
      expect(textarea.disabled).toBe(true);
    });

    it("Checkbox label is connected and toggles checked state on click", () => {
      function CheckboxTest() {
        const [checked, setChecked] = useState(false);
        return (
          <Checkbox
            id="gst-inclusive"
            label="GST Inclusive"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
        );
      }
      render(<CheckboxTest />);
      const checkbox = screen.getByRole("checkbox", { name: "GST Inclusive" }) as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });
  });

  // ==========================================================================
  // C. DIALOG INTERACTIONS & FOCUS TRAP
  // ==========================================================================
  describe("C. Dialog Interactions & Accessibility", () => {
    function ControlledDialogTest({ closeOnEscape = true }: { closeOnEscape?: boolean }) {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button id="outside-btn" type="button">
            Outside Button
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger id="open-dialog-btn">Open Dialog</DialogTrigger>
            <DialogContent closeOnEscape={closeOnEscape}>
              <DialogHeader>
                <DialogTitle>Confirm Action</DialogTitle>
                <DialogDescription>Are you sure you want to proceed?</DialogDescription>
              </DialogHeader>
              <input id="dialog-input" placeholder="Type confirmation" />
              <DialogFooter>
                <DialogClose id="cancel-btn">Cancel</DialogClose>
                <Button id="confirm-btn">Confirm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    it("opens correctly and moves initial focus into first focusable control", () => {
      render(<ControlledDialogTest />);
      const trigger = screen.getByRole("button", { name: "Open Dialog" });
      expect(screen.queryByRole("dialog")).toBeNull();

      fireEvent.click(trigger);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeTruthy();
      expect(dialog.getAttribute("aria-modal")).toBe("true");

      act(() => {
        vi.runAllTimers();
      });

      const cancelBtn = screen.getByRole("button", { name: "Cancel" });
      const dialogInput = screen.getByPlaceholderText("Type confirmation");
      expect([cancelBtn, dialogInput]).toContain(document.activeElement);
    });

    it("traps Tab and Shift+Tab keyboard focus inside dialog without escaping", () => {
      render(<ControlledDialogTest />);
      fireEvent.click(screen.getByRole("button", { name: "Open Dialog" }));
      act(() => {
        vi.runAllTimers();
      });

      const dialogInput = screen.getByPlaceholderText("Type confirmation");
      const confirmBtn = screen.getByRole("button", { name: "Confirm" });

      // Focus last element (confirmBtn)
      confirmBtn.focus();
      expect(document.activeElement).toBe(confirmBtn);

      // Pressing Tab on last element wraps around to first element (dialogInput)
      fireEvent.keyDown(document, { key: "Tab", shiftKey: false });
      expect(document.activeElement).toBe(dialogInput);

      // Pressing Shift+Tab on first element wraps around to last element (confirmBtn)
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(confirmBtn);

      // If activeElement is somehow outside, Tab redirects focus inside
      const outsideBtn = screen.getByRole("button", { name: "Outside Button" });
      outsideBtn.focus();
      fireEvent.keyDown(document, { key: "Tab", shiftKey: false });
      expect(document.activeElement).toBe(dialogInput);
    });

    it("dismisses on Escape key and restores focus to trigger", () => {
      render(<ControlledDialogTest closeOnEscape={true} />);
      const trigger = screen.getByRole("button", { name: "Open Dialog" });
      fireEvent.click(trigger);
      act(() => {
        vi.runAllTimers();
      });

      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(document.body.style.overflow).toBe("hidden");

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" });
      act(() => {
        vi.runAllTimers();
      });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.body.style.overflow).toBe("");
      expect(document.activeElement).toBe(trigger);
    });

    it("closes via DialogClose button and cleans up body scroll lock", () => {
      render(<ControlledDialogTest />);
      const trigger = screen.getByRole("button", { name: "Open Dialog" });
      fireEvent.click(trigger);
      act(() => {
        vi.runAllTimers();
      });

      const closeBtn = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(closeBtn);
      act(() => {
        vi.runAllTimers();
      });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });
  });

  // ==========================================================================
  // D. DRAWER INTERACTIONS
  // ==========================================================================
  describe("D. Drawer Interactions & Focus Management", () => {
    function DrawerTest() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger id="open-drawer">Open Sheet</DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Quick POS</DrawerTitle>
                <DrawerDescription>Counter Bill</DrawerDescription>
              </DrawerHeader>
              <input id="drawer-input" placeholder="Scan Barcode" />
              <DrawerFooter>
                <DrawerClose>Done</DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>
      );
    }

    it("opens, manages focus into first focusable control, and closes on Escape", () => {
      render(<DrawerTest />);
      const trigger = screen.getByRole("button", { name: "Open Sheet" });
      fireEvent.click(trigger);
      act(() => {
        vi.runAllTimers();
      });

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeTruthy();
      expect(document.body.style.overflow).toBe("hidden");

      const input = screen.getByPlaceholderText("Scan Barcode");
      expect(document.activeElement).toBe(input);

      // Escape dismisses drawer and restores scroll
      fireEvent.keyDown(document, { key: "Escape" });
      act(() => {
        vi.runAllTimers();
      });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.body.style.overflow).toBe("");
      expect(document.activeElement).toBe(trigger);
    });
  });

  // ==========================================================================
  // E. TABS KEYBOARD NAVIGATION
  // ==========================================================================
  describe("E. Tabs Keyboard Navigation", () => {
    it("navigates horizontally with ArrowRight, ArrowLeft, Home, and End", () => {
      render(
        <Tabs defaultValue="one" orientation="horizontal">
          <TabsList aria-label="Payment Options">
            <TabsTrigger value="one">UPI</TabsTrigger>
            <TabsTrigger value="two">Cash</TabsTrigger>
            <TabsTrigger value="three">Card</TabsTrigger>
          </TabsList>
          <TabsContent value="one">UPI Panel</TabsContent>
          <TabsContent value="two">Cash Panel</TabsContent>
          <TabsContent value="three">Card Panel</TabsContent>
        </Tabs>,
      );

      const tabOne = screen.getByRole("tab", { name: "UPI" });
      const tabTwo = screen.getByRole("tab", { name: "Cash" });
      const tabThree = screen.getByRole("tab", { name: "Card" });

      expect(tabOne.getAttribute("aria-selected")).toBe("true");
      expect(tabOne.getAttribute("tabindex")).toBe("0");
      expect(tabTwo.getAttribute("tabindex")).toBe("-1");
      expect(tabThree.getAttribute("tabindex")).toBe("-1");

      tabOne.focus();
      expect(document.activeElement).toBe(tabOne);

      // ArrowRight -> moves to Cash
      fireEvent.keyDown(tabOne, { key: "ArrowRight" });
      expect(tabTwo.getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(tabTwo);
      expect(screen.getByText("Cash Panel")).toBeTruthy();

      // ArrowRight -> moves to Card
      fireEvent.keyDown(tabTwo, { key: "ArrowRight" });
      expect(tabThree.getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(tabThree);

      // ArrowRight on last tab wraps to first tab (UPI)
      fireEvent.keyDown(tabThree, { key: "ArrowRight" });
      expect(tabOne.getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(tabOne);

      // ArrowLeft on first tab wraps to last tab (Card)
      fireEvent.keyDown(tabOne, { key: "ArrowLeft" });
      expect(tabThree.getAttribute("aria-selected")).toBe("true");

      // Home key moves to first tab (UPI)
      fireEvent.keyDown(tabThree, { key: "Home" });
      expect(tabOne.getAttribute("aria-selected")).toBe("true");

      // End key moves to last tab (Card)
      fireEvent.keyDown(tabOne, { key: "End" });
      expect(tabThree.getAttribute("aria-selected")).toBe("true");
    });

    it("navigates vertically with ArrowDown and ArrowUp", () => {
      render(
        <Tabs defaultValue="v1" orientation="vertical">
          <TabsList aria-label="Settings">
            <TabsTrigger value="v1">General</TabsTrigger>
            <TabsTrigger value="v2">Billing</TabsTrigger>
          </TabsList>
          <TabsContent value="v1">General Settings</TabsContent>
          <TabsContent value="v2">Billing Settings</TabsContent>
        </Tabs>,
      );

      const tab1 = screen.getByRole("tab", { name: "General" });
      const tab2 = screen.getByRole("tab", { name: "Billing" });

      tab1.focus();
      fireEvent.keyDown(tab1, { key: "ArrowDown" });
      expect(tab2.getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(tab2);

      fireEvent.keyDown(tab2, { key: "ArrowUp" });
      expect(tab1.getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(tab1);
    });
  });

  // ==========================================================================
  // F. TABLE STRUCTURE
  // ==========================================================================
  describe("F. Table Structure & Semantics", () => {
    it("renders semantic table with keyboard-accessible mobile scroll container", () => {
      render(
        <TableContainer aria-label="Invoice Items">
          <Table>
            <TableCaption>Itemized Summary</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Description</TableHead>
                <TableHead scope="col">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Masala Chai</TableCell>
                <TableCell>₹20</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>,
      );

      const container = screen.getByRole("region", { name: "Invoice Items" });
      expect(container.getAttribute("tabindex")).toBe("0");
      expect(screen.getByRole("table")).toBeTruthy();
      expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    });
  });

  // ==========================================================================
  // G. BADGE AND EMPTY STATE
  // ==========================================================================
  describe("G. Badge and Empty State Accessibility", () => {
    it("communicates status through visible text without color alone", () => {
      render(<Badge variant="danger">Payment Overdue</Badge>);
      const badge = screen.getByText("Payment Overdue");
      expect(badge).toBeTruthy();
    });

    it("EmptyState provides accessible actions and region label", () => {
      render(
        <EmptyState
          title="No Invoices"
          description="Create your first invoice to record sales."
          action={<Button aria-label="Create New Invoice">New Invoice</Button>}
        />,
      );
      expect(screen.getByRole("region", { name: "No Invoices" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Create New Invoice" })).toBeTruthy();
    });
  });

  // ==========================================================================
  // H. SKELETON ACCESSIBILITY
  // ==========================================================================
  describe("H. Skeleton Accessibility", () => {
    it("remains completely hidden from screen readers via aria-hidden='true'", () => {
      const { container } = render(<Skeleton variant="rectangular" width={200} height={40} />);
      const skeleton = container.querySelector(".ui-skeleton");
      expect(skeleton?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  // ==========================================================================
  // I. TOAST LIVE REGION INTERACTIONS
  // ==========================================================================
  describe("I. Toast Live Region & Interaction", () => {
    function ToastTriggerApp() {
      const { addToast } = useToast();
      return (
        <div>
          <button
            onClick={() =>
              addToast({
                title: "Payment Received",
                description: "₹1,500 via UPI",
                variant: "success",
                duration: 5000,
              })
            }
          >
            Trigger Success
          </button>
          <button
            onClick={() =>
              addToast({
                title: "Gateway Error",
                description: "Bank connection timeout",
                variant: "error",
                duration: 10000,
              })
            }
          >
            Trigger Error
          </button>
        </div>
      );
    }

    it("announces success via polite status live region and dismisses after duration", () => {
      render(
        <ToastProvider>
          <ToastTriggerApp />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Trigger Success" }));
      const statusToast = screen.getByRole("status");
      expect(statusToast.getAttribute("aria-live")).toBe("polite");
      expect(statusToast.getAttribute("aria-atomic")).toBe("true");
      expect(screen.getByText("Payment Received")).toBeTruthy();

      // Advance timer by 5000ms -> toast auto-dismisses
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("announces error via assertive alert live region and allows manual dismiss", () => {
      render(
        <ToastProvider>
          <ToastTriggerApp />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Trigger Error" }));
      const alertToast = screen.getByRole("alert");
      expect(alertToast.getAttribute("aria-live")).toBe("assertive");
      expect(screen.getByText("Gateway Error")).toBeTruthy();

      // Click manual close button
      const dismissBtn = screen.getByRole("button", { name: "Dismiss notification" });
      fireEvent.click(dismissBtn);
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  // ==========================================================================
  // J. NAVIGATION ACCESSIBILITY & KEYBOARD
  // ==========================================================================
  describe("J. Navigation Accessibility", () => {
    it("has accessible landmark name and marks active item with aria-current='page'", () => {
      render(
        <Nav aria-label="Staff Terminal Navigation" variant="bottom-bar">
          <NavList>
            <NavItem>
              <NavLink href="/billing" isActive={true}>
                Billing
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="/inventory" isActive={false}>
                Inventory
              </NavLink>
            </NavItem>
          </NavList>
        </Nav>,
      );

      const navLandmark = screen.getByRole("navigation", {
        name: "Staff Terminal Navigation",
      });
      expect(navLandmark).toBeTruthy();

      const activeLink = screen.getByRole("link", { name: "Billing" });
      const inactiveLink = screen.getByRole("link", { name: "Inventory" });

      expect(activeLink.getAttribute("aria-current")).toBe("page");
      expect(inactiveLink.getAttribute("aria-current")).toBeNull();
    });
  });
});
