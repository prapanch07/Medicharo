import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext, ToastContext } from '../App';
import { subscribeMyWishlists, subscribePendingForUser, signOutUser, confirmContribution, rejectContribution, formatTime } from '../firebase';
import DonateModal from './DonateModal';
import ReportModal from './ReportModal';
export default function Profile() {
  const { user, setUser, refreshUnread } = useContext(UserContext);
  const showToast = useContext(ToastContext);
  const navigate = useNavigate();

  const [wl, setWl] = useState([]);
  const [wlLoading, setWlLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [showDonate, setShowDonate] = useState(null);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    if (!user) { setWlLoading(false); setPendingLoading(false); return; }
    const unsub1 = subscribeMyWishlists(user.uid, list => { setWl(list); setWlLoading(false); });
    const unsub2 = subscribePendingForUser(user.uid, list => { setPending(list); setPendingLoading(false); });
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const handleSignOut = async () => {
    await signOutUser();
    setUser(null);
    navigate('/');
  };

  const handleConfirm = async (contribId, wlId) => {
    try { await confirmContribution(contribId, wlId); showToast('✅ Payment confirmed!', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
    refreshUnread();
  };
  const handleReject = async (contribId, wlId) => {
    if (!confirm('Reject this payment? The contributor will be notified.')) return;
    try { await rejectContribution(contribId, wlId); showToast('Payment rejected', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
    refreshUnread();
  };
  if (!user) return <main id="main-content"><div className="empty-state" style={{ paddingTop: '120px' }}><div className="empty-state-icon">🔐</div><div className="empty-state-title">Sign in to view profile</div><button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/')}>Go Home</button></div></main>;

  const totalRaised = wl.reduce((s, w) => s + (w.raised || 0), 0);
  const active = wl.filter(w => w.status === 'active');
  const completed = wl.filter(w => w.status === 'completed');
  const shown = tab === 'completed' ? completed : active;
  return (
    <main id="main-content">
      <section className="profile-page">
        <div className="profile-cover"></div>
        <div className="profile-header animate-on-enter">
          <div className="profile-avatar-wrapper">
            <div className="avatar avatar-xl">{user.photo ? <img src={user.photo} alt="" /> : (user.name || 'U')[0]}</div>
          </div>
          <div className="profile-info">
            <h1 className="profile-name">{user.name}</h1>
            <p className="profile-bio">{user.email || ''}</p>
            <div className="profile-stats-grid">
              <div className="profile-stat"><div className="profile-stat-value">{wl.length}</div><div className="profile-stat-label">Total</div></div>
              <div className="profile-stat"><div className="profile-stat-value">₹{totalRaised.toLocaleString('en-IN')}</div><div className="profile-stat-label">Raised</div></div>
              <div className="profile-stat"><div className="profile-stat-value">{active.length}</div><div className="profile-stat-label">Active</div></div>
              <div className="profile-stat"><div className="profile-stat-value">{completed.length}</div><div className="profile-stat-label">Completed</div></div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm" style={{ color: 'var(--color-error)' }} onClick={handleSignOut}>🚪 Sign Out</button>
            </div>
        {pendingLoading ? (
          <div className="loader-inline" style={{ maxWidth: 'var(--container-max)', margin: 'var(--space-4) auto 0', padding: '0 var(--space-6)' }}><span className="spinner"></span> Loading pending...</div>
        ) : pending.length > 0 && (
              <div className="pending-alert" style={{ cursor: 'pointer' }} onClick={() => setTab('pending')}>
                ⏳ {pending.length} payment{pending.length > 1 ? 's' : ''} pending your confirmation — click to view
              </div>
            )}
          </div>
        </div>

        {pending.length > 0 && (
          <div style={{ maxWidth: 'var(--container-max)', margin: 'var(--space-4) auto 0', padding: '0 var(--space-6)' }}>
            <div className="notif-card animate-on-enter" style={{ borderColor: 'var(--color-accent)' }}>
              <div className="notif-card-header">
                <strong>⏳ Pending Confirmations ({pending.length})</strong>
              </div>
              {pending.map(c => (
                <div key={c.id} className="contribution-item">
                  <div className="contribution-info">
                    <div className="contribution-name">
                      💰 {c.contributorName} — <strong>₹{c.amount}</strong>
                    </div>
                    {c.message && <div className="contribution-message">"{c.message}"</div>}
                    <div className="contribution-time">{formatTime(c.createdAt)}</div>
                  </div>
                  <div className="confirm-actions">
                    <button className="btn btn-success btn-sm" onClick={() => handleConfirm(c.id, c.wishlistId)}>✅ Confirm</button>
                    <button className="btn btn-outline btn-sm" onClick={() => handleReject(c.id, c.wishlistId)} style={{ color: 'var(--color-error)' }}>✕ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {wl.length > 0 && (
          <div className="profile-tabs">
            <button className={'profile-tab' + (tab === 'active' ? ' active' : '')} onClick={() => setTab('active')}>Active ({active.length})</button>
            <button className={'profile-tab' + (tab === 'completed' ? ' active' : '')} onClick={() => setTab('completed')}>Completed ({completed.length})</button>
          </div>
        )}

        <div className="profile-content animate-on-enter">
          {wl.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✨</div>
              <div className="empty-state-title">No wishlists yet</div>
              <div className="empty-state-text">Create your first wish!</div>
              <a href="/create" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>✨ Create Your First Wish</a>
            </div>
          ) : shown.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">{tab === 'completed' ? '📋' : '🎉'}</div>
              <div className="empty-state-title">{tab === 'completed' ? 'No completed' : 'All done!'}</div>
            </div>
          ) : (
            <div className="wishlist-grid">
              {shown.map((w, i) => (
                <div key={w.id} className={'wishlist-card animate-on-enter' + (w.status === 'completed' ? ' completed' : '')} style={{ animationDelay: (i % 6 * 50) + 'ms', cursor: 'pointer' }} onClick={() => navigate('/wishlist/' + w.id)}>
                  <div className="wishlist-card-image">
                    {w.image ? <img src={w.image} alt={w.title} loading="lazy" /> : <div className="wishlist-card-placeholder">✨</div>}
                    <div className="wishlist-card-category">{w.category}</div>
                    {w.status === 'completed' && <div className="wishlist-card-fulfilled">🎉 Fulfilled!</div>}
                    <div className="wishlist-card-raise-progress">
                      <div className="wishlist-card-raise-fill" style={{ width: Math.min(100, ((w.raised || 0) / (w.price || 1)) * 100) + '%' }}></div>
                    </div>
                  </div>
                  <div className="wishlist-card-body">
                    <h3 className="wishlist-card-title">{w.title}</h3>
                    <div className="wishlist-card-footer">
                      <div>
                        <div className="wishlist-card-price">₹{(w.raised || 0).toLocaleString('en-IN')}</div>
                        <div className="wishlist-card-raised">raised of ₹{(w.price || 0).toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {showDonate && <DonateModal wishlistId={showDonate} onClose={() => setShowDonate(null)} />}
      {reportData && <ReportModal {...reportData} onClose={() => setReportData(null)} />}
    </main>
  );
}