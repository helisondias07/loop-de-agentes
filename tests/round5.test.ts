import { describe, expect, it } from "vitest";
import { overclaimHits, staticCopyBlob, uiCopy } from "../src/ui/copy.ts";

describe("round 5 — copy estático sem overclaim", () => {
  it("subtítulo estático pede verificação simulada e não evidência real de testes", () => {
    const staticCopy = uiCopy(true);
    const localCopy = uiCopy(false);
    expect(staticCopy.lede).toContain("gates com verificação simulada no navegador");
    expect(staticCopy.lede).not.toContain("evidência real de testes");
    expect(localCopy.lede).toContain("evidência real de testes");
    expect(overclaimHits(staticCopyBlob(staticCopy))).toEqual([]);
    expect(overclaimHits(staticCopy.lede)).toEqual([]);
  });
});
