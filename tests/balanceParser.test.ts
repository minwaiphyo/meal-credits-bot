import { describe, expect, it } from "vitest";
import { parseBalance, parseManualBalance } from "../src/utils/balanceParser";

describe("parseBalance", () => {
  it("parses dollar format", () => {
    expect(parseBalance("Remaining Credits: $123.45")).toBe(123.45);
  });

  it("parses plain number format", () => {
    expect(parseBalance("balance 89.10")).toBe(89.1);
  });

  it("prefers amount near remaining/balance context", () => {
    const input = "Total Monthly Credits: $250.00 Spent: $175.00 Remaining Balance: $75.00";
    expect(parseBalance(input)).toBe(75);
  });

  it("returns null for out of range values", () => {
    expect(parseBalance("Remaining Balance: $400.00")).toBeNull();
  });
});

describe("parseManualBalance", () => {
  it("parses manual amount", () => {
    expect(parseManualBalance("$12.4")).toBe(12.4);
  });

  it("rejects invalid amount", () => {
    expect(parseManualBalance("abc")).toBeNull();
  });

  it("rejects out of range amount", () => {
    expect(parseManualBalance("300")).toBeNull();
  });
});
