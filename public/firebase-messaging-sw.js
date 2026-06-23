// Background push handler — runs even when the app tab is closed.
// Uses the compat SDK because service workers can't reliably import the modular SDK.
// Config values are public and must match the ones in src/firebase.js exactly.
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCRillt8M7PSsrEgONTUN7eG7fjGO7gZSw',
  authDomain: 'medicharoo.firebaseapp.com',
  projectId: 'medicharoo',
  storageBucket: 'medicharoo.firebasestorage.app',
  messagingSenderId: '623917553571',
  appId: '1:623917553571:web:14e26d05650fb176c1ec16'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  console.log('[firebase-messaging-sw] Background message:', payload);
  const title = (payload.notification && payload.notification.title) || 'Medicharo';
  const body = (payload.notification && payload.notification.body) || '';
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    data: payload.data || {}
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.openWindow(url));
});
