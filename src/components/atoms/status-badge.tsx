import { cn } from '@/lib/utils';

const STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INVITED: 'bg-amber-100 text-amber-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  TRIALING: 'bg-blue-100 text-blue-700',
  PAST_DUE: 'bg-red-100 text-red-700',
  CANCELLED: 'ds-tone-neutral',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('badge', STYLES[status] ?? 'ds-tone-neutral')}>
      {status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')}
    </span>
  );
}
