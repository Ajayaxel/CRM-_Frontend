'use client';

/**
 * Products — the master page for everything you can actually sell.
 *
 * Products used to live inside the Insurers cards, which made them a detail of
 * a company rather than the thing the whole console prices, pays and claims
 * against. This screen is the flat view across every insurer.
 *
 * There is no product endpoint of its own — the source is the insurer list,
 * which returns each company with its active products:
 *   GET  /insurance/companies                (key ins-companies)
 *   POST /insurance/companies/:id/products   { name, category, commissionRatePct, execRatePct }
 *
 * The same query key as the Insurers screen, deliberately: adding a product
 * here refreshes both.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Package, Plus, Search } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  Badge, Card, Drawer, EmptyState, EntityIcon, Field, FormSection,
  Skeleton, Toolbar, humanStatus,
} from '../ui/kit';

/**
 * The categories the console prices and builds claim checklists from.
 *
 * Mirrors WRITABLE_CATEGORIES in apps/api/src/insurance/agent-business.taxonomy.ts,
 * which is the source of truth and rejects anything else; kept in step by
 * scripts/motor-category-offline.ts.
 *
 * Motor is now three specific things rather than one generic one. A product's
 * category becomes the quote's, and the quote's becomes the policy's — so a
 * product left as MOTOR was enough on its own to keep the unclassified row
 * growing, however carefully the quote was raised.
 */
const PRODUCT_CATEGORIES = [
  'PRIVATE_CAR', 'TWO_WHEELER', 'COMMERCIAL_VEHICLE', 'HEALTH', 'TRAVEL', 'FIRE',
  'MARINE', 'PROPERTY', 'LIFE', 'ACCIDENT', 'BUSINESS', 'CUSTOM',
];

interface InsurerProduct {
  id: string;
  name: string;
  category: string;
  commissionRatePct: number;
  execRatePct: number;
  indicativePremiumInr?: number | null;
  indicativeSumInsuredInr?: number | null;
  docChecklist?: unknown;
}

interface Insurer {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  products?: InsurerProduct[];
}

type FlatProduct = InsurerProduct & { companyId: string; companyName: string };

const checklistLength = (p: InsurerProduct) => (Array.isArray(p.docChecklist) ? p.docChecklist.length : null);

/** A wrapping chip row — twelve categories will not fit a segmented control. */
function CategoryChips({
  options, value, onChange,
}: { options: { key: string; count: number }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.key)}
            className={`ds-badge ${on ? 'ds-tone-info' : 'ds-tone-neutral'}`}
            style={{ font: 'inherit', padding: '6px var(--s-3)', cursor: 'pointer' }}
          >
            {o.key === 'All' ? 'All' : humanStatus(o.key)}
            <span className="ds-count">{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}

import { BenefitsEditor } from '../ui/benefits-editor';

