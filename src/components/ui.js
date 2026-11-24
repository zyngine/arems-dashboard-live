// Shared UI primitives. All styling lives in src/styles/app.css; components here
// only pick class names, so light and dark themes come for free.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icons } from './Icons';
import { initials, statusInfo, certTone } from '../lib/format';

const cx = (...parts) => parts.filter(Boolean).join(' ');

// ---------- Buttons ----------
export const Button = ({ variant = 'primary', size, icon: I, loading, block, className, children, type = 'button', ...p }) => (
  <button type={type} {...p} disabled={loading || p.disabled}
    className={cx('btn', 'btn-' + variant, size === 'sm' && 'btn-sm', block && 'btn-block', !children && 'btn-icon', className)}>
    {loading ? <Icons.Loader size={size === 'sm' ? 14 : 16} className="spin" /> : I && <I size={size === 'sm' ? 14 : 16} />}
    {children}
  </button>
);

export const IconButton = ({ label, icon, variant = 'ghost', ...p }) => (
  <Button variant={variant} icon={icon} aria-label={label} title={label} {...p} />
);

// ---------- Display ----------
export const Avatar = ({ name, src, size }) => (
  <span className={cx('avatar', size)} style={src ? { backgroundImage: `url(${src})` } : undefined} aria-hidden="true">
    {!src && initials(name)}
  </span>
);

export const Badge = ({ tone = 'neutral', dot, children, className }) => (
  <span className={cx('badge', 'tone-' + tone, dot && 'dot', className)}>{children}</span>
);
export const StatusBadge = ({ status }) => { const s = statusInfo(status); return <Badge tone={s.tone} dot>{s.label}</Badge>; };
export const CertBadge = ({ level }) => (level ? <Badge tone={certTone(level)}>{level}</Badge> : null);

export const Stars = ({ value = 0, size = 14 }) => (
  <span className="stars" role="img" aria-label={`${value} out of 5`}>
    {[1, 2, 3, 4, 5].map(s => <Icons.Star key={s} size={size} fill={s <= value ? 'currentColor' : 'none'} className={s <= value ? undefined : 'off'} />)}
  </span>
);

export const Progress = ({ value, color }) => (
  <div className="progress" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} style={color ? { '--bar': color } : undefined}>
    <i style={{ width: Math.max(0, Math.min(100, value)) + '%' }} />
  </div>
);

export const Ring = ({ value, size = 120, stroke = 10, color = 'var(--brand-fg)', children }) => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
};

export const Card = ({ className, children, ...p }) => <section className={cx('card', className)} {...p}>{children}</section>;
export const CardHead = ({ title, icon: I, children }) => (
  <div className="card-head"><h2 className="card-title">{I && <I size={17} />}{title}</h2>{children}</div>
);

export const StatCard = ({ icon: I, label, value, tone = 'brand', loading, onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={cx('card stat', 'tone-' + tone, onClick && 'clickable')} onClick={onClick} type={onClick ? 'button' : undefined} style={onClick ? { display: 'flex' } : undefined}>
      <span className="stat-icon"><I size={21} /></span>
      <span>
        {loading ? <Skeleton w={52} h={26} /> : <span className="stat-value" style={{ display: 'block' }}>{value}</span>}
        <span className="stat-label" style={{ display: 'block' }}>{label}</span>
      </span>
    </Tag>
  );
};

export const PageHead = ({ title, sub, children }) => (
  <div className="page-head">
    <div><h1 className="page-title">{title}</h1>{sub && <p className="page-sub">{sub}</p>}</div>
    {children && <div className="page-actions">{children}</div>}
  </div>
);

export const Empty = ({ icon: I = Icons.Inbox, title, children, action }) => (
  <div className="empty">
    <div className="empty-icon"><I size={22} /></div>
    <div className="empty-title">{title}</div>
    {children && <p>{children}</p>}
    {action && <div style={{ marginTop: 14 }}>{action}</div>}
  </div>
);

export const Skeleton = ({ w = '100%', h = 14, style }) => <span className="skeleton" style={{ display: 'block', width: w, height: h, ...style }} />;
export const SkeletonRows = ({ rows = 4 }) => (
  <div aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div className="list-row" key={i}><Skeleton w={36} h={36} style={{ borderRadius: 10, flexShrink: 0 }} /><div className="grow stack tight"><Skeleton w="45%" /><Skeleton w="70%" h={11} /></div></div>
    ))}
  </div>
);

// ---------- Form controls ----------
export const Field = ({ label, hint, children }) => (
  <label className="field"><span className="label">{label}</span>{children}{hint && <span className="tiny muted" style={{ display: 'block', marginTop: 4 }}>{hint}</span>}</label>
);

