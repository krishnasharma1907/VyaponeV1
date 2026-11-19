/**
 * VyapOne — Business Import Parser & Field Extractor [VO-034]
 *
 * Implements deterministic parsing and confidence-scored extraction from:
 * 1. Structured JSON (VyapOne export, Google Business Profile, CRM)
 * 2. Tabular CSV / TSV (product catalogue or store profile)
 * 3. Unstructured text (OCR transcripts, WhatsApp notes, copied profiles)
 *
 * Strict Invariants:
 * - Every extracted price, timing, and material fact starts in "unconfirmed" state.
 * - Every extracted value is sanitized against formula injection and XSS.
 * - Source evidence is captured for every field.
 */

import { sanitizeFormulaInjection, sanitizeImportText } from "./sanitizer";
import type {
  BusinessImportProposal,
  ExtractedCatalogueItem,
  ImportConfidenceLevel,
  ImportFieldCategory,
  ImportProposalStats,
  ImportReviewField,
  ImportSourceFormat,
} from "./types";

/**
 * Validates 6-digit Indian postal code.
 */
function isValidPostalCode(pin: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pin.trim());
}

/**
 * Validates Indian 10-15 digit phone number.
 */
function isValidPhoneNumber(phone: string): boolean {
  return /^(\+?[0-9]{10,15})$/.test(phone.trim().replace(/[\s-]/g, ""));
}

/**
 * Validates standard 15-char Indian GSTIN.
 */
function isValidGstin(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
    gstin.trim().toUpperCase(),
  );
}

/**
 * Validates standard 10-char Indian PAN.
 */
function isValidPan(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.trim().toUpperCase());
}

/**
 * Parses monetary amount into minor units (paise in INR).
 */
