/**
 * T-027 / WEAK-019 regression tests — canonical attendance rate everywhere.
 *
 * Verifies the bulletin's new "Taux de présence" KPI uses the canonical
 * (present + late) / total formula, not the previous `present` raw count.
 * Cross-platform check: with 18 present + 2 late, the rate is 100%
 * (per the canonical `attendanceRatePercent`).
 */
import { describe, it, expect } from "vitest";
import { renderBulletinHtml } from "@/lib/bulletin";
import { attendanceRatePercent } from "@/lib/canonical/portal-derive";
import type {
  AttendanceRecordRow,
  StudentRow,
  ClassRow,
  AcademicLevelRow,
} from "@/lib/types/database";
import type { PortalAssessmentRow } from "@/lib/hooks/portal-queries";

const student: StudentRow = {
  id: "stu-1",
  tenant_id: "t1",
  parent_id: "par-1",
  student_code: "ELV-1",
  first_name: "Karim",
  last_name: "Benali",
  date_of_birth: "2015-01-01",
  grade_level_code: "1am",
  enrollment_status: "active",
  phone: null,
  address: null,
  notes: null,
  picture_url: null,
  created_at: "2025-09-01",
  updated_at: "2025-09-01",
};

const klass: ClassRow = {
  id: "cls-1",
  tenant_id: "t1",
  grade_level_code: "1am",
  code: "1AM-A",
  name: "1AM-A",
  academic_year: "2025-2026",
  homeroom_teacher_id: null,
  created_at: "2025-09-01",
  updated_at: "2025-09-01",
};

const level: AcademicLevelRow = {
  id: "lvl-1",
  tenant_id: "t1",
  code: "1am",
  name: "1ère année moyenne",
  cycle: "moyen",
  order: 7,
  year_label: "1AM",
  grade_code: "1am",
  created_at: "2025-09-01",
  updated_at: "2025-09-01",
};

function makeAttendance(
  overrides: Array<Partial<AttendanceRecordRow>>,
): AttendanceRecordRow[] {
  return overrides.map((o, i) => ({
    id: o.id ?? `att-${i}`,
    tenant_id: "t1",
    student_id: "stu-1",
    class_id: "cls-1",
    class_subject_id: null,
    date: "2025-09-15",
    status: (o.status as AttendanceRecordRow["status"]) ?? "present",
    arrival_time: null,
    note: null,
    recorded_by: "u1",
    justification_note: null,
    justification_path: null,
    justification_drive_link: null,
    justification_status: "none",
    justification_reviewed_by: null,
    justification_reviewed_at: null,
    created_at: "2025-09-15",
    updated_at: "2025-09-15",
  }));
}

describe("T-027 — canonical attendance rate in the bulletin", () => {
  it("attendanceRatePercent counts present + late as attended", () => {
    // Sanity-check the canonical function (the bulletin uses it directly).
    const records = makeAttendance([
      { status: "present" }, { status: "present" },
      { status: "late" }, { status: "absent_excused" },
    ]);
    expect(attendanceRatePercent(records)).toBe(75);
  });

  it("bulletin shows 'Taux de présence' KPI using the canonical rate", () => {
    // 18 present + 2 late = 100% (the bug scenario from WEAK-019).
    const records = makeAttendance([
      ...Array.from({ length: 18 }, () => ({ status: "present" as const })),
      ...Array.from({ length: 2 }, () => ({ status: "late" as const })),
    ]);
    const html = renderBulletinHtml({
      student,
      klass,
      level,
      grades: [] as PortalAssessmentRow[],
      attendance: records,
    });
    // The new KPI card must exist.
    expect(html).toMatch(/Taux de présence/);
    // And it must show 100% (canonical: late counts as attended).
    // The KPI card body is: <div class="value" ...>100%</div>
    expect(html).toMatch(/Taux de présence.*?100%/s);
  });

  it("bulletin shows '—' when no attendance records exist", () => {
    const html = renderBulletinHtml({
      student,
      klass,
      level,
      grades: [] as PortalAssessmentRow[],
      attendance: [],
    });
    expect(html).toMatch(/Taux de présence.*?—/s);
  });

  it("bulletin still shows raw counts breakdown alongside the rate KPI", () => {
    // The raw-count cards (Présences / Absences justifiées / Absences
    // non justifiées / Retards) are preserved as a breakdown detail.
    const records = makeAttendance([
      { status: "present" },
      { status: "late" },
      { status: "absent_excused" },
      { status: "absent_unexcused" },
    ]);
    const html = renderBulletinHtml({
      student,
      klass,
      level,
      grades: [] as PortalAssessmentRow[],
      attendance: records,
    });
    expect(html).toMatch(/Présences/);
    expect(html).toMatch(/Absences justifiées/);
    expect(html).toMatch(/Absences non justifiées/);
    expect(html).toMatch(/Retards/);
    // And the rate KPI appears in the same summary block.
    expect(html).toMatch(/Taux de présence/);
  });
});
