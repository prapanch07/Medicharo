import { useState, useEffect, useContext } from 'react';
import QRCode from 'qrcode';
import { UserContext, ToastContext } from '../App';
import { getWishlist, addContribution } from '../firebase';

export default function DonateModal({ wishlistId, onClose }) {
  const { user } = useContext(UserContext);
  const showToast = useContext(ToastContext);
  const [w, setW] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState('form');
  const [amount, setAmount] = useState(0);
  const [customAmount, setCustomAmount] = useState('');
  const [donorName, setDonorName] = useState(user?.name || '');
  const [message, setMessage] = useState('');
  const [qrImg, setQrImg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getWishlist(wishlistId).then(wl => {
      if (!wl) { showToast('Wishlist not found', 'error'); onClose(); return; }
      if (wl.status === 'completed' || (wl.raised || 0) >= (wl.price || 0)) {
        showToast('Already fulfilled! 🎉', 'error'); onClose(); return;
      }
      setW(wl);
      setLoading(false);
    }).catch(() => { showToast('Error loading wishlist', 'error'); onClose(); });
  }, [wishlistId]);

  const presets = [100, 250, 500, 1000, 2000, 5000];
  const rem = w ? Math.max(0, (w.price || 0) - (w.raised || 0)) : 0;

  const selectPreset = (a) => { setAmount(a); setCustomAmount(''); setError(''); };
  const handleCustom = (e) => { setCustomAmount(e.target.value); setAmount(parseInt(e.target.value) || 0); setError(''); };

  const proceedToPay = () => {
    if (!amount || amount <= 0) { setError('Please select or enter a valid amount.'); return; }
    if (amount > rem) { setError('Only ₹' + rem.toLocaleString('en-IN') + ' remaining!'); return; }
    setError('');
    const upiStr = 'upi://pay?pa=' + encodeURIComponent(w.upiId) + '&pn=' + encodeURIComponent(w.creatorName || '') + '&am=' + amount + '&cu=INR&tn=' + encodeURIComponent('Contribution to ' + w.title);
    QRCode.toDataURL(upiStr, { width: 256, margin: 1 }).then(url => {
      setQrImg(url);
      setStep('qr');
    }).catch(() => setQrImg(''));
  };

  const handlePaid = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await addContribution(w.id, { amount, name: donorName, message });
      showToast('🎉 Payment submitted! The creator will confirm it shortly.', 'success');
      onClose();
    } catch (err) {
      showToast(err.message || 'Error submitting payment', 'error');
      setSubmitting(false);
    }
  };

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(w.upiId);
      const btn = document.getElementById('copyUpiBtn');
      if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000); }
    } catch {
      const ta = document.createElement('textarea');
      ta.value = w.upiId;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  if (loading) return null;

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">❤️ Contribute</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-3)' }}>{error}</div>}
          {step === 'form' ? (
            <div>
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div className="section-subtitle" style={{ marginTop: 0, fontWeight: 600 }}>Contributing to</div>
                <div style={{ fontWeight: 700 }}>{w.title}</div>
                <div className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>by {w.creatorName}</div>
              </div>
              <div className="donate-form">
                <div className="form-group">
                  <div className="label-row">
                    <label className="form-label">Amount <span style={{ color: 'var(--color-error)' }}>*</span></label>
                    <span className="help-icon" data-tip={'Select a preset or enter a custom amount. The creator set the total goal at ₹' + (w.price || 0).toLocaleString('en-IN') + '.'}>!</span>
                  </div>
                  <div className="donate-amount-grid">
                    {presets.map(a => (
                      <button key={a} className={'amount-chip' + (amount === a && !customAmount ? ' active' : '')} onClick={() => selectPreset(a)}>₹{a.toLocaleString('en-IN')}</button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Custom amount</label>
                  <input className="form-input" type="number" placeholder="Enter amount in ₹" min="1" value={customAmount} onChange={handleCustom} />
                </div>
                <div className="form-group">
                  <div className="label-row">
                    <label className="form-label">Your Name</label>
                    <span className="help-icon" data-tip="Your name appears in the contributors list. Leave blank for anonymous.">!</span>
                  </div>
                  <input className="form-input" type="text" placeholder="How should we call you?" value={donorName} onChange={e => setDonorName(e.target.value)} />
                </div>
                <div className="form-group">
                  <div className="label-row">
                    <label className="form-label">Message</label>
                    <span className="help-icon" data-tip="Leave a note for the creator. They'll see it when confirming!">!</span>
                  </div>
                  <textarea className="form-input" rows="2" placeholder="Leave a sweet message..." value={message} onChange={e => setMessage(e.target.value)}></textarea>
                </div>
              </div>
            </div>
          ) : (
            <div className="qr-screen">
              <div className="qr-success-badge">✅ Payment Link Generated</div>
              <div className="qr-code-wrapper">{qrImg ? <img src={qrImg} alt="QR" className="qr-code-svg" /> : <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Generating QR...</div>}</div>
              <div className="qr-amount">₹{amount.toLocaleString('en-IN')}</div>
              <div className="qr-creator">for {w.creatorName}'s wishlist</div>
              <div className="qr-upi-box">
                <span className="qr-upi-id">{w.upiId}</span>
                <button className="qr-copy-btn" id="copyUpiBtn" onClick={copyUpi}>📋 Copy</button>
              </div>
              <div className="qr-instructions">
                <div className="qr-instructions-title">📱 How to Pay</div>
                <ol>
                  <li>Open any UPI app</li>
                  <li>Scan QR or enter UPI ID</li>
                  <li>Amount auto-fills: <strong>₹{amount.toLocaleString('en-IN')}</strong></li>
                  <li>Complete payment</li>
                  <li>Come back and tap <strong>"I've Paid"</strong></li>
                </ol>
                <div className="alert alert-warning" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-3)' }}>
                  ⚠️ After paying, tap the button below. The creator will confirm your payment.
                </div>
              </div>
              <button className="qr-paid-btn" onClick={handlePaid} disabled={submitting}>
                {submitting ? '⏳ Submitting...' : "✅ I've Paid — Notify Creator"}
              </button>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {step === 'form' ? (
            <>
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={proceedToPay} style={{ padding: '0.875rem 2rem' }}>Proceed to Pay</button>
            </>
          ) : (
            <button className="btn btn-outline" onClick={() => setStep('form')}>← Back</button>
          )}
        </div>
      </div>
    </div>
  );
}
