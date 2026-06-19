import { useState, useContext } from 'react';
import { UserContext, ToastContext } from '../App';
import { saveUserProfile, getCurrentUser } from '../firebase';

export default function EditProfileModal({ onClose, onSave }) {
  const { user } = useContext(UserContext);
  const showToast = useContext(ToastContext);
  const [name, setName] = useState(user?.name || '');
  const [upiId, setUpiId] = useState(user?.upiId || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    try {
      await saveUserProfile(user.uid, { name: name.trim(), upiId: upiId.trim(), email: user.email, photo: user.photo || '' });
      user.name = name.trim();
      user.upiId = upiId.trim();
      showToast('Profile updated! ✨', 'success');
      onSave?.();
      onClose();
    } catch (e) { setError(e.message); setSaving(false); }
  };

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">✏️ Edit Profile</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-error-light)', color: 'var(--color-error-dark)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>{error}</div>}
          <div className="donate-form">
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">UPI ID</label>
              <input className="form-input" placeholder="yourname@upi" value={upiId} onChange={e => setUpiId(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '⏳ Saving...' : '💾 Save'}</button>
        </div>
      </div>
    </div>
  );
}
