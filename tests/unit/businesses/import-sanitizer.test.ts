import { describe, expect, it } from "vitest";
import {
  sanitizeControlChars,
  sanitizeFormulaInjection,
  sanitizeHtmlTags,
  sanitizeImportText,
  sanitizeSpreadsheetCell,
} from "@/lib/businesses/import/sanitizer";

describe("VO-034 Import Security Sanitizer Tests", () => {
  describe("1. Formula Injection (CWE-1236) Neutralization", () => {
    it("escapes formula injection starting with '='", () => {
      const malicious = "=SUM(A1:A10)";
      expect(sanitizeFormulaInjection(malicious)).toBe("'=SUM(A1:A10)");
    });

    it("escapes command execution payloads starting with '=cmd|'", () => {
      const payload = "=cmd|'/C calc'!A0";
      expect(sanitizeFormulaInjection(payload)).toBe("'=cmd|'/C calc'!A0");
    });

    it("escapes formula injection starting with '@'", () => {
      const payload = "@SUM(1+1)";
      expect(sanitizeFormulaInjection(payload)).toBe("'@SUM(1+1)");
    });

    it("escapes formula injection starting with pipe '|'", () => {
      const payload = "|calc.exe";
      expect(sanitizeFormulaInjection(payload)).toBe("'|calc.exe");
    });

    it("preserves legitimate positive phone numbers with leading '+'", () => {
      expect(sanitizeFormulaInjection("+919876543210")).toBe("+919876543210");
    });

    it("preserves legitimate numeric amounts", () => {
      expect(sanitizeFormulaInjection("150.50")).toBe("150.50");
      expect(sanitizeFormulaInjection("+100")).toBe("+100");
      expect(sanitizeFormulaInjection("-50")).toBe("-50");
    });

    it("escapes non-numeric strings starting with '-' or '+'", () => {
      expect(sanitizeFormulaInjection("-alert(1)")).toBe("'-alert(1)");
      expect(sanitizeFormulaInjection("+calc")).toBe("'+calc");
    });

    it("detects and escapes formulas preceded by leading tabs or whitespace", () => {
      expect(sanitizeFormulaInjection("\t\t=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
      expect(sanitizeFormulaInjection("   -2+3+cmd|' /C calc'!A0")).toBe("'-2+3+cmd|' /C calc'!A0");
    });

    it("detects and escapes formulas hidden behind Unicode BOM or zero-width spaces", () => {
      const bomFormula = "\uFEFF=cmd|'/C calc'!A0";
      expect(sanitizeFormulaInjection(bomFormula)).toBe("'=cmd|'/C calc'!A0");

      const zeroWidthFormula = "\u200B\u200C\u200D@SUM(1+1)";
      expect(sanitizeFormulaInjection(zeroWidthFormula)).toBe("'@SUM(1+1)");
    });
  });

  describe("2. Field-Aware Sanitization Options", () => {
    it("preserves legitimate phone numbers when fieldCategory is phone", () => {
      expect(sanitizeFormulaInjection("+919876543210", { fieldCategory: "phone" })).toBe(
        "+919876543210",
      );
      expect(sanitizeFormulaInjection("+91 98765 43210", { fieldCategory: "phone" })).toBe(
        "+91 98765 43210",
      );
    });

    it("escapes phone field starting with dangerous formula characters like '=' or '@'", () => {
      expect(sanitizeFormulaInjection("=cmd|calc", { fieldCategory: "phone" })).toBe("'=cmd|calc");
    });

    it("strictly escapes non-phone text starting with '+' when fieldCategory is text", () => {
      // In product title / general text, leading '+' is escaped to prevent spreadsheet trigger
      expect(sanitizeFormulaInjection("+12345678901", { fieldCategory: "text" })).toBe(
        "'+12345678901",
      );
      expect(sanitizeFormulaInjection("+Premium Quality", { fieldCategory: "text" })).toBe(
        "'+Premium Quality",
      );
    });

    it("preserves negative and positive amounts when fieldCategory is numeric or currency", () => {
      expect(sanitizeFormulaInjection("-50", { fieldCategory: "numeric" })).toBe("-50");
      expect(sanitizeFormulaInjection("+100", { fieldCategory: "currency" })).toBe("+100");
    });
  });

  describe("3. HTML and Dangerous Script Tag Neutralization", () => {
    it("strips script tags and inner script content", () => {
      const input = "Sharma Sweets <script>alert('xss')</script> Indiranagar";
      expect(sanitizeHtmlTags(input)).toBe("Sharma Sweets  Indiranagar");
    });

    it("strips iframe and style tags", () => {
      const input = "Shop <iframe src='http://evil.com'></iframe> <style>body{color:red}</style>";
      expect(sanitizeHtmlTags(input)).toBe("Shop");
    });

    it("strips residual HTML tags", () => {
      const input = "<b>Bold Store</b> <a href='#'>Link</a>";
      expect(sanitizeHtmlTags(input)).toBe("Bold Store Link");
    });

    it("neutralizes javascript: URIs", () => {
      const input = "javascript:alert(1)";
      expect(sanitizeHtmlTags(input)).toBe("alert(1)");
    });
  });

  describe("4. Control Characters, BOM, and Invisible Unicode", () => {
    it("removes null bytes", () => {
      const input = "Store\x00Name";
      expect(sanitizeControlChars(input)).toBe("StoreName");
    });

    it("removes unprintable control characters", () => {
      const input = "Safe\x07Text\x1F";
      expect(sanitizeControlChars(input)).toBe("SafeText");
    });

    it("removes Unicode BOM and zero-width spaces", () => {
      const input = "\uFEFFStore\u200BName\u2060";
      expect(sanitizeControlChars(input)).toBe("StoreName");
    });

    it("removes Unicode BiDi overrides", () => {
      const input = "\u202EStoreName\u202C";
      expect(sanitizeControlChars(input)).toBe("StoreName");
    });
  });

  describe("5. Comprehensive sanitizeImportText & sanitizeSpreadsheetCell", () => {
    it("runs all layers: control chars, html tags, and formula injection", () => {
      const nasty = "=SUM(1)<script>alert(1)</script>\x00";
      const clean = sanitizeImportText(nasty);
      expect(clean).toBe("'=SUM(1)");
    });

    it("sanitizeSpreadsheetCell neutralizes cell formula injection for exports", () => {
      expect(sanitizeSpreadsheetCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
      expect(sanitizeSpreadsheetCell("+919876543210", { fieldCategory: "phone" })).toBe(
        "+919876543210",
      );
    });
  });
});
