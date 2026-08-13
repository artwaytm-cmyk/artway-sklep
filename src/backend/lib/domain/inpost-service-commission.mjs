const MONEY_MAX = 1_000_000;

function money(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(MONEY_MAX, Math.round(number * 100) / 100));
}

export function inpostServiceDefaultCommissionTiers() {
  return [
    { upToGross: 20, commissionGross: 4 },
    { upToGross: 30, commissionGross: 6 },
    { upToGross: 40, commissionGross: 8 },
    { upToGross: 50, commissionGross: 10 },
  ];
}

export function normalizeInpostServiceCommissionTiers(raw = []) {
  const defaults = inpostServiceDefaultCommissionTiers();
  if (!Array.isArray(raw) || raw.length < defaults.length) return defaults;
  const normalized = raw.slice(0, 10).map((tier) => ({
    upToGross: money(tier?.upToGross),
    commissionGross: money(tier?.commissionGross),
  })).filter((tier) => tier.upToGross > 0 && tier.commissionGross > 0)
    .sort((left, right) => left.upToGross - right.upToGross);
  const unique = normalized.filter((tier, index) => index === 0 || tier.upToGross > normalized[index - 1].upToGross);
  return unique.length >= defaults.length ? unique : defaults;
}

export function inpostServiceCommissionFor(totalGross, rawTiers = []) {
  const tiers = normalizeInpostServiceCommissionTiers(rawTiers), total = money(totalGross);
  const index = tiers.findIndex((tier) => total <= tier.upToGross), selectedIndex = index >= 0 ? index : tiers.length - 1;
  return { ...tiers[selectedIndex], index: selectedIndex, overflow: index < 0 };
}
