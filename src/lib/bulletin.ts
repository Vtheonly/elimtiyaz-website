"use client";

/**
 * Bulletin (report card) PDF generation — client-side via print.
 *
 * Generates a printable HTML bulletin for the active student and opens the
 * browser's print dialog. The user can save it as PDF from there.
 *
 * This is a lightweight, dependency-free approach that works on Vercel
 * without needing a headless Chrome service. For high-fidelity branded PDFs
 * with embedded fonts, the desktop app's receipt-pdf.ts module remains the
 * authoritative generator (and a Supabase Edge Function can wrap it later).
 *
 * Per the plan (§13.x), the bulletin shows:
 *   - Student identity (name, code, class, level)
 *   - Per-subject grades grouped by term (D1, D2, Examen + subject average)
 *   - Overall GPA (coefficient-weighted)
 *   - Attendance summary (present/excused/unexcused/late counts)
 *   - Appreciation field (free text, filled by teacher — shown if present)
 */

import type {
  StudentRow,
  GradeRow,
  AttendanceRecordRow,
  ClassRow,
  AcademicLevelRow,
} from "@/lib/types/database";
import { formatFullName, formatDate } from "@/lib/format";

interface BulletinData {
  student: StudentRow;
  klass: ClassRow | null;
  level: AcademicLevelRow | null;
  grades: (GradeRow & {
    assessment?: {
      term: 1 | 2 | 3;
      kind: "devoir_1" | "devoir_2" | "examen";
      max_score: number;
      class_subject?: {
        coefficient: number;
        subject?: { name_fr: string; name_en?: string | null } | null;
      } | null;
    } | null;
  })[];
  attendance: AttendanceRecordRow[];
  academicYearLabel?: string;
  tenantName?: string;
}

/**
 * Open a new window with the formatted bulletin and trigger print.
 * Falls back to opening in the same tab if popups are blocked.
 */
export function printBulletin(data: BulletinData) {
  const html = renderBulletinHtml(data);
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) {
    // Popup blocked — fall back to a hidden iframe.
    printViaIframe(html);
    return;
  }
  win.document.write(html);
  win.document.close();
  // Give the new window a moment to layout before printing.
  setTimeout(() => {
    win.focus();
    win.print();
  }, 400);
}

function printViaIframe(html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 400);
}

