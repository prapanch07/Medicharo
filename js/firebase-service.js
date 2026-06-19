/* =============================================
   MEDICHARO — Firebase Service
   ============================================= */

const Firebase = {
  /* --- Auth --- */
  signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    return auth.signInWithPopup(provider);
  },
  signInWithEmail(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
  },
  signUpWithEmail(email, password, name) {
    return auth.createUserWithEmailAndPassword(email, password)
      .then(cred => cred.user.updateProfile({ displayName: name }));
  },
  signOut() { return auth.signOut(); },
  onAuthChanged(cb) { return auth.onAuthStateChanged(cb); },
  getCurrentUser() {
    const u = auth.currentUser;
    return u ? { uid: u.uid, name: u.displayName || 'User', email: u.email, photo: u.photoURL, upiId: '' } : null;
  },

  /* --- Collections --- */
  _w() { return db.collection('wishlists'); },
  _c() { return db.collection('contributions'); },
  _n() { return db.collection('notifications'); },
  _u() { return db.collection('users'); },
  _r() { return db.collection('reports'); },

  _docToObj(doc) { return doc.exists ? { id: doc.id, ...doc.data() } : null; },
  _snapToArray(snap) { const a = []; snap.forEach(d => a.push({ id: d.id, ...d.data() })); return a; },
  now() { return firebase.firestore.FieldValue.serverTimestamp(); },

  /* --- Wishlists (no index needed) --- */
  async getWishlists() {
    const snap = await this._w().get();
    let list = this._snapToArray(snap);
    list.sort((a, b) => {
      const ta = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
      const tb = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
      return tb - ta;
    });
    return list;
  },

  async getWishlist(id) {
    const doc = await this._w().doc(id).get();
    return this._docToObj(doc);
  },

  async createWishlist(data) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('You must be logged in to create a wishlist.');
    const ref = this._w().doc();
    const wishlist = {
      creatorUid: user.uid,
      creatorName: user.name,
      title: data.title.trim(),
      price: Math.abs(parseInt(data.price)) || 0,
      raised: 0,
      image: data.image || '',
      reason: data.reason.trim(),
      category: data.category || 'Other',
      upiId: data.upiId.trim(),
      productLink: data.productLink || '',
      status: 'active',
      createdAt: this.now()
    };
    await ref.set(wishlist);
    await this._u().doc(user.uid).set({ name: user.name, email: user.email, photo: user.photo || '', upiId: data.upiId.trim() }, { merge: true });
    return { id: ref.id, ...wishlist, createdAt: new Date().toISOString() };
  },

  async updateWishlist(id, updates) { await this._w().doc(id).update(updates); },
  async deleteWishlist(id) { await this._w().doc(id).delete(); },

  async getMyWishlists(uid) {
    if (!uid) return [];
    const snap = await this._w().where('creatorUid', '==', uid).get();
    let list = this._snapToArray(snap);
    list.sort((a, b) => {
      const ta = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
      const tb = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
      return tb - ta;
    });
    return list;
  },

  /* --- Contributions --- */
  async addContribution(wishlistId, { amount, name, message }) {
    const w = await this.getWishlist(wishlistId);
    if (!w) throw new Error('Wishlist not found');
    if (w.status === 'completed' || (w.raised || 0) >= (w.price || 0)) throw new Error('Already fulfilled');
    if (!amount || amount <= 0) throw new Error('Invalid amount');
    if ((w.raised || 0) + amount > (w.price || 0)) throw new Error('Amount exceeds remaining');

    const ref = this._c().doc();
    const contrib = {
      wishlistId, wishlistCreatorUid: w.creatorUid,
      contributorUid: this.getCurrentUser()?.uid || null,
      amount: Math.abs(parseInt(amount)),
      contributorName: (name || '').trim() || 'Anonymous',
      message: (message || '').trim(),
      status: 'pending',
      createdAt: this.now()
    };
    await ref.set(contrib);

    // Notification to creator
    await this._n().doc().set({
      toUid: w.creatorUid, type: 'new_contribution',
      fromName: contrib.contributorName, fromUid: contrib.contributorUid,
      wishlistId, wishlistTitle: w.title, amount: contrib.amount,
      message: contrib.message, contributionId: ref.id,
      read: false, createdAt: this.now()
    });

    return { id: ref.id, ...contrib };
  },

  async confirmContribution(contribId, wishlistId) {
    const cSnap = await this._c().doc(contribId).get();
    const c = this._docToObj(cSnap);
    if (!c || c.status !== 'pending') throw new Error('Cannot process');

    await this._c().doc(contribId).update({ status: 'confirmed' });

    const w = await this.getWishlist(wishlistId);
    const newRaised = (w.raised || 0) + c.amount;
    const updates = { raised: newRaised };
    if (newRaised >= (w.price || 0)) updates.status = 'completed';
    await this._w().doc(wishlistId).update(updates);

    // Notify contributor if they have an account
    if (c.contributorUid) {
      await this._n().doc().set({
        toUid: c.contributorUid, type: 'confirmed',
        fromName: w.creatorName, wishlistId, wishlistTitle: w.title,
        amount: c.amount, read: false, createdAt: this.now()
      });
    }
  },

  async rejectContribution(contribId, wishlistId) {
    const cSnap = await this._c().doc(contribId).get();
    const c = this._docToObj(cSnap);
    if (!c || c.status !== 'pending') throw new Error('Cannot process');

    await this._c().doc(contribId).update({ status: 'rejected' });

    const w = await this.getWishlist(wishlistId);

    // Notify contributor
    if (c.contributorUid) {
      await this._n().doc().set({
        toUid: c.contributorUid, type: 'rejected',
        fromName: w.creatorName, wishlistId, wishlistTitle: w.title,
        contributionId: contribId, amount: c.amount, read: false, createdAt: this.now()
      });
    }
  },

  async getContributions(wishlistId) {
    const snap = await this._c().where('wishlistId', '==', wishlistId).get();
    let list = this._snapToArray(snap);
    list.sort((a, b) => {
      const ta = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
      const tb = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
      return tb - ta;
    });
    return list;
  },

  async getPendingForUser(uid) {
    if (!uid) return [];
    const wl = await this.getMyWishlists(uid);
    const ids = wl.map(w => w.id);
    if (ids.length === 0) return [];
    if (ids.length <= 10) {
      const snap = await this._c().where('wishlistId', 'in', ids).where('status', '==', 'pending').get();
      return this._snapToArray(snap);
    } else {
      const all = [];
      for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10);
        const snap = await this._c().where('wishlistId', 'in', batch).where('status', '==', 'pending').get();
        all.push(...this._snapToArray(snap));
      }
      return all;
    }
  },

  /* --- Notifications --- */
  async getNotifications(uid) {
    if (!uid) return [];
    const snap = await this._n().where('toUid', '==', uid).get();
    let list = this._snapToArray(snap);
    list.sort((a, b) => {
      const ta = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
      const tb = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
      return tb - ta;
    });
    return list;
  },

  async markRead(id) { try { await this._n().doc(id).update({ read: true }); } catch {} },

  async markAllRead(uid) {
    const snap = await this._n().where('toUid', '==', uid).where('read', '==', false).get();
    const batch = db.batch();
    snap.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  },

  async getUnreadCount(uid) {
    if (!uid) return 0;
    const snap = await this._n().where('toUid', '==', uid).where('read', '==', false).get();
    return snap.size;
  },

  /* --- Reports --- */
  async submitReport({ contributionId, wishlistId, reason, screenshot }) {
    const ref = this._r().doc();
    await ref.set({
      contributionId, wishlistId,
      reason: reason.trim(),
      screenshot: screenshot || '',
      status: 'open',
      reportedBy: this.getCurrentUser()?.uid || null,
      createdAt: this.now()
    });
    return { id: ref.id };
  },

  /* --- User Profile --- */
  async getCreatorDisplay(uid) {
    if (uid === this.getCurrentUser()?.uid) return this.getCurrentUser();
    try {
      const doc = await this._u().doc(uid).get();
      return this._docToObj(doc) || { name: 'Someone', photo: '' };
    } catch { return { name: 'Someone', photo: '' }; }
  },

  async saveUserProfile(uid, data) {
    await this._u().doc(uid).set(data, { merge: true });
  },

  /* --- Stats --- */
  async getStats() {
    const [wlSnap, cSnap] = await Promise.all([this._w().get(), this._c().get()]);
    const wl = this._snapToArray(wlSnap);
    const total = wl.length;
    const active = wl.filter(w => w.status === 'active' || !w.status).length;
    const completed = wl.filter(w => w.status === 'completed').length;
    const raised = wl.reduce((s, w) => s + (w.raised || 0), 0);
    return { totalWishes: total, activeWishes: active, completedWishes: completed, totalRaised: raised, totalContributors: cSnap.size, contributorCount: cSnap.size };
  },

  /* --- Auto-confirm stale contributions (>24h) --- */
  async autoConfirmStale() {
    const snap = await this._c().where('status', '==', 'pending').get();
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000;
    const stale = [];
    snap.forEach(doc => {
      const c = { id: doc.id, ...doc.data() };
      const t = c.createdAt ? (c.createdAt.toDate ? c.createdAt.toDate().getTime() : new Date(c.createdAt).getTime()) : 0;
      if (t > 0 && t < cutoff) stale.push(c);
    });
    if (stale.length === 0) return 0;

    const wlUpdates = {};
    for (const c of stale) {
      await this._c().doc(c.id).update({ status: 'confirmed' });
      wlUpdates[c.wishlistId] = (wlUpdates[c.wishlistId] || 0) + (c.amount || 0);
      if (c.contributorUid) {
        const w = await this.getWishlist(c.wishlistId);
        await this._n().doc().set({
          toUid: c.contributorUid, type: 'confirmed',
          fromName: 'System', wishlistId: c.wishlistId, wishlistTitle: w ? w.title : '',
          amount: c.amount, read: false, createdAt: this.now()
        });
      }
    }
    for (const [wlId, amount] of Object.entries(wlUpdates)) {
      const w = await this.getWishlist(wlId);
      if (!w) continue;
      const newRaised = (w.raised || 0) + amount;
      const upd = { raised: newRaised };
      if (newRaised >= (w.price || 0)) upd.status = 'completed';
      await this._w().doc(wlId).update(upd);
    }
    return stale.length;
  }
};
