/**
 * service-pricing-profile.ts — website canonical derivation tests (T-333,
 * 59th session / DATA-016).
 *
 * The owner's mandate: the per-service price must be EXHAUSTIVE — "every
 * single minute detail of what the price covers: which year, which level,
 * the tranche framework, every included service, every condition, every
 * component that contributes to the final price, and the entire process…
 * structured and detailed enough that the engine cannot misinterpret,
 * translate, or incorrectly reconstruct the profile and price".
 *
 * These tests pin exactly that against vectors mirroring the LIVE evidence
 * (the owner's screenshot family: LINDA ALIOUAT, grade 4am, devis 350 000,
 * catalog 4am annual 340 000, FI/V2/2V schedule, remise −20 000, Excel
 * import provenance) — the same fixtures the desktop half consumes
 * (hub: src/tests/domain/payment/service-pricing-profile.test.ts, T-334),
 * so both platforms are verified against the SAME vectors
 * (the billing-breakdown.test.ts precedent).
 */
import { describe, expect, it } from "vitest";
import {
  servicePricingProfiles,
  pricingCatalogFromRows,
  type PricingCatalogInput,
} from "@/lib/canonical/service-pricing-profile";
import type {
  LedgerEntryRow,
  InstallmentRow,
  StudentRow,
  PricingConfigRow,
  GradeLevelTuitionRow,
  TransportDestinationRow,
  DiscountRow,
  AdditionalServiceRow,
  ComplementaryServiceRow,
} from "@/lib/types/database";

/* ─── Fixtures (typed against the real contracts — §15.25) ──────────────── */

function ledgerRow(overrides: Partial<LedgerEntryRow>): LedgerEntryRow {
  return {
    id: null,
    entry_number: "led-test-1",
    tenant_id: "t1",
    account_id: "parent:p1:category:tuition",
    parent_id: "p1",
    student_id: "s1",
    category: "tuition",
    amount: 350000,
    entry_type: "charge",
    source_type: "bulk_import",
    source_id: null,
    method: null,
    receipt_number: null,
    payment_status: null,
    reverses_id: null,
    description: "Devis annuel (import Excel run run_msp3foah_c254f9)",
    actor_id: "u1",
    actor_name: "Import",
    at: "2025-08-11T20:11:57Z",
    metadata: { field: "DEVIS_ANNUEL", importRunId: "run_msp3foah_c254f9" },
    created_at: "2025-08-11T20:11:57Z",
    ...overrides,
  };
}

function installmentRow(overrides: Partial<InstallmentRow>): InstallmentRow {
  return {
    id: "ins-1",
    tenant_id: "t1",
    parent_id: "p1",
    student_id: "s1",
    service_enrollment_id: "se-1",
    invoice_id: null,
    tranche_number: 1,
    amount_due: 132000,
    amount_paid: 132000,
    amount_pending: 0,
    due_date: "2025-09-15",
    paid_date: null,
    status: "paid",
    academic_cycle: "cem",
    payment_plan: "tranches",
    is_custom_schedule: true,
    custom_schedule_note: "Devis importé",
    label: "INSCRIPTION (FI)",
    category: "tuition",
    created_at: "2025-08-11T20:11:57Z",
    updated_at: "2025-08-11T20:11:57Z",
    ...overrides,
  };
}

function kid(overrides: Partial<StudentRow>): StudentRow {
  return {
    id: "s1",
    tenant_id: "t1",
    parent_id: "p1",
    student_code: "ELV-000001",
    first_name: "LINDA",
    middle_name: null,
    last_name: "ALIOUAT",
    date_of_birth: "2012-05-14",
    gender: "female",
    grade_level_id: "lvl-4am",
    grade_level_code: "4am",
    class_id: "cls-4am-a",
    enrollment_date: "2025-09-01",
    enrollment_status: "active",
    medical_notes: null,
    is_active: true,
    auth_user_id: null,
    created_at: "2025-08-11T20:11:57Z",
    updated_at: "2025-08-11T20:11:57Z",
    deleted_at: null,
    ...overrides,
  };
}

