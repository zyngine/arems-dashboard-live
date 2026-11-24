// Application chrome: sidebar, top bar, mobile tab bar, user menu and the
// Ctrl/Cmd+K command palette.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from './Icons';
import { Avatar, Badge, CertBadge, IconButton, StatusBadge, cx } from './ui';
import { ROLE_LABELS } from '../lib/roles';
import { oName } from '../lib/format';

const STAFF = ['admin', 'fto', 'lead_fto'];
const EVERYONE = ['admin', 'fto', 'lead_fto', 'orientee', 'employee'];

export const NAV = [
  { section: 'Overview', items: [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.Home, roles: EVERYONE },
  ] },
  { section: 'Field training', items: [
    { id: 'orientees', label: 'Orientees', icon: Icons.Users, roles: STAFF },
    { id: 'evaluations', label: 'Evaluations', icon: Icons.ClipboardCheck, roles: EVERYONE },
    { id: 'tasks', label: 'Tasks', icon: Icons.ListTodo, roles: [...STAFF, 'orientee'] },
    { id: 'fto-queue', label: 'FTO Queue', icon: Icons.Clock, roles: STAFF },
    { id: 'fto-feedback', label: 'FTO Feedback', icon: Icons.ThumbsUp, roles: STAFF },
  ] },
  { section: 'Learning', items: [
    { id: 'training', label: 'Training', icon: Icons.GraduationCap, roles: EVERYONE },
    { id: 'completions', label: 'Completions', icon: Icons.Award, roles: ['admin'] },
  ] },
  { section: 'Team', items: [
    { id: 'messages', label: 'Messages', icon: Icons.MessageCircle, roles: [...STAFF, 'orientee'] },
  ] },
  { section: 'Administration', items: [
    { id: 'records', label: 'Records', icon: Icons.FileText, roles: ['admin'] },
    { id: 'admin', label: 'Admin', icon: Icons.Settings, roles: ['admin'] },
  ] },
];

export const navFor = (role) => NAV
  .map(s => ({ ...s, items: s.items.filter(i => i.roles.includes(role)) }))
  .filter(s => s.items.length);

export const allowedViews = (role) => navFor(role).flatMap(s => s.items.map(i => i.id));

export const Sidebar = ({ view, onNavigate, role, collapsed, onToggleCollapsed, open, onClose, unread }) => (
  <>
    {open && <div className="scrim" onClick={onClose} />}
    <aside className={cx('sidebar', collapsed && 'collapsed', open && 'open')}>
      <div className="side-brand">
        <img src="/logo.jpg" alt="" />
        <div className="side-brand-text"><div className="side-brand-name">Adams Regional EMS</div><div className="side-brand-sub">Training</div></div>
      </div>
      <nav className="side-nav" aria-label="Main">
        {navFor(role).map(s => (
          <div key={s.section}>
            <div className="side-section">{s.section}</div>
            {s.items.map(i => (
              <button key={i.id} type="button" className={cx('side-link', view === i.id && 'active')} aria-current={view === i.id ? 'page' : undefined}
                title={collapsed ? i.label : undefined} onClick={() => { onNavigate(i.id); onClose(); }}>
                <i.icon size={19} /><span className="side-label">{i.label}</span>
                {i.id === 'messages' && unread > 0 && <span className="side-badge" aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="side-foot">
        <button type="button" className="side-link" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} style={{ marginBottom: 0 }}>
          <Icons.ChevronLeft size={19} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} /><span className="side-label">Collapse</span>
        </button>
      </div>
    </aside>
  </>
);

const UserMenu = ({ profile, theme, onToggleTheme, onLogout, onUploadPhoto }) => {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const file = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const roles = profile?.roles?.length ? profile.roles : (profile?.role ? [profile.role] : []);
  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button type="button" className="btn btn-ghost" style={{ padding: '0 6px 0 4px', gap: 8 }} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen(!open)}>
        <Avatar name={profile?.full_name} src={profile?.avatar_url} size="sm" />
        <span className="hide-mobile truncate" style={{ maxWidth: 140, color: 'var(--text)' }}>{profile?.full_name || 'Account'}</span>
        <Icons.ChevronDown size={14} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <div className="strong truncate">{profile?.full_name || 'Your account'}</div>
            <div className="tiny muted truncate">{profile?.email}</div>
            <div className="row wrap" style={{ gap: 4, marginTop: 8 }}>
              {roles.map(r => <Badge key={r} tone="brand">{ROLE_LABELS[r] || r}</Badge>)}
              <CertBadge level={profile?.cert_level} />
            </div>
          </div>
          <button type="button" role="menuitem" className="menu-item" onClick={() => file.current?.click()}><Icons.Camera size={16} />Change photo</button>
          <button type="button" role="menuitem" className="menu-item" onClick={onToggleTheme}>{theme === 'dark' ? <Icons.Sun size={16} /> : <Icons.Moon size={16} />}{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
          <button type="button" role="menuitem" className="menu-item danger" onClick={onLogout}><Icons.LogOut size={16} />Sign out</button>
          <input ref={file} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onUploadPhoto(f); e.target.value = ''; setOpen(false); }} />
        </div>
      )}
    </div>
  );
};

