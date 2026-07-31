import { describe, it, expect } from "vitest";
import {
  StatusPill,
  paymentStatusTone,
  attendanceStatusTone,
} from "@/features/shared/status-pill";

describe("paymentStatusTone", () => {
  it("maps 'paid' to success", () => {
    expect(paymentStatusTone("paid")).toEqual({
      tone: "success",
      key: "finance.status.paid",
    });
  });

  it("maps 'partial' to info", () => {
    expect(paymentStatusTone("partial").tone).toBe("info");
  });

  it("maps 'pending' to warning", () => {
    expect(paymentStatusTone("pending").tone).toBe("warning");
  });

  it("maps 'unpaid' to muted", () => {
    expect(paymentStatusTone("unpaid").tone).toBe("muted");
  });

  it("maps 'overdue' to danger", () => {
    expect(paymentStatusTone("overdue").tone).toBe("danger");
  });

  it("maps 'refunded' to muted", () => {
    expect(paymentStatusTone("refunded").tone).toBe("muted");
  });

  it("falls back to muted for unknown status", () => {
    expect(paymentStatusTone("unknown").tone).toBe("muted");
    expect(paymentStatusTone("unknown").key).toBe("unknown");
  });
});

describe("attendanceStatusTone", () => {
  it("maps 'present' to success", () => {
    expect(attendanceStatusTone("present")).toBe("success");
  });

  it("maps 'absent_excused' to warning", () => {
    expect(attendanceStatusTone("absent_excused")).toBe("warning");
  });

  it("maps 'absent_unexcused' to danger", () => {
    expect(attendanceStatusTone("absent_unexcused")).toBe("danger");
  });

  it("maps 'late' to info", () => {
    expect(attendanceStatusTone("late")).toBe("info");
  });

  it("falls back to muted for unknown status", () => {
    expect(attendanceStatusTone("unknown")).toBe("muted");
  });
});

// Note: StatusPill is a React component — it's tested via component tests,
// not unit tests. The tone mappers above are the pure functions worth unit
// testing here.
void StatusPill;
