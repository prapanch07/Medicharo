import { useState, useEffect, useContext, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UserContext, ToastContext } from '../App';
import { subscribeWishlist, subscribeContributions, getCreatorDisplay, confirmContribution, rejectContribution, formatTime } from '../firebase';
import DonateModal from './DonateModal';
import LoginModal from './LoginModal';
import ReportModal from './ReportModal';
import { ConfirmDialog } from './Modal';

export default function Detail() {
  const { id } = useParams();
  const { user, userReports } = useContext(UserContext);
  const showToast = useContext(ToastContext);

  const reportByContribId = useMemo(() => {
    const m = new Map();
    (userReports || []).forEach(r => { if (r.contributionId) m.set(r.contributionId, r); });
    return m;
  }, [userReports]);

  const [w, setW] = useState(null);
  const [wlLoading, setWlLoading] = useState(true);
  const [wlNotFound, setWlNotFound] = useState(false);
  const [contribs, setContribs] = useState([]);
  const [creator, setCreator] = useState(null);
  const [creatorLoading, setCreatorLoading] = useState(true);
  const [showDonate, setShowDonate] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [pendingReject, setPendingReject] = useState(null);

  useEffect(() => {
    const unsub1 = subscribeWishlist(id, wl => {
      if (!wl) { setWlNotFound(true); setWlLoading(false); return; }
      setW(wl);
      setWlNotFound(false);
      setWlLoading(false);
    });
    const unsub2 = subscribeContributions(id, list => {
      setContribs(list);
    });
    return () => { unsub1(); unsub2(); };
  }, [id]);

  useEffect(() => {
    if (w) {
      let cancelled = false;
      getCreatorDisplay(w.creatorUid).then(c => {
        if (cancelled) return;
        setCreator(c); setCreatorLoading(false);
      });
      return () => { cancelled = true; };
    }
  }, [w]);

  const handleConfirm = async (contribId) => {
    try { await confirmContribution(contribId, id); showToast('✅ Payment confirmed!', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
  };
  const handleReject = async () => {
    const contribId = pendingReject;
    setPendingReject(null);
    try { await rejectContribution(contribId, id); showToast('Payment rejected', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const handleContribute = () => {
    if (user) { setShowDonate(true); return; }
    setShowLogin(true);
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    setShowDonate(true);
  };

  if (wlLoading) return <main id="main-content"><div className="loader-inline" style={{ justifyContent: 'center', paddingTop: '120px' }}><span className="spinner"></span> Loading wishlist...</div></main>;
  if (wlNotFound || !w) return <main id="main-content"><div className="empty-state" style={{ paddingTop: '120px' }}><div className="empty-state-icon">⚠️</div><div className="empty-state-title">Wishlist not found</div><div className="empty-state-text">It may have been removed or the link is broken.</div><Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>Go Home</Link></div></main>;

  const pct = w.price > 0 ? Math.round((w.raised / w.price) * 100) : 0;
  const rem = Math.max(0, (w.price || 0) - (w.raised || 0));
  const isCreator = user && w.creatorUid === user.uid;
  const pendingContribs = contribs.filter(c => c.status === 'pending');
  const hasPendingContrib = user && contribs.some(c => c.contributorUid === user.uid && c.status === 'pending');

  return (
    <main id="main-content">
      <section className="detail-page">
        <div className="detail-hero">
          {w.image ? <img src={w.image} alt={w.title} /> : <div className="wishlist-card-placeholder" style={{ height: '100%' }}>✨</div>}
          <div className="detail-hero-overlay"></div>
          <Link to="/" className="detail-back-btn" aria-label="Back to home">←</Link>
        </div>

        {hasPendingContrib && (
          <div className="pending-banner">
            <strong>⏳ Payment Pending</strong> — The creator has been notified and will confirm your payment shortly.
          </div>
        )}

        <div className="detail-content">
          <div className="detail-main">
            <div className="detail-header-card animate-on-enter">
              <h1 className="detail-title">{w.title}</h1>
              <div className="detail-price-row">
                <span className="detail-price">₹{(w.raised || 0).toLocaleString('en-IN')}</span>
                <span className="detail-raised-label">of ₹{(w.price || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="detail-progress-section">
                <div className="progress-bar-track" style={{ height: '10px' }}>
                  <div className="progress-bar-fill" style={{ width: pct + '%' }}></div>
                </div>
                <div className="detail-progress-stats">
                  <div className="detail-stat">
                    <div className="detail-stat-value" style={{ color: 'var(--color-primary)' }}>₹{(w.raised || 0).toLocaleString('en-IN')}</div>
                    <div className="detail-stat-label">Raised</div>
                  </div>
                  <div className="detail-stat">
                    <div className="detail-stat-value" style={{ color: 'var(--color-accent)' }}>₹{rem.toLocaleString('en-IN')}</div>
                    <div className="detail-stat-label">Remaining</div>
                  </div>
                  <div className="detail-stat">
                    <div className="detail-stat-value" style={{ color: 'var(--color-success)' }}>{pct}%</div>
                    <div className="detail-stat-label">Complete</div>
                  </div>
                </div>
              </div>
              {rem > 0 ? (
                <div className="detail-donate-sidebar">
                  <button className="detail-donate-btn" onClick={handleContribute}>❤️ Contribute Now</button>
                </div>
              ) : (
                <div className="detail-donate-sidebar">
                  <div className="btn btn-success btn-lg btn-full" style={{ pointerEvents: 'none', cursor: 'default' }}>🎉 Fully Funded!</div>
                </div>
              )}
            </div>

            {isCreator && pendingContribs.length > 0 && (
              <div className="confirm-section animate-on-enter">
                <div className="detail-story-title" style={{ marginBottom: 'var(--space-4)' }}>⏳ Pending Confirmation ({pendingContribs.length})</div>
                {pendingContribs.map(c => (
                  <div key={c.id} className="confirm-item">
                    <div style={{ minWidth: 0 }}>
                      <strong>{c.contributorName}</strong> — <strong>₹{c.amount}</strong>
                      {c.message && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>"{c.message}"</div>}
                    </div>
                    <div className="confirm-actions">
                      <button className="btn btn-success btn-sm" onClick={() => handleConfirm(c.id)}>✅ Confirm</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setPendingReject(c.id)} style={{ color: 'var(--color-error)' }}>✕ Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="detail-story animate-on-enter">
              <div className="detail-story-title">📖 The Story Behind This Wish</div>
              <div className="detail-story-text">
                {(w.reason || '').split('\n').filter(p => p.trim()).map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </div>
          </div>

          <div className="detail-sidebar">
              <div className="sidebar-card animate-on-enter">
                <div className="sidebar-card-title">Creator</div>
                {creatorLoading ? (
                  <div className="loader-inline"><span className="spinner"></span></div>
                ) : (
                  <div className="creator-profile">
                    <div className="avatar avatar-lg">{(creator?.name || '?')[0]}</div>
                    <div className="creator-info">
                      <div className="creator-info-name">{creator?.name || 'Someone'}</div>
                      {creator?.bio && <div className="creator-info-join">{creator.bio}</div>}
                    </div>
                  </div>
                )}
              </div>

            <div className="sidebar-card animate-on-enter">
              <div className="sidebar-card-title">Recent Contributors ❤️</div>
              {wlLoading ? (
                <div className="loader-inline"><span className="spinner"></span></div>
              ) : contribs.filter(c => c.status === 'confirmed').length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  Be the first to contribute!
                </div>
              ) : (
                contribs.filter(c => c.status === 'confirmed').slice(0, 5).map(c => (
                  <div key={c.id} className="contribution-item">
                    <div className="contribution-info">
                      <div className="contribution-name">{c.contributorName} ✅</div>
                      {c.message && <div className="contribution-message">{c.message}</div>}
                      <div className="contribution-time">{formatTime(c.createdAt)}</div>
                    </div>
                    <div className="contribution-amount">+₹{c.amount}</div>
                  </div>
                ))
              )}
              {user && contribs.filter(c => c.status === 'rejected' && c.contributorUid === user.uid).map(c => {
                const report = reportByContribId.get(c.id);
                const isOpen = report && report.status === 'open';
                const isAccepted = report && (report.status === 'accepted' || report.status === 'closed');
                const isRejected = report && report.status === 'rejected';
                return (
                  <div key={c.id} className="contribution-item rejected-contribution">
                    <div className="contribution-info">
                      <div className="contribution-name" style={{ color: 'var(--color-error)' }}>⚠️ Your contribution was rejected</div>
                      <div className="contribution-time">{formatTime(c.createdAt)}</div>
                    </div>
                    {!report && (
                      <button className="btn btn-sm btn-outline" onClick={() => setReportData({ contributionId: c.id, wishlistId: id })} style={{ flexShrink: 0, fontSize: 'var(--text-xs)', color: 'var(--color-error)' }}>🚩 Report Issue</button>
                    )}
                    {isOpen && (
                      <div style={{ flexShrink: 0, fontSize: 'var(--text-xs)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)' }}>
                        ⏳ Report submitted — awaiting admin review
                      </div>
                    )}
                    {isAccepted && (
                      <div style={{ flexShrink: 0, fontSize: 'var(--text-xs)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-md)', background: 'rgba(52, 168, 83, 0.1)', color: 'var(--color-success)' }}>
                        ✅ Admin approved your report
                      </div>
                    )}
                    {isRejected && (
                      <div style={{ flexShrink: 0, fontSize: 'var(--text-xs)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-md)', background: 'rgba(234, 67, 53, 0.1)', color: 'var(--color-error)' }}>
                        ❌ Admin rejected your report
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {rem > 0 && (
              <div className="sidebar-card detail-donate-sidebar animate-on-enter">
                <button className="detail-donate-btn" onClick={handleContribute}>❤️ Contribute Now</button>
              </div>
            )}
          </div>
        </div>

        {rem > 0 && (
          <div className="detail-donate-sticky">
            <div className="detail-donate-sticky-inner container">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{w.title}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>₹{rem.toLocaleString('en-IN')} needed</div>
              </div>
              <button className="detail-donate-btn" onClick={handleContribute} style={{ width: 'auto', padding: '0.75rem 2rem', fontSize: 'var(--text-sm)' }}>❤️ Contribute</button>
            </div>
          </div>
        )}
      </section>

      {showLogin && <LoginModal onClose={() => { setShowLogin(false); }} onSuccess={handleLoginSuccess} />}
      {showDonate && <DonateModal wishlistId={id} onClose={() => setShowDonate(false)} />}
      {reportData && <ReportModal {...reportData} onClose={() => setReportData(null)} />}
      {pendingReject && (
        <ConfirmDialog
          open
          title="Reject this payment?"
          message="The contributor will be notified."
          confirmLabel="Reject"
          confirmTone="danger"
          onConfirm={handleReject}
          onClose={() => setPendingReject(null)}
        />
      )}
    </main>
  );
}