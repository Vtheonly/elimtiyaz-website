/**
 * canonical/index.ts — public surface of the canonical engine on the
 * web portal. Mirrors the desktop domain barrel so imports stay aligned.
 */
export * from "./model/payment";
export * from "./model/ledger";
export * from "./model/student";
export * from "./model/pricing";
export * from "./model/parent";
export * from "./model/academic";
export * from "./calc/shared/money";
export * from "./calc/shared/dates";
export * from "./calc/ledger/account-id";
export * from "./calc/ledger/balance";
export * from "./calc/ledger/entries";
export * from "./calc/ledger/overdue";
export * from "./calc/ledger/charges";
export * from "./calc/payment/waterfall-allocator";
export * from "./calc/payment/lifo-reversal";
export * from "./calc/payment/clearance";
export * from "./calc/payment/queries";
export * from "./calc/payment/sums";
export * from "./calc/payment/revenue";
export * from "./calc/pricing/discount-rules";
export * from "./calc/pricing/discount-engine";
export * from "./calc/pricing/tuition";
export * from "./calc/pricing/transport";
