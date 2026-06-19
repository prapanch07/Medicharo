import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, signOut, onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, orderBy, serverTimestamp, writeBatch, onSnapshot
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCRillt8M7PSsrEgONTUN7eG7fjGO7gZSw",
  authDomain: "medicharoo.firebaseapp.com",
  projectId: "medicharoo",
  storageBucket: "medicharoo.appspot.com",
  messagingSenderId: "787790285383",
  appId: "1:787790285383:web:41ffcb139eaff2e64a26cd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
export async function getWishlists() {
  const snap = await getDocs(collection(db, 'wishlists'));
  const list = snapToArray(snap);
  list.sort((a, b) => {
    const ta = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt).getTime() || 0;
    const tb = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt).getTime() || 0;
    return tb - ta;
  });
  return list;
}
export async function getWishlist(id) {
  const d = await getDoc(doc(db, 'wishlists', id));
  return docToObj(d);
}
export async function createWishlist(data) {
  const user = getCurrentUser();
  if (!user) throw new Error('You must be logged in to create a wishlist.');
  const ref = doc(collection(db, 'wishlists'));
  const wishlist = {
    creatorUid: user.uid, creatorName: user.name,
    title: data.title.trim(), price: Math.abs(parseInt(data.price)) || 0, raised: 0,
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
export async function updateWishlist(id, updates) { await updateDoc(doc(db, 'wishlists', id), updates); }
export async function deleteWishlist(id) { await deleteDoc(doc(db, 'wishlists', id)); }
export async function getMyWishlists(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, 'wishlists'), where('creatorUid', '==', uid)));
  const list = snapToArray(snap);
  list.sort((a, b) => {
    const ta = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt).getTime() || 0;
    const tb = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt).getTime() || 0;
    return tb - ta;
  });
  return list;
}

// --- Contributions ---
export async function addContribution(wishlistId, { amount, name, message }) {
  const w = await getWishlist(wishlistId);
  if (!w) throw new Error('Wishlist not found');
  if (w.status === 'completed' || (w.raised || 0) >= (w.price || 0)) throw new Error('Already fulfilled');
  if (!amount || amount <= 0) throw new Error('Invalid amount');
  if ((w.raised || 0) + amount > (w.price || 0)) throw new Error('Amount exceeds remaining');

  const user = getCurrentUser();
  const ref = doc(collection(db, 'contributions'));
  const contrib = {
    wishlistId, wishlistCreatorUid: w.creatorUid,
    contributorUid: user?.uid || null,
    amount: Math.abs(parseInt(amount)),
    contributorName: (name || '').trim() || 'Anonymous',
    message: (message || '').trim(), status: 'pending', createdAt: getServerTime()
  };
  await setDoc(ref, contrib);

  await setDoc(doc(collection(db, 'notifications')), {
    toUid: w.creatorUid, type: 'new_contribution',
    fromName: contrib.contributorName, fromUid: contrib.contributorUid,
    wishlistId, wishlistTitle: w.title, amount: contrib.amount,
    message: contrib.message, contributionId: ref.id,
    read: false, createdAt: getServerTime()
  });
  return { id: ref.id, ...contrib };
}
export async function confirmContribution(contribId, wishlistId) {
  const cSnap = await getDoc(doc(db, 'contributions', contribId));
  const c = docToObj(cSnap);
  if (!c || c.status !== 'pending') throw new Error('Cannot process');
  await updateDoc(doc(db, 'contributions', contribId), { status: 'confirmed' });
  const w = await getWishlist(wishlistId);
  const newRaised = (w.raised || 0) + c.amount;
  const updates = { raised: newRaised };
  if (newRaised >= (w.price || 0)) updates.status = 'completed';
  await updateDoc(doc(db, 'wishlists', wishlistId), updates);
  if (c.contributorUid) {
    await setDoc(doc(collection(db, 'notifications')), {
      toUid: c.contributorUid, type: 'confirmed',
      fromName: w.creatorName, wishlistId, wishlistTitle: w.title,
      amount: c.amount, read: false, createdAt: getServerTime()
    });
  }
}
export async function rejectContribution(contribId, wishlistId) {
  const cSnap = await getDoc(doc(db, 'contributions', contribId));
  const c = docToObj(cSnap);
  if (!c || c.status !== 'pending') throw new Error('Cannot process');
  await updateDoc(doc(db, 'contributions', contribId), { status: 'rejected' });
  const w = await getWishlist(wishlistId);
  if (c.contributorUid) {
    await setDoc(doc(collection(db, 'notifications')), {
      toUid: c.contributorUid, type: 'rejected',
      fromName: w.creatorName, wishlistId, wishlistTitle: w.title,
      contributionId: contribId, amount: c.amount, read: false, createdAt: getServerTime()
    });
  }
}
export async function getContributions(wishlistId) {
  const snap = await getDocs(query(collection(db, 'contributions'), where('wishlistId', '==', wishlistId)));
  const list = snapToArray(snap);
  list.sort((a, b) => {
    const ta = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt).getTime() || 0;
    const tb = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt).getTime() || 0;
    return tb - ta;
  });
  return list;
}
export async function getPendingForUser(uid) {
  if (!uid) return [];
  const wl = await getMyWishlists(uid);
  const ids = wl.map(w => w.id);
  if (ids.length === 0) return [];
  if (ids.length <= 10) {
    const snap = await getDocs(query(collection(db, 'contributions'), where('wishlistId', 'in', ids), where('status', '==', 'pending')));
    return snapToArray(snap);
  }
  const all = [];
  for (let i = 0; i < ids.length; i += 10) {
    const snap = await getDocs(query(collection(db, 'contributions'), where('wishlistId', 'in', ids.slice(i, i + 10)), where('status', '==', 'pending')));
    all.push(...snapToArray(snap));
  }
  return all;
}

