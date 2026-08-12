import React, { useState, useEffect } from 'react';
import * as db from '../lib/database';
import { toCSV, downloadCSV } from '../lib/csv';
import { Icons } from './Icons';
import { C, card } from './theme';

const COLUMNS = [
  { label: 'Name',       value: r => r.user?.full_name || '' },
  { label: 'Email',      value: r => r.user?.email || '' },
  { label: 'Cert Level', value: r => r.user?.cert_level || '' },
  { label: 'Shift',      value: r => r.user?.shift || '' },
  { label: 'Training',   value: r => r.material?.title || '' },
  { label: 'Type',       value: r => r.material?.type || '' },
  { label: 'Completed',  value: r => r.completed_at ? new Date(r.completed_at).toLocaleString() : '' },
];

const CompletionReport = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
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

  let display = rows;
  if (material !== 'all') display = display.filter(r => r.material?.title === material);
  if (search.trim()) {
    const s = search.toLowerCase();
    display = display.filter(r =>
      (r.user?.full_name || '').toLowerCase().includes(s) ||
      (r.user?.email || '').toLowerCase().includes(s) ||
      (r.material?.title || '').toLowerCase().includes(s));
  }

  const onExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`arems-training-completions-${stamp}.csv`, toCSV(display, COLUMNS));
  };

  return (
    <div style={{ padding: '26px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '700', color: C.g[900], margin: 0 }}>Training Completions</h1>
        <button onClick={onExport} disabled={display.length === 0}
          style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: '600', background: C.primary, color: 'white', cursor: display.length === 0 ? 'not-allowed' : 'pointer', opacity: display.length === 0 ? 0.5 : 1 }}>
          Export CSV ({display.length})
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, or training"
          style={{ flex: '1 1 240px', padding: '11px 14px', borderRadius: '12px', border: '1px solid ' + C.g[200], fontSize: '14px' }} />
        <select value={material} onChange={e => setMaterial(e.target.value)}
          style={{ padding: '11px 14px', borderRadius: '12px', border: '1px solid ' + C.g[200], fontSize: '14px', background: 'white' }}>
          <option value="all">All training</option>
          {materials.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div style={{ ...card, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center' }}>
            <Icons.Loader size={34} color={C.primary} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ padding: '50px', textAlign: 'center', color: C.danger }}>Could not load completions: {error}</div>
        ) : display.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: C.g[500] }}>No completions found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.g[50] }}>
                {COLUMNS.map(c => (
                  <th key={c.label} style={{ padding: '14px 18px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: C.g[500], textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {display.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid ' + C.g[50] }}>
                  {COLUMNS.map(c => (
                    <td key={c.label} style={{ padding: '14px 18px', fontSize: '14px', color: C.g[700], whiteSpace: 'nowrap' }}>{c.value(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CompletionReport;
