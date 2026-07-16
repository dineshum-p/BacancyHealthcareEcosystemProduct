import type { HepModule, PlanTier } from "@hep/shared-types";

/**
 * Display metadata for the onboarding form's module picker. These are UI
 * labels/descriptions only -- all pricing (fees, discounts) is computed
 * server-side and returned by the pricing quote endpoint, never hardcoded
 * here. Order matches PRD Section 3.
 */
export const MODULE_OPTIONS: ReadonlyArray<{
  module: HepModule;
  label: string;
  blurb: string;
}> = [
  { module: "clinic", label: "Clinic", blurb: "Registration, EMR, scheduling & billing" },
  { module: "pharmacy", label: "Pharmacy", blurb: "Dispensing, inventory & claims" },
  { module: "doctor", label: "Doctor", blurb: "Dashboard, notes & e-prescribing" },
  { module: "insurance", label: "Insurance", blurb: "Policies, prior auth & adjudication" },
  { module: "patient_portal", label: "Patient Portal", blurb: "Booking, records & payments" },
];

export const PLAN_TIER_OPTIONS: ReadonlyArray<{
  tier: PlanTier;
  label: string;
}> = [
  { tier: "starter", label: "Starter" },
  { tier: "growth", label: "Growth" },
  { tier: "enterprise", label: "Enterprise" },
];
