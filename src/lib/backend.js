// Single switch between the real Supabase backend and the in-memory demo.
// Components import `db` and the auth functions from here, never from
// ./database or ./supabase directly.
import * as realDb from './database';
import * as demoDb from './demo/database';
import * as realAuth from './supabase';
import { DEMO_LOGINS } from './demo/data';

export const DEMO = process.env.REACT_APP_DEMO === 'true';
export const CONFIGURED = Boolean(process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY);

const KEY = 'arems-demo-user';
const session = {
  get: () => { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } },
  set: (v) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch (e) { /* storage blocked */ } },
};
const demoUser = (id) => {
  const p = demoDb.demoProfile(id);
  return p ? { id: p.id, email: p.email } : null;
};

const demoAuth = {
  signIn: async (email) => {
    const all = (await demoDb.getAllProfiles()).data;
    const match = all.find(p => p.email === String(email).toLowerCase().trim());
    if (!match) return { data: null, error: new Error('Demo mode: pick one of the roles below.') };
    session.set(match.id);
    return { data: { user: demoUser(match.id) }, error: null };
  },
  signUp: async () => ({ data: null, error: new Error('Sign-up is turned off in demo mode.') }),
  signOut: async () => { session.set(null); return { error: null }; },
  getCurrentUser: async () => demoUser(session.get()),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
};

export const demoSignIn = (id) => { session.set(id); return demoUser(id); };
export { DEMO_LOGINS };

export const db = DEMO ? demoDb : realDb;
const auth = DEMO ? demoAuth : realAuth;
export const { signIn, signUp, signOut, getCurrentUser, onAuthStateChange } = auth;
