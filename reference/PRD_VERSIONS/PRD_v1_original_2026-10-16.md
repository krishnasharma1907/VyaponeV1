# VyapOne — Product Requirements Document

**Document status:** Product and technical foundation  
**Version:** 1.0  
**Date:** 16 October 2026  
**Product name:** VyapOne  
**AI assistant:** Vya  
**Primary market:** India-first local businesses, resellers, freelancers, students, agencies, and business owners  
**Primary experience:** Mobile-first web application with installable PWA capabilities where appropriate

---

## 1. Executive Summary

VyapOne is an AI-powered platform that enables a reseller, freelancer, student, agency, or business owner to create and manage a complete digital business system from a phone.

The user selects a business niche, enters or uploads business information, and answers a small set of category-specific questions. Vya, the platform's AI assistant, then proposes the website structure, business modules, content, visual direction, and required setup. The user can confirm the proposal or modify it through forms, direct editing, or natural-language instructions. VyapOne assembles a responsive public website and the supported operational tools from secure, tested components.

Depending on the selected niche and enabled modules, the generated system may include a product or service catalogue, enquiries, ordering, appointment requests, property listings, lead management, inventory, payments, QR entry points, offers, loyalty tools, analytics, and business administration.

VyapOne is not a system that publishes arbitrary unreviewed AI-generated code directly to production. AI selects and configures approved components, schemas, templates, and workflows. Sensitive logic such as authentication, authorization, pricing, payments, inventory updates, and publishing remains controlled by tested platform services.

### Product promise

> Build and run a premium digital business system from your phone.

### Brand line

> Har business. One platform.

---

## 2. Vision

Local businesses commonly depend on disconnected tools: a basic website, WhatsApp, printed menus, spreadsheets, appointment diaries, payment links, and manual customer follow-up. Creating a custom digital system is often expensive and requires technical knowledge.

VyapOne will give non-technical users a guided way to create, publish, and manage a professional digital presence and selected business operations from one mobile-friendly workspace.

The long-term platform consists of:

1. A mobile-first AI business builder.
2. A reusable website and business-module engine.
3. A reseller workspace for managing several client businesses.
4. A business-owner workspace for daily operations.
5. Public customer websites and browser-based business applications.
6. A controlled module marketplace and design library.
7. Platform administration, subscription billing, usage controls, and support.

---

## 3. Goals

### 3.1 Product goals

1. Let a first-time user create a professional business website from a phone.
2. Let resellers create and manage multiple client businesses from one account.
3. Generate a niche-relevant proposal before building anything.
4. Let the user confirm, modify, preview, publish, and update the generated system.
5. Provide reusable operational modules for different industries.
6. Generate permanent, configurable QR links for businesses, pages, tables, products, properties, offers, and campaigns.
7. Support connected merchant payments through approved providers.
8. Give business owners a focused dashboard for daily work.
9. Maintain strict separation between reseller billing, business subscriptions, and customer-to-business payments.
10. Deliver a premium brand experience using emerald liquid-glass styling and restrained 3D motion without harming accessibility or performance.

### 3.2 Business goals

1. Allow a reseller to start with a low-cost subscription and sell services at their own price.
2. Earn recurring revenue through plan limits, active website capacity, operational modules, and controlled usage.
3. Make client handover possible without losing business data or domain control.
4. Support direct business-owner subscriptions later without rebuilding the platform.
5. Validate demand, support cost, and unit economics through a limited pilot before broad expansion.

### 3.3 Non-goals for the first production release

- Generating unrestricted custom backend code and immediately deploying it.
- Native Android or iOS application generation for every client.
- Supporting every advanced industry workflow at launch.
- Replacing accounting, tax, ERP, hotel PMS, or enterprise CRM systems.
- Acting as the merchant of record unless a separately approved business and legal model supports it.
- Claiming that a generated website is automatically compliant with every local law.
- Copying Apple's protected brand assets, product UI, or trade dress.
- Offering unlimited AI, storage, messaging, or websites without measured cost controls.

---

## 4. Users and Roles

### 4.1 Platform administrator

Manages plans, module availability, resellers, businesses, support, usage, payment states, security actions, templates, and system configuration.

### 4.2 Reseller owner

Creates client businesses, collects business details, generates and publishes websites, configures modules, invites business owners, and provides agreed client services.

### 4.3 Reseller team member

Works on assigned client businesses according to permissions such as editor, operator, or billing viewer.

### 4.4 Business owner

Controls the business identity, content, staff access, operational data, connected payment account, domain, and ongoing business settings.

### 4.5 Business staff

Uses only the assigned operational functions, such as orders, appointments, enquiries, leads, catalogue updates, or inventory.

### 4.6 Customer or visitor

Uses the public website or browser-based business experience without needing a VyapOne account unless a later workflow has a clear need for customer authentication.

### 4.7 Ownership model

The core hierarchy is:

`Platform → Reseller workspace → Business → Location → Modules and records`

A business remains an independent entity. It can be created by a reseller, shared with its owner, handed over, moved to another reseller where policy permits, or converted to a direct subscription. Business data must never become inseparable from the reseller account.

---

## 5. Core Product Flow

### 5.1 Reseller onboarding

1. User creates and verifies an account.
2. User creates a reseller workspace or chooses a direct business-owner path when available.
3. User selects a plan.
4. The platform shows the live-website limit, included features, usage limits, add-ons, renewal terms, and downgrade behaviour.
5. User enters the reseller or agency identity used inside the workspace.
6. User enters the dashboard and sees available and used website slots.

