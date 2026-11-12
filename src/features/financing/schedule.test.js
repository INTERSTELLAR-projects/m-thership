import { describe, it, expect } from "vitest";
import { analyze, dueDates, suggestPayment } from "./schedule";

const base = { payment_amount: 500, num_payments: 6, frequency: "monthly", first_due_date: "2026-08-15", grace_days: 3, status: "active" };

describe("client financing schedule", () => {
  it("builds monthly due dates and clamps month-end", () => {
    const d = dueDates({ ...base, first_due_date: "2026-01-31", num_payments: 3 });
    expect(d.map((x) => x.getDate())).toEqual([31, 28, 31]);
  });

  it("is late when an installment is past due + grace and unpaid", () => {
    const a = analyze({ ...base, payments: [{ date: "2026-08-15", amount: 500 }] }, new Date(2026, 10, 12));
    // Due Aug 15, Sep 15, Oct 15, Nov 15 … only Aug paid; Sep and Oct are late as of Nov 12.
    expect(a.covered).toBe(1);
    expect(a.health).toBe("late");
    expect(a.lateItems.length).toBe(2);
    expect(a.behind).toBe(1000);
    expect(a.balance).toBe(2500);
  });

  it("partial payment reduces what is behind", () => {
    const a = analyze({ ...base, payments: [{ date: "2026-08-15", amount: 700 }] }, new Date(2026, 9, 1));
    expect(a.covered).toBe(1);
    expect(a.behind).toBe(300);
  });

  it("paid off when the scheduled total is covered", () => {
    const a = analyze({ ...base, payments: [{ date: "2026-08-15", amount: 3000 }] }, new Date(2026, 10, 12));
    expect(a.health).toBe("paid_off");
    expect(a.balance).toBe(0);
  });

  it("due soon inside 7 days, on track otherwise", () => {
    const paidUp = { ...base, payments: [{ date: "2026-08-15", amount: 1500 }] };
    expect(analyze(paidUp, new Date(2026, 10, 12)).health).toBe("due_soon");
    expect(analyze(paidUp, new Date(2026, 10, 1)).health).toBe("on_track");
  });

  it("suggests a level payment", () => {
    expect(suggestPayment({ total_price: 6000, down_payment: 0, interest_rate: 0, num_payments: 12, frequency: "monthly" })).toBe(500);
    expect(suggestPayment({ total_price: 10000, down_payment: 0, interest_rate: 12, num_payments: 12, frequency: "monthly" })).toBeCloseTo(888.49, 1);
  });
});