const CONFIG: PricingConfigRow = {
  id: "pc-1",
  tenant_id: "t1",
  academic_year_id: "ay-1",
  label: "Tarification 2026-2027",
  registration_fee: 5000,
  late_penalty_per_day: 100,
  second_apron_fee: 2000,
  early_payment_bonus_pct: 5,
  early_payment_deadline: "2026-06-30",
  is_active: true,
  created_at: "2025-08-01T00:00:00Z",
  updated_at: "2025-08-01T00:00:00Z",
};

function tuitionRow(overrides: Partial<GradeLevelTuitionRow>): GradeLevelTuitionRow {
  return {
    id: "glt-4am",
    pricing_config_id: "pc-1",
    academic_level_id: "lvl-4am",
    annual_amount: 340000,
    tranche_1_amount: 136000,
    tranche_2_amount: 102000,
    tranche_3_amount: 102000,
    tranche_1_month: 9,
    tranche_2_month: 12,
    tranche_3_month: 3,
    registration_fee: 24000,
    ...overrides,
  };
}

const TRANSPORT: TransportDestinationRow = {
  id: "td-1",
  code: "tidjelabine_sahel_figuier_corso",
  label_fr: "Tidjelabine, Sahel, Figuier, Corso",
  label_ar: null,
  annual_amount: 43000,
  tranche_1_amount: 16000,
  tranche_2_amount: 16000,
  tranche_3_amount: 11000,
  tranche_1_month: 9,
  tranche_2_month: 12,
  tranche_3_month: 3,
};

const DISCOUNTS: DiscountRow[] = [
  {
    id: "d-1",
    pricing_config_id: "pc-1",
    code: "sibling_fixed",
    label_fr: "Fratrie",
    label_ar: null,
    discount_type: "fixed_amount",
    amount: 5000,
    is_active: true,
  },
  {
    id: "d-2",
    pricing_config_id: "pc-1",
    code: "full_annual",
    label_fr: "Paiement annuel avant le 30 juin (−5% scolarité)",
    label_ar: null,
    discount_type: "percentage",
    amount: 5,
    is_active: true,
  },
  {
    id: "d-3",
    pricing_config_id: "pc-1",
    code: "seniority_5y",
    label_fr: "Ancienneté > 5 ans [RÈGLE FICTIVE — désactivée]",
    label_ar: null,
    discount_type: "percentage",
    amount: 5,
    is_active: false,
  },
];

const ADDITIONAL: AdditionalServiceRow[] = [
  {
    id: "as-1",
    pricing_config_id: "pc-1",
    code: "psy1",
    label_fr: "Séances de psychologie — 1er semestre (PSY1)",
    label_ar: null,
    amount: 10000,
    billing_model: "one_time",
    is_active: true,
    updated_at: "2025-08-01T00:00:00Z",
  },
];

const COMPLEMENTARY: ComplementaryServiceRow[] = [
  {
    id: "cs-1",
    pricing_config_id: "pc-1",
    code: "psychology",
    label_fr: "Psychologie",
    label_ar: null,
    semester_amount: 20000,
    annual_amount: 40000,
    billing_model: "per_session",
    is_active: true,
    updated_at: "2025-08-01T00:00:00Z",
  },
];

const GRADE_MAP = new Map<string, { code: string; cycle: string | null }>([
  ["lvl-4am", { code: "4am", cycle: "cem" }],
  ["lvl-2ap", { code: "2ap", cycle: "primaire" }],
]);

const CATALOG: PricingCatalogInput = pricingCatalogFromRows(
  CONFIG,
  [tuitionRow({}), tuitionRow({ id: "glt-2ap", academic_level_id: "lvl-2ap", annual_amount: 240000, tranche_1_amount: 97000, tranche_2_amount: 71500, tranche_3_amount: 71500, registration_fee: 20000 })],
  GRADE_MAP,
  [TRANSPORT],
  DISCOUNTS,
  ADDITIONAL,
  COMPLEMENTARY,
  "2026-2027",
);

const CLASS_LABELS = new Map([["cls-4am-a", "4AM-A · B12"]]);

/* ─── The suite ──────────────────────────────────────────────────────────── */

