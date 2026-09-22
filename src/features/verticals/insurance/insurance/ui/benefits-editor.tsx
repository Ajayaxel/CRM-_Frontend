'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Drawer, Skeleton } from './kit';

/**
 * The Summary of Coverage a plan is sold on, edited as the table it prints as.
 *
 * Deliberately a plain table with two free-text columns and a section toggle,
 * because that is exactly the shape of every insurer's own wording — "In-patient
 * treatment / In-built, up to SI", "PED Waiting Period / 3 Years". Anything more
 * structured would have to model benefits it cannot know about, and anything less
 * puts a paragraph back into a document that needs rows.
 *
 * The whole set is saved at once. A broker rewrites this table as a unit —
 * reordering, merging, deleting in one sitting — and nothing references a row by
 * id, so a replace breaks no link.
 *
 * WHAT GOES IN HERE IS WHAT THE CUSTOMER IS TOLD. It prints onto the policy
 * schedule under the insurer's product name, so it must be transcribed from the
 * insurer's own wording rather than summarised from memory.
 */

interface Row { section: string; label: string; value: string }

export function BenefitsEditor({
  productId, productName, open, onClose,
}: { productId: string | null; productName?: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);

  const q = useQuery({
    queryKey: ['ins-product-benefits', productId],
    queryFn: async () => (await api.get<Row[]>(`/insurance/products/${productId}/benefits`)).data,
    enabled: !!productId && open,
  });

  useEffect(() => {
    if (q.data) setRows(q.data.map((r) => ({ section: r.section, label: r.label, value: r.value })));
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => (await api.put(`/insurance/products/${productId}/benefits`, { rows })).data,
    onSuccess: () => {
      toast.success('Coverage saved — it will print on the schedule');
      qc.invalidateQueries({ queryKey: ['ins-product-benefits', productId] });
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const set = (i: number, patch: Partial<Row>) =>
    setRows((cur) => cur.map((r, n) => (n === i ? { ...r, ...patch } : r)));

  const add = (section: string) => setRows((cur) => [...cur, { section, label: '', value: '' }]);

  const coverage = rows.filter((r) => r.section !== 'WAITING').length;
  const waiting = rows.length - coverage;

  return (
    <Drawer open={open} onClose={onClose} width={720} title="Coverage and waiting periods" subtitle={productName}>
      {q.isLoading ? <Skeleton rows={4} height={44} /> : (
        <>
          <p className="ds-caption" style={{ marginTop: 0 }}>
            Transcribe these from the insurer's own wording. They print on the policy schedule under this
            product's name, so a customer will read them as what they are covered for.
          </p>

          <div style={{ display: 'grid', gap: 8, marginTop: 'var(--s-3)' }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <select
                  className="input" style={{ flex: '0 0 120px' }}
                  value={r.section}
                  onChange={(e) => set(i, { section: e.target.value })}
                >
                  <option value="COVERAGE">Coverage</option>
                  <option value="WAITING">Waiting</option>
                </select>
                <input
                  className="input" style={{ flex: 1 }}
                  placeholder={r.section === 'WAITING' ? 'PED Waiting Period' : 'In-patient treatment'}
                  value={r.label} onChange={(e) => set(i, { label: e.target.value })}
                />
                <input
                  className="input" style={{ flex: 1 }}
                  placeholder={r.section === 'WAITING' ? '3 Years' : 'In-built, up to SI'}
                  value={r.value} onChange={(e) => set(i, { value: e.target.value })}
                />
                <button
                  className="btn-ghost btn-sm" title="Remove this row"
                  style={{ color: 'var(--tone-expired)', flex: 'none' }}
                  onClick={() => setRows((cur) => cur.filter((_, n) => n !== i))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {!rows.length && (
              <p className="ds-caption" style={{ margin: 0 }}>
                Nothing recorded yet. The schedule prints a note saying so until there is.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 'var(--s-3)', flexWrap: 'wrap' }}>
            <button className="btn-secondary btn-sm" onClick={() => add('COVERAGE')}><Plus size={13} /> Benefit</button>
            <button className="btn-secondary btn-sm" onClick={() => add('WAITING')}><Plus size={13} /> Waiting period</button>
            <span className="ds-caption" style={{ marginLeft: 'auto' }}>
              {coverage} benefit{coverage === 1 ? '' : 's'} · {waiting} waiting period{waiting === 1 ? '' : 's'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 'var(--s-4)' }}>
            <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : 'Save coverage'}
            </button>
            <button className="btn-secondary" onClick={onClose} disabled={save.isPending}>Cancel</button>
          </div>
        </>
      )}
    </Drawer>
  );
}
