import React, { useState, useEffect } from 'react';
import { signOut } from '../lib/supabase';
import * as db from '../lib/database';
import { Icons } from './Icons';

const C = { primary: '#1e40af', primaryDark: '#1a365d', accent: '#eab308', success: '#16a34a', warning: '#ea580c', danger: '#dc2626', g: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a' } };
const card = { background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: '18px', boxShadow: '0 2px 16px rgba(0,0,0,0.04)', border: '1px solid rgba(255,255,255,0.5)' };
const phases = { 1: { name: 'Familiarization', color: '#1e40af' }, 2: { name: 'Guided Participation', color: '#7c3aed' }, 3: { name: 'Independence', color: '#ea580c' }, 4: { name: 'Clearance', color: '#16a34a' } };
const statusColor = s => ({ 'on-track': '#16a34a', 'at-risk': '#ea580c', 'extended': '#dc2626', 'pending-clearance': '#1e40af' }[s] || '#64748b');
const statusLabel = s => ({ 'on-track': 'On Track', 'at-risk': 'At Risk', 'extended': 'Extended', 'pending-clearance': 'Pending Clearance', 'cleared': 'Cleared' }[s] || s);
const certColor = l => ({ 'EMT': { bg: '#dbeafe', text: '#1e40af' }, 'AEMT': { bg: '#fef3c7', text: '#92400e' }, 'Paramedic': { bg: '#dcfce7', text: '#166534' } }[l] || { bg: '#f3f4f6', text: '#374151' });
const getPhase = h => h < 24 ? 1 : h < 64 ? 2 : h < 88 ? 3 : 4;

const ConfirmDialog = ({ title, message, onConfirm, onCancel }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onCancel}>
    <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '340px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: C.primary + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><Icons.AlertCircle size={26} color={C.primary} /></div>
        <h3 style={{ fontSize: '17px', fontWeight: '600', color: C.g[900], margin: '0 0 8px' }}>{title}</h3>
        <p style={{ fontSize: '14px', color: C.g[500], margin: 0 }}>{message}</p>
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid ' + C.g[100] }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '14px', background: 'white', border: 'none', borderRight: '1px solid ' + C.g[100], fontSize: '15px', fontWeight: '500', color: C.g[600], cursor: 'pointer' }}>Cancel</button>
        <button onClick={onConfirm} style={{ flex: 1, padding: '14px', background: 'white', border: 'none', fontSize: '15px', fontWeight: '600', color: C.primary, cursor: 'pointer' }}>Confirm</button>
      </div>
    </div>
  </div>
);

const Modal = ({ onClose, title, children, width = '480px' }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }} onClick={onClose}>
    <div style={{ background: 'white', borderRadius: '22px', width: '100%', maxWidth: width, maxHeight: '88vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid ' + C.g[100], display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 10, borderRadius: '22px 22px 0 0' }}>
        <h2 style={{ fontSize: '17px', fontWeight: '600', color: C.g[900], margin: 0 }}>{title}</h2>
        <button onClick={onClose} style={{ background: C.g[100], border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}><Icons.X size={16} color={C.g[500]} /></button>
      </div>
      <div style={{ padding: '22px' }}>{children}</div>
    </div>
  </div>
);

const Btn = ({ children, variant = 'primary', loading, style, ...p }) => {
  const v = { primary: { background: 'linear-gradient(135deg, ' + C.primary + ', ' + C.primaryDark + ')', color: 'white' }, secondary: { background: 'white', color: C.g[700], border: '1px solid ' + C.g[200] } };
  return <button {...p} disabled={loading || p.disabled} style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loading ? 0.7 : 1, ...v[variant], ...style }}>{loading && <Icons.Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />}{children}</button>;
};