describe("servicePricingProfiles — the exhaustive tuition profile (LIVE ALIOUAT vector)", () => {
  const linda = kid({});
  const rows = [
    ledgerRow({}), // devis 350 000 (Excel import)
    ledgerRow({
      entry_number: "led-test-remise",
      entry_type: "adjustment",
      amount: -20000,
      description: "Remise sur devis (import Excel run run_msp3foah_c254f9)",
      metadata: { field: "REMISE", importRunId: "run_msp3foah_c254f9" },
    }),
  ];
  const installments = [
    installmentRow({ id: "i1", tranche_number: 1, label: "INSCRIPTION (FI)", amount_due: 132000, amount_paid: 132000, status: "paid", due_date: "2025-09-15" }),
    installmentRow({ id: "i2", tranche_number: 2, label: "2EME TRANCHE (V2)", amount_due: 99000, amount_paid: 14000, status: "partial", due_date: "2025-12-15" }),
    installmentRow({ id: "i3", tranche_number: 3, label: "3ème TRANCHE (2V)", amount_due: 119000, amount_paid: 0, status: "unpaid", due_date: "2026-03-15" }),
  ];

  const profiles = servicePricingProfiles({
    ledgerRows: rows,
    installmentRows: installments,
    kids: [linda],
    catalog: CATALOG,
    classLabels: CLASS_LABELS,
    fallbackAcademicYear: "2025-2026",
  });

  it("derives exactly one tuition profile carrying every detail", () => {
    expect(profiles).toHaveLength(1);
    const p = profiles[0];
    expect(p.category).toBe("tuition");
    expect(p.label).toBe("Scolarité");
    expect(p.count).toBe(1);
    expect(p.totalBilled).toBe(350000);
  });

  it("resolves the academic year through the catalog when rows carry no year", () => {
    // The legacy import row has NO year in metadata/description → catalog year.
    expect(profiles[0].academicYear).toBe("2026-2027");
  });

  it("covers WHO: the child's grade level (code + label + cycle) + class + code", () => {
    const c = profiles[0].childCoverage[0];
    expect(c.studentId).toBe("s1");
    expect(c.studentName).toBe("LINDA ALIOUAT");
    expect(c.studentCode).toBe("ELV-000001");
    expect(c.gradeLevelCode).toBe("4am");
    expect(c.gradeLevelLabel).toBe("4AM");
    expect(c.cycle).toBe("cem");
    expect(c.classLabel).toBe("4AM-A · B12");
    expect(c.amount).toBe(350000);
    expect(c.itemCount).toBe(1);
  });

  it("covers the CATALOG REFERENCE: the grade's annual + T1/T2/T3 with due months", () => {
    const ref = profiles[0].catalog[0];
    expect(ref.kind).toBe("tuition_by_grade");
    expect(ref.scopeLabel).toBe("4AM (cem)");
    expect(ref.studentId).toBe("s1");
    expect(ref.annualAmount).toBe(340000);
    expect(ref.tranches).toEqual([
      { n: 1, amount: 136000, dueMonth: 9 },
      { n: 2, amount: 102000, dueMonth: 12 },
      { n: 3, amount: 102000, dueMonth: 3 },
    ]);
  });

  it("covers the CONDITIONS: active discounts + early-payment bonus + late penalty", () => {
    const conditions = profiles[0].conditions;
    const codes = conditions.map((c) => c.code);
    expect(codes).toContain("sibling_fixed");
    expect(codes).toContain("full_annual");
    expect(codes).not.toContain("seniority_5y"); // inactive → never surfaced
    const early = conditions.find((c) => c.kind === "early_payment_bonus");
    expect(early?.value).toBe(5);
    expect(early?.deadline).toBe("2026-06-30");
    const late = conditions.find((c) => c.kind === "late_penalty");
    expect(late?.value).toBe(100);
    expect(late?.valueType).toBe("fixed_dzd");
  });

  it("covers the APPLIED DISCOUNT with provenance (the −20 000 remise)", () => {
    const d = profiles[0].appliedDiscounts[0];
    expect(d.amount).toBe(20000);
    expect(d.studentName).toBe("LINDA ALIOUAT");
    expect(d.provenance.source).toBe("excel_import");
    expect(d.provenance.importRunId).toBe("run_msp3foah_c254f9");
  });

  it("covers the TRANCHE FRAMEWORK: FI/V2/2V with due dates + status + remaining", () => {
    const plan = profiles[0].installmentPlan;
    expect(plan).toHaveLength(3);
    expect(plan.map((p) => p.label)).toEqual([
      "INSCRIPTION (FI)",
      "2EME TRANCHE (V2)",
      "3ème TRANCHE (2V)",
    ]);
    expect(plan[1].amountDue).toBe(99000);
    expect(plan[1].amountPaid).toBe(14000);
    expect(plan[1].remaining).toBe(85000);
    expect(plan[1].status).toBe("partial");
    expect(plan[1].paymentPlan).toBe("tranches");
  });

  it("covers the CONSTRUCTION: catalog 340 000 → devis 350 000 → −20 000 → net 330 000 (delta −10 000)", () => {
    const c = profiles[0].construction;
    expect(c.catalogAnnual).toBe(340000);
    expect(c.billedGross).toBe(350000);
    expect(c.discountsTotal).toBe(20000);
    expect(c.billedNet).toBe(330000);
    expect(c.deltaVsCatalog).toBe(-10000);
    expect(c.hasSyntheticSchedule).toBe(false);
  });

  it("decodes the item's provenance (Excel import + run id)", () => {
    const item = profiles[0].items[0];
    expect(item.amount).toBe(350000);
    expect(item.description).toContain("Devis annuel");
    expect(item.provenance.source).toBe("excel_import");
    expect(item.provenance.importRunId).toBe("run_msp3foah_c254f9");
    expect(item.academicYear).toBeNull(); // the legacy row carries no year
  });
});

