import React, { useState } from 'react';
import { Icons } from '../Icons';
import { Badge, Button, Card, Empty, PageHead, SearchInput, SkeletonRows, Tabs, cx } from '../ui';
import { daysFromToday, fmtDate, fmtRelative, oName } from '../../lib/format';

export default function TasksView({ ctx }) {
  const { role, loading, tasks, myTasks, orientees, open, actions } = ctx;
  const [q, setQ] = useState('');
  const [who, setWho] = useState('all');
  const [scope, setScope] = useState('pending');
  const isOrientee = role === 'orientee';
  const canVerify = !isOrientee;

  const base = isOrientee ? myTasks : tasks;
  const isDone = (t) => t.status === 'completed';
  const counts = { pending: base.filter(t => !isDone(t)).length, done: base.filter(isDone).length };

  const s = q.trim().toLowerCase();
  const rows = base
    .filter(t => scope === 'all' || (scope === 'done') === isDone(t))
    .filter(t => who === 'all' || t.assigned_to === who)
    .filter(t => !s || [t.title, t.description, oName(t.orientee)].some(f => (f || '').toLowerCase().includes(s)))
    // Soonest due first; undated tasks sink to the bottom.
    .sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));

  return (
    <div className="page">
      <PageHead title="Tasks" sub={isOrientee ? 'Sign-offs your FTO has assigned. They verify each one with you.' : 'Sign-offs assigned to orientees. Verify a task once you have seen it done.'}>
        {canVerify && <Button icon={Icons.Plus} onClick={() => open('addTask')}>New task</Button>}
      </PageHead>
      <div className="toolbar">
        <Tabs label="Filter by status" value={scope} onChange={setScope} options={[{ value: 'pending', label: 'Pending', count: counts.pending }, { value: 'done', label: 'Verified', count: counts.done }, { value: 'all', label: 'All' }]} />
        {!isOrientee && (
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search tasks…" />
            <select className="select" style={{ width: 'auto', maxWidth: 240 }} value={who} onChange={e => setWho(e.target.value)} aria-label="Orientee">
              <option value="all">All orientees</option>{orientees.map(o => <option key={o.id} value={o.id}>{oName(o)}</option>)}
            </select>
          </>
        )}
      </div>
      <Card>
        {loading ? <SkeletonRows rows={5} /> : rows.length === 0 ? (
          <Empty icon={scope === 'pending' ? Icons.CheckCircle : Icons.ListTodo} title={scope === 'pending' && !s && who === 'all' ? 'Nothing pending' : 'No tasks found'}>{scope === 'pending' ? 'Every assigned task has been verified.' : 'Try another filter.'}</Empty>
        ) : rows.map(t => {
          const done = isDone(t), due = daysFromToday(t.due_date);
          return (
            <div className="list-row" key={t.id}>
              <span className={cx('stat-icon', done ? 'tone-success' : due !== null && due < 0 ? 'tone-danger' : 'tone-neutral')} style={{ width: 34, height: 34, borderRadius: 10 }}>{done ? <Icons.Check size={17} /> : <Icons.Clock size={17} />}</span>
              <div className="grow">
                <div className="strong">{t.title}</div>
                <div className="small soft">{[!isOrientee && oName(t.orientee), t.description].filter(Boolean).join(' · ')}</div>
              </div>
              {!done && t.due_date && <Badge tone={due < 0 ? 'danger' : due <= 2 ? 'warning' : 'neutral'} className="hide-mobile">{due < 0 ? 'Overdue' : 'Due'} {fmtRelative(t.due_date)}</Badge>}
              {done ? <Badge tone="success">Verified{t.verified_at ? ` ${fmtDate(t.verified_at, { month: 'short', day: 'numeric' })}` : ''}</Badge>
                : canVerify ? <Button size="sm" variant="secondary" icon={Icons.Check} onClick={() => actions.verifyTask(t)}>Verify</Button>
                : <Badge tone="warning">Pending</Badge>}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
