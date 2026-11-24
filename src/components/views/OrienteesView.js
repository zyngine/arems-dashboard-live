import React, { useMemo, useState } from 'react';
import { Icons } from '../Icons';
import { Avatar, Badge, Button, Card, CertBadge, Drawer, Empty, IconButton, PageHead, Progress, SearchInput, SkeletonRows, Stars, StatusBadge, Tabs, cx } from '../ui';
import { OrienteeCard, PhaseSteps, attentionReasons } from './shared';
import { STATUSES, avg, daysFromToday, fmtDate, fmtRelative, getPhase, isActiveOrientee, oEmail, oName, oPhone, phaseInfo, progressPct, safeUrl, totalHours } from '../../lib/format';
import { useStoredFlag } from '../../lib/theme';
import { CERT_LEVELS } from '../../lib/roles';

const SORTS = {
  name: (a, b) => oName(a).localeCompare(oName(b)),
  progress: (a, b) => progressPct(b) - progressPct(a),
  clear: (a, b) => String(a.tentative_clear_date || '9999').localeCompare(String(b.tentative_clear_date || '9999')),
  lastEval: (a, b) => String(a.last_evaluation_date || '').localeCompare(String(b.last_evaluation_date || '')),
};

export default function OrienteesView({ ctx }) {
  const { role, loading, orientees, open } = ctx;
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('active');
  const [cert, setCert] = useState('all');
  const [sort, setSort] = useState('name');
  const [asTable, setAsTable] = useStoredFlag('arems-orientees-table', false);

  const live = orientees.filter(o => !o.is_archived);
  const counts = { active: live.filter(isActiveOrientee).length, attention: live.filter(o => ['at-risk', 'extended'].includes(o.status)).length, cleared: live.filter(o => o.status === 'cleared').length };

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return live
      .filter(o => scope === 'active' ? isActiveOrientee(o) : scope === 'attention' ? ['at-risk', 'extended'].includes(o.status) : o.status === 'cleared')
      .filter(o => cert === 'all' || o.cert_level === cert)
      .filter(o => !s || [oName(o), oEmail(o), o.lead_fto?.full_name, o.shift, o.station].some(f => (f || '').toLowerCase().includes(s)))
      .sort(SORTS[sort]);
  }, [orientees, q, scope, cert, sort]);

  const Th = ({ id, children }) => (
    <th><button type="button" onClick={() => setSort(id)} aria-pressed={sort === id}>{children}{sort === id && <Icons.ChevronDown size={12} />}</button></th>
  );

  return (
    <div className="page">
      <PageHead title="Orientees" sub="Everyone in field training, from first shift to clearance.">
        {role === 'admin' && <Button icon={Icons.Plus} onClick={() => open('addOrientee')}>Add orientee</Button>}
      </PageHead>
      <div className="toolbar">
        <Tabs label="Filter by status" value={scope} onChange={setScope} options={[
          { value: 'active', label: 'Active', count: counts.active },
          { value: 'attention', label: 'At risk', count: counts.attention },
          { value: 'cleared', label: 'Cleared', count: counts.cleared },
        ]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search name, FTO, shift…" />
        <select className="select" style={{ width: 'auto' }} value={cert} onChange={e => setCert(e.target.value)} aria-label="Certification">
          <option value="all">All certifications</option>{CERT_LEVELS.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort by">
          <option value="name">Sort: Name</option><option value="progress">Sort: Progress</option><option value="clear">Sort: Clear date</option><option value="lastEval">Sort: Oldest evaluation</option>
        </select>
        <span className="hide-mobile"><Tabs label="Layout" value={asTable ? 'table' : 'cards'} onChange={v => setAsTable(v === 'table')} options={[{ value: 'cards', label: 'Cards', icon: Icons.Grid }, { value: 'table', label: 'Table', icon: Icons.Rows }]} /></span>
      </div>

      {loading ? <Card><SkeletonRows rows={5} /></Card> : rows.length === 0 ? (
        <Card><Empty icon={Icons.Users} title={q || cert !== 'all' ? 'No one matches those filters' : 'Nobody here yet'}>{scope === 'cleared' ? 'Cleared orientees are listed here once they finish.' : 'Try a different filter.'}</Empty></Card>
      ) : asTable ? (
        <Card className="table-wrap">
          <table className="table stackable">
            <thead><tr><Th id="name">Orientee</Th><th>Cert</th><th>Lead FTO</th><Th id="progress">Progress</Th><th>Status</th><Th id="lastEval">Last eval</Th><Th id="clear">Clear date</Th></tr></thead>
            <tbody>
              {rows.map(o => {
                const ph = phaseInfo(getPhase(o.hours_completed));
                return (
                  <tr key={o.id} className="clickable" tabIndex={0} onClick={() => open('orientee', o)} onKeyDown={e => e.key === 'Enter' && open('orientee', o)}>
                    <td className="primary"><div className="row"><Avatar name={oName(o)} size="sm" /><span className="strong">{oName(o)}</span></div></td>
                    <td data-label="Cert"><CertBadge level={o.cert_level} /></td>
                    <td data-label="Lead FTO">{o.lead_fto?.full_name || <span className="muted">Unassigned</span>}</td>
                    <td data-label="Progress"><div style={{ minWidth: 130 }}><div className="row between tiny" style={{ marginBottom: 4 }}><span style={{ color: ph.color, fontWeight: 650 }}>Phase {ph.n}</span><span className="soft">{o.hours_completed || 0}/{totalHours(o)}h</span></div><Progress value={progressPct(o)} color={ph.color} /></div></td>
                    <td data-label="Status"><StatusBadge status={o.status} /></td>
                    <td data-label="Last eval" className="soft">{o.last_evaluation_date ? fmtRelative(o.last_evaluation_date) : '—'}</td>
                    <td data-label="Clear date" className="soft">{fmtDate(o.tentative_clear_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : <div className="grid cols-auto">{rows.map(o => <OrienteeCard key={o.id} o={o} onClick={() => open('orientee', o)} />)}</div>}
    </div>
  );
}

// Slide-over profile. Reads the live orientee from ctx so it refreshes after a save.
export function OrienteeDrawer({ orientee: o, ctx, onClose }) {
  const { role, evaluations, tasks, open, actions } = ctx;
  const [tab, setTab] = useState('overview');
  const isAdmin = role === 'admin';
  const canManage = role !== 'orientee' && role !== 'employee';
  const ph = phaseInfo(getPhase(o.hours_completed));
  const evals = evaluations.filter(e => e.orientee_id === o.id);
  const oTasks = tasks.filter(t => t.assigned_to === o.id);
  const doneTasks = oTasks.filter(t => t.status === 'completed').length;
  const rating = avg(evals.map(e => e.overall_rating));
  const reasons = attentionReasons(o, tasks);
  const book = safeUrl(o.orientation_book_url);
  const trend = evals.slice(0, 10).reverse();

  return (
    <Drawer title="Orientee profile" onClose={onClose} actions={isAdmin && <Button size="sm" variant="secondary" icon={Icons.Edit} onClick={() => open('editOrientee', o)}>Edit</Button>}>
      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        <Avatar name={oName(o)} size="xl" />
        <div className="grow">
          <div className="row wrap" style={{ gap: 8 }}><h3 style={{ fontSize: 20, letterSpacing: '-0.02em' }}>{oName(o)}</h3><CertBadge level={o.cert_level} />{o.is_archived && <Badge>Archived</Badge>}</div>
          <div className="small soft" style={{ marginTop: 4 }}>{oEmail(o) || 'No email on file'}{oPhone(o) && ` · ${oPhone(o)}`}</div>
          {!o.user_id && <div className="tiny muted" style={{ marginTop: 4 }}>No account linked yet — links when they sign up with this email.</div>}
        </div>
      </div>

      {reasons.length > 0 && <div className="row wrap" style={{ gap: 6, marginTop: 14 }}>{reasons.map(r => <Badge key={r.text} tone={r.tone}>{r.text}</Badge>)}</div>}

      <div className="grid cols-4" style={{ gap: 8, margin: '18px 0' }}>
        <div className="tile"><b>{progressPct(o)}%</b><span>Progress</span></div>
        <div className="tile"><b>{o.hours_completed || 0}<span style={{ fontSize: 13 }}>/{totalHours(o)}h</span></b><span>Hours</span></div>
        <div className="tile"><b>{rating ? rating.toFixed(1) : '—'}</b><span>Avg rating</span></div>
        <div className="tile"><b>{doneTasks}/{oTasks.length}</b><span>Tasks</span></div>
      </div>
      <PhaseSteps hours={o.hours_completed} />

      <div style={{ margin: '20px 0 14px' }}>
        <Tabs label="Profile sections" value={tab} onChange={setTab} options={[{ value: 'overview', label: 'Overview' }, { value: 'evals', label: 'Evaluations', count: evals.length }, { value: 'tasks', label: 'Tasks', count: oTasks.length }]} />
      </div>

      {tab === 'overview' && (
        <div className="stack loose">
          <dl className="kv">
            <div><dt>Status</dt><dd>
              {canManage ? (
                <select className="select" style={{ height: 34 }} value={o.status} onChange={e => actions.setStatus(o, e.target.value)} aria-label="Status">
                  {Object.entries(STATUSES).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                </select>
              ) : <StatusBadge status={o.status} />}
            </dd></div>
            <div><dt>Phase</dt><dd style={{ color: ph.color, fontWeight: 650 }}>{ph.n} · {ph.name}</dd></div>
            <div><dt>Lead FTO</dt><dd>{o.lead_fto?.full_name || 'Not assigned'}</dd></div>
            <div><dt>Shift / station</dt><dd>{o.shift || '—'}{o.station ? ` · ${o.station}` : ''}</dd></div>
            <div><dt>Start date</dt><dd>{fmtDate(o.start_date)}</dd></div>
            <div><dt>Tentative clear date</dt><dd>{fmtDate(o.tentative_clear_date)}</dd></div>
          </dl>
          {o.hours_adjustment ? <div className="callout tone-warning"><Icons.Sliders size={17} /><div><strong>{o.hours_adjustment > 0 ? '+' : ''}{o.hours_adjustment}h adjustment.</strong> {o.adjustment_reason || 'No reason recorded.'}</div></div> : null}
          <div className="callout tone-brand" style={{ alignItems: 'center' }}>
            <Icons.FileText size={17} />
            <div className="grow">{book ? <a href={book} target="_blank" rel="noopener noreferrer" className="strong">Open orientation book</a> : 'No orientation book linked yet.'}</div>
            {isAdmin && <button type="button" className="link-btn" onClick={() => open('editOrientee', o)}>{book ? 'Change' : 'Add link'}</button>}
          </div>
          {canManage && (
            <div className="row wrap">
              <Button icon={Icons.ClipboardCheck} onClick={() => open('addEval', { orienteeId: o.id })} disabled={!isActiveOrientee(o)}>New evaluation</Button>
              <Button variant="secondary" icon={Icons.ListTodo} onClick={() => open('addTask', { orienteeId: o.id })} disabled={!isActiveOrientee(o)}>Assign task</Button>
              {isAdmin && <Button variant="secondary" icon={Icons.Sliders} onClick={() => open('adjustHours', o)}>Adjust hours</Button>}
              {isAdmin && !o.is_archived && <Button variant="danger" icon={Icons.Archive} onClick={() => actions.archiveOrientee(o, onClose)}>Archive</Button>}
            </div>
          )}
        </div>
      )}

      {tab === 'evals' && (evals.length === 0 ? <Empty icon={Icons.ClipboardCheck} title="No evaluations yet" /> : (
        <>
          {trend.length > 1 && (
            <div className="tile" style={{ textAlign: 'left', marginBottom: 12 }}>
              <span>Rating, last {trend.length} shifts (oldest first)</span>
              <div className="spark" style={{ marginTop: 8 }} role="img" aria-label={'Ratings: ' + trend.map(e => e.overall_rating).join(', ')}>
                {trend.map(e => <i key={e.id} title={`${fmtDate(e.shift_date)}: ${e.overall_rating}/5`} style={{ height: (e.overall_rating / 5) * 100 + '%', background: e.overall_rating <= 2 ? 'var(--warning)' : undefined }} />)}
              </div>
            </div>
          )}
          <Card>
            {evals.map(ev => (
              <button type="button" className="list-row" key={ev.id} onClick={() => open('eval', ev)}>
                <div className="grow"><div className="strong">{fmtDate(ev.shift_date)} · {ev.hours_logged}h</div><div className="tiny muted truncate">{ev.evaluator?.full_name || 'Unknown'} · Phase {ev.phase || 1}</div></div>
                <Stars value={ev.overall_rating} size={13} /><Icons.ChevronRight size={16} className="muted" />
              </button>
            ))}
          </Card>
        </>
      ))}

      {tab === 'tasks' && (oTasks.length === 0 ? <Empty icon={Icons.ListTodo} title="No tasks assigned" /> : (
        <Card>
          {oTasks.map(t => {
            const due = daysFromToday(t.due_date), done = t.status === 'completed';
            return (
              <div className="list-row" key={t.id}>
                <span className={cx('stat-icon', done ? 'tone-success' : 'tone-neutral')} style={{ width: 28, height: 28, borderRadius: 8 }}>{done ? <Icons.Check size={15} /> : <Icons.Clock size={15} />}</span>
                <div className="grow"><div className="strong">{t.title}</div>{t.due_date && !done && <div className={cx('tiny', due < 0 ? '' : 'muted')} style={due < 0 ? { color: 'var(--danger)' } : undefined}>{due < 0 ? 'Overdue' : 'Due'} {fmtRelative(t.due_date)}</div>}</div>
                {done ? <Badge tone="success">Verified</Badge> : canManage ? <IconButton label={`Verify ${t.title}`} icon={Icons.Check} variant="secondary" size="sm" onClick={() => actions.verifyTask(t)} /> : <Badge tone="warning">Pending</Badge>}
              </div>
            );
          })}
        </Card>
      ))}
    </Drawer>
  );
}
