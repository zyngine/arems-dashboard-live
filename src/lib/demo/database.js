// In-memory stand-in for ../database.js, used only in demo mode. Every export
// mirrors the name, arguments and return shape of the real function so views
// cannot tell the difference.
import { seed } from './data';
import { primaryRole } from '../roles';

const S = seed();
let seq = 1000;
const id = (p) => `${p}-${++seq}`;
const ok = (data) => Promise.resolve({ data, error: null });
const now = () => new Date().toISOString();

const profile = (pid) => S.profiles.find(p => p.id === pid) || null;
const pick = (p, keys) => (p ? Object.fromEntries(keys.map(k => [k, p[k]])) : null);
const joinOrientee = (o) => o && ({
  ...o,
  lead_fto: pick(profile(o.lead_fto_id), ['id', 'full_name', 'email', 'phone']),
  user: pick(profile(o.user_id), ['id', 'full_name', 'email', 'phone']),
});
const orienteeRef = (oid) => {
  const o = S.orientees.find(x => x.id === oid);
  return o ? { id: o.id, cert_level: o.cert_level, temp_name: o.temp_name, user: pick(profile(o.user_id), ['full_name']) } : null;
};
const desc = (key) => (a, b) => String(b[key] || '').localeCompare(String(a[key] || ''));

export const demoProfile = profile;

export const getUserProfile = (userId) => ok(profile(userId));
export const getAllProfiles = () => ok([...S.profiles].sort((a, b) => a.full_name.localeCompare(b.full_name)));
export const updateProfile = (userId, updates) => {
  const { role, cert_level, roles, user_roles, ...safe } = updates;
  Object.assign(profile(userId) || {}, safe);
  return ok(profile(userId));
};
export const setUserRoles = (userId, roles) => {
  const p = profile(userId);
  if (p) { p.roles = roles; p.role = primaryRole(roles); }
  return Promise.resolve({ error: null });
};
export const setUserCertLevel = (userId, certLevel) => {
  const p = profile(userId);
  if (p) p.cert_level = certLevel;
  return Promise.resolve({ error: null });
};
export const getFTOs = () => ok(S.profiles.filter(p => ['fto', 'lead_fto', 'admin'].includes(p.role)));

export const getOrientees = () => ok([...S.orientees].sort(desc('created_at')).map(joinOrientee));
export const getOrienteeByUserId = (userId) => ok(joinOrientee(S.orientees.find(o => o.user_id === userId)) || null);
export const createOrientee = (data) => {
  const o = { id: id('o'), is_archived: false, hours_adjustment: 0, created_at: now(), ...data };
  S.orientees.push(o);
  return ok(o);
};
export const updateOrientee = async (oid, updates) => {
  const o = S.orientees.find(x => x.id === oid);
  if (!o) return { data: null, error: new Error('Orientee not found') };
  const wasCleared = o.status === 'cleared';
  Object.assign(o, updates);
  if (updates.status === 'cleared' && !wasCleared && o.lead_fto_id) await moveFTOToBottom(o.lead_fto_id);
  return { data: o, error: null };
};
export const deleteOrientee = (oid) => {
  const o = S.orientees.find(x => x.id === oid);
  if (o) { o.is_archived = true; o.archived_at = now(); }
  return Promise.resolve({ error: null });
};
export const linkOrienteeByEmail = () => Promise.resolve({ linked: false, reason: 'demo' });

const queueMembers = () => S.profiles.filter(p => p.roles.some(r => r === 'fto' || r === 'lead_fto'));
export const getFTOQueue = () => {
  const rows = queueMembers()
    .sort((a, b) => (a.queue_position ?? 1e9) - (b.queue_position ?? 1e9) || a.full_name.localeCompare(b.full_name))
    .map(f => ({
      ...pick(f, ['id', 'full_name', 'email', 'role', 'queue_position', 'avatar_url']),
      active_orientees: S.orientees
        .filter(o => o.lead_fto_id === f.id && !o.is_archived && o.status !== 'cleared')
        .map(o => ({ id: o.id, name: profile(o.user_id)?.full_name || o.temp_name || 'Unnamed', cert_level: o.cert_level, status: o.status })),
    }));
  return ok(rows);
};
export const moveFTOToBottom = (ftoId) => {
  const max = Math.max(0, ...queueMembers().map(p => p.queue_position || 0));
  const p = profile(ftoId);
  if (p) p.queue_position = max + 1;
  return Promise.resolve({ error: null });
};
export const swapFTOQueuePositions = (idA, idB) => {
  const a = profile(idA), b = profile(idB);
  if (!a || !b) return Promise.resolve({ error: new Error('Could not load FTOs to swap') });
  [a.queue_position, b.queue_position] = [b.queue_position, a.queue_position];
  return Promise.resolve({ error: null });
};

const joinEval = (e) => ({ ...e, orientee: orienteeRef(e.orientee_id), evaluator: pick(profile(e.evaluator_id), ['id', 'full_name']) });
export const getEvaluations = () => ok([...S.evaluations].sort(desc('created_at')).map(joinEval));
export const getEvaluationsByOrientee = (oid) => ok(S.evaluations.filter(e => e.orientee_id === oid).sort(desc('shift_date')).map(joinEval));
export const createEvaluation = (data) => {
  const e = { id: id('e'), created_at: now(), ...data };
  S.evaluations.push(e);
  const o = S.orientees.find(x => x.id === data.orientee_id);
  if (o) { o.hours_completed = (o.hours_completed || 0) + (data.hours_logged || 0); o.last_evaluation_date = data.shift_date; }
  return ok(e);
};

