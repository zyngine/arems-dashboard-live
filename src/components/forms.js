// Every create/edit dialog. Each form owns its draft state and hands a plain
// object to onSave; persistence and error handling live in Dashboard.js.
import React, { useState } from 'react';
import { Icons } from './Icons';
import { Button, Field, Modal, RatingInput, cx } from './ui';
import { CERT_LEVELS } from '../lib/roles';
import { STATUSES, isActiveOrientee, oEmail, oName, oPhone, todayISO } from '../lib/format';

const SHIFTS = ['A Shift', 'B Shift', 'C Shift', 'Part-Time'];
const STATIONS = ['54-1', '54-2', '54-3', '54-4'];
const DAILY_TASKS = ['Truck Check', 'Equipment', 'Patient Assessment', 'Documentation', 'Radio Comms', 'Protocols', 'Scene Safety', 'Lifting'];

const Options = ({ values }) => values.map(v => <option key={v}>{v}</option>);
const Actions = ({ onClose, loading, label }) => (
  <div className="form-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={loading}>{label}</Button></div>
);
// Controlled-input helper: bind('email') -> { value, onChange }.
const useDraft = (initial) => {
  const [f, setF] = useState(initial);
  const bind = (key) => ({ value: f[key] ?? '', onChange: e => setF(d => ({ ...d, [key]: e.target.value })) });
  return [f, setF, bind];
};