describe("servicePricingProfiles — provenance + year decoding", () => {
  it("recognizes the current-year wizard rows (tranche + gradeLevel + paymentPlan metadata)", () => {
    const profiles = servicePricingProfiles({
      ledgerRows: [
        ledgerRow({
          entry_number: "led-new-1",
          amount: 205000,
          description: "Scolarité 2026 — Tranche 1 (2ap)",
          metadata: { tranche: 1, gradeLevel: "2ap", paymentPlan: "full_annual" },
          at: "2026-09-12T14:42:00Z",
        }),
      ],
      installmentRows: [],
      kids: [kid({ id: "s1", grade_level_code: "2ap", grade_level_id: "lvl-2ap" })],
      catalog: CATALOG,
    });
    const p = profiles[0];
    const item = p.items[0];
    expect(item.provenance.source).toBe("current_year_wizard");
    expect(item.trancheNumber).toBe(1);
    expect(item.gradeLevelCode).toBe("2ap");
    expect(item.paymentPlan).toBe("full_annual");
    // "Scolarité 2026" + catalog "2026-2027" → the full year label.
    expect(p.academicYear).toBe("2026-2027");
    // The catalog reference prefers the ROW's gradeLevel over the student's.
    expect(p.catalog[0].scopeLabel).toBe("2AP (primaire)");
    expect(p.catalog[0].annualAmount).toBe(240000);
    // Charges with NO physical installment rows → synthetic schedule flag.
    expect(p.construction.hasSyntheticSchedule).toBe(true);
  });

  it("recognizes reconciliation rows (reconciliation metadata wins)", () => {
    const profiles = servicePricingProfiles({
      ledgerRows: [
        ledgerRow({
          entry_number: "led-recon-1",
          amount: 255000,
          description: "Devis annuel (réconciliation 0063 — ligne 242 du classeur source)",
          metadata: { excel_row: 242, reconciliation: "0063" },
        }),
      ],
      installmentRows: [],
      kids: [kid({})],
      catalog: CATALOG,
    });
    expect(profiles[0].items[0].provenance.source).toBe("reconciliation");
    expect(profiles[0].items[0].provenance.reconciliation).toBe("0063");
    expect(profiles[0].items[0].provenance.excelRow).toBe(242);
  });
});