export function InsuranceProducts() {
  const [benefitsFor, setBenefitsFor] = useState<{ id: string; name: string } | null>(null);
  const qc = useQueryClient();
  const { data: companies, isLoading } = useQuery({
    queryKey: ['ins-companies'],
    queryFn: async () => (await api.get<Insurer[]>('/insurance/companies')).data,
  });

  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');
  const [addOpen, setAddOpen] = useState(false);
  // Insurers revise brokerage rates every year. Until now the only way to
  // record that was a second product and a book split across the two.
  const [editing, setEditing] = useState<string | null>(null);
  const [ef, setEf] = useState({ name: '', commissionRatePct: '', execRatePct: '', indicativePremiumInr: '', indicativeSumInsuredInr: '' });
  // Defaulted to PRIVATE_CAR, not MOTOR: the old default meant the commonest
  // path through this form produced an unclassified product without anyone
  // choosing anything.
  const [pf, setPf] = useState({ companyId: '', name: '', category: 'PRIVATE_CAR', commissionRatePct: '15', execRatePct: '30', indicativePremiumInr: '', indicativeSumInsuredInr: '' });

  const addProduct = useMutation({
    mutationFn: () =>
      api.post(`/insurance/companies/${pf.companyId}/products`, {
        name: pf.name,
        category: pf.category,
        commissionRatePct: Number(pf.commissionRatePct),
        execRatePct: Number(pf.execRatePct),
        // Blank clears rather than storing 0 — a plan offering a zero premium
        // on the comparison screen is worse than one offering no figure.
        indicativePremiumInr: pf.indicativePremiumInr === '' ? null : Number(pf.indicativePremiumInr),
        indicativeSumInsuredInr: pf.indicativeSumInsuredInr === '' ? null : Number(pf.indicativeSumInsuredInr),
      }),
    onSuccess: () => {
      toast.success('Product added with commission config');
      setPf({ ...pf, name: '' });
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ['ins-companies'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const saveProduct = useMutation({
    mutationFn: (id: string) => api.patch(`/insurance/products/${id}`, {
      name: ef.name.trim(),
      commissionRatePct: Number(ef.commissionRatePct),
      execRatePct: Number(ef.execRatePct),
      indicativePremiumInr: ef.indicativePremiumInr === '' ? null : Number(ef.indicativePremiumInr),
      indicativeSumInsuredInr: ef.indicativeSumInsuredInr === '' ? null : Number(ef.indicativeSumInsuredInr),
    }),
    onSuccess: (r: any) => {
      // The API says explicitly that a rate change is forward-looking. Passing
      // that through matters: a broker who thinks it restates past commission
      // will go looking for money that was never meant to move.
      toast.success(r.data?.note ? `Saved — ${r.data.note}` : 'Product updated');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['ins-companies'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const removeProduct = useMutation({
    mutationFn: (id: string) => api.delete(`/insurance/products/${id}`),
    onSuccess: () => { toast.success('Product removed'); qc.invalidateQueries({ queryKey: ['ins-companies'] }); },
    // A product with policies behind it refuses, and the message says to
    // deactivate instead — worth showing verbatim.
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const insurers = companies ?? [];

  const all: FlatProduct[] = useMemo(
    () =>
      insurers.flatMap((c) =>
        (c.products ?? []).map((p) => ({ ...p, companyId: c.id, companyName: c.name })),
      ),
    [insurers],
  );

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of all) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [
      { key: 'All', count: all.length },
      ...PRODUCT_CATEGORIES.filter((c) => counts.has(c)).map((c) => ({ key: c, count: counts.get(c) ?? 0 })),
    ];
  }, [all]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((p) => {
      if (category !== 'All' && p.category !== category) return false;
      if (!needle) return true;
      return p.name.toLowerCase().includes(needle) || p.companyName.toLowerCase().includes(needle);
    });
  }, [all, category, q]);

  const openAdd = () => {
    setPf((p) => ({ ...p, companyId: p.companyId || insurers[0]?.id || '' }));
    setAddOpen(true);
  };

  return (
    <div className="ds-stack" style={{ gap: 'var(--gap-section)' }}>
      <Toolbar>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 360 }}>
          <Search
            size={14}
            aria-hidden="true"
            style={{
              position: 'absolute', left: 'var(--s-3)', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--ink-3)', pointerEvents: 'none',
            }}
          />
          <input
            className="input"
            style={{ paddingLeft: 'var(--s-7)' }}
            placeholder="Search products or insurers…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search products"
          />
        </div>
        <span style={{ flex: 1 }} />
        <button className="btn-primary" disabled={insurers.length === 0} onClick={openAdd}>
          <Plus size={15} /> Add product
        </button>
      </Toolbar>

      {!isLoading && all.length > 0 && (
        <CategoryChips options={categoryOptions} value={category} onChange={setCategory} />
      )}

      {isLoading ? (
        <div className="ds-grid ds-grid-cards">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} rows={1} height={162} />
          ))}
        </div>
      ) : all.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="No products yet"
            body={insurers.length === 0
              ? 'Add an insurer first — products hang off the company you place the business with.'
              : 'A product carries the commission the console accrues on and the claim checklist it builds. Add the first one.'}
            actionLabel={insurers.length === 0 ? undefined : 'Add product'}
            onAction={insurers.length === 0 ? undefined : openAdd}
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={Search}
            title="Nothing matches"
            body="No product in the book fits that search and category."
          />
        </Card>
      ) : (
        <>
          <div className="ds-caption">
            {shown.length} of {all.length} {all.length === 1 ? 'product' : 'products'} across{' '}
            {insurers.length} {insurers.length === 1 ? 'insurer' : 'insurers'}
          </div>
          <div className="ds-grid ds-grid-cards">
            {shown.map((p) => {
              const checklist = checklistLength(p);
              return (
                <Card key={p.id}>
                  <div className="ds-row" style={{ alignItems: 'flex-start', marginBottom: 'var(--s-4)' }}>
                    <EntityIcon icon={Package} tone="sales" size="lg" />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="ds-h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                      <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>{p.companyName}</div>
                    </div>
                    <Badge tone="neutral" dot={false}>{humanStatus(p.category)}</Badge>
                  </div>

                  <hr className="ds-divider" style={{ margin: '0 0 var(--s-3)' }} />

                  <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))' }}>
                    <div>
                      <div className="ds-caption">Commission</div>
                      <div className="ds-h3 ds-num" style={{ marginTop: 'var(--s-1)' }}>{p.commissionRatePct}%</div>
                    </div>
                    <div>
                      <div className="ds-caption">Executive share</div>
                      <div className="ds-h3 ds-num" style={{ marginTop: 'var(--s-1)' }}>{p.execRatePct}%</div>
                    </div>
                    <div>
                      <div className="ds-caption">Claim documents</div>
                      <div className="ds-h3 ds-num" style={{ marginTop: 'var(--s-1)' }}>
                        {checklist == null ? '—' : checklist}
                      </div>
                    </div>
                  </div>

                  {editing === p.id ? (
                    <div style={{ marginTop: 'var(--s-3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <label className="label" style={{ margin: 0 }}>Product name</label>
                        <input className="input" value={ef.name} onChange={(e) => setEf({ ...ef, name: e.target.value })} autoFocus />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label className="label" style={{ margin: 0 }}>Brokerage %</label>
                          <input className="input" inputMode="decimal" value={ef.commissionRatePct}
                                 onChange={(e) => setEf({ ...ef, commissionRatePct: e.target.value })} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="label" style={{ margin: 0 }}>Executive share %</label>
                          <input className="input" inputMode="decimal" value={ef.execRatePct}
                                 onChange={(e) => setEf({ ...ef, execRatePct: e.target.value })} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label className="label" style={{ margin: 0 }}>Indicative premium</label>
                          <input className="input" inputMode="numeric" placeholder="—" value={ef.indicativePremiumInr}
                                 onChange={(e) => setEf({ ...ef, indicativePremiumInr: e.target.value.replace(/[^\d]/g, '') })} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="label" style={{ margin: 0 }}>Indicative cover</label>
                          <input className="input" inputMode="numeric" placeholder="—" value={ef.indicativeSumInsuredInr}
                                 onChange={(e) => setEf({ ...ef, indicativeSumInsuredInr: e.target.value.replace(/[^\d]/g, '') })} />
                        </div>
                      </div>
                      <div className="ds-caption">
                        A new rate applies to policies issued from now on. Commission already accrued keeps the rate it was booked at.
                      </div>
                      <div className="ds-caption">
                        The indicative figures are what a new quote opens this plan at. They price nothing — the quote line owns the
                        premium once it is written, and brokerage follows that, not this.
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-primary btn-sm" style={{ flex: 1 }} disabled={saveProduct.isPending}
                                onClick={() => saveProduct.mutate(p.id)}>
                          {saveProduct.isPending ? 'Saving…' : 'Save'}
                        </button>
                        <button className="btn-secondary btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, marginTop: 'var(--s-3)' }}>
                      <button
                        className="btn-secondary btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => {
                          setEditing(p.id);
                          setEf({ name: p.name, commissionRatePct: String(p.commissionRatePct), execRatePct: String(p.execRatePct), indicativePremiumInr: p.indicativePremiumInr ? String(p.indicativePremiumInr) : '', indicativeSumInsuredInr: p.indicativeSumInsuredInr ? String(p.indicativeSumInsuredInr) : '' });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => setBenefitsFor({ id: p.id, name: p.name })}
                      >
                        Coverage
                      </button>
                      <button
                        className="btn-ghost btn-sm"
                        style={{ color: 'var(--tone-expired)' }}
                        disabled={removeProduct.isPending}
                        onClick={() => { if (window.confirm(`Remove ${p.name}?`)) removeProduct.mutate(p.id); }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* ------------------------------------------------ add product drawer */}
      <Drawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add product"
        subtitle="Products carry the commission the console accrues on."
      >
        <FormSection title="Product" description="Which insurer sells it, and what it is called.">
          <Field label="Insurer" required>
            <select className="input" value={pf.companyId} onChange={(e) => setPf({ ...pf, companyId: e.target.value })}>
              <option value="">Select…</option>
              {insurers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Category" required>
            <select className="input" value={pf.category} onChange={(e) => setPf({ ...pf, category: e.target.value })}>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{humanStatus(c)}</option>
              ))}
            </select>
          </Field>
          <Field label="Product name" required span={2}>
            <input
              className="input"
              value={pf.name}
              onChange={(e) => setPf({ ...pf, name: e.target.value })}
              placeholder="Comprehensive Motor"
            />
          </Field>
        </FormSection>

        <FormSection title="Commission" description="What the insurer pays, and the executive's cut of it.">
          <Field label="Commission %" hint="Brokerage on the premium.">
            <input
              className="input"
              inputMode="decimal"
              value={pf.commissionRatePct}
              onChange={(e) => setPf({ ...pf, commissionRatePct: e.target.value })}
            />
          </Field>
          <Field label="Executive share %" hint="Share of the brokerage, not of the premium.">
            <input
              className="input"
              inputMode="decimal"
              value={pf.execRatePct}
              onChange={(e) => setPf({ ...pf, execRatePct: e.target.value })}
            />
          </Field>
        </FormSection>

        <FormSection
          title="Indicative figures"
          description="Optional. What a new quote opens this plan at, so a broker picks a plan instead of typing a premium from memory. They price nothing — the quote line owns the premium once written, and brokerage follows that."
        >
          <Field label="Indicative premium" hint="Leave blank if it varies too much to suggest one.">
            <input
              className="input"
              inputMode="numeric"
              value={pf.indicativePremiumInr}
              onChange={(e) => setPf({ ...pf, indicativePremiumInr: e.target.value.replace(/[^\d]/g, '') })}
              placeholder="12500"
            />
          </Field>
          <Field label="Indicative cover" hint="The sum insured this plan is usually written at.">
            <input
              className="input"
              inputMode="numeric"
              value={pf.indicativeSumInsuredInr}
              onChange={(e) => setPf({ ...pf, indicativeSumInsuredInr: e.target.value.replace(/[^\d]/g, '') })}
              placeholder="500000"
            />
          </Field>
        </FormSection>

        <div className="ds-row">
          <button
            className="btn-primary"
            disabled={!pf.companyId || !pf.name || addProduct.isPending}
            onClick={() => addProduct.mutate()}
          >
            {addProduct.isPending ? 'Adding…' : 'Add product'}
          </button>
          <button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
        </div>
      </Drawer>

      <BenefitsEditor
        productId={benefitsFor?.id ?? null}
        productName={benefitsFor?.name}
        open={!!benefitsFor}
        onClose={() => setBenefitsFor(null)}
      />

      {insurers.length === 0 && !isLoading && (
        <div className="ds-caption">
          <Building2 size={12} style={{ verticalAlign: -2, marginRight: 'var(--s-1)' }} />
          Insurers are managed on their own page — a product always belongs to one.
        </div>
      )}
    </div>
  );
}
