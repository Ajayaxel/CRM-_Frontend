export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--s-4)',
        marginBottom: 'var(--gap-section)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="ds-caption" style={{ marginBottom: 6 }}>{eyebrow}</div>}
        <h1 className="ds-h1">{title}</h1>
        {description && (
          <p className="ds-body" style={{ marginTop: 4, marginBottom: 0, maxWidth: '62ch' }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="ds-row" style={{ gap: 'var(--s-2)' }}>{actions}</div>}
    </div>
  );
}
