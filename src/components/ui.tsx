import type { ReactNode } from 'react';
import type { RiskBand } from '../types';

export function Badge({ value, children }: { value: string; children?: ReactNode }) {
  return <span className={`badge ${value}`}>{children ?? value.replace(/_/g, ' ')}</span>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Section({
  id,
  eyebrow,
  title,
  lede,
  alt,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  alt?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`band${alt ? ' alt' : ''}`} id={id}>
      <div className="wrap">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {lede && <p className="lede" style={{ marginTop: 12 }}>{lede}</p>}
        <div style={{ marginTop: 30 }}>{children}</div>
      </div>
    </section>
  );
}

export const BAND_COLOR: Record<RiskBand, string> = {
  LOW: 'var(--low)',
  MODERATE: 'var(--moderate)',
  HIGH: 'var(--high)',
  CRITICAL: 'var(--critical)',
};

export function Meter({ pct, band }: { pct: number; band: RiskBand }) {
  return (
    <div className="meter" role="presentation">
      <span style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: BAND_COLOR[band] }} />
    </div>
  );
}

const MARK: Record<string, string> = {
  PRESENT: '✓',
  PROVIDED: '✓',
  PARTIAL: '⚠',
  GAP: '✕',
  MISSING: '✕',
};

export function StatusRow({
  status,
  label,
  detail,
  right,
}: {
  status: string;
  label: string;
  detail?: string;
  right?: ReactNode;
}) {
  return (
    <div className="statusrow">
      <span className={`mark ${status}`} aria-label={status}>
        {MARK[status] ?? '•'}
      </span>
      <span style={{ flex: 1 }}>
        <strong style={{ fontWeight: 550 }}>{label}</strong>
        {detail && (
          <span style={{ display: 'block', color: 'var(--text-dim)', fontSize: '0.83rem', marginTop: 2 }}>
            {detail}
          </span>
        )}
      </span>
      {right}
    </div>
  );
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl style={{ margin: 0 }}>
      {items.map(([k, v]) => (
        <div className="kv" key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pipeline({
  steps,
}: {
  steps: { label: string; kind: 'ai' | 'det' | 'io' }[];
}) {
  return (
    <div className="pipe">
      {steps.map((s, i) => (
        <div key={s.label}>
          <div className={`step ${s.kind === 'io' ? '' : s.kind}`}>
            <span className="n">{String(i + 1).padStart(2, '0')}</span>
            <span style={{ flex: 1 }}>{s.label}</span>
            {s.kind !== 'io' && (
              <span
                className="mono"
                style={{ fontSize: '0.66rem', color: s.kind === 'ai' ? 'var(--accent)' : 'var(--low)' }}
              >
                {s.kind === 'ai' ? 'LLM' : 'RULES'}
              </span>
            )}
          </div>
          {i < steps.length - 1 && <div className="arrow">{'↓'}</div>}
        </div>
      ))}
    </div>
  );
}