### 5.2 Creating a client business

1. User taps **Create business**.
2. User selects a niche or **Other business**.
3. VyapOne displays a short mobile-friendly setup flow.
4. User enters required basic information.
5. The platform asks category-specific questions.
6. User uploads images, menus, catalogues, price lists, services, or other supported material.
7. Vya identifies missing information and asks focused follow-up questions.
8. Vya prepares a proposal.

### 5.3 Proposal and confirmation

The proposal must explain:

- The public pages that will be created.
- The enabled customer actions.
- The business dashboard functions.
- The proposed visual direction.
- The supplied facts that will be used.
- Missing or unconfirmed details.
- Required modules or plan upgrades.
- Any payment-provider or domain setup still required.

The user can:

- Confirm with **Looks good, build it**.
- Tap **Make changes** and edit structured fields.
- Ask Vya to modify the proposal using natural language.
- Save the proposal as a draft.

Generating a draft and publishing it publicly are separate actions.

### 5.4 Generation

After confirmation, VyapOne:

1. Selects an approved niche preset.
2. Configures pages, components, forms, modules, and data schemas.
3. Generates factual draft copy from confirmed business details.
4. Applies a suitable design system and content hierarchy.
5. Creates a responsive public website.
6. Creates the owner and staff dashboard views needed by the selected modules.
7. Creates a versioned, editable draft.
8. Runs automated validation and quality checks.

### 5.5 Editing from a phone

The mobile editor must support:

- Tap a section to edit it.
- Reorder approved sections.
- Change text, images, colours, visibility, and supported layout variants.
- Add or remove available modules.
- Preview phone, tablet, and desktop layouts.
- Ask Vya for a change in natural language.
- Review Vya's proposed changes before applying them.
- Undo and redo recent changes.
- Autosave drafts and expose save status.
- Restore a previously published version.
- Keep advanced settings behind progressive disclosure.

The editor must avoid tiny desktop-style controls. Primary touch targets should be at least 44–48 pixels, inputs should remain usable when the mobile keyboard opens, and essential actions must respect device safe areas.

### 5.6 Publishing

Before publishing, the platform verifies:

- The user's permission to publish.
- Available live-website capacity in the subscription.
- Required business details.
- Valid public slug or domain configuration.
- Module configuration and data validation.
- Payment connection state when online payment is enabled.
- Broken links, missing required media, and major accessibility errors.

On success, VyapOne creates:

- A public website URL.
- A permanent main QR destination.
- Additional contextual QR codes where configured.
- A published version that can be rolled back.

---

## 6. Vya AI Assistant

### 6.1 Identity

**Name:** Vya  
**UI label:** Vya · VyapOne AI  
**Primary action:** Ask Vya

Example greeting:

> Hi, I am Vya. Tell me about your client's business, and I will help you build and manage its digital setup.

### 6.2 Responsibilities

Vya can:

- Guide users through business onboarding.
- Ask category-specific questions.
- Extract draft catalogue or service data from supported uploads.
- Recommend pages and business modules.
- Generate and revise website copy.
- Suggest design directions from approved choices.
- Explain how a feature works.
- Help users find settings and resolve common setup problems.
- Propose safe changes to content and configuration.
- Summarize missing information before publishing.
- Assist with translations while preserving user-confirmed facts.
- Explain why a publish, payment, domain, or module action is unavailable.

### 6.3 Vya action model

Vya uses controlled tools rather than unrestricted production access.

`User request → intent and permission check → proposed tool action → preview/diff → user confirmation when material → validated execution → result`

Low-risk reversible actions such as drafting copy may be applied directly to the current draft with undo support. Material actions such as publishing, deleting a business, changing a connected payment account, cancelling billing, or overwriting edited content require explicit confirmation.

### 6.4 AI safeguards

- Never invent business prices, stock, availability, qualifications, legal approvals, property status, product specifications, or payment success.
- Distinguish suggestions from confirmed business data.
- Display the source field or confirmation state for sensitive facts where practical.
- Do not expose system prompts, provider keys, secrets, or another business's data.
- Respect role and business boundaries for every tool action.
- Do not silently publish AI changes.
- Preserve a complete version history of applied website changes.
- Apply per-plan AI usage limits and abuse controls.
- Provide a useful manual path when AI is unavailable.

---

## 7. Supported Business Niches

All listed niches appear in the selection experience. Availability labels must distinguish basic website support from advanced operational-module support.

### 7.1 Food and hospitality

- Café
- Restaurant
- Bakery and cake shop
- Sweet shop
- Cloud kitchen
- Food stall or food truck
- Hotel, homestay, guest house, or PG
- Caterer

Possible modules: digital menu, product modifiers, table QR, pickup or delivery ordering, order management, offers, booking enquiries, room listings, gallery, and contact actions.

### 7.2 Beauty, wellness, and fitness

- Salon
- Spa
- Barber or grooming studio
- Makeup artist
- Gym
- Yoga studio
- Dance studio
- Personal trainer

Possible modules: services, staff profiles, schedules, appointment requests, memberships, class schedules, packages, trials, and reminders.

### 7.3 Retail and local commerce

