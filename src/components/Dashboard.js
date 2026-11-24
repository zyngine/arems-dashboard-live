// The signed-in application: loads data, owns every write, and routes between
// views. Views are presentational and receive everything through `ctx`.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { db, signOut, DEMO } from '../lib/backend';
import { hasRole, primaryRole } from '../lib/roles';
import { getPhase, oName } from '../lib/format';
import { useStoredFlag } from '../lib/theme';
import { Card, SkeletonRows, cx, useFeedback } from './ui';
import { CommandPalette, MobileNav, Sidebar, Topbar, allowedViews } from './Shell';
import { EvalForm, FTOEvalForm, HoursAdjustForm, OrienteeForm, TaskForm, TrainingForm } from './forms';
import DashboardView from './views/DashboardView';
import OrienteesView, { OrienteeDrawer } from './views/OrienteesView';
import EvaluationsView, { EvalDetailModal } from './views/EvaluationsView';
import TrainingView from './views/TrainingView';
import CompletionReport from './views/CompletionReport';
import TasksView from './views/TasksView';
import MessagesView from './views/MessagesView';
import FTOFeedbackView, { FTOEvalDetailModal } from './views/FTOFeedbackView';
import FTOQueueView from './views/FTOQueueView';
import RecordsView from './views/RecordsView';
import AdminView from './views/AdminView';

const VIEWS = {
  dashboard: DashboardView, orientees: OrienteesView, evaluations: EvaluationsView, training: TrainingView,
  completions: CompletionReport, tasks: TasksView, messages: MessagesView, 'fto-feedback': FTOFeedbackView,
  'fto-queue': FTOQueueView, records: RecordsView, admin: AdminView,
};

