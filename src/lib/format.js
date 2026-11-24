// Presentation helpers shared by every view. Pure functions only.

export const initials = (name) =>
  (name || '?').trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

// A bare YYYY-MM-DD is a calendar date, not an instant. `new Date('2026-03-01')`
// parses it as UTC midnight, which renders as the previous day in US timezones.
export const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
  return isNaN(d) ? null : d;
};

export const fmtDate = (value, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  const d = parseDate(value);
  return d ? d.toLocaleDateString(undefined, opts) : '—';
};

export const fmtTime = (value) => {
  const d = parseDate(value);
  return d ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Whole calendar days from today to `value`. Negative means in the past.
export const daysFromToday = (value, now = new Date()) => {
  const d = parseDate(value);
  if (!d) return null;
  return Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
};

export const dayLabel = (value, now = new Date()) => {
  const n = daysFromToday(value, now);
  if (n === null) return '';
  if (n === 0) return 'Today';
  if (n === -1) return 'Yesterday';
  return fmtDate(value, { weekday: 'short', month: 'short', day: 'numeric' });
};

export const fmtRelative = (value, now = new Date()) => {
  const n = daysFromToday(value, now);
  if (n === null) return '—';
  if (n === 0) return 'today';
  if (n === -1) return 'yesterday';
  if (n === 1) return 'tomorrow';
  return n < 0 ? `${-n}d ago` : `in ${n}d`;
};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const greeting = (now = new Date()) => {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

// ---------- Orientation model ----------

// Hour boundaries of the four FTO phases over the 96-hour base programme.
export const PHASES = [
  { n: 1, name: 'Familiarization', from: 0, to: 24, color: 'var(--p1)' },
  { n: 2, name: 'Guided Participation', from: 24, to: 64, color: 'var(--p2)' },
  { n: 3, name: 'Independence', from: 64, to: 88, color: 'var(--p3)' },
  { n: 4, name: 'Clearance', from: 88, to: 96, color: 'var(--p4)' },
];

export const getPhase = (hours) => {
  const h = hours || 0;
  return h < 24 ? 1 : h < 64 ? 2 : h < 88 ? 3 : 4;
};

export const phaseInfo = (n) => PHASES[(n || 1) - 1] || PHASES[0];

// How full a phase's own segment is, 0–100.
export const phaseFill = (phase, hours) => {
  const h = hours || 0;
  if (h >= phase.to) return 100;
  if (h <= phase.from) return 0;
  return Math.round(((h - phase.from) / (phase.to - phase.from)) * 100);
};

export const oName = (o) => o?.user?.full_name || o?.temp_name || 'Unnamed';
export const oEmail = (o) => o?.user?.email || o?.temp_email || '';
export const oPhone = (o) => o?.user?.phone || o?.temp_phone || '';
export const totalHours = (o) => (o?.total_hours || 96) + (o?.hours_adjustment || 0);
export const progressPct = (o) => {
  const tot = totalHours(o);
  if (!tot) return 0;
  return Math.max(0, Math.min(100, Math.round(((o?.hours_completed || 0) / tot) * 100)));
};

export const STATUSES = {
  'on-track': { label: 'On track', tone: 'success' },
  'at-risk': { label: 'At risk', tone: 'warning' },
  'extended': { label: 'Extended', tone: 'danger' },
  'pending-clearance': { label: 'Pending clearance', tone: 'brand' },
  'cleared': { label: 'Cleared', tone: 'neutral' },
};
export const statusInfo = (s) => STATUSES[s] || { label: s || 'Unknown', tone: 'neutral' };

export const certTone = (level) => ({ EMT: 'brand', AEMT: 'accent', Paramedic: 'success' }[level] || 'neutral');

export const isActiveOrientee = (o) => !o.is_archived && o.status !== 'cleared';

export const avg = (nums) => {
  const list = (nums || []).filter(n => typeof n === 'number' && !isNaN(n));
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
};

export const MATERIAL_TYPES = {
  video: { label: 'Video', tone: 'danger', icon: 'Video' },
  document: { label: 'Document', tone: 'brand', icon: 'FileText' },
  powerpoint: { label: 'Slides', tone: 'warning', icon: 'Presentation' },
  link: { label: 'Link', tone: 'violet', icon: 'Link' },
};
export const materialType = (t) => MATERIAL_TYPES[t] || MATERIAL_TYPES.link;

// Only http(s) links are safe to put in an href; anything else (javascript:, data:)
// is rendered as plain text instead.
export const safeUrl = (url) => (/^https?:\/\//i.test((url || '').trim()) ? url.trim() : null);
