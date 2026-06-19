import { useState, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserContext } from '../App';
import { signOutUser, markAllNotificationsRead } from '../firebase';
import LoginModal from './LoginModal';
import NotificationModal from './NotificationModal';

export default function Navbar({ toggleTheme, onToggleTheme }) {
  const { user, setUser, unreadCount, refreshUnread } = useContext(UserContext);
  const loc = useLocation();
  const [showLogin, setShowLogin] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOutUser();
    setUser(null);
  };

  return (
    <>
      <nav className="navbar">
        <div className="container">
          <div className="navbar-left">
            <Link to="/" className="navbar-logo"><span className="navbar-logo-icon">M</span> Medicharo</Link>
            <div className={'navbar-links' + (menuOpen ? ' open' : '')} style={menuOpen ? { display: 'flex' } : {}}>
              <Link to="/" className={'navbar-link' + (loc.pathname === '/' ? ' active' : '')} onClick={() => setMenuOpen(false)}>Home</Link>
              <Link to="/create" className={'navbar-link' + (loc.pathname === '/create' ? ' active' : '')} onClick={() => setMenuOpen(false)}>Create Wishlist</Link>
            </div>
          </div>
          <div className="navbar-right">
            <button className="theme-toggle" onClick={onToggleTheme} aria-label="Toggle theme">
              {toggleTheme === 'dark' ? '🌙' : '☀️'}
            </button>
            {user ? (
              <>
                <button className="navbar-bell-btn" onClick={() => { setShowNotifs(o => !o); if (user) { markAllNotificationsRead(user.uid).catch(() => {}).then(() => refreshUnread()); } }} aria-label="Notifications">
                  🔔
                  {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </button>
                <Link to="/profile" className="navbar-profile-link" onClick={() => setMenuOpen(false)}>
                  <div className="avatar avatar-sm">{user.photo ? <img src={user.photo} alt="" /> : (user.name || 'U')[0]}</div>
                </Link>
              </>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => setShowLogin(true)}>Sign In</button>
            )}
            <button className="mobile-menu-btn" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </nav>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => { setShowLogin(false); refreshUnread(); }} />}
      {showNotifs && <NotificationModal onClose={() => setShowNotifs(false)} />}
    </>
  );
}