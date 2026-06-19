import { useState, useContext } from 'react';
import { ToastContext } from '../App';
import { submitReport } from '../firebase';

export default function ReportModal({ contributionId, wishlistId, onClose }) {
  const showToast = useContext(ToastContext);
  const [reason, setReason] = useState('');
  const [screenshot, setScreenshot] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) { setScreenshot(''); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshot(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!reason.trim()) { setError('Please describe the issue.'); return; }
    setSubmitting(true); setError('');
    try {
      await submitReport({ contributionId, wishlistId, reason, screenshot });
      showToast('Report submitted! We\'ll review it soon. 🙏', 'success');
      onClose();
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">⚠️ Report Issue</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-error">
            💡 Your contribution was rejected by the creator. If you paid and have proof, please share the details below. Our team will review and take action.
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="donate-form">
            <div className="form-group">
              <label className="form-label">Describe the issue <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <textarea className="form-input" rows="4" placeholder="Tell us what happened..." value={reason} onChange={e => setReason(e.target.value)}></textarea>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Screenshot</label>
              <div className="image-upload">
                <div className="image-upload-icon">📸</div>
                <div className="image-upload-text">Upload payment screenshot</div>
                <div className="image-upload-hint">{screenshot ? 'File selected' : 'PNG or JPG (optional but recommended)'}</div>
                <input type="file" accept="image/*" onChange={handleFile} />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !reason.trim()}>
            {submitting ? '⏳ Submitting...' : '📤 Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}