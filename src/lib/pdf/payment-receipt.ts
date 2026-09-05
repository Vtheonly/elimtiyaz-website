/**
 * Payment receipt PDF generator — the WEBSITE port of the desktop's
 * canonical `src/infrastructure/receipt-pdf/payment-receipt.ts`
 * (AgentGithubUplaod hub).
 *
 * T-194 / CROSS-101 (30th session, ADR-014): parents download their payment
 * receipts from the portal — generated CLIENT-SIDE, deterministically from
 * the canonical `payments` row (receipt number = payments.receipt_number,
 * allocated server-side since migration 0058). Identical layout/branding to
 * the staff-generated receipt, so a parent's copy and the school's copy of
 * the same receipt are the same document.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PaymentRow } from "@/lib/types/database";
import {
  PAGE_H,
  MARGIN,
  CONTENT_W,
  BORDER,
  BRAND_BLUE_DEEP,
  SUCCESS,
  WARNING,
  TEXT_MUTED,
  TEXT_PRIMARY,
  drawHeader,
  drawFooter,
  drawKeyValue,
  drawBox,
  formatDzdPlain,
  formatPdfDate,
} from "./shared";

const METHOD_LABELS: Record<PaymentRow["method"], string> = {
  cash: "Espèces",
  check: "Chèque",
  transfer: "Virement",
};

const STATUS_LABELS: Record<PaymentRow["status"], string> = {
  paid: "Payé",
  pending: "En attente",
  unpaid: "Non payé",
  partial: "Partiel",
  overdue: "En retard",
  refunded: "Remboursé",
  cancelled: "Annulé",
  pending_clearance: "Encaissement en cours",
};

const CATEGORY_LABELS: Record<string, string> = {
  tuition: "Scolarité",
  registration: "Inscription",
  transport: "Transport",
  canteen: "Cantine",
  supplies: "Fournitures",
  therapy: "Thérapie",
  club: "Club",
  other: "Autre",
};

export interface ReceiptParentInfo {
  /** Canonical display name (formatParentName — "Famille X" convention). */
  fullName: string;
  /** Parent code (PAR-…). */
  code?: string | null;
  phone?: string | null;
}