// --- Notifications ---
export async function getNotifications(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, 'notifications'), where('toUid', '==', uid), orderBy('createdAt', 'desc')));
  return snapToArray(snap);
}
export async function markNotificationRead(id) {
  await updateDoc(doc(db, 'notifications', id), { read: true });
}
export async function markAllNotificationsRead(uid) {
  const snap = await getDocs(query(collection(db, 'notifications'), where('toUid', '==', uid), where('read', '==', false)));
  const batch = writeBatch(db);
  snap.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}
export async function getUnreadCount(uid) {
  if (!uid) return 0;
  const snap = await getDocs(query(collection(db, 'notifications'), where('toUid', '==', uid), where('read', '==', false)));
  return snap.size;
}

// --- Reports ---
export async function submitReport({ contributionId, wishlistId, reason, screenshot }) {
  const ref = doc(collection(db, 'reports'));
  await setDoc(ref, {
    contributionId, wishlistId,
    reason: reason.trim(), screenshot: screenshot || '',
    status: 'open', reportedBy: getCurrentUser()?.uid || null,
    createdAt: getServerTime()
  });
  return { id: ref.id };
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

// --- Stats ---
export async function getStats() {
  const [wlSnap, cSnap] = await Promise.all([
    getDocs(collection(db, 'wishlists')),
    getDocs(collection(db, 'contributions'))
  ]);
  const wl = snapToArray(wlSnap);
  return {
    totalWishes: wl.length,
    activeWishes: wl.filter(w => w.status === 'active' || !w.status).length,
    completedWishes: wl.filter(w => w.status === 'completed').length,
    totalRaised: wl.reduce((s, w) => s + (w.raised || 0), 0),
    contributorCount: cSnap.size
  };
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
  const wlUpdates = {};
  for (const c of stale) {
    await updateDoc(doc(db, 'contributions', c.id), { status: 'confirmed' });
    wlUpdates[c.wishlistId] = (wlUpdates[c.wishlistId] || 0) + (c.amount || 0);
    if (c.contributorUid) {
      const w = await getWishlist(c.wishlistId);
      await setDoc(doc(collection(db, 'notifications')), {
        toUid: c.contributorUid, type: 'confirmed',
        fromName: 'System', wishlistId: c.wishlistId, wishlistTitle: w?.title || '',
        amount: c.amount, read: false, createdAt: getServerTime()
      });
    }
  }
  for (const [wlId, amount] of Object.entries(wlUpdates)) {
    const w = await getWishlist(wlId);
    if (!w) continue;
    const newRaised = (w.raised || 0) + amount;
    const upd = { raised: newRaised };
    if (newRaised >= (w.price || 0)) upd.status = 'completed';
    await updateDoc(doc(db, 'wishlists', wlId), upd);
  }
  return stale.length;
}

// --- Real-time subscriptions ---
export function subscribeNotifications(uid, callback) {
  if (!uid) return () => {};
  const q = query(collection(db, 'notifications'), where('toUid', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => callback(snapToArray(snap)), err => { console.error('notif sub err', err); callback([]); });
}
export function subscribeUnreadCount(uid, callback) {
  if (!uid) return () => {};
  const q = query(collection(db, 'notifications'), where('toUid', '==', uid), where('read', '==', false));
  return onSnapshot(q, snap => callback(snap.size));
}
export function subscribeWishlists(callback) {
  const q = query(collection(db, 'wishlists'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => callback(snapToArray(snap)));
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
  });
}
export function subscribeWishlist(id, callback) {
  if (!id) return () => {};
  return onSnapshot(doc(db, 'wishlists', id), snap => callback(docToObj(snap)));
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
  });
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
  });
}

export { auth, db, formatTime };
