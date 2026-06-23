import React, { useState, useEffect, useCallback, createContext, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { onAuthChanged, autoConfirmStale, subscribeNotifications, subscribeReportsForUser, getAndLogFcmToken, subscribeFcmForegroundMessages } from './firebase';
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

export default function App() {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [userReports, setUserReports] = useState([]);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('mc-theme') || 'light');
  const [notifPerm, setNotifPerm] = useState(localStorage.getItem('mc-notif-perm'));

  const lastNotifIdRef = useRef(null);
  const initialNotifLoadRef = useRef(true);
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
    });
    return () => { unsubAuth(); };
  }, []);

  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    initialNotifLoadRef.current = true;
    const unsub = subscribeNotifications(user.uid, list => {
      setNotifications(list);
      if (initialNotifLoadRef.current) {
        initialNotifLoadRef.current = false;
        if (list.length > 0) lastNotifIdRef.current = list[0].id;
        return;
      }
      if (notifPerm !== 'granted' || list.length === 0) return;
      const latest = list[0];
      if (latest.id !== lastNotifIdRef.current) {
        lastNotifIdRef.current = latest.id;
        if (document.visibilityState === 'visible') return;
        if (!('Notification' in window)) return;
        const title = latest.type === 'new_contribution'
          ? '💰 ' + latest.fromName + ' contributed!'
          : (latest.type === 'confirmed' ? '✅ Payment confirmed' : '⚠️ Payment rejected');
        try { new Notification(title, { body: '₹' + latest.amount + ' · ' + latest.wishlistTitle }); } catch {}
      }
    });
    return unsub;
  }, [user, notifPerm]);

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

  // Fetch + log FCM token once the user is signed in and has granted notification
  // permission. Saves the token to users/{uid}.fcmToken so a server can target this device.
  useEffect(() => {
    if (!user || notifPerm !== 'granted') return;
    getAndLogFcmToken().catch(err => console.warn('[FCM] auto-init skipped:', err.message));
    let unsub;
    subscribeFcmForegroundMessages().then(fn => { unsub = fn; });
    return () => { if (unsub) unsub(); };
  }, [user, notifPerm]);

  // Ask notification permission after onboarding
  useEffect(() => {
    const onboardingDone = localStorage.getItem('mc-onboarding');
    if (onboardingDone && !notifPerm && 'Notification' in window) {
      Notification.requestPermission().then(perm => {
        localStorage.setItem('mc-notif-perm', perm);
        setNotifPerm(perm);
      });
    }
  }, [notifPerm]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const unreadCount = notifications.reduce((n, x) => n + (x.read ? 0 : 1), 0);
  const refreshUnread = useCallback(() => {}, []);

  function Layout() {
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
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ user, setUser, unreadCount, notifications, userReports, refreshUnread }}>
      <ToastContext.Provider value={showToast}>
        <BrowserRouter>
          <Layout />
        </BrowserRouter>
      </ToastContext.Provider>
    </UserContext.Provider>
  );
}
