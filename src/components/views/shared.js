// Pieces used by more than one view.
import React from 'react';
import { Icons } from '../Icons';
import { Avatar, Card, CardHead, CertBadge, Empty, Progress, StatusBadge } from '../ui';
import { PHASES, daysFromToday, fmtDate, fmtRelative, getPhase, isActiveOrientee, oName, phaseFill, phaseInfo, progressPct, totalHours } from '../../lib/format';

export const PhaseSteps = ({ hours }) => {
  const current = getPhase(hours);
  return (
    <div className="phase-steps">
      {PHASES.map(p => (
        <div key={p.n} className={'phase-step' + (p.n < current ? ' done' : p.n === current ? ' now' : '')} style={{ '--pc': p.color, '--fill': phaseFill(p, hours) + '%' }}>
          <b>Phase {p.n}{p.n < current && ' ✓'}</b>
          <span>{p.name}</span>
          <i />
        </div>
      ))}
    </div>
  );
};

export const OrienteeCard = ({ o, onClick }) => {
  const ph = phaseInfo(getPhase(o.hours_completed));
  return (
    <button type="button" className="card clickable" style={{ padding: 16 }} onClick={onClick}>
      <div className="row" style={{ marginBottom: 14 }}>
        <Avatar name={oName(o)} />
        <div className="grow">
          <div className="strong truncate">{oName(o)}</div>
          <div className="tiny muted truncate">FTO · {o.lead_fto?.full_name || 'Unassigned'}</div>
        </div>
        <CertBadge level={o.cert_level} />
      </div>
      <div className="row between tiny" style={{ marginBottom: 6 }}>
        <span style={{ color: ph.color, fontWeight: 650 }}>Phase {ph.n} · {ph.name}</span>
        <span className="soft strong">{o.hours_completed || 0}/{totalHours(o)}h</span>
      </div>
      <Progress value={progressPct(o)} color={ph.color} />
      <div className="row between" style={{ marginTop: 12 }}>
        <StatusBadge status={o.status} />
        {o.tentative_clear_date && <span className="tiny muted">Clear {fmtDate(o.tentative_clear_date, { month: 'short', day: 'numeric' })}</span>}
      </div>
    </button>
  );
};

export const MessagesWidget = ({ messages, onOpen }) => (
  <Card>
    <CardHead title="Recent messages" icon={Icons.MessageCircle}><button type="button" className="link-btn" onClick={onOpen}>Open inbox</button></CardHead>
    {messages.length === 0 ? <Empty icon={Icons.MessageCircle} title="No messages yet" /> : messages.slice(0, 4).map(m => (
      <button type="button" key={m.id} className="list-row" onClick={onOpen}>
        <Avatar name={m.sender?.full_name} size="sm" />
        <div className="grow">
          <div className="row between"><span className="strong small truncate">{m.sender?.full_name || 'Unknown'}</span><span className="tiny muted">{fmtRelative(m.created_at)}</span></div>
          <div className="small soft truncate">{m.content}</div>
        </div>
      </button>
    ))}
  </Card>
);

// Why an active orientee deserves a look today. Returns [] when nothing is wrong.
export const attentionReasons = (o, tasks) => {
  if (!isActiveOrientee(o)) return [];
  const reasons = [];
  if (o.status === 'pending-clearance') reasons.push({ tone: 'brand', text: 'Ready for clearance review' });
  if (o.status === 'at-risk') reasons.push({ tone: 'warning', text: 'Marked at risk' });
  if (o.status === 'extended') reasons.push({ tone: 'danger', text: 'Orientation extended' });
  const sinceEval = daysFromToday(o.last_evaluation_date || o.start_date);
  if (sinceEval !== null && sinceEval <= -7) reasons.push({ tone: 'warning', text: o.last_evaluation_date ? `No evaluation in ${-sinceEval} days` : 'No evaluation on file' });
  const clear = daysFromToday(o.tentative_clear_date);
  if (clear !== null && clear < 0 && o.status !== 'pending-clearance') reasons.push({ tone: 'danger', text: `${-clear}d past tentative clear date` });
  const overdue = tasks.filter(t => t.assigned_to === o.id && t.status !== 'completed' && (daysFromToday(t.due_date) ?? 0) < 0).length;
  if (overdue) reasons.push({ tone: 'warning', text: `${overdue} overdue task${overdue > 1 ? 's' : ''}` });
  return reasons;
};