describe("servicePricingProfiles — transport + registration + services", () => {
  it("derives the transport profile with the destination catalog reference", () => {
    const profiles = servicePricingProfiles({
      ledgerRows: [
        ledgerRow({
          entry_number: "led-t1",
          category: "transport",
          amount: 11000,
          description: "Transport 2026 — Tranche 3 (tidjelabine_sahel_figuier_corso)",
          metadata: { tranche: 3, destination: "tidjelabine_sahel_figuier_corso" },
        }),
        ledgerRow({
          entry_number: "led-t2",
          category: "transport",
          amount: 16000,
          description: "Transport 2026 — Tranche 1 (tidjelabine_sahel_figuier_corso)",
          metadata: { tranche: 1, destination: "tidjelabine_sahel_figuier_corso" },
        }),
      ],
      installmentRows: [
        installmentRow({
          id: "it1",
          category: "transport",
          label: "Tranche 1 — Transport",
          amount_due: 16000,
          amount_paid: 16000,
          status: "paid",
        }),
      ],
      kids: [kid({})],
      catalog: CATALOG,
    });
    const p = profiles[0];
    expect(p.category).toBe("transport");
    expect(p.label).toBe("Transport");
    expect(p.totalBilled).toBe(27000);
    // ONE catalog reference per distinct zone.
    expect(p.catalog).toHaveLength(1);
    expect(p.catalog[0].kind).toBe("transport_by_destination");
    expect(p.catalog[0].scopeLabel).toBe("Tidjelabine, Sahel, Figuier, Corso");
    expect(p.catalog[0].annualAmount).toBe(43000);
    expect(p.catalog[0].tranches[2]).toEqual({ n: 3, amount: 11000, dueMonth: 3 });
    // Both items decoded with destination + tranche.
    expect(p.items.map((i) => i.destination)).toEqual([
      "tidjelabine_sahel_figuier_corso",
      "tidjelabine_sahel_figuier_corso",
    ]);
    // Transport conditions: sibling + late penalty (no tuition-only rules).
    expect(p.conditions.map((c) => c.code)).toContain("sibling_fixed");
    expect(p.conditions.some((c) => c.kind === "early_payment_bonus")).toBe(false);
  });

  it("refines the legacy 'other' registration bucket to the Inscription profile with the per-grade FI", () => {
    const profiles = servicePricingProfiles({
      ledgerRows: [
        ledgerRow({
          entry_number: "led-fi",
          category: "other",
          student_id: null,
          amount: 5000,
          description: "Frais d'inscription 2026 (nouvelle famille)",
          metadata: { type: "registration_fee" },
        }),
      ],
      installmentRows: [],
      kids: [kid({})],
      catalog: CATALOG,
    });
    const p = profiles[0];
    expect(p.label).toBe("Inscription");
    expect(p.catalog[0].kind).toBe("registration_fee");
    // The student's grade maps to the per-grade FI (4am → 24 000).
    expect(p.catalog[0].unitAmount).toBe(24000);
    expect(p.catalog[0].billingModel).toBe("one_time");
  });

  it("maps an additional-service charge to the catalog service (PSY1)", () => {
    const profiles = servicePricingProfiles({
      ledgerRows: [
        ledgerRow({
          entry_number: "led-psy",
          category: "other",
          amount: 10000,
          description: "Séances de psychologie — 1er semestre (PSY1)",
          metadata: { field: "PSY1" },
        }),
      ],
      installmentRows: [],
      kids: [kid({})],
      catalog: CATALOG,
    });
    const p = profiles[0];
    expect(p.items[0].serviceCode).toBe("psy1");
    const ref = p.catalog.find((r) => r.kind === "additional_service");
    expect(ref?.scopeLabel).toBe("Séances de psychologie — 1er semestre (PSY1)");
    expect(ref?.unitAmount).toBe(10000);
    expect(ref?.billingModel).toBe("one_time");
  });
});

