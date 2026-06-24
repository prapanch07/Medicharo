import { useState, useContext, useId } from 'react';
import { UserContext } from '../App';
import { signInWithGoogle, ensureUserDoc } from '../firebase';
import Modal from './Modal';

export default function LoginModal({ onClose, onSuccess }) {
  const { setUser } = useContext(UserContext);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const titleId = useId();

  const handleSuccess = (u) => {
    const usr = u ? { uid: u.uid, name: u.displayName || 'User', email: u.email, photo: u.photoURL } : null;
    setUser(usr);
    if (usr) ensureUserDoc(usr);
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
    <Modal onClose={onClose} labelledBy={titleId}>
      <div className="modal-header">
        <div id={titleId} className="modal-title">🔐 Sign In Required</div>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="modal-body">
        <div className="alert alert-info">💡 You need to sign in to continue with this action.</div>
        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn btn-outline btn-lg btn-full" onClick={handleGoogle} disabled={loading} style={{ justifyContent: 'center', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: '1.25rem' }}>G</span> Continue with Google
        </button>
      </div>
    </Modal>
  );
}
