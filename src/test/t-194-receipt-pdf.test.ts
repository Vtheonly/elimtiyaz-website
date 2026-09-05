/**
 * T-194/T-195 (CROSS-101, ADR-014) — client-side PDF generation on the
 * parent portal.
 *
 * Pins:
 *   R1  generatePaymentReceiptPdf produces a REAL PDF (parses back via
 *       pdf-lib; ≥1 page; %PDF header) with the canonical receipt number,
 *       amount, method label and parent identity.
 *   R2  the receipt layout constants match the desktop reference module
 *       (A4 595.28×841.89, margin 50 — parity is a port requirement).
 *   R3  sanitizePdfText strips accents (WinAnsi safety) exactly like the
 *       desktop helper.
 *   R4  formatDzdPlain renders fr-FR amounts (espace milliers + DZD).
 *   R5  generateAccountStatementPdf produces a valid PDF whose page text
 *       carries the family identity + the canonical totals (Total paye /
 *       Reste a payer) — the totals are passed in (never re-derived).
 *   S1  source scan: financial-view wires the receipt download button on
 *       every payment row + the statement button in the header.
 *   S2  source scan: the dead `receipts`-table hooks are GONE (the orphan
 *       consumer class cannot return).
 */
import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import zlib from "node:zlib";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  generatePaymentReceiptPdf,
  type ReceiptParentInfo,
} from "@/lib/pdf/payment-receipt";
import { generateAccountStatementPdf } from "@/lib/pdf/account-statement";
import { sanitizePdfText, formatDzdPlain, formatPdfDate, PAGE_W, PAGE_H, MARGIN } from "@/lib/pdf/shared";
import type { PaymentRow } from "@/lib/types/database";

/**
 * Extract every stream in the PDF, inflating FlateDecode blocks, and decode
 * the hex-encoded text strings pdf-lib emits (`<524350…> Tj`) — lets the
 * tests assert on the actual drawn text without a text-extraction library.
 */
function extractPdfText(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  const parts: string[] = [];
  let idx = 0;
  while (idx < buf.length) {
    const s = buf.indexOf("stream", idx);
    if (s === -1) break;
    const e = buf.indexOf("endstream", s + 6);
    if (e === -1) break;
    // Content between the stream keyword and endstream: skip the leading EOL.
    let start = s + 6;
    if (buf[start] === 13) start++;
    if (buf[start] === 10) start++;
    const chunk = buf.subarray(start, e);
    if (chunk.length > 0) {
      let text: string;
      try {
        text = zlib.inflateSync(chunk).toString("latin1");
      } catch {
        text = chunk.toString("latin1");
      }
      // Decode hex string operators: <5243502D…> Tj → ASCII.
      text = text.replace(/<([0-9A-Fa-f\s]+)>\s*Tj/g, (_m, hex: string) => {
        const clean = (hex as string).replace(/\s/g, "");
        return Buffer.from(clean, "hex").toString("latin1");
      });
      parts.push(text);
    }
    idx = e + 9;
  }
  return parts.join("\n");
}

const PAYMENT: PaymentRow = {
  id: "a1b2c3d4-e5f6-4789-a012-3456789abcde",
  tenant_id: "00000000-0000-0000-0000-000000000001",
  payment_number: "PAY-2026-000001",
  receipt_number: "RCP-2026-000042",
  parent_id: "11111111-1111-4111-8111-111111111111",
  student_id: null,
  invoice_id: null,
  installment_id: null,
  amount: 45000,
  method: "check",
  check_number: "CHK-778812",
  check_bank_name: "BNA",
  check_issue_date: "2026-09-01",
  check_clearance_date: null,
  transfer_reference: null,
  transfer_source_bank: null,
  proof_path: null,
  status: "paid",
  category: "tuition",
  expected_amount: null,
  excess_amount: null,
  excess_remark: null,
  collected_at: "2026-09-03T10:30:00Z",
  collected_by: null,
  notes: null,
  reversal_of_payment_id: null,
  created_at: "2026-09-03T10:30:00Z",
  updated_at: "2026-09-03T10:30:00Z",
};