describe("servicePricingProfiles — multi-child coverage + machine-readability", () => {
  it("attributes every child with their own grade context (the 2-child vector)", () => {
    const linda = kid({});
    const adem = kid({
      id: "s2",
      first_name: "ADEM",
      grade_level_id: "lvl-2ap",
      grade_level_code: "2ap",
      class_id: "cls-2ap-a",
      student_code: "ELV-000002",
    });
    const profiles = servicePricingProfiles({
      ledgerRows: [
        ledgerRow({ entry_number: "l-linda", student_id: "s1", amount: 350000 }),
        ledgerRow({ entry_number: "l-adem", student_id: "s2", amount: 240000 }),
      ],
      installmentRows: [],
      kids: [linda, adem],
      catalog: CATALOG,
    });
    expect(profiles[0].childCoverage.map((c) => c.gradeLevelCode)).toEqual(["4am", "2ap"]);
    expect(profiles[0].childCoverage.map((c) => c.gradeLevelLabel)).toEqual(["4AM", "2AP"]);
    // Catalog references per child, each mapped to their grade schedule.
    expect(profiles[0].catalog.map((r) => r.scopeLabel)).toEqual(["4AM (cem)", "2AP (primaire)"]);
    // Σ of both children's catalog annuals.
    expect(profiles[0].construction.catalogAnnual).toBe(580000);
  });

  it("produces a fully JSON-serializable profile (no display strings, no functions)", () => {
    const profiles = servicePricingProfiles({
      ledgerRows: [ledgerRow({})],
      installmentRows: [installmentRow({})],
      kids: [kid({})],
      catalog: CATALOG,
    });
    const json = JSON.parse(JSON.stringify(profiles));
    expect(json[0].construction.billedNet).toBe(350000);
    expect(json[0].childCoverage[0].gradeLevelCode).toBe("4am");
    expect(json[0].installmentPlan[0].remaining).toBe(0);
  });

  it("sorts profiles by total billed descending (the byService order)", () => {
    const profiles = servicePricingProfiles({
      ledgerRows: [
        ledgerRow({ entry_number: "l-1", category: "transport", amount: 11000 }),
        ledgerRow({ entry_number: "l-2", amount: 350000 }),
      ],
      installmentRows: [],
      kids: [kid({})],
      catalog: CATALOG,
    });
    expect(profiles.map((p) => p.category)).toEqual(["tuition", "transport"]);
  });
});

describe("pricingCatalogFromRows — the normalized catalog input", () => {
  it("maps the pricing tables verbatim (amounts, tranches, discounts)", () => {
    expect(CATALOG.configLabel).toBe("Tarification 2026-2027");
    expect(CATALOG.academicYear).toBe("2026-2027");
    expect(CATALOG.registrationFee).toBe(5000);
    expect(CATALOG.latePenaltyPerDay).toBe(100);
    expect(CATALOG.earlyPaymentBonusPct).toBe(5);
    expect(CATALOG.earlyPaymentDeadline).toBe("2026-06-30");
    const g4 = CATALOG.tuitionByGrade.find((t) => t.gradeCode === "4am");
    expect(g4?.annualAmount).toBe(340000);
    expect(g4?.registrationFee).toBe(24000);
    expect(g4?.tranches.map((t) => t.amount)).toEqual([136000, 102000, 102000]);
    expect(CATALOG.discounts.filter((d) => d.isActive)).toHaveLength(2);
    expect(CATALOG.complementaryServices[0].semesterAmount).toBe(20000);
  });

  it("survives an EMPTY catalog (every leg degrades to null/—, never throws)", () => {
    const empty = pricingCatalogFromRows(
      null,
      [],
      new Map(),
      [],
      [],
      [],
      [],
      null,
    );
    const profiles = servicePricingProfiles({
      ledgerRows: [ledgerRow({})],
      installmentRows: [],
      kids: [kid({})],
      catalog: empty,
      fallbackAcademicYear: "2025-2026",
    });
    expect(profiles[0].academicYear).toBe("2025-2026");
    expect(profiles[0].catalog).toHaveLength(1); // the tuition ref with null amounts
    expect(profiles[0].catalog[0].annualAmount).toBeNull();
    expect(profiles[0].construction.catalogAnnual).toBeNull();
    expect(profiles[0].construction.deltaVsCatalog).toBeNull();
    expect(profiles[0].conditions).toHaveLength(0);
  });
});
