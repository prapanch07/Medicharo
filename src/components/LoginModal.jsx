import { useState, useContext } from 'react';
import { UserContext } from '../App';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../firebase';

export default function LoginModal({ onClose, onSuccess }) {
  const { setUser } = useContext(UserContext);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSuccess = (u) => {
    setUser(u ? { uid: u.uid, name: u.displayName || 'User', email: u.email, photo: u.photoURL } : null);
    onSuccess?.();
  };

  const handleGoogle = async () => {
    setLoading(true); setError('');
    try {
      const res = await signInWithGoogle();
      handleSuccess(res.user);
    } catch (e) { setError(e.message); setLoading(false); }
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) { setError('Please enter email and password.'); return; }
    setLoading(true); setError('');
    try {
      const res = await signInWithEmail(email, password);
      handleSuccess(res.user);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        try {
          const res = await signUpWithEmail(email, password, email.split('@')[0]);
          handleSuccess(res.user);
        } catch (e2) { setError(e2.message); setLoading(false); }
      } else { setError(e.message); setLoading(false); }
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) { setError('Enter email and password to sign up.'); return; }
    setLoading(true); setError('');
    try {
      const res = await signUpWithEmail(email, password, email.split('@')[0]);
      handleSuccess(res.user);
    } catch (e) { setError(e.message); setLoading(false); }
  };

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">🔐 Sign In Required</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-info">💡 You need to sign in to continue with this action.</div>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-outline btn-lg btn-full" onClick={handleGoogle} disabled={loading} style={{ justifyContent: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <span style={{ fontSize: '1.25rem' }}>G</span> Continue with Google
          </button>
          <div className="divider-line" style={{ marginBottom: 'var(--space-4)' }}>— or —</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <input className="form-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input className="form-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <button className="btn btn-primary btn-full" onClick={handleEmailSignIn} disabled={loading}>Sign In</button>
            <button className="btn-ghost" onClick={handleSignUp} disabled={loading} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-primary)', textAlign: 'center' }}>Don't have an account? Sign up</button>
          </div>
        </div>
      </div>
    </div>
  );
}