import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext, ToastContext } from '../App';
import { createWishlist } from '../firebase';
import LoginModal from './LoginModal';
export default function CreateWishlist() {
  const { user } = useContext(UserContext);
  const showToast = useContext(ToastContext);
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [link, setLink] = useState('');
  const [reason, setReason] = useState('');
  const [image, setImage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (!user) {
    return (
      <main id="main-content">
        <div className="empty-state" style={{ paddingTop: '120px' }}>
          <div className="empty-state-icon">🔐</div>
          <div className="empty-state-title">Sign in to create a wishlist</div>
          <div className="empty-state-text">You need to be logged in to share your wishes.</div>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowLogin(true)}>Sign In</button>
        </div>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
      </main>
    );
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Enter a product name.'); return; }
    const p = parseInt(price);
    if (!p || p <= 0) { setError('Enter a valid price.'); return; }
    if (!category) { setError('Select a category.'); return; }
    if (!reason || reason.length < 10) { setError('Tell your story (min 10 chars).'); return; }
    if (!user.upiId?.includes('@')) {
      const upi = prompt('Enter your UPI ID (e.g., name@upi):');
      if (!upi || !upi.includes('@')) { setError('Enter a valid UPI ID.'); return; }
      user.upiId = upi;
    }
    setSubmitting(true);
    try {
      await createWishlist({ title: title.trim(), price: p, category, reason: reason.trim(), upiId: user.upiId, creatorName: user.name, productLink: link, image });
      showToast('🎉 Wishlist created! Share it with your community.', 'success');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError(err.message || 'Error creating wishlist.');
      setSubmitting(false);
    }
  };

  return (
    <main id="main-content">
      <section className="create-page">
        <div className="container-narrow">
          <div className="create-header animate-on-enter">
            <div className="hero-badge" style={{ display: 'inline-flex', marginBottom: 'var(--space-4)' }}>✨ New Wish</div>
            <h1 className="heading-xl">What Are You<br />Wishing For?</h1>
            <p className="text-muted" style={{ marginTop: 'var(--space-3)' }}>Share your dream with the community.</p>
          </div>
          <form className="create-form" onSubmit={handleSubmit} noValidate>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-card animate-on-enter">
              <div className="form-card-title">📦 Product Details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Product Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
                  <input className="form-input" type="text" placeholder="e.g., Sony WH-1000XM5 Headphones" value={title} onChange={e => setTitle(e.target.value)} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Price (₹) <span style={{ color: 'var(--color-error)' }}>*</span></label>
                    <input className="form-input" type="number" placeholder="29990" min="1" value={price} onChange={e => setPrice(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category <span style={{ color: 'var(--color-error)' }}>*</span></label>
                    <select className="form-input" value={category} onChange={e => setCategory(e.target.value)} required>
                      <option value="">Select</option>
                      {['Electronics','Lifestyle','Music','Furniture','Books','Sports','Fashion','Health'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Product Link</label>
                  <input className="form-input" type="url" placeholder="https://amazon.in/product-link" value={link} onChange={e => setLink(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="form-card animate-on-enter">
              <div className="form-card-title">📸 Product Image</div>
              <div className="image-upload">
                <div className="image-upload-icon">📤</div>
                <div className="image-upload-text">{imageFile ? imageFile.name : 'Click to add a photo'}</div>
                <div className="image-upload-hint">Optional</div>
                <input type="file" accept="image/*" onChange={handleImageUpload} />
              </div>
            </div>
            <div className="form-card animate-on-enter">
              <div className="form-card-title">💌 Your Story</div>
              <div className="form-group">
                <label className="form-label">Why do you want this? <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <textarea className="form-input" rows="5" placeholder="Share your story..." value={reason} onChange={e => setReason(e.target.value)} required></textarea>
              </div>
            </div>
            <div className="form-card animate-on-enter">
              <div className="form-card-title">💳 UPI Details</div>
              <div className="form-group">
                <label className="form-label">Your Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input className="form-input" type="text" value={user.name} disabled />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-full animate-on-enter" disabled={submitting} style={{ fontSize: 'var(--text-base)' }}>
              {submitting ? '⏳ Creating...' : '✨ Create Wishlist'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
