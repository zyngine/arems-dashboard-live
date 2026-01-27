import React, { useState } from 'react';
import { signIn, signUp } from '../lib/supabase';
import { linkOrienteeByEmail } from '../lib/database';
import { Icons } from './Icons';

export default function Login({ onLogin }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '', fullName: '', phone: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isSignUp) {
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        const { data, error } = await signUp(formData.email, formData.password, {
          full_name: formData.fullName,
          phone: formData.phone
        });
        if (error) throw error;
        if (data?.user) {
          // Try to link to existing orientee record by email
          const linkResult = await linkOrienteeByEmail(data.user.id, formData.email);
          console.log('Link result:', linkResult);
          if (linkResult.linked) {
            alert('Account created and linked to your orientee profile! You can now log in.');
          } else if (linkResult.reason === 'already_linked') {
            alert('Account created! Note: An orientee with this email was already linked to another account.');
          } else if (linkResult.reason === 'update_failed') {
            alert('Account created! Note: Could not auto-link to orientee profile. Error: ' + (linkResult.error?.message || 'Unknown'));
          } else {
            alert('Account created! You can now log in.');
          }
          setIsSignUp(false);
        }
      } else {
        const { data, error } = await signIn(formData.email, formData.password);
        if (error) throw error;
        if (data?.user) onLogin(data.user);
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 14px 14px 48px',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    fontSize: '15px',
    boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.9)'
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(145deg, #1a365d 0%, #2d3748 50%, #1a202c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '100px', height: '100px', margin: '0 auto 20px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.3)' }}>
            <img src="/logo.jpg" alt="Adams Regional EMS" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h1 style={{ color: 'white', fontSize: '26px', fontWeight: '700', margin: '0 0 6px 0' }}>Adams Regional EMS</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px', margin: 0 }}>Training Management System</p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderRadius: '24px', padding: '36px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '600', color: '#1a202c', margin: '0 0 6px 0', textAlign: 'center' }}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p style={{ color: '#64748b', textAlign: 'center', margin: '0 0 28px 0', fontSize: '14px' }}>
            {isSignUp ? 'Sign up to get started' : 'Sign in to continue'}
          </p>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Icons.AlertCircle size={18} color="#dc2626" />
              <span style={{ color: '#991b1b', fontSize: '13px' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {isSignUp && (
              <>
                <div style={{ marginBottom: '16px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}>
                    <Icons.User size={20} color="#94a3b8" />
                  </div>
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required placeholder="Full Name" style={inputStyle} />
                </div>
                <div style={{ marginBottom: '16px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}>
                    <Icons.Phone size={20} color="#94a3b8" />
                  </div>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Phone Number" style={inputStyle} />
                </div>
              </>
            )}
            <div style={{ marginBottom: '16px', position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}>
                <Icons.Mail size={20} color="#94a3b8" />
              </div>
              <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="Email Address" style={inputStyle} />
            </div>
            <div style={{ marginBottom: '16px', position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}>
                <Icons.Lock size={20} color="#94a3b8" />
              </div>
              <input type="password" name="password" value={formData.password} onChange={handleChange} required placeholder="Password" style={inputStyle} />
            </div>
            {isSignUp && (
              <div style={{ marginBottom: '20px', position: 'relative' }}>
                <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}>
                  <Icons.Lock size={20} color="#94a3b8" />
                </div>
                <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required placeholder="Confirm Password" style={inputStyle} />
              </div>
            )}
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '16px', background: loading ? '#94a3b8' : 'linear-gradient(135deg, #1e40af, #1a365d)', color: 'white', border: 'none', borderRadius: '14px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: loading ? 'none' : '0 6px 20px rgba(30,64,175,0.3)' }}>
              {loading && <Icons.Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />}
              {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>
          <div style={{ marginTop: '24px', textAlign: 'center', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
            <span style={{ color: '#64748b', fontSize: '14px' }}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            </span>
            <button onClick={() => { setIsSignUp(!isSignUp); setError(''); setFormData({ email: '', password: '', confirmPassword: '', fullName: '', phone: '' }); }} style={{ background: 'none', border: 'none', color: '#1e40af', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginLeft: '6px' }}>
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textAlign: 'center', marginTop: '24px' }}>Adams Regional EMS © 2024</p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } input:focus { border-color: #1e40af; outline: none; box-shadow: 0 0 0 3px rgba(30,64,175,0.15); }`}</style>
    </div>
  );
}