const PARENT: ReceiptParentInfo = {
  fullName: "Famille BENALI",
  code: "PAR-2026-A4F9",
  phone: "0550123456",
};

async function pageTextOf(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => {
    // pdf-lib cannot extract text natively; count operators as a proxy and
    // assert structural markers (page count, size) + object presence via
    // the raw content stream bytes.
    return "page";
  });
}

describe("T-194 — payment receipt PDF (client-side, ADR-014)", () => {
  it("R1: generates a valid PDF with the receipt number + amount + parent", async () => {
    const bytes = await generatePaymentReceiptPdf(PAYMENT, PARENT);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    const raw = Buffer.from(bytes).toString("latin1");
    expect(raw.startsWith("%PDF-")).toBe(true);
    const text = extractPdfText(bytes);
    expect(text).toContain("RCP-2026-000042");
    expect(text).toContain("PAR-2026-A4F9");
    // 45 000 DZD amount label drawn with the bold font on the total box.
    expect(text).toContain("45 000 DZD");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(841.89, 1);
  });

  it("R2: layout constants are the desktop reference values (parity port)", () => {
    expect(PAGE_W).toBe(595.28);
    expect(PAGE_H).toBe(841.89);
    expect(MARGIN).toBe(50);
  });

  it("R3: sanitizePdfText strips accents like the desktop helper", () => {
    expect(sanitizePdfText("REÇU DE PAIEMENT")).toBe("RECU DE PAIEMENT");
    expect(sanitizePdfText("Élève — élève")).toBe("Eleve ? eleve");
    expect(sanitizePdfText("plain ascii")).toBe("plain ascii");
  });

  it("R4: formatDzdPlain renders fr-FR amounts", () => {
    expect(formatDzdPlain(45000)).toBe("45 000 DZD");
    expect(formatDzdPlain(1234567)).toContain("DZD");
    expect(formatDzdPlain(1234567)).toMatch(/1 234 567/);
  });

  it("R4b: formatPdfDate renders DD/MM/YYYY", () => {
    expect(formatPdfDate("2026-09-03T10:30:00Z")).toBe("03/09/2026");
    expect(formatPdfDate(null)).toBe("-");
  });
});

describe("T-195 — account statement PDF (client-side, ADR-014)", () => {
  it("R5: generates a valid PDF over the canonical totals", async () => {
    const bytes = await generateAccountStatementPdf(
      PARENT,
      [PAYMENT],
      { totalDue: 700000, totalPaid: 45000, balance: 655000 },
    );
    expect(bytes.byteLength).toBeGreaterThan(1000);
    const raw = Buffer.from(bytes).toString("latin1");
    expect(raw.startsWith("%PDF-")).toBe(true);
    const text = extractPdfText(bytes);
    expect(text).toContain("RELEVE DE COMPTE");
    expect(text).toContain("Famille BENALI");
    expect(text).toContain("700 000 DZD");
    expect(text).toContain("655 000 DZD");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});

describe("T-194/T-195 — wiring + orphan removal source scans", () => {
  const VIEW = fs.readFileSync(
    path.resolve(__dirname, "../features/financial/financial-view.tsx"),
    "utf8",
  );
  const QUERIES = fs.readFileSync(
    path.resolve(__dirname, "../lib/hooks/portal-queries.ts"),
    "utf8",
  );

  it("S1: the financial view wires both PDF download buttons", () => {
    expect(VIEW).toContain("downloadPaymentReceiptPdf");
    expect(VIEW).toContain("downloadAccountStatementPdf");
    expect(VIEW).toContain('t("finance.receipt.download")');
    expect(VIEW).toContain('t("finance.statement.generate")');
  });

  it("S2: the dead receipts-table hooks are gone (orphan consumer class)", () => {
    expect(QUERIES).not.toContain('from("receipts")');
    expect(QUERIES).not.toContain("useReceiptsForPayment");
  });
});