- Kirana store
- General store
- Supermarket
- Clothing boutique
- Footwear store
- Jewellery and accessories store
- Cosmetics store
- Gift and toy shop
- Flower shop
- Book and stationery shop
- Mobile and electronics shop
- Computer shop
- Furniture and home décor store
- Hardware, electrical, and plumbing store
- Paint and building-material store
- Sports and fitness-equipment store
- Pet-supplies store
- Plant nursery

Possible modules: catalogue, categories, product variants, availability, cart, ordering, pickup or delivery, enquiries, offers, inventory, and repeat-order support.

### 7.4 Professional and home services

- Electrician
- Plumber
- Carpenter
- Appliance repair
- Home-cleaning service
- Freelancer
- Consultant
- Photographer
- Event planner or decorator
- Travel agency
- Interior designer

Possible modules: services, portfolios, service areas, request forms, quotations, consultations, job status, packages, and lead management.

### 7.5 Automotive and repair

- Vehicle garage
- Car or bike wash
- Detailing studio
- Tyre or accessories shop
- Mobile or computer repair shop

Possible modules: service packages, appointments, repair requests, estimates, job tracking, status notifications, and payment collection.

### 7.6 Education

- Coaching centre
- Tuition teacher
- Training institute
- Music or art class

Possible modules: courses, schedules, instructors, admission enquiries, demo-class requests, resources, announcements, and fee links where supported.

### 7.7 Real estate

- Property broker or agent
- Builder or developer
- Rental manager
- Commercial property consultant

Possible modules: listings, filters, property pages, individual property QR codes, project pages, brochures, enquiries, site-visit requests, lead assignment, follow-ups, and listing status.

### 7.8 Operational services and rentals

- Laundry or dry cleaner
- Tailor or alteration shop
- Printing and photocopy shop
- Equipment rental
- Clothing rental
- Party-supplies rental

Possible modules: pickup requests, measurement or specification capture, file uploads, quotations, date availability, deposits, fulfilment status, and return tracking.

### 7.9 Other business

The **Other business** path collects the business model, offerings, desired customer actions, and operational needs. Vya maps the business to existing approved modules. Unsupported requirements are labelled for manual review instead of being promised automatically.

---

## 8. Reusable Product Modules

### 8.1 Platform core

- Authentication and account recovery
- Workspaces, roles, and permissions
- Business and location management
- Subscription and entitlement management
- Media library
- Activity and audit logs
- Notifications
- Usage measurement
- Support

### 8.2 Website engine

- Structured pages and sections
- Approved responsive components
- Theme tokens
- Navigation and footer configuration
- SEO metadata controls
- Custom domain connection
- Preview, publishing, versioning, and rollback
- Internationalization support

### 8.3 Catalogue and services

- Categories
- Products or services
- Images
- Prices
- Variants and options
- Availability
- Search and filtering
- Featured items

### 8.4 Enquiries and lead management

- Configurable forms
- Consent-aware contact collection
- Source attribution
- Status pipeline
- Assignment
- Notes and follow-up dates
- Spam controls

### 8.5 Orders

- Cart
- Server-validated prices
- Pickup, delivery, or table context
- Order placement
- Order acceptance and rejection
- Status progression
- Payment status separation
- Cancellation and refund references

### 8.6 Appointments

- Services and durations
- Staff assignment
- Schedules and blocked times
- Availability calculation
- Booking requests or confirmed bookings
- Reschedule and cancellation policies
- Double-booking prevention

### 8.7 Inventory

- Stock quantities
- Availability status
- Inventory adjustments
- Low-stock alerts
- Order-linked stock updates
- Audit trail

Advanced retail inventory, procurement, batch tracking, accounting, and tax functions are outside the initial scope.

### 8.8 Property listings

- Sale and rent listing types
- Property attributes
- Media and floor plans
- Location and map links
- Availability state
- Filters
- Enquiries and site visits
- Agent assignment

### 8.9 QR management

- Permanent redirect destinations
- Main business QR
- Page, table, product, property, booking, offer, and campaign QR types
- Configurable destinations
- Downloadable high-resolution artwork
- Placement-level analytics
- Scan-safe output with sufficient contrast and quiet zone

### 8.10 Feedback and reviews

- Private feedback form
- Honest review-writing assistance where enabled
- Direct Google review access for all sentiments
- Review reply drafting for owners
- No review gating, fabricated claims, rewards for positive reviews, or automatic posting

### 8.11 Offers and loyalty

- Offers and validity windows
- Coupon codes
- Customer-visible terms
- Basic points or visit-based loyalty in a later phase
- Abuse controls and auditable adjustments

### 8.12 Analytics

- Public website visits
- QR landing visits
- Enquiries
- Orders placed and paid orders
- Appointment requests and confirmed appointments
- Outbound actions
- Module and AI usage
- Source and campaign breakdowns where reliably measured

Metrics must use precise definitions. An outbound click must not be reported as a completed purchase or published review.

---

## 9. Reseller Plans and Entitlements

### 9.1 Initial pricing hypothesis

The prices below are product hypotheses and must be validated during the pilot.

| Plan | Monthly price | Included live websites | Proposed positioning |
| --- | ---: | ---: | --- |
| Starter | ₹399 | 3 | New reseller testing the service |
| Growth | ₹999 | 8 | Active freelancer or small agency |
| Agency | ₹1,999 | 20 | Team managing several clients |
| Scale | Configured quote | 20+ | Higher-volume operation |

### 9.2 Counting rules

