/**
 * service-pricing-profile.ts — T-333 (59th session, DATA-016): the
 * EXHAUSTIVE per-service pricing profile derivation.
 *
 * The owner's mandate (2026-09-13): "when I say precise, per service, I mean
 * every single minute detail of what the price covers: which year, which
 * level, the tranche framework, every included service, every condition,
 * every component that contributes to the final price, and the entire
 * process… structured and detailed enough that the engine cannot
 * misinterpret, translate, or incorrectly reconstruct the profile and price
 * when displaying or processing a student's purchase history."
 *
 * The byService derivation (billing-breakdown.ts, T-164/T-168) stops at the
 * category aggregate: label, count, Σ, share %, child attribution. This
 * module derives the FULL structured profile around the same charge rows:
 *
 *   - academicYear      — which year the price covers (metadata →
 *                         description → catalog → fallback, per service)
 *   - childCoverage     — WHO: every child with grade level (code + label +
 *                         cycle) + class placement + their amount
 *   - items             — WHAT: every charge line itemized with its decoded
 *                         metadata context (tranche, gradeLevel, destination,
 *                         paymentPlan, serviceCode) and its provenance
 *                         (excel_import | current_year_wizard |
 *                         reconciliation | manual, with run id + row)
 *   - catalog           — the OFFICIAL schedule the price maps to: the
 *                         grade's tuition (annual + T1/T2/T3 with due
 *                         months + per-grade FI), the transport destination
 *                         schedule, or the service unit price + billing model
 *   - conditions        — every rule that can modify the price: active
 *                         discount rules, the early-payment bonus (pct +
 *                         deadline), the late penalty (per-day)
 *   - appliedDiscounts  — the reductions ACTUALLY applied to this service
 *                         (ledger adjustment rows) with provenance
 *   - installmentPlan   — the tranche framework (échéancier): every physical
 *                         installment row with due date, paid, pending,
 *                         remaining, status
 *   - construction      — the explicit math: catalogAnnual → billedGross →
 *                         − discountsTotal → billedNet, the delta vs the
 *                         catalog, and a structured explanation
 *
 * Pure functions, no IO — parity-pinnable (the desktop half lives at
 * `elimtiyaz-desktop/src/domain/calc/payment/service-pricing-profile.ts`,
 * consuming domain models; the parallel suites pin identical fixtures,
 * the billing-breakdown precedent).
 *
 * Money semantics: amounts come straight from the rows (Number() on the
 * numeric wire values); DZD throughout. Discounts are reported as positive
 * magnitudes (the ledger convention: negative adjustment = credit).
 */

import type {
  AdditionalServiceRow,
  ComplementaryServiceRow,
  DiscountRow,
  GradeLevelTuitionRow,
  InstallmentRow,
  LedgerEntryRow,
  PricingConfigRow,
  StudentRow,
  TransportDestinationRow,
} from "@/lib/types/database";
import { installmentRemainingAmount } from "./portal-derive";
import { serviceLabelOf } from "./billing-breakdown";

/* ─── The pricing catalog input (built once from the pricing tables) ─────── */

/** One catalog tuition entry (grade → annual + 3 tranches + per-grade FI). */
export interface CatalogTuitionEntry {
  readonly gradeCode: string;
  readonly cycle: string | null;
  readonly annualAmount: number;
  readonly tranches: readonly CatalogTrancheNode[];
  /** Per-student registration fee for this grade (0089 real grid). */
  readonly registrationFee: number | null;
}

/** One catalog tranche: number, amount and the due MONTH (1–12). */
export interface CatalogTrancheNode {
  readonly n: 1 | 2 | 3;
  readonly amount: number;
  readonly dueMonth: number;
}

/** One catalog transport destination entry. */
export interface CatalogTransportEntry {
  readonly code: string;
  readonly label: string;
  readonly annualAmount: number;
  readonly tranches: readonly CatalogTrancheNode[];
}

