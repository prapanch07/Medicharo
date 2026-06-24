import { useState, useEffect, useContext, useMemo } from 'react';
import { ToastContext } from '../App';
import { subscribeReports, adminAcceptReport, adminDismissReport, formatTime } from '../firebase';

const TABS = ['open', 'accepted', 'rejected'];
const TAB_LABEL = { open: 'Open', accepted: 'Accepted', rejected: 'Rejected' };

export default function AdminReport() {
  const showToast = useContext(ToastContext);
  const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem('mc-admin') === 'true');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('open');
  const [imgModal, setImgModal] = useState(null);
  const [busy, setBusy] = useState(() => new Set());

  useEffect(() => {
    if (!loggedIn) return;
    setLoading(true);
    const unsub = subscribeReports(list => {
      setReports(list);
      setLoading(false);
    });
    return unsub;
  }, [loggedIn]);

  const openCount = reports.filter(r => r.status === 'open').length;
  const acceptedCount = reports.filter(r => r.status === 'accepted' || r.status === 'closed').length;
  const rejectedCount = reports.filter(r => r.status === 'rejected').length;
  const shown = useMemo(() => reports.filter(r => {
    if (tab === 'accepted') return r.status === 'accepted' || r.status === 'closed';
    return r.status === tab;
  }), [reports, tab]);

  const lock = (id) => setBusy(s => { const n = new Set(s); n.add(id); return n; });
  const unlock = (id) => setBusy(s => { const n = new Set(s); n.delete(id); return n; });

  const handleConfirm = async (report) => {
    if (busy.has(report.id)) return;
    lock(report.id);
    try {
      await adminAcceptReport(report);
      showToast('✅ Payment credited, report closed', 'success');
    } catch (e) {
      showToast(e.message || 'Error', 'error');
    } finally {
      unlock(report.id);
    }
  };

  const handleReject = async (report) => {
    if (busy.has(report.id)) return;
    lock(report.id);
    try {
      await adminDismissReport(report);
      showToast('❌ Report dismissed', 'success');
    } catch (e) {
      showToast(e.message || 'Error', 'error');
    } finally {
      unlock(report.id);
    }
  };

  const handleLogin = () => {
    if (username === 'admin' && password === 'admin') {
      localStorage.setItem('mc-admin', 'true');
      setLoggedIn(true);
    } else {
      showToast('Invalid credentials', 'error');
    }
  };

  if (!loggedIn) {
    return (
      <main id="main-content">
        <div style={{ maxWidth: '400px', margin: '120px auto 0', padding: 'var(--space-6)' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>🛡️</div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)' }}>Admin Login</h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <input className="form-input" type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
            <input className="form-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }} />
            <button className="btn btn-primary btn-full" onClick={handleLogin}>Sign In</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content">
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: 'calc(var(--header-height) + var(--space-8)) var(--space-6) var(--space-8)' }}>
        <div className="section-header" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="section-header-content">
            <h1 className="section-title">🛡️ Reports Dashboard</h1>
            <p className="section-subtitle">{reports.length} total</p>
          </div>
        </div>
        <div className="profile-tabs" style={{ marginBottom: 'var(--space-6)' }}>
          {TABS.map(t => {
            const count = t === 'open' ? openCount : t === 'accepted' ? acceptedCount : rejectedCount;
            return (
              <button key={t} className={'profile-tab' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>
                {TAB_LABEL[t]}
                {count > 0 && <span className="notif-badge" style={{ position: 'static', display: 'inline-flex', marginLeft: 'var(--space-2)', fontSize: '10px', minWidth: '18px', height: '18px' }}>{count}</span>}
              </button>
            );
          })}
        </div>
        {loading ? (
          <div className="loader-inline" style={{ justifyContent: 'center', padding: '3rem' }}><span className="spinner"></span></div>
        ) : shown.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: '3rem' }}>
            <div className="empty-state-icon">{tab === 'open' ? '📥' : '📋'}</div>
            <div className="empty-state-title">No {TAB_LABEL[tab].toLowerCase()} reports</div>
          </div>
        ) : (
          <div className="notif-card">
            {shown.map(r => {
              const rowBusy = busy.has(r.id);
              const isResolved = r.status !== 'open';
              const verdictLabel = r.status === 'rejected' ? '❌ Dismissed' : '✅ Accepted';
              const verdictColor = r.status === 'open' ? 'var(--color-error)' : 'var(--color-success)';
              return (
              <div key={r.id} className="contribution-item" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div className="contribution-info" style={{ flex: '1 1 280px', minWidth: 0 }}>
                  <div className="contribution-name">
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: verdictColor, marginRight: 'var(--space-1)' }}></span>
                    Report #{r.id.slice(-6)}
                  </div>
                  <div className="contribution-message"><strong>Reason:</strong> {r.reason}</div>
                  <div className="contribution-message" style={{ fontSize: 'var(--text-sm)' }}>
                    <strong>Contributor:</strong> {r.contributorName || 'Unknown'} · <strong>Wisher:</strong> {r.wisherName || 'Unknown'}
                  </div>
                  <div className="contribution-message" style={{ fontSize: 'var(--text-xs)' }}>
                    <strong>Wisher UPI:</strong> {r.wisherUpiId || '—'}
                  </div>
                  <div className="contribution-message" style={{ fontSize: 'var(--text-xs)' }}>
                    <strong>Contribution:</strong> {r.contributionId?.slice(-8)} · <strong>Wishlist:</strong> {r.wishlistId?.slice(-8)}
                  </div>
                  <div className="contribution-time">{formatTime(r.createdAt)} · Status: <strong>{r.status}</strong></div>
                  {r.screenshot && (
                    <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                      <img src={r.screenshot} alt="Screenshot" onClick={() => setImgModal(r.screenshot)} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid var(--color-border-light)' }} />
                      <button className="btn-ghost" onClick={() => window.open(r.screenshot, '_blank', 'noopener,noreferrer')} style={{ fontSize: 'var(--text-xs)' }}>🔗 Open</button>
                    </div>
                  )}
                </div>
                {!isResolved ? (
                  <div className="confirm-actions" style={{ flexShrink: 0 }}>
                    <button className="btn btn-success btn-sm" onClick={() => handleConfirm(r)} disabled={rowBusy} style={{ padding: '0.5rem 1rem' }}>
                      {rowBusy ? '⏳' : '✅ Confirm Payment'}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => handleReject(r)} disabled={rowBusy} style={{ padding: '0.5rem 1rem', color: 'var(--color-error)' }}>
                      {rowBusy ? '⏳' : '❌ Mark Fake'}
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', flexShrink: 0, padding: '0.5rem' }}>
                    {verdictLabel}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
      {imgModal && (
        <div className="modal-overlay open" onClick={() => setImgModal(null)} style={{ cursor: 'pointer' }}>
          <img src={imgModal} alt="Screenshot full" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 'var(--radius-lg)' }} />
        </div>
      )}
    </main>
  );
}