- One website slot represents one live business, not one page.
- Draft sites use a separate controlled allowance.
- Connecting a custom domain does not consume another website slot.
- Archiving a site does not immediately delete its data.
- A plan downgrade requires the user to select which websites remain live.
- Existing live websites must not disappear without a clear grace and fallback policy.
- Advanced business modules, messaging, storage, and high AI usage may be charged separately.

### 9.3 Reseller commercial model

The reseller may charge the client separately for setup, content entry, photography, customization, training, and support. VyapOne charges the reseller for platform access and configured usage. Customer payments for a client's goods or services belong to that business and remain separate from VyapOne subscription billing.

---

## 10. Payments

### 10.1 Payment relationships

1. **Reseller to VyapOne:** subscription and add-on billing.
2. **Business owner to reseller:** service arrangement outside or through a later invoicing feature.
3. **Customer to business:** product, service, booking, or order payment through the connected merchant provider.

### 10.2 Merchant payment onboarding

- Business owner connects a supported provider account.
- Provider KYC and merchant approval remain provider responsibilities.
- Credentials and secrets are stored server-side using approved secret management.
- The public client never receives provider secrets.
- The platform displays the actual connection and verification state.

### 10.3 Transaction integrity

- Prices and payable totals are recalculated on the server.
- Payment success is accepted only from trusted server-side verification or signed webhooks.
- Redirect parameters do not activate an order or subscription.
- Webhooks are signature-verified, replay-resistant, and idempotent.
- Provider references are stored; raw card data is not stored.
- Order status and payment status are separate.
- Failed, pending, refunded, and disputed states are supported where provided.

### 10.4 Initial provider direction

Razorpay is an India-focused candidate and Stripe may be considered where product availability and business requirements fit. Final provider selection requires pricing, marketplace/platform support, settlement model, KYC, refund, and compliance review.

---

## 11. Brand and Logo Direction

### 11.1 Brand attributes

VyapOne should feel:

- Capable
- Friendly
- Modern
- Trustworthy
- Premium
- Accessible to non-technical users
- Relevant to many industries

### 11.2 Logo concept

The logo should be an original, scalable mark that combines one or more of these ideas:

- A unified **V** and **1**.
- Connected building blocks representing modules.
- A doorway or launch point representing digital entry.
- A subtle connection or bridge representing business-to-customer access.

The logo must work as:

- Full wordmark: VyapOne
- Compact product mark
- App icon or PWA icon
- Monochrome mark
- Small dashboard mark
- Static reduced-motion fallback

The static vector identity must be finalized before applying liquid or 3D effects.

### 11.3 Liquid logo usage

The `liquid-logo` workflow may create an optional liquid-metal animation for the marketing hero, launch video, and promotional media. It must preserve the original silhouette, provide a static fallback, and not block application loading. The application navigation and operational dashboard use the static mark.

---

## 12. Visual Design System

### 12.1 Direction

VyapOne uses an original emerald and pearl visual system with Apple-inspired principles of clarity, depth, material, responsive motion, and restraint. It does not copy Apple's interface or branding.

### 12.2 Core colours

| Token | Value | Use |
| --- | --- | --- |
| Background | `#F4FAF7` | Main canvas |
| Background mint | `#E7F5EE` | Ambient sections |
| Surface | `#FFFFFF` | Forms, tables, readable content |
| Glass surface | `rgba(255,255,255,0.80)` | Navigation and framing |
| Primary emerald | `#087A55` | Main actions and selection |
| Primary hover | `#066447` | Hover state |
| Primary pressed | `#054F39` | Pressed state |
| Primary soft | `#E5F4EC` | Selection background |
| Text | `#15251F` | Headings and body |
| Secondary text | `#50665C` | Supporting content |
| Border | `#D5E4DC` | Controls and cards |
| Error | `#B52B48` | Errors and destructive actions |

Official third-party marks may retain their required colours. The primary product theme avoids unrelated blue, purple, orange, and gold accents.

### 12.3 Glass system

Glass is used for:

- Navigation shells
- Floating editor controls
- Vya assistant panel
- Selected modal and bottom-sheet framing
- Marketing presentation layers

Opaque or nearly opaque surfaces are used for:

- Forms
- Tables
- Dense dashboards
- Prices and transaction states
- QR artwork
- Errors and important notices
- Long-form text

The default glass treatment uses an 80% white background, subtle white border, limited backdrop blur, restrained shadow, and an opaque fallback when backdrop filtering is unavailable. More than two overlapping translucent layers should be avoided.

`liquid-glass-js` is optional for isolated high-value controls or marketing demonstrations. It is not required for ordinary cards, forms, or navigation and must not become a performance dependency for the core app.

### 12.4 Typography

- Inter or a comparable legible sans-serif for Latin text.
- Noto Sans Devanagari or an appropriate fallback for Hindi.
- Minimum 16-pixel mobile input text to prevent unwanted zoom.
- Fluid display sizes with readable limits.
- Additional line height for Devanagari text.

### 12.5 3D and motion

3D is used selectively for:

- Marketing hero demonstrations
- Visual explanation of website generation
- QR-to-business journey visualization
- Template or device-preview presentation

The operational dashboard uses lightweight motion:

- 120–180 ms control transitions
- 200–240 ms dialogs and sheets
- Transform and opacity animations by default
- Interruptible transitions
- Correct transform origins
- Reduced-motion alternatives

No constant floating motion, excessive parallax, animated QR modules, or effects that obscure business content are permitted.

