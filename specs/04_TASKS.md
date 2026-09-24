# Spec-Kit: Execution Plan & TDD Task Matrix

This document defines the phased implementation strategy, validation checkpoints, and Test-Driven Development (TDD) protocols for the **Fragrance E-commerce Demo**.

---

## Phase 1: Repository Foundation & Sanitization

- [ ] **Task 1.1: Security & Git Boundary Setup**
  - Configure `.gitignore` to strictly exclude `keys/`, `exemplo/`, `.env*`, and credential stores.
  - Verify that no credentials or proprietary secrets are tracked by Git.
- [ ] **Task 1.2: Project Scaffolding & Dependencies**
  - Establish the clean project workspace for `ecommerce_demo`.
  - Validate `package.json` scripts, TypeScript strict configurations, and ESLint / Vitest test runners.
- [ ] **Task 1.3: Docker Compose Stack Definition**
  - Create `docker-compose.yml` for the `ecommerce_demo` stack (Nginx Proxy Manager, `portal-app`, PostgreSQL 15).
  - Define container healthchecks and persistent volumes (`pg_data`, `npm_data`).

---

## Phase 2: Domain Modeling & TDD Business Rules

- [ ] **Task 2.1: Database Migrations & Seed Pipeline**
  - Create PostgreSQL migration scripts defining `users`, `categories`, `products`, `orders`, `gallery_items`, and `cms_config`.
  - Prepare seed scripts inserting the default admin (`admin@example.com` / `password`), luxury fragrance categories, and registered product rows.
- [ ] **Task 2.2: Unit Testing Core Business Logic (TDD)**
  - Write test suites for Coupon / Discount validation (`cupons.test.ts`).
  - Write test suites for Cart calculation and Order subtotaling.
  - Write test suites for Company config resolution and token interpolation (`empresa.test.ts`).
- [ ] **Task 2.3: Authentication & Guard Clauses**
  - Implement authentication service using JWT + Bcrypt.
  - Enforce Early Return / Guard Clause patterns in session verification and route protection.

---

## Phase 3: Brand Replacement & English Localization

- [ ] **Task 3.1: Global Content Sanitization**
  - Remove all mentions of "Zion Aromas" across pages, metadata, email templates, and error messages.
  - Apply fictional identity: **Aura Fragrance Co.** (New York, NY; +1 212-555-0198).
- [ ] **Task 3.2: Full English Internationalization**
  - Translate all navigation links, buttons, form validations, toast notifications, and checkout steps into natural, professional English.
  - Update `sitemap.ts` and metadata tags to English locales.

---

## Phase 4: Asset Optimization & Gallery Transformation

- [ ] **Task 4.1: Image Pipeline & JPG Optimization**
  - Copy and verify all 38 registered perfume product images (`/produtos/*.jpg`).
  - Ensure all product imagery adheres to lightweight `.jpg` standards (< 250KB per image).
- [ ] **Task 4.2: Gallery Migration**
  - Deprecate and purge legacy customer hair photos and MP4 video files.
  - Populate `/gallery` dynamically using high-resolution product photography from the registered catalog.

---

## Phase 5: Administrative Panel & Integrations

- [ ] **Task 5.1: Admin Panel Verification**
  - Test admin login with `admin@example.com` / `password`.
  - Verify Product CRUD, Category assignment, and CMS configuration live editing.
- [ ] **Task 5.2: Chatwoot & Sales Agent Integration**
  - Embed Chatwoot client script using configured parameters from `keys/caixa_chatwoot.txt`.
  - Expose MCP endpoints for conversational AI agent access to the product catalog.

---

## Phase 6: Quality Assurance, Portainer Stack & Documentation

- [ ] **Task 6.1: Automated Test Suite Run**
  - Run all Vitest unit and integration test suites; ensure 100% pass rate.
  - Execute TypeScript compiler check (`tsc --noEmit`) to verify zero `any` or strict typing errors.
- [ ] **Task 6.2: Remote Repository & Portainer Stack Deployment**
  - Create private GitHub repository `empresacontalo/ecommerce_demo`.
  - Configure and deploy stack `ecommerce_demo` in Portainer via API / Compose file.
- [ ] **Task 6.3: Final Architecture Documentation**
  - Generate clean architectural summary and handover documentation for the partner development team.
