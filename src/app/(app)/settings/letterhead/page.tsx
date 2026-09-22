'use client';

import { LetterheadSetup } from '@/features/capabilities/documents/letterhead-setup';

export default function LetterheadPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 className="ds-h1">Invoice letterhead</h1>
        <p className="ds-body" style={{ color: 'var(--ink-2)', maxWidth: '46rem', margin: '4px 0 0' }}>
          Upload the stationery you already use. We print onto it rather than recreating it, so your
          branding stays exactly as designed — drag the two guides to say where your artwork ends.
        </p>
      </div>
      <LetterheadSetup />
    </div>
  );
}
