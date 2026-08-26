import type { AssessmentInput } from '../types';
import { FORM_GROUPS, type Field } from '../data/formSchema';
import scenarios from '../data/scenarios.json';
import { Card } from './ui';

interface Props {
  value: AssessmentInput;
  onChange: (next: AssessmentInput) => void;
  onSubmit: () => void;
  onLoadScenario: (input: AssessmentInput) => void;
  onReset: () => void;
  busy: boolean;
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: AssessmentInput;
  onChange: (patch: Partial<AssessmentInput>) => void;
}) {
  const name = field.name;
  const current = value[name];

  if (field.kind === 'boolean') {
    return (
      <label className="toggle">
        <input
          id={String(name)}
          type="checkbox"
          checked={Boolean(current)}
          onChange={(e) => onChange({ [name]: e.target.checked } as Partial<AssessmentInput>)}
        />
        <span className="track" />
        <span style={{ fontSize: '0.88rem' }}>{Boolean(current) ? 'Yes' : 'No'}</span>
      </label>
    );
  }

  if (field.kind === 'select') {
    return (
      <select
        id={String(name)}
        value={String(current ?? '')}
        onChange={(e) => onChange({ [name]: e.target.value } as unknown as Partial<AssessmentInput>)}
      >
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.kind === 'textarea') {
    return (
      <textarea
        id={String(name)}
        value={String(current ?? '')}
        placeholder={field.placeholder}
        onChange={(e) => onChange({ [name]: e.target.value } as unknown as Partial<AssessmentInput>)}
      />
    );
  }

  if (field.kind === 'tags') {
    return (
      <textarea
        id={String(name)}
        style={{ minHeight: 76 }}
        value={(current as string[]).join('\n')}
        placeholder={field.placeholder}
        onChange={(e) =>
          onChange({
            [name]: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
          } as unknown as Partial<AssessmentInput>)
        }
      />
    );
  }

  if (field.kind === 'number') {
    return (
      <input
        id={String(name)}
        type="number"
        min={0}
        value={Number(current ?? 0)}
        onChange={(e) => onChange({ [name]: Number(e.target.value) } as unknown as Partial<AssessmentInput>)}
      />
    );
  }

  return (
    <input
      id={String(name)}
      type="text"
      value={String(current ?? '')}
      placeholder={field.placeholder}
      onChange={(e) => onChange({ [name]: e.target.value } as unknown as Partial<AssessmentInput>)}
    />
  );
}

export default function AssessmentForm({
  value,
  onChange,
  onSubmit,
  onLoadScenario,
  onReset,
  busy,
}: Props) {
  const patch = (p: Partial<AssessmentInput>) => onChange({ ...value, ...p });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Card className="tight">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', letterSpacing: '0.09em' }}>
            SYNTHETIC EXAMPLES
          </span>
          {scenarios.map((s) => (
            <button
              type="button"
              key={s.id}
              className="btn small"
              title={s.blurb}
              onClick={() => onLoadScenario(s.input as AssessmentInput)}
            >
              {s.label}
            </button>
          ))}
          <button type="button" className="btn small" onClick={onReset}>
            Clear
          </button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: '0.81rem', color: 'var(--text-dim)' }}>
          These load <strong>form inputs only</strong> — fictional systems with no real vendor or customer
          data. The assessment itself is always produced live by n8n.
        </p>
      </Card>

      <div style={{ marginTop: 26 }}>
        {FORM_GROUPS.map((group) => {
          const visible = group.fields.filter((f) => !f.showIf || f.showIf(value));
          return (
            <fieldset key={group.id}>
              <legend>{group.title}</legend>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: '0 0 16px' }}>{group.intro}</p>
              <div className="grid c2">
                {visible.map((field) => (
                  <div
                    className="field"
                    key={String(field.name)}
                    style={
                      field.kind === 'textarea' || field.kind === 'tags'
                        ? { gridColumn: '1 / -1' }
                        : undefined
                    }
                  >
                    <label className="field-label" htmlFor={String(field.name)}>
                      {field.label}
                      {field.required && <span className="req">*</span>}
                    </label>
                    {field.helper && <div className="helper">{field.helper}</div>}
                    <FieldControl field={field} value={value} onChange={patch} />
                  </div>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Running assessment…' : 'Run assessment in n8n'}
        </button>
        <span style={{ fontSize: '0.83rem', color: 'var(--text-dim)' }}>
          Runs 5–6 sequential LLM calls plus the deterministic engine. Typically 30–90 seconds.
        </span>
      </div>
    </form>
  );
}
