import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, signOut, onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, orderBy, serverTimestamp, writeBatch, onSnapshot, increment, runTransaction
} from 'firebase/firestore';
import { getMessaging, getToken as getFcmTokenRaw, onMessage, isSupported as isMessagingSupported } from 'firebase/messaging';

const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyCRillt8M7PSsrEgONTUN7eG7fjGO7gZSw",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "medicharoo.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "medicharoo",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "medicharoo.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "623917553571",
  appId: env.VITE_FIREBASE_APP_ID || "1:623917553571:web:14e26d05650fb176c1ec16",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-BFTNC087T3"
};

// Public VAPID key for FCM web push. Hardcoded as a fallback so the app works
// out of the box without .env.local — env var overrides this if set.
const VAPID_KEY = env.VITE_FIREBASE_VAPID_KEY ||
  "BBQVp5pRullW6zfhW7pDmxBO7y379POFnIF675d4nUuQZDm2qftgteo0Q_JjF7Ky5nVkNWuZDOyCrl1SZvLJLqo";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const BAN_THRESHOLD = 3;

function docToObj(d) { return d.exists() ? { id: d.id, ...d.data() } : null; }
function snapToArray(snap) { const a = []; snap.forEach(d => a.push({ id: d.id, ...d.data() })); return a; }

function getServerTime() { return serverTimestamp(); }

function formatTime(st) {
  if (!st) return '';
  const d = st?.toDate ? st.toDate() : (st?.seconds ? new Date(st.seconds * 1000) : new Date(st));
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 2592000000) return Math.floor(diff / 86400000) + 'd ago';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isValidHttpUrl(s) {
  if (!s) return true;
  return /^https?:\/\//i.test(s);
}

// --- Firebase Cloud Messaging ---
let _messagingInstance = null;
let _messagingChecked = false;

async function getMessagingInstance() {
  if (_messagingChecked) return _messagingInstance;
  _messagingChecked = true;
  try {
    if (!(await isMessagingSupported())) {
      console.warn('[FCM] Not supported in this browser.');
      return null;
    }
    _messagingInstance = getMessaging(app);
    return _messagingInstance;
  } catch (e) {
    console.error('[FCM] init failed:', e);
    return null;
  }
}

// Request permission (if needed), register the SW, fetch the token, log it, and
// persist it to users/{uid}.fcmToken so a server can later push to this device.
// Throws an Error with a descriptive message on failure (caller should catch and surface).
export async function getAndLogFcmToken() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('Service workers are not available in this browser.');
  }

  const messaging = await getMessagingInstance();
  if (!messaging) {
    throw new Error('Firebase Cloud Messaging is not supported in this browser.');
  }

  if (typeof Notification === 'undefined') {
    throw new Error('Browser Notification API is not available.');
  }
  if (Notification.permission === 'denied') {
    throw new Error('Notification permission is blocked. Reset it in the browser site settings.');
  }
  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      throw new Error('Notification permission not granted (state: ' + perm + ').');
    }
  }

  let reg;
  try {
    reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  } catch (e) {
    throw new Error('Service worker registration failed: ' + (e?.message || e));
  }

  let token;
  try {
    token = await getFcmTokenRaw(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg
    });
  } catch (e) {
    throw new Error('FCM getToken() failed: ' + (e?.code || e?.message || e));
  }

  if (!token) {
    throw new Error('FCM returned an empty token. Likely causes: Cloud Messaging is not enabled on this Firebase project, or the VAPID key does not match this project.');
  }

  console.log('[FCM] Token:', token);

  // Best-effort save to user doc so the backend can target this device.
  const u = getCurrentUser();
  if (u?.uid) {
    try {
      await setDoc(
        doc(db, 'users', u.uid),
        { fcmToken: token, fcmTokenUpdatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) { console.error('[FCM] failed to save token to user doc:', e); }
  }

  return token;
}

// Foreground message listener — logs payloads when the app tab is open.
// Returns an unsubscribe function.
export async function subscribeFcmForegroundMessages(callback) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, payload => {
    console.log('[FCM] Foreground message received:', payload);
    try { callback?.(payload); } catch (e) { console.error('[FCM] callback failed:', e); }
  });
}

