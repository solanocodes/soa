export function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function getInitial(name: string): string {
  return (name?.[0] || '?').toUpperCase();
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export const TIER_HIERARCHY: Record<string, number> = {
  FREE: 0,
  MENTORSHIP: 1,
  SOA_CORE: 1,
  INNER_CIRCLE: 2,
  SOA_WEALTH: 3,
};

export function hasAccess(userTier: string, requiredTier: string): boolean {
  return (TIER_HIERARCHY[userTier] ?? 0) >= (TIER_HIERARCHY[requiredTier] ?? 0);
}

export const TIER_COLORS: Record<string, string> = {
  FREE: '#888888',
  MENTORSHIP: '#00D084',
  SOA_CORE: '#00D084',
  INNER_CIRCLE: '#FF6B6B',
  SOA_WEALTH: '#C9A84C',
};

export const TIER_LABELS: Record<string, string> = {
  FREE: 'Free',
  MENTORSHIP: 'Mentorship',
  SOA_CORE: 'Mentorship',
  INNER_CIRCLE: 'Inner Circle',
  SOA_WEALTH: 'SOA Wealth',
};
