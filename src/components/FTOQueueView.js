import React, { useEffect, useState, useCallback } from 'react';
import * as db from '../lib/database';
import { Icons } from './Icons';

const C = {
  primary: '#1e40af',
  primaryDark: '#1a365d',
  accent: '#eab308',
  success: '#16a34a',
  warning: '#ea580c',
  danger: '#dc2626',
  g: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a' },
};

const card = {
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(20px)',
  borderRadius: '18px',
  boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
  border: '1px solid rgba(255,255,255,0.5)',
};

const roleLabel = (r) => (r === 'lead_fto' ? 'Lead FTO' : 'FTO');
const initials = (name) => (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

export default function FTOQueueView({ role }) {
  const [ftos, setFtos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const isAdmin = role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db.getFTOQueue();
    if (!error && data) setFtos(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSwap = async (idA, idB) => {
    setBusyId(idA);
    await db.swapFTOQueuePositions(idA, idB);
    await load();
    setBusyId(null);
  };

  const handleMoveToBottom = async (id) => {
    setBusyId(id);
    await db.moveFTOToBottom(id);
    await load();
    setBusyId(null);
  };

  const nextUp = ftos[0];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: C.g[900], margin: 0 }}>FTO Queue</h1>
          <div style={{ fontSize: '13px', color: C.g[500], marginTop: '4px' }}>Rotation order for assigning new orientees. Whoever is at the top is up next; clearing an orientee sends that FTO to the bottom.</div>
        </div>
        <button onClick={load} style={{ padding: '10px 14px', border: '1px solid ' + C.g[200], borderRadius: '10px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: C.g[700], fontWeight: '500' }}>
          <Icons.Loader size={14} /> Refresh
        </button>
      </div>

      {/* Next Up banner */}
      <div style={{ ...card, padding: '22px', marginBottom: '22px', background: 'linear-gradient(135deg, rgba(30,64,175,0.08), rgba(234,179,8,0.06))', border: '1px solid rgba(30,64,175,0.18)' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Next Up</div>
        {loading ? (
          <div style={{ color: C.g[500], fontSize: '14px' }}>Loading…</div>
        ) : !nextUp ? (
          <div style={{ color: C.g[500], fontSize: '14px' }}>No FTOs in the queue yet.</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: nextUp.avatar_url ? `url(${nextUp.avatar_url}) center/cover` : 'linear-gradient(135deg, ' + C.primary + ', ' + C.primaryDark + ')', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '18px' }}>
              {!nextUp.avatar_url && initials(nextUp.full_name)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: C.g[900] }}>{nextUp.full_name}</div>
              <div style={{ fontSize: '12px', color: C.g[500], marginTop: '2px' }}>{roleLabel(nextUp.role)} · Position {nextUp.queue_position || '—'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: C.g[500], textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Load</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: nextUp.active_orientees.length === 0 ? C.success : C.warning, marginTop: '2px' }}>
                {nextUp.active_orientees.length} active
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full rotation table */}
      <div style={{ ...card, padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid ' + C.g[100], display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '600', color: C.g[800], margin: 0 }}>Rotation ({ftos.length})</h2>
          {isAdmin && <div style={{ fontSize: '11px', color: C.g[500] }}>Admin: use arrows to reorder</div>}
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: C.g[500] }}>Loading queue…</div>
        ) : ftos.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: C.g[500] }}>No lead FTOs or FTOs found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.g[50] }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Active Orientees</th>
                  <th style={thStyle}>Load</th>
                  {isAdmin && <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {ftos.map((f, idx) => {
                  const isNext = idx === 0;
                  const canUp = idx > 0;
                  const canDown = idx < ftos.length - 1;
                  const isBusy = busyId === f.id;
                  return (
                    <tr key={f.id} style={{ borderTop: '1px solid ' + C.g[100], background: isNext ? 'rgba(30,64,175,0.04)' : 'transparent' }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '700', color: isNext ? C.primary : C.g[600], fontSize: '14px' }}>{idx + 1}</span>
                          {isNext && <span style={{ fontSize: '9px', fontWeight: '700', color: C.primary, background: 'rgba(30,64,175,0.12)', padding: '2px 6px', borderRadius: '6px', letterSpacing: '0.5px' }}>NEXT</span>}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: f.avatar_url ? `url(${f.avatar_url}) center/cover` : C.g[100], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', color: C.g[600], fontSize: '12px', flexShrink: 0 }}>
                            {!f.avatar_url && initials(f.full_name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: C.g[800], fontSize: '13px' }}>{f.full_name}</div>
                            <div style={{ fontSize: '11px', color: C.g[500] }}>{f.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: '4px 9px', borderRadius: '7px', fontSize: '10px', fontWeight: '600', background: f.role === 'lead_fto' ? 'rgba(30,64,175,0.1)' : C.g[100], color: f.role === 'lead_fto' ? C.primary : C.g[600] }}>
                          {roleLabel(f.role)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {f.active_orientees.length === 0 ? (
                          <span style={{ fontSize: '12px', color: C.g[400], fontStyle: 'italic' }}>None</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {f.active_orientees.map(o => (
                              <span key={o.id} style={{ padding: '3px 8px', background: C.g[100], borderRadius: '6px', fontSize: '11px', color: C.g[700] }}>
                                {o.name} <span style={{ color: C.g[400] }}>· {o.cert_level}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: f.active_orientees.length === 0 ? C.success : C.g[700] }}>
                          {f.active_orientees.length}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '4px' }}>
                            <button disabled={!canUp || isBusy} onClick={() => handleSwap(f.id, ftos[idx - 1].id)} title="Move up" style={iconBtn(canUp && !isBusy)}>
                              <Icons.ChevronLeft size={14} style={{ transform: 'rotate(90deg)' }} />
                            </button>
                            <button disabled={!canDown || isBusy} onClick={() => handleSwap(f.id, ftos[idx + 1].id)} title="Move down" style={iconBtn(canDown && !isBusy)}>
                              <Icons.ChevronLeft size={14} style={{ transform: 'rotate(-90deg)' }} />
                            </button>
                            <button disabled={!canDown || isBusy} onClick={() => handleMoveToBottom(f.id)} title="Move to bottom" style={{ ...iconBtn(canDown && !isBusy), padding: '6px 10px', fontSize: '11px', width: 'auto' }}>
                              Bottom
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  padding: '12px 18px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: '600',
  color: C.g[500],
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const tdStyle = {
  padding: '14px 18px',
  verticalAlign: 'middle',
  fontSize: '13px',
  color: C.g[700],
};

const iconBtn = (enabled) => ({
  width: '30px',
  height: '30px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0',
  border: '1px solid ' + C.g[200],
  borderRadius: '8px',
  background: enabled ? 'white' : C.g[50],
  color: enabled ? C.g[700] : C.g[300],
  cursor: enabled ? 'pointer' : 'not-allowed',
  opacity: enabled ? 1 : 0.5,
});