export async function generatePaymentReceiptPdf(
  payment: PaymentRow,
  parent?: ReceiptParentInfo | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const title = "RECU DE PAIEMENT";
  const page = drawHeader(doc, font, title);

  let y = PAGE_H - 130;

  // Receipt meta box
  drawBox(page, MARGIN, y - 60, CONTENT_W, 60, undefined, BORDER);
  const receiptNo = payment.receipt_number ?? payment.payment_number;
  drawKeyValue(page, font, MARGIN + 15, y - 18, "Recu N:", receiptNo);
  drawKeyValue(page, font, MARGIN + 15, y - 36, "Date:", formatPdfDate(payment.collected_at));
  drawKeyValue(page, font, MARGIN + 280, y - 18, "Statut:", STATUS_LABELS[payment.status] ?? payment.status);
  drawKeyValue(page, font, MARGIN + 280, y - 36, "Reference:", payment.id.slice(0, 8).toUpperCase());

  y -= 90;

  // Parent / Payer section
  page.drawText("PAYEUR", { x: MARGIN, y, size: 10, font: fontBold, color: TEXT_PRIMARY });
  y -= 18;
  drawBox(page, MARGIN, y - 50, CONTENT_W, 50, rgb(0xf7 / 255, 0xf9 / 255, 0xfb / 255), BORDER);
  if (parent) {
    drawKeyValue(page, font, MARGIN + 15, y - 16, "Nom:", parent.fullName);
    drawKeyValue(page, font, MARGIN + 15, y - 34, "Code:", parent.code ?? "-");
    drawKeyValue(page, font, MARGIN + 280, y - 16, "Telephone:", parent.phone ?? "-");
  } else {
    page.drawText("-", { x: MARGIN + 15, y: y - 16, size: 10, font, color: TEXT_MUTED });
  }

  y -= 70;

  // Payment details section
  page.drawText("DETAIL DU PAIEMENT", { x: MARGIN, y, size: 10, font: fontBold, color: TEXT_PRIMARY });
  y -= 18;

  drawBox(page, MARGIN, y - 20, CONTENT_W, 20, BRAND_BLUE_DEEP);
  page.drawText("Designation", { x: MARGIN + 15, y: y - 14, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Methode", { x: MARGIN + 240, y: y - 14, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Categorie", { x: MARGIN + 340, y: y - 14, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Montant", { x: MARGIN + 440, y: y - 14, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  y -= 22;

  const amountStr = formatDzdPlain(payment.amount);
  const methodLabel = METHOD_LABELS[payment.method] ?? payment.method;
  const categoryLabel = payment.category ? CATEGORY_LABELS[payment.category] ?? payment.category : "Scolarite";

  // Check reference line when the payment is a cheque.
  const designation =
    payment.method === "check" && payment.check_number
      ? `Paiement par cheque N ${payment.check_number}`
      : "Paiement";

  page.drawText(designation, { x: MARGIN + 15, y: y - 4, size: 10, font, color: TEXT_PRIMARY });
  page.drawText(methodLabel, { x: MARGIN + 240, y: y - 4, size: 10, font, color: TEXT_PRIMARY });
  page.drawText(categoryLabel, { x: MARGIN + 340, y: y - 4, size: 10, font, color: TEXT_PRIMARY });
  page.drawText(amountStr, { x: MARGIN + 440, y: y - 4, size: 10, font: fontBold, color: TEXT_PRIMARY });
  page.drawLine({
    start: { x: MARGIN, y: y - 14 },
    end: { x: MARGIN + CONTENT_W, y: y - 14 },
    thickness: 0.5,
    color: BORDER,
  });

  y -= 30;

  // Total box
  drawBox(page, MARGIN + 320, y - 36, CONTENT_W - 320, 36, SUCCESS);
  page.drawText("TOTAL PAYE", { x: MARGIN + 335, y: y - 14, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText(amountStr, {
    x: MARGIN + CONTENT_W - 15 - fontBold.widthOfTextAtSize(amountStr, 14),
    y: y - 22,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  y -= 60;

  // Status banner
  const statusColor =
    payment.status === "paid" ? SUCCESS : payment.status === "pending" || payment.status === "pending_clearance" ? WARNING : TEXT_MUTED;
  drawBox(page, MARGIN, y - 28, CONTENT_W, 28, statusColor);
  const statusLabel = `Statut: ${(STATUS_LABELS[payment.status] ?? payment.status).toUpperCase()}`;
  page.drawText(statusLabel, {
    x: MARGIN + 15,
    y: y - 18,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // Signature line
  const sigY = 140;
  page.drawText("Signature & cachet", { x: 595.28 - MARGIN - 150, y: sigY + 20, size: 9, font, color: TEXT_MUTED });
  page.drawLine({
    start: { x: 595.28 - MARGIN - 150, y: sigY },
    end: { x: 595.28 - MARGIN, y: sigY },
    thickness: 0.5,
    color: BORDER,
  });

  drawFooter(page, font, new Date().toISOString().slice(0, 10));
  // useObjectStreams: false — receipts/statements are sub-10 KB docs; the
  // plain object layout keeps the text layer inspectable (tests + support)
  // at negligible size cost.
  return doc.save({ useObjectStreams: false });
}

/** Trigger a browser download of the generated receipt. */
export function downloadPaymentReceiptPdf(
  payment: PaymentRow,
  parent?: ReceiptParentInfo | null,
): Promise<void> {
  const receiptNo = payment.receipt_number ?? payment.payment_number;
  return generatePaymentReceiptPdf(payment, parent).then((bytes) => {
    const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recu-${receiptNo || payment.id.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}
