# Spec-Kit: Technical Architecture & Engineering Standards

## 1. High-Level Architectural Overview

The application follows a **Modular Clean Architecture** pattern leveraging Next.js (App Router), React Server Components (RSC), and direct PostgreSQL persistence with connection pooling.

```mermaid
graph TD
    Client[Web & Mobile Browsers] -->|HTTPS :443| NPM[Nginx Proxy Manager]
    NPM -->|Internal Network| App[Next.js 16 Application Server]
    
    subgraph "Application Core"
        App -->|Server Actions / API| DomainServices[Domain Services & Use Cases]
        DomainServices -->|Repositories| DataAccess[Data Access Layer (Direct PG Pool)]
        DomainServices -->|Auth| Security[JWT + Bcrypt Guard]
        DomainServices -->|Integration| MCP[MCP Protocol Server]
    end

    DataAccess -->|TCP :5432| DB[(PostgreSQL 15 Container)]
    App -.->|Widget Client| Chatwoot[Chatwoot Live Chat]
    MCP -.->|Agent API| AIAgent[Autonomous Sales AI Agent]
```

---

## 2. SOLID Principles & Design Patterns Implementation

### S — Single Responsibility Principle (SRP)
- **Data Access Layer (`/src/repositories`)**: Exclusively handles SQL query preparation, parameter binding, and database transactions.
- **Service Layer (`/src/services`)**: Encapsulates business rules (e.g., checkout calculations, discount validations, inventory reservations). Zero direct HTTP or UI dependencies.
- **Presentation Layer (`/src/app`)**: Server Components handle data fetching and rendering; Client Components handle local interaction and event dispatching.

### O — Open/Closed Principle (OCP)
- **Payment Strategy Pattern**: Pluggable payment processors implementing a unified `PaymentGateway` interface:
  ```typescript
  export interface PaymentGateway {
    processPayment(order: OrderPayload): Promise<PaymentResult>;
    handleWebhook(payload: WebhookPayload, signature: string): Promise<WebhookResult>;
  }
  ```
  New payment providers can be introduced without modifying existing checkout pipelines.
- **Discount & Promotion Engine**: Discount calculators implement `DiscountStrategy` (Percentage, Fixed Amount, Tiered Volume).

### L — Liskov Substitution Principle (LSP)
- Storage abstractions (Local filesystem storage vs Object storage) adhere to `StorageService` without breaking calling code.

### I — Interface Segregation Principle (ISP)
- Instead of monolithic interfaces, contracts are split into precise, cohesive role interfaces:
  `OrderReader`, `OrderWriter`, `AuditLogger`, `SessionVerifier`.

### D — Dependency Inversion Principle (DIP)
- High-level domain services depend on domain abstractions rather than raw database drivers or third-party SDKs. Repositories and adapters are passed via dependency injection or factory providers.

---

## 3. Code Standards & Clean Code Rules

### Guard Clauses & Early Return (Arrow Anti-Pattern Prevention)
Deep nesting is strictly prohibited. Functions evaluate prerequisites early and terminate execution immediately upon failure or invalid preconditions.

**Example Standard:**
```typescript
export async function authenticateSession(token?: string): Promise<SessionUser> {
  if (!token) {
    throw new UnauthorizedError('Authentication token missing');
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.userId) {
    throw new UnauthorizedError('Invalid or expired session payload');
  }

  const user = await userRepository.findById(payload.userId);
  if (!user || !user.isActive) {
    throw new ForbiddenError('Account is inactive or does not exist');
  }

  return user;
}
```

### Strict Type Discipline
- Strict TypeScript configuration (`noImplicitAny: true`, `strictNullChecks: true`).
- Absolute prohibition of `any`. When types are unknown upfront, `unknown` with runtime type narrowing or Zod schemas must be used.
- All code identifiers (variables, functions, classes, interfaces, files) must be descriptive and in English.

---

## 4. Infrastructure & Portainer Stack Design

The deployment stack runs in Docker Swarm / Docker Compose managed via Portainer under the stack name `ecommerce_demo`.

### Services Definition
1. **`npm` (Nginx Proxy Manager)**:
   - Ingress controller handling SSL termination (Let's Encrypt), port 80/443 mapping, and virtual host routing.
2. **`portal-app` (Next.js Application)**:
   - Multi-stage Docker build producing a minimal standalone Node.js production container.
   - Configured with non-root user execution (`nextjs:nodejs`) for container hardening.
3. **`db` (PostgreSQL 15 Alpine)**:
   - Direct persistent volume mapping (`pg_data`).
   - Automated health check (`pg_isready`) ensuring zero-downtime container sequencing.

### Network Architecture
- Dedicated isolated overlay/bridge network: `web_network`.
- Database ports (`5432`) are strictly internal to `web_network` and never exposed directly to the public host interface.

---

## 5. Security & Secret Governance

| Requirement | Implementation Policy |
| :--- | :--- |
| **Secret Exclusions** | `.gitignore` explicitly excludes `keys/`, `.env*`, and temporary dump files. |
| **Runtime Credentials** | Injected solely via Portainer Stack environment variables or Docker Secrets. |
| **Password Hashing** | Bcrypt with work factor of 12 for administrator and customer passwords. |
| **Session Integrity** | Signed HTTP-Only, SameSite cookies carrying encrypted JWT tokens. |
| **Data Sanitization** | All legacy customer records, internal notes, and Zion Aromas references purged. |
