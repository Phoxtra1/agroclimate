import { describe, it, expect } from "vitest";

describe("Agrofund Intelligence & Workflow Logic", () => {
  it("enforces that only approved opportunities can be published", () => {
    const oppPending = {
      id: "opp-1",
      title: "Agri Grant",
      status: "pending_review",
      is_published: false,
    };

    const oppRejected = {
      id: "opp-2",
      title: "Agri Grant 2",
      status: "rejected",
      is_published: false,
    };

    const oppApproved = {
      id: "opp-3",
      title: "Agri Grant 3",
      status: "approved",
      is_published: false,
    };

    const canPublish = (status: string) => status === "approved";

    expect(canPublish(oppPending.status)).toBe(false);
    expect(canPublish(oppRejected.status)).toBe(false);
    expect(canPublish(oppApproved.status)).toBe(true);
  });

  it("calculates days remaining and detects approaching deadline within 7 days", () => {
    const now = new Date();

    const future10Days = new Date(now.getTime() + 10 * 24 * 3600 * 1000).toISOString();
    const future4Days = new Date(now.getTime() + 4 * 24 * 3600 * 1000).toISOString();
    const past2Days = new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString();

    const getDaysRemaining = (deadlineStr: string) => {
      const diffTime = new Date(deadlineStr).getTime() - new Date().getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const days10 = getDaysRemaining(future10Days);
    const days4 = getDaysRemaining(future4Days);
    const daysPast = getDaysRemaining(past2Days);

    expect(days10).toBeGreaterThan(7);
    expect(days4).toBeLessThanOrEqual(7);
    expect(days4).toBeGreaterThan(0);
    expect(daysPast).toBeLessThan(0);

    const isApproaching = (days: number) => days > 0 && days <= 7;
    expect(isApproaching(days10)).toBe(false);
    expect(isApproaching(days4)).toBe(true);
    expect(isApproaching(daysPast)).toBe(false);
  });

  it("evaluates applicant eligibility priority for Ghanaian and African founders", () => {
    const evaluatePriority = (eligibleCountries: string[]) => {
      const hasGhana = eligibleCountries.some((c) => c.toLowerCase().includes("ghana"));
      const hasAfrica = eligibleCountries.some((c) =>
        ["africa", "sub-saharan", "west africa"].some((k) => c.toLowerCase().includes(k))
      );

      if (hasGhana) return "High Priority (Ghana Open)";
      if (hasAfrica) return "Priority (Pan-African Open)";
      return "General / Global";
    };

    expect(evaluatePriority(["Ghana", "Kenya"])).toBe("High Priority (Ghana Open)");
    expect(evaluatePriority(["All African Union Member States"])).toBe("Priority (Pan-African Open)");
    expect(evaluatePriority(["Germany", "France"])).toBe("General / Global");
  });

  it("prevents duplicates by generating deterministic fingerprint hashes", () => {
    const createFingerprint = (org: string, title: string, link: string) => {
      const clean = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
      return `${clean(org)}-${clean(title)}-${clean(link.split("://")[1] || link)}`;
    };

    const fp1 = createFingerprint(
      "AGRA",
      "Catalytic Innovation Grant 2026",
      "https://agra.org/grants/catalytic-2026"
    );

    const fp2 = createFingerprint(
      "AGRA",
      "Catalytic Innovation Grant 2026",
      "https://agra.org/grants/catalytic-2026"
    );

    const fpDifferent = createFingerprint(
      "AfDB",
      "Youth AgriPitch 2026",
      "https://afdb.org/agripitch"
    );

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fpDifferent);
  });
});
