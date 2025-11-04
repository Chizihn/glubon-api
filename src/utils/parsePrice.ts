// src/utils/parsePrice.ts
export const parsePrice = (input: string): number | null => {
  const match = input.match(/₦?\s*([\d,]+)\s*(k|m)?/i);
  if (!match) return null;

  const [, amountStr, unit] = match;
  const amount = parseFloat(String(amountStr).replace(/,/g, ""));
  if (isNaN(amount)) return null;

  if (unit?.toLowerCase() === "k") return amount * 1000;
  if (unit?.toLowerCase() === "m") return amount * 1_000_000;
  return amount;
};

type PriceRange = {
  min?: number | undefined;
  max?: number | undefined;
};

export const extractPriceRange = (query: string): PriceRange => {
  const matches = [...query.matchAll(/₦?\s*([\d,]+)\s*(k|m)?/gi)];
  const prices = matches
    .map(m => parsePrice(m[0]))
    .filter((p): p is number => p !== null);

  if (prices.length === 0) return {};
  if (prices.length === 1) return { max: prices[0], min: undefined };
  return { 
    min: Math.min(...prices), 
    max: Math.max(...prices) 
  };
};