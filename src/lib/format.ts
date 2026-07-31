/**
 * Currency / Date / ID formatting utilities.
 *
 * Source of truth: docs/Clients_Sheet_Merged.txt → "05. Formulas"
 *                  Entire_Project_Plan.txt → "20. References / 02. French Terminology Mapping"
 *
 * The platform defaults to DZD (Algerian Dinar) and Africa/Algiers timezone,
 * but respects per-tenant overrides stored in `tenants.default_currency` and
 * `tenants.timezone`.
 */

const DEFAULT_LOCALE = "fr-DZ";
const DEFAULT_CURRENCY = "DZD";
const DEFAULT_TIMEZONE = "Africa/Algiers";

export function formatCurrency(
  amount: number,
  options: { currency?: string; locale?: string; signed?: boolean } = {}
): string {
  const { currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE, signed = false } = options;
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: signed ? "always" : "auto",
  });
  // Intl may not have DZD locale data in every runtime; fall back gracefully.
  try {
    return formatter.format(amount);
  } catch {
    return `${amount.toLocaleString(locale, { minimumFractionDigits: 2 })} ${currency}`;
  }
}

export function formatNumber(
  value: number,
  options: { locale?: string; decimals?: number } = {}
): string {
  const { locale = DEFAULT_LOCALE, decimals = 0 } = options;
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDate(
  date: string | Date,
  options: { locale?: string; withTime?: boolean; timezone?: string } = {}
): string {
  const { locale = DEFAULT_LOCALE, withTime = false, timezone = DEFAULT_TIMEZONE } = options;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: withTime ? "short" : undefined,
    timeZone: timezone,
  }).format(d);
}

export function formatRelative(
  date: string | Date,
  options: { locale?: string; timezone?: string } = {}
): string {
  const { locale = DEFAULT_LOCALE, timezone = DEFAULT_TIMEZONE } = options;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffMs = d.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, "second");
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, "month");
  return rtf.format(Math.round(diffMonth / 12), "year");
}

export function formatInitials(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName ?? "").trim().charAt(0).toUpperCase();
  const l = (lastName ?? "").trim().charAt(0).toUpperCase();
  return (f + l) || "?";
}

export function formatFullName(
  person: { first_name?: string | null; last_name?: string | null; middle_name?: string | null }
): string {
  return [person.first_name, person.middle_name, person.last_name]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Days remaining until a due date (negative = overdue). */
export function daysUntil(date: string | Date): number {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return 0;
  const diffMs = d.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
