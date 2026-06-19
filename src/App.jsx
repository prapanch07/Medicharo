import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { onAuthChanged, getCurrentUser, autoConfirmStale, subscribeUnreadCount } from './firebase';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './components/Home';
import Detail from './components/Detail';
import Profile from './components/Profile';
import CreateWishlist from './components/CreateWishlist';
import NotificationsPage from './components/NotificationsPage';
import Toast from './components/Toast';
import Onboarding from './components/Onboarding';

export const UserContext = createContext(null);
export const ToastContext = createContext(null);

export default function App() {
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('mc-theme') || 'light');

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

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const refreshUnread = useCallback(() => {
    if (user) getUnreadCount(user.uid).then(setUnreadCount).catch(() => {});
  }, [user]);

  return (
    <UserContext.Provider value={{ user, setUser, unreadCount, refreshUnread }}>
      <ToastContext.Provider value={showToast}>
        <BrowserRouter>
          <div className="app-wrapper">
            <Navbar toggleTheme={theme === 'dark' ? 'light' : 'dark'} onToggleTheme={toggleTheme} />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/wishlist/:id" element={<Detail />} />
              <Route path="/create" element={<CreateWishlist />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Routes>
            <Footer />
            <Onboarding />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          </div>
        </BrowserRouter>
      </ToastContext.Provider>
    </UserContext.Provider>
  );
}
