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
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyCRillt8M7PSsrEgONTUN7eG7fjGO7gZSw",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "medicharoo.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "medicharoo",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "medicharoo.appspot.com",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "787790285383",
  appId: env.VITE_FIREBASE_APP_ID || "1:787790285383:web:41ffcb139eaff2e64a26cd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

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
  if (data.image && !isValidHttpUrl(data.image) && !data.image.startsWith('data:image/')) {
    throw new Error('Image must be a valid http(s) URL or uploaded file.');
  }
  if (data.productLink && !isValidHttpUrl(data.productLink)) {
    throw new Error('Product link must be a valid http(s) URL.');
  }
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
export async function updateWishlist(id, updates) {
  if (updates.image !== undefined && updates.image && !isValidHttpUrl(updates.image) && !updates.image.startsWith('data:image/')) {
    throw new Error('Image must be a valid http(s) URL.');
  }
  await updateDoc(doc(db, 'wishlists', id), updates);
}
export async function deleteWishlist(id) { await deleteDoc(doc(db, 'wishlists', id)); }

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
    const newRaised = (w.raised || 0) + (c.amount || 0);
    const wlUpdate = { raised: increment(c.amount || 0) };
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
export async function uploadReportScreenshot(uid, file) {
  if (!file) return '';
  const safeUid = uid || 'anon';
  const path = `reports/${safeUid}/${Date.now()}_${file.name}`.replace(/\s+/g, '_');
  const sRef = storageRef(storage, path);
  await uploadBytes(sRef, file, { contentType: file.type });
  return await getDownloadURL(sRef);
}

export async function submitReport({ contributionId, wishlistId, reason, screenshot }) {
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
    status: 'open', reportedBy: getCurrentUser()?.uid || null,
    contributorName: c?.contributorName || 'Unknown',
    wisherName: w?.creatorName || 'Unknown',
    wisherUpiId: w?.upiId || '',
    wisherUid: w?.creatorUid || '',
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
        const newRaised = (w?.raised || 0) + (c.amount || 0);
        const upd = { raised: increment(c.amount || 0) };
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

export { auth, db, storage, formatTime, updateDoc, doc, collection, getDoc, getDocs, serverTimestamp, writeBatch, getFirestore, increment, deleteDoc };