/** The normalized pricing catalog both derivations consume. */
export interface PricingCatalogInput {
  /** pricing_configs.label ("Tarification 2026-2027"). */
  readonly configLabel: string | null;
  /** The academic year the config is attached to ("2026-2027"). */
  readonly academicYear: string | null;
  readonly registrationFee: number | null;
  readonly latePenaltyPerDay: number | null;
  readonly earlyPaymentBonusPct: number | null;
  readonly earlyPaymentDeadline: string | null;
  readonly tuitionByGrade: readonly CatalogTuitionEntry[];
  readonly transportByDestination: readonly CatalogTransportEntry[];
  readonly additionalServices: readonly {
    code: string;
    label: string;
    amount: number;
    billingModel: string;
  }[];
  readonly complementaryServices: readonly {
    code: string;
    label: string;
    semesterAmount: number;
    annualAmount: number;
    billingModel: string;
  }[];
  readonly discounts: readonly {
    code: string;
    label: string;
    discountType: "percentage" | "fixed_amount";
    /** Percentage (0–100) when percentage; DZD magnitude when fixed. */
    amount: number;
    isActive: boolean;
  }[];
}

/** Build the normalized catalog from the raw pricing rows (the hook's job). */
export function pricingCatalogFromRows(
  config: PricingConfigRow | null,
  tuitionRows: readonly GradeLevelTuitionRow[],
  gradeCodesById: ReadonlyMap<string, { code: string; cycle: string | null }>,
  transportRows: readonly TransportDestinationRow[],
  discountRows: readonly DiscountRow[],
  additionalRows: readonly AdditionalServiceRow[],
  complementaryRows: readonly ComplementaryServiceRow[],
  academicYearLabel: string | null,
): PricingCatalogInput {
  const tuitionByGrade: CatalogTuitionEntry[] = tuitionRows
    .map((t): CatalogTuitionEntry | null => {
      const grade = gradeCodesById.get(t.academic_level_id);
      if (!grade) return null;
      const tranches: readonly CatalogTrancheNode[] = [
        { n: 1 as const, amount: Number(t.tranche_1_amount), dueMonth: t.tranche_1_month },
        { n: 2 as const, amount: Number(t.tranche_2_amount), dueMonth: t.tranche_2_month },
        { n: 3 as const, amount: Number(t.tranche_3_amount), dueMonth: t.tranche_3_month },
      ];
      return {
        gradeCode: grade.code,
        cycle: grade.cycle,
        annualAmount: Number(t.annual_amount),
        registrationFee: t.registration_fee == null ? null : Number(t.registration_fee),
        tranches,
      };
    })
    .filter((e): e is CatalogTuitionEntry => e !== null);

  return {
    configLabel: config?.label ?? null,
    academicYear: academicYearLabel,
    registrationFee: config ? Number(config.registration_fee) : null,
    latePenaltyPerDay: config ? Number(config.late_penalty_per_day) : null,
    earlyPaymentBonusPct: config ? Number(config.early_payment_bonus_pct) : null,
    earlyPaymentDeadline: config?.early_payment_deadline ?? null,
    tuitionByGrade,
    transportByDestination: transportRows.map((t): CatalogTransportEntry => ({
      code: t.code,
      label: t.label_fr,
      annualAmount: Number(t.annual_amount),
      tranches: [
        { n: 1 as const, amount: Number(t.tranche_1_amount), dueMonth: t.tranche_1_month },
        { n: 2 as const, amount: Number(t.tranche_2_amount), dueMonth: t.tranche_2_month },
        { n: 3 as const, amount: Number(t.tranche_3_amount), dueMonth: t.tranche_3_month },
      ],
    })),
    additionalServices: additionalRows.map((a) => ({
      code: a.code,
      label: a.label_fr,
      amount: Number(a.amount),
      billingModel: a.billing_model,
    })),
    complementaryServices: complementaryRows.map((c) => ({
      code: c.code,
      label: c.label_fr,
      semesterAmount: Number(c.semester_amount),
      annualAmount: Number(c.annual_amount),
      billingModel: c.billing_model,
    })),
    discounts: discountRows.map((d) => ({
      code: d.code,
      label: d.label_fr,
      discountType: d.discount_type,
      amount: Number(d.amount),
      isActive: d.is_active,
    })),
  };
}

