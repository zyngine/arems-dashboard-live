import React, { useState } from 'react';
import { Icons } from '../Icons';
import { Avatar, Badge, Button, Card, Empty, Modal, PageHead, SearchInput, SkeletonRows, Stars } from '../ui';
import { fmtDate, oName, phaseInfo } from '../../lib/format';

export default function EvaluationsView({ ctx }) {
  const { role, loading, evaluations, orientees, myOrientee, open } = ctx;
  const [q, setQ] = useState('');
  const [who, setWho] = useState('all');
  const isOrientee = role === 'orientee';
  // Orientees never see the star rating their FTO gave them, only the written feedback.
  const showRating = !isOrientee;

  let rows = isOrientee ? evaluations.filter(e => e.orientee_id === myOrientee?.id) : evaluations;
  if (who !== 'all') rows = rows.filter(e => e.orientee_id === who);
  const s = q.trim().toLowerCase();
  if (s) rows = rows.filter(e => [oName(e.orientee), e.evaluator?.full_name, e.strengths, e.improvements].some(f => (f || '').toLowerCase().includes(s)));

  return (
    <div className="page">
      <PageHead title="Evaluations" sub={isOrientee ? 'Feedback from each shift you have worked.' : 'Shift-by-shift feedback on every orientee.'}>
        {isOrientee && myOrientee && <Button variant="secondary" icon={Icons.Star} onClick={() => open('addFTOEval')}>Rate your FTO</Button>}
        {!isOrientee && <Button icon={Icons.Plus} onClick={() => open('addEval')}>New evaluation</Button>}
      </PageHead>

      {!isOrientee && (
        <div className="toolbar">
          <SearchInput value={q} onChange={setQ} placeholder="Search names or notes…" />
          <select className="select" style={{ width: 'auto', maxWidth: 240 }} value={who} onChange={e => setWho(e.target.value)} aria-label="Orientee">
            <option value="all">All orientees</option>{orientees.map(o => <option key={o.id} value={o.id}>{oName(o)}</option>)}
          </select>
        </div>
      )}

      <Card className="table-wrap">
        {loading ? <SkeletonRows rows={6} /> : rows.length === 0 ? (
          <Empty icon={Icons.ClipboardCheck} title={s || who !== 'all' ? 'No evaluations match' : 'No evaluations yet'}>{isOrientee ? 'Your FTO files one after each shift.' : 'File one after each shift with an orientee.'}</Empty>
        ) : (
          <table className="table stackable">
            <thead><tr><th>Date</th><th>Orientee</th><th>Evaluator</th><th>Phase</th>{showRating && <th>Rating</th>}<th className="num">Hours</th><th aria-label="Open" /></tr></thead>
            <tbody>
              {rows.map(ev => (
                <tr key={ev.id} className="clickable" tabIndex={0} onClick={() => open('eval', ev)} onKeyDown={e => e.key === 'Enter' && open('eval', ev)}>
                  <td data-label="Date" className="soft" style={{ whiteSpace: 'nowrap' }}>{fmtDate(ev.shift_date)}</td>
                  <td className="primary"><div className="row"><Avatar name={oName(ev.orientee)} size="sm" /><span className="strong">{oName(ev.orientee)}</span></div></td>
                  <td data-label="Evaluator">{ev.evaluator?.full_name || '—'}</td>
                  <td data-label="Phase"><span style={{ color: phaseInfo(ev.phase).color, fontWeight: 650 }}>{ev.phase || 1}</span></td>
                  {showRating && <td data-label="Rating"><Stars value={ev.overall_rating} /></td>}
                  <td data-label="Hours" className="num strong">{ev.hours_logged}h</td>
                  <td className="num hide-stack"><Icons.ChevronRight size={16} className="muted" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const Note = ({ tone, title, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div className="label">{title}</div>
    <div className={'callout tone-' + tone} style={{ display: 'block', whiteSpace: 'pre-wrap' }}><div>{children}</div></div>
  </div>
);

export function EvalDetailModal({ evaluation: ev, role, onClose }) {
  const showRating = role !== 'orientee';
  const ph = phaseInfo(ev.phase);
  const tasks = ev.daily_tasks || [];
  return (
    <Modal onClose={onClose} title="Shift evaluation" width={560}>
      <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 18 }}>
        <div className="row"><Avatar name={oName(ev.orientee)} size="lg" /><div><h3 style={{ fontSize: 18 }}>{oName(ev.orientee)}</h3><div className="small soft">Evaluated by {ev.evaluator?.full_name || 'Unknown'}</div></div></div>
        <div style={{ textAlign: 'right' }}><div className="strong">{fmtDate(ev.shift_date)}</div><div className="tiny muted">{[ev.shift_type && `${ev.shift_type} shift`, ev.station].filter(Boolean).join(' · ')}</div></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${showRating ? 3 : 2}, minmax(0, 1fr))`, gap: 8, marginBottom: 18 }}>
        {showRating && <div className="tile"><b style={{ lineHeight: '30px' }}><Stars value={ev.overall_rating} size={17} /></b><span>Overall rating</span></div>}
        <div className="tile"><b>{ev.hours_logged}h</b><span>Hours logged</span></div>
        <div className="tile"><b style={{ color: ph.color }}>{ph.n}</b><span>{ph.name}</span></div>
      </div>
      {tasks.length > 0 && <div style={{ marginBottom: 14 }}><div className="label">Covered this shift</div><div className="row wrap" style={{ gap: 6 }}>{tasks.map(t => <Badge key={t} tone="success"><Icons.Check size={12} />{t}</Badge>)}</div></div>}
      {ev.strengths && <Note tone="success" title="Strengths">{ev.strengths}</Note>}
      {ev.improvements && <Note tone="warning" title="Areas for improvement">{ev.improvements}</Note>}
      {!ev.strengths && !ev.improvements && tasks.length === 0 && <p className="soft">No notes were recorded for this shift.</p>}
    </Modal>
  );
}
