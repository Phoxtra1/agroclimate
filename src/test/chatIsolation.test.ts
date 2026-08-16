import { describe, expect, it } from "vitest";
import { auditThread, isParticipant } from "@/lib/chatDebug";
import { makeThreadKey } from "@/hooks/useMarketChat";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
const C = "cccccccc-0000-0000-0000-000000000003";

describe("chat thread isolation", () => {
  it("keys a thread per participant pair, order independent", () => {
    expect(makeThreadKey(A, B)).toBe(makeThreadKey(B, A));
    expect(makeThreadKey(A, B)).not.toBe(makeThreadKey(A, C));
  });

  it("keys a separate thread per listing or order context", () => {
    expect(makeThreadKey(A, B, "listing-1")).not.toBe(makeThreadKey(A, B, "listing-2"));
    expect(makeThreadKey(A, B, "listing-1")).not.toBe(makeThreadKey(A, B));
  });

  it("only treats the sender or recipient as a participant", () => {
    const msg = { id: "1", thread_key: makeThreadKey(A, B), sender_id: A, recipient_id: B };
    expect(isParticipant(msg, A)).toBe(true);
    expect(isParticipant(msg, B)).toBe(true);
    expect(isParticipant(msg, C)).toBe(false);
  });

  it("flags and blocks cross-user leakage", () => {
    const key = makeThreadKey(A, B);
    const rows = [
      { id: "1", thread_key: key, sender_id: A, recipient_id: B },
      { id: "2", thread_key: makeThreadKey(A, C), sender_id: A, recipient_id: C },
      { id: "3", thread_key: key, sender_id: C, recipient_id: A },
    ];
    const result = auditThread(rows, B, key, key);
    expect(result.keyMatches).toBe(true);
    expect(result.leaked.map((m) => m.id).sort()).toEqual(["2", "3"]);
    expect(result.kept).toBe(1);
  });
});
