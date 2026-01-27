import React, { useState, useEffect } from 'react';
import { onAuthStateChange, getCurrentUser } from './lib/supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') setUser(session?.user || null);
      else if (event === 'SIGNED_OUT') setUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    try { setUser(await getCurrentUser()); } 
    catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#0f172a,#1e293b)'}}>
      <div style={{width:'40px',height:'40px',border:'3px solid rgba(255,255,255,0.1)',borderTopColor:'#3b82f6',borderRadius:'50%',animation:'spin 1s linear infinite'}}></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return user ? <Dashboard user={user} onLogout={() => setUser(null)} /> : <Login onLogin={setUser} />;
}

export default App;
