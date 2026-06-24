import React, { useState, useEffect, useCallback, useMemo, createContext, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { onAuthChanged, autoConfirmStale, subscribeNotifications, subscribeReportsForUser, ensureUserDoc } from './firebase';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './components/Home';
import Toast from './components/Toast';
import Onboarding from './components/Onboarding';

const Detail = lazy(() => import('./components/Detail'));
const Profile = lazy(() => import('./components/Profile'));
const CreateWishlist = lazy(() => import('./components/CreateWishlist'));
const NotificationsPage = lazy(() => import('./components/NotificationsPage'));
const AdminReport = lazy(() => import('./components/AdminReport'));

export const UserContext = createContext(null);
export const ToastContext = createContext(null);

function RouteFallback() {
  return (
    <main id="main-content">
      <div className="loader-inline" style={{ justifyContent: 'center', paddingTop: '120px' }}>
        <span className="spinner"></span> Loading...
      </div>
    </main>
  );
}

// IMPORTANT: AppShell is declared at module scope (NOT inside App). React identifies
// components by reference; declaring it inside App would create a new function on every
// render, and React would unmount + remount the entire UI subtree each time — wiping
// Navbar's `showNotifs` state, scroll position, modal open state, etc., on every Firestore
// subscription update. Stable top-level reference means App re-renders just propagate
// props/context to AppShell without remounting.
function AppShell({ theme, toggleTheme, toast, clearToast }) {
  const loc = useLocation();
  const isAdmin = loc.pathname === '/adminReport';
  return (
    <div className="app-wrapper">
      {!isAdmin && <Navbar toggleTheme={theme === 'dark' ? 'light' : 'dark'} onToggleTheme={toggleTheme} />}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wishlist/:id" element={<Detail />} />
          <Route path="/create" element={<CreateWishlist />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/adminReport" element={<AdminReport />} />
        </Routes>
      </Suspense>
      {!isAdmin && <Footer />}
      {!isAdmin && <Onboarding />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [userReports, setUserReports] = useState([]);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('mc-theme') || 'light');

  const toastTimerRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mc-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme(t => t === 'light' ? 'dark' : 'light'), []);

  useEffect(() => {
    const unsubAuth = onAuthChanged(u => {
      const usr = u ? { uid: u.uid, name: u.displayName || 'User', email: u.email, photo: u.photoURL } : null;
      setUser(usr);
      if (usr) ensureUserDoc(usr);
    });
    return () => { unsubAuth(); };
  }, []);

  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    return subscribeNotifications(user.uid, setNotifications);
  }, [user]);

  // Reports filed by the current user — used by Detail.jsx (status badges)
  // and Profile.jsx (activity log).
  useEffect(() => {
    if (!user) { setUserReports([]); return; }
    return subscribeReportsForUser(user.uid, setUserReports);
  }, [user]);

  // Run autoConfirmStale at most once per browser session, only for signed-in users.
  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem('mc-auto-confirm-ran') === '1') return;
    sessionStorage.setItem('mc-auto-confirm-ran', '1');
    autoConfirmStale().catch(() => {});
  }, [user]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const unreadCount = useMemo(
    () => notifications.reduce((n, x) => n + (x.read ? 0 : 1), 0),
    [notifications]
  );

  const refreshUnread = useCallback(() => {}, []);

  // Memoize the context value so consumers don't re-render when unrelated App state
  // (toast, theme) changes. Only re-emits a new value when one of these fields actually
  // changes.
  const userContextValue = useMemo(() => ({
    user, setUser, unreadCount, notifications, userReports, refreshUnread
  }), [user, unreadCount, notifications, userReports, refreshUnread]);

  return (
    <UserContext.Provider value={userContextValue}>
      <ToastContext.Provider value={showToast}>
        <BrowserRouter>
          <AppShell
            theme={theme}
            toggleTheme={toggleTheme}
            toast={toast}
            clearToast={clearToast}
          />
        </BrowserRouter>
      </ToastContext.Provider>
    </UserContext.Provider>
  );
}
