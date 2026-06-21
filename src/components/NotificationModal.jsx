import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { UserContext, ToastContext } from '../App';
import { subscribeNotifications, confirmContribution, rejectContribution, markNotificationRead, markAllNotificationsRead, formatTime, deleteDoc, doc, db } from '../firebase';
import ReportModal from './ReportModal';

export default function NotificationModal({ onClose }) {
  const { user, refreshUnread } = useContext(UserContext);
  const showToast = useContext(ToastContext);
  const [notifs, setNotifs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    if (!user) return;
    markAllNotificationsRead(user.uid).catch(() => {}).then(() => refreshUnread());
    setLoading(true);
    const unsub = subscribeNotifications(user.uid, list => {
      setTotal(list.length);
      setNotifs(list.slice(0, 5));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const handleConfirm = async (contribId, wlId, notifId) => {
    try { await confirmContribution(contribId, wlId); await deleteDoc(doc(db, 'notifications', notifId)); showToast('✅ Payment confirmed!', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
    refreshUnread();
  };
  const handleReject = async (contribId, wlId, notifId) => {
    if (!confirm('Reject this payment? The contributor will be notified.')) return;
    try { await rejectContribution(contribId, wlId); await deleteDoc(doc(db, 'notifications', notifId)); showToast('Payment rejected', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
    refreshUnread();
  };

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ alignItems: 'flex-start', paddingTop: 'calc(var(--header-height) + var(--space-4))' }}>
      <div className="notif-modal">
        <div className="notif-modal-header">
          <strong>🔔 Notifications</strong>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="notif-modal-body">
          {loading ? (
            <div className="loader-inline" style={{ justifyContent: 'center', padding: '2rem' }}><span className="spinner"></span></div>
          ) : notifs.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-icon">🔔</div>
              <div className="empty-state-title" style={{ fontSize: 'var(--text-base)' }}>No notifications yet</div>
              <div className="empty-state-text" style={{ fontSize: 'var(--text-xs)' }}>Activity will appear here</div>
            </div>
          ) : (
            notifs.map(n => (
              <div key={n.id} className="notif-modal-item" onClick={() => { if (!n.read) { markNotificationRead(n.id); refreshUnread(); } }}>
                <div className="contribution-info" style={{ flex: 1, minWidth: 0 }}>
                  <div className="contribution-name" style={{ fontSize: 'var(--text-sm)' }}>
                    {!n.read && <span className="notif-dot" />}
                    {n.type === 'new_contribution' ? '💰 ' + n.fromName + ' contributed' : (n.type === 'confirmed' ? '✅ Payment confirmed' : '⚠️ Payment rejected')}
                  </div>
                  <div className="contribution-message" style={{ fontSize: 'var(--text-xs)' }}>
                    {n.type === 'new_contribution' ? '₹' + n.amount + ' · ' + (n.message ? '"' + n.message + '"' : 'No message') : (n.type === 'confirmed' ? '₹' + n.amount + ' for ' + n.wishlistTitle + ' was confirmed' : '₹' + n.amount + ' for ' + n.wishlistTitle + ' was rejected')}
                  </div>
                  <div className="contribution-time" style={{ fontSize: '10px' }}>{formatTime(n.createdAt)}</div>
                </div>
                {n.type === 'new_contribution' && (
                  <div className="confirm-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-success btn-sm" onClick={() => handleConfirm(n.contributionId, n.wishlistId, n.id)} style={{ padding: '0.25rem 0.625rem', fontSize: '10px' }}>✅</button>
                    <button className="btn btn-outline btn-sm" onClick={() => handleReject(n.contributionId, n.wishlistId, n.id)} style={{ padding: '0.25rem 0.625rem', fontSize: '10px', color: 'var(--color-error)' }}>✕</button>
                  </div>
                )}
                {n.type === 'rejected' && (
                  <button className="btn btn-sm btn-outline" onClick={e => { e.stopPropagation(); setReportData({ contributionId: n.contributionId, wishlistId: n.wishlistId }); }} style={{ flexShrink: 0, padding: '0.25rem 0.5rem', fontSize: '10px', color: 'var(--color-error)' }}>🚩</button>
                )}
              </div>
            ))
          )}
        </div>
        {total > 5 && (
          <div className="notif-modal-footer">
            <Link to="/notifications" className="notif-more-link" onClick={onClose}>
              View all {total} notifications →
            </Link>
          </div>
        )}
        {total > 0 && total <= 5 && (
          <div className="notif-modal-footer" style={{ justifyContent: 'center' }}>
            <button className="btn-ghost" onClick={async () => { if (user) { await markAllNotificationsRead(user.uid); refreshUnread(); } }} style={{ fontSize: 'var(--text-xs)' }}>Mark all as read</button>
          </div>
        )}
      </div>
      {reportData && <ReportModal {...reportData} onClose={() => setReportData(null)} />}
    </div>
  );
}
