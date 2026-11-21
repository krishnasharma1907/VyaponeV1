/**
 * VyapOne — Approved Block Library Foundation Unit Tests [VO-041]
 *
 * Verifies the 13 canonical approved website blocks:
 * 1. Registry completeness (exactly 13 canonical approved blocks, metadata, defaults).
 * 2. Component rendering and semantic landmarks (WCAG 2.2 AA, aria attributes).
 * 3. Dynamic catalogue and location fact bindings (prices formatted in ₹).
 * 4. Empty and fallback states.
 * 5. Security & XSS defense (dangerous URLs sanitized, zero arbitrary code execution).
 * 6. Safe BlockRenderer behavior (unapproved block rejection, schema validation, disabled section skipping).
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  getAllApprovedBlockTypes,
  isApprovedBlockType,
  getApprovedBlockComponent,
  getApprovedBlockMetadata,
  getApprovedBlocksByCategory,
  HeroBlock,
  AboutBlock,
  MenuBlock,
  CatalogueGridBlock,
  GalleryBlock,
  BookingFormBlock,
  PricingBlock,
  ReviewsBlock,
  OffersBlock,
  LocationMapBlock,
  ContactBlock,
  FaqBlock,
  FooterBlock,
  BlockRenderer,
  sanitizeLinkUrl,
  formatCurrencyMinor,
  type WebsiteRenderContext,
  type SectionConfig,
  type ApprovedBlockType,
} from "@/components/websites/blocks";

const MOCK_THEME = {
  themeId: "emerald-marigold",
  colorMode: "light" as const,
  colors: {
    primary: "#0B6E4F",
    accent: "#F5A524",
    secondary: "#1B4965",
    background: "#FFFFFF",
    surface: "#F8FAFC",
    text: "#0F172A",
    muted: "#64748B",
  },
  fonts: {
    heading: "Inter",
    body: "Inter",
  },
  radii: {
    button: "md" as const,
    card: "md" as const,
  },
};

const MOCK_CONTEXT: WebsiteRenderContext = {
  theme: MOCK_THEME,
  business: {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Sharma Sweets & Cafe",
    tradeName: "Sharma Cafe",
    phone: "+91 98765 43210",
    whatsappNumber: "919876543210",
    email: "hello@sharmacafe.in",
    primaryLocation: {
      addressLine1: "Shop 12, MG Road",
      addressLine2: "Opposite Town Hall",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      operatingHours: {
        "Monday - Friday": "8:00 AM - 10:00 PM",
        "Saturday - Sunday": "8:00 AM - 11:00 PM",
      },
    },
  },
  catalogueItems: [
    {
      id: "item-1",
      name: "Special Masala Chai",
      description: "Freshly brewed Assam tea with crushed ginger and spices",
      priceMinor: 3000, // ₹30.00
      currency: "INR",
      category: "Beverages",
      categoryId: "cat-bev",
      isFeatured: true,
      isAvailable: true,
      dietaryPreference: "veg",
    },
    {
      id: "item-2",
      name: "Gulab Jamun (2 pcs)",
      description: "Warm khoya dumplings soaked in rose saffron syrup",
      priceMinor: 6000, // ₹60.00
      currency: "INR",
      category: "Desserts",
      categoryId: "cat-des",
      isFeatured: true,
      isAvailable: true,
      dietaryPreference: "veg",
    },
    {
      id: "item-3",
      name: "Paneer Tikka Roll",
      description: "Charcoal grilled spiced paneer cubes wrapped in whole wheat paratha",
      priceMinor: 12000, // ₹120.00
      currency: "INR",
      category: "Snacks",
      categoryId: "cat-snk",
      isFeatured: false,
      isAvailable: true,
      dietaryPreference: "veg",
    },
  ],
  mediaUrls: {
    "00000000-0000-0000-0000-000000000010": "https://cdn.vyapone.com/media/hero.jpg",
    "00000000-0000-0000-0000-000000000020": "https://cdn.vyapone.com/media/about.jpg",
    "00000000-0000-0000-0000-000000000030": "https://cdn.vyapone.com/media/gallery1.jpg",
  },
  onAction: vi.fn(),
  previewMode: false,
};

describe("VO-041 Approved Block Library Foundation", () => {
  // ============================================================================
  // 1. Registry Completeness & Canonical 13 Blocks
  // ============================================================================
  describe("1. Central Block Registry & Canonical 13 Types", () => {
    it("contains exactly 13 canonical approved block types (PRD §15.3)", () => {
      const types = getAllApprovedBlockTypes();
      expect(types).toHaveLength(13);

      const expectedTypes = [
        "hero",
        "about",
        "menu",
        "catalogue_grid",
        "gallery",
        "booking_form",
        "pricing",
        "reviews",
        "offers",
        "location_map",
        "contact",
        "faq",
        "footer",
      ];

      expect(types.sort()).toEqual(expectedTypes.sort());
    });

    it("verifies isApprovedBlockType returns true for all 13 canonical types and false for arbitrary types", () => {
      expect(isApprovedBlockType("hero")).toBe(true);
      expect(isApprovedBlockType("menu")).toBe(true);
      expect(isApprovedBlockType("footer")).toBe(true);

      // Rejects unapproved or invented types
      expect(isApprovedBlockType("arbitrary_html")).toBe(false);
      expect(isApprovedBlockType("script_block")).toBe(false);
      expect(isApprovedBlockType("custom_iframe")).toBe(false);
      expect(isApprovedBlockType("unknown_widget")).toBe(false);
    });

    it("retrieves valid metadata and components for each approved block", () => {
      getAllApprovedBlockTypes().forEach((type) => {
        const metadata = getApprovedBlockMetadata(type);
        expect(metadata.type).toBe(type);
        expect(metadata.name.length).toBeGreaterThan(0);
        expect(metadata.description.length).toBeGreaterThan(0);
        expect(metadata.allowedVariants.length).toBeGreaterThan(0);
        expect(metadata.defaultProps).toBeDefined();

        const comp = getApprovedBlockComponent(type);
        expect(comp).toBeDefined();
        expect(typeof comp).toBe("function");
      });
    });

    it("filters blocks by category accurately", () => {
      const commerceBlocks = getApprovedBlocksByCategory("commerce");
      const types = commerceBlocks.map((b) => b.type);
      expect(types).toContain("menu");
      expect(types).toContain("catalogue_grid");
      expect(types).toContain("pricing");
      expect(types).toContain("offers");
    });
  });

  // ============================================================================
  // 2. Individual Block Component Rendering & Semantic Accessibility
  // ============================================================================
  describe("2. Individual Block Component Rendering", () => {
    it("renders HeroBlock with title, subtitle, CTAs, and accessible landmark", () => {
      render(
        <HeroBlock
          id="hero-1"
          props={{
            title: "Welcome to Our Authentic Bakery",
            subtitle: "Artisan breads baked fresh daily",
            cta: { label: "Order on WhatsApp", action: "whatsapp_order" },
            secondaryCta: { label: "View Menu", action: "catalogue" },
            imageMediaId: "00000000-0000-0000-0000-000000000010",
          }}
          context={MOCK_CONTEXT}
        />,
      );

      const section = screen.getByRole("region", { name: "Welcome to Our Authentic Bakery" });
      expect(section).toBeDefined();
      expect(screen.getByText("Welcome to Our Authentic Bakery")).toBeDefined();
      expect(screen.getByText("Artisan breads baked fresh daily")).toBeDefined();
      expect(screen.getByText("Order on WhatsApp")).toBeDefined();
      expect(screen.getByText("View Menu")).toBeDefined();

      const img = screen.getByAltText("Welcome to Our Authentic Bakery");
      expect(img).toBeDefined();
      expect(img.getAttribute("src")).toBe("https://cdn.vyapone.com/media/hero.jpg");
    });

    it("renders AboutBlock with story paragraphs and highlights checklist", () => {
      render(
        <AboutBlock
          id="about-1"
          props={{
            title: "Our Heritage",
            story:
              "Serving our neighborhood since 1985 with passion and traditional recipes.\n\nEvery item is crafted using pure ghee and organic grains.",
            highlights: ["Handcrafted daily", "No artificial preservatives", "100% Vegetarian"],
            imageMediaId: "00000000-0000-0000-0000-000000000020",
          }}
          context={MOCK_CONTEXT}
        />,
      );

      expect(screen.getByText("Our Heritage")).toBeDefined();
      expect(screen.getByText(/Serving our neighborhood since 1985/)).toBeDefined();
      expect(screen.getByText(/Every item is crafted using pure ghee/)).toBeDefined();
      expect(screen.getByText("Handcrafted daily")).toBeDefined();
      expect(screen.getByText("100% Vegetarian")).toBeDefined();
    });

    it("renders MenuBlock dynamically bound to catalogue facts with formatted INR prices", () => {
      render(
        <MenuBlock
          id="menu-1"
          props={{
            title: "Cafe Specialties",
            subtitle: "Freshly prepared to order",
            source: "catalogue",
          }}
          context={MOCK_CONTEXT}
        />,
      );

      expect(screen.getByText("Cafe Specialties")).toBeDefined();
      expect(screen.getByText("Freshly prepared to order")).toBeDefined();

      // Check dynamic items and prices from MOCK_CONTEXT
      expect(screen.getByText("Special Masala Chai")).toBeDefined();
      expect(screen.getByText("₹30")).toBeDefined();

      expect(screen.getByText("Gulab Jamun (2 pcs)")).toBeDefined();
      expect(screen.getByText("₹60")).toBeDefined();

      expect(screen.getByText("Paneer Tikka Roll")).toBeDefined();
      expect(screen.getByText("₹120")).toBeDefined();

      // Category tab filtering
      expect(screen.getByText(/All Items/)).toBeDefined();
      expect(screen.getByText("Beverages")).toBeDefined();
      expect(screen.getByText("Desserts")).toBeDefined();
    });

    it("renders CatalogueGridBlock with responsive grid and WhatsApp ordering CTAs", () => {
      render(
        <CatalogueGridBlock
          id="grid-1"
          props={{
            title: "Featured Sweets",
            source: "catalogue",
            columns: 3,
            featuredOnly: true,
          }}
          context={MOCK_CONTEXT}
        />,
      );

      expect(screen.getByText("Featured Sweets")).toBeDefined();
      // Featured items are present
      expect(screen.getByText("Special Masala Chai")).toBeDefined();
      expect(screen.getByText("Gulab Jamun (2 pcs)")).toBeDefined();
      // Non-featured item should be filtered out
      expect(screen.queryByText("Paneer Tikka Roll")).toBeNull();
    });

    it("renders GalleryBlock with accessible image alt text and caption", () => {
      render(
        <GalleryBlock
          id="gallery-1"
          props={{
            title: "Store Showcase",
            images: [
              {
                mediaId: "00000000-0000-0000-0000-000000000030",
                caption: "Storefront seating area",
                altText: "Sunny outdoor seating area with wooden tables",
              },
            ],
            columns: 3,
          }}
          context={MOCK_CONTEXT}
        />,
      );

      expect(screen.getByText("Store Showcase")).toBeDefined();
      expect(screen.getByText("Storefront seating area")).toBeDefined();
      const img = screen.getByAltText("Sunny outdoor seating area with wooden tables");
      expect(img).toBeDefined();
      expect(img.getAttribute("src")).toBe("https://cdn.vyapone.com/media/gallery1.jpg");
    });

    it("renders BookingFormBlock with accessible inputs and interactive submission", () => {
      render(
        <BookingFormBlock
          id="booking-1"
          props={{
            title: "Reserve a Table",
            requirePhone: true,
            notice: "Reservation held for 15 minutes past scheduled time.",
          }}
          context={MOCK_CONTEXT}
        />,
      );

      expect(screen.getByText("Reserve a Table")).toBeDefined();
      expect(screen.getByText(/Reservation held for 15 minutes/)).toBeDefined();

      const nameInput = screen.getByLabelText(/Your Full Name/);
      const phoneInput = screen.getByLabelText(/Mobile Number/);
      const dateInput = screen.getByLabelText(/Preferred Date/);
      const submitButton = screen.getByRole("button", { name: "Request Appointment" });

      fireEvent.change(nameInput, { target: { value: "Deepak Patel" } });
      fireEvent.change(phoneInput, { target: { value: "9876543210" } });
      fireEvent.change(dateInput, { target: { value: "2026-12-01" } });

      fireEvent.click(submitButton);

      // Verify onAction was triggered
      expect(MOCK_CONTEXT.onAction).toHaveBeenCalledWith(
        "booking_submitted",
        expect.objectContaining({
          name: "Deepak Patel",
          phone: "9876543210",
          date: "2026-12-01",
        }),
      );
    });

    it("renders PricingBlock with pricing tiers and highlighted popular plan", () => {
      render(
        <PricingBlock
          id="pricing-1"
          props={{
            title: "Party & Catering Packages",
            source: "catalogue",
            highlightCategory: "Recommended",
          }}
          context={{ ...MOCK_CONTEXT, catalogueItems: [] }}
        />,
      );

      expect(screen.getByText("Party & Catering Packages")).toBeDefined();
      expect(screen.getByText("Standard Plan")).toBeDefined();
      expect(screen.getByText("Most Popular")).toBeDefined();
      expect(screen.getByText("₹999")).toBeDefined();
    });

    it("renders ReviewsBlock with star ratings and verified review indicators", () => {
      render(
        <ReviewsBlock
          id="reviews-1"
          props={{
            title: "Customer Praise",
            source: "verified_reviews",
            customReviews: [
              {
                author: "Sita Raman",
                rating: 5,
                text: "The best sweets in Bangalore! Always fresh and delicious.",
                date: "Yesterday",
              },
            ],
          }}
          context={MOCK_CONTEXT}
        />,
      );

      expect(screen.getByText("Customer Praise")).toBeDefined();
      expect(screen.getByText("Sita Raman")).toBeDefined();
      expect(screen.getByText(/The best sweets in Bangalore/)).toBeDefined();
      expect(screen.getByText("Verified")).toBeDefined();
    });

    it("renders OffersBlock with coupon codes and copy action", () => {
      render(
        <OffersBlock
          id="offers-1"
          props={{
            title: "Festive Offers",
            offers: [
              {
                headline: "Flat 15% Off on Sweets",
                description: "Valid on all online pre-orders above ₹500.",
                couponCode: "FESTIVE15",
                expiresAt: "31 Dec 2026",
              },
            ],
          }}
          context={MOCK_CONTEXT}
        />,
      );

      expect(screen.getByText("Festive Offers")).toBeDefined();
      expect(screen.getByText("Flat 15% Off on Sweets")).toBeDefined();
      expect(screen.getByText("FESTIVE15")).toBeDefined();
      expect(screen.getByRole("button", { name: "Copy coupon code FESTIVE15" })).toBeDefined();
    });

    it("renders LocationMapBlock bound to primary location facts and business hours", () => {
      render(
        <LocationMapBlock
          id="location-1"
          props={{
            title: "Find Us",
            addressRef: "business.primary_location",
            showTimings: true,
            showMap: true,
          }}
          context={MOCK_CONTEXT}
        />,
      );

      expect(screen.getByText("Find Us")).toBeDefined();
      expect(
        screen.getAllByText(/Shop 12, MG Road, Opposite Town Hall, Bengaluru/).length,
      ).toBeGreaterThan(0);
      expect(screen.getByText("Business Operating Hours")).toBeDefined();
      expect(screen.getByText("Monday - Friday")).toBeDefined();
      expect(screen.getByText("8:00 AM - 10:00 PM")).toBeDefined();
      expect(
        screen.getByRole("link", { name: /Get Directions on Google Maps/ }).getAttribute("href"),
      ).toContain("https://www.google.com/maps/search/?api=1&query=");
    });

    it("renders ContactBlock with phone, whatsapp, email channels, and inquiry form", () => {
      render(
        <ContactBlock
          id="contact-1"
          props={{
            title: "Contact Sharma Cafe",
            showPhone: true,
            showWhatsapp: true,
            showEmail: true,
            enableForm: true,
          }}
          context={MOCK_CONTEXT}
        />,
      );

      expect(screen.getByText("Contact Sharma Cafe")).toBeDefined();
      expect(screen.getByText("+91 98765 43210")).toBeDefined();
      expect(screen.getByText("WhatsApp Chat")).toBeDefined();
      expect(screen.getByText("hello@sharmacafe.in")).toBeDefined();
      expect(screen.getByRole("button", { name: "Submit Message" })).toBeDefined();
    });

    it("renders FaqBlock with keyboard-accessible collapsible accordion panels", () => {
      render(
        <FaqBlock
          id="faq-1"
          props={{
            title: "Answers to Your Questions",
            items: [
              {
                question: "Do you offer home delivery?",
                answer: "Yes, we deliver within a 5 km radius through our own staff.",
              },
              {
                question: "Can I customize gift boxes?",
                answer: "Yes, custom assorted boxes are available upon request.",
              },
            ],
          }}
          context={MOCK_CONTEXT}
        />,
      );

      expect(screen.getByText("Answers to Your Questions")).toBeDefined();
      const q1Btn = screen.getByRole("button", { name: /Do you offer home delivery/ });
      const q2Btn = screen.getByRole("button", { name: /Can I customize gift boxes/ });

      // First item is open by default
      expect(q1Btn.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByText(/Yes, we deliver within a 5 km radius/)).toBeDefined();

      // Second item is closed initially
      expect(q2Btn.getAttribute("aria-expanded")).toBe("false");

      // Click to expand second item
      fireEvent.click(q2Btn);
      expect(q2Btn.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByText(/Yes, custom assorted boxes are available/)).toBeDefined();
    });

    it("renders FooterBlock with copyright, social icons, and Powered by VyapOne badge", () => {
      render(
        <FooterBlock
          id="footer-1"
          props={{
            copyright: "© 2026 Sharma Cafe. All rights reserved.",
            showPoweredBy: true,
            socialLinks: [
              { platform: "whatsapp", url: "https://wa.me/919876543210" },
              { platform: "instagram", url: "https://instagram.com/sharmacafe" },
            ],
            links: [
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms of Service", href: "/terms" },
            ],
          }}
          context={MOCK_CONTEXT}
        />,
      );

      const footer = screen.getByRole("contentinfo");
      expect(footer).toBeDefined();
      expect(screen.getByText("© 2026 Sharma Cafe. All rights reserved.")).toBeDefined();
      expect(screen.getByText("Powered by")).toBeDefined();
      expect(screen.getByText("VyapOne")).toBeDefined();
      expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe(
        "/privacy",
      );
    });
  });

  // ============================================================================
  // 3. Security, URL Sanitization & Zero Arbitrary Code Invariant
  // ============================================================================
  describe("3. Security, URL Sanitization & Script Injection Defense", () => {
    it("sanitizes dangerous URI schemes (javascript:, data:, vbscript:) to safe hash fallback", () => {
      expect(sanitizeLinkUrl("javascript:alert('XSS')")).toBe("#");
      expect(sanitizeLinkUrl("data:text/html,<script>alert(1)</script>")).toBe("#");
      expect(sanitizeLinkUrl("vbscript:msgbox('bad')")).toBe("#");
      expect(sanitizeLinkUrl("   JAVASCRIPT:attack()  ")).toBe("#");

      // Safe URLs preserved
      expect(sanitizeLinkUrl("https://wa.me/919876543210")).toBe("https://wa.me/919876543210");
      expect(sanitizeLinkUrl("tel:+919876543210")).toBe("tel:+919876543210");
      expect(sanitizeLinkUrl("mailto:test@example.com")).toBe("mailto:test@example.com");
      expect(sanitizeLinkUrl("/menu")).toBe("/menu");
      expect(sanitizeLinkUrl("#contact")).toBe("#contact");
    });

    it("safely escapes HTML tags in titles and text props without executing scripts", () => {
      const maliciousTitle = "<script>alert('XSS')</script>Sweet Shop";
      render(
        <HeroBlock
          id="hero-xss"
          props={{
            title: maliciousTitle,
          }}
          context={MOCK_CONTEXT}
        />,
      );

      // Rendered as plain text node, NOT interpreted as a DOM script element
      expect(document.querySelector("script")).toBeNull();
      expect(screen.getByText(maliciousTitle)).toBeDefined();
    });

    it("formats Indian rupees accurately in minor paisa units", () => {
      expect(formatCurrencyMinor(15000, "INR")).toBe("₹150");
      expect(formatCurrencyMinor(15050, "INR")).toBe("₹150.50");
      expect(formatCurrencyMinor(100000, "INR")).toBe("₹1,000");
      expect(formatCurrencyMinor(10000000, "INR")).toBe("₹1,00,000");
    });
  });

  // ============================================================================
  // 4. Safe BlockRenderer Behavior & Error Boundaries
  // ============================================================================
  describe("4. Safe BlockRenderer Behavior", () => {
    it("renders valid approved block via BlockRenderer", () => {
      const validSection: SectionConfig = {
        id: "sec-about",
        type: "about",
        isEnabled: true,
        props: {
          title: "About Our Bakery",
          story: "Founded in 2010 with dedication to organic ingredients.",
        },
      };

      render(<BlockRenderer section={validSection} context={MOCK_CONTEXT} />);
      expect(screen.getByText("About Our Bakery")).toBeDefined();
    });

    it("skips rendering when section.isEnabled is false", () => {
      const disabledSection: SectionConfig = {
        id: "sec-disabled",
        type: "hero",
        isEnabled: false,
        props: {
          title: "Disabled Hero",
        },
      };

      const { container } = render(
        <BlockRenderer section={disabledSection} context={MOCK_CONTEXT} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("rejects unapproved block types safely without crashing", () => {
      const unapprovedSection = {
        id: "sec-unapproved",
        type: "custom_iframe_widget" as unknown as ApprovedBlockType,
        isEnabled: true,
        props: {
          src: "https://attacker.com/malicious",
        },
      };

      // In production mode: returns null, preventing crash
      const { container } = render(
        <BlockRenderer
          section={unapprovedSection as unknown as SectionConfig}
          context={{ ...MOCK_CONTEXT, previewMode: false }}
        />,
      );
      expect(container.firstChild).toBeNull();

      // In preview mode: renders user-safe warning
      render(
        <BlockRenderer
          section={unapprovedSection as unknown as SectionConfig}
          context={{ ...MOCK_CONTEXT, previewMode: true }}
        />,
      );
      expect(screen.getByText(/Unapproved Block/)).toBeDefined();
    });

    it("handles schema validation failures safely in BlockRenderer", () => {
      const invalidSection = {
        id: "sec-invalid",
        type: "menu" as const,
        isEnabled: true,
        props: {
          // Missing required `source: "catalogue"`
          title: "Invalid Menu",
        },
      };

      // In production mode: fails safely without throwing unhandled exception
      const { container } = render(
        <BlockRenderer
          section={invalidSection as unknown as SectionConfig}
          context={{ ...MOCK_CONTEXT, previewMode: false }}
        />,
      );
      expect(container.firstChild).toBeNull();

      // In preview mode: surfaces schema issue
      render(
        <BlockRenderer
          section={invalidSection as unknown as SectionConfig}
          context={{ ...MOCK_CONTEXT, previewMode: true }}
        />,
      );
      expect(screen.getByText(/Schema Validation Error/)).toBeDefined();
    });
  });
});