async function assertNotBanned(uid) {
  if (!uid) return;
  try {
    const u = await getDoc(doc(db, 'users', uid));
    if (u.exists() && u.data().banned === true) {
      throw new Error('Your account has been restricted due to repeated reports.');
    }
  } catch (e) {
    if (e.message && e.message.includes('restricted')) throw e;
    // best-effort: if read fails (e.g. offline), don't block legit users
  }
}

// Atomically increment a strike counter on a user; flip `banned` if total crosses the threshold.
async function bumpUserStrike(uid, field) {
  if (!uid) return;
  const userRef = doc(db, 'users', uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const data = snap.exists() ? snap.data() : {};
    const next = { ...data, [field]: (data[field] || 0) + 1 };
    const total = (next.reportsAccepted || 0) + (next.falseReports || 0);
    const update = { [field]: increment(1) };
    if (total >= BAN_THRESHOLD && !data.banned) update.banned = true;
    if (snap.exists()) tx.update(userRef, update);
    else tx.set(userRef, { ...update, [field]: 1 }, { merge: true });
  });
}

// --- Auth ---
export function signInWithGoogle() { return signInWithPopup(auth, new GoogleAuthProvider()); }
export function signInWithEmail(email, password) { return signInWithEmailAndPassword(auth, email, password); }
export async function signUpWithEmail(email, password, name) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  return cred;
}
export function signOutUser() { return signOut(auth); }
export function onAuthChanged(cb) { return onAuthStateChanged(auth, cb); }
export function getCurrentUser() {
  const u = auth.currentUser;
  return u ? { uid: u.uid, name: u.displayName || 'User', email: u.email, photo: u.photoURL, upiId: '' } : null;
}

// --- Wishlists ---
export async function getWishlist(id) {
  const d = await getDoc(doc(db, 'wishlists', id));
  return docToObj(d);
}
export async function createWishlist(data) {
  const user = getCurrentUser();
  if (!user) throw new Error('You must be logged in to create a wishlist.');
  await assertNotBanned(user.uid);
  if (data.image && !isValidHttpUrl(data.image) && !data.image.startsWith('data:image/')) {
    throw new Error('Image must be a valid http(s) URL or uploaded file.');
  }
  if (data.productLink && !isValidHttpUrl(data.productLink)) {
    throw new Error('Product link must be a valid http(s) URL.');
  }
  const ref = doc(collection(db, 'wishlists'));
  const wishlist = {
    creatorUid: user.uid, creatorName: user.name,
    title: data.title.trim(), price: Math.abs(parseInt(data.price)) || 0, raised: 0, committed: 0,
    image: data.image || '', reason: data.reason.trim(), category: data.category || 'Other',
    upiId: data.upiId.trim(), productLink: data.productLink || '',
    status: 'active', createdAt: getServerTime()
  };
  await setDoc(ref, wishlist);
  await setDoc(doc(db, 'users', user.uid), {
    name: user.name, email: user.email, photo: user.photo || '', upiId: data.upiId.trim()
  }, { merge: true });
  return { id: ref.id, ...wishlist, createdAt: new Date().toISOString() };
}
export async function updateWishlist(id, updates) {
  if (updates.image !== undefined && updates.image && !isValidHttpUrl(updates.image) && !updates.image.startsWith('data:image/')) {
    throw new Error('Image must be a valid http(s) URL.');
  }
  await updateDoc(doc(db, 'wishlists', id), updates);
}
export async function deleteWishlist(id) { await deleteDoc(doc(db, 'wishlists', id)); }

