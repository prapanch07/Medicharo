import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { onAuthChanged, getCurrentUser, autoConfirmStale, subscribeUnreadCount, subscribeNotifications, getUnreadCount } from './firebase';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './components/Home';
import Detail from './components/Detail';
import Profile from './components/Profile';
import CreateWishlist from './components/CreateWishlist';
import NotificationsPage from './components/NotificationsPage';
import AdminReport from './components/AdminReport';
import Toast from './components/Toast';
import Onboarding from './components/Onboarding';

export const UserContext = createContext(null);
export const ToastContext = createContext(null);

export default function App() {
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('mc-theme') || 'light');
  const [notifPerm, setNotifPerm] = useState(localStorage.getItem('mc-notif-perm'));

  const lastNotifIdRef = useRef(null);
  const initialNotifLoadRef = useRef(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mc-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme(t => t === 'light' ? 'dark' : 'light'), []);

  useEffect(() => {
    let unsubUnread;
    const unsubAuth = onAuthChanged(u => {
      const usr = u ? { uid: u.uid, name: u.displayName || 'User', email: u.email, photo: u.photoURL } : null;
      setUser(usr);
      if (unsubUnread) unsubUnread();
      if (usr) unsubUnread = subscribeUnreadCount(usr.uid, setUnreadCount);
    });
    autoConfirmStale().catch(() => {});
    return () => { unsubAuth(); if (unsubUnread) unsubUnread(); };
  }, []);

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

  // Browser push notifications via Firestore subscription
  useEffect(() => {
    if (!user || notifPerm !== 'granted') return;
    initialNotifLoadRef.current = true;
    const unsub = subscribeNotifications(user.uid, list => {
      if (initialNotifLoadRef.current) {
        initialNotifLoadRef.current = false;
        if (list.length > 0) lastNotifIdRef.current = list[0].id;
        return;
      }
      if (list.length === 0) return;
      const latest = list[0];
      if (latest.id !== lastNotifIdRef.current) {
        lastNotifIdRef.current = latest.id;
        if (document.visibilityState === 'visible') return;
        const title = latest.type === 'new_contribution'
          ? '💰 ' + latest.fromName + ' contributed!'
          : (latest.type === 'confirmed' ? '✅ Payment confirmed' : '⚠️ Payment rejected');
        new Notification(title, { body: '₹' + latest.amount + ' · ' + latest.wishlistTitle });
      }
    });
    return unsub;
  }, [user, notifPerm]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const refreshUnread = useCallback(() => {
    if (user) getUnreadCount(user.uid).then(setUnreadCount).catch(() => {});
  }, [user]);

  function Layout() {
    const loc = useLocation();
    const isAdmin = loc.pathname === '/adminReport';
    return (
      <div className="app-wrapper">
        {!isAdmin && <Navbar toggleTheme={theme === 'dark' ? 'light' : 'dark'} onToggleTheme={toggleTheme} />}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wishlist/:id" element={<Detail />} />
          <Route path="/create" element={<CreateWishlist />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/adminReport" element={<AdminReport />} />
        </Routes>
        {!isAdmin && <Footer />}
        {!isAdmin && <Onboarding />}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ user, setUser, unreadCount, refreshUnread }}>
      <ToastContext.Provider value={showToast}>
        <BrowserRouter>
          <Layout />
        </BrowserRouter>
      </ToastContext.Provider>
    </UserContext.Provider>
  );
}
