import { describe, expect, it } from "vitest";
import {
  computeProposalStats,
  evaluateProposalReadiness,
  formatPaiseToRupees,
  parseBusinessImportContent,
  parseCsvImport,
  parseJsonImport,
  parseRupeesToPaise,
  parseTextImport,
} from "@/lib/businesses/import/parser";
import type { ImportReviewField } from "@/lib/businesses/import/types";

describe("VO-034 Business Import Parser & Field Extractor Tests", () => {
  const workspaceId = "11111111-2222-3333-4444-555555555555";

  describe("1. Currency & Minor Unit Handling", () => {
    it("converts rupees to paise minor units accurately", () => {
      expect(parseRupeesToPaise(120)).toBe(12000);
      expect(parseRupeesToPaise("120")).toBe(12000);
      expect(parseRupeesToPaise("150.50")).toBe(15050);
      expect(parseRupeesToPaise("₹ 99.99")).toBe(9999);
      expect(parseRupeesToPaise("Rs. 45")).toBe(4500);
    });

    it("formats paise back to Indian Rupee display", () => {
      expect(formatPaiseToRupees(12000)).toContain("120");
      expect(formatPaiseToRupees(15050)).toContain("150.5");
    });
  });

  describe("2. JSON Import Parsing & Invariants", () => {
    const validJson = JSON.stringify({
      trade_name: "Chai & Chaska Café",
      legal_name: "Chai & Chaska Food Services LLP",
      niche_slug: "cafe",
      description: "Artisanal tea and bakery",
      primary_phone: "+919826012345",
      whatsapp_number: "+919826012345",
      email: "contact@chaiandchaska.in",
      address_line1: "56 Dukan Street",
      city: "Indore",
      state: "Madhya Pradesh",
      postal_code: "452001",
      gst_number: "23AABCC1234D1Z5",
      pan_number: "AABCC1234D",
      timings: {
        monday: "08:00 - 22:30",
        sunday: "closed",
      },
      items: [
        { title: "Special Elaichi Chai", price: 30, description: "Cardamom milk tea" },
        { title: "Bun Maska", price: 50 },
      ],
    });

    it("parses structured JSON and extracts all identity, contact, location, tax, timings, and catalogue items", () => {
      const fields = parseJsonImport(validJson);
      expect(fields.length).toBeGreaterThanOrEqual(12);

      const trade = fields.find((f) => f.fieldName === "trade_name");
      expect(trade).toBeDefined();
      expect(trade?.extractedValue).toBe("Chai & Chaska Café");
      expect(trade?.sourceEvidence).toContain("trade_name");

      const pin = fields.find((f) => f.fieldName === "postal_code");
      expect(pin?.extractedValue).toBe("452001");
      expect(pin?.isRequired).toBe(true);
      expect(pin?.isMaterial).toBe(true);

      const items = fields.filter((f) => f.category === "catalogue");
      expect(items.length).toBe(2);
      expect(items[0].label).toContain("Special Elaichi Chai");
      expect((items[0].extractedValue as { priceMinor: number }).priceMinor).toBe(3000); // 30 Rs in paise
    });

    it("MANDATORY INVARIANT: every extracted price, timing, and material fact starts in 'unconfirmed' status", () => {
      const fields = parseJsonImport(validJson);

      for (const field of fields) {
        expect(field.status).toBe("unconfirmed");
      }

      // Check prices specifically
      const catalogueFields = fields.filter((f) => f.category === "catalogue");
      for (const cf of catalogueFields) {
        expect(cf.status).toBe("unconfirmed");
        expect(cf.isMaterial).toBe(true);
      }

      // Check timings specifically
      const timingFields = fields.filter((f) => f.category === "timings");
      for (const tf of timingFields) {
        expect(tf.status).toBe("unconfirmed");
        expect(tf.isMaterial).toBe(true);
      }
    });

    it("flags validation errors on malformed postal codes, phone numbers, or GSTINs", () => {
      const badJson = JSON.stringify({
        trade_name: "Bad Store",
        primary_phone: "123", // Too short
        postal_code: "9999", // Not 6 digits
        gst_number: "INVALID_GST",
      });

      const fields = parseJsonImport(badJson);
      const phoneField = fields.find((f) => f.fieldName === "primary_phone");
      expect(phoneField?.validationError).toBeDefined();

      const pinField = fields.find((f) => f.fieldName === "postal_code");
      expect(pinField?.validationError).toBeDefined();

      const gstField = fields.find((f) => f.fieldName === "gst_number");
      expect(gstField?.validationError).toBeDefined();
    });
  });

  describe("3. CSV Import Parsing & Formula Neutralization", () => {
    it("parses menu/catalogue CSV and converts prices to minor units with unconfirmed status", () => {
      const csv = `Item,Price,Category,Description
Masala Dosa,80,Breakfast,Crispy crepe
=cmd|'calc'!A0,220,Special,Malicious row
Paneer Tikka,180,Starter,Tandoori paneer`;

      const fields = parseCsvImport(csv);
      expect(fields.length).toBe(3);

      expect(fields[0].label).toContain("Masala Dosa");
      expect((fields[0].extractedValue as { priceMinor: number }).priceMinor).toBe(8000);
      expect(fields[0].status).toBe("unconfirmed");
      expect(fields[0].isMaterial).toBe(true);

      // Verify formula injection row is escaped
      expect(fields[1].label).toContain("'=cmd");
      expect(fields[1].status).toBe("unconfirmed");
    });

    it("parses business profile CSV", () => {
      const csv = `Shop Name,Phone,Address,City,State,PIN
Apex Electronics,9876543210,12 Commercial Road,Indore,Madhya Pradesh,452001`;

      const fields = parseCsvImport(csv);
      const trade = fields.find((f) => f.fieldName === "trade_name");
      expect(trade?.extractedValue).toBe("Apex Electronics");
      expect(trade?.status).toBe("unconfirmed");

      const phone = fields.find((f) => f.fieldName === "primary_phone");
      expect(phone?.extractedValue).toBe("9876543210");
      expect(phone?.status).toBe("unconfirmed");
    });
  });

  describe("4. Unstructured Text Parsing", () => {
    it("extracts phone, gstin, pin, timings, and price lines from unstructured text with evidence", () => {
      const text = `
Sharma Sweets & Bakers
Indiranagar 2nd Stage, Indiranagar, Bengaluru 560038
Contact: +91 9876543210
Email: info@sharmasweets.com
GSTIN: 29AAAAA0000A1Z5
Open Mon-Sat: 09:00 - 21:30

Specialities:
Kaju Katli - ₹800
Rasgulla - Rs. 40
Samosa - ₹20
`;

      const fields = parseTextImport(text);
      expect(fields.length).toBeGreaterThanOrEqual(6);

      const phone = fields.find((f) => f.fieldName === "primary_phone");
      expect(phone?.extractedValue).toBe("+919876543210");
      expect(phone?.sourceEvidence).toContain("Contact: +91 9876543210");
      expect(phone?.status).toBe("unconfirmed");

      const gst = fields.find((f) => f.fieldName === "gst_number");
      expect(gst?.extractedValue).toBe("29AAAAA0000A1Z5");
      expect(gst?.status).toBe("unconfirmed");

      const pin = fields.find((f) => f.fieldName === "postal_code");
      expect(pin?.extractedValue).toBe("560038");

      const items = fields.filter((f) => f.category === "catalogue");
      expect(items.length).toBe(3);
      expect(items[0].label).toContain("Kaju Katli");
      expect((items[0].extractedValue as { priceMinor: number }).priceMinor).toBe(80000);
      expect(items[0].status).toBe("unconfirmed");
      expect(items[0].isMaterial).toBe(true);

      const timing = fields.find((f) => f.category === "timings");
      expect(timing).toBeDefined();
      expect(timing?.status).toBe("unconfirmed");
      expect(timing?.isMaterial).toBe(true);
    });
  });

  describe("5. Proposal Readiness & Gate Evaluation", () => {
    const createSampleFields = (): ImportReviewField[] => [
      {
        id: "field:trade_name",
        category: "identity",
        fieldName: "trade_name",
        label: "Trade Name",
        rawValue: "Store",
        extractedValue: "Store",
        sourceEvidence: "line 1",
        confidence: "high",
        confidenceScore: 0.95,
        status: "unconfirmed",
        isMaterial: true,
        isRequired: true,
      },
      {
        id: "field:address_line1",
        category: "location",
        fieldName: "address_line1",
        label: "Address Line 1",
        rawValue: "Main St",
        extractedValue: "Main St",
        sourceEvidence: "line 2",
        confidence: "high",
        confidenceScore: 0.9,
        status: "unconfirmed",
        isMaterial: true,
        isRequired: true,
      },
      {
        id: "item:0",
        category: "catalogue",
        fieldName: "catalogue_item",
        label: "Item A",
        rawValue: "Item A - 100",
        extractedValue: { title: "Item A", priceMinor: 10000 },
        sourceEvidence: "line 3",
        confidence: "high",
        confidenceScore: 0.9,
        status: "unconfirmed",
        isMaterial: true,
        isRequired: false,
      },
    ];

    it("evaluates proposal as NOT ready when mandatory fields are unconfirmed", () => {
      const fields = createSampleFields();
      const readiness = evaluateProposalReadiness(fields);
      expect(readiness.isReady).toBe(false);
      expect(readiness.blockingReasons.some((r) => r.includes("Trade Name"))).toBe(true);
    });

    it("evaluates proposal as NOT ready when prices/timings remain unconfirmed even if required fields are confirmed", () => {
      const fields = createSampleFields();
      fields[0].status = "confirmed"; // Trade Name confirmed
      fields[1].status = "confirmed"; // Address Line 1 confirmed
      // item:0 remains unconfirmed (material price fact)

      const readiness = evaluateProposalReadiness(fields);
      expect(readiness.isReady).toBe(false);
      expect(readiness.blockingReasons.some((r) => r.includes("material fact"))).toBe(true);
    });

    it("evaluates proposal as ready when all required and material fields are confirmed or rejected", () => {
      const fields = createSampleFields();
      fields[0].status = "confirmed"; // Trade Name confirmed
      fields[1].status = "confirmed"; // Address Line 1 confirmed
      fields[2].status = "confirmed"; // Price confirmed

      const readiness = evaluateProposalReadiness(fields);
      expect(readiness.isReady).toBe(true);
      expect(readiness.blockingReasons.length).toBe(0);
    });

    it("allows rejected optional material items without blocking", () => {
      const fields = createSampleFields();
      fields[0].status = "confirmed";
      fields[1].status = "confirmed";
      fields[2].status = "rejected"; // Item rejected/dismissed by user

      const readiness = evaluateProposalReadiness(fields);
      expect(readiness.isReady).toBe(true);
    });

    it("blocks provisioning if a mandatory required field was rejected", () => {
      const fields = createSampleFields();
      fields[0].status = "rejected"; // Trade Name rejected without replacement
      fields[1].status = "confirmed";
      fields[2].status = "confirmed";

      const readiness = evaluateProposalReadiness(fields);
      expect(readiness.isReady).toBe(false);
      expect(
        readiness.blockingReasons.some((r) => r.includes("rejected without a replacement")),
      ).toBe(true);
    });
  });

  describe("6. Proposal Dispatcher & Stats Computation", () => {
    it("computes accurate stats for a mixed list of fields", () => {
      const stats = computeProposalStats([
        {
          id: "1",
          category: "identity",
          fieldName: "trade_name",
          label: "Trade Name",
          rawValue: "T",
          extractedValue: "T",
          sourceEvidence: "ev",
          confidence: "high",
          confidenceScore: 0.9,
          status: "confirmed",
          isMaterial: true,
          isRequired: true,
        },
        {
          id: "2",
          category: "catalogue",
          fieldName: "item",
          label: "Item",
          rawValue: "I",
          extractedValue: {},
          sourceEvidence: "ev",
          confidence: "high",
          confidenceScore: 0.9,
          status: "unconfirmed",
          isMaterial: true,
          isRequired: false,
        },
      ]);
      expect(stats.totalFields).toBe(2);
      expect(stats.confirmedCount).toBe(1);
      expect(stats.unconfirmedCount).toBe(1);
      expect(stats.materialTotalCount).toBe(2);
      expect(stats.materialUnconfirmedCount).toBe(1);
    });

    it("parseBusinessImportContent produces complete proposal object with initial unconfirmed stats", () => {
      const json = JSON.stringify({
        trade_name: "Test Store",
        primary_phone: "9876543210",
        address_line1: "123 Main Road",
        items: [{ title: "Item 1", price: 50 }],
      });

      const proposal = parseBusinessImportContent(workspaceId, json, "json", "store.json");
      expect(proposal.workspaceId).toBe(workspaceId);
      expect(proposal.sourceFormat).toBe("json");
      expect(proposal.sourceFileName).toBe("store.json");
      expect(proposal.fields.length).toBeGreaterThanOrEqual(4);
      expect(proposal.stats.unconfirmedCount).toBe(proposal.fields.length);
      expect(proposal.stats.confirmedCount).toBe(0);
      expect(proposal.isReadyForProvisioning).toBe(false);
    });
  });
});