// --- Contributions ---
export async function addContribution(wishlistId, { amount, name, message }) {
  const user = getCurrentUser();
  await assertNotBanned(user?.uid);
  const amt = Math.abs(parseInt(amount)) || 0;
  if (!amt || amt <= 0) throw new Error('Invalid amount');

  const wishlistRef = doc(db, 'wishlists', wishlistId);
  const contribRef = doc(collection(db, 'contributions'));

  // Single transaction: read wishlist, check capacity (raised + committed + amt <= price), create pending doc,
  // and increment committed. Prevents two contributors from both reserving the same remaining slot.
  let snapshot;
  await runTransaction(db, async (tx) => {
    const wSnap = await tx.get(wishlistRef);
    if (!wSnap.exists()) throw new Error('Wishlist not found');
    const w = wSnap.data();
    if (w.status === 'completed') throw new Error('Already fulfilled');
    const raised = w.raised || 0;
    const committed = w.committed || 0;
    const price = w.price || 0;
    if (raised >= price) throw new Error('Already fulfilled');
    if (raised + committed + amt > price) throw new Error('Amount exceeds remaining');

    const contrib = {
      wishlistId, wishlistCreatorUid: w.creatorUid,
      contributorUid: user?.uid || null,
      amount: amt,
      contributorName: (name || '').trim() || 'Anonymous',
      message: (message || '').trim(), status: 'pending', createdAt: getServerTime()
    };
    tx.set(contribRef, contrib);
    tx.update(wishlistRef, { committed: increment(amt) });
    snapshot = { contrib, w };
  });

  await setDoc(doc(collection(db, 'notifications')), {
    toUid: snapshot.w.creatorUid, type: 'new_contribution',
    fromName: snapshot.contrib.contributorName, fromUid: snapshot.contrib.contributorUid,
    wishlistId, wishlistTitle: snapshot.w.title, amount: snapshot.contrib.amount,
    message: snapshot.contrib.message, contributionId: contribRef.id,
    read: false, createdAt: getServerTime()
  });
  return { id: contribRef.id, ...snapshot.contrib };
}

export function subscribeReports(callback) {
  const q = query(collection(db, 'reports'));
  return onSnapshot(q, snap => {
    const list = snapToArray(snap);
    list.sort((a, b) => {
      const ta = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt).getTime() || 0;
      const tb = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt).getTime() || 0;
      return tb - ta;
    });
    callback(list);
  }, err => { onError(err); callback([]); });
}

export async function confirmContribution(contribId, wishlistId) {
  const contribRef = doc(db, 'contributions', contribId);
  const wishlistRef = doc(db, 'wishlists', wishlistId);
  let result;
  await runTransaction(db, async (tx) => {
    const cSnap = await tx.get(contribRef);
    const wSnap = await tx.get(wishlistRef);
    if (!cSnap.exists() || !wSnap.exists()) throw new Error('Cannot process');
    const c = cSnap.data();
    const w = wSnap.data();
    if (c.status !== 'pending') throw new Error('Cannot process');
    const amt = c.amount || 0;
    const newRaised = (w.raised || 0) + amt;
    const wlUpdate = {
      raised: increment(amt),
      committed: increment(-amt)
    };
    if (newRaised >= (w.price || 0)) wlUpdate.status = 'completed';
    tx.update(contribRef, { status: 'confirmed' });
    tx.update(wishlistRef, wlUpdate);
    result = { c, w };
  });
  if (result?.c?.contributorUid) {
    await setDoc(doc(collection(db, 'notifications')), {
      toUid: result.c.contributorUid, type: 'confirmed',
      fromName: result.w.creatorName, wishlistId, wishlistTitle: result.w.title,
      contributionId: contribId, amount: result.c.amount, read: false, createdAt: getServerTime()
    });
  }
}

export async function rejectContribution(contribId, wishlistId) {
  const contribRef = doc(db, 'contributions', contribId);
  const wishlistRef = doc(db, 'wishlists', wishlistId);
  let result;
  await runTransaction(db, async (tx) => {
    const cSnap = await tx.get(contribRef);
    const wSnap = await tx.get(wishlistRef);
    if (!cSnap.exists()) throw new Error('Cannot process');
    const c = cSnap.data();
    if (c.status !== 'pending') throw new Error('Cannot process');
    tx.update(contribRef, { status: 'rejected' });
    if (wSnap.exists()) tx.update(wishlistRef, { committed: increment(-(c.amount || 0)) });
    result = { c, w: wSnap.exists() ? wSnap.data() : null };
  });
  if (result?.c?.contributorUid) {
    await setDoc(doc(collection(db, 'notifications')), {
      toUid: result.c.contributorUid, type: 'rejected',
      fromName: result.w?.creatorName || '', wishlistId,
      wishlistTitle: result.w?.title || '',
      contributionId: contribId, amount: result.c.amount, read: false, createdAt: getServerTime()
    });
  }
}

