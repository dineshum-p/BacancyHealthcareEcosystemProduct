import {
  Building2,
  Pill,
  Stethoscope,
  ShieldCheck,
  UserRound,
  Lock,
  Network,
  ClipboardList,
  BellRing,
  Landmark,
} from "lucide-react";

export interface LandingModule {
  name: string;
  tagline: string;
  icon: typeof Building2;
  idealFor: string;
  features: string[];
}

export const modules: LandingModule[] = [
  {
    name: "Clinic",
    tagline: "Registration, EMR, scheduling, and billing in one workflow.",
    icon: Building2,
    idealFor: "Standalone clinics, group practices, hospital outpatient departments",
    features: [
      "Patient registration with MRN generation and duplicate detection",
      "Longitudinal EMR: vitals, allergies, diagnoses, SOAP notes",
      "Multi-provider scheduling with reminders and waiting lists",
      "Insurance eligibility checks and EDI 837 claim generation",
    ],
  },
  {
    name: "Pharmacy",
    tagline: "E-prescription intake through dispensing, inventory, and claims.",
    icon: Pill,
    idealFor: "Retail pharmacies, hospital dispensaries, specialty pharmacy chains",
    features: [
      "7-step dispensing workflow with drug interaction checks",
      "Real-time stock levels with batch and expiry tracking",
      "NCPDP D.0 claim submission with formulary lookup",
      "Refill sync and medication therapy management",
    ],
  },
  {
    name: "Doctor",
    tagline: "A single dashboard for notes, e-prescribing, and referrals.",
    icon: Stethoscope,
    idealFor: "Independent physicians, specialist practices, telehealth providers",
    features: [
      "Structured SOAP notes with ICD-10/11 inline coding",
      "E-prescribing with drug-drug and drug-allergy alerts",
      "Telehealth video consults and async consultations",
      "Referral management with closed-loop tracking",
    ],
  },
  {
    name: "Insurance",
    tagline: "Policy administration, prior auth, and claims adjudication.",
    icon: Landmark,
    idealFor: "Health insurers, TPAs, self-insured corporate health plans",
    features: [
      "Individual, family, and group policy administration",
      "Real-time prior authorization with auto-approve rules",
      "Configurable auto-adjudication engine with EOB generation",
      "Provider directory, credentialing, and network management",
    ],
  },
  {
    name: "Patient Portal",
    tagline: "The digital front door across every connected module.",
    icon: UserRound,
    idealFor: "Patient-facing access across any combination of connected modules",
    features: [
      "Self-booking for appointments and telehealth",
      "Visit history, lab results, and medication records",
      "Insurance benefits, claim status, and online bill pay",
      "Secure messaging with the care team",
    ],
  },
];

export interface PlatformCoreItem {
  name: string;
  description: string;
  icon: typeof ShieldCheck;
}

export const platformCore: PlatformCoreItem[] = [
  {
    name: "Multi-Tenancy & Isolation",
    description: "Dedicated schema per tenant with row-level security and consent-gated cross-tenant access.",
    icon: Lock,
  },
  {
    name: "Auth, RBAC & ABAC",
    description: "OAuth 2.0 + OIDC with mandatory MFA for clinical roles, role- and attribute-based permissions.",
    icon: ShieldCheck,
  },
  {
    name: "Audit Trail",
    description: "Every action logged with user, role, IP, and timestamp in a tamper-evident store.",
    icon: ClipboardList,
  },
  {
    name: "Notification Engine",
    description: "SMS, email, and in-app notifications on event-driven triggers with tenant-specific templates.",
    icon: BellRing,
  },
  {
    name: "FHIR R4 Gateway",
    description: "Standards-based health data exchange with rate limiting and SMART on FHIR app support.",
    icon: Network,
  },
  {
    name: "Billing Engine",
    description: "Real-time usage metering, tiered invoicing, and payment processing per module.",
    icon: Landmark,
  },
];

export interface PricingTier {
  name: string;
  monthly: string;
  description: string;
  highlighted?: boolean;
}

export const pricingTiers: PricingTier[] = [
  {
    name: "Starter",
    monthly: "$500/mo",
    description: "Platform base fee for a single module and a small provider roster.",
  },
  {
    name: "Growth",
    monthly: "$800/mo",
    description: "Multiple modules with higher transaction volume and priority support.",
    highlighted: true,
  },
  {
    name: "Enterprise",
    monthly: "$1,200/mo",
    description: "All five modules, custom integrations, and dedicated onboarding.",
  },
];

export interface OnboardingFee {
  module: string;
  fee: string;
}

export const onboardingFees: OnboardingFee[] = [
  { module: "Clinic", fee: "$5,000" },
  { module: "Pharmacy", fee: "$4,000" },
  { module: "Doctor", fee: "$3,000" },
  { module: "Insurance", fee: "$8,000" },
  { module: "Patient Portal", fee: "$2,000" },
];

export const complianceBadges = [
  "HIPAA",
  "GDPR",
  "SOC 2 Type II",
  "HL7 FHIR R4",
  "AES-256 + TLS 1.3",
];