export const OrienteeForm = ({ orientee, ftos, loading, onClose, onSave }) => {
  const editing = Boolean(orientee);
  const [f, , bind] = useDraft({
    full_name: editing ? oName(orientee) : '', email: oEmail(orientee), phone: oPhone(orientee),
    cert_level: orientee?.cert_level || 'EMT', shift: orientee?.shift || 'A Shift', station: orientee?.station || '54-1',
    lead_fto_id: orientee?.lead_fto_id || '', status: orientee?.status || 'on-track',
    start_date: orientee?.start_date || todayISO(), tentative_clear_date: orientee?.tentative_clear_date || '',
    orientation_book_url: orientee?.orientation_book_url || '',
  });
  return (
    <Modal onClose={onClose} title={editing ? 'Edit orientee' : 'Add orientee'} width={540}>
      <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
        <Field label="Full name"><input className="input" required {...bind('full_name')} /></Field>
        <div className="form-grid">
          <Field label="Email" hint={editing ? undefined : 'Their account links automatically when they sign up with this email.'}><input className="input" type="email" required {...bind('email')} /></Field>
          <Field label="Phone"><input className="input" type="tel" {...bind('phone')} /></Field>
          <Field label="Certification"><select className="select" {...bind('cert_level')}><Options values={CERT_LEVELS} /></select></Field>
          <Field label="Lead FTO"><select className="select" required={!editing} {...bind('lead_fto_id')}><option value="">Select…</option>{ftos.map(x => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select></Field>
          <Field label="Shift"><select className="select" {...bind('shift')}><Options values={SHIFTS} /></select></Field>
          <Field label="Station"><select className="select" {...bind('station')}><Options values={STATIONS} /></select></Field>
          <Field label="Start date"><input className="input" type="date" {...bind('start_date')} /></Field>
          <Field label="Tentative clear date"><input className="input" type="date" {...bind('tentative_clear_date')} /></Field>
        </div>
        {editing && (
          <>
            <Field label="Status"><select className="select" {...bind('status')}>{Object.entries(STATUSES).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}</select></Field>
            <Field label="Orientation book link"><input className="input" type="url" placeholder="https://docs.google.com/…" {...bind('orientation_book_url')} /></Field>
          </>
        )}
        <Actions onClose={onClose} loading={loading} label={editing ? 'Save changes' : 'Add orientee'} />
      </form>
    </Modal>
  );
};

export const EvalForm = ({ orientees, initialOrienteeId, loading, onClose, onSave }) => {
  const [f, setF, bind] = useDraft({ orientee_id: initialOrienteeId || '', shift_date: todayISO(), shift_type: 'Day', station: '54-1', hours_logged: 12, overall_rating: 4, strengths: '', improvements: '', daily_tasks: [] });
  const toggle = (t) => setF(d => ({ ...d, daily_tasks: d.daily_tasks.includes(t) ? d.daily_tasks.filter(x => x !== t) : [...d.daily_tasks, t] }));
  return (
    <Modal onClose={onClose} title="New shift evaluation" width={560}>
      <form onSubmit={e => { e.preventDefault(); onSave({ ...f, hours_logged: parseInt(f.hours_logged, 10) || 0 }); }}>
        <Field label="Orientee">
          <select className="select" required {...bind('orientee_id')}>
            <option value="">Select…</option>
            {orientees.filter(isActiveOrientee).map(o => <option key={o.id} value={o.id}>{oName(o)} ({o.cert_level})</option>)}
          </select>
        </Field>
        <div className="form-grid four">
          <Field label="Date"><input className="input" type="date" required max={todayISO()} {...bind('shift_date')} /></Field>
          <Field label="Shift"><select className="select" {...bind('shift_type')}><Options values={['Day', 'Night']} /></select></Field>
          <Field label="Station"><select className="select" {...bind('station')}><Options values={STATIONS} /></select></Field>
          <Field label="Hours"><input className="input" type="number" required min="1" max="24" {...bind('hours_logged')} /></Field>
        </div>
        <div className="field"><span className="label">Overall rating</span><RatingInput label="Overall rating" value={f.overall_rating} onChange={r => setF(d => ({ ...d, overall_rating: r }))} /></div>
        <div className="field">
          <span className="label">Covered this shift</span>
          <div className="chips">
            {DAILY_TASKS.map(t => { const on = f.daily_tasks.includes(t); return <button key={t} type="button" aria-pressed={on} className={cx('chip', on && 'on ok')} onClick={() => toggle(t)}>{on && <Icons.Check size={13} />}{t}</button>; })}
          </div>
        </div>
        <Field label="Strengths"><textarea className="textarea" rows={2} placeholder="What went well?" {...bind('strengths')} /></Field>
        <Field label="Areas for improvement"><textarea className="textarea" rows={2} placeholder="What should they work on next shift?" {...bind('improvements')} /></Field>
        <Actions onClose={onClose} loading={loading} label="Submit evaluation" />
      </form>
    </Modal>
  );
};

const FTO_RATINGS = [['overall_rating', 'Overall'], ['communication_rating', 'Communication'], ['teaching_rating', 'Teaching'], ['support_rating', 'Support']];

export const FTOEvalForm = ({ ftos, defaultFtoId, loading, onClose, onSave }) => {
  const [f, setF, bind] = useDraft({ fto_id: defaultFtoId || '', shift_date: todayISO(), overall_rating: 4, communication_rating: 4, teaching_rating: 4, support_rating: 4, feedback: '' });
  return (
    <Modal onClose={onClose} title="Rate your FTO">
      <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
        <div className="callout tone-brand" style={{ marginBottom: 14 }}><Icons.Shield size={17} /><div>Your FTO sees only their overall average. Written feedback goes to administrators.</div></div>
        <div className="form-grid">
          <Field label="FTO"><select className="select" required {...bind('fto_id')}><option value="">Select…</option>{ftos.map(x => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select></Field>
          <Field label="Shift date"><input className="input" type="date" max={todayISO()} {...bind('shift_date')} /></Field>
        </div>
        <div className="form-grid">
          {FTO_RATINGS.map(([key, label]) => (
            <div className="field" key={key}><span className="label">{label}</span><RatingInput label={label} value={f[key]} onChange={r => setF(d => ({ ...d, [key]: r }))} /></div>
          ))}
        </div>
        <Field label="Feedback"><textarea className="textarea" rows={3} placeholder="What helped you learn? What could be better?" {...bind('feedback')} /></Field>
        <Actions onClose={onClose} loading={loading} label="Submit" />
      </form>
    </Modal>
  );
};

export const TaskForm = ({ orientees, initialOrienteeId, loading, onClose, onSave }) => {
  const [f, , bind] = useDraft({ title: '', description: '', assigned_to: initialOrienteeId || '', due_date: '' });
  return (
    <Modal onClose={onClose} title="New task">
      <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
        <Field label="Title"><input className="input" required placeholder="e.g. Stair chair sign-off" {...bind('title')} /></Field>
        <Field label="Details"><textarea className="textarea" rows={2} {...bind('description')} /></Field>
        <div className="form-grid">
          <Field label="Assign to"><select className="select" required {...bind('assigned_to')}><option value="">Select…</option>{orientees.filter(isActiveOrientee).map(o => <option key={o.id} value={o.id}>{oName(o)}</option>)}</select></Field>
          <Field label="Due date"><input className="input" type="date" {...bind('due_date')} /></Field>
        </div>
        <Actions onClose={onClose} loading={loading} label="Create task" />
      </form>
    </Modal>
  );
};

export const TrainingForm = ({ material, loading, onClose, onSave }) => {
  const [f, , bind] = useDraft({ title: material?.title || '', description: material?.description || '', type: material?.type || 'video', url: material?.url || '' });
  return (
    <Modal onClose={onClose} title={material ? 'Edit training' : 'Add training'}>
      <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
        <Field label="Title"><input className="input" required {...bind('title')} /></Field>
        <Field label="Description"><textarea className="textarea" rows={2} placeholder="One line on what this covers and why it matters." {...bind('description')} /></Field>
        <div className="form-grid">
          <Field label="Type"><select className="select" {...bind('type')}><option value="video">Video</option><option value="document">Document</option><option value="powerpoint">Slides</option><option value="link">Link</option></select></Field>
          <Field label="Link"><input className="input" type="url" required placeholder="https://…" pattern="https?://.+" title="Starts with http:// or https://" {...bind('url')} /></Field>
        </div>
        <Actions onClose={onClose} loading={loading} label={material ? 'Save changes' : 'Add training'} />
      </form>
    </Modal>
  );
};

export const HoursAdjustForm = ({ orientee, loading, onClose, onSave }) => {
  const [adj, setAdj] = useState(orientee.hours_adjustment || 0);
  const [reason, setReason] = useState(orientee.adjustment_reason || '');
  const base = orientee.total_hours || 96;
  const tone = adj > 0 ? 'var(--warning)' : adj < 0 ? 'var(--success)' : 'var(--text-2)';
  return (
    <Modal onClose={onClose} title={`Adjust hours — ${oName(orientee)}`}>
      <form onSubmit={e => { e.preventDefault(); onSave({ hours_adjustment: adj, adjustment_reason: reason }); }}>
        <div className="tile" style={{ marginBottom: 16 }}>
          <b style={{ fontSize: 30 }}>{base + adj}h</b>
          <span>required in total · base {base}h <strong style={{ color: tone }}>{adj > 0 ? '+' : ''}{adj}h</strong></span>
        </div>
        <Field label="Adjustment">
          <input type="range" min="-24" max="48" step="1" value={adj} onChange={e => setAdj(parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: 'var(--brand)' }} aria-label="Hours adjustment" />
          <span className="row between tiny muted"><span>−24h</span><span>+48h</span></span>
        </Field>
        <Field label="Reason"><textarea className="textarea" rows={2} required={adj !== 0} placeholder="Recorded with the adjustment." value={reason} onChange={e => setReason(e.target.value)} /></Field>
        <Actions onClose={onClose} loading={loading} label="Save" />
      </form>
    </Modal>
  );
};
