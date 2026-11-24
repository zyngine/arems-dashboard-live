import React, { useState } from 'react';
import { Icons } from '../Icons';
import { Badge, Button, Card, Empty, IconButton, PageHead, Progress, SearchInput, Skeleton, Tabs } from '../ui';
import { MATERIAL_TYPES, fmtDate, materialType, safeUrl } from '../../lib/format';

export default function TrainingView({ ctx }) {
  const { role, loading, materials, completions, open, actions } = ctx;
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('todo');
  const [type, setType] = useState('all');
  const isAdmin = role === 'admin';

  const doneAt = Object.fromEntries(completions.map(c => [c.material_id, c.completed_at]));
  const total = materials.length, done = materials.filter(m => doneAt[m.id]).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const s = q.trim().toLowerCase();
  const rows = materials
    .filter(m => scope === 'all' || (scope === 'done') === Boolean(doneAt[m.id]))
    .filter(m => type === 'all' || m.type === type)
    .filter(m => !s || [m.title, m.description].some(f => (f || '').toLowerCase().includes(s)));

  return (
    <div className="page">
      <PageHead title="Training library" sub="Agency training that sits alongside the LMS. Open the material, then mark it complete.">
        {isAdmin && <Button icon={Icons.Plus} onClick={() => open('training', null)}>Add training</Button>}
      </PageHead>

      <Card className="card-body" style={{ marginBottom: 16 }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <span className="strong">{total === 0 ? 'No training assigned yet' : done === total ? 'All caught up' : `${total - done} left to complete`}</span>
          <span className="soft small">{done} of {total} · {pct}%</span>
        </div>
        <Progress value={pct} color="var(--success)" />
      </Card>

      <div className="toolbar">
        <Tabs label="Filter by completion" value={scope} onChange={setScope} options={[{ value: 'todo', label: 'To do', count: total - done }, { value: 'done', label: 'Completed', count: done }, { value: 'all', label: 'All', count: total }]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search training…" />
        <select className="select" style={{ width: 'auto' }} value={type} onChange={e => setType(e.target.value)} aria-label="Type">
          <option value="all">All types</option>{Object.entries(MATERIAL_TYPES).map(([v, t]) => <option key={v} value={v}>{t.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid cols-auto">{[1, 2, 3].map(i => <Card key={i} className="card-body"><Skeleton h={40} w={40} style={{ borderRadius: 11 }} /><Skeleton w="70%" style={{ margin: '14px 0 8px' }} /><Skeleton w="90%" h={11} /></Card>)}</div>
      ) : rows.length === 0 ? (
        <Card><Empty icon={scope === 'todo' && total > 0 && !s ? Icons.CheckCircle : Icons.GraduationCap} title={scope === 'todo' && total > 0 && !s && type === 'all' ? 'Nothing left to do' : 'No training found'}>{total === 0 ? 'Training added by an admin appears here.' : 'Try another filter.'}</Empty></Card>
      ) : (
        <div className="grid cols-auto">
          {rows.map(m => {
            const t = materialType(m.type), I = Icons[t.icon], url = safeUrl(m.url), completed = doneAt[m.id];
            return (
              <Card key={m.id} className="card-body" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <span className={'type-icon tone-' + t.tone}><I size={19} /></span>
                  <div className="grow"><div className="strong" style={{ fontSize: 15 }}>{m.title}</div><div className="tiny muted" style={{ marginTop: 2 }}>{t.label}{m.created_at && ` · Added ${fmtDate(m.created_at, { month: 'short', day: 'numeric' })}`}</div></div>
                  {isAdmin && <IconButton label={`Edit ${m.title}`} icon={Icons.Edit} size="sm" onClick={() => open('training', m)} />}
                </div>
                <p className="small soft" style={{ margin: '12px 0 16px', flex: 1 }}>{m.description || 'No description.'}</p>
                <div className="row">
                  {url ? <a className="btn btn-secondary grow" href={url} target="_blank" rel="noopener noreferrer"><Icons.ExternalLink size={15} />Open</a> : <span className="btn btn-secondary grow" aria-disabled="true" style={{ opacity: 0.55 }}>Link unavailable</span>}
                  {completed
                    ? <Badge tone="success" className="grow" ><Icons.Check size={13} />Completed {fmtDate(completed, { month: 'short', day: 'numeric' })}</Badge>
                    : <Button variant="success" icon={Icons.Check} className="grow" onClick={() => actions.completeTraining(m)}>Mark complete</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