const Sidebar = ({ view, setView, role, collapsed, setCollapsed, unreadMessages }) => {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.Home, roles: ['admin', 'fto', 'lead_fto', 'orientee', 'employee'] },
    { id: 'orientees', label: 'Orientees', icon: Icons.Users, roles: ['admin', 'fto', 'lead_fto'] },
    { id: 'evaluations', label: 'Evaluations', icon: Icons.ClipboardCheck, roles: ['admin', 'fto', 'lead_fto', 'orientee', 'employee'] },
    { id: 'training', label: 'Training', icon: Icons.GraduationCap, roles: ['admin', 'fto', 'lead_fto', 'orientee'] },
    { id: 'tasks', label: 'Tasks', icon: Icons.ListTodo, roles: ['admin', 'fto', 'lead_fto', 'orientee'] },
    { id: 'messages', label: 'Messages', icon: Icons.MessageCircle, roles: ['admin', 'fto', 'lead_fto', 'orientee'] },
    { id: 'fto-feedback', label: 'FTO Feedback', icon: Icons.ThumbsUp, roles: ['admin', 'fto', 'lead_fto'] },
    { id: 'records', label: 'Records', icon: Icons.FileText, roles: ['admin'] },
    { id: 'admin', label: 'Admin', icon: Icons.Settings, roles: ['admin'] },
  ].filter(i => i.roles.includes(role));
  return (
    <aside style={{ width: collapsed ? '72px' : '250px', background: 'linear-gradient(180deg, #0f172a, #1e293b)', height: '100vh', position: 'fixed', left: 0, top: 0, transition: 'width 0.3s', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: collapsed ? '16px' : '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0 }}><img src="/logo.jpg" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
        {!collapsed && <div><div style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>Adams Regional</div><div style={{ color: C.g[400], fontSize: '11px' }}>EMS Training</div></div>}
      </div>
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {items.map(i => (
          <button key={i.id} onClick={() => setView(i.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '11px', padding: collapsed ? '12px' : '12px 15px', marginBottom: '4px', borderRadius: '12px', border: 'none', cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start', background: view === i.id ? 'rgba(30,64,175,0.25)' : 'transparent', color: view === i.id ? 'white' : C.g[400], fontSize: '13px', fontWeight: '500', position: 'relative' }}>
            <i.icon size={20} />{!collapsed && i.label}
            {i.id === 'messages' && unreadMessages > 0 && <span style={{ position: 'absolute', right: collapsed ? '8px' : '12px', top: '50%', transform: 'translateY(-50%)', background: C.danger, color: 'white', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '10px', minWidth: '18px', textAlign: 'center' }}>{unreadMessages}</span>}
          </button>
        ))}
      </nav>
      <button onClick={() => setCollapsed(!collapsed)} style={{ margin: '12px', padding: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: C.g[400], cursor: 'pointer' }}><Icons.ChevronLeft size={18} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: '0.3s' }} /></button>
    </aside>
  );
};

const Header = ({ profile, onLogout, unreadMessages, onOpenMessages, onUploadPhoto }) => {
  const fileInputRef = React.useRef(null);
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onUploadPhoto(file);
  };
  
  return (
    <header style={{ height: '68px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: C.g[50], padding: '10px 16px', borderRadius: '12px', width: '280px' }}><Icons.Search size={17} color={C.g[400]} /><input placeholder="Search..." style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '14px' }} /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button onClick={onOpenMessages} style={{ position: 'relative', padding: '10px', background: C.g[50], border: 'none', borderRadius: '11px', cursor: 'pointer' }}>
          <Icons.MessageCircle size={20} color={C.g[600]} />
          {unreadMessages > 0 && <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: C.danger, color: 'white', fontSize: '10px', fontWeight: '700', minWidth: '18px', height: '18px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadMessages}</span>}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 14px 6px 6px', borderRadius: '14px', background: C.g[50], cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: profile?.avatar_url ? `url(${profile.avatar_url}) center/cover` : 'linear-gradient(135deg, ' + C.primary + ', ' + C.primaryDark + ')', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '12px', position: 'relative', overflow: 'hidden' }}>
            {!profile?.avatar_url && (profile?.full_name?.split(' ').map(n => n[0]).join('') || 'U')}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', padding: '2px 0', display: 'flex', justifyContent: 'center' }}><Icons.Camera size={10} color="white" /></div>
          </div>
          <div><div style={{ fontSize: '13px', fontWeight: '600', color: C.g[800] }}>{profile?.full_name || 'User'}</div><div style={{ fontSize: '10px', color: C.g[500], textTransform: 'capitalize' }}>{profile?.role}</div></div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
        <button onClick={onLogout} style={{ padding: '10px', background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '10px', cursor: 'pointer' }}><Icons.LogOut size={17} color={C.danger} /></button>
      </div>
    </header>
  );
};

const StatCard = ({ icon: I, label, value, color, loading }) => (
  <div style={{ ...card, padding: '20px' }}>
    <div style={{ width: '44px', height: '44px', borderRadius: '13px', background: color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I size={22} color={color} /></div>
    <div style={{ marginTop: '16px' }}>{loading ? <Icons.Loader size={24} color={C.g[400]} style={{ animation: 'spin 1s linear infinite' }} /> : <><div style={{ fontSize: '28px', fontWeight: '700', color: C.g[900] }}>{value}</div><div style={{ fontSize: '13px', color: C.g[500], marginTop: '3px' }}>{label}</div></>}</div>
  </div>
);

const OrienteeCard = ({ o, onClick }) => {
  const cc = certColor(o.cert_level), tot = (o.total_hours || 96) + (o.hours_adjustment || 0), prog = (o.hours_completed / tot) * 100, ph = getPhase(o.hours_completed), name = o.user?.full_name || o.temp_name || '?';
  return (
    <div onClick={onClick} style={{ ...card, padding: '18px', cursor: 'pointer', transition: 'all 0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '11px', alignItems: 'center' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: C.g[100], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', color: C.g[600], fontSize: '14px' }}>{name.split(' ').map(n => n[0]).join('')}</div>
          <div><div style={{ fontWeight: '600', color: C.g[800], fontSize: '14px' }}>{name}</div><div style={{ fontSize: '11px', color: C.g[500] }}>FTO: {o.lead_fto?.full_name || 'N/A'}</div></div>
        </div>
        <span style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: '600', background: cc.bg, color: cc.text, height: 'fit-content' }}>{o.cert_level}</span>
      </div>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span style={{ fontSize: '11px', color: C.g[500] }}>Phase {ph}</span><span style={{ fontSize: '11px', fontWeight: '600', color: C.g[700] }}>{o.hours_completed}/{tot}h</span></div>
        <div style={{ height: '6px', background: C.g[100], borderRadius: '3px' }}><div style={{ height: '100%', width: Math.min(prog, 100) + '%', background: phases[ph].color, borderRadius: '3px' }} /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', background: statusColor(o.status) + '12', color: statusColor(o.status) }}>{statusLabel(o.status)}</span>
        {o.tentative_clear_date && <span style={{ fontSize: '10px', color: C.g[500] }}>Clear: {new Date(o.tentative_clear_date).toLocaleDateString()}</span>}
      </div>
    </div>
  );
};

const OrienteeDetailModal = ({ orientee, onClose, evaluations, tasks, onUpdateStatus, onUpdateOrientee, role }) => {
  const [bookUrl, setBookUrl] = useState(orientee.orientation_book_url || '');
  const [editingBook, setEditingBook] = useState(false);
  const [saving, setSaving] = useState(false);
  const o = orientee;
  const name = o.user?.full_name || o.temp_name || '?';
  const email = o.user?.email || o.temp_email || '';
  const phone = o.user?.phone || o.temp_phone || '';
  const tot = (o.total_hours || 96) + (o.hours_adjustment || 0);
  const prog = Math.round((o.hours_completed / tot) * 100);
  const ph = getPhase(o.hours_completed);
  const cc = certColor(o.cert_level);
  const oEvals = evaluations.filter(e => e.orientee_id === o.id);
  const oTasks = tasks.filter(t => t.assigned_to === o.id);
  const avgRating = oEvals.length > 0 ? (oEvals.reduce((a, e) => a + e.overall_rating, 0) / oEvals.length).toFixed(1) : 'N/A';

  const saveBookUrl = async () => {
    setSaving(true);
    await onUpdateOrientee(o.id, { orientation_book_url: bookUrl });
    setEditingBook(false);
    setSaving(false);
  };

  return (
    <Modal onClose={onClose} title="Orientee Profile" width="600px">
      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: C.g[100], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '700', color: C.g[600], flexShrink: 0 }}>{name.split(' ').map(n => n[0]).join('')}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.g[900], margin: 0 }}>{name}</h3>
            <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '600', background: cc.bg, color: cc.text }}>{o.cert_level}</span>
          </div>
          <div style={{ fontSize: '13px', color: C.g[500], marginBottom: '4px' }}>{email}</div>
          {phone && <div style={{ fontSize: '13px', color: C.g[500] }}>{phone}</div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <div style={{ padding: '14px', background: C.g[50], borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: C.g[800] }}>{prog}%</div>
          <div style={{ fontSize: '11px', color: C.g[500] }}>Progress</div>
        </div>
        <div style={{ padding: '14px', background: C.g[50], borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: phases[ph].color }}>{ph}</div>
          <div style={{ fontSize: '11px', color: C.g[500] }}>Phase</div>
        </div>
        <div style={{ padding: '14px', background: C.g[50], borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: C.g[800] }}>{o.hours_completed}/{tot}</div>
          <div style={{ fontSize: '11px', color: C.g[500] }}>Hours</div>
        </div>
        <div style={{ padding: '14px', background: C.g[50], borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: C.accent }}>{avgRating}</div>
          <div style={{ fontSize: '11px', color: C.g[500] }}>Avg Rating</div>
        </div>
      </div>

      {/* Orientation Book Link */}
      <div style={{ marginBottom: '24px', padding: '16px', background: C.primary + '08', border: '1px solid ' + C.primary + '20', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editingBook ? '12px' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Icons.FileText size={20} color={C.primary} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: C.g[800] }}>Orientation Book</span>
          </div>
          {role === 'admin' && !editingBook && (
            <button onClick={() => setEditingBook(true)} style={{ padding: '6px 12px', background: C.g[100], border: 'none', borderRadius: '8px', fontSize: '12px', color: C.g[600], cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Icons.Edit size={12} /> {o.orientation_book_url ? 'Edit' : 'Add Link'}
            </button>
          )}
        </div>
        {editingBook ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={bookUrl}
              onChange={e => setBookUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/..."
              style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid ' + C.g[200], fontSize: '13px' }}
            />
            <button onClick={saveBookUrl} disabled={saving} style={{ padding: '10px 16px', background: C.primary, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
              {saving ? '...' : 'Save'}
            </button>
            <button onClick={() => { setEditingBook(false); setBookUrl(o.orientation_book_url || ''); }} style={{ padding: '10px 12px', background: C.g[100], border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        ) : o.orientation_book_url ? (
          <a href={o.orientation_book_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: C.primary, fontSize: '13px', textDecoration: 'none', marginTop: '8px' }}>
            <Icons.ExternalLink size={14} /> Open Orientation Book
          </a>
        ) : (
          <div style={{ fontSize: '13px', color: C.g[500], marginTop: '4px' }}>No orientation book linked yet</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: C.g[500], marginBottom: '6px' }}>Lead FTO</div>
          <div style={{ fontSize: '14px', color: C.g[800] }}>{o.lead_fto?.full_name || 'Not assigned'}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: C.g[500], marginBottom: '6px' }}>Shift</div>
          <div style={{ fontSize: '14px', color: C.g[800] }}>{o.shift || 'N/A'}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: C.g[500], marginBottom: '6px' }}>Start Date</div>
          <div style={{ fontSize: '14px', color: C.g[800] }}>{o.start_date ? new Date(o.start_date).toLocaleDateString() : 'N/A'}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: C.g[500], marginBottom: '6px' }}>Tentative Clear Date</div>
          <div style={{ fontSize: '14px', color: o.tentative_clear_date ? C.success : C.g[400] }}>{o.tentative_clear_date ? new Date(o.tentative_clear_date).toLocaleDateString() : 'Not set'}</div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: C.g[500], marginBottom: '6px' }}>Status</div>
          <select value={o.status} onChange={e => onUpdateStatus(o.id, e.target.value)} disabled={role === 'orientee'} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid ' + C.g[200], fontSize: '13px', background: 'white', color: statusColor(o.status), fontWeight: '500' }}>
            <option value="on-track">On Track</option>
            <option value="at-risk">At Risk</option>
            <option value="extended">Extended</option>
            <option value="pending-clearance">Pending Clearance</option>
            <option value="cleared">Cleared</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: C.g[700], margin: '0 0 12px' }}>Recent Evaluations ({oEvals.length})</h4>
        {oEvals.length === 0 ? <div style={{ padding: '16px', background: C.g[50], borderRadius: '10px', color: C.g[500], fontSize: '13px' }}>No evaluations yet</div> : (
          <div style={{ maxHeight: '150px', overflow: 'auto' }}>
            {oEvals.slice(0, 5).map(ev => (
              <div key={ev.id} style={{ padding: '10px 12px', background: C.g[50], borderRadius: '10px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: C.g[800] }}>{new Date(ev.shift_date).toLocaleDateString()}</div>
                  <div style={{ fontSize: '11px', color: C.g[500] }}>{ev.evaluator?.full_name} • {ev.hours_logged}h</div>
                </div>
                <div style={{ display: 'flex', gap: '2px' }}>{[1,2,3,4,5].map(s => <Icons.Star key={s} size={12} fill={s <= ev.overall_rating ? C.accent : 'none'} color={s <= ev.overall_rating ? C.accent : C.g[300]} />)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: C.g[700], margin: '0 0 12px' }}>Tasks ({oTasks.filter(t => t.status === 'completed').length}/{oTasks.length} completed)</h4>
        {oTasks.length === 0 ? <div style={{ padding: '16px', background: C.g[50], borderRadius: '10px', color: C.g[500], fontSize: '13px' }}>No tasks assigned</div> : (
          <div style={{ maxHeight: '120px', overflow: 'auto' }}>
            {oTasks.map(t => (
              <div key={t.id} style={{ padding: '10px 12px', background: C.g[50], borderRadius: '10px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: C.g[800] }}>{t.title}</span>
                <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: t.status === 'completed' ? C.success + '15' : C.warning + '15', color: t.status === 'completed' ? C.success : C.warning, fontWeight: '500' }}>{t.status === 'completed' ? 'Verified' : 'Pending'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

const EvaluationDetailModal = ({ evaluation, onClose, role }) => {
  const ev = evaluation;
  const orienteeName = ev.orientee?.user?.full_name || ev.orientee?.temp_name || 'Unknown';
  const evaluatorName = ev.evaluator?.full_name || 'Unknown';
  const dailyTasks = ev.daily_tasks || [];
  const hideRating = role === 'orientee';
  
  return (
    <Modal onClose={onClose} title="Evaluation Details" width="550px">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: C.g[900], margin: '0 0 4px' }}>{orienteeName}</h3>
          <div style={{ fontSize: '13px', color: C.g[500] }}>Evaluated by {evaluatorName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: C.g[800] }}>{new Date(ev.shift_date).toLocaleDateString()}</div>
          <div style={{ fontSize: '12px', color: C.g[500] }}>{ev.shift_type} Shift</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: hideRating ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {!hideRating && (
          <div style={{ padding: '16px', background: C.g[50], borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '3px', marginBottom: '6px' }}>
              {[1,2,3,4,5].map(s => <Icons.Star key={s} size={18} fill={s <= ev.overall_rating ? C.accent : 'none'} color={s <= ev.overall_rating ? C.accent : C.g[300]} />)}
            </div>
            <div style={{ fontSize: '11px', color: C.g[500] }}>Overall Rating</div>
          </div>
        )}
        <div style={{ padding: '16px', background: C.g[50], borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: C.primary }}>{ev.hours_logged}h</div>
          <div style={{ fontSize: '11px', color: C.g[500] }}>Hours Logged</div>
        </div>
        <div style={{ padding: '16px', background: C.g[50], borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: phases[ev.phase || 1].color }}>{ev.phase || 1}</div>
          <div style={{ fontSize: '11px', color: C.g[500] }}>Phase</div>
        </div>
      </div>

      {dailyTasks.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: '600', color: C.g[700], margin: '0 0 10px' }}>Daily Tasks Completed</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {dailyTasks.map((task, i) => (
              <span key={i} style={{ padding: '6px 12px', background: C.success + '12', color: C.success, borderRadius: '8px', fontSize: '12px', fontWeight: '500' }}>✓ {task}</span>
            ))}
          </div>
        </div>
      )}

      {ev.strengths && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: '600', color: C.g[700], margin: '0 0 8px' }}>Strengths</h4>
          <div style={{ padding: '14px', background: C.success + '08', border: '1px solid ' + C.success + '20', borderRadius: '10px', fontSize: '14px', color: C.g[700], lineHeight: '1.5' }}>{ev.strengths}</div>
        </div>
      )}

      {ev.improvements && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: '600', color: C.g[700], margin: '0 0 8px' }}>Areas for Improvement</h4>
          <div style={{ padding: '14px', background: C.warning + '08', border: '1px solid ' + C.warning + '20', borderRadius: '10px', fontSize: '14px', color: C.g[700], lineHeight: '1.5' }}>{ev.improvements}</div>
        </div>
      )}

      {!ev.strengths && !ev.improvements && dailyTasks.length === 0 && (
        <div style={{ padding: '20px', background: C.g[50], borderRadius: '10px', textAlign: 'center', color: C.g[500], fontSize: '13px' }}>No additional notes recorded for this evaluation.</div>
      )}
    </Modal>
  );
};

