import { useState, useEffect, useContext, useId } from 'react';
import { Link } from 'react-router-dom';
import { UserContext, ToastContext } from '../App';
import { confirmContribution, rejectContribution, markNotificationRead, markAllNotificationsRead, formatTime, deleteDoc, doc, db } from '../firebase';
import ReportModal from './ReportModal';
import Modal, { ConfirmDialog } from './Modal';
import { renderNotifText } from './notificationCopy';

export default function NotificationModal({ onClose }) {
  const { user, notifications, refreshUnread } = useContext(UserContext);
  const showToast = useContext(ToastContext);
  const [reportData, setReportData] = useState(null);
  const [pendingReject, setPendingReject] = useState(null);
  const titleId = useId();

  useEffect(() => {
    if (!user) return;
    markAllNotificationsRead(user.uid).catch(() => {}).then(() => refreshUnread());
  }, [user, refreshUnread]);

  const notifs = notifications.slice(0, 5);
  const total = notifications.length;
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

  return (
    <>
      <Modal
        onClose={onClose}
        labelledBy={titleId}
        className="notif-modal"
        overlayStyle={{ alignItems: 'flex-start', paddingTop: 'calc(var(--header-height) + var(--space-4))' }}
      >
        <div className="notif-modal-header">
          <strong id={titleId}>🔔 Notifications</strong>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
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
            notifs.map(n => {
              const copy = renderNotifText(n);
              return (
              <div key={n.id} className="notif-modal-item" onClick={() => { if (!n.read) { markNotificationRead(n.id); refreshUnread(); } }}>
                <div className="contribution-info" style={{ flex: 1, minWidth: 0 }}>
                  <div className="contribution-name" style={{ fontSize: 'var(--text-sm)' }}>
                    {!n.read && <span className="notif-dot" />}
                    {copy.headline}
                  </div>
                  <div className="contribution-message" style={{ fontSize: 'var(--text-xs)' }}>
                    {copy.body}
                  </div>
                  <div className="contribution-time" style={{ fontSize: '10px' }}>{formatTime(n.createdAt)}</div>
                </div>
                {n.type === 'new_contribution' && (
                  <div className="confirm-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-success btn-sm" onClick={() => handleConfirm(n.contributionId, n.wishlistId, n.id)} style={{ padding: '0.25rem 0.625rem', fontSize: '10px' }} aria-label="Confirm payment">✅</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setPendingReject({ contribId: n.contributionId, wlId: n.wishlistId, notifId: n.id })} style={{ padding: '0.25rem 0.625rem', fontSize: '10px', color: 'var(--color-error)' }} aria-label="Reject payment">✕</button>
                  </div>
                )}
                {n.type === 'rejected' && (
                  <button className="btn btn-sm btn-outline" onClick={e => { e.stopPropagation(); setReportData({ contributionId: n.contributionId, wishlistId: n.wishlistId }); }} style={{ flexShrink: 0, padding: '0.25rem 0.5rem', fontSize: '10px', color: 'var(--color-error)' }} aria-label="Report issue">🚩</button>
                )}
              </div>
              );
            })
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
      </Modal>
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
    </>
  );
}
