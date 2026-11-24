import React, { useState } from 'react';
import { signIn, signUp, db, DEMO, DEMO_LOGINS, demoSignIn } from '../lib/backend';
import { Icons } from './Icons';
import { Button } from './ui';

const EMPTY = { email: '', password: '', confirmPassword: '', fullName: '', phone: '' };

const POINTS = [
  { icon: Icons.TrendingUp, text: 'Track every orientee from first shift to clearance' },
  { icon: Icons.ClipboardCheck, text: 'Shift evaluations filed from the truck, on any phone' },
  { icon: Icons.GraduationCap, text: 'One training library for the whole agency' },
];

const IconInput = ({ icon: I, reveal, onReveal, ...p }) => (
  <div className="input-icon" style={{ marginBottom: 12 }}>
    <I size={17} />
    <input className="input" {...p} />
    {onReveal && (
      <button type="button" className="reveal" onClick={onReveal} aria-label={reveal ? 'Hide password' : 'Show password'}>
        {reveal ? <Icons.EyeOff size={17} /> : <Icons.Eye size={17} />}
      </button>
    )}
  </div>
);

export default function Login({ onLogin }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reveal, setReveal] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const change = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setError(''); };
  const switchMode = (next) => { setIsSignUp(next); setError(''); setForm(f => ({ ...EMPTY, email: f.email })); };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setNotice('');
    if (isSignUp && form.password !== form.confirmPassword) return setError('Passwords do not match.');
    if (isSignUp && form.password.length < 6) return setError('Password must be at least 6 characters.');
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await signUp(form.email, form.password, { full_name: form.fullName, phone: form.phone });
        if (error) throw error;
        if (data?.user) {
          // New accounts start as plain employees; the role itself is assigned server-side.
          // If an admin already created an orientee record for this email, attach it.
          const link = await db.linkOrienteeByEmail(data.user.id, form.email);
          if (link.linked) setNotice('Account created and linked to your orientee profile. Sign in to continue.');
          else if (link.reason === 'already_linked') setNotice('Account created. An orientee record with this email is already linked to another account — ask an admin to check it.');
          else if (link.reason === 'update_failed') setNotice('Account created, but it could not be linked to your orientee profile. Ask an admin to link it.');
          else setNotice('Account created. Sign in to continue.');
          switchMode(false);
        }
      } else {
        const { data, error } = await signIn(form.email, form.password);
        if (error) throw error;
        if (data?.user) onLogin(data.user);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-hero">
        <div className="row" style={{ gap: 12 }}>
          <img className="auth-logo" src="/logo.jpg" alt="" />
          <div><div style={{ fontWeight: 700, fontSize: 16 }}>Adams Regional EMS</div><div className="side-brand-sub">Training</div></div>
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1>Ready crews start here.</h1>
          <p>Field training, evaluations and continuing education for everyone at Adams Regional — in one place.</p>
          <div className="auth-points">
            {POINTS.map(p => <div className="auth-point" key={p.text}><span><p.icon size={16} /></span>{p.text}</div>)}
          </div>
        </div>
        <div className="tiny" style={{ color: 'rgba(255,255,255,0.5)' }}>© {new Date().getFullYear()} Adams Regional EMS</div>
      </div>

      <div className="auth-panel">
        <div className="auth-form">
          <img className="auth-logo" src="/logo.jpg" alt="Adams Regional EMS" style={{ marginBottom: 18 }} />
          <h2 className="page-title">{isSignUp ? 'Create your account' : 'Sign in'}</h2>
          <p className="page-sub" style={{ marginBottom: 22 }}>{isSignUp ? 'Use your agency email so your records link up.' : 'Welcome back. Enter your details to continue.'}</p>

          {error && <div className="callout tone-danger" role="alert" style={{ marginBottom: 14 }}><Icons.AlertCircle size={17} /><div>{error}</div></div>}
          {notice && <div className="callout tone-success" role="status" style={{ marginBottom: 14 }}><Icons.CheckCircle size={17} /><div>{notice}</div></div>}

          {DEMO ? (
            <>
              <div className="callout tone-accent" style={{ marginBottom: 14 }}><Icons.Info size={17} /><div>Demo mode with sample data. Nothing is saved. Pick a role to look around.</div></div>
              <div className="demo-roles">
                {DEMO_LOGINS.map(r => (
                  <button key={r.id} type="button" className="card clickable" style={{ padding: 14 }} onClick={() => onLogin(demoSignIn(r.id))}>
                    <div className="strong">{r.label}</div><div className="tiny muted">{r.hint}</div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <form onSubmit={submit}>
              {isSignUp && (
                <>
                  <IconInput icon={Icons.User} type="text" name="fullName" value={form.fullName} onChange={change} required placeholder="Full name" autoComplete="name" aria-label="Full name" />
                  <IconInput icon={Icons.Phone} type="tel" name="phone" value={form.phone} onChange={change} placeholder="Phone (optional)" autoComplete="tel" aria-label="Phone" />
                </>
              )}
              <IconInput icon={Icons.Mail} type="email" name="email" value={form.email} onChange={change} required placeholder="Email address" autoComplete="email" aria-label="Email address" />
              <IconInput icon={Icons.Lock} type={reveal ? 'text' : 'password'} name="password" value={form.password} onChange={change} required placeholder="Password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'} aria-label="Password" reveal={reveal} onReveal={() => setReveal(!reveal)} />
              {isSignUp && <IconInput icon={Icons.Lock} type={reveal ? 'text' : 'password'} name="confirmPassword" value={form.confirmPassword} onChange={change} required placeholder="Confirm password" autoComplete="new-password" aria-label="Confirm password" />}
              <Button type="submit" block loading={loading} style={{ height: 44, marginTop: 6 }}>{isSignUp ? 'Create account' : 'Sign in'}</Button>
            </form>
          )}

          {!DEMO && (
            <p className="soft" style={{ marginTop: 20, textAlign: 'center' }}>
              {isSignUp ? 'Already have an account?' : 'New to AREMS Training?'}{' '}
              <button type="button" className="link-btn" onClick={() => switchMode(!isSignUp)}>{isSignUp ? 'Sign in' : 'Create an account'}</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
