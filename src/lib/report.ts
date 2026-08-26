/**
 * Renders the executive report as Markdown, purely from the AssessmentResult
 * that n8n returned. Nothing here interprets, re-scores or supplements the
 * assessment - it is a formatting function over data the workflow produced.
 */

import type { AssessmentResult } from '../types';

const rule = '\n---\n';

export function toMarkdown(r: AssessmentResult): string {
  const e = r.executive_summary;
  const L: string[] = [];

  L.push(`# AI System Risk Assessment — ${r.system.name}`);
  L.push('');
  L.push(`**Assessment ID:** \`${r.assessment_id}\`  `);
  L.push(`**Generated:** ${new Date(r.generated_at).toUTCString()}  `);
  L.push(`**Business owner:** ${r.system.owner} · ${r.system.department}`);
  L.push(rule);

  L.push('## 1. Executive summary');
  L.push('');
  L.push(e.business_narrative);
  L.push('');
  L.push(`**Primary risk.** ${e.primary_risk}`);
  L.push('');

  L.push('## 2. Overall risk');
  L.push('');
  L.push(`| | |`);
  L.push(`|---|---|`);
  L.push(`| Overall risk | **${r.risk.band}** |`);
  L.push(`| Risk score | ${r.risk.score} / ${r.risk.max_score} |`);
  L.push(`| Calculation | Impact ${r.risk.factors.impact.value} × Likelihood ${r.risk.factors.likelihood.value} × Exposure ${r.risk.factors.exposure.value} |`);
  L.push(`| Recommended decision | ${e.recommended_decision.replace(/_/g, ' ')} |`);
  L.push(`| Human governance review | ${e.human_review_required ? 'Required' : 'Not required by rule'} |`);
  L.push('');
  L.push('**Risk distribution**');
  L.push('');
  L.push('| Domain | Score | Band |');
  L.push('|---|---|---|');
  r.risk.domains.forEach((d) => L.push(`| ${d.domain} | ${d.score}/100 | ${d.band} |`));
  L.push('');

  L.push('## 3. Key findings');
  L.push('');
  r.findings.slice(0, 10).forEach((f, i) => {
    L.push(`### ${i + 1}. ${f.title} — ${f.severity}`);
    L.push('');
    L.push(f.finding);
    if (f.business_impact) L.push(`\n*Business impact:* ${f.business_impact}`);
    if (f.recommendation) L.push(`\n*Recommendation:* ${f.recommendation}`);
    L.push('');
  });

  L.push('## 4. Business impact');
  L.push('');
  e.top_risks.forEach((t, i) => L.push(`${i + 1}. ${t}`));
  L.push('');

  L.push('## 5. Control gaps');
  L.push('');
  L.push('| Control | Status | Severity | Reason |');
  L.push('|---|---|---|---|');
  r.control_gaps.forEach((c) =>
    L.push(`| ${c.control_id} — ${c.control} | ${c.status} | ${c.severity} | ${c.reason.replace(/\|/g, '/')} |`)
  );
  L.push('');

  L.push('## 6. Evidence gaps');
  L.push('');
  L.push('| Evidence | Status | Risk | Owner |');
  L.push('|---|---|---|---|');
  r.evidence_gaps.forEach((x) => L.push(`| ${x.evidence} | ${x.status} | ${x.risk} | ${x.owner} |`));
  L.push('');

  L.push('## 7. Recommended actions');
  L.push('');
  (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).forEach((p) => {
    const items = r.remediation_plan.filter((i) => i.priority === p);
    if (!items.length) return;
    L.push(`### ${p} — ${items[0].sla}`);
    L.push('');
    items.forEach((i) => {
      L.push(`- **${i.action}**`);
      L.push(`  - Why: ${i.rationale}`);
      L.push(`  - Owner: ${i.owner}${i.linked_controls.length ? ` · Controls: ${i.linked_controls.join(', ')}` : ''}`);
    });
    L.push('');
  });

  L.push('## 8. Governance mapping');
  L.push('');
  L.push('*Illustrative mapping. Not a certified crosswalk and not a claim of compliance with any standard.*');
  L.push('');
  L.push('| Risk | Governance area | Framework reference | Recommended control | Required evidence |');
  L.push('|---|---|---|---|---|');
  r.governance_mappings.forEach((g) =>
    L.push(
      `| ${g.risk.replace(/\|/g, '/')} | ${g.governance_area} | ${g.framework_reference} | ${g.recommended_control} | ${g.required_evidence} |`
    )
  );
  L.push('');

  if (r.tprm) {
    L.push('### Third-party risk (TPRM branch)');
    L.push('');
    L.push(`**Vendor:** ${r.tprm.vendor} · **Vendor risk:** ${r.tprm.vendor_risk_band}`);
    L.push('');
    if (r.tprm.critical_findings.length) {
      L.push('**Critical findings**');
      r.tprm.critical_findings.forEach((x) => L.push(`- ${x}`));
      L.push('');
    }
    if (r.tprm.recommended_questions.length) {
      L.push('**Recommended vendor questions**');
      r.tprm.recommended_questions.forEach((x) => L.push(`- ${x}`));
      L.push('');
    }
  }

  L.push('## 9. Assessment metadata');
  L.push('');
  const a = r.audit_record;
  L.push('| | |');
  L.push('|---|---|');
  L.push(`| Assessment ID | \`${a.assessment_id}\` |`);
  L.push(`| Timestamp | ${a.timestamp} |`);
  L.push(`| Engine version | ${a.engine_version} |`);
  L.push(`| Schema version | ${a.schema_version} |`);
  L.push(`| Input fingerprint | \`${a.input_fingerprint}\` |`);
  L.push(`| AI model | ${a.ai_model} |`);
  L.push(`| Stages completed | ${a.stages_completed.length} |`);
  L.push(`| Final status | ${a.final_status} |`);
  L.push('');
  L.push(rule);
  L.push(`> ${r.disclaimer}`);
  L.push('');

  return L.join('\n');
}

export function downloadMarkdown(r: AssessmentResult) {
  const blob = new Blob([toMarkdown(r)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${r.assessment_id}-${r.system.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
