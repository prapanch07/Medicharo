/* =============================================
   MEDICHARO — Data Store (Firebase)
   ============================================= */

const Store = {
  async signInWithGoogle() { return Firebase.signInWithGoogle(); },
  async signInWithEmail(e, p) { return Firebase.signInWithEmail(e, p); },
  async signUpWithEmail(e, p, n) { return Firebase.signUpWithEmail(e, p, n); },
  async signOut() { return Firebase.signOut(); },
  onAuthChanged(cb) { return Firebase.onAuthChanged(cb); },
  getCurrentUser() { return Firebase.getCurrentUser(); },

  async getWishlists() { return Firebase.getWishlists(); },
  async getWishlist(id) { return Firebase.getWishlist(id); },
  async createWishlist(data) { return Firebase.createWishlist(data); },
  async updateWishlist(id, u) { return Firebase.updateWishlist(id, u); },
  async deleteWishlist(id) { return Firebase.deleteWishlist(id); },
  async getMyWishlists(uid) { return Firebase.getMyWishlists(uid); },

  async addContribution(id, d) { return Firebase.addContribution(id, d); },
  async confirmContribution(ci, wi) { return Firebase.confirmContribution(ci, wi); },
  async rejectContribution(ci, wi) { return Firebase.rejectContribution(ci, wi); },
  async getContributions(wi) { return Firebase.getContributions(wi); },
  async getPendingForUser(uid) { return Firebase.getPendingForUser(uid); },
  async getPendingContributionsForUser(uid) { return Firebase.getPendingForUser(uid); },

  async getNotifications(uid) { return Firebase.getNotifications(uid); },
  async markNotificationRead(id) { return Firebase.markRead(id); },
  async markAllNotificationsRead(uid) { return Firebase.markAllRead(uid); },
  async getUnreadCount(uid) { return Firebase.getUnreadCount(uid); },

  async submitReport(d) { return Firebase.submitReport(d); },

  async getCreatorDisplay(uid) { return Firebase.getCreatorDisplay(uid); },
  async saveUserProfile(uid, d) { return Firebase.saveUserProfile(uid, d); },

  async getStats() { return Firebase.getStats(); },
  async autoConfirmStale() { return Firebase.autoConfirmStale(); },

  formatServerTime(st) {
    if (!st) return '';
    if (st.toDate) return this._fmt(st.toDate().toISOString());
    if (st.seconds) return this._fmt(new Date(st.seconds * 1000).toISOString());
    return this._fmt(st);
  },
  _fmt(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 2592000000) return Math.floor(diff / 86400000) + 'd ago';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
};