const joinFtoEval = (e) => ({ ...e, fto: pick(profile(e.fto_id), ['id', 'full_name', 'email']), orientee: orienteeRef(e.orientee_id) });
export const createFTOEvaluation = (data) => { const e = { id: id('f'), created_at: now(), ...data }; S.ftoEvaluations.push(e); return ok(e); };
export const getFTOEvaluations = () => ok([...S.ftoEvaluations].sort(desc('created_at')).map(joinFtoEval));
export const getFTOEvaluationsForFTO = (ftoId) => ok(S.ftoEvaluations.filter(e => e.fto_id === ftoId).sort(desc('created_at')).map(joinFtoEval));

export const getTasks = () => ok([...S.tasks].sort(desc('created_at')).map(t => ({ ...t, orientee: orienteeRef(t.assigned_to) })));
export const getTasksByOrientee = (oid) => ok(S.tasks.filter(t => t.assigned_to === oid));
export const createTask = (data) => { const t = { id: id('t'), status: 'pending', created_at: now(), ...data, due_date: data.due_date || null }; S.tasks.push(t); return ok(t); };
export const verifyTask = (tid, verifiedBy) => {
  const t = S.tasks.find(x => x.id === tid);
  if (t) Object.assign(t, { status: 'completed', verified_by: verifiedBy, verified_at: now() });
  return ok(t);
};

export const getTrainingMaterials = () => ok([...S.materials].sort(desc('created_at')));
export const createTrainingMaterial = (data) => { const m = { id: id('m'), created_at: now(), ...data }; S.materials.push(m); return ok(m); };
export const updateTrainingMaterial = (mid, updates) => { const m = S.materials.find(x => x.id === mid); Object.assign(m || {}, updates); return ok(m); };
export const getTrainingCompletions = (userId) => ok(S.completions.filter(c => c.user_id === userId));
export const markTrainingComplete = (userId, materialId, orienteeId = null) => {
  const c = { id: id('c'), user_id: userId, material_id: materialId, orientee_id: orienteeId, completed_at: now() };
  S.completions.push(c);
  return ok(c);
};
export const getCompletionReport = () => ok([...S.completions].sort(desc('completed_at')).map(c => ({
  id: c.id, completed_at: c.completed_at,
  material: pick(S.materials.find(m => m.id === c.material_id), ['id', 'title', 'type']),
  user: pick(profile(c.user_id), ['id', 'full_name', 'email', 'role', 'cert_level', 'shift']),
})));

const joinConvo = (c) => ({ id: c.id, name: c.name, is_group: c.is_group, created_at: c.created_at, participants: c.participantIds.map(pid => ({ user: pick(profile(pid), ['id', 'full_name']) })) });
export const getConversations = (userId) => ok(S.conversations.filter(c => c.participantIds.includes(userId)).map(joinConvo));
export const getAllConversations = () => ok([...S.conversations].sort(desc('created_at')).map(joinConvo));
export const getMessages = (cid) => ok(S.messages.filter(m => m.conversation_id === cid).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(m => ({ ...m, sender: pick(profile(m.sender_id), ['id', 'full_name']) })));
export const sendMessage = (cid, senderId, content) => { const m = { id: id('g'), conversation_id: cid, sender_id: senderId, content, created_at: now(), edited_at: null }; S.messages.push(m); return ok(m); };
export const createConversation = (name, isGroup, createdBy, participantIds) => {
  const c = { id: id('cv'), name, is_group: isGroup, created_by: createdBy, created_at: now(), participantIds };
  S.conversations.push(c);
  return ok(c);
};
export const markConversationRead = (userId, cid) => {
  const r = S.reads.find(x => x.user_id === userId && x.conversation_id === cid);
  if (r) r.last_read_at = now(); else S.reads.push({ user_id: userId, conversation_id: cid, last_read_at: now() });
  return Promise.resolve({ error: null });
};
export const getUnreadCount = (userId) => {
  const count = S.conversations.filter(c => c.participantIds.includes(userId)).reduce((n, c) => {
    const last = S.reads.find(r => r.user_id === userId && r.conversation_id === c.id)?.last_read_at || '1970-01-01';
    return n + S.messages.filter(m => m.conversation_id === c.id && m.sender_id !== userId && m.created_at > last).length;
  }, 0);
  return Promise.resolve({ count });
};
export const updateMessage = (mid, content) => { const m = S.messages.find(x => x.id === mid); Object.assign(m || {}, { content, edited_at: now() }); return ok(m); };
export const deleteConversation = (cid) => {
  S.messages = S.messages.filter(m => m.conversation_id !== cid);
  S.conversations = S.conversations.filter(c => c.id !== cid);
  return Promise.resolve({ error: null });
};
export const updateConversation = (cid, updates) => { const c = S.conversations.find(x => x.id === cid); Object.assign(c || {}, updates); return ok(c && joinConvo(c)); };

export const getDashboardStats = () => {
  const live = S.orientees.filter(o => !o.is_archived);
  const active = live.filter(o => o.status !== 'cleared');
  const pct = (o) => (o.hours_completed / ((o.total_hours || 96) + (o.hours_adjustment || 0))) * 100;
  return Promise.resolve({
    activeOrientees: active.length,
    atRiskCount: live.filter(o => o.status === 'at-risk' || o.status === 'extended').length,
    pendingClearance: live.filter(o => o.status === 'pending-clearance').length,
    avgProgress: active.length ? Math.round(active.reduce((a, o) => a + pct(o), 0) / active.length) : 0,
  });
};

export const uploadProfilePicture = (userId, file) => {
  const p = profile(userId);
  if (p) p.avatar_url = URL.createObjectURL(file);
  return ok(p);
};
export const sendEvaluationEmail = () => Promise.resolve({ success: true, data: null });
