import { useState, useContext, useEffect, useId, useRef } from 'react';
import { ToastContext, UserContext } from '../App';
import { submitReport, fileToDataUrl } from '../firebase';
import Modal from './Modal';

// Firestore document limit is 1 MiB. Base64 inflates a binary file by ~33%,
// and the report doc also stores reason text, names, ids etc. Leaving headroom,
// the raw upload must stay ~700 KB or smaller.
const MAX_FILE_BYTES = 700 * 1024;

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function ReportModal({ contributionId, wishlistId, onClose }) {
  const showToast = useContext(ToastContext);
  const { user } = useContext(UserContext);
  const [reason, setReason] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [reading, setReading] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const [screenshot, setScreenshot] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const readIdRef = useRef(0);
  const titleId = useId();
  const reasonId = useId();
  const pickerId = useId();
  const repickerId = useId();

  useEffect(() => {
    const url = preview;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [preview]);

  const beginRead = (f) => {
    const myId = ++readIdRef.current;
    setReading(true);
    setReadProgress(0);
    setScreenshot('');
    fileToDataUrl(f, pct => {
      if (readIdRef.current === myId) setReadProgress(pct);
    })
      .then(dataUrl => {
        if (readIdRef.current !== myId) return;
        setScreenshot(dataUrl);
        setReading(false);
      })
      .catch(err => {
        if (readIdRef.current !== myId) return;
        setError(err.message || 'Failed to read screenshot.');
        setReading(false);
      });
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setError('Screenshot is too large (' + formatSize(f.size) + '). Maximum is ' + formatSize(MAX_FILE_BYTES) + '.');
      return;
    }
    setError('');
    setFile(f);
    setPreview(URL.createObjectURL(f));
    beginRead(f);
  };

  const removeFile = () => {
    readIdRef.current++;
    setFile(null);
    setPreview('');
    setScreenshot('');
    setReadProgress(0);
    setReading(false);
  };

  const handleSubmit = async () => {
    if (!reason.trim()) { setError('Please describe the issue.'); return; }
    if (!file) { setError('Please attach a screenshot of your payment as proof.'); return; }
    if (reading) { setError('Please wait — still reading the screenshot.'); return; }
    if (!screenshot) { setError('Screenshot could not be read. Try another image.'); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true); setError('');
    try {
      await submitReport({ contributionId, wishlistId, reason, screenshot });
      showToast('Report submitted! We\'ll review it soon. 🙏', 'success');
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to submit report.');
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const submitDisabled = submitting || !reason.trim() || !file || reading || !screenshot;

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
            <label className="form-label">Payment Screenshot <span style={{ color: 'var(--color-error)' }}>*</span></label>
            {file ? (
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', padding: 'var(--space-3)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)' }}>
                {preview && (
                  <img src={preview} alt="Selected screenshot" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', wordBreak: 'break-all' }}>{file.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{formatSize(file.size)}</div>
                  {reading && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        <span className="spinner" style={{ width: 14, height: 14 }}></span>
                        <span>Reading… {readProgress}%</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--color-border-light)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: readProgress + '%', background: 'var(--color-primary)', transition: 'width 200ms ease' }}></div>
                      </div>
                    </div>
                  )}
                  {!reading && screenshot && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', marginTop: 'var(--space-1)' }}>
                      ✅ Ready to submit
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flexShrink: 0 }}>
                  <label htmlFor={repickerId} className="btn-ghost" style={{ cursor: 'pointer', fontSize: 'var(--text-xs)', textAlign: 'center' }}>Change</label>
                  <button type="button" className="btn-ghost" onClick={removeFile} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)' }}>Remove</button>
                  <input id={repickerId} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} aria-label="Change screenshot" />
                </div>
              </div>
            ) : (
              <div className="image-upload">
                <div className="image-upload-icon">📸</div>
                <div className="image-upload-text">Upload payment screenshot</div>
                <div className="image-upload-hint">PNG or JPG, max 700 KB</div>
                <input id={pickerId} type="file" accept="image/*" onChange={handleFile} aria-label="Payment screenshot" required />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={submitDisabled}>
          {submitting ? '⏳ Submitting...' : reading ? '⏳ Reading screenshot…' : '📤 Submit Report'}
        </button>
      </div>
    </Modal>
  );
}