// --- Admin: dispute resolution ---
// Admin agrees with the contributor: a rejected contribution gets credited to the wishlist after all.
// Idempotent — re-clicking is safe.
export async function adminAcceptReport(report) {
  const reportRef = doc(db, 'reports', report.id);
  const contribRef = doc(db, 'contributions', report.contributionId);
  const wishlistRef = doc(db, 'wishlists', report.wishlistId);
  let result;
  await runTransaction(db, async (tx) => {
    const [rSnap, cSnap, wSnap] = [
      await tx.get(reportRef),
      await tx.get(contribRef),
      await tx.get(wishlistRef)
    ];
    if (!rSnap.exists()) throw new Error('Report not found');
    const r = rSnap.data();
    if (r.status !== 'open') { result = { skipped: true }; return; }
    if (!cSnap.exists()) throw new Error('Contribution not found');
    const c = cSnap.data();
    const w = wSnap.exists() ? wSnap.data() : null;
    const amt = c.amount || 0;

    // Only credit if the contribution hasn't already been confirmed somehow.
    if (c.status !== 'confirmed') {
      tx.update(contribRef, { status: 'confirmed' });
      if (wSnap.exists()) {
        const newRaised = (w.raised || 0) + amt;
        const wlUpdate = { raised: increment(amt) };
        if (newRaised >= (w.price || 0)) wlUpdate.status = 'completed';
        tx.update(wishlistRef, wlUpdate);
      }
    }
    tx.update(reportRef, { status: 'accepted', resolvedAt: serverTimestamp() });
    result = { c, w, r };
  });

  if (result?.skipped) return;
  const c = result.c;
  const w = result.w;
  const wisherUid = w?.creatorUid || report.wisherUid;
  const wishlistTitle = w?.title || '';

  if (c.contributorUid) {
    await setDoc(doc(collection(db, 'notifications')), {
      toUid: c.contributorUid, type: 'report_accepted',
      fromName: 'Admin', wishlistId: report.wishlistId, wishlistTitle,
      contributionId: report.contributionId, amount: c.amount,
      read: false, createdAt: getServerTime()
    });
  }
  if (wisherUid) {
    await setDoc(doc(collection(db, 'notifications')), {
      toUid: wisherUid, type: 'report_accepted_against',
      fromName: 'Admin', wishlistId: report.wishlistId, wishlistTitle,
      contributionId: report.contributionId, amount: c.amount,
      read: false, createdAt: getServerTime()
    });
    await bumpUserStrike(wisherUid, 'reportsAccepted');
  }
}

export async function adminDismissReport(report) {
  const reportRef = doc(db, 'reports', report.id);
  const contribRef = doc(db, 'contributions', report.contributionId);
  const wishlistRef = doc(db, 'wishlists', report.wishlistId);
  let result;
  await runTransaction(db, async (tx) => {
    const [rSnap, cSnap, wSnap] = [
      await tx.get(reportRef),
      await tx.get(contribRef),
      await tx.get(wishlistRef)
    ];
    if (!rSnap.exists()) throw new Error('Report not found');
    const r = rSnap.data();
    if (r.status !== 'open') { result = { skipped: true }; return; }
    tx.update(reportRef, { status: 'rejected', resolvedAt: serverTimestamp() });
    result = {
      c: cSnap.exists() ? cSnap.data() : null,
      w: wSnap.exists() ? wSnap.data() : null,
      r
    };
  });

  if (result?.skipped) return;
  const c = result.c;
  const w = result.w;
  const wisherUid = w?.creatorUid || report.wisherUid;
  const contributorUid = c?.contributorUid || report.reportedBy;
  const wishlistTitle = w?.title || '';
  const amount = c?.amount || 0;

  if (contributorUid) {
    await setDoc(doc(collection(db, 'notifications')), {
      toUid: contributorUid, type: 'report_dismissed',
      fromName: 'Admin', wishlistId: report.wishlistId, wishlistTitle,
      contributionId: report.contributionId, amount,
      read: false, createdAt: getServerTime()
    });
    await bumpUserStrike(contributorUid, 'falseReports');
  }
  if (wisherUid) {
    await setDoc(doc(collection(db, 'notifications')), {
      toUid: wisherUid, type: 'report_dismissed_for',
      fromName: 'Admin', wishlistId: report.wishlistId, wishlistTitle,
      contributionId: report.contributionId, amount,
      read: false, createdAt: getServerTime()
    });
  }
}

