import { useState, useContext } from 'react';
import { UserContext } from '../App';
import { signInWithGoogle } from '../firebase';

export default function LoginModal({ onClose, onSuccess }) {
  const { setUser } = useContext(UserContext);
  const [error, setError] = useState('');
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
          <button className="btn btn-outline btn-lg btn-full" onClick={handleGoogle} disabled={loading} style={{ justifyContent: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: '1.25rem' }}>G</span> Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}