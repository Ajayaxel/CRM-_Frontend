import { Construction } from 'lucide-react';

export function ComingSoon({ module, sprint }: { module: string; sprint?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center py-20 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Construction className="h-7 w-7" />
      </span>
      <h3 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>{module}</h3>
      <p className="mt-1 max-w-sm text-sm" style={{ color: 'var(--ink-3)' }}>
        This module is part of the BMN CRM roadmap{sprint ? ` (${sprint})` : ''} and is being
        built next. The data model and API foundation are already in place.
      </p>
    </div>
  );
}
