import React, { useState } from 'react';
import { Icons } from '../Icons';
import { Avatar, Badge, Button, Card, CertBadge, Empty, PageHead, SearchInput, SkeletonRows, Stars, StatusBadge, Tabs } from '../ui';
import { toCSV, downloadCSV } from '../../lib/csv';
import { avg, fmtDate, isActiveOrientee, oEmail, oName, statusInfo, todayISO, totalHours } from '../../lib/format';

export default function RecordsView({ ctx }) {
  const { loading, orientees, evaluations, tasks, open } = ctx;
  const [expanded, setExpanded] = useState(null);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('all');

  const s = q.trim().toLowerCase();
  const rows = orientees
    .filter(o => scope === 'all' || (scope === 'archived' ? o.is_archived : scope === 'cleared' ? !o.is_archived && o.status === 'cleared' : isActiveOrientee(o)))
    .filter(o => !s || [oName(o), oEmail(o), o.cert_level].some(f => (f || '').toLowerCase().includes(s)));

  const evalsOf = (o) => evaluations.filter(e => e.orientee_id === o.id);
  const tasksOf = (o) => tasks.filter(t => t.assigned_to === o.id);

  const exportCsv = () => downloadCSV(`arems-orientee-records-${todayISO()}.csv`, toCSV(rows, [
    { label: 'Name', value: oName },
    { label: 'Email', value: oEmail },
    { label: 'Cert Level', value: o => o.cert_level || '' },
    { label: 'Status', value: o => (o.is_archived ? 'Archived' : statusInfo(o.status).label) },
    { label: 'Lead FTO', value: o => o.lead_fto?.full_name || '' },
    { label: 'Start Date', value: o => o.start_date || '' },
    { label: 'Hours Completed', value: o => o.hours_completed || 0 },
    { label: 'Hours Required', value: totalHours },
    { label: 'Evaluations', value: o => evalsOf(o).length },
    { label: 'Average Rating', value: o => { const a = avg(evalsOf(o).map(e => e.overall_rating)); return a === null ? '' : a.toFixed(2); } },
    { label: 'Tasks Verified', value: o => tasksOf(o).filter(t => t.status === 'completed').length },
    { label: 'Tasks Assigned', value: o => tasksOf(o).length },
  ]));

  return (
    <div className="page">
      <PageHead title="Records" sub="The permanent file for every orientee, including cleared and archived.">
        <Button variant="secondary" icon={Icons.Download} disabled={rows.length === 0} onClick={exportCsv}>Export CSV ({rows.length})</Button>
      </PageHead>
      <div className="toolbar">
        <Tabs label="Filter records" value={scope} onChange={setScope} options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'cleared', label: 'Cleared' }, { value: 'archived', label: 'Archived' }]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search records…" />
      </div>
      <Card>
        {loading ? <SkeletonRows rows={6} /> : rows.length === 0 ? <Empty icon={Icons.FileText} title="No records found" /> : rows.map(o => {
          const oe = evalsOf(o), ot = tasksOf(o), done = ot.filter(t => t.status === 'completed'), isOpen = expanded === o.id;
          return (
            <div key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <button type="button" className="list-row" style={{ borderBottom: 0 }} aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : o.id)}>
                <Avatar name={oName(o)} />
                <div className="grow">
                  <div className="row wrap" style={{ gap: 6 }}><span className="strong">{oName(o)}</span><CertBadge level={o.cert_level} />{o.is_archived ? <Badge>Archived</Badge> : <StatusBadge status={o.status} />}</div>
                  <div className="tiny muted" style={{ marginTop: 2 }}>Started {fmtDate(o.start_date)} · FTO {o.lead_fto?.full_name || 'unassigned'}</div>
                </div>
                <div className="row hide-mobile" style={{ gap: 22, textAlign: 'right' }}>
                  <div><div className="strong">{o.hours_completed || 0}h</div><div className="tiny muted">hours</div></div>
                  <div><div className="strong">{oe.length}</div><div className="tiny muted">evals</div></div>
                  <div><div className="strong">{done.length}/{ot.length}</div><div className="tiny muted">tasks</div></div>
                </div>
                <Icons.ChevronDown size={17} className="muted" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {isOpen && (
                <div style={{ padding: '4px 18px 18px', background: 'var(--surface-2)' }}>
                  <div className="grid cols-2" style={{ paddingTop: 14 }}>
                    <div>
                      <div className="label">Evaluations ({oe.length})</div>
                      {oe.length === 0 ? <p className="small muted">None on file.</p> : <div className="card">{oe.slice(0, 6).map(ev => (
                        <button type="button" className="list-row" style={{ padding: '9px 12px' }} key={ev.id} onClick={() => open('eval', ev)}>
                          <span className="grow small">{fmtDate(ev.shift_date)} · {ev.hours_logged}h · {ev.evaluator?.full_name || 'Unknown'}</span><Stars value={ev.overall_rating} size={11} />
                        </button>
                      ))}</div>}
                      {oe.length > 6 && <p className="tiny muted" style={{ marginTop: 6 }}>Showing the latest 6 of {oe.length}.</p>}
                    </div>
                    <div>
                      <div className="label">Verified tasks ({done.length} of {ot.length})</div>
                      {done.length === 0 ? <p className="small muted">None verified.</p> : <div className="card">{done.slice(0, 6).map(t => (
                        <div className="list-row" style={{ padding: '9px 12px' }} key={t.id}><Icons.Check size={14} color="var(--success)" /><span className="grow small">{t.title}</span><span className="tiny muted">{t.verified_at ? fmtDate(t.verified_at, { month: 'short', day: 'numeric' }) : ''}</span></div>
                      ))}</div>}
                    </div>
                  </div>
                  <div style={{ marginTop: 14 }}><Button size="sm" variant="secondary" icon={Icons.User} onClick={() => open('orientee', o)}>Open full profile</Button></div>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