---

## 13. Information Architecture

### 13.1 Public VyapOne pages

- Home
- Product
- Solutions by niche
- For resellers
- Pricing
- Examples or templates
- Help centre
- Contact and support
- Terms
- Privacy
- Refund and cancellation policy

### 13.2 Reseller workspace

- Overview
- Businesses
- Create business
- Drafts
- Templates
- Media
- Team
- Subscription and usage
- Earnings or client-service tracking when implemented
- Support
- Settings

### 13.3 Business workspace

- Overview
- Website
- Catalogue or services
- Enabled operational modules
- Leads or customers where permitted
- QR Studio
- Analytics
- Payments
- Team
- Business settings

Navigation adapts to enabled modules. A salon should not see property controls, and a property broker should not see restaurant table-order controls.

### 13.4 Website editor

- Page and section navigator
- Live preview
- Section inspector
- Theme controls
- Content and media editor
- Module settings
- Vya assistant
- Version history
- Preview and publish actions

### 13.5 Platform admin

- Overview
- Users and resellers
- Businesses
- Plans and entitlements
- Templates and modules
- Subscriptions and payments
- AI and infrastructure usage
- Support
- Security and moderation
- Audit history
- Platform configuration

---

## 14. Functional Requirements

### FR-01 Authentication and recovery

- Register, verify, sign in, sign out, and recover access.
- Support secure session handling.
- Separate platform, reseller, business-owner, and staff roles.
- Enforce authorization on the server.

### FR-02 Workspace and business management

- Create and manage businesses subject to plan limits.
- Invite owners and staff.
- Transfer or hand over a business through a controlled process.
- Track draft, live, archived, suspended, and handover states.

### FR-03 Niche onboarding

- Display all supported niches.
- Load relevant questions and recommended modules.
- Preserve progress.
- Support text, voice-ready input, images, and supported document imports.
- Offer an Other business path.

### FR-04 Vya proposal

- Generate a structured proposal from confirmed inputs.
- Identify missing fields and assumptions.
- Show pages, modules, design direction, and plan impact.
- Let the user confirm or modify the proposal.

### FR-05 Generation engine

- Assemble approved components, routes, schema configuration, and modules.
- Produce a versioned draft.
- Never generate unbounded production logic from a prompt.
- Keep operational logic independent from presentation themes.

### FR-06 Mobile editor

- Edit all essential content and configuration from a phone.
- Support undo, redo, autosave, preview, and version history.
- Support Vya-assisted changes with preview.
- Prevent accidental loss of edited content.

### FR-07 Publishing

- Validate entitlements and required configuration.
- Publish to a permanent platform URL.
- Support custom domains when enabled.
- Provide deployment status and recovery from failure.
- Roll back to a prior stable version.

### FR-08 QR management

- Generate permanent dynamic QR destinations.
- Allow destination updates without reprinting.
- Generate scan-safe exports.
- Record eligible visits without blocking navigation.

### FR-09 Business modules

- Enable only compatible, implemented modules.
- Store module data per business.
- Enforce business and role isolation.
- Support module-specific empty, loading, error, and permission states.

### FR-10 Subscription and limits

- Render plans and limits from server configuration.
- Enforce live-website capacity on the server.
- Track AI, storage, messaging, and module usage as configured.
- Handle active, pending, past-due, grace, expired, and cancelled states.

### FR-11 Payments

- Verify subscription and merchant payment events server-side.
- Use signed webhooks and idempotent event processing.
- Display pending status until confirmation.
- Keep customer payment data isolated by business.

### FR-12 Analytics

- Define metrics precisely.
- Separate visits, clicks, enquiries, orders, paid orders, and confirmed appointments.
- Exclude identifiable preview/test traffic where possible.
- Do not store raw Vya conversations or customer text in analytics events.

### FR-13 Administration

- Manage plans, modules, templates, accounts, usage, support, and security actions.
- Require confirmation and a reason for sensitive actions.
- Record audit events with actor, target, time, reason, and outcome.

### FR-14 Internationalization

- Support English and Hindi in the initial product UI where prioritized.
- Preserve user input when changing interface language.
- Allow business websites to configure supported languages.
- Never translate factual content silently.

---

## 15. Technical Architecture

### 15.1 Recommended initial stack

The final stack remains an architecture decision, but the recommended starting direction is:

| Layer | Recommended direction |
| --- | --- |
| Web application | Next.js with TypeScript |
| UI system | Tailwind CSS plus controlled shadcn components or equivalent accessible primitives |
| Visual editor | Puck as a candidate, adapted for VyapOne's constrained component model and mobile editing |
| AI application layer | Vercel AI SDK or equivalent provider-neutral orchestration |
| Database | PostgreSQL |
| Authentication and storage | Supabase is a candidate; final selection requires an architecture decision |
| Validation | Shared server and client schemas, such as Zod |
| Payments | Razorpay candidate for India, implemented through official server SDKs |
| Background jobs | Managed queue or scheduled worker suitable for selected hosting |
| Testing | Unit/integration tests plus Playwright browser flows |
| Monitoring | Structured logs, error tracking, usage metrics, and audit records |

### 15.2 Multi-tenant model

Every business-owned record includes a business identifier. Access is determined from the authenticated user's explicit membership and role. Database policies and server authorization must prevent cross-business access even if a user modifies a URL or API request.

### 15.3 Builder representation

