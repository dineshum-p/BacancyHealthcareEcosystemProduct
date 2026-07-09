# HEP — Condensed Architecture & Roadmap (planner reference)

Full detail: docs/HEP_Master_Plan_SSoT.md. This file is the fast index.

## Product = 5 modules + platform core (multi-tenant SaaS)
Clinic · Pharmacy · Doctor · Insurance · Patient Portal · Platform Core.

## Stack (build to this)
- Frontend: Next.js 14 (App Router, RSC/SSR) + TypeScript; Zustand + TanStack
  Query; shadcn/ui + Tailwind; React Hook Form + Zod. Mobile: React Native + Expo (later).
- Backend: NestJS 10 (Node 20) microservices; Python 3.12 + FastAPI for ML (later).
- Data: PostgreSQL 16 on Amazon RDS (Multi-AZ, schema-per-tenant); Redis (cache/
  sessions); Apache Kafka (event bus); Elasticsearch (search). Files: S3.
- Interop: HAPI FHIR R4; EDI 837/835; NCPDP.
- Infra: Docker on EC2 ASG; RDS + EC2 cost-optimised; Terraform; ALB; GitHub Actions CI.

## 12 services (services/<name>)
tenant, auth, notification, billing (Platform Core); patient, emr, scheduling,
erx, pharmacy, insurance, portal, analytics.

## Architecture rules
Domain-driven bounded contexts; event-driven via Kafka (sync REST only for
user-facing); CQRS on hot paths; API gateway (auth/tenant/rate-limit); schema-
per-tenant isolation; zero-trust service-to-service; PHI encrypted at column +
disk; audit every mutation.

## MVP phase order (planner MUST respect this)
Phase 0 Foundation: multi-tenancy, auth (JWT+MFA), RBAC, audit, notification
  (SMS+email), FHIR gateway, billing metering, Super Admin onboarding.
Phase 1 Clinic: registration+MRN, basic EMR (SOAP/vitals/allergies), scheduling
  (single provider), ICD-10 coding, cash+insurance billing, EDI 837, payments.
Phase 2 Doctor: dashboard, SOAP editor, drug DB, DDI (Major), drug-allergy,
  e-prescription transmission, medical certs, Clinic<->Doctor integration.
Phase 3 Pharmacy: e-Rx intake, manual Rx, 7-step dispensing, interaction check,
  labels, inventory (single branch), NCPDP claim, refill SMS.
Phase 4 Hardening + launch: E2E integration, perf, HIPAA audit/pentest, billing
  cycle, patient portal MVP, pilot onboarding.
Later (5-8): Insurance module, telemedicine, multi-branch, FWA ML, ABAC/SSO, BI.

## Definition of "surface" for a story (planner tags each)
- backend  → a services/<name> change (API/domain/data/events)
- frontend → an apps/web change (UI consuming an API)
- fullstack→ both (build backend first, then the UI that consumes it)
