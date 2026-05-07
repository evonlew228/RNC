export function formatSGD(value: number | null | undefined, opts: { compact?: boolean } = {}) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.compact ? 1 : 0,
  }).format(value);
}

export function feeFromJob(annualPackage: number | null, feePct: number): number {
  if (!annualPackage) return 0;
  return Math.round((annualPackage * feePct) / 100);
}

// Firm-wide commission rate: consultants are paid 10% of the fee revenue (firm keeps 90%).
// e.g. on a SGD 100k annual placement at 15% fee = SGD 15k revenue → SGD 1,500 commission pool.
export const COMMISSION_RATE = 0.10;

export function commissionPool(fee: number): number {
  return Math.round(fee * COMMISSION_RATE);
}

// Commission a consultant earns from a placement = pool × split %
export function consultantCommission(fee: number, splitPct: number): number {
  return Math.round((fee * COMMISSION_RATE * splitPct) / 100);
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}