Websites are stored as structured configuration, not arbitrary HTML:

- Site metadata
- Theme tokens
- Pages
- Ordered sections
- Approved component type
- Validated component properties
- Module bindings
- Published version

This representation allows mobile editing, Vya tool actions, validation, safe rendering, and rollback.

### 15.4 Template architecture

`Niche preset = recommended pages + component configuration + enabled modules + onboarding questions + dashboard navigation + validation rules`

Templates use shared components. Data and operational records are never copied when a reseller duplicates a design preset.

### 15.5 AI architecture

- Model-provider abstraction.
- Structured outputs for proposals and content changes.
- Tool calls restricted by permission and schema.
- Retrieval from VyapOne help content and current business configuration.
- Conversation context scoped to the correct workspace and business.
- Token and request budgets per plan.
- Human confirmation for material actions.
- Provider failure and timeout handling.

### 15.6 Media

- Direct-to-storage uploads using short-lived authorization.
- File type, size, and image-dimension validation.
- Image optimization and responsive variants.
- Business-scoped object paths and authorization.
- Safe deletion and reference checks.

### 15.7 Deployment model

Published business websites should render from versioned structured data using the shared runtime. A content change should not require a complete custom application deployment for every business unless the architecture later proves that model necessary.

---

## 16. Initial Data Model

### User

- `id`
- `email_or_login_identifier`
- `status`
- `preferred_language`
- `created_at`

### Workspace

- `id`
- `type` (`reseller`, `direct_business`, `platform`)
- `name`
- `owner_user_id`
- `status`
- `created_at`

### WorkspaceMember

- `workspace_id`
- `user_id`
- `role`
- `status`

### Business

- `id`
- `workspace_id`
- `owner_user_id`
- `name`
- `slug`
- `category`
- `description`
- `contact_configuration`
- `address_configuration`
- `preferred_language`
- `status`
- `created_at`
- `updated_at`

### BusinessMember

- `business_id`
- `user_id`
- `role`
- `permissions`
- `status`

### Site

- `id`
- `business_id`
- `status`
- `current_draft_version_id`
- `published_version_id`
- `platform_domain`
- `custom_domain_status`

### SiteVersion

- `id`
- `site_id`
- `version_number`
- `structured_configuration`
- `created_by`
- `created_at`
- `published_at`

### ModuleInstallation

- `id`
- `business_id`
- `module_key`
- `configuration`
- `status`

### CatalogueItem

- `id`
- `business_id`
- `type`
- `category_id`
- `name`
- `description`
- `price_configuration`
- `availability`
- `media`

### Lead

- `id`
- `business_id`
- `source`
- `subject_reference`
- `contact_fields`
- `status`
- `assigned_user_id`
- `next_follow_up_at`

### Order

- `id`
- `business_id`
- `customer_reference`
- `items_snapshot`
- `amounts`
- `fulfilment_type`
- `order_status`
- `payment_status`
- `created_at`

### Appointment

- `id`
- `business_id`
- `service_id`
- `staff_id`
- `starts_at`
- `ends_at`
- `status`
- `customer_reference`

### PaymentRecord

- `id`
- `business_id_or_workspace_id`
- `purpose`
- `provider`
- `provider_reference`
- `amount`
- `currency`
- `status`
- `verified_at`

### Subscription

- `id`
- `workspace_id`
- `plan_id`
- `status`
- `current_period_start`
- `current_period_end`
- `grace_period_end`
- `provider_reference`

### QRCode

- `id`
- `business_id`
- `type`
- `public_slug`
- `destination_configuration`
- `status`

### AnalyticsEvent

- `id`
- `business_id`
- `site_id`
- `event_type`
- `source_context`
- `coarse_metadata`
- `occurred_at`

### AIAction

- `id`
- `workspace_id`
- `business_id`
- `user_id`
- `action_type`
- `status`
- `input_reference`
- `output_reference`
- `usage`
- `created_at`

Raw confidential content, payment secrets, and unnecessary personal data must not be placed in analytics or audit metadata.

---

## 17. Security, Privacy, and Trust

### 17.1 Security requirements

- Server-side authorization on every protected action.
- Strong tenant isolation and database policies.
- Input validation and output encoding.
- CSRF, XSS, injection, upload, and abuse protections appropriate to the stack.
- Secure cookies and session rotation.
- Rate limits for authentication, AI, forms, QR endpoints, and public actions.
- Encrypted transport and provider-managed encryption at rest.
- Secret management outside client code and repositories.
- Signed and idempotent payment webhooks.
- Audit logs for sensitive administrative and billing actions.
- Dependency and license review before integrating external code.

### 17.2 Privacy requirements

- Collect only data required by enabled workflows.
- Explain when information is sent to an AI provider.
- Define retention and deletion periods before production launch.
- Avoid collecting customer contact information unless a workflow requires it.
- Allow authorized businesses to access and manage their own records.
- Do not use one client's private data to generate another client's content.
- Provide approved privacy, terms, support, cancellation, and refund information.

### 17.3 AI transparency

The interface identifies Vya as AI. Suggestions and generated content remain editable. Users remain responsible for confirming business facts, prices, claims, and public content.

---

## 18. Accessibility, Responsiveness, and Performance

### 18.1 Accessibility

- Target WCAG 2.2 AA.
- Maintain keyboard access and visible focus.
- Use semantic elements and accessible labels.
- Support 200% zoom and text enlargement.
- Never use colour alone to communicate state.
- Respect reduced-motion settings.
- Provide text alternatives for meaningful images.
- Keep error recovery clear and persistent.

