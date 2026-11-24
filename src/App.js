import React, { useState, useEffect } from 'react';
import { onAuthStateChange, getCurrentUser, DEMO, CONFIGURED } from './lib/backend';
import { useTheme } from './lib/theme';
import { FeedbackProvider } from './components/ui';
import { Icons } from './components/Icons';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const Splash = ({ children }) => (
  <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>{children}</div>
);

const SetupNeeded = () => (
  <Splash>
    <div className="card" style={{ maxWidth: 460, padding: 28 }}>
      <h1 className="page-title">Setup needed</h1>
      <p className="page-sub">
        This build has no Supabase connection. Set <code>REACT_APP_SUPABASE_URL</code> and <code>REACT_APP_SUPABASE_ANON_KEY</code> (see <code>.env.example</code>),
        or set <code>REACT_APP_DEMO=true</code> to explore with sample data.
      </p>
    </div>
  </Splash>
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, toggleTheme] = useTheme();

  useEffect(() => {
    if (!DEMO && !CONFIGURED) { setLoading(false); return undefined; }
    let active = true;
    getCurrentUser()
      .then(u => { if (active) setUser(u); })
      .catch(e => console.error(e))
      .finally(() => { if (active) setLoading(false); });
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') setUser(session?.user || null);
      else if (event === 'SIGNED_OUT') setUser(null);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  if (loading) return <Splash><Icons.Loader size={30} className="spin" color="var(--brand-fg)" /></Splash>;
  if (!DEMO && !CONFIGURED) return <SetupNeeded />;

  return (
    <FeedbackProvider>
      {user
        ? <Dashboard user={user} onLogout={() => setUser(null)} theme={theme} onToggleTheme={toggleTheme} />
        : <Login onLogin={setUser} />}
    </FeedbackProvider>
  );
}

export default App;
