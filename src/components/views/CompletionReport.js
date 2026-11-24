import React, { useEffect, useState } from 'react';
import { db } from '../../lib/backend';
import { toCSV, downloadCSV } from '../../lib/csv';
import { todayISO, fmtDate, fmtTime } from '../../lib/format';
import { Icons } from '../Icons';
import { Avatar, Button, Card, CertBadge, Empty, PageHead, SearchInput, SkeletonRows, StatCard } from '../ui';

const COLUMNS = [
  { label: 'Name', value: r => r.user?.full_name || '' },
  { label: 'Email', value: r => r.user?.email || '' },
  { label: 'Cert Level', value: r => r.user?.cert_level || '' },
  { label: 'Shift', value: r => r.user?.shift || '' },
  { label: 'Training', value: r => r.material?.title || '' },
  { label: 'Type', value: r => r.material?.type || '' },
  { label: 'Completed', value: r => (r.completed_at ? new Date(r.completed_at).toLocaleString() : '') },
];

export default function CompletionReport() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [material, setMaterial] = useState('all');

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await db.getCompletionReport();
      if (!active) return;
      if (error) setError(error.message); else setRows(data || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const materials = [...new Set(rows.map(r => r.material?.title).filter(Boolean))].sort();
  const s = q.trim().toLowerCase();
  const display = rows
    .filter(r => material === 'all' || r.material?.title === material)
    .filter(r => !s || [r.user?.full_name, r.user?.email, r.material?.title].some(f => (f || '').toLowerCase().includes(s)));
  const people = new Set(display.map(r => r.user?.id).filter(Boolean)).size;

  return (
    <div className="page">
      <PageHead title="Training completions" sub="Who finished what, and when. The export matches the filters below.">
        <Button icon={Icons.Download} disabled={display.length === 0} onClick={() => downloadCSV(`arems-training-completions-${todayISO()}.csv`, toCSV(display, COLUMNS))}>Export CSV ({display.length})</Button>
      </PageHead>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <StatCard icon={Icons.CheckCircle} label="Completions shown" value={display.length} tone="success" loading={loading} />
        <StatCard icon={Icons.Users} label="People" value={people} tone="brand" loading={loading} />
        <StatCard icon={Icons.GraduationCap} label="Training items" value={material === 'all' ? materials.length : 1} tone="violet" loading={loading} />
      </div>
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, email or training…" />
        <select className="select" style={{ width: 'auto', maxWidth: 280 }} value={material} onChange={e => setMaterial(e.target.value)} aria-label="Training">
          <option value="all">All training</option>{materials.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <Card className="table-wrap">
        {loading ? <SkeletonRows rows={6} /> : error ? (
          <Empty icon={Icons.AlertCircle} title="Could not load completions">{error}</Empty>
        ) : display.length === 0 ? (
          <Empty icon={Icons.Award} title="No completions found">{rows.length ? 'Try another filter.' : 'Completions appear as staff finish training.'}</Empty>
        ) : (
          <table className="table stackable">
            <thead><tr><th>Name</th><th>Cert</th><th>Shift</th><th>Training</th><th>Completed</th></tr></thead>
            <tbody>
              {display.map(r => (
                <tr key={r.id}>
                  <td className="primary"><div className="row"><Avatar name={r.user?.full_name} size="sm" /><div><div className="strong">{r.user?.full_name || 'Unknown'}</div><div className="tiny muted">{r.user?.email}</div></div></div></td>
                  <td data-label="Cert"><CertBadge level={r.user?.cert_level} /></td>
                  <td data-label="Shift" className="soft">{r.user?.shift || '—'}</td>
                  <td data-label="Training">{r.material?.title || '—'}</td>
                  <td data-label="Completed" className="soft" style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.completed_at)} · {fmtTime(r.completed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