export const Topbar = ({ profile, role, unread, theme, onToggleTheme, onOpenMenu, onOpenSearch, onOpenMessages, onLogout, onUploadPhoto }) => (
  <header className="topbar">
    <span className="mobile-only"><IconButton label="Open menu" icon={Icons.Menu} onClick={onOpenMenu} /></span>
    <button type="button" className="topbar-search" onClick={onOpenSearch} aria-label="Search">
      <Icons.Search size={16} /><span>Search people, pages, training…</span><span className="kbd">Ctrl K</span>
    </button>
    <div className="grow hide-mobile" />
    <IconButton label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} icon={theme === 'dark' ? Icons.Sun : Icons.Moon} onClick={onToggleTheme} className="hide-mobile" />
    {allowedViews(role).includes('messages') && (
      <span style={{ position: 'relative' }}>
        <IconButton label={unread ? `Messages, ${unread} unread` : 'Messages'} icon={Icons.MessageCircle} onClick={onOpenMessages} />
        {unread > 0 && <span className="side-badge" style={{ position: 'absolute', top: 0, right: -2, minWidth: 17, padding: '0 4px', fontSize: 10, pointerEvents: 'none' }}>{unread > 99 ? '99+' : unread}</span>}
      </span>
    )}
    <UserMenu profile={profile} theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout} onUploadPhoto={onUploadPhoto} />
  </header>
);

// Bottom tab bar on phones: the four most-used destinations plus the full menu.
export const MobileNav = ({ view, onNavigate, role, unread, onOpenMenu }) => {
  const order = ['dashboard', 'evaluations', 'training', 'messages', 'tasks', 'orientees'];
  const all = navFor(role).flatMap(s => s.items);
  const items = order.map(id => all.find(i => i.id === id)).filter(Boolean).slice(0, 4);
  return (
    <nav className="mobile-nav" aria-label="Primary">
      {items.map(i => (
        <button key={i.id} type="button" className={view === i.id ? 'active' : undefined} aria-current={view === i.id ? 'page' : undefined} onClick={() => onNavigate(i.id)}>
          <i.icon size={21} />{i.label}
          {i.id === 'messages' && unread > 0 && <span className="side-badge">{unread}</span>}
        </button>
      ))}
      <button type="button" onClick={onOpenMenu}><Icons.Menu size={21} />More</button>
    </nav>
  );
};

export const CommandPalette = ({ role, orientees, materials, profiles, onClose, onNavigate, onSelectOrientee }) => {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef(null);
  const isStaff = STAFF.includes(role);

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    const match = (...fields) => !s || fields.some(f => (f || '').toLowerCase().includes(s));
    const pages = navFor(role).flatMap(sec => sec.items).filter(i => match(i.label))
      .map(i => ({ key: 'p-' + i.id, icon: <i.icon size={17} />, label: i.label, hint: 'Page', run: () => onNavigate(i.id) }));
    const people = !isStaff ? [] : orientees.filter(o => match(oName(o), o.cert_level, o.lead_fto?.full_name)).slice(0, s ? 8 : 5)
      .map(o => ({ key: 'o-' + o.id, icon: <Avatar name={oName(o)} size="sm" />, label: oName(o), hint: <StatusBadge status={o.status} />, run: () => onSelectOrientee(o) }));
    const training = materials.filter(m => match(m.title, m.description)).slice(0, s ? 6 : 3)
      .map(m => ({ key: 'm-' + m.id, icon: <Icons.GraduationCap size={17} />, label: m.title, hint: 'Training', run: () => onNavigate('training') }));
    const staff = role !== 'admin' || !s ? [] : profiles.filter(p => match(p.full_name, p.email)).slice(0, 5)
      .map(p => ({ key: 'u-' + p.id, icon: <Avatar name={p.full_name} src={p.avatar_url} size="sm" />, label: p.full_name || p.email, hint: 'Manage in Admin', run: () => onNavigate('admin') }));
    return [['Pages', pages], ['Orientees', people], ['Training', training], ['Staff', staff]].filter(([, items]) => items.length);
  }, [q, role, isStaff, orientees, materials, profiles, onNavigate, onSelectOrientee]);

  const flat = groups.flatMap(([, items]) => items);
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector('.sel')?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(i => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && flat[sel]) { e.preventDefault(); flat[sel].run(); onClose(); }
    else if (e.key === 'Escape') onClose();
  };

  let index = -1;
  return (
    <div className="overlay" style={{ zIndex: 250 }} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal palette" role="dialog" aria-modal="true" aria-label="Search">
        <div className="palette-input">
          <Icons.Search size={18} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search people, pages, training…" aria-label="Search" />
          <span className="kbd">Esc</span>
        </div>
        <div className="palette-list" ref={listRef}>
          {flat.length === 0 && <div className="empty" style={{ padding: 28 }}>Nothing matches “{q}”.</div>}
          {groups.map(([name, items]) => (
            <div key={name}>
              <div className="palette-group">{name}</div>
              {items.map(item => {
                index += 1;
                const i = index;
                return (
                  <button key={item.key} type="button" className={cx('palette-item', i === sel && 'sel')} onMouseEnter={() => setSel(i)} onClick={() => { item.run(); onClose(); }}>
                    {item.icon}<span className="truncate">{item.label}</span><span className="hint">{item.hint}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
