import { describe, expect, it } from "vitest";
import { getAdapter, SUPPORTED_PROTOCOLS } from "@/lib/drone/connectionManager";

describe("Aerial Console read-only hardware boundary", () => {
  it("exposes the simulator, generic JSON bridge and read-only MAVLink serial as ready", () => {
    expect(SUPPORTED_PROTOCOLS.filter((item) => item.ready).map((item) => item.id).sort())
      .toEqual(["custom", "mavlink", "simulator"]);
  });

  it("offers MAVLink discovery but refuses connection when browser serial is unavailable", async () => {
    const adapter = getAdapter("mavlink");
    await expect(adapter.scan()).resolves.toEqual([]);
    await expect(adapter.connect("aircraft-001")).rejects.toThrow(/Web Serial|HTTPS/i);
  });

  it("rejects every live flight-control command on the generic telemetry bridge", async () => {
    const adapter = getAdapter("custom");
    await expect(adapter.calibrate()).rejects.toThrow(/read-only/i);
    await expect(adapter.arm()).rejects.toThrow(/read-only/i);
    await expect(adapter.startMission()).rejects.toThrow(/read-only/i);
    await expect(adapter.pauseMission()).rejects.toThrow(/read-only/i);
    await expect(adapter.resumeMission()).rejects.toThrow(/read-only/i);
    await expect(adapter.returnToHome()).rejects.toThrow(/read-only/i);
    await expect(adapter.emergencyLand()).rejects.toThrow(/read-only/i);
  });
});
