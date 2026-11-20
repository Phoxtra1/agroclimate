import { describe, expect, it } from "vitest";
import { canTransitionDeliveryJob, isTerminalDeliveryJob } from "@/lib/agtrans/statusFlow";

describe("AGTrans delivery lifecycle", () => {
  it("allows the expected forward trip transitions", () => {
    expect(canTransitionDeliveryJob("Assigned", "In Transit")).toBe(true);
    expect(canTransitionDeliveryJob("In Transit", "Near Delivery")).toBe(true);
    expect(canTransitionDeliveryJob("Near Delivery", "Delivered")).toBe(true);
    expect(canTransitionDeliveryJob("Delivered", "Completed")).toBe(true);
  });

  it("rejects skipped, reversed and terminal-state transitions", () => {
    expect(canTransitionDeliveryJob("Assigned", "Delivered")).toBe(false);
    expect(canTransitionDeliveryJob("Delivered", "In Transit")).toBe(false);
    expect(canTransitionDeliveryJob("Completed", "Cancelled")).toBe(false);
    expect(canTransitionDeliveryJob("Cancelled", "Assigned")).toBe(false);
  });

  it("recognizes terminal delivery states", () => {
    expect(isTerminalDeliveryJob("Delivered")).toBe(true);
    expect(isTerminalDeliveryJob("Completed")).toBe(true);
    expect(isTerminalDeliveryJob("Cancelled")).toBe(true);
    expect(isTerminalDeliveryJob("In Transit")).toBe(false);
  });
});