### 18.2 Responsive behaviour

Validate at 320, 390, 768, 1024, and 1440 pixels. The complete creation and management journey must work at 390 pixels. Horizontal page scrolling is prohibited except inside intentionally scrollable components with clear affordances.

### 18.3 Performance

- Core public business pages must not depend on Vya, admin, or 3D bundles.
- Lazy-load nonessential 3D and marketing effects.
- Animate transform and opacity by default.
- Avoid expensive nested blur.
- Optimize uploaded images.
- Reserve dimensions to prevent layout shifts.
- Provide static fallbacks for WebGL and reduced motion.
- Establish measurable performance budgets before public launch.

---

## 19. Development Skills and Libraries

### 19.1 Important distinction

Codex skills are development instructions and quality workflows used while building VyapOne. They do not automatically become features available to Vya or to client websites. Customer-facing capabilities must be implemented as approved VyapOne components, modules, tools, prompts, schemas, and services.

### 19.2 Skills expected during development

| Skill | Intended use in VyapOne development |
| --- | --- |
| `modern-web-design` | Design-system architecture, responsive layouts, accessibility, and performance-aware visual decisions |
| `emil-design-eng` | UI craft, component polish, interaction details, and consistent feedback |
| `apple-design-emilkowalski` | Fluid sheets, interruptible transitions, depth, restraint, and gesture principles |
| `mobile-native` | Mobile viewport, keyboard, safe-area, touch, hover, scroll, and PWA-quality behaviour |
| `shadcn` | Manage accessible UI components and project integration |
| `animated-component-libraries` | Evaluate reusable animated components for marketing and selected product surfaces |
| `animate` | Build purposeful interface transitions |
| `motion-framer` | Implement complex React motion when CSS is insufficient |
| `animation-performance` | Keep motion within frame budgets and avoid main-thread or paint-heavy effects |
| `ask-sonner` | Accurate save, publish, upload, and error notifications |
| `break-ui` | Test long names, Hindi content, missing values, large counts, and other realistic edge cases |
| `web-design-guidelines` | Audit accessibility, forms, navigation, performance, internationalization, and interaction quality |
| `vercel-react-best-practices` | React and Next.js performance and data-flow practices |
| `vercel-composition-patterns` | Scalable reusable component architecture |
| `ai-sdk` | Build Vya's streaming chat, structured results, and controlled tool-calling layer |
| `supabase` | Implement Supabase services if Supabase is selected |
| `supabase-postgres-best-practices` | PostgreSQL schema, RLS, indexing, and performance review |
| `puck-editor` | Evaluate and adapt the React visual editor for structured page building |
| `razorpay-node` | Implement and review the official Razorpay server integration |
| `playwright` | Verify critical browser journeys and responsive UI flows |
| `liquid-logo` | Produce optional marketing logo animation from the finalized static mark |
| `liquid-glass-js` | Evaluate isolated refractive glass experiences; ordinary UI uses lightweight CSS glass |
| `react-three-fiber` and `threejs-webgl` | Build selected 3D marketing or explanatory visuals |
| `deploy-to-vercel` or the selected hosting workflow | Preview and deployment after the target hosting architecture is approved |

### 19.3 Candidate open-source libraries

Libraries are installed into the application only when required. Source code, package versions, licences, maintenance status, security history, bundle impact, and commercial use terms must be reviewed first.

- Next.js and React
- Tailwind CSS
- shadcn/ui or equivalent accessible primitives
- Puck visual editor
- Vercel AI SDK
- Supabase client and SSR libraries if selected
- Official Razorpay Node SDK if selected
- Zod or equivalent schema validation
- Playwright
- Motion for selected complex interactions
- Three.js or React Three Fiber for selected 3D presentation
- QR generation and export libraries selected after scan-quality testing

No external repository is copied wholesale into the product. Only required, reviewed, licensed components are integrated.

---

## 20. Quality Strategy

### 20.1 Automated validation

- Schema validation for builder configuration.
- Authorization tests for cross-business access.
- Idempotency tests for payments and publishing.
- Calculation tests for prices, limits, and inventory.
- Component accessibility checks.
- Critical browser flows with Playwright.
- Link, image, and publish readiness checks.

### 20.2 Critical end-to-end journeys

1. Reseller signup and subscription activation.
2. Create business and select niche.
3. Complete category-specific onboarding.
4. Review and modify Vya's proposal.
5. Generate and edit a website from a phone-sized viewport.
6. Preview and publish within plan limits.
7. Generate and scan a QR code.
8. Invite a business owner and verify restricted access.
9. Place an order or submit an appointment/enquiry through an enabled module.
10. Complete a payment and verify the trusted webhook state.
11. Roll back a published site version.
12. Downgrade a plan without silent data deletion.

### 20.3 Real-device checks

- Common Android Chrome devices.
- iPhone Safari.
- Camera QR scanning under common print sizes and lighting.
- Mobile keyboard and safe-area behaviour.
- Touch feedback and sticky-hover behaviour.
- Lower-performance device testing for glass and 3D fallbacks.

---

## 21. MVP Scope

The MVP must prove the platform's complete creation loop while limiting operational complexity.

### 21.1 MVP capabilities