function renderBulletinHtml(data: BulletinData): string {
  const { student, klass, level, grades, attendance, academicYearLabel, tenantName } = data;

  // Group grades by subject.
  const bySubject = new Map<
    string,
    {
      subjectName: string;
      coefficient: number;
      byTerm: Map<number, { d1?: number; d2?: number; exam?: number; average: number | null }>;
    }
  >();

  for (const g of grades) {
    const cs = g.assessment?.class_subject;
    const subj = cs?.subject;
    const key = cs?.subject_id ?? "unknown";
    if (!bySubject.has(key)) {
      bySubject.set(key, {
        subjectName: subj?.name_fr ?? subj?.name_en ?? "—",
        coefficient: cs?.coefficient ?? 1,
        byTerm: new Map(),
      });
    }
    const entry = bySubject.get(key)!;
    const term = g.assessment?.term ?? 1;
    if (!entry.byTerm.has(term)) {
      entry.byTerm.set(term, { d1: undefined, d2: undefined, exam: undefined, average: null });
    }
    const termEntry = entry.byTerm.get(term)!;
    if (g.assessment?.kind === "devoir_1") termEntry.d1 = g.score;
    else if (g.assessment?.kind === "devoir_2") termEntry.d2 = g.score;
    else if (g.assessment?.kind === "examen") termEntry.exam = g.score;
    termEntry.average = g.subject_average ?? null;
  }

  // Overall GPA.
  let gpaNum = 0;
  let gpaDenom = 0;
  bySubject.forEach((s) => {
    const allAvgs = Array.from(s.byTerm.values())
      .map((t) => t.average)
      .filter((v): v is number => typeof v === "number");
    if (allAvgs.length === 0) return;
    const avg = allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length;
    gpaNum += avg * s.coefficient;
    gpaDenom += s.coefficient;
  });
  const gpa = gpaDenom > 0 ? gpaNum / gpaDenom : null;

  // Attendance summary.
  const att = {
    present: attendance.filter((a) => a.status === "present").length,
    excused: attendance.filter((a) => a.status === "absent_excused").length,
    unexcused: attendance.filter((a) => a.status === "absent_unexcused").length,
    late: attendance.filter((a) => a.status === "late").length,
  };

  const terms = [1, 2, 3] as const;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Bulletin — ${escapeHtml(formatFullName(student))}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1E1F20; margin: 0; padding: 24px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #349BD4; padding-bottom: 12px; margin-bottom: 16px; }
  .header h1 { font-size: 18px; margin: 0; color: #2B7FB0; }
  .header .meta { text-align: right; font-size: 10px; color: #3B464C; }
  .student-card { background: #F7F9FB; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
  .student-card h2 { margin: 0 0 4px 0; font-size: 14px; }
  .student-card .row { display: flex; gap: 24px; font-size: 11px; color: #3B464C; }
  .student-card .row span strong { color: #1E1F20; }
  h3 { font-size: 12px; color: #2B7FB0; margin: 16px 0 8px 0; text-transform: uppercase; letter-spacing: 0.04em; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #E5E7EB; padding: 6px 8px; text-align: center; font-size: 11px; }
  th { background: #EFF2F3; color: #3B464C; font-weight: 600; }
  td.subject { text-align: left; font-weight: 500; }
  td.gpa { font-weight: 700; color: ${gpa !== null && gpa >= 10 ? "#3FA66E" : "#C0504D"}; }
  .summary { display: flex; gap: 12px; margin-bottom: 16px; }
  .summary .card { flex: 1; border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px 12px; text-align: center; }
  .summary .card .label { font-size: 9px; color: #3B464C; text-transform: uppercase; letter-spacing: 0.04em; }
  .summary .card .value { font-size: 18px; font-weight: 700; margin-top: 2px; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #E5E7EB; font-size: 9px; color: #3B464C; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(tenantName ?? "El-Imtiyaz")}</h1>
      <p style="margin:2px 0 0 0;font-size:10px;color:#3B464C;">Bulletin scolaire ${escapeHtml(academicYearLabel ?? "")}</p>
    </div>
    <div class="meta">
      Émis le ${formatDate(new Date())}<br>
      ${escapeHtml(klass?.name ?? klass?.code ?? "")}
    </div>
  </div>

  <div class="student-card">
    <h2>${escapeHtml(formatFullName(student))}</h2>
    <div class="row">
      <span><strong>Matricule:</strong> ${escapeHtml(student.student_code)}</span>
      <span><strong>Niveau:</strong> ${escapeHtml(level?.grade_code ?? level?.year_label ?? "—")}</span>
      <span><strong>Classe:</strong> ${escapeHtml(klass?.name ?? klass?.code ?? "—")}</span>
      <span><strong>Né(e) le:</strong> ${formatDate(student.date_of_birth)}</span>
    </div>
  </div>

  <h3>Moyenne Générale</h3>
  <div class="summary">
    <div class="card">
      <div class="label">Moyenne</div>
      <div class="value" style="color: ${gpa !== null && gpa >= 10 ? "#3FA66E" : "#C0504D"};">
        ${gpa !== null ? gpa.toFixed(2) : "—"}
      </div>
    </div>
    <div class="card">
      <div class="label">Présences</div>
      <div class="value" style="color:#3FA66E;">${att.present}</div>
    </div>
    <div class="card">
      <div class="label">Absences justifiées</div>
      <div class="value" style="color:#C8A98C;">${att.excused}</div>
    </div>
    <div class="card">
      <div class="label">Absences non justifiées</div>
      <div class="value" style="color:#C0504D;">${att.unexcused}</div>
    </div>
    <div class="card">
      <div class="label">Retards</div>
      <div class="value" style="color:#6EC1E4;">${att.late}</div>
    </div>
  </div>

  ${terms
    .map((term) => {
      const subjects = Array.from(bySubject.entries()).filter(([, s]) => s.byTerm.has(term));
      if (subjects.length === 0) return "";
      return `
        <h3>Trimestre ${term}</h3>
        <table>
          <thead>
            <tr>
              <th style="text-align:left;">Matière</th>
              <th>Coeff.</th>
              <th>Devoir 1</th>
              <th>Devoir 2</th>
              <th>Examen</th>
              <th>Moyenne</th>
            </tr>
          </thead>
          <tbody>
            ${subjects
              .map(([, s]) => {
                const t = s.byTerm.get(term)!;
                return `
                  <tr>
                    <td class="subject">${escapeHtml(s.subjectName)}</td>
                    <td>${s.coefficient}</td>
                    <td>${t.d1 !== undefined ? t.d1.toFixed(2) : "—"}</td>
                    <td>${t.d2 !== undefined ? t.d2.toFixed(2) : "—"}</td>
                    <td>${t.exam !== undefined ? t.exam.toFixed(2) : "—"}</td>
                    <td class="gpa">${t.average !== null ? t.average.toFixed(2) : "—"}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      `;
    })
    .join("")}

  <div class="footer">
    Document généré par le portail El-Imtiyaz • ${formatDate(new Date(), { withTime: true })}
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