export function parseRupeesToPaise(amountStr: string | number): number {
  if (typeof amountStr === "number") {
    return Math.round(amountStr * 100);
  }
  // Strip currency words/symbols (Rs., Rs, INR, ₹) before stripping non-numeric characters
  const withoutPrefix = String(amountStr)
    .replace(/(?:rs\.?|inr|₹)/gi, "")
    .trim();
  const clean = withoutPrefix.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(clean);
  if (isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

/**
 * Formats minor units (paise) back to readable INR currency string.
 */
export function formatPaiseToRupees(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(rupees);
}

/**
 * Computes aggregated statistics for a proposal's fields.
 */
export function computeProposalStats(fields: ImportReviewField[]): ImportProposalStats {
  const totalFields = fields.length;
  let confirmedCount = 0;
  let unconfirmedCount = 0;
  let rejectedCount = 0;
  let editedCount = 0;
  let materialTotalCount = 0;
  let materialUnconfirmedCount = 0;
  let requiredTotalCount = 0;
  let requiredUnconfirmedCount = 0;
  let hasErrors = false;

  for (const f of fields) {
    if (f.status === "confirmed") confirmedCount++;
    else if (f.status === "unconfirmed") unconfirmedCount++;
    else if (f.status === "rejected") rejectedCount++;
    else if (f.status === "edited") editedCount++;

    if (f.isMaterial) {
      materialTotalCount++;
      if (f.status === "unconfirmed") {
        materialUnconfirmedCount++;
      }
    }

    if (f.isRequired) {
      requiredTotalCount++;
      if (f.status === "unconfirmed" || f.status === "rejected") {
        requiredUnconfirmedCount++;
      }
    }

    if (f.validationError) {
      hasErrors = true;
    }
  }

  const completionPercentage =
    totalFields === 0
      ? 0
      : Math.round(((confirmedCount + editedCount + rejectedCount) / totalFields) * 100);

  return {
    totalFields,
    confirmedCount,
    unconfirmedCount,
    rejectedCount,
    editedCount,
    materialTotalCount,
    materialUnconfirmedCount,
    requiredTotalCount,
    requiredUnconfirmedCount,
    hasErrors,
    completionPercentage,
  };
}

/**
 * Checks whether the staged proposal satisfies all gates for provisioning.
 */
export function evaluateProposalReadiness(fields: ImportReviewField[]): {
  isReady: boolean;
  blockingReasons: string[];
} {
  const blockingReasons: string[] = [];

  // 1. Mandatory fields must be confirmed (or edited) and cannot be rejected or unconfirmed
  const requiredFields = fields.filter((f) => f.isRequired);
  for (const rf of requiredFields) {
    if (rf.status === "unconfirmed") {
      blockingReasons.push(`Required field '${rf.label}' has not been confirmed.`);
    } else if (rf.status === "rejected") {
      blockingReasons.push(`Required field '${rf.label}' was rejected without a replacement.`);
    }

    if (rf.validationError && rf.status !== "rejected") {
      blockingReasons.push(
        `Field '${rf.label}' has an unresolved validation error: ${rf.validationError}`,
      );
    }
  }

  // 2. Material facts (prices, timings, statutory tax) cannot remain silently unconfirmed
  const unconfirmedMaterial = fields.filter((f) => f.isMaterial && f.status === "unconfirmed");
  if (unconfirmedMaterial.length > 0) {
    blockingReasons.push(
      `${unconfirmedMaterial.length} material fact(s) (prices, timings, or statutory numbers) require explicit confirmation.`,
    );
  }

  // 3. Ensure we have at least trade name and primary address
  const hasTradeName = fields.some(
    (f) => f.fieldName === "trade_name" && (f.status === "confirmed" || f.status === "edited"),
  );
  if (!hasTradeName) {
    blockingReasons.push("A confirmed trade name is required.");
  }

  const hasAddress = fields.some(
    (f) => f.fieldName === "address_line1" && (f.status === "confirmed" || f.status === "edited"),
  );
  if (!hasAddress) {
    blockingReasons.push("A confirmed business address is required.");
  }

  return {
    isReady: blockingReasons.length === 0,
    blockingReasons,
  };
}

/**
 * Helper to build an ImportReviewField.
 */
function createReviewField<T>(params: {
  id: string;
  category: ImportFieldCategory;
  fieldName: string;
  label: string;
  rawValue: string;
  extractedValue: T;
  sourceEvidence: string;
  confidence: ImportConfidenceLevel;
  confidenceScore: number;
  isMaterial: boolean;
  isRequired: boolean;
  validationError?: string;
}): ImportReviewField<T> {
  return {
    id: params.id,
    category: params.category,
    fieldName: params.fieldName,
    label: params.label,
    rawValue: params.rawValue,
    extractedValue: params.extractedValue,
    sourceEvidence: params.sourceEvidence,
    confidence: params.confidence,
    confidenceScore: params.confidenceScore,
    status: "unconfirmed", // Core invariant: strictly unconfirmed initially
    isMaterial: params.isMaterial,
    isRequired: params.isRequired,
    validationError: params.validationError,
  };
}

/**
 * Safely parses raw JSON and extracts business review fields.
 */
export function parseJsonImport(rawJson: string): ImportReviewField[] {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new Error(`Invalid JSON format: ${err instanceof Error ? err.message : String(err)}`);
  }

  const fields: ImportReviewField[] = [];

  // Helper to extract string
  const getString = (...keys: string[]): { key: string; value: string } | null => {
    for (const k of keys) {
      if (typeof parsed[k] === "string" && (parsed[k] as string).trim().length > 0) {
        return { key: k, value: sanitizeImportText((parsed[k] as string).trim()) };
      }
    }
    return null;
  };

  // 1. Trade Name (Required, Material)
  const tradeName = getString("trade_name", "tradeName", "name", "business_name", "store_name");
  if (tradeName) {
    fields.push(
      createReviewField({
        id: "field:trade_name",
        category: "identity",
        fieldName: "trade_name",
        label: "Trade Name",
        rawValue: tradeName.value,
        extractedValue: tradeName.value,
        sourceEvidence: `JSON property "${tradeName.key}": "${tradeName.value}"`,
        confidence: "high",
        confidenceScore: 0.95,
        isMaterial: true,
        isRequired: true,
      }),
    );
  }

  // 2. Legal Name
  const legalName = getString("legal_name", "legalName", "registered_name");
  if (legalName) {
    fields.push(
      createReviewField({
        id: "field:legal_name",
        category: "identity",
        fieldName: "legal_name",
        label: "Legal Name",
        rawValue: legalName.value,
        extractedValue: legalName.value,
        sourceEvidence: `JSON property "${legalName.key}": "${legalName.value}"`,
        confidence: "high",
        confidenceScore: 0.9,
        isMaterial: false,
        isRequired: false,
      }),
    );
  }

  // 3. Niche / Category
  const niche = getString("niche_slug", "niche", "category", "business_type");
  const nicheValue = niche ? niche.value.toLowerCase().replace(/\s+/g, "_") : "general_store";
  fields.push(
    createReviewField({
      id: "field:niche_slug",
      category: "identity",
      fieldName: "niche_slug",
      label: "Business Category / Niche",
      rawValue: niche ? niche.value : "general_store",
      extractedValue: nicheValue,
      sourceEvidence: niche
        ? `JSON property "${niche.key}": "${niche.value}"`
        : "Fallback default: general_store",
      confidence: niche ? "high" : "low",
      confidenceScore: niche ? 0.9 : 0.4,
      isMaterial: false,
      isRequired: true,
    }),
  );

  // 4. Description
  const description = getString("description", "about", "bio");
  if (description) {
    fields.push(
      createReviewField({
        id: "field:description",
        category: "identity",
        fieldName: "description",
        label: "Store Description",
        rawValue: description.value,
        extractedValue: description.value,
        sourceEvidence: `JSON property "${description.key}": "${description.value}"`,
        confidence: "high",
        confidenceScore: 0.85,
        isMaterial: false,
        isRequired: false,
      }),
    );
  }

  // 5. Contact Phone (Required, Material)
  const phone = getString("primary_phone", "phone", "mobile", "contact_number", "telephone");
  if (phone) {
    const cleanPhone = phone.value.replace(/[\s-]/g, "");
    const valid = isValidPhoneNumber(cleanPhone);
    fields.push(
      createReviewField({
        id: "field:primary_phone",
        category: "contact",
        fieldName: "primary_phone",
        label: "Primary Phone",
        rawValue: phone.value,
        extractedValue: cleanPhone,
        sourceEvidence: `JSON property "${phone.key}": "${phone.value}"`,
        confidence: valid ? "high" : "medium",
        confidenceScore: valid ? 0.95 : 0.6,
        isMaterial: true,
        isRequired: true,
        validationError: valid ? undefined : "Must be a valid 10-15 digit phone number",
      }),
    );
  }

  // 6. WhatsApp Number
  const whatsapp = getString("whatsapp_number", "whatsapp", "wa_number");
  if (whatsapp) {
    const cleanWa = whatsapp.value.replace(/[\s-]/g, "");
    const valid = isValidPhoneNumber(cleanWa);
    fields.push(
      createReviewField({
        id: "field:whatsapp_number",
        category: "contact",
        fieldName: "whatsapp_number",
        label: "WhatsApp Number",
        rawValue: whatsapp.value,
        extractedValue: cleanWa,
        sourceEvidence: `JSON property "${whatsapp.key}": "${whatsapp.value}"`,
        confidence: valid ? "high" : "medium",
        confidenceScore: valid ? 0.9 : 0.6,
        isMaterial: true,
        isRequired: false,
        validationError: valid ? undefined : "Must be a valid 10-15 digit phone number",
      }),
    );
  }

  // 7. Email
  const email = getString("email", "contact_email");
  if (email) {
    fields.push(
      createReviewField({
        id: "field:email",
        category: "contact",
        fieldName: "email",
        label: "Contact Email",
        rawValue: email.value,
        extractedValue: email.value.toLowerCase(),
        sourceEvidence: `JSON property "${email.key}": "${email.value}"`,
        confidence: "high",
        confidenceScore: 0.9,
        isMaterial: false,
        isRequired: false,
      }),
    );
  }

  // 8. Location & Address (AddressLine1, City, State, PostalCode are Required)
  let addrObj: Record<string, unknown> = {};
  if (typeof parsed.address === "object" && parsed.address !== null) {
    addrObj = parsed.address as Record<string, unknown>;
  } else if (typeof parsed.location === "object" && parsed.location !== null) {
    addrObj = parsed.location as Record<string, unknown>;
  }

  const addr1 =
    (typeof addrObj.address_line1 === "string" && addrObj.address_line1) ||
    (typeof addrObj.line1 === "string" && addrObj.line1) ||
    (typeof addrObj.street === "string" && addrObj.street) ||
    (typeof parsed.address_line1 === "string" && (parsed.address_line1 as string)) ||
    (typeof parsed.address === "string" && (parsed.address as string)) ||
    null;

  if (addr1) {
    const cleanAddr1 = sanitizeImportText(addr1);
    fields.push(
      createReviewField({
        id: "field:address_line1",
        category: "location",
        fieldName: "address_line1",
        label: "Street Address (Line 1)",
        rawValue: addr1,
        extractedValue: cleanAddr1,
        sourceEvidence: `JSON address property: "${cleanAddr1}"`,
        confidence: "high",
        confidenceScore: 0.9,
        isMaterial: true,
        isRequired: true,
      }),
    );
  }

  const city =
    (typeof addrObj.city === "string" && addrObj.city) ||
    (typeof parsed.city === "string" && (parsed.city as string)) ||
    null;
  if (city) {
    const cleanCity = sanitizeImportText(city);
    fields.push(
      createReviewField({
        id: "field:city",
        category: "location",
        fieldName: "city",
        label: "City",
        rawValue: city,
        extractedValue: cleanCity,
        sourceEvidence: `JSON city property: "${cleanCity}"`,
        confidence: "high",
        confidenceScore: 0.95,
        isMaterial: false,
        isRequired: true,
      }),
    );
  }

  const state =
    (typeof addrObj.state === "string" && addrObj.state) ||
    (typeof parsed.state === "string" && (parsed.state as string)) ||
    null;
  if (state) {
    const cleanState = sanitizeImportText(state);
    fields.push(
      createReviewField({
        id: "field:state",
        category: "location",
        fieldName: "state",
        label: "State",
        rawValue: state,
        extractedValue: cleanState,
        sourceEvidence: `JSON state property: "${cleanState}"`,
        confidence: "high",
        confidenceScore: 0.95,
        isMaterial: false,
        isRequired: true,
      }),
    );
  }

  const pin =
    (typeof addrObj.postal_code === "string" && addrObj.postal_code) ||
    (typeof addrObj.pincode === "string" && addrObj.pincode) ||
    (typeof addrObj.zip === "string" && addrObj.zip) ||
    (typeof parsed.postal_code === "string" && (parsed.postal_code as string)) ||
    (typeof parsed.pincode === "string" && (parsed.pincode as string)) ||
    null;
  if (pin) {
    const cleanPin = String(pin).trim();
    const valid = isValidPostalCode(cleanPin);
    fields.push(
      createReviewField({
        id: "field:postal_code",
        category: "location",
        fieldName: "postal_code",
        label: "Postal Code (PIN)",
        rawValue: cleanPin,
        extractedValue: cleanPin,
        sourceEvidence: `JSON postal code property: "${cleanPin}"`,
        confidence: valid ? "high" : "medium",
        confidenceScore: valid ? 0.95 : 0.5,
        isMaterial: true,
        isRequired: true,
        validationError: valid ? undefined : "Must be a valid 6-digit Indian PIN code",
      }),
    );
  }

  // 9. Statutory Tax Identifiers (Material)
  const gst = getString("gst_number", "gstin", "gst");
  if (gst) {
    const upperGst = gst.value.toUpperCase();
    const valid = isValidGstin(upperGst);
    fields.push(
      createReviewField({
        id: "field:gst_number",
        category: "tax",
        fieldName: "gst_number",
        label: "GSTIN Identifier",
        rawValue: gst.value,
        extractedValue: upperGst,
        sourceEvidence: `JSON property "${gst.key}": "${gst.value}"`,
        confidence: valid ? "high" : "medium",
        confidenceScore: valid ? 0.95 : 0.5,
        isMaterial: true,
        isRequired: false,
        validationError: valid ? undefined : "Invalid 15-character GSTIN format",
      }),
    );
  }

  const pan = getString("pan_number", "pan");
  if (pan) {
    const upperPan = pan.value.toUpperCase();
    const valid = isValidPan(upperPan);
    fields.push(
      createReviewField({
        id: "field:pan_number",
        category: "tax",
        fieldName: "pan_number",
        label: "PAN Identifier",
        rawValue: pan.value,
        extractedValue: upperPan,
        sourceEvidence: `JSON property "${pan.key}": "${pan.value}"`,
        confidence: valid ? "high" : "medium",
        confidenceScore: valid ? 0.95 : 0.5,
        isMaterial: true,
        isRequired: false,
        validationError: valid ? undefined : "Invalid 10-character PAN format",
      }),
    );
  }

  // 10. Operational Timings (Material)
  const timingsData = parsed.timings || parsed.hours || parsed.opening_hours;
  if (timingsData && typeof timingsData === "object") {
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    for (const d of days) {
      const dayVal = (timingsData as Record<string, unknown>)[d];
      if (dayVal) {
        let openTime = "09:00";
        let closeTime = "21:00";
        let closed = false;

        if (typeof dayVal === "string") {
          const lower = dayVal.toLowerCase();
          if (lower.includes("close") || lower.includes("off")) {
            closed = true;
          } else {
            const match = dayVal.match(
              /(\d{1,2}(?::\d{2})?)\s*(?:am|pm)?\s*[-–to]\s*(\d{1,2}(?::\d{2})?)\s*(?:am|pm)?/i,
            );
            if (match) {
              openTime = match[1];
              closeTime = match[2];
            }
          }
        } else if (typeof dayVal === "object" && dayVal !== null) {
          const dayObj = dayVal as Record<string, unknown>;
          closed = Boolean(dayObj.closed);
          if (typeof dayObj.open === "string") openTime = dayObj.open;
          if (typeof dayObj.close === "string") closeTime = dayObj.close;
        }

        const timingSummary = closed ? "Closed" : `${openTime} – ${closeTime}`;
        fields.push(
          createReviewField({
            id: `timing:${d}`,
            category: "timings",
            fieldName: `timing_${d}`,
            label: `${d.charAt(0).toUpperCase() + d.slice(1)} Timings`,
            rawValue: typeof dayVal === "string" ? dayVal : JSON.stringify(dayVal),
            extractedValue: { open: openTime, close: closeTime, closed },
            sourceEvidence: `JSON timing for ${d}: "${timingSummary}"`,
            confidence: "high",
            confidenceScore: 0.9,
            isMaterial: true,
            isRequired: false,
          }),
        );
      }
    }
  }

  // 11. Catalogue / Menu Items (Material Prices)
  const rawItems = parsed.items || parsed.products || parsed.catalogue || parsed.menu;
  if (Array.isArray(rawItems)) {
    rawItems.forEach((it, idx) => {
      if (typeof it === "object" && it !== null) {
        const itemObj = it as Record<string, unknown>;
        const title =
          (typeof itemObj.title === "string" && itemObj.title) ||
          (typeof itemObj.name === "string" && itemObj.name) ||
          `Item #${idx + 1}`;
        const rawPrice = itemObj.price ?? itemObj.rate ?? itemObj.amount ?? 0;
        const priceMinor = parseRupeesToPaise(rawPrice as string | number);
        const description =
          typeof itemObj.description === "string" ? sanitizeImportText(itemObj.description) : "";
        const category =
          typeof itemObj.category === "string" ? sanitizeImportText(itemObj.category) : "";
        const sku = typeof itemObj.sku === "string" ? sanitizeImportText(itemObj.sku) : "";

        const cleanTitle = sanitizeImportText(title);

        const catalogueItem: ExtractedCatalogueItem = {
          title: cleanTitle,
          priceMinor,
          currencyCode: "INR",
          description,
          category,
          sku,
        };

        fields.push(
          createReviewField({
            id: `item:${idx}`,
            category: "catalogue",
            fieldName: "catalogue_item",
            label: `Catalogue Item: ${cleanTitle}`,
            rawValue: `${cleanTitle} — ${formatPaiseToRupees(priceMinor)}`,
            extractedValue: catalogueItem,
            sourceEvidence: `JSON item #${idx + 1}: "${cleanTitle}" at ${formatPaiseToRupees(priceMinor)}`,
            confidence: "high",
            confidenceScore: 0.95,
            isMaterial: true, // Invariant: Prices are material facts
            isRequired: false,
            validationError: priceMinor < 0 ? "Price cannot be negative" : undefined,
          }),
        );
      }
    });
  }

  return fields;
}

/**
 * Splits CSV lines safely, handling escaped quotes and delimiter detection (, or \t or ;).
 */
export function splitCsvLines(csvText: string): string[][] {
  const lines: string[][] = [];
  const cleanText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = cleanText.split("\n");

  for (const rawLine of rawLines) {
    if (rawLine.trim().length === 0) continue;

    const row: string[] = [];
    let insideQuotes = false;
    let currentCell = "";

    // Determine separator: default comma, check semicolon or tab if no comma present
    let sep = ",";
    if (!rawLine.includes(",") && rawLine.includes("\t")) {
      sep = "\t";
    } else if (!rawLine.includes(",") && rawLine.includes(";")) {
      sep = ";";
    }

    for (let i = 0; i < rawLine.length; i++) {
      const char = rawLine[i];
      if (char === '"') {
        if (insideQuotes && rawLine[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === sep && !insideQuotes) {
        row.push(sanitizeFormulaInjection(currentCell.trim()));
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    row.push(sanitizeFormulaInjection(currentCell.trim()));
    lines.push(row);
  }

  return lines;
}

/**
 * Safely parses CSV text into business review fields.
 */
export function parseCsvImport(rawCsv: string): ImportReviewField[] {
  const rows = splitCsvLines(rawCsv);
  if (rows.length === 0) {
    throw new Error("CSV file contains no data rows.");
  }

  const fields: ImportReviewField[] = [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, "_"));

  // Check if this CSV represents catalogue items or store profile
  const isCatalogueCsv =
    header.some((h) => ["item", "product", "title", "dish", "service", "menu_item"].includes(h)) &&
    header.some((h) => ["price", "rate", "cost", "amount", "mrp"].includes(h));

  if (isCatalogueCsv) {
    const titleIdx = header.findIndex((h) =>
      ["item", "product", "title", "dish", "service", "name", "menu_item"].includes(h),
    );
    const priceIdx = header.findIndex((h) =>
      ["price", "rate", "cost", "amount", "mrp"].includes(h),
    );
    const descIdx = header.findIndex((h) => ["description", "desc", "details", "info"].includes(h));
    const catIdx = header.findIndex((h) => ["category", "section", "group", "type"].includes(h));
    const skuIdx = header.findIndex((h) => ["sku", "code", "barcode", "id"].includes(h));

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const rawTitle = titleIdx >= 0 && row[titleIdx] ? row[titleIdx] : "";
      if (!rawTitle) continue;

      const cleanTitle = sanitizeImportText(rawTitle);
      const rawPrice = priceIdx >= 0 && row[priceIdx] ? row[priceIdx] : "0";
      const priceMinor = parseRupeesToPaise(rawPrice);
      const description = descIdx >= 0 && row[descIdx] ? sanitizeImportText(row[descIdx]) : "";
      const category = catIdx >= 0 && row[catIdx] ? sanitizeImportText(row[catIdx]) : "";
      const sku = skuIdx >= 0 && row[skuIdx] ? sanitizeImportText(row[skuIdx]) : "";

      const catalogueItem: ExtractedCatalogueItem = {
        title: cleanTitle,
        priceMinor,
        currencyCode: "INR",
        description,
        category,
        sku,
      };

      fields.push(
        createReviewField({
          id: `item:${r - 1}`,
          category: "catalogue",
          fieldName: "catalogue_item",
          label: `Catalogue Item: ${cleanTitle}`,
          rawValue: `${cleanTitle} — ${formatPaiseToRupees(priceMinor)}`,
          extractedValue: catalogueItem,
          sourceEvidence: `CSV row #${r + 1}: "${row.join(", ")}"`,
          confidence: "high",
          confidenceScore: 0.9,
          isMaterial: true, // Invariant: Prices are material facts
          isRequired: false,
          validationError: priceMinor < 0 ? "Price cannot be negative" : undefined,
        }),
      );
    }
  } else {
    // Business profile row extraction (first data row)
    const dataRow = rows[1] || rows[0];
    const getCol = (...names: string[]): { name: string; val: string } | null => {
      for (const n of names) {
        const idx = header.findIndex((h) => h.includes(n));
        if (idx >= 0 && dataRow[idx] && dataRow[idx].trim().length > 0) {
          return { name: header[idx], val: sanitizeImportText(dataRow[idx]) };
        }
      }
      return null;
    };

    const trade = getCol("trade", "shop", "store", "business", "name");
    if (trade) {
      fields.push(
        createReviewField({
          id: "field:trade_name",
          category: "identity",
          fieldName: "trade_name",
          label: "Trade Name",
          rawValue: trade.val,
          extractedValue: trade.val,
          sourceEvidence: `CSV column "${trade.name}": "${trade.val}"`,
          confidence: "high",
          confidenceScore: 0.9,
          isMaterial: true,
          isRequired: true,
        }),
      );
    }

    const phone = getCol("phone", "mobile", "contact", "tel");
    if (phone) {
      const cleanPhone = phone.val.replace(/[\s-]/g, "");
      const valid = isValidPhoneNumber(cleanPhone);
      fields.push(
        createReviewField({
          id: "field:primary_phone",
          category: "contact",
          fieldName: "primary_phone",
          label: "Primary Phone",
          rawValue: phone.val,
          extractedValue: cleanPhone,
          sourceEvidence: `CSV column "${phone.name}": "${phone.val}"`,
          confidence: valid ? "high" : "medium",
          confidenceScore: valid ? 0.9 : 0.6,
          isMaterial: true,
          isRequired: true,
          validationError: valid ? undefined : "Must be a valid 10-15 digit phone number",
        }),
      );
    }

    const addr = getCol("address", "street", "addr", "location");
    if (addr) {
      fields.push(
        createReviewField({
          id: "field:address_line1",
          category: "location",
          fieldName: "address_line1",
          label: "Street Address (Line 1)",
          rawValue: addr.val,
          extractedValue: addr.val,
          sourceEvidence: `CSV column "${addr.name}": "${addr.val}"`,
          confidence: "high",
          confidenceScore: 0.85,
          isMaterial: true,
          isRequired: true,
        }),
      );
    }

    const city = getCol("city", "town", "district");
    if (city) {
      fields.push(
        createReviewField({
          id: "field:city",
          category: "location",
          fieldName: "city",
          label: "City",
          rawValue: city.val,
          extractedValue: city.val,
          sourceEvidence: `CSV column "${city.name}": "${city.val}"`,
          confidence: "high",
          confidenceScore: 0.9,
          isMaterial: false,
          isRequired: true,
        }),
      );
    }

    const state = getCol("state", "province");
    if (state) {
      fields.push(
        createReviewField({
          id: "field:state",
          category: "location",
          fieldName: "state",
          label: "State",
          rawValue: state.val,
          extractedValue: state.val,
          sourceEvidence: `CSV column "${state.name}": "${state.val}"`,
          confidence: "high",
          confidenceScore: 0.9,
          isMaterial: false,
          isRequired: true,
        }),
      );
    }

    const pin = getCol("pin", "postal", "zip");
    if (pin) {
      const cleanPin = pin.val.trim();
      const valid = isValidPostalCode(cleanPin);
      fields.push(
        createReviewField({
          id: "field:postal_code",
          category: "location",
          fieldName: "postal_code",
          label: "Postal Code (PIN)",
          rawValue: cleanPin,
          extractedValue: cleanPin,
          sourceEvidence: `CSV column "${pin.name}": "${cleanPin}"`,
          confidence: valid ? "high" : "medium",
          confidenceScore: valid ? 0.9 : 0.5,
          isMaterial: true,
          isRequired: true,
          validationError: valid ? undefined : "Must be a valid 6-digit Indian PIN code",
        }),
      );
    }
  }

  return fields;
}

/**
 * Parses unstructured text (e.g. copied text, WhatsApp message, OCR note).
 */
export function parseTextImport(rawText: string): ImportReviewField[] {
  const fields: ImportReviewField[] = [];
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Phone extraction
  const phoneRegex = /(?:(?:\+?91[\-\s]?)?[6-9]\d{9})/g;
  const phoneMatches = rawText.match(phoneRegex);
  if (phoneMatches && phoneMatches.length > 0) {
    const rawPhone = phoneMatches[0];
    const cleanPhone = rawPhone.replace(/[\s-]/g, "");
    const matchingLine = lines.find((l) => l.includes(rawPhone)) || rawPhone;
    fields.push(
      createReviewField({
        id: "field:primary_phone",
        category: "contact",
        fieldName: "primary_phone",
        label: "Primary Phone",
        rawValue: rawPhone,
        extractedValue: cleanPhone,
        sourceEvidence: `Extracted from text: "${matchingLine}"`,
        confidence: "medium",
        confidenceScore: 0.8,
        isMaterial: true,
        isRequired: true,
      }),
    );
  }

  // 2. GSTIN extraction
  const gstinRegex = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/g;
  const gstMatches = rawText.match(gstinRegex);
  if (gstMatches && gstMatches.length > 0) {
    const gstin = gstMatches[0].toUpperCase();
    const matchingLine = lines.find((l) => l.toUpperCase().includes(gstin)) || gstin;
    fields.push(
      createReviewField({
        id: "field:gst_number",
        category: "tax",
        fieldName: "gst_number",
        label: "GSTIN Identifier",
        rawValue: gstin,
        extractedValue: gstin,
        sourceEvidence: `Extracted GSTIN from line: "${matchingLine}"`,
        confidence: "high",
        confidenceScore: 0.95,
        isMaterial: true,
        isRequired: false,
      }),
    );
  }

  // 3. PAN extraction
  const panRegex = /\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/g;
  const panMatches = rawText.match(panRegex);
  if (panMatches && panMatches.length > 0) {
    // Ensure we don't accidentally pick up a subpart of GSTIN
    const nonGstPan = panMatches.find((p) => !gstMatches || !gstMatches.some((g) => g.includes(p)));
    if (nonGstPan) {
      const pan = nonGstPan.toUpperCase();
      const matchingLine = lines.find((l) => l.toUpperCase().includes(pan)) || pan;
      fields.push(
        createReviewField({
          id: "field:pan_number",
          category: "tax",
          fieldName: "pan_number",
          label: "PAN Identifier",
          rawValue: pan,
          extractedValue: pan,
          sourceEvidence: `Extracted PAN from line: "${matchingLine}"`,
          confidence: "high",
          confidenceScore: 0.9,
          isMaterial: true,
          isRequired: false,
        }),
      );
    }
  }

  // 4. Postal Code (PIN) extraction
  const pinRegex = /\b([1-9][0-9]{5})\b/g;
  const pinMatches = rawText.match(pinRegex);
  if (pinMatches && pinMatches.length > 0) {
    const pin = pinMatches[0];
    const matchingLine = lines.find((l) => l.includes(pin)) || pin;
    fields.push(
      createReviewField({
        id: "field:postal_code",
        category: "location",
        fieldName: "postal_code",
        label: "Postal Code (PIN)",
        rawValue: pin,
        extractedValue: pin,
        sourceEvidence: `Extracted PIN from line: "${matchingLine}"`,
        confidence: "medium",
        confidenceScore: 0.75,
        isMaterial: true,
        isRequired: true,
      }),
    );
  }

  // 5. Email extraction
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const emailMatches = rawText.match(emailRegex);
  if (emailMatches && emailMatches.length > 0) {
    const email = emailMatches[0].toLowerCase();
    const matchingLine = lines.find((l) => l.toLowerCase().includes(email)) || email;
    fields.push(
      createReviewField({
        id: "field:email",
        category: "contact",
        fieldName: "email",
        label: "Contact Email",
        rawValue: email,
        extractedValue: email,
        sourceEvidence: `Extracted email from line: "${matchingLine}"`,
        confidence: "high",
        confidenceScore: 0.9,
        isMaterial: false,
        isRequired: false,
      }),
    );
  }

  // 6. Timings pattern extraction (e.g. "Mon-Sat: 10am to 9pm" or "Open daily 9:00 - 22:00")
  const timingRegex =
    /(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\s*[-–to]\s*(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*|daily|open)\s*[:\-]?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–to]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  const timingMatch = rawText.match(timingRegex);
  if (timingMatch) {
    const fullTimingText = timingMatch[0];
    fields.push(
      createReviewField({
        id: "timing:general",
        category: "timings",
        fieldName: "operating_hours",
        label: "Operating Hours",
        rawValue: fullTimingText,
        extractedValue: { raw: fullTimingText },
        sourceEvidence: `Extracted hours from text: "${fullTimingText}"`,
        confidence: "medium",
        confidenceScore: 0.7,
        isMaterial: true, // Invariant: Timings are material facts
        isRequired: false,
      }),
    );
  }

  // 7. Menu / Price line extraction (e.g. "Paneer Tikka - ₹240" or "Masala Dosa ... Rs 80")
  let itemCounter = 0;
  for (const line of lines) {
    const priceLineMatch = line.match(
      /^([A-Za-z0-9\s&'()\-]+?)\s*[-:—.]+\s*(?:₹|Rs\.?|INR)?\s*(\d+(?:\.\d{2})?)$/i,
    );
    if (priceLineMatch) {
      const itemName = sanitizeImportText(priceLineMatch[1]);
      const rawPrice = priceLineMatch[2];
      const priceMinor = parseRupeesToPaise(rawPrice);

      if (itemName.length > 1 && priceMinor > 0) {
        const catalogueItem: ExtractedCatalogueItem = {
          title: itemName,
          priceMinor,
          currencyCode: "INR",
        };

        fields.push(
          createReviewField({
            id: `item:${itemCounter++}`,
            category: "catalogue",
            fieldName: "catalogue_item",
            label: `Catalogue Item: ${itemName}`,
            rawValue: `${itemName} — ${formatPaiseToRupees(priceMinor)}`,
            extractedValue: catalogueItem,
            sourceEvidence: `Extracted from line: "${line}"`,
            confidence: "medium",
            confidenceScore: 0.75,
            isMaterial: true, // Invariant: Prices are material facts
            isRequired: false,
          }),
        );
      }
    }
  }

  // 8. First line heuristic for trade name if not already extracted
  if (lines.length > 0 && !fields.some((f) => f.fieldName === "trade_name")) {
    const firstLine = sanitizeImportText(lines[0]);
    if (firstLine.length >= 3 && firstLine.length <= 100 && !phoneRegex.test(firstLine)) {
      fields.unshift(
        createReviewField({
          id: "field:trade_name",
          category: "identity",
          fieldName: "trade_name",
          label: "Trade Name",
          rawValue: firstLine,
          extractedValue: firstLine,
          sourceEvidence: `Proposed from header line: "${firstLine}"`,
          confidence: "medium",
          confidenceScore: 0.65,
          isMaterial: true,
          isRequired: true,
        }),
      );
    }
  }

  return fields;
}

/**
 * Primary parser dispatcher: converts raw string content into an ImportReviewProposal.
 */
export function parseBusinessImportContent(
  workspaceId: string,
  content: string,
  format: ImportSourceFormat,
  sourceFileName?: string,
): BusinessImportProposal {
  if (!content || content.trim().length === 0) {
    throw new Error("Import content cannot be empty.");
  }

  let fields: ImportReviewField[] = [];

  switch (format) {
    case "json":
      fields = parseJsonImport(content);
      break;
    case "csv":
      fields = parseCsvImport(content);
      break;
    case "text":
      fields = parseTextImport(content);
      break;
    default:
      throw new Error(`Unsupported import format: ${String(format)}`);
  }

  const stats = computeProposalStats(fields);
  const readiness = evaluateProposalReadiness(fields);

  return {
    id: `proposal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    workspaceId,
    sourceFormat: format,
    sourceFileName,
    createdAt: new Date().toISOString(),
    fields,
    stats,
    isReadyForProvisioning: readiness.isReady,
    blockingReasons: readiness.blockingReasons,
  };
}