export const SearchInput = ({ value, onChange, placeholder = 'Search…' }) => (
  <div className="search">
    <Icons.Search size={16} />
    <input className="input" type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
  </div>
);

export const Tabs = ({ value, onChange, options, label }) => (
  <div className="tabs" role="tablist" aria-label={label}>
    {options.map(o => (
      <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={cx('tab', value === o.value && 'on')} onClick={() => onChange(o.value)}>
        {o.icon && <o.icon size={14} />}{o.label}{o.count !== undefined && <span className="count">{o.count}</span>}
      </button>
    ))}
  </div>
);

export const RatingInput = ({ value, onChange, label }) => (
  <div className="rate" role="radiogroup" aria-label={label}>
    {[1, 2, 3, 4, 5].map(r => (
      <button key={r} type="button" role="radio" aria-checked={value === r} aria-label={`${r} star${r > 1 ? 's' : ''}`} className={value >= r ? 'on' : undefined} onClick={() => onChange(r)}>
        <Icons.Star size={17} fill={value >= r ? 'currentColor' : 'none'} />
      </button>
    ))}
  </div>
);

// ---------- Overlays ----------
// Escape closes, body scroll is locked, and focus returns to the opener.
// Overlays can nest (a form opened from the drawer), so only the top one reacts.
const overlayStack = [];
const useOverlay = (onClose, focusFirstField = false) => {
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement;
    const token = {};
    overlayStack.push(token);
    const onKey = (e) => { if (e.key === 'Escape' && overlayStack[overlayStack.length - 1] === token) close.current(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Only forms jump to their first field; elsewhere a stray keystroke on a
    // focused select would change data.
    const first = focusFirstField && ref.current?.querySelector('form input:not([type=hidden]):not([type=date]), form textarea');
    (first || ref.current)?.focus?.();
    return () => {
      document.removeEventListener('keydown', onKey);
      overlayStack.splice(overlayStack.indexOf(token), 1);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, []);
  return ref;
};

export const Modal = ({ title, onClose, width = 480, children }) => {
  const ref = useOverlay(onClose, true);
  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="modal-head"><h2 className="modal-title">{title}</h2><IconButton label="Close" icon={Icons.X} size="sm" onClick={onClose} /></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

export const Drawer = ({ title, onClose, actions, children }) => {
  const ref = useOverlay(onClose);
  return (
    <>
      <div className="overlay" style={{ zIndex: 190 }} onMouseDown={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <div className="row" style={{ gap: 6 }}>{actions}<IconButton label="Close" icon={Icons.X} size="sm" onClick={onClose} /></div>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
};

// ---------- Confirm + toast, available anywhere through useFeedback() ----------
const FeedbackContext = createContext(null);
export const useFeedback = () => useContext(FeedbackContext);

const TOAST_ICON = { success: Icons.CheckCircle, danger: Icons.AlertCircle, brand: Icons.Info };

const ConfirmDialog = ({ title, message, confirmLabel = 'Confirm', tone = 'brand', onConfirm, onCancel }) => {
  const [busy, setBusy] = useState(false);
  const ref = useOverlay(onCancel);
  const go = async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } };
  return (
    <div className="overlay" style={{ zIndex: 300 }} onMouseDown={e => e.target === e.currentTarget && onCancel()}>
      <div className={cx('modal confirm', 'tone-' + tone)} role="alertdialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="confirm-icon"><Icons.AlertCircle size={24} /></div>
        <h2 className="modal-title">{title}</h2>
        <p className="soft" style={{ margin: '8px 0 18px' }}>{message}</p>
        <div className="form-actions">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy} onClick={go}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
};

export const FeedbackProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const nextId = useRef(0);

  const push = useCallback((tone, message) => {
    const id = ++nextId.current;
    setToasts(t => [...t.slice(-3), { id, tone, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), tone === 'danger' ? 7000 : 4000);
  }, []);

  const api = useRef(null);
  if (!api.current) {
    api.current = {
      success: (m) => push('success', m),
      error: (m) => push('danger', m),
      info: (m) => push('brand', m),
      // confirm({ title, message, confirmLabel, tone, onConfirm }) — closes itself once onConfirm settles.
      confirm: (opts) => setDialog(opts),
    };
  }

  return (
    <FeedbackContext.Provider value={api.current}>
      {children}
      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} onConfirm={async () => { try { await dialog.onConfirm(); } finally { setDialog(null); } }} />}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => { const I = TOAST_ICON[t.tone] || Icons.Info; return <div key={t.id} className={cx('toast', 'tone-' + t.tone)}><I size={18} /><span>{t.message}</span></div>; })}
      </div>
    </FeedbackContext.Provider>
  );
};

export { cx };