/* ─── The profile output shape (machine-readable, i18n-free) ────────────── */

/** WHO — one child's coverage of the service, with full identity context. */
export interface ChildCoverageNode {
  readonly studentId: string | null;
  readonly studentName: string;
  readonly studentCode: string | null;
  /** Canonical grade code from students.grade_level_code (e.g. "4am"). */
  readonly gradeLevelCode: string | null;
  /** Human grade label ("4AM") — canonical map, same wording as the desktop. */
  readonly gradeLevelLabel: string | null;
  /** prescolaire | primaire | cem | lycee. */
  readonly cycle: string | null;
  /** Class placement label (classes.name via the class map). */
  readonly classLabel: string | null;
  readonly amount: number;
  readonly itemCount: number;
}

/** Where a billed item came from (the "entire process" leg). */
export interface ChargeProvenance {
  readonly source: "excel_import" | "current_year_wizard" | "reconciliation" | "manual" | "unknown";
  readonly importRunId: string | null;
  readonly reconciliation: string | null;
  readonly excelRow: number | null;
}

/** WHAT — one billed charge line with its decoded context. */
export interface ChargeItemNode {
  readonly id: string;
  readonly studentId: string | null;
  readonly studentName: string;
  readonly amount: number;
  readonly description: string;
  readonly at: string;
  /** Year carried by the row itself (metadata → description), else null. */
  readonly academicYear: string | null;
  readonly gradeLevelCode: string | null;
  readonly trancheNumber: number | null;
  readonly destination: string | null;
  readonly paymentPlan: string | null;
  /** Catalog service code matched from the description/metadata (PSY1…). */
  readonly serviceCode: string | null;
  readonly provenance: ChargeProvenance;
}

/** The official catalog reference the price maps to. */
export interface CatalogReferenceNode {
  readonly kind:
    | "tuition_by_grade"
    | "transport_by_destination"
    | "registration_fee"
    | "additional_service"
    | "complementary_service";
  /** What the reference is scoped to ("4AM (cem)" / "Boumerdès (ville)" / "PSY1"). */
  readonly scopeLabel: string;
  /** The child the reference resolves for (null = family-level). */
  readonly studentId: string | null;
  readonly annualAmount: number | null;
  readonly tranches: readonly CatalogTrancheNode[];
  readonly unitAmount: number | null;
  readonly semesterAmount: number | null;
  readonly billingModel: string | null;
}

/** A condition attached to the price (a rule that can modify it). */
export interface PriceConditionNode {
  readonly kind: "discount_rule" | "early_payment_bonus" | "late_penalty";
  readonly code: string | null;
  readonly label: string;
  readonly value: number;
  readonly valueType: "percentage" | "fixed_dzd";
  readonly deadline: string | null;
  readonly isActive: boolean;
}

/** A reduction actually applied to this service (ledger adjustment row). */
export interface AppliedDiscountNode {
  readonly id: string;
  readonly studentId: string | null;
  readonly studentName: string;
  /** Positive magnitude of the credit. */
  readonly amount: number;
  readonly label: string;
  readonly reason: string | null;
  readonly at: string;
  readonly provenance: ChargeProvenance;
}

/** The tranche framework — one physical installment row. */
export interface InstallmentScheduleNode {
  readonly installmentId: string;
  readonly studentId: string;
  readonly studentName: string;
  readonly label: string;
  readonly trancheNumber: number | null;
  readonly amountDue: number;
  readonly amountPaid: number;
  readonly amountPending: number;
  readonly remaining: number;
  readonly status: string | null;
  readonly dueDate: string | null;
  readonly paymentPlan: string | null;
}

