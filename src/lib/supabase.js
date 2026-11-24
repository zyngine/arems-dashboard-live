import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// createClient throws on an empty URL, which used to white-screen the whole app
// when the env vars were missing. Fall back to an inert placeholder; App.js shows
// a setup screen instead of ever calling it (see CONFIGURED in ./backend).
export const supabase = createClient(supabaseUrl || 'http://localhost:54321', supabaseAnonKey || 'not-configured');

export const signUp = async (email, password, userData) => {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: userData } });
  return { data, error };
};

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const onAuthStateChange = (callback) => supabase.auth.onAuthStateChange(callback);