const RecentMessagesWidget = ({ messages, onOpenMessages }) => (
  <div style={{ ...card, padding: '18px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: '600', color: C.g[800], margin: 0 }}>Recent Messages</h3>
      <button onClick={onOpenMessages} style={{ fontSize: '12px', color: C.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>View All</button>
    </div>
    {messages.length === 0 ? <div style={{ textAlign: 'center', padding: '20px', color: C.g[500], fontSize: '13px' }}>No messages yet</div> : messages.slice(0, 3).map(m => (
      <div key={m.id} onClick={onOpenMessages} style={{ padding: '10px 0', borderBottom: '1px solid ' + C.g[50], display: 'flex', gap: '10px', cursor: 'pointer', transition: 'background 0.15s', marginLeft: '-10px', marginRight: '-10px', paddingLeft: '10px', paddingRight: '10px', borderRadius: '8px' }} onMouseEnter={e => e.currentTarget.style.background = C.g[50]} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: C.g[100], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: C.g[600], flexShrink: 0 }}>{m.sender?.full_name?.split(' ').map(n => n[0]).join('') || '?'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '500', color: C.g[800] }}>{m.sender?.full_name}</div>
          <div style={{ fontSize: '12px', color: C.g[500], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.content}</div>
        </div>
      </div>
    ))}
  </div>
);

const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: '11px', border: '1px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box' };

const AddOrienteeForm = ({ onClose, onSave, ftos, loading }) => {
  const [f, setF] = useState({ full_name: '', email: '', phone: '', cert_level: 'EMT', shift: 'A Shift', lead_fto_id: '', start_date: new Date().toISOString().split('T')[0], tentative_clear_date: '' });
  return (
    <Modal onClose={onClose} title="Add Orientee">
      <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
        <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Full Name *</label><input required value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} style={inputStyle} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Email *</label><input type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} style={inputStyle} /></div>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Phone</label><input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Certification</label><select value={f.cert_level} onChange={e => setF({ ...f, cert_level: e.target.value })} style={{ ...inputStyle, background: 'white' }}><option>EMT</option><option>AEMT</option><option>Paramedic</option></select></div>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Shift</label><select value={f.shift} onChange={e => setF({ ...f, shift: e.target.value })} style={{ ...inputStyle, background: 'white' }}><option>A Shift</option><option>B Shift</option><option>C Shift</option><option>Part-Time</option></select></div>
        </div>
        <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Lead FTO *</label><select required value={f.lead_fto_id} onChange={e => setF({ ...f, lead_fto_id: e.target.value })} style={{ ...inputStyle, background: 'white' }}><option value="">Select...</option>{ftos.map(x => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Start Date</label><input type="date" value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} style={inputStyle} /></div>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Tentative Clear Date</label><input type="date" value={f.tentative_clear_date} onChange={e => setF({ ...f, tentative_clear_date: e.target.value })} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}><Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn><Btn type="submit" loading={loading} style={{ flex: 1 }}>Create</Btn></div>
      </form>
    </Modal>
  );
};