// The current view lives in the URL hash so refresh and the back button work.
const readHash = () => window.location.hash.replace(/^#\/?/, '') || 'dashboard';
const useHashView = () => {
  const [view, setView] = useState(readHash);
  useEffect(() => {
    const onChange = () => setView(readHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const go = useCallback((next) => { window.location.hash = '/' + next; window.scrollTo(0, 0); }, []);
  return [view, go];
};

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const blankToNull = (v) => (v === '' || v === undefined ? null : v);

export default function Dashboard({ user, onLogout, theme, onToggleTheme }) {
  const feedback = useFeedback();
  const [hashView, go] = useHashView();
  const [collapsed, setCollapsed] = useStoredFlag('arems-sidebar-collapsed', false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null); // { name, payload }
  const [drawerId, setDrawerId] = useState(null);

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
  const [ftoEvaluations, setFTOEvaluations] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [stats, setStats] = useState({ activeOrientees: 0, atRiskCount: 0, pendingClearance: 0, avgProgress: 0 });

  const refreshUnread = useCallback(async () => {
    const { count } = await db.getUnreadCount(user.id);
    setUnread(count || 0);
  }, [user.id]);

  const loadMessages = useCallback(async () => {
    try {
      const { data: convos } = await db.getConversations(user.id);
      const threads = await Promise.all((convos || []).filter(Boolean).slice(0, 3).map(c => db.getMessages(c.id)));
      const latest = threads.flatMap(t => (t.data || []).slice(-3)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setRecentMessages(latest.slice(0, 5));
      await refreshUnread();
    } catch (e) { console.error('Messages load error', e); }
  }, [user.id, refreshUnread]);

  // Core data. Only the first call shows skeletons; later calls refresh in place
  // so a save does not blank the whole screen.
  const load = useCallback(async () => {
    try {
      const [pr, or, ev, ft, ta, ma, al, st, ftoEv, mc] = await Promise.all([
        db.getUserProfile(user.id), db.getOrientees(), db.getEvaluations(), db.getFTOs(), db.getTasks(), db.getTrainingMaterials(),
        db.getAllProfiles(), db.getDashboardStats(), db.getFTOEvaluations(), db.getTrainingCompletions(user.id),
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
      setCompletions(mc.data || []);
      if (pr.error) feedback.error('Could not load your profile. Try refreshing.');

      // hasRole, not the derived primary role: someone with ['fto','orientee']
      // resolves to 'fto' and would never load their own orientee record.
      if (hasRole(pr.data, 'orientee')) {
        const { data: mo } = await db.getOrienteeByUserId(user.id);
        setMyOrientee(mo || null);
        if (mo) { const { data: mt } = await db.getTasksByOrientee(mo.id); setMyTasks(mt || []); }
      }
    } catch (e) {
      console.error(e);
      feedback.error('Some data could not be loaded. Check your connection and refresh.');
    }
    setLoading(false);
  }, [user.id, feedback]);

  useEffect(() => { load(); loadMessages(); }, [load, loadMessages]);

  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(o => !o); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const role = primaryRole(profile?.roles) || profile?.role || 'employee';
  const view = allowedViews(role).includes(hashView) ? hashView : 'dashboard';

  const closeModal = useCallback(() => setModal(null), []);
  const open = useCallback((name, payload) => {
    if (name === 'orientee') setDrawerId(payload.id); else setModal({ name, payload });
  }, []);

  // Runs a write, reloads, and reports the outcome. Resolves true on success.
  const run = useCallback(async (op, okMessage) => {
    setSaving(true);
    try {
      const result = await op();
      if (result?.error) throw result.error;
      await load();
      if (okMessage) feedback.success(okMessage);
      return true;
    } catch (e) {
      console.error(e);
      feedback.error(e?.message || 'Something went wrong. Nothing was saved.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [load, feedback]);

  const actions = useMemo(() => ({
    saveOrientee: async (f, existing) => {
      const shared = {
        temp_name: f.full_name, temp_email: f.email, temp_phone: f.phone, cert_level: f.cert_level, shift: f.shift, station: f.station,
        lead_fto_id: blankToNull(f.lead_fto_id), start_date: blankToNull(f.start_date), tentative_clear_date: blankToNull(f.tentative_clear_date),
      };
      const ok = existing
        ? await run(() => db.updateOrientee(existing.id, { ...shared, status: f.status, orientation_book_url: f.orientation_book_url }), 'Orientee updated.')
        : await run(() => db.createOrientee({ ...shared, status: 'on-track', hours_completed: 0, total_hours: 96 }), `${f.full_name} added.`);
      if (ok) closeModal();
    },

    saveEval: async (f) => {
      const orientee = orientees.find(o => o.id === f.orientee_id);
      const ok = await run(() => db.createEvaluation({ ...f, evaluator_id: user.id, phase: getPhase(orientee?.hours_completed || 0) }), 'Evaluation submitted.');
      if (!ok) return;
      closeModal();
      // Tell the lead FTO when someone else evaluated their orientee.
      const lead = orientee?.lead_fto_id && orientee.lead_fto_id !== user.id ? profiles.find(p => p.id === orientee.lead_fto_id) : null;
      if (lead?.email) {
        db.sendEvaluationEmail({ to: lead.email, toName: lead.full_name, orienteeName: oName(orientee), evaluatorName: profile?.full_name, shiftDate: f.shift_date, rating: f.overall_rating })
          .catch(e => console.error('Email notification failed', e));
      }
    },

    saveFTOEval: async (f) => { if (await run(() => db.createFTOEvaluation({ ...f, orientee_id: myOrientee.id }), 'Thanks — your feedback was sent.')) closeModal(); },

    saveTask: async (f) => { if (await run(() => db.createTask({ ...f, due_date: blankToNull(f.due_date), assigned_by: user.id }), 'Task created.')) closeModal(); },

    verifyTask: (t) => feedback.confirm({
      title: 'Verify task?', confirmLabel: 'Verify',
      message: `Confirm you have seen “${t.title}” completed. This cannot be undone here.`,
      onConfirm: () => run(() => db.verifyTask(t.id, user.id), 'Task verified.'),
    }),

    saveTraining: async (f, existing) => {
      const ok = existing
        ? await run(() => db.updateTrainingMaterial(existing.id, f), 'Training updated.')
        : await run(() => db.createTrainingMaterial({ ...f, uploaded_by: user.id }), 'Training added.');
      if (ok) closeModal();
    },

    completeTraining: (m) => feedback.confirm({
      title: 'Mark as complete?', confirmLabel: 'Mark complete',
      message: `This records that you finished “${m.title}” today. Your completion is visible to administrators.`,
      onConfirm: () => run(() => db.markTrainingComplete(user.id, m.id, myOrientee?.id || null), 'Marked complete.'),
    }),

    adjustHours: async (o, updates) => { if (await run(() => db.updateOrientee(o.id, { ...updates, adjusted_by: user.id }), 'Hours adjusted.')) closeModal(); },

    setStatus: (o, status) => {
      const save = () => run(() => db.updateOrientee(o.id, { status }), 'Status updated.');
      if (status !== 'cleared') return save();
      return feedback.confirm({
        title: `Clear ${oName(o)}?`, confirmLabel: 'Mark cleared',
        message: 'They leave the active roster and their lead FTO moves to the bottom of the rotation queue.',
        onConfirm: save,
      });
    },

    archiveOrientee: (o, after) => feedback.confirm({
      title: `Archive ${oName(o)}?`, tone: 'danger', confirmLabel: 'Archive',
      message: 'They are hidden from active views. Evaluations and tasks stay in Records, and you can restore them from Admin.',
      onConfirm: async () => { if (await run(() => db.deleteOrientee(o.id), 'Orientee archived.')) after?.(); },
    }),

    restoreOrientee: (o) => run(() => db.updateOrientee(o.id, { is_archived: false, archived_at: null }), `${oName(o)} restored.`),

    setRoles: (p, roles) => {
      if (roles.length === 0) return feedback.error('Everyone needs at least one role.');
      const save = () => run(() => db.setUserRoles(p.id, roles), 'Roles updated.');
      // Guard against an admin locking themselves out with one click.
      if (p.id === user.id && !roles.includes('admin')) {
        return feedback.confirm({ title: 'Remove your own admin role?', tone: 'danger', confirmLabel: 'Remove', message: 'You will lose access to Admin immediately and need another admin to restore it.', onConfirm: save });
      }
      return save();
    },

    setCert: (p, cert) => run(() => db.setUserCertLevel(p.id, cert), 'Certification updated.'),

    uploadPhoto: async (file) => {
      if (!file.type.startsWith('image/')) return feedback.error('Choose an image file.');
      if (file.size > MAX_PHOTO_BYTES) return feedback.error('That photo is over 5 MB. Choose a smaller one.');
      const { data, error } = await db.uploadProfilePicture(user.id, file);
      if (error) return feedback.error('Photo not uploaded: ' + error.message);
      if (data) setProfile(p => ({ ...p, avatar_url: data.avatar_url }));
      return feedback.success('Photo updated.');
    },
  }), [run, closeModal, feedback, orientees, profiles, profile, myOrientee, user.id]);

  const logout = async () => { await signOut(); onLogout(); };

  const ctx = {
    user, profile, role, loading, saving, orientees, evaluations, ftos, profiles, tasks, materials, completions,
    myTasks, myOrientee, ftoEvaluations, recentMessages, unread, stats, go, open, actions, refreshUnread,
  };
  const View = VIEWS[view];
  const drawerOrientee = drawerId && orientees.find(o => o.id === drawerId);
  const m = modal?.name, payload = modal?.payload;

  return (
    <div className="app">
      <Sidebar view={view} onNavigate={go} role={role} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(c => !c)} open={menuOpen} onClose={() => setMenuOpen(false)} unread={unread} />
      <div className={cx('main', collapsed && 'collapsed')}>
        {DEMO && <div className="demo-banner">Demo mode · sample data · changes reset when you reload</div>}
        <Topbar profile={profile} role={role} unread={unread} theme={theme} onToggleTheme={onToggleTheme} onOpenMenu={() => setMenuOpen(true)}
          onOpenSearch={() => setPaletteOpen(true)} onOpenMessages={() => go('messages')} onLogout={logout} onUploadPhoto={actions.uploadPhoto} />
        {!profile && loading
          ? <div className="page"><Card><SkeletonRows rows={6} /></Card></div>
          : <View key={view} ctx={ctx} />}
      </div>
      <MobileNav view={view} onNavigate={go} role={role} unread={unread} onOpenMenu={() => setMenuOpen(true)} />

      {drawerOrientee && <OrienteeDrawer orientee={drawerOrientee} ctx={ctx} onClose={() => setDrawerId(null)} />}

      {m === 'addOrientee' && <OrienteeForm ftos={ftos} loading={saving} onClose={closeModal} onSave={f => actions.saveOrientee(f)} />}
      {m === 'editOrientee' && <OrienteeForm orientee={payload} ftos={ftos} loading={saving} onClose={closeModal} onSave={f => actions.saveOrientee(f, payload)} />}
      {m === 'adjustHours' && <HoursAdjustForm orientee={payload} loading={saving} onClose={closeModal} onSave={u => actions.adjustHours(payload, u)} />}
      {m === 'addEval' && <EvalForm orientees={orientees} initialOrienteeId={payload?.orienteeId} loading={saving} onClose={closeModal} onSave={actions.saveEval} />}
      {m === 'addFTOEval' && myOrientee && <FTOEvalForm ftos={ftos} defaultFtoId={myOrientee.lead_fto_id} loading={saving} onClose={closeModal} onSave={actions.saveFTOEval} />}
      {m === 'addTask' && <TaskForm orientees={orientees} initialOrienteeId={payload?.orienteeId} loading={saving} onClose={closeModal} onSave={actions.saveTask} />}
      {m === 'training' && <TrainingForm material={payload} loading={saving} onClose={closeModal} onSave={f => actions.saveTraining(f, payload)} />}
      {m === 'eval' && <EvalDetailModal evaluation={payload} role={role} onClose={closeModal} />}
      {m === 'ftoEval' && <FTOEvalDetailModal evaluation={payload} onClose={closeModal} />}

      {paletteOpen && <CommandPalette role={role} orientees={orientees.filter(o => !o.is_archived)} materials={materials} profiles={profiles}
        onClose={() => setPaletteOpen(false)} onNavigate={go} onSelectOrientee={o => open('orientee', o)} />}
    </div>
  );
}
