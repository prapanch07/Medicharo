import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { UserContext, ToastContext } from '../App';
import { confirmContribution, rejectContribution, markNotificationRead, markAllNotificationsRead, formatTime, deleteDoc, doc, db } from '../firebase';
import ReportModal from './ReportModal';
import { ConfirmDialog } from './Modal';
import { renderNotifText } from './notificationCopy';

export default function NotificationsPage() {
  const { user, notifications, refreshUnread } = useContext(UserContext);
  const showToast = useContext(ToastContext);
  const [reportData, setReportData] = useState(null);
  const [pendingReject, setPendingReject] = useState(null);

  useEffect(() => {
    if (!user) return;
    markAllNotificationsRead(user.uid).catch(() => {}).then(() => refreshUnread());
  }, [user, refreshUnread]);

  const notifs = notifications;
  const loading = !user;

  const handleConfirm = async (contribId, wlId, notifId) => {
    try { await confirmContribution(contribId, wlId); await deleteDoc(doc(db, 'notifications', notifId)); showToast('✅ Payment confirmed!', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
    refreshUnread();
  };
  const handleReject = async () => {
    const { contribId, wlId, notifId } = pendingReject;
    setPendingReject(null);
    try { await rejectContribution(contribId, wlId); await deleteDoc(doc(db, 'notifications', notifId)); showToast('Payment rejected', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
    refreshUnread();
  };
  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllNotificationsRead(user.uid);
    refreshUnread();
  };

  if (!user) return <main id="main-content"><div className="empty-state" style={{ paddingTop: '120px' }}><div className="empty-state-icon">🔐</div><div className="empty-state-title">Sign in to view notifications</div><Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>Go Home</Link></div></main>;

  const unread = notifs.filter(n => !n.read).length;

  return (
    <main id="main-content">
      <section className="profile-page">
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: 'calc(var(--header-height) + var(--space-8)) var(--space-6) var(--space-8)' }}>
          <div className="section-header">
            <div className="section-header-content">
              <h1 className="section-title">🔔 Notifications</h1>
              <p className="section-subtitle">{unread > 0 ? unread + ' unread' : 'All caught up!'}</p>
            </div>
            {notifs.length > 0 && (
              <button className="btn-ghost" onClick={handleMarkAllRead} style={{ fontSize: 'var(--text-sm)' }}>Mark all read</button>
            )}
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Loading...</div>
          ) : notifs.length === 0 ? (
            <div className="empty-state" style={{ paddingTop: '3rem' }}>
              <div className="empty-state-icon">🔔</div>
              <div className="empty-state-title">No notifications yet</div>
              <div className="empty-state-text">When someone contributes to your wishlist or your payment is confirmed, you'll see it here.</div>
              <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>Browse Wishes</Link>
            </div>
          ) : (
            <div className="notif-card">
              {notifs.map(n => {
                const copy = renderNotifText(n);
                return (
                <div key={n.id} className="contribution-item notif-item" onClick={() => { if (!n.read) { markNotificationRead(n.id); refreshUnread(); } }}>
                  <div className="contribution-info">
                    <div className="contribution-name">
                      {!n.read && <span className="notif-dot" />}
                      {copy.headline}
                    </div>
                    <div className="contribution-message">
                      {copy.body}
                    </div>
                    <div className="contribution-time">{formatTime(n.createdAt)}</div>
                  </div>
                  {n.type === 'new_contribution' && (
                    <div className="confirm-actions" onClick={e => e.stopPropagation()}>
                      <button className="btn btn-success btn-sm" onClick={() => handleConfirm(n.contributionId, n.wishlistId, n.id)}>✅ Confirm</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setPendingReject({ contribId: n.contributionId, wlId: n.wishlistId, notifId: n.id })} style={{ color: 'var(--color-error)' }}>✕ Reject</button>
                    </div>
                  )}
                  {n.type === 'rejected' && (
                    <button className="btn btn-sm btn-outline" onClick={e => { e.stopPropagation(); setReportData({ contributionId: n.contributionId, wishlistId: n.wishlistId }); }} style={{ flexShrink: 0, fontSize: 'var(--text-xs)', color: 'var(--color-error)' }}>🚩 Report Issue</button>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
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
