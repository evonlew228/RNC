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
