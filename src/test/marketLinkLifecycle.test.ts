import { describe, expect, it } from "vitest";
import { canTransitionContractState, canTransitionLogistics } from "@/hooks/useMarketLink";

describe("Market Link contract lifecycle", () => {
  it("allows only the farmer to accept or reject a proposal", () => {
    expect(canTransitionContractState("proposed", "accepted", true)).toBe(true);
    expect(canTransitionContractState("proposed", "rejected", true)).toBe(true);
    expect(canTransitionContractState("proposed", "accepted", false)).toBe(false);
    expect(canTransitionContractState("proposed", "rejected", false)).toBe(false);
  });

  it("allows either party to cancel a proposal or accepted contract", () => {
    expect(canTransitionContractState("proposed", "cancelled", false)).toBe(true);
    expect(canTransitionContractState("accepted", "cancelled", true)).toBe(true);
  });

  it("makes rejected, cancelled and completed contracts terminal", () => {
    for (const state of ["rejected", "cancelled", "completed"] as const) {
      expect(canTransitionContractState(state, "accepted", true)).toBe(false);
      expect(canTransitionContractState(state, "completed", false)).toBe(false);
    }
  });

  it("only completes an accepted contract", () => {
    expect(canTransitionContractState("accepted", "completed", false)).toBe(true);
    expect(canTransitionContractState("proposed", "completed", true)).toBe(false);
  });
});

describe("Market Link logistics lifecycle", () => {
  it("requires sequential logistics progression", () => {
    expect(canTransitionLogistics("pending", "scheduled")).toBe(true);
    expect(canTransitionLogistics("scheduled", "in_transit")).toBe(true);
    expect(canTransitionLogistics("in_transit", "delivered")).toBe(true);
  });

  it("rejects skipped, reversed and repeated logistics states", () => {
    expect(canTransitionLogistics("pending", "in_transit")).toBe(false);
    expect(canTransitionLogistics("delivered", "pending")).toBe(false);
    expect(canTransitionLogistics("scheduled", "scheduled")).toBe(false);
  });
});
