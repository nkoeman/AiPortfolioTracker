import { describe, expect, it } from "vitest";
import { __testables, selectOpenFigiCandidate } from "@/lib/openfigi/client";

describe("OpenFIGI client helpers", () => {
  it("builds batch payload for ISINs", () => {
    const payload = __testables.buildPayload(["US0000000001", "IE0000000002"]);
    expect(payload).toEqual([
      { idType: "ID_ISIN", idValue: "US0000000001" },
      { idType: "ID_ISIN", idValue: "IE0000000002" }
    ]);
  });

  it("prefers candidate matching preferred MIC", () => {
    const result = selectOpenFigiCandidate(
      [
        { name: "Example", micCode: "XNAS" },
        { name: "Preferred", micCode: "XAMS" }
      ],
      "XAMS"
    );

    expect(result.candidate?.name).toBe("Preferred");
    expect(result.warning).toBeNull();
  });

  it("warns when multiple candidates exist without MIC preference", () => {
    const result = selectOpenFigiCandidate(
      [
        { name: "First", micCode: "XNAS" },
        { name: "Second", micCode: "XAMS" }
      ],
      null
    );

    expect(result.candidate?.name).toBe("First");
    expect(result.warning).toContain("Multiple OpenFIGI candidates");
  });
});
