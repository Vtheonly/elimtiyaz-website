/**
 * Calendar event-kind mapping — the SINGLE canonical map from backend
 * `calendar_events.kind` enums to UI types + localized label keys.
 *
 * History (T-203/UI-304, 2026-09-06): this map lived inside
 * calendar-view.tsx as a private const. The dashboard's upcoming-events
 * section rendered the RAW backend enum (`<StatusPill>{ev.kind}</StatusPill>`
 * — English "meeting"/"reminder" strings in an otherwise French UI)
 * because the mapping was not importable. Extracted here so both views
 * render the SAME labels — one mapping, two consumers
 * (Existing-Implementation-First; do not fork it again).
 *
 * The desktop schema has no dedicated 'exam' kind — exams are created as
 * calendar_events with kind='meeting' or 'custom' and
 * target_entity_type='exam'. We treat 'custom' as 'activity' for the
 * parent unless target_entity_type hints otherwise (the calendar view's
 * exam heuristic applies on top of this map).
 */

export type CalendarEventUiType =
  | "exam"
  | "holiday"
  | "meeting"
  | "deadline"
  | "activity"
  | "payment"
  | "other";

export const kindToUiType: Record<string, CalendarEventUiType> = {
  meeting: "meeting",
  reminder: "deadline",
  custom: "activity",
  payment_received: "payment",
  follow_up_call: "meeting",
  audit_log: "other",
  expense_event: "other",
};

/**
 * The i18n key for a UI type's localized label.
 * 'payment' maps to the 'deadline' label — the calendar view's established
 * convention (the payment entry is an installment DEADLINE surfaced as a
 * calendar event, not a payment notification).
 */
export function uiTypeLabelKey(uiType: string): string {
  return `calendar.eventType.${uiType === "payment" ? "deadline" : uiType}`;
}

/** The i18n key for a raw backend `kind` enum's localized label. */
export function eventKindLabelKey(kind: string): string {
  return uiTypeLabelKey(kindToUiType[kind] ?? "other");
}
