# Spec-Kit: Project Charter & Functional Specification

## 1. Project Identity & Objective

| Property | Value |
| :--- | :--- |
| **Project Title** | **Fragrance E-commerce Demo** |
| **Target Repository** | `empresacontalo/ecommerce_demo` (Private) |
| **Deployment Target** | Portainer Stack `ecommerce_demo` (Docker Swarm / Compose) |
| **Primary Audience** | Software Development Evaluation Team (Demonstration of Technical Excellence) |
| **Language & Locale** | 100% English (`en-US`), currency format in USD (`$`) / adaptable |
| **Default Administrator** | `admin@example.com` / `password` |

### Purpose & Scope
This project serves as a comprehensive, enterprise-grade Proof of Concept (PoC) demonstrating full-stack e-commerce capabilities. It is adapted from an existing reference codebase (`ziom-aromas`), undergoing complete white-labeling, brand sanitization, internationalization, and architectural refinement.

**Core Rules:**
- **Zero Confidentiality Leaks**: Complete removal of all proprietary data, trademarks, and credentials associated with Zion Aromas.
- **Pure Fictional Branding**: All brand names, locations, contact info, social handles, and operational hours are generated fictitiously.
- **Complete English Localization**: 100% of user interface, routes, error handling, administrative controls, documentation, and database seeds must be in English.
- **Gallery Transformation**: Eliminate legacy customer/hair photos and videos from the gallery; repurpose the gallery to feature high-resolution, lightweight `.jpg` assets from the registered luxury fragrance catalog.
- **Security Isolation**: The `keys/` directory and any local configuration overrides are excluded via `.gitignore`. No secret keys or access tokens may be committed.

---

## 2. Brand & Content Specification (Fictionalized)

| Attribute | Specification |
| :--- | :--- |
| **Brand Name** | **Aura Fragrance Co.** (*Fragrance E-commerce Demo*) |
| **Tagline** | *The Art of Timeless Scent & Modern Elegance* |
| **Store Address** | 742 Fifth Avenue, Suite 1200, New York, NY 10022, United States |
| **Contact Phone** | +1 (212) 555-0198 |
| **Support Email** | concierge@aurafragrances.demo |
| **Business Hours** | Mon–Fri: 9:00 AM – 8:00 PM EST \| Sat: 10:00 AM – 6:00 PM EST \| Sun: Closed |
| **Social Handles** | Instagram: `@aurafragrance.demo` \| Facebook: `/aurafragrancedemo` |

---

## 3. Functional Requirements (FR)

### FR-01: Storefront & Catalog
- **Home Page**: Hero carousel/banner, featured collections, bestsellers, brand story, newsletter subscription, and dynamic testimonial blocks.
- **Product Catalog (`/catalog` or `/shop`)**:
  - Filter by olfactory family (Woody, Oriental, Floral, Citrus, Fresh, Gourmand), brand, gender, and price range.
  - Real-time search with debounce and stock availability indicators.
  - Sorting: Price (Low to High, High to Low), Popularity, Newest Releases.
- **Product Detail Page (`/product/[slug]`)**:
  - Image gallery with lightweight `.jpg` zoom and thumbnails.
  - Scent pyramid breakdown (Top notes, Heart notes, Base notes).
  - Volume selection (50ml, 100ml, Gift Set).
  - Add to cart with real-time inventory validation.

### FR-02: Interactive Fragrance Finder ("Find Your Scent")
- Multi-step questionnaire guiding users to their ideal fragrance based on occasion, preferred notes, intensity, and season.
- Instant recommendation matching algorithm linking directly to product detail pages.

### FR-03: Cart & Internationalized Checkout
- Persistent cart (Local Storage + Database sync for authenticated users).
- Coupon discount engine with real-time validation (percentage and fixed-amount discounts).
- Shipping calculation with international/domestic shipping simulation.
- Payment checkout simulator (Credit Card, Digital Wallet, Bank Transfer) with instant confirmation and order receipt generation.

### FR-04: Customer Portal (`/account`)
- Customer registration and secure login via JWT and bcrypt.
- Order history with tracking timeline and digital invoice downloads.
- Address book management (Shipping and Billing addresses).

### FR-05: Content-Managed Gallery (`/gallery`)
- Grid and lightbox viewer showcasing registered fragrance bottles and lifestyle campaign imagery.
- Strictly using lightweight `.jpg` assets (all legacy video files and external brand images removed).

### FR-06: Administrative Management Panel (`/admin`)
- Access protected via session guard: `admin@example.com` / `password`.
- **Dashboard**: Sales overview, active orders, revenue metrics, recent leads.
- **Catalog Management**: CRUD operations for products, categories, stock levels, and pricing.
- **CMS & Content Blocks**: Dynamic customization of banners, announcement bars, company info, and footer links.
- **Lead & Campaign Management**: Automated lead capture, coupon campaign manager, and funnel status.

### FR-07: Conversational AI Agent & Live Chat
- Integration with Chatwoot widget via environment-injected token.
- MCP (Model Context Protocol) endpoint enabling AI sales assistants to query product availability, recommend scents, and capture prospective leads.

---

## 4. Non-Functional Requirements (NFR)

1. **Performance**: Page load under 1.2s on standard broadband; image assets optimized under 250KB per `.jpg`.
2. **Clean Code & Strict Typing**: No use of TypeScript `any`. Strict interface definitions and schema validation throughout.
3. **Architectural Cohesion**: Adherence to SOLID principles, modular layered architecture, and Guard Clauses.
4. **Testability**: Unit and integration test coverage for core business logic (discounts, cart calculations, authentication guards, shipping rules).
5. **Observability**: Structured audit logging for administrative actions and order state transitions.
