'use client';

/**
 * Letterhead setup: upload the company's own stationery, then drag two guides
 * to say where their artwork ends and ours may begin.
 *
 * The guides are the entire contract with the renderer. Everything above the
 * top guide and below the bottom one belongs to the tenant's file and is never
 * touched; the invoice prints between them. That is why this screen shows the
 * real page at real proportions with the bands shaded — somebody setting a
 * number in millimetres blind would have no way to know they had clipped a logo.
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UploadCloud, FileWarning, Check } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { prepareLetterhead } from './pdf-to-image';
import { useStorageStatus } from './document-uploader';

type Template = {
  id: string;
  letterheadDocumentId: string | null;
  headerHeightMm: number | null;
  footerHeightMm: number | null;
  sideMarginMm: number;
  pageSize: string;
  letterheadMode: string;
  version: number;
  artwork?: { fileName: string; mimeType: string; status: string } | null;
};

export function LetterheadSetup() {
  const qc = useQueryClient();
  const storage = useStorageStatus();
  const fileRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [pageMm, setPageMm] = useState({ w: 210, h: 297 });
  const [header, setHeader] = useState(40);
  const [footer, setFooter] = useState(28);
  const [side, setSide] = useState(18);
  const [mode, setMode] = useState('EVERY_PAGE');
  const [docId, setDocId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState<'header' | 'footer' | null>(null);

  const { data: tpl } = useQuery<Template | null>({
    queryKey: ['letterhead-template'],
    queryFn: async () => (await api.get('/invoice-documents/template')).data,
  });

  useEffect(() => {
    if (!tpl) return;
    setHeader(tpl.headerHeightMm ?? 40);
    setFooter(tpl.footerHeightMm ?? 28);
    setSide(tpl.sideMarginMm ?? 18);
    setMode(tpl.letterheadMode ?? 'EVERY_PAGE');
    setDocId(tpl.letterheadDocumentId ?? null);
  }, [tpl]);

  // ---------------------------------------------------------------- upload
  const onFile = async (file: File) => {
    try {
      setBusy('Reading the file…');
      // A PDF becomes a PNG here, before anything is stored. The person who can
      // fix a bad conversion is the one looking at the screen.
      const page = await prepareLetterhead(file);
      if (page.pageCount > 1) {
        toast.info(`That PDF has ${page.pageCount} pages — using the first as the letterhead.`);
      }
      setPreview(URL.createObjectURL(page.blob));
      setPageMm({ w: page.widthMm, h: page.heightMm });

      const max = storage.data?.maxBytes ?? 20 * 1024 * 1024;
      if (page.blob.size > max) {
        throw new Error(
          `The converted page is ${(page.blob.size / 1048576).toFixed(1)}MB, over the ${Math.round(max / 1048576)}MB limit. A lower-resolution scan will work.`,
        );
      }

      setBusy('Uploading…');
      const intent = (
        await api.post('/documents/upload-intent', {
          fileName: page.fileName,
          mimeType: 'image/png',
          sizeBytes: page.blob.size,
          name: 'Letterhead',
          folder: 'ORGANIZATION',
          relatedType: 'NONE',
        })
      ).data;
      const put = await fetch(intent.uploadUrl, { method: 'PUT', body: page.blob, headers: intent.requiredHeaders });
      if (!put.ok) throw new Error(`Storage rejected the upload (${put.status})`);
      await api.post(`/documents/${intent.documentId}/complete`, {});
      setDocId(intent.documentId);
      toast.success('Letterhead uploaded — now set the guides');
    } catch (e: any) {
      toast.error(e?.message ?? apiErrorMessage(e));
      setPreview(null);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = useMutation({
    mutationFn: () =>
      api.post('/invoice-documents/letterhead', {
        letterheadDocumentId: docId,
        headerHeightMm: header,
        footerHeightMm: footer,
        sideMarginMm: side,
        pageSize: pageMm.h > 290 ? 'A4' : 'LETTER',
        letterheadMode: mode,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['letterhead-template'] });
      toast.success('Letterhead saved');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // ---------------------------------------------------------------- guides
  // Dragging works in page millimetres, not pixels, so the numbers stay true at
  // any preview size and match exactly what the print CSS will use.
  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      const box = pageRef.current?.getBoundingClientRect();
      if (!box) return;
      const mmPerPx = pageMm.h / box.height;
      if (dragging === 'header') {
        setHeader(Math.max(0, Math.min(pageMm.h - footer - 40, Math.round((e.clientY - box.top) * mmPerPx))));
      } else {
        setFooter(Math.max(0, Math.min(pageMm.h - header - 40, Math.round((box.bottom - e.clientY) * mmPerPx))));
      }
    };
    const up = () => setDragging(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging, pageMm.h, header, footer]);

  const artwork = preview ?? (tpl?.letterheadDocumentId ? `/api/documents/${tpl.letterheadDocumentId}/download?inline=1` : null);
  const bodyMm = pageMm.h - header - footer;

  if (storage.data && !storage.data.configured) {
    return (
      <div className="ds-card" style={{ padding: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
        <FileWarning size={18} />
        <div>
          <div style={{ fontWeight: 600 }}>Document storage isn&rsquo;t configured yet</div>
          <div className="ds-caption">A letterhead has to be stored somewhere before it can be printed on.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 24, alignItems: 'start' }}>
      {/* ---- the page, at true proportions ---- */}
      <div className="ds-card" style={{ padding: 20 }}>
        <div
          ref={pageRef}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: `${pageMm.w} / ${pageMm.h}`,
            background: '#fff',
            border: '1px solid var(--hairline-strong)',
            borderRadius: 4,
            overflow: 'hidden',
            userSelect: 'none',
          }}
        >
          {artwork ? (
            <img src={artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              Upload your letterhead to see it here
            </div>
          )}

          {/* Shaded = the tenant's artwork, never written over. */}
          <Band top height={(header / pageMm.h) * 100} label="Your header" />
          <Band height={(footer / pageMm.h) * 100} label="Your footer" />

          {artwork && (
            <>
              <Guide pct={(header / pageMm.h) * 100} mm={header} onGrab={() => setDragging('header')} />
              <Guide pct={100 - (footer / pageMm.h) * 100} mm={footer} bottom onGrab={() => setDragging('footer')} />
              <div
                style={{
                  position: 'absolute', left: `${(side / pageMm.w) * 100}%`, right: `${(side / pageMm.w) * 100}%`,
                  top: `${(header / pageMm.h) * 100}%`, bottom: `${(footer / pageMm.h) * 100}%`,
                  border: '1px dashed var(--navy)', pointerEvents: 'none',
                  display: 'grid', placeItems: 'center',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--navy)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 4 }}>
                  Invoice prints here · {bodyMm}mm
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- controls ---- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
          <button className="btn-secondary" style={{ width: '100%' }} disabled={!!busy} onClick={() => fileRef.current?.click()}>
            <UploadCloud size={15} /> {busy ?? (docId ? 'Replace letterhead' : 'Upload letterhead')}
          </button>
          <div className="ds-caption" style={{ marginTop: 6 }}>
            PDF, PNG, JPEG or WebP. A PDF is converted to an image here in your browser — page one is used.
          </div>
        </div>

        <Num label="Header height" value={header} onChange={setHeader} hint="Where your artwork ends" />
        <Num label="Footer height" value={footer} onChange={setFooter} hint="Where your footer begins" />
        <Num label="Side margin" value={side} onChange={setSide} hint="Keeps text clear of vertical rules" />

        <div>
          <label className="label">Letterhead on</label>
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="EVERY_PAGE">Every page</option>
            <option value="FIRST_PAGE_ONLY">First page only</option>
          </select>
          <div className="ds-caption" style={{ marginTop: 4 }}>
            First page only matches pre-printed stationery, where continuation sheets are plain.
          </div>
        </div>

        <button className="btn-primary" disabled={!docId || save.isPending} onClick={() => save.mutate()}>
          <Check size={15} /> {save.isPending ? 'Saving…' : 'Save letterhead'}
        </button>
        {tpl?.version ? <div className="ds-caption">Version {tpl.version} saved</div> : null}
      </div>
    </div>
  );
}