// --- Notifications ---
export async function markNotificationRead(id) {
  await updateDoc(doc(db, 'notifications', id), { read: true });
}
export async function markAllNotificationsRead(uid) {
  if (!uid) return;
  const snap = await getDocs(query(collection(db, 'notifications'), where('toUid', '==', uid)));
  const batch = writeBatch(db);
  snap.forEach(d => {
    const data = d.data();
    if (!data.read) batch.update(d.ref, { read: true });
  });
  await batch.commit();
}

// --- Reports ---
// Reads a File as a base64 data URL — used to embed screenshots directly in Firestore.
// Firestore document limit is 1 MiB, so callers must cap raw file size to ~700 KB.
export function fileToDataUrl(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file. Try a different image.'));
    reader.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        const pct = Math.round((e.loaded / e.total) * 100);
        try { onProgress?.(pct); } catch {}
      }
    };
    reader.readAsDataURL(file);
  });
}

export async function submitReport({ contributionId, wishlistId, reason, screenshot }) {
  const current = getCurrentUser();
  await assertNotBanned(current?.uid);

  // Dedupe: refuse if an open report already exists for this contribution.
  const existing = await getDocs(
    query(
      collection(db, 'reports'),
      where('contributionId', '==', contributionId),
      where('status', '==', 'open')
    )
  );
  if (!existing.empty) throw new Error('A report is already open for this payment.');

  const ref = doc(collection(db, 'reports'));
  const [cSnap, wSnap] = await Promise.all([
    getDoc(doc(db, 'contributions', contributionId)),
    getDoc(doc(db, 'wishlists', wishlistId))
  ]);
  const c = docToObj(cSnap);
  const w = docToObj(wSnap);
  await setDoc(ref, {
    contributionId, wishlistId,
    reason: reason.trim(), screenshot: screenshot || '',
    status: 'open', reportedBy: current?.uid || null,
    contributorName: c?.contributorName || 'Unknown',
    contributorUid: c?.contributorUid || null,
    wisherName: w?.creatorName || 'Unknown',
    wisherUpiId: w?.upiId || '',
    wisherUid: w?.creatorUid || '',
    createdAt: getServerTime()
  });

  // Activity log entry for the reporter. read: true so it doesn't bump the unread badge —
  // the user just performed this action, no need to alert them.
  if (current?.uid) {
    try {
      await setDoc(doc(collection(db, 'notifications')), {
        toUid: current.uid, type: 'report_submitted',
        fromName: 'You', wishlistId, wishlistTitle: w?.title || '',
        contributionId, amount: c?.amount || 0,
        read: true, createdAt: getServerTime()
      });
    } catch (e) { onError(e); }
  }

  return { id: ref.id };
}

export function subscribeReportsForUser(uid, callback) {
  if (!uid) return () => {};
  const q = query(collection(db, 'reports'), where('reportedBy', '==', uid));
  return onSnapshot(q, snap => {
    const list = snapToArray(snap);
    list.sort((a, b) => {
      const ta = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt).getTime() || 0;
      const tb = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt).getTime() || 0;
      return tb - ta;
    });
    callback(list);
  }, err => { onError(err); callback([]); });
}

// --- User Profile ---
export async function getCreatorDisplay(uid) {
  if (uid === getCurrentUser()?.uid) return getCurrentUser();
  try {
    const d = await getDoc(doc(db, 'users', uid));
    return docToObj(d) || { name: 'Someone', photo: '' };
  } catch { return { name: 'Someone', photo: '' }; }
}
export async function saveUserProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