const AddEvalForm = ({ onClose, onSave, orientees, loading }) => {
  const [f, setF] = useState({ orientee_id: '', shift_date: new Date().toISOString().split('T')[0], shift_type: 'Day', station: '54-1', hours_logged: 12, overall_rating: 4, strengths: '', improvements: '', daily_tasks: [] });
  const tasks = ['Truck Check', 'Equipment', 'Patient Assessment', 'Documentation', 'Radio Comms', 'Protocols', 'Scene Safety', 'Lifting'];
  return (
    <Modal onClose={onClose} title="Submit Evaluation" width="540px">
      <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
        <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Orientee *</label><select required value={f.orientee_id} onChange={e => setF({ ...f, orientee_id: e.target.value })} style={{ ...inputStyle, background: 'white' }}><option value="">Select...</option>{orientees.filter(o => !o.is_archived).map(o => <option key={o.id} value={o.id}>{o.user?.full_name || o.temp_name} ({o.cert_level})</option>)}</select></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Date</label><input type="date" required value={f.shift_date} onChange={e => setF({ ...f, shift_date: e.target.value })} style={inputStyle} /></div>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Shift</label><select value={f.shift_type} onChange={e => setF({ ...f, shift_type: e.target.value })} style={{ ...inputStyle, background: 'white' }}><option>Day</option><option>Night</option></select></div>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Station</label><select value={f.station} onChange={e => setF({ ...f, station: e.target.value })} style={{ ...inputStyle, background: 'white' }}><option>54-1</option><option>54-2</option><option>54-3</option><option>54-4</option></select></div>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Hours</label><input type="number" required min="1" max="24" value={f.hours_logged} onChange={e => setF({ ...f, hours_logged: parseInt(e.target.value) || 0 })} style={inputStyle} /></div>
        </div>
        <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Rating</label><div style={{ display: 'flex', gap: '6px' }}>{[1,2,3,4,5].map(r => <button key={r} type="button" onClick={() => setF({ ...f, overall_rating: r })} style={{ width: '40px', height: '40px', borderRadius: '10px', border: f.overall_rating === r ? '2px solid #eab308' : '1px solid #e2e8f0', background: f.overall_rating === r ? '#fef3c7' : 'white', cursor: 'pointer' }}><Icons.Star size={18} fill={f.overall_rating >= r ? '#eab308' : 'none'} color={f.overall_rating >= r ? '#eab308' : '#cbd5e1'} /></button>)}</div></div>
        <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Daily Tasks</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>{tasks.map(t => <button key={t} type="button" onClick={() => setF({ ...f, daily_tasks: f.daily_tasks.includes(t) ? f.daily_tasks.filter(x => x !== t) : [...f.daily_tasks, t] })} style={{ padding: '8px 12px', borderRadius: '9px', border: '1px solid ' + (f.daily_tasks.includes(t) ? '#16a34a' : '#e2e8f0'), background: f.daily_tasks.includes(t) ? '#16a34a12' : 'white', color: f.daily_tasks.includes(t) ? '#16a34a' : '#475569', fontSize: '12px', cursor: 'pointer' }}>{t}</button>)}</div></div>
        <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Strengths</label><textarea value={f.strengths} onChange={e => setF({ ...f, strengths: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <div style={{ marginBottom: '20px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Improvements</label><textarea value={f.improvements} onChange={e => setF({ ...f, improvements: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <div style={{ display: 'flex', gap: '10px' }}><Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn><Btn type="submit" loading={loading} style={{ flex: 1 }}>Submit</Btn></div>
      </form>
    </Modal>
  );
};

const FTOEvalForm = ({ onClose, onSave, ftos, loading }) => {
  const [f, setF] = useState({ fto_id: '', shift_date: new Date().toISOString().split('T')[0], overall_rating: 4, communication_rating: 4, teaching_rating: 4, support_rating: 4, feedback: '' });
  const ratings = [{ key: 'overall_rating', label: 'Overall' }, { key: 'communication_rating', label: 'Communication' }, { key: 'teaching_rating', label: 'Teaching' }, { key: 'support_rating', label: 'Support' }];
  return (
    <Modal onClose={onClose} title="Evaluate Your FTO" width="480px">
      <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
        <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Select FTO *</label><select required value={f.fto_id} onChange={e => setF({ ...f, fto_id: e.target.value })} style={{ ...inputStyle, background: 'white' }}><option value="">Select...</option>{ftos.map(x => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select></div>
        <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Shift Date</label><input type="date" value={f.shift_date} onChange={e => setF({ ...f, shift_date: e.target.value })} style={inputStyle} /></div>
        {ratings.map(({ key, label }) => (
          <div key={key} style={{ marginBottom: '12px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>{label}</label><div style={{ display: 'flex', gap: '6px' }}>{[1,2,3,4,5].map(r => <button key={r} type="button" onClick={() => setF({ ...f, [key]: r })} style={{ width: '36px', height: '36px', borderRadius: '10px', border: f[key] === r ? '2px solid #eab308' : '1px solid #e2e8f0', background: f[key] === r ? '#fef3c7' : 'white', cursor: 'pointer' }}><Icons.Star size={16} fill={f[key] >= r ? '#eab308' : 'none'} color={f[key] >= r ? '#eab308' : '#cbd5e1'} /></button>)}</div></div>
        ))}
        <div style={{ marginBottom: '20px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Feedback</label><textarea value={f.feedback} onChange={e => setF({ ...f, feedback: e.target.value })} rows={3} placeholder="Share your experience..." style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <div style={{ display: 'flex', gap: '10px' }}><Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn><Btn type="submit" loading={loading} style={{ flex: 1 }}>Submit</Btn></div>
      </form>
    </Modal>
  );
};

const AddTaskForm = ({ onClose, onSave, orientees, loading }) => {
  const [f, setF] = useState({ title: '', description: '', assigned_to: '', due_date: '' });
  return (
    <Modal onClose={onClose} title="Create Task">
      <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
        <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Title *</label><input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} style={inputStyle} /></div>
        <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Description</label><textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Assign To *</label><select required value={f.assigned_to} onChange={e => setF({ ...f, assigned_to: e.target.value })} style={{ ...inputStyle, background: 'white' }}><option value="">Select...</option>{orientees.filter(o => !o.is_archived).map(o => <option key={o.id} value={o.id}>{o.user?.full_name || o.temp_name}</option>)}</select></div>
        <div style={{ marginBottom: '20px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Due Date</label><input type="date" value={f.due_date} onChange={e => setF({ ...f, due_date: e.target.value })} style={inputStyle} /></div>
        <div style={{ display: 'flex', gap: '10px' }}><Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn><Btn type="submit" loading={loading} style={{ flex: 1 }}>Create</Btn></div>
      </form>
    </Modal>
  );
};

const TrainingForm = ({ onClose, onSave, loading, editData }) => {
  const [f, setF] = useState(editData || { title: '', description: '', type: 'video', url: '' });
  return (
    <Modal onClose={onClose} title={editData ? 'Edit Training' : 'Add Training'}>
      <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
        <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Title *</label><input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} style={inputStyle} /></div>
        <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Description</label><textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Type</label><select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} style={{ ...inputStyle, background: 'white' }}><option value="video">Video</option><option value="document">Document</option><option value="powerpoint">PowerPoint</option><option value="link">Link</option></select></div>
        <div style={{ marginBottom: '20px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>URL *</label><input required value={f.url} onChange={e => setF({ ...f, url: e.target.value })} placeholder="https://..." style={inputStyle} /></div>
        <div style={{ display: 'flex', gap: '10px' }}><Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn><Btn type="submit" loading={loading} style={{ flex: 1 }}>{editData ? 'Save' : 'Add'}</Btn></div>
      </form>
    </Modal>
  );
};

const HoursAdjustForm = ({ orientee, onClose, onSave, loading }) => {
  const [adj, setAdj] = useState(orientee.hours_adjustment || 0);
  const [reason, setReason] = useState(orientee.adjustment_reason || '');
  const base = orientee.total_hours || 96;
  return (
    <Modal onClose={onClose} title={'Adjust Hours - ' + (orientee.user?.full_name || orientee.temp_name)}>
      <div style={{ marginBottom: '18px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '10px' }}>Adjustment: <span style={{ color: adj > 0 ? C.success : adj < 0 ? C.danger : C.g[600] }}>{adj > 0 ? '+' : ''}{adj}h</span></label>
        <input type="range" min="-24" max="48" value={adj} onChange={e => setAdj(parseInt(e.target.value))} style={{ width: '100%', accentColor: C.primary }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: C.g[500] }}><span>-24h</span><span>Base: {base}h</span><span>+48h</span></div>
        <div style={{ textAlign: 'center', marginTop: '14px', padding: '14px', background: C.g[50], borderRadius: '12px' }}><span style={{ fontSize: '28px', fontWeight: '700', color: C.primary }}>{base + adj}h</span><span style={{ display: 'block', fontSize: '12px', color: C.g[500] }}>Total Required</span></div>
      </div>
      <div style={{ marginBottom: '20px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Reason</label><textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
      <div style={{ display: 'flex', gap: '10px' }}><Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn><Btn loading={loading} onClick={() => onSave({ hours_adjustment: adj, adjustment_reason: reason })} style={{ flex: 1 }}>Save</Btn></div>
    </Modal>
  );
};

const EditOrienteeForm = ({ orientee, onClose, onSave, ftos, loading }) => {
  const [f, setF] = useState({
    temp_name: orientee.temp_name || orientee.user?.full_name || '',
    temp_email: orientee.temp_email || orientee.user?.email || '',
    temp_phone: orientee.temp_phone || orientee.user?.phone || '',
    cert_level: orientee.cert_level || 'EMT',
    shift: orientee.shift || 'A Shift',
    lead_fto_id: orientee.lead_fto_id || '',
    start_date: orientee.start_date || '',
    status: orientee.status || 'on-track',
    orientation_book_url: orientee.orientation_book_url || '',
    tentative_clear_date: orientee.tentative_clear_date || ''
  });
  return (
    <Modal onClose={onClose} title="Edit Orientee" width="520px">
      <form onSubmit={e => { e.preventDefault(); onSave(orientee.id, f); }}>
        <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Full Name *</label><input required value={f.temp_name} onChange={e => setF({ ...f, temp_name: e.target.value })} style={inputStyle} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Email *</label><input type="email" required value={f.temp_email} onChange={e => setF({ ...f, temp_email: e.target.value })} style={inputStyle} /></div>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Phone</label><input value={f.temp_phone} onChange={e => setF({ ...f, temp_phone: e.target.value })} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Certification</label><select value={f.cert_level} onChange={e => setF({ ...f, cert_level: e.target.value })} style={{ ...inputStyle, background: 'white' }}><option>EMT</option><option>AEMT</option><option>Paramedic</option></select></div>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Shift</label><select value={f.shift} onChange={e => setF({ ...f, shift: e.target.value })} style={{ ...inputStyle, background: 'white' }}><option>A Shift</option><option>B Shift</option><option>C Shift</option><option>Part-Time</option></select></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Lead FTO</label><select value={f.lead_fto_id} onChange={e => setF({ ...f, lead_fto_id: e.target.value })} style={{ ...inputStyle, background: 'white' }}><option value="">Select...</option>{ftos.map(x => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select></div>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Status</label><select value={f.status} onChange={e => setF({ ...f, status: e.target.value })} style={{ ...inputStyle, background: 'white' }}><option value="on-track">On Track</option><option value="at-risk">At Risk</option><option value="extended">Extended</option><option value="pending-clearance">Pending Clearance</option><option value="cleared">Cleared</option></select></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Start Date</label><input type="date" value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} style={inputStyle} /></div>
          <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Tentative Clear Date</label><input type="date" value={f.tentative_clear_date} onChange={e => setF({ ...f, tentative_clear_date: e.target.value })} style={inputStyle} /></div>
        </div>
        <div style={{ marginBottom: '20px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Orientation Book URL</label><input value={f.orientation_book_url} onChange={e => setF({ ...f, orientation_book_url: e.target.value })} placeholder="https://docs.google.com/..." style={inputStyle} /></div>
        <div style={{ display: 'flex', gap: '10px' }}><Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn><Btn type="submit" loading={loading} style={{ flex: 1 }}>Save Changes</Btn></div>
      </form>
    </Modal>
  );
};

// Views
const DashboardView = ({ orientees, stats, loading, onAdd, onSelect, role, myOrientee, recentMessages, onOpenMessages }) => {
  if (role === 'orientee' && myOrientee) {
    const tot = (myOrientee.total_hours || 96) + (myOrientee.hours_adjustment || 0);
    const prog = Math.round((myOrientee.hours_completed / tot) * 100);
    const ph = getPhase(myOrientee.hours_completed);
    return (
      <div style={{ padding: '26px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '700', color: C.g[900], margin: '0 0 22px 0' }}>My Progress</h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ ...card, padding: '26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '26px' }}>
              <div style={{ width: '130px', height: '130px', borderRadius: '50%', background: 'conic-gradient(' + phases[ph].color + ' ' + (prog * 3.6) + 'deg, ' + C.g[100] + ' 0deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><div style={{ width: '106px', height: '106px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}><span style={{ fontSize: '32px', fontWeight: '700', color: C.g[800] }}>{prog}%</span><span style={{ fontSize: '12px', color: C.g[500] }}>Complete</span></div></div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: phases[ph].color, margin: '0 0 8px 0' }}>Phase {ph}: {phases[ph].name}</h2>
                <p style={{ fontSize: '15px', color: C.g[600], margin: '0 0 14px 0' }}>{myOrientee.hours_completed} of {tot} hours</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ padding: '10px 14px', background: C.g[50], borderRadius: '10px' }}><span style={{ fontSize: '11px', color: C.g[500] }}>Lead FTO</span><span style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: C.g[800] }}>{myOrientee.lead_fto?.full_name || 'N/A'}</span></div>
                  <div style={{ padding: '10px 14px', background: C.g[50], borderRadius: '10px' }}><span style={{ fontSize: '11px', color: C.g[500] }}>Station</span><span style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: C.g[800] }}>{myOrientee.station || 'N/A'}</span></div>
                </div>
              </div>
            </div>
          </div>
          <RecentMessagesWidget messages={recentMessages} onOpenMessages={onOpenMessages} />
        </div>
        <div style={{ ...card, padding: '22px', marginTop: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: C.g[800], margin: '0 0 16px 0' }}>Phase Progress</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            {[1,2,3,4].map(p => (<div key={p} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: ph >= p ? phases[p].color + '12' : C.g[50], border: ph === p ? '2px solid ' + phases[p].color : 'none' }}><div style={{ fontWeight: '600', color: ph >= p ? phases[p].color : C.g[400], fontSize: '13px' }}>Phase {p}</div><div style={{ fontSize: '12px', color: C.g[500] }}>{phases[p].name}</div></div>))}
          </div>
        </div>
      </div>
    );
  }
  const active = orientees.filter(o => o.status !== 'cleared' && !o.is_archived);
  return (
    <div style={{ padding: '26px' }}>
      <h1 style={{ fontSize: '26px', fontWeight: '700', color: C.g[900], margin: '0 0 22px 0' }}>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard icon={Icons.Users} label="Active Orientees" value={stats.activeOrientees} color={C.primary} loading={loading} />
        <StatCard icon={Icons.AlertTriangle} label="At Risk" value={stats.atRiskCount} color={C.warning} loading={loading} />
        <StatCard icon={Icons.Award} label="Pending Clearance" value={stats.pendingClearance} color={C.success} loading={loading} />
        <StatCard icon={Icons.TrendingUp} label="Avg. Progress" value={stats.avgProgress + '%'} color="#7c3aed" loading={loading} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={{ ...card, padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}><h2 style={{ fontSize: '17px', fontWeight: '600', color: C.g[800], margin: 0 }}>Active Orientees</h2>{role === 'admin' && <Btn onClick={onAdd}><Icons.Plus size={16} /> Add</Btn>}</div>
          {loading ? <div style={{ textAlign: 'center', padding: '50px' }}><Icons.Loader size={34} color={C.primary} style={{ animation: 'spin 1s linear infinite' }} /></div> : active.length === 0 ? <div style={{ textAlign: 'center', padding: '50px', color: C.g[500] }}>No active orientees</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>{active.map(o => <OrienteeCard key={o.id} o={o} onClick={() => onSelect(o)} />)}</div>}
        </div>
        <RecentMessagesWidget messages={recentMessages} onOpenMessages={onOpenMessages} />
      </div>
    </div>
  );
};

const EvaluationsView = ({ evaluations, orientees, role, myOrientee, onAdd, onAddFTOEval, ftos, loading, onSelectEval }) => {
  const [selectedOrienteeFilter, setSelectedOrienteeFilter] = useState('all');
  const [search, setSearch] = useState('');
  
  let display = role === 'orientee' ? evaluations.filter(e => e.orientee_id === myOrientee?.id) : evaluations;
  
  // Filter by selected orientee
  if (selectedOrienteeFilter !== 'all' && role !== 'orientee') {
    display = display.filter(e => e.orientee_id === selectedOrienteeFilter);
  }
  
  // Search filter
  if (search.trim()) {
    const s = search.toLowerCase();
    display = display.filter(e => 
      (e.orientee?.user?.full_name || e.orientee?.temp_name || '').toLowerCase().includes(s) ||
      (e.evaluator?.full_name || '').toLowerCase().includes(s) ||
      (e.strengths || '').toLowerCase().includes(s) ||
      (e.improvements || '').toLowerCase().includes(s)
    );
  }
  
  return (
    <div style={{ padding: '26px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '700', color: C.g[900], margin: 0 }}>Evaluations</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          {role === 'orientee' && myOrientee && <Btn onClick={onAddFTOEval} variant="secondary"><Icons.Star size={16} /> Rate Your FTO</Btn>}
          {(role === 'fto' || role === 'lead_fto' || role === 'admin' || role === 'employee') && <Btn onClick={onAdd}><Icons.Plus size={16} /> New Evaluation</Btn>}
        </div>
      </div>
      
      {role !== 'orientee' && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Icons.Search size={18} color={C.g[400]} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search evaluations..." style={{ width: '100%', padding: '12px 12px 12px 44px', borderRadius: '12px', border: '1px solid ' + C.g[200], fontSize: '14px' }} />
          </div>
          <select value={selectedOrienteeFilter} onChange={e => setSelectedOrienteeFilter(e.target.value)} style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid ' + C.g[200], fontSize: '14px', background: 'white', minWidth: '200px' }}>
            <option value="all">All Orientees</option>
            {orientees.map(o => <option key={o.id} value={o.id}>{o.user?.full_name || o.temp_name}</option>)}
          </select>
        </div>
      )}
      
      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '50px', textAlign: 'center' }}><Icons.Loader size={34} color={C.primary} style={{ animation: 'spin 1s linear infinite' }} /></div> : display.length === 0 ? <div style={{ padding: '50px', textAlign: 'center', color: C.g[500] }}>No evaluations found</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: C.g[50] }}>{['Date', 'Orientee', 'Evaluator', ...(role !== 'orientee' ? ['Rating'] : []), 'Hours', ''].map(h => <th key={h} style={{ padding: '14px 18px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: C.g[500], textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
            <tbody>{display.map(ev => (
              <tr key={ev.id} onClick={() => onSelectEval(ev)} style={{ borderBottom: '1px solid ' + C.g[50], cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = C.g[50]} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '14px 18px', fontSize: '14px', color: C.g[700] }}>{new Date(ev.shift_date).toLocaleDateString()}</td>
                <td style={{ padding: '14px 18px', fontWeight: '500', color: C.g[800], fontSize: '14px' }}>{ev.orientee?.user?.full_name || ev.orientee?.temp_name || '?'}</td>
                <td style={{ padding: '14px 18px', fontSize: '14px', color: C.g[600] }}>{ev.evaluator?.full_name || '?'}</td>
                {role !== 'orientee' && <td style={{ padding: '14px 18px' }}><div style={{ display: 'flex', gap: '2px' }}>{[1,2,3,4,5].map(s => <Icons.Star key={s} size={14} fill={s <= ev.overall_rating ? C.accent : 'none'} color={s <= ev.overall_rating ? C.accent : C.g[300]} />)}</div></td>}
                <td style={{ padding: '14px 18px', fontSize: '14px', fontWeight: '500', color: C.g[700] }}>{ev.hours_logged}h</td>
                <td style={{ padding: '14px 18px' }}><Icons.ChevronDown size={16} color={C.g[400]} style={{ transform: 'rotate(-90deg)' }} /></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const TrainingView = ({ role, materials, completions, orienteeId, onAdd, onEdit, onComplete, loading, showConfirm }) => (
  <div style={{ padding: '26px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}><h1 style={{ fontSize: '26px', fontWeight: '700', color: C.g[900], margin: 0 }}>Training Library</h1>{role === 'admin' && <Btn onClick={() => onAdd()}><Icons.Plus size={16} /> Add Material</Btn>}</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
      {loading ? <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '50px' }}><Icons.Loader size={34} color={C.primary} style={{ animation: 'spin 1s linear infinite' }} /></div> : materials.length === 0 ? <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '50px', color: C.g[500] }}>No training materials</div> : materials.map(m => {
        const done = completions.some(c => c.material_id === m.id);
        return (
          <div key={m.id} style={{ ...card, padding: '18px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: m.type === 'video' ? '#fee2e2' : '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{m.type === 'video' ? <Icons.Video size={20} color={C.danger} /> : <Icons.FileText size={20} color={C.primary} />}</div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: '600', color: C.g[800], fontSize: '15px' }}>{m.title}</div><div style={{ fontSize: '12px', color: C.g[500], marginTop: '4px' }}>{m.description || 'No description'}</div></div>
              {role === 'admin' && <button onClick={() => onEdit(m)} style={{ padding: '6px', background: C.g[50], border: 'none', borderRadius: '8px', cursor: 'pointer' }}><Icons.Edit size={14} color={C.g[500]} /></button>}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '10px', borderRadius: '10px', background: C.g[50], color: C.g[700], textDecoration: 'none', fontSize: '13px', fontWeight: '500', textAlign: 'center' }}>Open</a>
              {role === 'orientee' && orienteeId && !done && <button onClick={() => showConfirm('Complete Training', 'Are you sure you want to mark "' + m.title + '" as completed?', () => onComplete(m.id))} style={{ padding: '10px 16px', borderRadius: '10px', background: C.success, color: 'white', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Mark Complete</button>}
              {done && <span style={{ padding: '10px 16px', borderRadius: '10px', background: C.success + '12', color: C.success, fontSize: '13px', fontWeight: '600' }}>✓ Completed</span>}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const TasksView = ({ role, tasks, myTasks, orientees, onAdd, onVerify, loading, showConfirm }) => {
  const [selectedOrienteeFilter, setSelectedOrienteeFilter] = useState('all');
  const [search, setSearch] = useState('');
  
  let display = role === 'orientee' ? myTasks : tasks;
  
  // Filter by selected orientee
  if (selectedOrienteeFilter !== 'all' && role !== 'orientee') {
    display = display.filter(t => t.assigned_to === selectedOrienteeFilter);
  }
  
  // Search filter
  if (search.trim()) {
    const s = search.toLowerCase();
    display = display.filter(t => 
      (t.title || '').toLowerCase().includes(s) ||
      (t.description || '').toLowerCase().includes(s) ||
      (t.orientee?.user?.full_name || t.orientee?.temp_name || '').toLowerCase().includes(s)
    );
  }
  
  return (
    <div style={{ padding: '26px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}><h1 style={{ fontSize: '26px', fontWeight: '700', color: C.g[900], margin: 0 }}>Tasks</h1>{(role === 'admin' || role === 'fto' || role === 'lead_fto') && <Btn onClick={onAdd}><Icons.Plus size={16} /> Create Task</Btn>}</div>
      
      {role !== 'orientee' && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Icons.Search size={18} color={C.g[400]} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..." style={{ width: '100%', padding: '12px 12px 12px 44px', borderRadius: '12px', border: '1px solid ' + C.g[200], fontSize: '14px' }} />
          </div>
          <select value={selectedOrienteeFilter} onChange={e => setSelectedOrienteeFilter(e.target.value)} style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid ' + C.g[200], fontSize: '14px', background: 'white', minWidth: '200px' }}>
            <option value="all">All Orientees</option>
            {orientees.map(o => <option key={o.id} value={o.id}>{o.user?.full_name || o.temp_name}</option>)}
          </select>
        </div>
      )}
      
      <div style={{ ...card }}>
        {loading ? <div style={{ padding: '50px', textAlign: 'center' }}><Icons.Loader size={34} color={C.primary} style={{ animation: 'spin 1s linear infinite' }} /></div> : display.length === 0 ? <div style={{ padding: '50px', textAlign: 'center', color: C.g[500] }}>No tasks found</div> : display.map(t => (
          <div key={t.id} style={{ padding: '16px 20px', borderBottom: '1px solid ' + C.g[50], display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontWeight: '600', color: C.g[800], fontSize: '15px' }}>{t.title}</div><div style={{ fontSize: '13px', color: C.g[500] }}>{t.description}{role !== 'orientee' && ' • ' + (t.orientee?.user?.full_name || t.orientee?.temp_name || 'N/A')}</div></div>
            {t.status === 'completed' ? <span style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '13px', background: C.success + '12', color: C.success, fontWeight: '500' }}>Verified</span> : (role === 'fto' || role === 'lead_fto' || role === 'admin') ? <Btn onClick={() => showConfirm('Verify Task', 'Are you sure you want to verify "' + t.title + '" as completed?', () => onVerify(t.id))} style={{ padding: '10px 18px', fontSize: '13px' }}>Verify</Btn> : <span style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '13px', background: C.warning + '12', color: C.warning, fontWeight: '500' }}>Pending</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

const MessagesView = ({ userId, profiles, onClearUnread, role }) => {
  const [convos, setConvos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [selUsers, setSelUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState('');
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => { loadConvos(); }, []);
  useEffect(() => { 
    if (selected) {
      loadMsgs(selected.id);
      // Mark this conversation as read
      db.markConversationRead(userId, selected.id);
      if (onClearUnread) onClearUnread();
    }
  }, [selected]);

  const loadConvos = async () => { 
    setLoading(true); 
    // Admin can see all conversations
    const { data } = role === 'admin' ? await db.getAllConversations() : await db.getConversations(userId); 
    setConvos(data || []); 
    setLoading(false); 
  };
  const loadMsgs = async (id) => { const { data } = await db.getMessages(id); setMessages(data || []); };
  const send = async () => { if (!newMsg.trim() || !selected) return; await db.sendMessage(selected.id, userId, newMsg); setNewMsg(''); loadMsgs(selected.id); };
  const createConvo = async () => { if (!selUsers.length) return; const isGroup = selUsers.length > 1; const { data } = await db.createConversation(isGroup ? (groupName || 'Group') : null, isGroup, userId, [userId, ...selUsers]); if (data) { loadConvos(); setShowNew(false); setSelUsers([]); setGroupName(''); } };
  
  const deleteConvo = async (convoId) => {
    await db.deleteConversation(convoId, userId);
    setConvos(convos.filter(c => c.id !== convoId));
    if (selected?.id === convoId) setSelected(null);
  };
  
  const editMessage = async (msgId) => {
    if (!editText.trim()) return;
    await db.updateMessage(msgId, editText);
    setEditingMsg(null);
    setEditText('');
    loadMsgs(selected.id);
  };
  
  const renameGroup = async () => {
    if (!newGroupName.trim() || !selected) return;
    await db.updateConversation(selected.id, { name: newGroupName });
    setSelected({ ...selected, name: newGroupName });
    setConvos(convos.map(c => c.id === selected.id ? { ...c, name: newGroupName } : c));
    setEditingGroupName(false);
    setNewGroupName('');
  };

  return (
    <div style={{ padding: '22px', height: 'calc(100vh - 112px)' }}>
      <div style={{ display: 'flex', gap: '18px', height: '100%' }}>
        <div style={{ width: '280px', ...card, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid ' + C.g[100], display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: '600', fontSize: '15px', color: C.g[800] }}>Messages</span><button onClick={() => setShowNew(true)} style={{ padding: '8px', background: C.primary, border: 'none', borderRadius: '9px', cursor: 'pointer' }}><Icons.Plus size={16} color="white" /></button></div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? <div style={{ padding: '30px', textAlign: 'center' }}><Icons.Loader size={24} color={C.g[400]} style={{ animation: 'spin 1s linear infinite' }} /></div> : convos.length === 0 ? <div style={{ padding: '30px', color: C.g[500], fontSize: '14px', textAlign: 'center' }}>No conversations</div> : convos.map(c => (
              <div key={c.id} onClick={() => setSelected(c)} style={{ padding: '14px 16px', borderBottom: '1px solid ' + C.g[50], cursor: 'pointer', background: selected?.id === c.id ? C.g[50] : 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: '500', fontSize: '14px', color: C.g[800] }}>{c.is_group ? c.name : c.participants?.find(p => p.user?.id !== userId)?.user?.full_name || '?'}</div>
                <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this conversation?')) deleteConvo(c.id); }} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.5 }}><Icons.Trash size={14} color={C.g[500]} /></button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, ...card, display: 'flex', flexDirection: 'column' }}>
          {selected ? (
            <>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid ' + C.g[100], display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {editingGroupName ? (
                  <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                    <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Group name" style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid ' + C.g[200], fontSize: '14px' }} />
                    <button onClick={renameGroup} style={{ padding: '8px 12px', background: C.primary, color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingGroupName(false)} style={{ padding: '8px 12px', background: C.g[100], border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: '600', fontSize: '15px', color: C.g[800] }}>{selected.is_group ? selected.name : selected.participants?.find(p => p.user?.id !== userId)?.user?.full_name}</div>
                    {selected.is_group && <button onClick={() => { setNewGroupName(selected.name || ''); setEditingGroupName(true); }} style={{ padding: '6px', background: C.g[50], border: 'none', borderRadius: '6px', cursor: 'pointer' }}><Icons.Edit size={14} color={C.g[500]} /></button>}
                  </>
                )}
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {messages.map(m => (
                  <div key={m.id} style={{ alignSelf: m.sender_id === userId ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                    {editingMsg === m.id ? (
                      <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
                        <input value={editText} onChange={e => setEditText(e.target.value)} style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid ' + C.g[200], fontSize: '14px' }} />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => editMessage(m.id)} style={{ padding: '6px 12px', background: C.primary, color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Save</button>
                          <button onClick={() => setEditingMsg(null)} style={{ padding: '6px 12px', background: C.g[100], border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ padding: '12px 16px', borderRadius: m.sender_id === userId ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: m.sender_id === userId ? C.primary : C.g[100], color: m.sender_id === userId ? 'white' : C.g[800], fontSize: '14px', position: 'relative' }}>
                          {m.content}
                          {m.edited_at && <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '6px' }}>(edited)</span>}
                          {m.sender_id === userId && (
                            <button onClick={() => { setEditingMsg(m.id); setEditText(m.content); }} style={{ position: 'absolute', top: '-8px', right: '-8px', padding: '4px', background: 'white', border: '1px solid ' + C.g[200], borderRadius: '6px', cursor: 'pointer', opacity: 0.8 }}><Icons.Edit size={10} color={C.g[500]} /></button>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: C.g[400], marginTop: '4px', textAlign: m.sender_id === userId ? 'right' : 'left' }}>{m.sender?.full_name}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ padding: '16px', borderTop: '1px solid ' + C.g[100], display: 'flex', gap: '10px' }}>
                <input value={newMsg} onChange={e => setNewMsg(e.target.value)} onKeyPress={e => e.key === 'Enter' && send()} placeholder="Type a message..." style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid ' + C.g[200], fontSize: '14px' }} />
                <button onClick={send} style={{ padding: '12px 18px', background: C.primary, border: 'none', borderRadius: '12px', cursor: 'pointer' }}><Icons.Send size={18} color="white" /></button>
              </div>
            </>
          ) : <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.g[500] }}>Select a conversation</div>}
        </div>
      </div>
      {showNew && (
        <Modal onClose={() => { setShowNew(false); setSelUsers([]); }} title="New Conversation">
          <div style={{ maxHeight: '220px', overflow: 'auto', border: '1px solid ' + C.g[200], borderRadius: '12px', marginBottom: '14px' }}>
            {profiles.filter(p => p.id !== userId).map(p => (
              <div key={p.id} onClick={() => setSelUsers(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])} style={{ padding: '12px 16px', borderBottom: '1px solid ' + C.g[100], cursor: 'pointer', display: 'flex', justifyContent: 'space-between', background: selUsers.includes(p.id) ? C.g[50] : 'white' }}>
                <span style={{ fontSize: '14px', color: C.g[800] }}>{p.full_name || p.email || 'Unknown User'}</span>{selUsers.includes(p.id) && <Icons.CheckCircle size={18} color={C.success} />}
              </div>
            ))}
          </div>
          {selUsers.length > 1 && <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: C.g[600], marginBottom: '6px' }}>Group Name</label><input value={groupName} onChange={e => setGroupName(e.target.value)} style={inputStyle} /></div>}
          <Btn onClick={createConvo} disabled={!selUsers.length} style={{ width: '100%' }}>Start Conversation</Btn>
        </Modal>
      )}
    </div>
  );
};

const RecordsView = ({ orientees, evaluations, tasks }) => {
  const [expanded, setExpanded] = useState(null);
  return (
    <div style={{ padding: '26px' }}>
      <h1 style={{ fontSize: '26px', fontWeight: '700', color: C.g[900], margin: '0 0 22px 0' }}>Records</h1>
      <div style={{ ...card }}>
        {orientees.length === 0 ? <div style={{ padding: '50px', textAlign: 'center', color: C.g[500] }}>No records</div> : orientees.map(o => {
          const oEvals = evaluations.filter(e => e.orientee_id === o.id);
          const oTasks = tasks.filter(t => t.assigned_to === o.id);
          const completedTasks = oTasks.filter(t => t.status === 'completed');
          const name = o.user?.full_name || o.temp_name || '?';
          return (
            <div key={o.id}>
              <div onClick={() => setExpanded(expanded === o.id ? null : o.id)} style={{ padding: '16px 20px', borderBottom: '1px solid ' + C.g[50], cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: C.g[100], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', color: C.g[600], fontSize: '13px' }}>{name.split(' ').map(n => n[0]).join('')}</div>
                  <div><div style={{ fontWeight: '600', color: C.g[800], fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>{name}{o.is_archived && <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '500', background: C.g[200], color: C.g[600] }}>Archived</span>}</div><div style={{ fontSize: '12px', color: C.g[500] }}>{o.cert_level} • {statusLabel(o.status)}</div></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ textAlign: 'right' }}><div style={{ fontSize: '13px', fontWeight: '600', color: C.g[800] }}>{o.hours_completed}h</div><div style={{ fontSize: '10px', color: C.g[500] }}>hours</div></div>
                  <div style={{ textAlign: 'right' }}><div style={{ fontSize: '13px', fontWeight: '600', color: C.g[800] }}>{oEvals.length}</div><div style={{ fontSize: '10px', color: C.g[500] }}>evals</div></div>
                  <div style={{ textAlign: 'right' }}><div style={{ fontSize: '13px', fontWeight: '600', color: C.g[800] }}>{completedTasks.length}/{oTasks.length}</div><div style={{ fontSize: '10px', color: C.g[500] }}>tasks</div></div>
                  <Icons.ChevronDown size={18} color={C.g[400]} style={{ transform: expanded === o.id ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
                </div>
              </div>
              {expanded === o.id && (
                <div style={{ padding: '16px 20px', background: C.g[50], borderBottom: '1px solid ' + C.g[100] }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div><h4 style={{ fontSize: '12px', fontWeight: '600', color: C.g[600], margin: '0 0 10px' }}>Evaluations</h4>{oEvals.slice(0, 5).map(ev => <div key={ev.id} style={{ padding: '8px 10px', background: 'white', borderRadius: '8px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '12px', color: C.g[700] }}>{new Date(ev.shift_date).toLocaleDateString()}</span><div style={{ display: 'flex', gap: '1px' }}>{[1,2,3,4,5].map(s => <Icons.Star key={s} size={10} fill={s <= ev.overall_rating ? C.accent : 'none'} color={s <= ev.overall_rating ? C.accent : C.g[300]} />)}</div></div>)}{oEvals.length === 0 && <div style={{ fontSize: '12px', color: C.g[400] }}>No evaluations</div>}</div>
                    <div><h4 style={{ fontSize: '12px', fontWeight: '600', color: C.g[600], margin: '0 0 10px' }}>Completed Tasks</h4>{completedTasks.slice(0, 5).map(t => <div key={t.id} style={{ padding: '8px 10px', background: 'white', borderRadius: '8px', marginBottom: '6px' }}><span style={{ fontSize: '12px', color: C.g[700] }}>{t.title}</span></div>)}{completedTasks.length === 0 && <div style={{ fontSize: '12px', color: C.g[400] }}>No completed tasks</div>}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FTOFeedbackView = ({ role, userId, ftoEvaluations, loading, onSelectFTOEval }) => {
  // FTOs only see their own feedback count, admins see all details
  const myFeedback = ftoEvaluations.filter(e => e.fto_id === userId);
  const isAdmin = role === 'admin';
  const displayEvals = isAdmin ? ftoEvaluations : myFeedback;
  
  const avgRating = (evals) => {
    if (!evals.length) return 'N/A';
    return (evals.reduce((a, e) => a + e.overall_rating, 0) / evals.length).toFixed(1);
  };

  return (
    <div style={{ padding: '26px' }}>
      <h1 style={{ fontSize: '26px', fontWeight: '700', color: C.g[900], margin: '0 0 22px 0' }}>FTO Feedback</h1>
      
      {!isAdmin && (
        <div style={{ ...card, padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'conic-gradient(' + C.primary + ' ' + (myFeedback.length * 36) + 'deg, ' + C.g[100] + ' 0deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <span style={{ fontSize: '24px', fontWeight: '700', color: C.accent }}>{avgRating(myFeedback)}</span>
              </div>
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: C.g[800], margin: '0 0 6px' }}>Your Feedback Summary</h2>
              <p style={{ fontSize: '14px', color: C.g[500], margin: 0 }}>You have received {myFeedback.length} evaluation{myFeedback.length !== 1 ? 's' : ''} from orientees</p>
              <p style={{ fontSize: '13px', color: C.g[400], margin: '4px 0 0' }}>Detailed feedback is visible to administrators only</p>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + C.g[100], background: C.g[50] }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: C.g[700] }}>All FTO Evaluations from Orientees</span>
          </div>
          {loading ? (
            <div style={{ padding: '50px', textAlign: 'center' }}><Icons.Loader size={34} color={C.primary} style={{ animation: 'spin 1s linear infinite' }} /></div>
          ) : displayEvals.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: C.g[500] }}>No FTO evaluations yet</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.g[50] }}>
                  {['Date', 'FTO', 'From Orientee', 'Overall', 'Communication', 'Teaching', 'Support', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: C.g[500], textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayEvals.map(ev => (
                  <tr key={ev.id} onClick={() => onSelectFTOEval(ev)} style={{ borderBottom: '1px solid ' + C.g[50], cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = C.g[50]} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: C.g[600] }}>{new Date(ev.shift_date).toLocaleDateString()}</td>
                    <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: C.g[800] }}>{ev.fto?.full_name || '?'}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: C.g[600] }}>{ev.orientee?.user?.full_name || ev.orientee?.temp_name || '?'}</td>
                    <td style={{ padding: '14px 16px' }}><div style={{ display: 'flex', gap: '2px' }}>{[1,2,3,4,5].map(s => <Icons.Star key={s} size={12} fill={s <= ev.overall_rating ? C.accent : 'none'} color={s <= ev.overall_rating ? C.accent : C.g[300]} />)}</div></td>
                    <td style={{ padding: '14px 16px' }}><div style={{ display: 'flex', gap: '2px' }}>{[1,2,3,4,5].map(s => <Icons.Star key={s} size={12} fill={s <= ev.communication_rating ? C.accent : 'none'} color={s <= ev.communication_rating ? C.accent : C.g[300]} />)}</div></td>
                    <td style={{ padding: '14px 16px' }}><div style={{ display: 'flex', gap: '2px' }}>{[1,2,3,4,5].map(s => <Icons.Star key={s} size={12} fill={s <= ev.teaching_rating ? C.accent : 'none'} color={s <= ev.teaching_rating ? C.accent : C.g[300]} />)}</div></td>
                    <td style={{ padding: '14px 16px' }}><div style={{ display: 'flex', gap: '2px' }}>{[1,2,3,4,5].map(s => <Icons.Star key={s} size={12} fill={s <= ev.support_rating ? C.accent : 'none'} color={s <= ev.support_rating ? C.accent : C.g[300]} />)}</div></td>
                    <td style={{ padding: '14px 16px' }}><Icons.ChevronDown size={16} color={C.g[400]} style={{ transform: 'rotate(-90deg)' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

const FTOEvalDetailModal = ({ evaluation, onClose }) => {
  const ev = evaluation;
  return (
    <Modal onClose={onClose} title="FTO Evaluation Details" width="500px">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: C.g[800], margin: '0 0 4px' }}>{ev.fto?.full_name}</h3>
          <div style={{ fontSize: '13px', color: C.g[500] }}>Evaluated by: {ev.orientee?.user?.full_name || ev.orientee?.temp_name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: C.g[700] }}>{new Date(ev.shift_date).toLocaleDateString()}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Overall', rating: ev.overall_rating },
          { label: 'Communication', rating: ev.communication_rating },
          { label: 'Teaching', rating: ev.teaching_rating },
          { label: 'Support', rating: ev.support_rating },
        ].map(({ label, rating }) => (
          <div key={label} style={{ padding: '14px', background: C.g[50], borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', color: C.g[500], marginBottom: '6px' }}>{label}</div>
            <div style={{ display: 'flex', gap: '3px' }}>
              {[1,2,3,4,5].map(s => <Icons.Star key={s} size={18} fill={s <= rating ? C.accent : 'none'} color={s <= rating ? C.accent : C.g[300]} />)}
            </div>
          </div>
        ))}
      </div>

      {ev.feedback && (
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: '600', color: C.g[700], margin: '0 0 8px' }}>Feedback</h4>
          <div style={{ padding: '14px', background: C.g[50], borderRadius: '10px', fontSize: '14px', color: C.g[700], lineHeight: '1.5' }}>{ev.feedback}</div>
        </div>
      )}
    </Modal>
  );
};

const AdminView = ({ orientees, profiles, onAdjustHours, onUpdateRole, onDeleteOrientee, onEditOrientee, saving, showConfirm }) => (
  <div style={{ padding: '26px' }}>
    <h1 style={{ fontSize: '26px', fontWeight: '700', color: C.g[900], margin: '0 0 22px 0' }}>Admin Panel</h1>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
      <div style={{ ...card, padding: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', color: C.g[800], margin: '0 0 16px 0' }}><Icons.Clock size={18} color={C.primary} style={{ marginRight: '8px', verticalAlign: 'middle' }} />Adjust Hours</h2>
        {orientees.filter(o => o.status !== 'cleared' && !o.is_archived).map(o => (
          <div key={o.id} style={{ padding: '12px 0', borderBottom: '1px solid ' + C.g[50], display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: C.g[800] }}>{o.user?.full_name || o.temp_name}</span>
            <Btn onClick={() => onAdjustHours(o)} style={{ padding: '8px 14px', fontSize: '12px' }}><Icons.Sliders size={14} /> Adjust</Btn>
          </div>
        ))}
        {orientees.filter(o => o.status !== 'cleared' && !o.is_archived).length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: C.g[500] }}>No active orientees</div>}
      </div>
      <div style={{ ...card, padding: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', color: C.g[800], margin: '0 0 16px 0' }}><Icons.Users size={18} color={C.primary} style={{ marginRight: '8px', verticalAlign: 'middle' }} />User Roles</h2>
        {profiles.map(p => (
          <div key={p.id} style={{ padding: '12px 0', borderBottom: '1px solid ' + C.g[50], display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontSize: '14px', fontWeight: '500', color: C.g[800] }}>{p.full_name}</div><div style={{ fontSize: '11px', color: C.g[500] }}>{p.email}</div></div>
            <select value={p.role} onChange={e => onUpdateRole(p.id, e.target.value)} disabled={saving} style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid ' + C.g[200], fontSize: '13px', background: 'white', fontWeight: '500', color: p.role === 'admin' ? C.danger : (p.role === 'fto' || p.role === 'lead_fto' || p.role === 'employee') ? C.primary : C.g[600] }}><option value="admin">Admin</option><option value="lead_fto">Lead FTO</option><option value="fto">FTO</option><option value="orientee">Orientee</option><option value="employee">Employee</option></select>
          </div>
        ))}
      </div>
    </div>
    <div style={{ ...card, padding: '20px', marginBottom: '20px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: '600', color: C.g[800], margin: '0 0 16px 0' }}><Icons.Edit size={18} color={C.primary} style={{ marginRight: '8px', verticalAlign: 'middle' }} />Edit Orientees</h2>
      <p style={{ fontSize: '13px', color: C.g[500], margin: '0 0 16px 0' }}>Edit orientee information including name, email, certification, shift, lead FTO, and orientation book link.</p>
      {orientees.filter(o => !o.is_archived).length === 0 ? <div style={{ padding: '20px', textAlign: 'center', color: C.g[500] }}>No orientees</div> : orientees.filter(o => !o.is_archived).map(o => {
        const name = o.user?.full_name || o.temp_name || 'Unknown';
        return (
          <div key={o.id} style={{ padding: '12px 0', borderBottom: '1px solid ' + C.g[50], display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: C.g[100], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', color: C.g[600], fontSize: '12px' }}>{name.split(' ').map(n => n[0]).join('')}</div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: C.g[800] }}>{name}</div>
                <div style={{ fontSize: '11px', color: C.g[500] }}>{o.cert_level} • {o.shift || 'No shift'} • {o.lead_fto?.full_name || 'No FTO'}</div>
              </div>
            </div>
            <Btn onClick={() => onEditOrientee(o)} style={{ padding: '8px 14px', fontSize: '12px' }}><Icons.Edit size={14} /> Edit</Btn>
          </div>
        );
      })}
    </div>
    <div style={{ ...card, padding: '20px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: '600', color: C.g[800], margin: '0 0 16px 0' }}><Icons.Archive size={18} color={C.warning} style={{ marginRight: '8px', verticalAlign: 'middle' }} />Archive Orientees</h2>
      <p style={{ fontSize: '13px', color: C.g[500], margin: '0 0 16px 0' }}>Archive orientees to hide them from active views. Their records will be preserved in the Records section.</p>
      {orientees.filter(o => !o.is_archived).length === 0 ? <div style={{ padding: '20px', textAlign: 'center', color: C.g[500] }}>No orientees</div> : orientees.filter(o => !o.is_archived).map(o => {
        const name = o.user?.full_name || o.temp_name || 'Unknown';
        const email = o.user?.email || o.temp_email || 'No email';
        const linked = !!o.user_id;
        return (
          <div key={o.id} style={{ padding: '12px 0', borderBottom: '1px solid ' + C.g[50], display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: C.g[100], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', color: C.g[600], fontSize: '12px' }}>{name.split(' ').map(n => n[0]).join('')}</div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: C.g[800] }}>{name}</div>
                <div style={{ fontSize: '11px', color: C.g[500] }}>{email} • {o.cert_level} • {linked ? <span style={{ color: C.success }}>Linked</span> : <span style={{ color: C.warning }}>Not linked</span>}</div>
              </div>
            </div>
            <button
              onClick={() => showConfirm('Archive Orientee', `Are you sure you want to archive "${name}"? They will be hidden from active views but their records will be preserved.`, () => onDeleteOrientee(o.id))}
              style={{ padding: '8px 14px', background: C.warning + '12', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', color: C.warning, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Icons.Archive size={14} /> Archive
            </button>
          </div>
        );
      })}
    </div>
  </div>
);

// Main Dashboard Component
export default function Dashboard({ user, onLogout }) {
  const [view, setView] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [orientees, setOrientees] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [ftos, setFTOs] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [myOrientee, setMyOrientee] = useState(null);
  const [recentMessages, setRecentMessages] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [stats, setStats] = useState({ activeOrientees: 0, atRiskCount: 0, pendingClearance: 0, avgProgress: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [selectedOrientee, setSelectedOrientee] = useState(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [selectedFTOEval, setSelectedFTOEval] = useState(null);
  const [ftoEvaluations, setFTOEvaluations] = useState([]);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [editingOrientee, setEditingOrientee] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const initialLoadDoneRef = React.useRef(false);

  useEffect(() => { 
    if (!initialLoadDoneRef.current) {
      load(); 
      initialLoadDoneRef.current = true;
    }
  }, [user]);

  const load = async (skipMessages = false) => {
    setLoading(true);
    try {
      const [pr, or, ev, ft, ta, ma, al, st, ftoEv] = await Promise.all([
        db.getUserProfile(user.id), db.getOrientees(), db.getEvaluations(), db.getFTOs(), db.getTasks(), db.getTrainingMaterials(), db.getAllProfiles(), db.getDashboardStats(), db.getFTOEvaluations()
      ]);
      setProfile(pr.data);
      setOrientees(or.data || []);
      setEvaluations(ev.data || []);
      setFTOs(ft.data || []);
      setTasks(ta.data || []);
      setMaterials(ma.data || []);
      setProfiles(al.data || []);
      setStats(st);
      setFTOEvaluations(ftoEv.data || []);
      
      // Load recent messages and unread count
      if (!skipMessages) {
        try {
          const { data: convos } = await db.getConversations(user.id);
          if (convos && convos.length > 0) {
            let allMsgs = [];
            for (const c of convos.slice(0, 3)) {
              const { data: msgs } = await db.getMessages(c.id);
              if (msgs) allMsgs = [...allMsgs, ...msgs.slice(-3)];
            }
            allMsgs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setRecentMessages(allMsgs.slice(0, 5));
          }
          // Get actual unread count from database
          const { count } = await db.getUnreadCount(user.id);
          setUnreadMessages(count || 0);
        } catch (e) { console.log('Messages load error', e); }
      }
      
      if (pr.data?.role === 'orientee') {
        const { data: mo } = await db.getOrienteeByUserId(user.id);
        setMyOrientee(mo);
        if (mo) {
          const { data: mt } = await db.getTasksByOrientee(mo.id);
          const { data: mc } = await db.getTrainingCompletions(mo.id);
          setMyTasks(mt || []);
          setCompletions(mc || []);
        }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const showConfirm = (title, message, onConfirm) => setConfirmDialog({ title, message, onConfirm });

  const handleAddOrientee = async (form) => {
    setSaving(true);
    try {
      await db.createOrientee({ lead_fto_id: form.lead_fto_id, cert_level: form.cert_level, station: form.station, shift: form.shift, start_date: form.start_date, tentative_clear_date: form.tentative_clear_date || null, status: 'on-track', hours_completed: 0, total_hours: 96, temp_name: form.full_name, temp_email: form.email, temp_phone: form.phone });
      await load(true); setModal(null);
    } catch (e) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  const handleAddEval = async (form) => {
    setSaving(true);
    try {
      const orientee = orientees.find(o => o.id === form.orientee_id);
      const { data, error } = await db.createEvaluation({ ...form, evaluator_id: user.id, phase: getPhase(orientee?.hours_completed || 0) });
      if (error) {
        console.error('Evaluation error:', error);
        alert('Failed to create evaluation: ' + error.message);
      } else {
        // Send email notification to Lead FTO if they didn't create this evaluation
        if (orientee?.lead_fto_id && orientee.lead_fto_id !== user.id) {
          const leadFTO = profiles.find(p => p.id === orientee.lead_fto_id);
          const orienteeName = orientee.user?.full_name || orientee.temp_name;
          if (leadFTO?.email) {
            db.sendEvaluationEmail({
              to: leadFTO.email,
              toName: leadFTO.full_name,
              orienteeName,
              evaluatorName: profile.full_name,
              shiftDate: form.shift_date,
              rating: form.overall_rating
            }).catch(e => console.log('Email notification failed:', e));
          }
        }
        await load(true); setModal(null);
      }
    } catch (e) { 
      console.error('Evaluation exception:', e);
      alert('Error: ' + e.message); 
    }
    setSaving(false);
  };

  const handleAddFTOEval = async (form) => {
    setSaving(true);
    try {
      await db.createFTOEvaluation({ ...form, orientee_id: myOrientee.id });
      await load(true); setModal(null); alert('Thank you for your feedback!');
    } catch (e) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  const handleAddTask = async (form) => {
    setSaving(true);
    try { await db.createTask({ ...form, assigned_by: user.id }); await load(true); setModal(null); }
    catch (e) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  const handleVerifyTask = async (id) => {
    await db.verifyTask(id, user.id);
    await load(true);
    setConfirmDialog(null);
  };

  const handleAddTraining = async (form) => {
    setSaving(true);
    try {
      if (editingMaterial) await db.updateTrainingMaterial(editingMaterial.id, form);
      else await db.createTrainingMaterial({ ...form, uploaded_by: user.id });
      await load(true); setModal(null); setEditingMaterial(null);
    } catch (e) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  const handleCompleteTraining = async (materialId) => {
    if (!myOrientee) return;
    await db.markTrainingComplete(myOrientee.id, materialId);
    const { data: mc } = await db.getTrainingCompletions(myOrientee.id);
    setCompletions(mc || []);
    setConfirmDialog(null);
  };

  const handleAdjustHours = async (updates) => {
    setSaving(true);
    try {
      await db.updateOrientee(selectedOrientee.id, { ...updates, adjusted_by: user.id });
      await load(true); setModal(null); setSelectedOrientee(null);
    } catch (e) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  const handleUpdateRole = async (userId, role) => {
    setSaving(true);
    const { data, error } = await db.updateProfile(userId, { role });
    if (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update role: ' + error.message);
    }
    await load(true);
    setSaving(false);
  };

  const handleUpdateStatus = async (orienteeId, status) => {
    await db.updateOrientee(orienteeId, { status });
    await load(true);
  };

  const handleDeleteOrientee = async (orienteeId) => {
    await db.deleteOrientee(orienteeId);
    await load(true);
    setConfirmDialog(null);
  };

  const handleEditOrientee = async (orienteeId, updates) => {
    setSaving(true);
    await db.updateOrientee(orienteeId, updates);
    await load(true);
    setModal(null);
    setEditingOrientee(null);
    setSaving(false);
  };

  const handleUploadPhoto = async (file) => {
    try {
      const { data, error } = await db.uploadProfilePicture(user.id, file);
      if (error) throw error;
      if (data) setProfile(data);
    } catch (e) {
      alert('Failed to upload photo: ' + e.message);
    }
  };

  const handleLogout = async () => { await signOut(); onLogout(); };
  const role = profile?.role || 'orientee';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(145deg, ' + C.g[50] + ', ' + C.g[100] + ')' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } input:focus, select:focus, textarea:focus { outline: none; border-color: ${C.primary} !important; }`}</style>
      
      <Sidebar view={view} setView={setView} role={role} collapsed={collapsed} setCollapsed={setCollapsed} unreadMessages={unreadMessages} />
      
      <main style={{ marginLeft: collapsed ? '72px' : '250px', transition: 'margin-left 0.3s' }}>
        <Header profile={profile} onLogout={handleLogout} unreadMessages={unreadMessages} onOpenMessages={() => setView('messages')} onUploadPhoto={handleUploadPhoto} />
        
        {view === 'dashboard' && <DashboardView orientees={orientees} stats={stats} loading={loading} onAdd={() => setModal('addOrientee')} onSelect={(o) => { setSelectedOrientee(o); setModal('orienteeDetail'); }} role={role} myOrientee={myOrientee} recentMessages={recentMessages} onOpenMessages={() => setView('messages')} />}
        {view === 'orientees' && <DashboardView orientees={orientees} stats={stats} loading={loading} onAdd={() => setModal('addOrientee')} onSelect={(o) => { setSelectedOrientee(o); setModal('orienteeDetail'); }} role={role} myOrientee={myOrientee} recentMessages={recentMessages} onOpenMessages={() => setView('messages')} />}
        {view === 'evaluations' && <EvaluationsView evaluations={evaluations} orientees={orientees} role={role} myOrientee={myOrientee} onAdd={() => setModal('addEval')} onAddFTOEval={() => setModal('addFTOEval')} ftos={ftos} loading={loading} onSelectEval={(ev) => { setSelectedEvaluation(ev); setModal('evalDetail'); }} />}
        {view === 'training' && <TrainingView role={role} materials={materials} completions={completions} orienteeId={myOrientee?.id} onAdd={() => { setEditingMaterial(null); setModal('addTraining'); }} onEdit={(m) => { setEditingMaterial(m); setModal('addTraining'); }} onComplete={handleCompleteTraining} loading={loading} showConfirm={showConfirm} />}
        {view === 'tasks' && <TasksView role={role} tasks={tasks} myTasks={myTasks} orientees={orientees} onAdd={() => setModal('addTask')} onVerify={handleVerifyTask} loading={loading} showConfirm={showConfirm} />}
        {view === 'messages' && <MessagesView userId={user.id} profiles={profiles} onClearUnread={async () => { const { count } = await db.getUnreadCount(user.id); setUnreadMessages(count || 0); }} role={role} />}
        {view === 'fto-feedback' && <FTOFeedbackView role={role} userId={user.id} ftoEvaluations={ftoEvaluations} loading={loading} onSelectFTOEval={(ev) => { setSelectedFTOEval(ev); setModal('ftoEvalDetail'); }} />}
        {view === 'records' && <RecordsView orientees={orientees} evaluations={evaluations} tasks={tasks} />}
        {view === 'admin' && <AdminView orientees={orientees} profiles={profiles} onAdjustHours={(o) => { setSelectedOrientee(o); setModal('adjustHours'); }} onUpdateRole={handleUpdateRole} onDeleteOrientee={handleDeleteOrientee} onEditOrientee={(o) => { setEditingOrientee(o); setModal('editOrientee'); }} saving={saving} showConfirm={showConfirm} />}
      </main>

      {modal === 'addOrientee' && <AddOrienteeForm onClose={() => setModal(null)} onSave={handleAddOrientee} ftos={ftos} loading={saving} />}
      {modal === 'addEval' && <AddEvalForm onClose={() => setModal(null)} onSave={handleAddEval} orientees={orientees} loading={saving} />}
      {modal === 'addFTOEval' && <FTOEvalForm onClose={() => setModal(null)} onSave={handleAddFTOEval} ftos={ftos} loading={saving} />}
      {modal === 'addTask' && <AddTaskForm onClose={() => setModal(null)} onSave={handleAddTask} orientees={orientees} loading={saving} />}
      {modal === 'addTraining' && <TrainingForm onClose={() => { setModal(null); setEditingMaterial(null); }} onSave={handleAddTraining} loading={saving} editData={editingMaterial} />}
      {modal === 'adjustHours' && selectedOrientee && <HoursAdjustForm orientee={selectedOrientee} onClose={() => { setModal(null); setSelectedOrientee(null); }} onSave={handleAdjustHours} loading={saving} />}
      {modal === 'editOrientee' && editingOrientee && <EditOrienteeForm orientee={editingOrientee} onClose={() => { setModal(null); setEditingOrientee(null); }} onSave={handleEditOrientee} ftos={ftos} loading={saving} />}
      {modal === 'orienteeDetail' && selectedOrientee && <OrienteeDetailModal orientee={selectedOrientee} onClose={() => { setModal(null); setSelectedOrientee(null); load(true); }} evaluations={evaluations} tasks={tasks} onUpdateStatus={handleUpdateStatus} onUpdateOrientee={async (id, updates) => { await db.updateOrientee(id, updates); }} role={role} />}
      {modal === 'evalDetail' && selectedEvaluation && <EvaluationDetailModal evaluation={selectedEvaluation} onClose={() => { setModal(null); setSelectedEvaluation(null); }} role={role} />}
      {modal === 'ftoEvalDetail' && selectedFTOEval && <FTOEvalDetailModal evaluation={selectedFTOEval} onClose={() => { setModal(null); setSelectedFTOEval(null); }} />}
      
      {confirmDialog && <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} onConfirm={() => confirmDialog.onConfirm()} onCancel={() => setConfirmDialog(null)} />}
    </div>
  );
}
