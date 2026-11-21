/**
 * VyapOne — Approved Block Library Foundation [VO-041]
 *
 * Public entrypoint for the 13 canonical approved website blocks,
 * central registry, renderer, and related types.
 */

export * from "./types";
export * from "./icons";
export * from "./utils";
export * from "./block-registry";
export * from "./block-renderer";

// Individual Block Components
export { HeroBlock } from "./hero-block";
export { AboutBlock } from "./about-block";
export { MenuBlock } from "./menu-block";
export { CatalogueGridBlock } from "./catalogue-grid-block";
export { GalleryBlock } from "./gallery-block";
export { BookingFormBlock } from "./booking-form-block";
export { PricingBlock } from "./pricing-block";
export { ReviewsBlock } from "./reviews-block";
export { OffersBlock } from "./offers-block";
export { LocationMapBlock } from "./location-map-block";
export { ContactBlock } from "./contact-block";
export { FaqBlock } from "./faq-block";
export { FooterBlock } from "./footer-block";
