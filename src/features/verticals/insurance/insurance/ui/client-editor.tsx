'use client';

/**
 * Correcting a client's own details.
 *
 * Until now the only thing the console could do with a client was create one.
 * A phone typed wrong at first contact stayed wrong forever — and the phone and
 * the email are exactly what the policy email and the passwordless portal
 * sign-in are keyed on, so a typo did not merely look untidy, it cut the
 * customer off from their own policies.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';

type Client = {
  id: string;
  name: string;
  type?: string | null;
  phone?: string | null;
  email?: string | null;
};

export function ClientEditor({
  client, onClose, onSaved,
}: {
  client: Client;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    name: client.name ?? '',
    type: client.type ?? 'INDIVIDUAL',
    phone: client.phone ?? '',
    email: client.email ?? '',
  });

  const save = useMutation({
    mutationFn: () => api.patch(`/insurance/clients/${client.id}`, f),
    onSuccess: () => { toast.success('Client updated'); onSaved(); onClose(); },
    // The duplicate-phone refusal names the other client, so it is worth
    // showing verbatim rather than replacing with "could not save".
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  return (
    <div className="ds-card" style={{ padding: 'var(--s-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--s-3)' }}>
        <div className="ds-h3">Edit client details</div>
        <button className="btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Close">
          <X size={15} />
        </button>
      </div>

      <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 'var(--s-3)' }}>
        <div>
          <label className="label">Name</label>
          <input className="input" value={f.name} onChange={set('name')} />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={f.type} onChange={set('type')}>
            <option value="INDIVIDUAL">Individual</option>
            <option value="BUSINESS">Business</option>
          </select>
        </div>
        <div>
          <label className="label">Mobile</label>
          <input className="input" value={f.phone} onChange={set('phone')} placeholder="98765 43210" />
          <div className="ds-caption" style={{ marginTop: 4 }}>
            What the customer signs in to their portal with.
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={f.email} onChange={set('email')} placeholder="name@example.com" />
          <div className="ds-caption" style={{ marginTop: 4 }}>
            Where the policy summary and renewal notices are sent.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--s-2)', justifyContent: 'flex-end', marginTop: 'var(--s-4)' }}>
        <button className="btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button
          className="btn-primary btn-sm"
          disabled={save.isPending || !f.name.trim()}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