// --- Auto-confirm stale (>24h) ---
export async function autoConfirmStale() {
  const snap = await getDocs(query(collection(db, 'contributions'), where('status', '==', 'pending')));
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  const stale = [];
  snap.forEach(d => {
    const c = { id: d.id, ...d.data() };
    const t = c.createdAt?.toDate?.()?.getTime() || new Date(c.createdAt).getTime() || 0;
    if (t > 0 && t < cutoff) stale.push(c);
  });
  if (stale.length === 0) return 0;
  for (const c of stale) {
    const contribRef = doc(db, 'contributions', c.id);
    const wishlistRef = doc(db, 'wishlists', c.wishlistId);
    let title = '';
    try {
      await runTransaction(db, async (tx) => {
        const cSnap = await tx.get(contribRef);
        const wSnap = await tx.get(wishlistRef);
        if (!cSnap.exists() || cSnap.data().status !== 'pending') return;
        const w = wSnap.exists() ? wSnap.data() : null;
        title = w?.title || '';
        const amt = c.amount || 0;
        const newRaised = (w?.raised || 0) + amt;
        const upd = { raised: increment(amt), committed: increment(-amt) };
        if (w && newRaised >= (w.price || 0)) upd.status = 'completed';
        tx.update(contribRef, { status: 'confirmed' });
        if (wSnap.exists()) tx.update(wishlistRef, upd);
      });
    } catch (e) { onError(e); continue; }
    if (c.contributorUid) {
      try {
        await setDoc(doc(collection(db, 'notifications')), {
          toUid: c.contributorUid, type: 'confirmed',
          fromName: 'System', wishlistId: c.wishlistId, wishlistTitle: title,
          contributionId: c.id, amount: c.amount, read: false, createdAt: getServerTime()
        });
      } catch (e) { onError(e); }
    }
  }
  return stale.length;
}

// --- Real-time subscriptions ---
function onError(err) { console.error('sub err', err); }

export function subscribeNotifications(uid, callback) {
  if (!uid) return () => {};
  const q = query(collection(db, 'notifications'), where('toUid', '==', uid));
  return onSnapshot(q, snap => {
    const list = snapToArray(snap);
    list.sort((a, b) => {
      const ta = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt).getTime() || 0;
      const tb = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt).getTime() || 0;
      return tb - ta;
    });
    callback(list);
  }, err => { onError(err); callback([]); });
}
export function subscribeWishlists(callback) {
  const q = query(collection(db, 'wishlists'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => callback(snapToArray(snap)), err => { onError(err); callback([]); });
}
export function subscribeMyWishlists(uid, callback) {
  if (!uid) return () => {};
  const q = query(collection(db, 'wishlists'), where('creatorUid', '==', uid));
  return onSnapshot(q, snap => {
    const list = snapToArray(snap);
    list.sort((a, b) => {
      const ta = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt).getTime() || 0;
      const tb = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt).getTime() || 0;
      return tb - ta;
    });
    callback(list);
  }, err => { onError(err); callback([]); });
}
export function subscribeWishlist(id, callback) {
  if (!id) return () => {};
  return onSnapshot(doc(db, 'wishlists', id), snap => callback(docToObj(snap)), err => { onError(err); callback(null); });
}
export function subscribeContributions(wishlistId, callback) {
  if (!wishlistId) return () => {};
  const q = query(collection(db, 'contributions'), where('wishlistId', '==', wishlistId));
  return onSnapshot(q, snap => {
    const list = snapToArray(snap);
    list.sort((a, b) => {
      const ta = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt).getTime() || 0;
      const tb = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt).getTime() || 0;
      return tb - ta;
    });
    callback(list);
  }, err => { onError(err); callback([]); });
}
export function subscribePendingForUser(uid, callback) {
  if (!uid) return () => {};
  const q = query(collection(db, 'contributions'), where('wishlistCreatorUid', '==', uid), where('status', '==', 'pending'));
  return onSnapshot(q, snap => {
    const list = snapToArray(snap);
    list.sort((a, b) => {
      const ta = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt).getTime() || 0;
      const tb = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt).getTime() || 0;
      return tb - ta;
    });
    callback(list);
  }, err => { onError(err); callback([]); });
}

export { auth, db, formatTime, updateDoc, doc, collection, getDoc, getDocs, serverTimestamp, writeBatch, getFirestore, increment, deleteDoc };
