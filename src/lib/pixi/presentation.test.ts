import { describe, expect, it } from "vitest";
import { getWinPresentation } from "./presentation";

describe("getWinPresentation", () => {
  it("uses return relative to stake rather than raw currency", () => {
    expect(getWinPresentation(30, 10).tier).toBe("good");
    expect(getWinPresentation(30, 1).tier).toBe("big");
  });

  it("reserves max presentation for capped wins", () => {
    expect(getWinPresentation(1000, 1, true).tier).toBe("max");
    expect(getWinPresentation(1000, 1, false).tier).toBe("mega");
  });

  it("keeps low returns restrained", () => {
    expect(getWinPresentation(2.99, 1).tier).toBe("standard");
    expect(getWinPresentation(3, 1).tier).toBe("good");
  });
});
