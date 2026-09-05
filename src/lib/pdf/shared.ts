/**
 * PDF layout primitives — the WEBSITE port of the desktop's canonical
 * `src/infrastructure/receipt-pdf/shared.ts` (AgentGithubUplaod hub).
 *
 * T-194 / CROSS-101 (30th session, ADR-014): the parent portal generates
 * receipt + statement PDFs CLIENT-SIDE, deterministically from the canonical
 * payment/ledger rows — the same approach, layout and brand constants the
 * desktop app uses (its module remains the reference generator; this port
 * records the source). No server round-trip, no storage, no orphaned
 * `receipts` table.
 *
 * Ported verbatim (constants + geometry + WinAnsi sanitization); only the
 * date formatting is local (DD/MM/YYYY — same shape the desktop uses).
 */
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";

/* ------------------------------------------------------------------ */
/*  Brand colors — match design tokens (RGB 0..1)                     */
/* ------------------------------------------------------------------ */

export const BRAND_BLUE = rgb(0x34 / 255, 0x9b / 255, 0xd4 / 255);
export const BRAND_BLUE_DEEP = rgb(0x2b / 255, 0x7f / 255, 0xb0 / 255);
export const TEXT_PRIMARY = rgb(0x1e / 255, 0x1f / 255, 0x20 / 255);
export const TEXT_MUTED = rgb(0x6b / 255, 0x70 / 255, 0x75 / 255);
export const BORDER = rgb(0xcc / 255, 0xcc / 255, 0xcc / 255);
export const SUCCESS = rgb(0x3f / 255, 0xa6 / 255, 0x6e / 255);
export const WARNING = rgb(0xc8 / 255, 0xa9 / 255, 0x8c / 255);

/* ------------------------------------------------------------------ */
/*  Layout constants                                                   */
/* ------------------------------------------------------------------ */

export const PAGE_W = 595.28; // A4 width in points (72 dpi)
export const PAGE_H = 841.89;
export const MARGIN = 50;
export const CONTENT_W = PAGE_W - MARGIN * 2;

export type PdfPage = ReturnType<PDFDocument["addPage"]>;

/**
 * Sanitize text for StandardFonts.Helvetica (WinAnsi only) — identical to
 * the desktop helper: NFD + strip combining marks, anything else non-ASCII
 * becomes "?".
 */
export function sanitizePdfText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

export function drawHeader(doc: PDFDocument, font: PDFFont, title: string): PdfPage {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 80,
    width: PAGE_W,
    height: 80,
    color: BRAND_BLUE,
  });
  page.drawText("EL-IMTIYAZ", {
    x: MARGIN,
    y: PAGE_H - 40,
    size: 22,
    font,
    color: rgb(1, 1, 1),
  });
  page.drawText("Etablissement Scolaire Prive", {
    x: MARGIN,
    y: PAGE_H - 58,
    size: 9,
    font,
    color: rgb(1, 1, 1),
  });
  page.drawText(title, {
    x: PAGE_W - MARGIN - font.widthOfTextAtSize(title, 14),
    y: PAGE_H - 45,
    size: 14,
    font,
    color: rgb(1, 1, 1),
  });
  return page;
}

export function drawFooter(page: PdfPage, font: PDFFont, generatedAt: string) {
  const y = 40;
  page.drawLine({
    start: { x: MARGIN, y: y + 20 },
    end: { x: PAGE_W - MARGIN, y: y + 20 },
    thickness: 0.5,
    color: BORDER,
  });
  page.drawText("El-Imtiyaz - Boumerdes, Algerie", {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: TEXT_MUTED,
  });
  page.drawText(`Genere le ${generatedAt} - Page 1/1`, {
    x: PAGE_W - MARGIN - 200,
    y,
    size: 8,
    font,
    color: TEXT_MUTED,
  });
}

export function drawKeyValue(
  page: PdfPage,
  font: PDFFont,
  x: number,
  y: number,
  label: string,
  value: string,
  labelWidth = 110,
) {
  page.drawText(sanitizePdfText(label), { x, y, size: 9, font, color: TEXT_MUTED });
  page.drawText(sanitizePdfText(value), { x: x + labelWidth, y, size: 10, font, color: TEXT_PRIMARY });
}

export function drawBox(
  page: PdfPage,
  x: number,
  y: number,
  w: number,
  h: number,
  fill?: ReturnType<typeof rgb>,
  stroke?: ReturnType<typeof rgb>,
) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: fill,
    borderColor: stroke,
    borderWidth: stroke ? 0.5 : 0,
  });
}

export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Format DZD amounts the canonical way (fr-FR, space thousands). */
export function formatDzdPlain(amount: number): string {
  return `${Math.round(amount).toLocaleString("fr-FR").replace(/\u202f/g, " ")} DZD`;
}

/** Format an ISO date for the PDF meta lines (DD/MM/YYYY). */
export function formatPdfDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
