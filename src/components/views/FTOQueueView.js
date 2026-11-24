import React, { useCallback, useEffect, useState } from 'react';
import { db } from '../../lib/backend';
import { Icons } from '../Icons';
import { Avatar, Badge, Button, Card, CardHead, CertBadge, Empty, IconButton, PageHead, SkeletonRows, cx, useFeedback } from '../ui';
import { ROLE_LABELS } from '../../lib/roles';

export default function FTOQueueView({ ctx }) {
  const isAdmin = ctx.role === 'admin';
  const feedback = useFeedback();
  const [ftos, setFtos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await db.getFTOQueue();
    if (error) feedback.error('Could not load the queue.'); else setFtos(data || []);
    setLoading(false);
  }, [feedback]);
  useEffect(() => { load(); }, [load]);

  const run = async (id, op) => {
    setBusyId(id);
    const { error } = await op();
    if (error) feedback.error('Could not reorder: ' + error.message);
    await load();
    setBusyId(null);
  };
  const swap = (a, b) => run(a, () => db.swapFTOQueuePositions(a, b));
  const toBottom = (id) => run(id, () => db.moveFTOToBottom(id));

  const next = ftos[0];
  return (
    <div className="page">
      <PageHead title="FTO queue" sub="Rotation for assigning new orientees. The FTO at the top is up next; clearing an orientee sends their lead FTO to the bottom.">
        <Button variant="secondary" icon={Icons.Refresh} onClick={load}>Refresh</Button>
      </PageHead>

      <Card className="card-body" style={{ marginBottom: 16, borderLeft: '4px solid var(--accent)' }}>
        <div className="tiny strong" style={{ color: 'var(--brand-fg)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Up next</div>
        {loading ? <SkeletonRows rows={1} /> : !next ? <p className="soft">No FTOs in the queue yet. Give someone the FTO role in Admin.</p> : (
          <div className="row wrap" style={{ gap: 16 }}>
            <Avatar name={next.full_name} src={next.avatar_url} size="lg" />
            <div className="grow"><div style={{ fontSize: 20, fontWeight: 750, letterSpacing: '-0.02em' }}>{next.full_name}</div><div className="small soft">{ROLE_LABELS[next.role] || 'FTO'} · {next.email}</div></div>
            <div style={{ textAlign: 'right' }}><div className="tiny muted">Current load</div><div style={{ fontSize: 20, fontWeight: 750, color: next.active_orientees.length ? 'var(--warning)' : 'var(--success)' }}>{next.active_orientees.length} active</div></div>
          </div>
        )}
      </Card>

      <Card className="table-wrap">
        <CardHead title={`Rotation (${ftos.length})`} icon={Icons.Clock}>{isAdmin && <span className="tiny muted hide-mobile">Use the arrows to reorder</span>}</CardHead>
        {loading ? <SkeletonRows rows={4} /> : ftos.length === 0 ? <Empty icon={Icons.Users} title="No FTOs found" /> : (
          <table className="table stackable">
            <thead><tr><th>#</th><th>FTO</th><th>Role</th><th>Active orientees</th>{isAdmin && <th className="num">Reorder</th>}</tr></thead>
            <tbody>
              {ftos.map((f, i) => {
                const up = i > 0, down = i < ftos.length - 1, busy = busyId !== null;
                return (
                  <tr key={f.id} style={i === 0 ? { background: 'var(--brand-soft)' } : undefined}>
                    <td data-label="Position"><span className="row" style={{ gap: 6 }}><b>{i + 1}</b>{i === 0 && <Badge tone="brand">Next</Badge>}</span></td>
                    <td className="primary"><div className="row"><Avatar name={f.full_name} src={f.avatar_url} size="sm" /><div><div className="strong">{f.full_name}</div><div className="tiny muted">{f.email}</div></div></div></td>
                    <td data-label="Role"><Badge tone={f.role === 'lead_fto' ? 'brand' : 'neutral'}>{ROLE_LABELS[f.role] || 'FTO'}</Badge></td>
                    <td data-label="Orientees">{f.active_orientees.length === 0 ? <span className="muted">None</span> : <div className="row wrap" style={{ gap: 4, justifyContent: 'inherit' }}>{f.active_orientees.map(o => <span key={o.id} className="row" style={{ gap: 4 }}><span className="small">{o.name}</span><CertBadge level={o.cert_level} /></span>)}</div>}</td>
                    {isAdmin && (
                      <td className={cx('num')} data-label="Reorder">
                        <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                          <IconButton label={`Move ${f.full_name} up`} icon={Icons.ChevronUp} variant="secondary" size="sm" disabled={!up || busy} onClick={() => swap(f.id, ftos[i - 1].id)} />
                          <IconButton label={`Move ${f.full_name} down`} icon={Icons.ChevronDown} variant="secondary" size="sm" disabled={!down || busy} onClick={() => swap(f.id, ftos[i + 1].id)} />
                          <IconButton label={`Send ${f.full_name} to the bottom`} icon={Icons.ArrowDownToLine} variant="secondary" size="sm" disabled={!down || busy} onClick={() => toBottom(f.id)} />
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
