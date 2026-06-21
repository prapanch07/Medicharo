import { useState, useContext, useId, useRef } from 'react';
import { ToastContext, UserContext } from '../App';
import { submitReport, uploadReportScreenshot } from '../firebase';
import Modal from './Modal';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export default function ReportModal({ contributionId, wishlistId, onClose }) {
  const showToast = useContext(ToastContext);
  const { user } = useContext(UserContext);
  const [reason, setReason] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const titleId = useId();
  const reasonId = useId();

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) { setFile(null); return; }
    if (f.size > MAX_FILE_BYTES) {
      setError('Screenshot is too large (max 5 MB).');
      e.target.value = '';
      setFile(null);
      return;
    }
    setError('');
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!reason.trim()) { setError('Please describe the issue.'); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true); setError('');
    try {
      let screenshotUrl = '';
      if (file) {
        screenshotUrl = await uploadReportScreenshot(user?.uid, file);
      }
      await submitReport({ contributionId, wishlistId, reason, screenshot: screenshotUrl });
      showToast('Report submitted! We\'ll review it soon. 🙏', 'success');
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to submit report.');
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  return (
    <Modal onClose={onClose} labelledBy={titleId}>
      <div className="modal-header">
        <div id={titleId} className="modal-title">⚠️ Report Issue</div>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="modal-body">
        <div className="alert alert-error">
          💡 Your contribution was rejected by the creator. If you paid and have proof, please share the details below. Our team will review and take action.
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="donate-form">
          <div className="form-group">
            <label htmlFor={reasonId} className="form-label">Describe the issue <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <textarea id={reasonId} className="form-input" rows="4" placeholder="Tell us what happened..." value={reason} onChange={e => setReason(e.target.value)}></textarea>
          </div>
          <div className="form-group">
            <label className="form-label">Payment Screenshot</label>
            <div className="image-upload">
              <div className="image-upload-icon">📸</div>
              <div className="image-upload-text">Upload payment screenshot</div>
              <div className="image-upload-hint">{file ? file.name : 'PNG or JPG (optional, max 5 MB)'}</div>
              <input type="file" accept="image/*" onChange={handleFile} aria-label="Payment screenshot" />
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
    </Modal>
  );
}