- Authentication and reseller workspace.
- Configured Starter plan with three live websites.
- Niche-selection catalogue.
- Basic and category-specific onboarding.
- Vya proposal, missing-information review, and controlled content assistance.
- Structured mobile website editor.
- Approved themes using the VyapOne design system.
- Website pages, catalogue or services, gallery, enquiries, contact actions, offers, and social links.
- Publishing, platform URL, version history, and rollback.
- Dynamic main QR and page-specific QR support.
- Basic analytics.
- Business-owner invitation and role separation.
- Admin management of users, businesses, plans, and usage.
- One complete operational vertical chosen from restaurant ordering or salon appointments.

### 21.2 MVP niche treatment

All supported niches can receive a premium informational website, catalogue or services, enquiry flow, contact actions, and QR. Advanced workflows appear only when their production module is implemented and enabled.

### 21.3 Recommended first operational vertical

Select the vertical based on access to real pilot businesses:

- **Restaurant/café:** menu → cart/table context → order → staff status → optional payment.
- **Salon:** services → staff/availability → appointment → confirmation → reschedule/cancel.

Only one should be treated as fully operational in the first MVP unless delivery capacity clearly supports both.

---

## 22. Delivery Phases

### Phase 0 — Decisions and validation

- Verify VyapOne name, domain, and trademark position.
- Validate reseller willingness to pay.
- Confirm first operational vertical.
- Approve stack, hosting, auth, AI provider, and payment provider.
- Define privacy, retention, refunds, cancellation, support, and expiry behaviour.
- Finalize static brand identity.

### Phase 1 — Foundation

- Design tokens and component system.
- Authentication and workspaces.
- Businesses, memberships, and plan limits.
- Niche catalogue and onboarding schema.
- Core Vya assistant and proposal.

### Phase 2 — Builder and publishing

- Structured page engine.
- Mobile editor.
- Theme system.
- Preview, versioning, publish, rollback, domain-ready architecture, and QR.

### Phase 3 — Business operations

- Catalogue and enquiries.
- First complete operational vertical.
- Notifications and analytics.
- Business-owner daily dashboard.

### Phase 4 — Payments and commercial launch

- Subscription billing.
- Merchant connection flow.
- Webhook verification.
- Plan entitlements and add-ons.
- Support and operational admin.

### Phase 5 — Expansion

- Second and subsequent operational verticals.
- Inventory depth.
- Loyalty.
- Multi-location support.
- Reseller branding.
- Approved integrations.
- Direct business-owner onboarding.

---

## 23. MVP Acceptance Criteria

The MVP is ready for a controlled pilot when:

1. A reseller can register and access a workspace from a phone.
2. The Starter plan enforces a maximum of three live businesses on the server.
3. The reseller can select any listed niche and complete relevant onboarding.
4. Vya produces a structured proposal based only on supplied and confirmed information.
5. The user can modify and confirm the proposal.
6. VyapOne generates an editable, responsive website draft from approved components.
7. The essential editing and publishing flow works at a 390-pixel viewport.
8. The user can preview, publish, update, and roll back a site.
9. The published site has a permanent URL and functional QR code.
10. The owner can be invited without gaining access to other businesses.
11. The first operational vertical completes its full customer and staff flow.
12. Payment states rely on trusted server confirmation where payment is enabled.
13. Vya cannot access or modify data outside the authorized business.
14. Public sites remain usable when AI, 3D, or glass effects are unavailable.
15. Critical flows pass accessibility, mobile, cross-browser, and security checks.
16. The pilot has approved terms, privacy, cancellation, support, and data-retention policies.

---

## 24. Pilot Metrics

- Reseller registration and activation rate
- Time from Create business to first preview
- Time from preview to publication
- Percentage completed entirely on mobile
- Vya proposal acceptance and modification rates
- Average manual support time per business
- Draft-to-live conversion
- Websites per active reseller
- Module activation rate
- Public visits and meaningful customer actions
- Order, appointment, or enquiry completion rate for the selected vertical
- AI cost per generated site and per active business
- Hosting, storage, messaging, and support cost per active business
- Subscription conversion, renewal, downgrade, and cancellation
- Reseller gross margin after platform and service costs
- Publish failure and rollback rates

---

## 25. Open Decisions Before Production Development

- VyapOne domain and trademark clearance
- Final logo and icon
- First operational vertical
- Hosting and deployment architecture
- Authentication provider
- Database and storage provider
- AI model providers and budgets
- Razorpay, Stripe, or another payment-provider model
- Subscription prices, add-ons, taxes, and invoicing
- Grace period and website behaviour after expiry
- Business ownership and reseller handover policy
- Custom-domain ownership and support process
- Data retention and deletion periods
- Messaging providers and charges
- Support responsibilities between platform and reseller
- Refund, cancellation, and dispute policy
- Legal terms for generated content and merchant transactions

---

## 26. Definition of Done

The first release fulfils this journey:

**Reseller signs up → chooses a niche → enters client details from a phone → Vya asks relevant questions → Vya presents the proposed website and modules → reseller confirms or modifies the proposal → VyapOne generates a structured frontend and configured business backend → reseller edits and previews the result → plan capacity is checked → site is published → QR is generated → customer performs a supported action → business owner manages that action from the dashboard.**

The release is considered successful only when the journey is reliable, secure, understandable to a non-technical user, and demonstrably usable from a phone. Premium visual design supports that outcome; it does not replace functional clarity, accessibility, trustworthy payments, or correct business operations.
