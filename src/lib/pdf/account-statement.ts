/**
 * Account statement (relevé) PDF generator — the WEBSITE port of the
 * desktop's canonical `src/infrastructure/receipt-pdf/account-statement.ts`
 * (AgentGithubUplaod hub).
 *
 * T-195 (30th session, ADR-014): parents download their full ledger
 * statement from the portal — client-side, deterministic from the canonical
 * ledger + installments + payments rows (the same data the portal's
 * Facturation tab renders; T-168's provenance/reconciliation equations are
 * NOT re-derived here — the totals are the canonical ones passed in).
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PaymentRow } from "@/lib/types/database";
import {
  PAGE_H,
  PAGE_W,
  MARGIN,
  CONTENT_W,
  BORDER,
  BRAND_BLUE_DEEP,
  TEXT_MUTED,
  TEXT_PRIMARY,
  drawHeader,
  drawFooter,
  drawKeyValue,
  drawBox,
  wrapText,
  formatDzdPlain,
  formatPdfDate,
  sanitizePdfText,
} from "./shared";
import type { ReceiptParentInfo } from "./payment-receipt";

export interface StatementTotals {
  /** Total dû (net: charges + adjustments — the canonical totalDue). */
  totalDue: number;
  /** Total payé (ledger totalPaid). */
  totalPaid: number;
  /** Reste à payer (negative = credit parent — display-level ADR-010). */
  balance: number;
}

export async function generateAccountStatementPdf(
  parent: ReceiptParentInfo,
  payments: PaymentRow[],
  totals: StatementTotals,
  options: { academicYear?: string | null } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const title = "RELEVE DE COMPTE";
  const page = drawHeader(doc, font, title);

  let y = PAGE_H - 130;

  // Parent identity box
  drawBox(page, MARGIN, y - 64, CONTENT_W, 64, undefined, BORDER);
  drawKeyValue(page, font, MARGIN + 15, y - 18, "Famille:", parent.fullName);
  drawKeyValue(page, font, MARGIN + 15, y - 36, "Code:", parent.code ?? "-");
  drawKeyValue(page, font, MARGIN + 15, y - 54, "Telephone:", parent.phone ?? "-");
  drawKeyValue(page, font, MARGIN + 280, y - 18, "Annee:", options.academicYear ?? "2026-2027");
  drawKeyValue(page, font, MARGIN + 280, y - 36, "Documents:", String(payments.length));
  drawKeyValue(page, font, MARGIN + 280, y - 54, "Genere le:", formatPdfDate(new Date().toISOString()));

  y -= 90;

  // Summary section
  page.drawText("SYNTHESE", { x: MARGIN, y, size: 10, font: fontBold, color: TEXT_PRIMARY });
  y -= 16;
  drawBox(page, MARGIN, y - 52, CONTENT_W, 52, rgb(0xf7 / 255, 0xf9 / 255, 0xfb / 255), BORDER);
  drawKeyValue(page, font, MARGIN + 15, y - 16, "Total du:", formatDzdPlain(totals.totalDue));
  drawKeyValue(page, font, MARGIN + 15, y - 36, "Total paye:", formatDzdPlain(totals.totalPaid));
  drawKeyValue(page, font, MARGIN + 280, y - 16, "Reste a payer:", formatDzdPlain(Math.max(0, totals.balance)));
  drawKeyValue(page, font, MARGIN + 280, y - 36, "Credit parent:", totals.balance < 0 ? formatDzdPlain(-totals.balance) : "-");
  y -= 66;

  // Payments table
  page.drawText("PAIEMENTS", { x: MARGIN, y, size: 10, font: fontBold, color: TEXT_PRIMARY });
  y -= 18;
  drawBox(page, MARGIN, y - 20, CONTENT_W, 20, BRAND_BLUE_DEEP);
  page.drawText("Date", { x: MARGIN + 10, y: y - 14, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Recu", { x: MARGIN + 90, y: y - 14, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Methode", { x: MARGIN + 220, y: y - 14, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Statut", { x: MARGIN + 310, y: y - 14, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Montant", { x: MARGIN + 440, y: y - 14, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  y -= 22;

  const METHOD_FR: Record<string, string> = { cash: "Especes", check: "Cheque", transfer: "Virement" };
  const STATUS_FR: Record<string, string> = {
    paid: "Paye",
    pending: "Attente",
    pending_clearance: "Encaissement",
    refunded: "Rembourse",
    cancelled: "Annule",
  };

  // Most recent first — the same order the portal's payments list uses.
  const rows = [...payments].sort((a, b) => (a.collected_at < b.collected_at ? 1 : -1)).slice(0, 25);
  for (const p of rows) {
    if (y < 120) break; // single page (the canonical statement is 1 page; overflow handled by the slice)
    const receiptNo = p.receipt_number ?? p.payment_number;
    page.drawText(formatPdfDate(p.collected_at), { x: MARGIN + 10, y: y - 4, size: 9, font, color: TEXT_PRIMARY });
    page.drawText(sanitizePdfText(receiptNo).slice(0, 18), { x: MARGIN + 90, y: y - 4, size: 9, font, color: TEXT_PRIMARY });
    page.drawText(METHOD_FR[p.method] ?? p.method, { x: MARGIN + 220, y: y - 4, size: 9, font, color: TEXT_PRIMARY });
    page.drawText(STATUS_FR[p.status] ?? p.status, { x: MARGIN + 310, y: y - 4, size: 9, font, color: TEXT_PRIMARY });
    page.drawText(formatDzdPlain(p.amount), { x: MARGIN + 440, y: y - 4, size: 9, font, color: TEXT_PRIMARY });
    page.drawLine({
      start: { x: MARGIN, y: y - 12 },
      end: { x: MARGIN + CONTENT_W, y: y - 12 },
      thickness: 0.3,
      color: BORDER,
    });
    y -= 20;
  }

  if (payments.length > 25) {
    page.drawText(`... ${payments.length - 25} paiement(s) anterieur(s) non affiche(s)`, {
      x: MARGIN,
      y,
      size: 8,
      font,
      color: TEXT_MUTED,
    });
  }

  // Note box
  y = Math.min(y - 20, 190);
  drawBox(page, MARGIN, y - 34, CONTENT_W, 34, rgb(0xfa / 255, 0xfa / 255, 0xfa / 255), BORDER);
  const note = "Ce releve est genere par le portail parent El-Imtiyaz a partir du registre financier officiel.";
  const noteLines = wrapText(note, font, 8, CONTENT_W - 30);
  noteLines.slice(0, 2).forEach((line, i) => {
    page.drawText(line, { x: MARGIN + 15, y: y - 14 - i * 10, size: 8, font, color: TEXT_MUTED });
  });

  drawFooter(page, font, new Date().toISOString().slice(0, 10));
  // useObjectStreams: false — receipts/statements are sub-10 KB docs; the
  // plain object layout keeps the text layer inspectable (tests + support)
  // at negligible size cost.
  return doc.save({ useObjectStreams: false });
}

/** Trigger a browser download of the generated statement. */
export function downloadAccountStatementPdf(
  parent: ReceiptParentInfo,
  payments: PaymentRow[],
  totals: StatementTotals,
  options: { academicYear?: string | null } = {},
): Promise<void> {
  return generateAccountStatementPdf(parent, payments, totals, options).then((bytes) => {
    const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `releve-${parent.code ?? "compte"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}
