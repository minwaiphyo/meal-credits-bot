type ParsedCandidate = {
  value: number;
  score: number;
};

const AMOUNT_REGEX = /\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g;

export function parseBalance(rawText: string): number | null {
  const text = rawText.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const candidates: ParsedCandidate[] = [];

  for (const match of text.matchAll(AMOUNT_REGEX)) {
    const amountText = match[1];
    if (!amountText) continue;
    const value = Number.parseFloat(amountText.replace(/,/g, ""));
    if (Number.isNaN(value)) continue;
    if (value < 0 || value > 250) continue;

    const index = match.index ?? 0;
    const surrounding = text.slice(Math.max(0, index - 30), Math.min(text.length, index + 40)).toLowerCase();

    let score = 0;
    if (surrounding.includes("remaining")) score += 6;
    if (surrounding.includes("balance")) score += 6;
    if (surrounding.includes("credit")) score += 4;
    if (surrounding.includes("$")) score += 1;
    if (surrounding.includes("spent")) score -= 3;
    if (surrounding.includes("total")) score -= 2;

    candidates.push({ value, score });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.value - b.value;
  });

  return Number(candidates[0].value.toFixed(2));
}

export function parseManualBalance(input: string): number | null {
  const trimmed = input.trim().replace("$", "");
  const value = Number.parseFloat(trimmed);
  if (Number.isNaN(value)) return null;
  if (value < 0 || value > 250) return null;
  return Number(value.toFixed(2));
}