/** The explicit price construction (catalog → gross → net). */
export interface PriceConstructionNode {
  /** Σ the mapped catalog references (null when any child is unmappable). */
  readonly catalogAnnual: number | null;
  readonly billedGross: number;
  readonly discountsTotal: number;
  readonly billedNet: number;
  /** billedNet − catalogAnnual (null when catalogAnnual is null). */
  readonly deltaVsCatalog: number | null;
  /** True when charges exist without physical installment rows. */
  readonly hasSyntheticSchedule: boolean;
}

/** The exhaustive per-service pricing profile. */
export interface ServicePricingProfile {
  readonly category: string;
  /** Refined canonical label ("Scolarité" / "Transport" / "Inscription"). */
  readonly label: string;
  readonly academicYear: string;
  readonly totalBilled: number;
  readonly count: number;
  readonly childCoverage: readonly ChildCoverageNode[];
  readonly items: readonly ChargeItemNode[];
  readonly catalog: readonly CatalogReferenceNode[];
  readonly conditions: readonly PriceConditionNode[];
  readonly appliedDiscounts: readonly AppliedDiscountNode[];
  readonly installmentPlan: readonly InstallmentScheduleNode[];
  readonly construction: PriceConstructionNode;
}

/* ─── Canonical grade label map (verbatim from the desktop student model) ── */

export const GRADE_LEVEL_LABELS_FR: Record<string, string> = {
  prescolaire_1: "Préscolaire 01",
  prescolaire_2: "Préscolaire 02",
  "1ap": "1AP",
  "2ap": "2AP",
  "3ap": "3AP",
  "4ap": "4AP",
  "5ap": "5AP",
  "1am": "1AM",
  "2am": "2AM",
  "3am": "3AM",
  "4am": "4AM",
  "1ere_annee": "1ère Année",
  "2eme_annee": "2ème Année",
  "3eme_annee": "3ème Année",
};

const CYCLE_OF_GRADE: Record<string, string> = {
  prescolaire_1: "prescolaire",
  prescolaire_2: "prescolaire",
  "1ap": "primaire",
  "2ap": "primaire",
  "3ap": "primaire",
  "4ap": "primaire",
  "5ap": "primaire",
  "1am": "cem",
  "2am": "cem",
  "3am": "cem",
  "4am": "cem",
  "1ere_annee": "lycee",
  "2eme_annee": "lycee",
  "3eme_annee": "lycee",
};

const ACADEMIC_YEAR_PATTERN = /20\d{2}[-/]20\d{2}/;
const SINGLE_YEAR_PATTERN = /\b(20\d{2})\b/;

/* ─── Metadata decoding (the "entire process" evidence) ─────────────────── */

interface DecodedMetadata {
  academicYear: string | null;
  gradeLevelCode: string | null;
  trancheNumber: number | null;
  destination: string | null;
  paymentPlan: string | null;
  serviceCode: string | null;
  provenance: ChargeProvenance;
}

