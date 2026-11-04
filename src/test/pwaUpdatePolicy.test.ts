import { describe, expect, it } from "vitest";
import { refuseAppWorker } from "@/lib/pwa/updatePolicy";
describe("app update registration", () => {
  it("keeps workers out of production-built numbered previews", () => {
    expect(refuseAppWorker("id-preview-2--example.lovable.app", true, false, false)).toBe(true);
  });
  it("allows the published AgroClimate origin", () => {
    expect(refuseAppWorker("weather-whisper-hub.lovable.app", true, false, false)).toBe(false);
  });
  it("honors the worker kill switch", () => {
    expect(refuseAppWorker("weather-whisper-hub.lovable.app", true, false, true)).toBe(true);
  });
});