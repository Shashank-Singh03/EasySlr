/**
 * Review vocabulary, defined here (not imported from the Prisma client) so client components can use
 * it without pulling the server-only Prisma runtime into the browser bundle. The string values match
 * the Prisma `Decision` enum exactly.
 */
export const DECISIONS = ["UNREVIEWED", "INCLUDE", "EXCLUDE", "MAYBE"] as const;
export type Decision = (typeof DECISIONS)[number];

export const DECISION_LABELS: Record<Decision, string> = {
  UNREVIEWED: "Unreviewed",
  INCLUDE: "Include",
  EXCLUDE: "Exclude",
  MAYBE: "Maybe",
};

export const DECISION_STYLES: Record<Decision, string> = {
  UNREVIEWED: "bg-slate-100 text-slate-600",
  INCLUDE: "bg-green-100 text-green-800",
  EXCLUDE: "bg-red-100 text-red-800",
  MAYBE: "bg-amber-100 text-amber-800",
};

/** Common full-text-screening exclusion reasons (PRISMA). Free text is also allowed. */
export const EXCLUSION_REASONS = [
  "Wrong population",
  "Wrong intervention",
  "Wrong outcome",
  "Wrong study design",
  "Duplicate record",
  "Full text unavailable",
  "Other",
] as const;