function decodeMetadata(row: LedgerEntryRow): DecodedMetadata {
  const meta = (typeof row.metadata === "object" && row.metadata !== null
    ? (row.metadata as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const field = typeof meta.field === "string" ? meta.field : null;
  const importRunId = typeof meta.importRunId === "string" ? meta.importRunId : null;
  const reconciliation = typeof meta.reconciliation === "string" ? meta.reconciliation : null;
  const excelRow = typeof meta.excel_row === "number" ? meta.excel_row : null;

  let source: ChargeProvenance["source"] = "unknown";
  if (reconciliation !== null) source = "reconciliation";
  else if (importRunId !== null) source = "excel_import";
  else if (typeof meta.tranche === "number" || typeof meta.gradeLevel === "string") {
    source = "current_year_wizard";
  } else if (row.description && row.description.trim().length > 0 && !field) {
    source = "manual";
  }

  const academicYear =
    typeof meta.academicYear === "string" && meta.academicYear.length > 0
      ? meta.academicYear
      : row.description?.match(ACADEMIC_YEAR_PATTERN)?.[0] ??
        (row.description?.match(SINGLE_YEAR_PATTERN)?.[1] ?? null);

  return {
    academicYear,
    gradeLevelCode:
      typeof meta.gradeLevel === "string" && meta.gradeLevel.length > 0 ? meta.gradeLevel : null,
    trancheNumber: typeof meta.tranche === "number" ? meta.tranche : null,
    destination:
      typeof meta.destination === "string" && meta.destination.length > 0 ? meta.destination : null,
    paymentPlan:
      typeof meta.paymentPlan === "string" && meta.paymentPlan.length > 0 ? meta.paymentPlan : null,
    serviceCode: field ?? (typeof meta.type === "string" ? meta.type : null),
    provenance: { source, importRunId, reconciliation, excelRow },
  };
}

/* ─── Service-code matching against the catalog (included services) ─────── */

/** Match a charge row to a catalog service code (PSY1/ORTH2/E-PLANT/…). */
function matchServiceCode(
  description: string | null,
  decoded: DecodedMetadata,
  catalog: PricingCatalogInput,
): string | null {
  const haystack = `${description ?? ""} ${decoded.serviceCode ?? ""}`.toLowerCase();
  const candidates = [
    ...catalog.additionalServices.map((s) => ({ code: s.code, label: s.label })),
    ...catalog.complementaryServices.map((s) => ({ code: s.code, label: s.label })),
  ];
  for (const c of candidates) {
    if (decoded.serviceCode && decoded.serviceCode.toLowerCase() === c.code.toLowerCase()) {
      return c.code;
    }
    const short = c.code.replace(/[_\s]/g, "");
    if (short.length >= 3 && haystack.replace(/[_\s-]/g, "").includes(short)) return c.code;
    const labelKey = c.label.toLowerCase();
    if (labelKey.length >= 6 && haystack.includes(labelKey)) return c.code;
  }
  return null;
}

/* ─── Academic-year resolution per service ───────────────────────────────── */

function resolveServiceAcademicYear(
  chargeRows: readonly LedgerEntryRow[],
  catalog: PricingCatalogInput,
  fallback: string,
): string {
  const catalogYear = catalog.academicYear;
  for (const row of chargeRows) {
    const decoded = decodeMetadata(row);
    if (decoded.academicYear) {
      if (ACADEMIC_YEAR_PATTERN.test(decoded.academicYear)) return decoded.academicYear;
      if (catalogYear && catalogYear.startsWith(decoded.academicYear)) return catalogYear;
      return decoded.academicYear;
    }
  }
  return catalogYear ?? fallback;
}

/* ─── Label refinement ───────────────────────────────────────────────────── */

/**
 * The legacy "other" bucket is a registration-fee category when every row
 * says so (metadata.type "registration_fee" or an "inscription" description
 * — the live shape: "Frais d'inscription 2026 (nouvelle famille)").
 */
function isRegistrationCategory(rows: readonly LedgerEntryRow[]): boolean {
  return rows.every(
    (r) =>
      (typeof r.metadata === "object" &&
        r.metadata !== null &&
        (r.metadata as Record<string, unknown>).type === "registration_fee") ||
      /inscription/i.test(r.description ?? ""),
  );
}

/**
 * Refined per-service label: the wire category maps through the canonical
 * SERVICE_LABELS_FR, EXCEPT the legacy "other" bucket whose rows are all
 * registration fees → "Inscription" (the live shape: category "other" +
 * metadata.type "registration_fee" / description "Frais d'inscription").
 */
function refinedLabel(
  category: string,
  chargeRows: readonly LedgerEntryRow[],
): string {
  if (category !== "other") return serviceLabelOf(category);
  return isRegistrationCategory(chargeRows) ? "Inscription" : serviceLabelOf(category);
}

/* ─── The main derivation ────────────────────────────────────────────────── */

export interface ServicePricingProfileInput {
  readonly ledgerRows: readonly LedgerEntryRow[];
  readonly installmentRows: readonly InstallmentRow[];
  readonly kids: readonly StudentRow[];
  readonly catalog: PricingCatalogInput;
  /** class_id → classes.name (the portal's class map; empty = no labels). */
  readonly classLabels?: ReadonlyMap<string, string>;
  /** Fallback academic year (the billing-breakdown resolver's value). */
  readonly fallbackAcademicYear?: string;
}

/**
 * Derive the exhaustive per-service pricing profiles for a family.
 *
 * Pure: same inputs → same outputs on every platform (the desktop half
 * consumes domain models but produces the identical profile shape).
 */
export function servicePricingProfiles(
  input: ServicePricingProfileInput,
): readonly ServicePricingProfile[] {
  const { ledgerRows, installmentRows, kids, catalog } = input;
  const classLabels = input.classLabels ?? new Map<string, string>();
  const fallbackYear = input.fallbackAcademicYear ?? "2025-2026";

  const chargeRows = ledgerRows.filter((r) => r.entry_type === "charge");
  const adjustmentRows = ledgerRows.filter((r) => r.entry_type === "adjustment");

  const nameOf = (studentId: string | null): string => {
    if (studentId == null) return "Famille";
    const k = kids.find((x) => x.id === studentId);
    return k ? `${k.first_name} ${k.last_name}`.trim() : "Famille";
  };

  const gradeInfoOf = (studentId: string | null) => {
    const k = studentId == null ? undefined : kids.find((x) => x.id === studentId);
    const code = k?.grade_level_code ?? null;
    return {
      gradeLevelCode: code,
      gradeLevelLabel: code ? (GRADE_LEVEL_LABELS_FR[code] ?? code) : null,
      cycle: code ? (CYCLE_OF_GRADE[code] ?? null) : null,
      classLabel:
        k?.class_id != null ? (classLabels.get(k.class_id) ?? null) : null,
    };
  };

  // Group the charge rows by category (order: amount desc, like byService).
  const byCategory = new Map<string, LedgerEntryRow[]>();
  for (const row of chargeRows) {
    const category = row.category ?? "other";
    const list = byCategory.get(category) ?? [];
    list.push(row);
    byCategory.set(category, list);
  }

  const profiles: ServicePricingProfile[] = [];
  for (const [category, rows] of byCategory) {
    const totalBilled = rows.reduce((s, r) => s + Number(r.amount), 0);

    /* WHO — per-child coverage. */
    const coverageMap = new Map<string, ChildCoverageNode>();
    for (const row of rows) {
      const key = row.student_id ?? "__family__";
      const grade = gradeInfoOf(row.student_id);
      const kid = row.student_id == null ? undefined : kids.find((x) => x.id === row.student_id);
      const existing = coverageMap.get(key);
      coverageMap.set(key, {
        studentId: row.student_id ?? null,
        studentName: nameOf(row.student_id),
        studentCode: kid?.student_code ?? null,
        ...grade,
        amount: (existing?.amount ?? 0) + Number(row.amount),
        itemCount: (existing?.itemCount ?? 0) + 1,
      });
    }
    const childCoverage = [...coverageMap.values()].sort((a, b) => b.amount - a.amount);

    /* WHAT — the itemized charge list with decoded context. */
    const items: ChargeItemNode[] = rows.map((row) => {
      const decoded = decodeMetadata(row);
      return {
        id: row.entry_number ?? row.id ?? `${row.parent_id}-${row.at}`,
        studentId: row.student_id ?? null,
        studentName: nameOf(row.student_id),
        amount: Number(row.amount),
        description: row.description?.trim() ?? "",
        at: row.at,
        academicYear: decoded.academicYear,
        gradeLevelCode: decoded.gradeLevelCode,
        trancheNumber: decoded.trancheNumber,
        destination: decoded.destination,
        paymentPlan: decoded.paymentPlan,
        serviceCode: matchServiceCode(row.description, decoded, catalog),
        provenance: decoded.provenance,
      };
    });

    /* REFERENCE — the catalog nodes the price maps to. */
    const catalogRefs: CatalogReferenceNode[] = [];
    if (category === "tuition") {
      for (const child of childCoverage) {
        // Prefer the row's own gradeLevel metadata, then the student's grade.
        const rowGrade =
          items.find((i) => i.studentId === child.studentId && i.gradeLevelCode)?.gradeLevelCode ??
          null;
        const gradeCode = rowGrade ?? child.gradeLevelCode;
        const entry =
          gradeCode == null
            ? undefined
            : catalog.tuitionByGrade.find((t) => t.gradeCode === gradeCode);
        catalogRefs.push({
          kind: "tuition_by_grade",
          scopeLabel: gradeCode
            ? `${GRADE_LEVEL_LABELS_FR[gradeCode] ?? gradeCode}${child.cycle ? ` (${child.cycle})` : ""}`
            : "—",
          studentId: child.studentId,
          annualAmount: entry?.annualAmount ?? null,
          tranches: entry?.tranches ?? [],
          unitAmount: null,
          semesterAmount: null,
          billingModel: null,
        });
      }
    } else if (category === "transport") {
      // Destination from the rows' metadata (one reference per distinct zone).
      const zones = new Set<string>();
      for (const item of items) {
        if (item.destination) zones.add(item.destination);
      }
      for (const zone of zones) {
        const entry = catalog.transportByDestination.find((t) => t.code === zone);
        catalogRefs.push({
          kind: "transport_by_destination",
          scopeLabel: entry?.label ?? zone,
          studentId: items.find((i) => i.destination === zone)?.studentId ?? null,
          annualAmount: entry?.annualAmount ?? null,
          tranches: entry?.tranches ?? [],
          unitAmount: null,
          semesterAmount: null,
          billingModel: null,
        });
      }
    } else if (category === "other" && isRegistrationCategory(rows)) {
      // Registration fees (the live "other" shape) → the FI references.
      for (const child of childCoverage) {
        // A family-level registration row in a SINGLE-child family belongs to
        // that child (the billing-breakdown attribution rule) — resolve their
        // grade so the per-grade FI maps; multi-child/family → flat fee.
        const ownerGrade =
          child.gradeLevelCode ??
          (child.studentId == null && kids.length === 1
            ? kids[0].grade_level_code
            : null);
        const entry =
          ownerGrade == null
            ? undefined
            : catalog.tuitionByGrade.find((t) => t.gradeCode === ownerGrade);
        catalogRefs.push({
          kind: "registration_fee",
          scopeLabel: ownerGrade
            ? `${GRADE_LEVEL_LABELS_FR[ownerGrade] ?? ownerGrade}`
            : "—",
          studentId: child.studentId,
          annualAmount: entry?.registrationFee ?? catalog.registrationFee,
          tranches: [],
          unitAmount: entry?.registrationFee ?? catalog.registrationFee,
          semesterAmount: null,
          billingModel: "one_time",
        });
      }
    } else {
      // Additional / complementary services → the unit-price references
      // (also the "other" bucket when NOT a registration: PSY/ORTH/…).
      for (const item of items) {
        if (!item.serviceCode) continue;
        const additional = catalog.additionalServices.find(
          (s) => s.code.toLowerCase() === item.serviceCode!.toLowerCase(),
        );
        if (additional) {
          catalogRefs.push({
            kind: "additional_service",
            scopeLabel: additional.label,
            studentId: item.studentId,
            annualAmount: null,
            tranches: [],
            unitAmount: additional.amount,
            semesterAmount: null,
            billingModel: additional.billingModel,
          });
          continue;
        }
        const complementary = catalog.complementaryServices.find(
          (s) => s.code.toLowerCase() === item.serviceCode!.toLowerCase(),
        );
        if (complementary) {
          catalogRefs.push({
            kind: "complementary_service",
            scopeLabel: complementary.label,
            studentId: item.studentId,
            annualAmount: complementary.annualAmount,
            tranches: [],
            unitAmount: null,
            semesterAmount: complementary.semesterAmount,
            billingModel: complementary.billingModel,
          });
        }
      }
    }

    /* CONDITIONS — every rule that can modify the price. */
    const conditions: PriceConditionNode[] = catalog.discounts
      .filter((d) => d.isActive)
      .filter((d) => (category === "tuition" ? true : d.code === "sibling_fixed"))
      .map((d) => ({
        kind: "discount_rule" as const,
        code: d.code,
        label: d.label,
        value: d.amount,
        valueType: d.discountType === "percentage" ? ("percentage" as const) : ("fixed_dzd" as const),
        deadline: null,
        isActive: d.isActive,
      }));
    if (category === "tuition" && catalog.earlyPaymentBonusPct != null) {
      conditions.push({
        kind: "early_payment_bonus",
        code: "full_annual",
        label: "Paiement annuel avant le 30 juin",
        value: catalog.earlyPaymentBonusPct,
        valueType: "percentage",
        deadline: catalog.earlyPaymentDeadline,
        isActive: true,
      });
    }
    if (catalog.latePenaltyPerDay != null) {
      conditions.push({
        kind: "late_penalty",
        code: null,
        label: "Pénalité de retard",
        value: catalog.latePenaltyPerDay,
        valueType: "fixed_dzd",
        deadline: null,
        isActive: true,
      });
    }

    /* APPLIED DISCOUNTS — the service's credit adjustments. */
    const appliedDiscounts: AppliedDiscountNode[] = adjustmentRows
      .filter((r) => (r.category ?? "other") === category && Number(r.amount) < 0)
      .map((r) => {
        const decoded = decodeMetadata(r);
        return {
          id: r.entry_number ?? r.id ?? `${r.parent_id}-${r.at}`,
          studentId: r.student_id ?? null,
          studentName: nameOf(r.student_id),
          amount: Math.abs(Number(r.amount)),
          label: r.description?.trim() || "Remise",
          reason: r.description?.trim() ?? null,
          at: r.at,
          provenance: decoded.provenance,
        };
      });

    /* THE TRANCHE FRAMEWORK — physical installment rows for this service. */
    const installmentPlan: InstallmentScheduleNode[] = installmentRows
      .filter(
        (i) =>
          (i.category ?? "tuition") === category &&
          (i.student_id == null ||
            childCoverage.some((c) => c.studentId === i.student_id) ||
            kids.some((k) => k.id === i.student_id)),
      )
      .slice()
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
      .map((i) => ({
        installmentId: i.id,
        studentId: i.student_id,
        studentName: nameOf(i.student_id),
        label: i.label?.trim() || `Tranche ${i.tranche_number}`,
        trancheNumber: i.tranche_number ?? null,
        amountDue: Number(i.amount_due),
        amountPaid: Number(i.amount_paid),
        amountPending: Number(i.amount_pending ?? 0),
        remaining: installmentRemainingAmount(i),
        status: i.status,
        dueDate: i.due_date,
        paymentPlan: i.payment_plan ?? null,
      }));

    /* CONSTRUCTION — the explicit math. */
    const mappedAnnuals = catalogRefs.map((c) => c.annualAmount).filter((v): v is number => v != null);
    const catalogAnnual =
      catalogRefs.length > 0 && mappedAnnuals.length === catalogRefs.length
        ? mappedAnnuals.reduce((s, v) => s + v, 0)
        : null;
    const billedGross = totalBilled;
    const discountsTotal = appliedDiscounts.reduce((s, d) => s + d.amount, 0);
    const billedNet = billedGross - discountsTotal;
    const deltaVsCatalog = catalogAnnual == null ? null : billedNet - catalogAnnual;
    const hasSyntheticSchedule = rows.length > 0 && installmentPlan.length === 0;

    profiles.push({
      category,
      label: refinedLabel(category, rows),
      academicYear: resolveServiceAcademicYear(rows, catalog, fallbackYear),
      totalBilled,
      count: rows.length,
      childCoverage,
      items,
      catalog: catalogRefs,
      conditions,
      appliedDiscounts,
      installmentPlan,
      construction: {
        catalogAnnual,
        billedGross,
        discountsTotal,
        billedNet,
        deltaVsCatalog,
        hasSyntheticSchedule,
      },
    });
  }

  return profiles.sort((a, b) => b.totalBilled - a.totalBilled);
}