function Band({ top, height, label }: { top?: boolean; height: number; label: string }) {
  if (height <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute', left: 0, right: 0, height: `${height}%`,
        ...(top ? { top: 0 } : { bottom: 0 }),
        background: 'rgba(19,35,118,.07)', pointerEvents: 'none',
        display: 'flex', alignItems: top ? 'flex-start' : 'flex-end', justifyContent: 'flex-end', padding: 4,
      }}
    >
      <span style={{ fontSize: 10, color: 'var(--navy)' }}>{label}</span>
    </div>
  );
}

function Guide({ pct, mm, bottom, onGrab }: { pct: number; mm: number; bottom?: boolean; onGrab: () => void }) {
  return (
    <div
      onMouseDown={(e) => { e.preventDefault(); onGrab(); }}
      title="Drag to move"
      style={{
        position: 'absolute', left: 0, right: 0, top: `${pct}%`,
        height: 2, background: 'var(--navy)', cursor: 'ns-resize', zIndex: 3,
      }}
    >
      <span
        style={{
          position: 'absolute', right: 6, [bottom ? 'top' : 'bottom']: 4,
          fontSize: 10, fontWeight: 600, color: '#fff', background: 'var(--navy)',
          padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap',
        } as React.CSSProperties}
      >
        {mm}mm
      </span>
    </div>
  );
}

function Num({ label, value, onChange, hint }: { label: string; value: number; onChange: (n: number) => void; hint: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          className="input"
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
        <span className="ds-caption">mm</span>
      </div>
      <div className="ds-caption" style={{ marginTop: 4 }}>{hint}</div>
    </div>
  );
}
