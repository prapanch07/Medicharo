/* =============================================
   MEDICHARO — Application
   ============================================= */

const App = {
  state: {
    currentPage: 'home',
    currentWishlistId: null,
    theme: localStorage.getItem('mc-theme') || 'light',
    searchQuery: '',
    activeFilter: 'all',
    sortBy: 'latest',
    profileTab: 'active',
    user: null,
    unreadCount: 0
  },

  /* --- Init --- */
  init() {
    this.applyTheme();
    Firebase.onAuthChanged(user => {
      this.state.user = user ? { uid: user.uid, name: user.displayName || 'User', email: user.email, photo: user.photoURL } : null;
      if (this.state.user) {
        this.loadUnreadCount();
      }
      this.handleRoute();
    });
    window.addEventListener('hashchange', () => this.handleRoute());
    Store.autoConfirmStale().catch(() => {});
  },

  async loadUnreadCount() {
    if (!this.state.user) return;
    const count = await Store.getUnreadCount(this.state.user.uid);
    this.state.unreadCount = count;
    this.updateNavbarBadge();
  },

  updateNavbarBadge() {
    const badge = document.getElementById('notifBadge');
    if (badge) {
      badge.textContent = this.state.unreadCount > 0 ? (this.state.unreadCount > 99 ? '99+' : this.state.unreadCount) : '';
      badge.style.display = this.state.unreadCount > 0 ? 'flex' : 'none';
    }
  },

  /* --- Theme --- */
  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.state.theme);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = this.state.theme === 'dark' ? '☀️' : '🌙';
  },
  toggleTheme() {
    this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('mc-theme', this.state.theme);
    this.applyTheme();
  },

  /* --- Routing --- */
  handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    this.navigate(hash, true);
  },

  navigate(path, replace = false) {
    if (!replace) { window.location.hash = path; return; }
    if (path === '/') { this.state.currentPage = 'home'; this.state.currentWishlistId = null; }
    else if (path.startsWith('/wishlist/')) {
      const id = path.split('/')[2];
      this.state.currentPage = 'detail';
      this.state.currentWishlistId = id;
    } else if (path === '/create') {
      if (!this.state.user) { this.openLoginModal(); return; }
      this.state.currentPage = 'create';
    } else if (path === '/profile') {
      if (!this.state.user) { this.openLoginModal(); return; }
      this.state.currentPage = 'profile';
    } else { this.state.currentPage = 'home'; }
    this.render();
  },

  /* --- Render --- */
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '';

    this._renderCache = {}; // Cache for parallel data fetches

    app.appendChild(this.renderNavbar());
    const main = document.createElement('main');
    main.id = 'main-content';

    try {
      switch (this.state.currentPage) {
        case 'home':
          main.appendChild(this.renderHeroSkeleton());
          main.appendChild(this.renderSearch());
          main.appendChild(this.renderCategoriesSkeleton());
          main.appendChild(this.renderGridSkeleton());
          app.appendChild(main);
          this.afterRender();

          const [wl, stats] = await Promise.all([Store.getWishlists(), Store.getStats()]);
          this._renderCache.wishlists = wl;
          this._renderCache.stats = stats;

          const newMain = document.createElement('main');
          newMain.id = 'main-content';
          newMain.appendChild(this.renderHero(stats));
          newMain.appendChild(this.renderSearch());
          newMain.appendChild(this.renderCategories(wl));
          newMain.appendChild(this.renderWishlistGrid(wl));
          newMain.appendChild(this.renderFooter());
          app.replaceChild(newMain, main);
          this.afterRender();
          return;

        case 'detail':
          main.innerHTML = '<div style="padding:120px 2rem;text-align:center;color:var(--color-text-muted)">⏳ Loading...</div>';
          app.appendChild(main);
          this.afterRender();
          const w = await Store.getWishlist(this.state.currentWishlistId);
          if (!w) { window.location.hash = '/'; return; }
          const [contribs, creator] = await Promise.all([Store.getContributions(w.id), Store.getCreatorDisplay(w.creatorUid)]);
          const detailMain = document.createElement('main');
          detailMain.id = 'main-content';
          detailMain.appendChild(this.renderDetailPage(w, contribs, creator));
          app.replaceChild(detailMain, main);
          this.afterRender();
          return;

        case 'create':
          main.appendChild(this.renderCreatePage());
          main.appendChild(this.renderFooter());
          break;

        case 'profile':
          main.innerHTML = '<div style="padding:120px 2rem;text-align:center;color:var(--color-text-muted)">⏳ Loading...</div>';
          app.appendChild(main);
          this.afterRender();
          const myWl = await Store.getMyWishlists(this.state.user.uid);
          const notifs = await Store.getNotifications(this.state.user.uid);
          const pending = await Store.getPendingContributionsForUser(this.state.user.uid);
          const profileMain = document.createElement('main');
          profileMain.id = 'main-content';
          profileMain.appendChild(this.renderProfilePage(myWl, notifs, pending));
          profileMain.appendChild(this.renderFooter());
          app.replaceChild(profileMain, main);
          this.afterRender();
          return;
      }
    } catch (err) {
      main.innerHTML = this.renderError(err.message || 'Something went wrong');
    }
    app.appendChild(main);
    this.afterRender();
  },

  afterRender() {
    this.applyTheme();
    this.updateNavbarBadge();
    this.bindEvents();
    document.querySelectorAll('.animate-on-enter').forEach((el, i) => {
      el.classList.add('fade-in', `stagger-${Math.min(i + 1, 6)}`);
    });
  },

  /* --- Error / Empty helpers --- */
  renderError(msg) {
    return `<div class="empty-state" style="padding-top:120px"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Something went wrong</div><div class="empty-state-text">${this.esc(msg)}</div><button class="btn btn-primary" onclick="window.location.hash='/'" style="margin-top:1rem">Go Home</button></div>`;
  },
  renderEmpty(icon, title, text, btnText) {
    return `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">${icon}</div><div class="empty-state-title">${title}</div><div class="empty-state-text">${text}</div>${btnText ? '<button class="btn btn-outline" id="clearSearch">' + btnText + '</button>' : ''}</div>`;
  },
  esc(str) { if (!str) return ''; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; },

  /* ---- NAVBAR ---- */
  renderNavbar() {
    const u = this.state.user;
    const nav = document.createElement('nav');
    nav.className = 'navbar';
    nav.innerHTML = `
      <div class="container">
        <a href="#/" class="navbar-logo"><span class="navbar-logo-icon">M</span> Medicharo</a>
        <div class="navbar-links">
          <a href="#/" class="navbar-link ${this.state.currentPage === 'home' ? 'active' : ''}">Home</a>
          <a href="#/create" class="navbar-link ${this.state.currentPage === 'create' ? 'active' : ''}">Create Wishlist</a>
          ${u ? '<a href="#/profile" class="navbar-link ' + (this.state.currentPage === 'profile' ? 'active' : '') + '">Profile</a>' : ''}
        </div>
        <div class="navbar-actions">
          <button id="themeToggle" class="theme-toggle" aria-label="Toggle theme">🌙</button>
          ${u ? `
            <button class="theme-toggle" id="notifBtn" aria-label="Notifications" style="position:relative">
              🔔
              <span id="notifBadge" style="display:none;position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;border-radius:9px;background:var(--color-error);color:#fff;font-size:10px;font-weight:700;align-items:center;justify-content:center;border:2px solid var(--color-bg-card)">0</span>
            </button>
            <div class="avatar avatar-sm" style="cursor:pointer" id="userAvatar">${u.photo ? '<img src="' + u.photo + '" alt="">' : this.esc((u.name || 'U')[0])}</div>
          ` : '<button class="btn btn-primary btn-sm" id="loginBtn">Sign In</button>'}
          <button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Menu">☰</button>
        </div>
      </div>
    `;
    return nav;
  },

  /* ---- HERO ---- */
  renderHeroSkeleton() {
    const s = document.createElement('section'); s.className = 'hero';
    s.innerHTML = `<div class="hero-content container"><div class="skeleton" style="width:200px;height:32px;margin:0 auto"></div><div class="skeleton" style="width:500px;height:60px;margin:24px auto"></div><div class="skeleton" style="width:400px;height:20px;margin:0 auto"></div></div>`;
    return s;
  },
  renderHero(stats) {
    const s = document.createElement('section'); s.className = 'hero';
    s.innerHTML = `
      <div class="hero-content container animate-on-enter">
        <div class="hero-badge"><span>🎉</span><span>${stats.totalWishes} wishes and counting</span></div>
        <h1 class="hero-title">Help Make<br>Wishes Come <span class="text-gradient">True</span></h1>
        <p class="hero-description">A community where dreams meet kindness. Post what you're saving for, and let friends and strangers contribute to make it happen.</p>
        <div class="hero-actions">
          <a href="#/create" class="btn btn-primary btn-lg">Start a Wishlist</a>
          ${this.state.user ? '<a href="#/profile" class="btn btn-outline btn-lg">My Profile</a>' : '<button class="btn btn-outline btn-lg" id="loginBtn">Sign In to Create</button>'}
        </div>
        <div class="hero-stats animate-on-enter">
          <div class="stat-item"><div class="stat-value">₹${(stats.totalRaised / 100000).toFixed(1)}L</div><div class="stat-label">Total Raised</div></div>
          <div class="stat-item"><div class="stat-value">${stats.totalContributors}+</div><div class="stat-label">Contributors</div></div>
          <div class="stat-item"><div class="stat-value">${stats.totalWishes}</div><div class="stat-label">Wishes Created</div></div>
        </div>
      </div>`;
    return s;
  },

  /* ---- SEARCH ---- */
  renderSearch() {
    const s = document.createElement('section'); s.className = 'search-section';
    s.innerHTML = `
      <div class="container">
        <div class="search-bar"><span class="search-bar-icon">🔍</span><input type="text" id="searchInput" placeholder="Search wishes..." value="${this.state.searchQuery}"></div>
        <div class="search-filters">
          <button class="filter-chip ${this.state.activeFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
          <button class="filter-chip ${this.state.activeFilter === 'almost' ? 'active' : ''}" data-filter="almost">Almost There</button>
          ${['Electronics','Lifestyle','Furniture','Music'].map(c => '<button class="filter-chip ' + (this.state.activeFilter === c.toLowerCase() ? 'active' : '') + '" data-filter="' + c.toLowerCase() + '">' + c + '</button>').join('')}
          <select class="sort-select" id="sortSelect">
            <option value="latest" ${this.state.sortBy === 'latest' ? 'selected' : ''}>Latest</option>
            <option value="most" ${this.state.sortBy === 'most' ? 'selected' : ''}>Most Contributed</option>
            <option value="almost" ${this.state.sortBy === 'almost' ? 'selected' : ''}>Almost Completed</option>
          </select>
        </div>
      </div>`;
    return s;
  },

  /* ---- CATEGORIES ---- */
  renderCategoriesSkeleton() {
    const s = document.createElement('section'); s.style.cssText = 'padding:var(--space-8) 0';
    s.innerHTML = '<div class="container"><div class="skeleton" style="width:200px;height:24px;margin-bottom:16px"></div></div>';
    return s;
  },
  renderCategories(wl) {
    const counts = {}; wl.forEach(w => { counts[w.category] = (counts[w.category] || 0) + 1; });
    const cats = ['Electronics','Lifestyle','Music','Furniture','Books','Sports','Fashion','Health'];
    const icons = { Electronics:'💻', Lifestyle:'🏠', Music:'🎵', Furniture:'🪑', Books:'📚', Sports:'⚽', Fashion:'👗', Health:'💪' };
    const s = document.createElement('section'); s.style.cssText = 'padding:var(--space-8) 0';
    s.innerHTML = `
      <div class="container">
        <div class="section-header"><div class="section-header-content"><div class="section-title">Browse Categories</div><div class="section-subtitle">Find wishes that speak to you</div></div></div>
        <div class="categories-scroll">${cats.map(c => '<div class="category-card" data-category="' + c.toLowerCase() + '"><div class="category-icon">' + (icons[c]||'📦') + '</div><span class="category-name">' + c + '</span></div>').join('')}</div>
      </div>`;
    return s;
  },

  /* ---- WISHLIST GRID ---- */
  renderGridSkeleton() {
    const s = document.createElement('section'); s.style.cssText = 'padding:var(--space-4) 0 var(--space-16)';
    s.innerHTML = '<div class="container"><div class="wishlist-grid">' + Array(6).fill('').map(() => '<div class="skeleton-card"><div class="skeleton-image skeleton"></div><div class="skeleton-body"><div class="skeleton-line skeleton"></div><div class="skeleton-line-sm skeleton"></div><div class="skeleton-line-xs skeleton"></div></div></div>').join('') + '</div></div>';
    return s;
  },

  renderWishlistGrid(allWl) {
    const section = document.createElement('section');
    section.style.cssText = 'padding:var(--space-4) 0 var(--space-16)';
    let filtered = this._filterWishlists(allWl);
    const content = filtered.length > 0 ? filtered.map((w, i) => this._cardHtml(w, i)).join('') : this.renderEmpty('🔍', 'No wishes found', 'Try a different search.', 'Clear Filters');
    section.innerHTML = `<div class="container"><div class="section-header"><div class="section-header-content"><div class="section-title">Wishes ✨</div><div class="section-subtitle">${filtered.length} wish${filtered.length !== 1 ? 'es' : ''} waiting for your kindness</div></div></div><div class="wishlist-grid">${content}</div></div>`;
    return section;
  },

  _filterWishlists(list) {
    const q = this.state.searchQuery.toLowerCase();
    if (q) list = list.filter(w => (w.title||'').toLowerCase().includes(q) || (w.category||'').toLowerCase().includes(q) || (w.creatorName||'').toLowerCase().includes(q));
    const f = this.state.activeFilter;
    if (f !== 'all') list = f === 'almost' ? list.filter(w => w.price > 0 && (w.raised / w.price) >= 0.7) : list.filter(w => (w.category||'').toLowerCase() === f);
    const s = this.state.sortBy;
    if (s === 'almost') list.sort((a, b) => b.price > 0 && a.price > 0 ? (b.raised / b.price) - (a.raised / a.price) : 0);
    else list.sort((a, b) => {
      const ta = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
      const tb = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
      return tb - ta;
    });
    return list;
  },

  _cardHtml(w, i) {
    const pct = w.price > 0 ? Math.round((w.raised / w.price) * 100) : 0;
    const rem = (w.price || 0) - (w.raised || 0);
    return `<div class="wishlist-card animate-on-enter slide-up stagger-${Math.min(i+1,6)}" data-id="${w.id}" role="link" tabindex="0">
      <div class="wishlist-card-image"><img src="${w.image || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&q=80'}" alt="${this.esc(w.title)}" loading="lazy"><div class="wishlist-card-image-overlay"><span>🎯</span><span>${pct}%</span></div></div>
      <div class="wishlist-card-body">
        <h3 class="wishlist-card-title">${this.esc(w.title)}</h3>
        <p class="wishlist-card-reason">${this.esc((w.reason||'').slice(0,100))}...</p>
        <div class="wishlist-card-price-row"><span class="wishlist-card-price">₹${(w.price||0).toLocaleString('en-IN')}</span><span class="wishlist-card-contributors">❤️ ${w.contributorCount || 0}</span></div>
        <div class="wishlist-card-progress"><div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div><div class="progress-labels"><span>₹${(w.raised||0).toLocaleString('en-IN')} raised</span><span>₹${Math.max(0,rem).toLocaleString('en-IN')} left</span></div></div>
        <div class="wishlist-card-footer"><div class="wishlist-card-creator"><div class="avatar avatar-sm">${this.esc((w.creatorName||'?')[0])}</div><span class="creator-name">${this.esc(w.creatorName||'Someone')}</span></div><span class="wishlist-card-donate">Contribute →</span></div>
      </div>
    </div>`;
  },

  updateGridOnly() {
    const wl = this._renderCache.wishlists || [];
    const gridSection = document.querySelector('#main-content > section:last-of-type');
    if (!gridSection) return;
    let filtered = this._filterWishlists(wl);
    const content = filtered.length > 0 ? filtered.map((w, i) => this._cardHtml(w, i)).join('') : this.renderEmpty('🔍', 'No wishes found', 'Try a different search.', 'Clear Filters');
    gridSection.innerHTML = `<div class="container"><div class="section-header"><div class="section-header-content"><div class="section-title">Wishes ✨</div><div class="section-subtitle">${filtered.length} wish${filtered.length !== 1 ? 'es' : ''} waiting for your kindness</div></div></div><div class="wishlist-grid">${content}</div></div>`;
    this.afterRender();
  },

  /* ---- DETAIL PAGE ---- */
  renderDetailPage(w, contribs, creator) {
    const pct = w.price > 0 ? Math.round((w.raised / w.price) * 100) : 0;
    const rem = Math.max(0, (w.price||0) - (w.raised||0));
    const isCreator = this.state.user && w.creatorUid === this.state.user.uid;
    const pendingContribs = contribs.filter(c => c.status === 'pending');

    const section = document.createElement('section');
    const hasPendingContrib = this.state.user && contribs.some(c => c.contributorUid === this.state.user.uid && c.status === 'pending');

    section.className = 'detail-page';
    section.innerHTML = `
      <div class="detail-hero"><img src="${w.image || ''}" alt="${this.esc(w.title)}"><div class="detail-hero-overlay"></div><button class="detail-back-btn" id="backBtn">←</button></div>
      ${hasPendingContrib ? '<div style="padding:var(--space-3) var(--space-6);background:var(--color-accent-light, #FFF3E0);border-bottom:1px solid var(--color-border-light);text-align:center;font-size:var(--text-sm);color:var(--color-accent-dark, #E65100)"><strong>⏳ Payment Pending</strong> — The creator has been notified and will confirm your payment shortly.</div>' : ''}
      <div class="detail-content">
        <div class="detail-main">
          <div class="detail-header-card animate-on-enter">
            <h1 class="detail-title">${this.esc(w.title)}</h1>
            <div class="detail-price-row"><span class="detail-price">₹${(w.raised||0).toLocaleString('en-IN')}</span><span class="detail-raised-label">of ₹${(w.price||0).toLocaleString('en-IN')}</span></div>
            <div class="detail-progress-section">
              <div class="progress-bar-track" style="height:10px"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
              <div class="detail-progress-stats">
                <div class="detail-stat"><div class="detail-stat-value" style="color:var(--color-primary)">₹${(w.raised||0).toLocaleString('en-IN')}</div><div class="detail-stat-label">Raised</div></div>
                <div class="detail-stat"><div class="detail-stat-value" style="color:var(--color-accent)">₹${rem.toLocaleString('en-IN')}</div><div class="detail-stat-label">Remaining</div></div>
                <div class="detail-stat"><div class="detail-stat-value" style="color:var(--color-success)">${pct}%</div><div class="detail-stat-label">Complete</div></div>
              </div>
            </div>
            ${rem > 0 ? '<div class="detail-donate-sidebar"><button class="detail-donate-btn" data-id="' + w.id + '">❤️ Contribute Now</button></div>' : '<div class="detail-donate-sidebar"><div class="btn btn-success btn-lg btn-full" style="pointer-events:none">🎉 Fully Funded!</div></div>'}
          </div>
          ${isCreator && pendingContribs.length > 0 ? `
          <div class="detail-story animate-on-enter" style="border:2px solid var(--color-accent)">
            <div class="detail-story-title">⏳ Pending Confirmations (${pendingContribs.length})</div>
            ${pendingContribs.map(c => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) 0;border-bottom:1px solid var(--color-border-light)">
                <div><strong>${this.esc(c.contributorName)}</strong> — ₹${c.amount}${c.message ? '<br><span style="font-size:var(--text-xs);color:var(--color-text-muted)">"' + this.esc(c.message) + '"</span>' : ''}</div>
                <div style="display:flex;gap:var(--space-2)">
                  <button class="btn btn-success btn-sm confirm-contrib" data-contrib="${c.id}" data-wl="${w.id}">✅ Confirm</button>
                  <button class="btn btn-outline btn-sm reject-contrib" data-contrib="${c.id}" data-wl="${w.id}" style="color:var(--color-error)">✕ Reject</button>
                </div>
              </div>
            `).join('')}
          </div>` : ''}
          <div class="detail-story animate-on-enter">
            <div class="detail-story-title">📖 The Story Behind This Wish</div>
            <div class="detail-story-text">${(w.reason||'').split('\n').filter(p => p.trim()).map(p => '<p>' + this.esc(p) + '</p>').join('')}</div>
          </div>
        </div>
        <div class="detail-sidebar">
          <div class="sidebar-card animate-on-enter">
            <div class="sidebar-card-title">Creator</div>
            <div class="creator-profile">
              <div class="avatar avatar-lg">${this.esc((creator.name||'?')[0])}</div>
              <div class="creator-info"><div class="creator-info-name">${this.esc(creator.name||'Someone')}</div></div>
            </div>
          </div>
          <div class="sidebar-card animate-on-enter">
            <div class="sidebar-card-title">Recent Contributors ❤️</div>
            ${contribs.filter(c => c.status !== 'rejected').length === 0 ? '<div style="text-align:center;padding:1rem;color:var(--color-text-muted);font-size:var(--text-sm)">Be the first to contribute!</div>' :
              contribs.filter(c => c.status !== 'rejected').slice(0, 5).map(c => `
                <div class="contribution-item">
                  <div class="contribution-info">
                    <div class="contribution-name">${this.esc(c.contributorName)} ${c.status === 'confirmed' ? '✅' : '⏳'}</div>
                    ${c.message ? '<div class="contribution-message">' + this.esc(c.message) + '</div>' : ''}
                    <div class="contribution-time">${Store.formatServerTime(c.createdAt)}</div>
                  </div>
                  <div class="contribution-amount">+₹${c.amount}</div>
                </div>
              `).join('')}
            ${this.state.user ? contribs.filter(c => c.status === 'rejected' && c.contributorUid === this.state.user.uid).map(c => `
              <div class="contribution-item" style="opacity:0.7;border-left:3px solid var(--color-error);padding-left:var(--space-3)">
                <div class="contribution-info">
                  <div class="contribution-name" style="color:var(--color-error)">⚠️ Your contribution was rejected</div>
                  <div class="contribution-time">${Store.formatServerTime(c.createdAt)}</div>
                </div>
                <button class="btn btn-sm btn-outline report-notif-btn" data-contrib="${c.id}" data-wl="${w.id}" style="flex-shrink:0;font-size:var(--text-xs);color:var(--color-error)">🚩 Report Issue</button>
              </div>
            `).join('') : ''}
          </div>
          ${rem > 0 ? '<div class="sidebar-card detail-donate-sidebar animate-on-enter"><button class="detail-donate-btn" data-id="' + w.id + '">❤️ Contribute Now</button></div>' : ''}
        </div>
      </div>
      ${rem > 0 ? `<div class="detail-donate-sticky"><div class="detail-donate-sticky-inner container"><div style="min-width:0"><div style="font-weight:700;font-size:var(--text-sm)">${this.esc(w.title)}</div><div style="font-size:var(--text-xs);color:var(--color-text-secondary)">₹${rem.toLocaleString('en-IN')} needed</div></div><button class="detail-donate-btn" data-id="${w.id}" style="width:auto;padding:0.75rem 2rem;font-size:var(--text-sm)">❤️ Contribute</button></div></div>` : ''}
    `;
    return section;
  },

  /* ---- CREATE PAGE ---- */
  renderCreatePage() {
    const u = this.state.user;
    const section = document.createElement('section');
    section.className = 'create-page';
    section.innerHTML = `
      <div class="container-narrow">
        <div class="create-header animate-on-enter">
          <div class="hero-badge" style="display:inline-flex;margin-bottom:var(--space-4)">✨ New Wish</div>
          <h1 class="heading-xl">What Are You<br>Wishing For?</h1>
          <p class="text-muted" style="margin-top:var(--space-3)">Share your dream with the community.</p>
        </div>
        <form class="create-form" id="createForm" novalidate>
          <div class="form-card animate-on-enter">
            <div class="form-card-title">📦 Product Details</div>
            <div style="display:flex;flex-direction:column;gap:var(--space-4)">
              <div class="form-group"><label class="form-label">Product Name <span style="color:var(--color-error)">*</span></label><input class="form-input" id="f_title" type="text" placeholder="e.g., Sony WH-1000XM5 Headphones" required></div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">Price (₹) <span style="color:var(--color-error)">*</span></label><input class="form-input" id="f_price" type="number" placeholder="29990" min="1" required></div>
                <div class="form-group"><label class="form-label">Category <span style="color:var(--color-error)">*</span></label><select class="form-input" id="f_category" required><option value="">Select</option>${['Electronics','Lifestyle','Music','Furniture','Books','Sports','Fashion','Health'].map(c => '<option value="' + c + '">' + c + '</option>').join('')}</select></div>
              </div>
              <div class="form-group"><label class="form-label">Product Link</label><input class="form-input" id="f_link" type="url" placeholder="https://amazon.in/product-link"></div>
            </div>
          </div>
          <div class="form-card animate-on-enter">
            <div class="form-card-title">📸 Product Image</div>
            <div class="image-upload" id="imageUpload"><div class="image-upload-icon">📤</div><div class="image-upload-text">Click to add a photo</div><div class="image-upload-hint">Optional</div><input type="file" accept="image/*"></div>
          </div>
          <div class="form-card animate-on-enter">
            <div class="form-card-title">💌 Your Story</div>
            <div class="form-group"><label class="form-label">Why do you want this? <span style="color:var(--color-error)">*</span></label><textarea class="form-input" id="f_reason" rows="5" placeholder="Share your story..." required></textarea></div>
          </div>
          <div class="form-card animate-on-enter">
            <div class="form-card-title">💳 UPI Details</div>
            <div style="display:flex;flex-direction:column;gap:var(--space-4)">
              <div class="form-group"><label class="form-label">Your UPI ID <span style="color:var(--color-error)">*</span></label><input class="form-input" id="f_upi" type="text" placeholder="yourname@upi" value="${this.esc(u.upiId || '')}" required></div>
              <div class="form-group"><label class="form-label">Your Name <span style="color:var(--color-error)">*</span></label><input class="form-input" id="f_creatorName" type="text" value="${this.esc(u.name)}" required></div>
            </div>
          </div>
          <div id="createFormError" style="display:none;padding:var(--space-3) var(--space-4);background:var(--color-error-light);color:var(--color-error-dark);border-radius:var(--radius-md);font-size:var(--text-sm);margin-bottom:var(--space-4)"></div>
          <button type="submit" class="btn btn-primary btn-lg btn-full animate-on-enter" id="createSubmitBtn" style="font-size:var(--text-base)">✨ Create Wishlist</button>
        </form>
      </div>`;
    return section;
  },

  /* ---- PROFILE PAGE ---- */
  renderProfilePage(myWl, notifs, pending) {
    const u = this.state.user;
    const totalRaised = myWl.reduce((s, w) => s + (w.raised || 0), 0);
    const active = myWl.filter(w => w.status === 'active');
    const completed = myWl.filter(w => w.status === 'completed');
    const tab = this.state.profileTab;
    const shown = tab === 'completed' ? completed : active;
    const unreadNotifs = notifs.filter(n => !n.read);

    const section = document.createElement('section');
    section.className = 'profile-page';
    section.innerHTML = `
      <div class="profile-cover"></div>
      <div class="profile-header animate-on-enter">
        <div class="profile-avatar-wrapper"><div class="avatar avatar-xl">${u.photo ? '<img src="' + u.photo + '" alt="">' : this.esc((u.name||'U')[0])}</div></div>
        <div class="profile-info">
          <h1 class="profile-name">${this.esc(u.name)}</h1>
          <p class="profile-bio">${this.esc(u.email || '')}</p>
          <div style="display:flex;gap:var(--space-3);margin-top:var(--space-3);flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" id="editProfileBtn">✏️ Edit Profile</button>
            <button class="btn btn-outline btn-sm" id="signOutBtn" style="color:var(--color-error)">🚪 Sign Out</button>
          </div>
          ${pending.length > 0 ? `<div style="margin-top:var(--space-3);padding:var(--space-3);background:var(--color-accent-light);border-radius:var(--radius-md);font-size:var(--text-sm)">⏳ ${pending.length} payment${pending.length > 1 ? 's' : ''} pending your confirmation</div>` : ''}
          <div class="profile-stats-grid" style="margin-top:var(--space-4)">
            <div class="profile-stat"><div class="profile-stat-value">${myWl.length}</div><div class="profile-stat-label">Total</div></div>
            <div class="profile-stat"><div class="profile-stat-value">₹${totalRaised.toLocaleString('en-IN')}</div><div class="profile-stat-label">Raised</div></div>
            <div class="profile-stat"><div class="profile-stat-value">${active.length}</div><div class="profile-stat-label">Active</div></div>
            <div class="profile-stat"><div class="profile-stat-value">${completed.length}</div><div class="profile-stat-label">Completed</div></div>
          </div>
        </div>
      </div>
      ${unreadNotifs.length > 0 ? `
      <div style="max-width:var(--container-max);margin:var(--space-4) auto 0;padding:0 var(--space-6)">
        <div style="background:var(--color-bg-card);border-radius:var(--radius-lg);border:1px solid var(--color-border-light);padding:var(--space-4)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)"><strong>🔔 Notifications</strong><button class="btn btn-sm btn-ghost" id="markReadAll" style="font-size:var(--text-xs)">Mark all read</button></div>
          ${unreadNotifs.slice(0, 10).map(n => `
            <div class="contribution-item notif-item" data-nid="${n.id}" style="${n.read ? 'opacity:0.6' : ''}">
              <div class="contribution-info">
                <div class="contribution-name">${n.type === 'new_contribution' ? '💰 ' + this.esc(n.fromName) + ' contributed' : (n.type === 'confirmed' ? '✅ Payment confirmed' : '⚠️ Payment rejected')}</div>
                <div class="contribution-message">${n.type === 'new_contribution' ? '₹' + n.amount + ' · ' + (n.message ? '"' + this.esc(n.message) + '"' : 'No message') : (n.type === 'confirmed' ? '₹' + n.amount + ' for ' + this.esc(n.wishlistTitle) + ' was confirmed' : '₹' + n.amount + ' for ' + this.esc(n.wishlistTitle) + ' was rejected')}</div>
                <div class="contribution-time">${Store.formatServerTime(n.createdAt)}</div>
              </div>
              ${n.type === 'new_contribution' ? `<div style="display:flex;gap:var(--space-2);flex-shrink:0">
                <button class="btn btn-success btn-sm confirm-contrib-notif" data-contrib="${n.contributionId || ''}" data-wl="${n.wishlistId || ''}">✅ Confirm</button>
                <button class="btn btn-outline btn-sm reject-contrib-notif" data-contrib="${n.contributionId || ''}" data-wl="${n.wishlistId || ''}" style="color:var(--color-error)">✕ Reject</button>
              </div>` : ''}
              ${n.type === 'rejected' ? `<button class="btn btn-sm btn-outline report-notif-btn" data-contrib="${n.contributionId || ''}" data-wl="${n.wishlistId || ''}" style="flex-shrink:0;font-size:var(--text-xs);color:var(--color-error)">🚩 Report Issue</button>` : ''}
            </div>
          `).join('')}
        </div>
      </div>` : ''}
      ${myWl.length > 0 ? `
      <div class="profile-tabs">
        <button class="profile-tab ${tab === 'active' ? 'active' : ''}" data-tab="active">Active (${active.length})</button>
        <button class="profile-tab ${tab === 'completed' ? 'active' : ''}" data-tab="completed">Completed (${completed.length})</button>
      </div>` : ''}
      <div class="profile-content" id="profileContent">
        ${myWl.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">✨</div><div class="empty-state-title">No wishlists yet</div><div class="empty-state-text">Create your first wish!</div><a href="#/create" class="btn btn-primary" style="margin-top:1rem;display:inline-flex">✨ Create Your First Wish</a></div>' :
          '<div class="wishlist-grid">' + (shown.length === 0 ? this.renderEmpty(tab === 'completed' ? '📋' : '🎉', tab === 'completed' ? 'No completed' : 'All done!', '', '') : shown.map((wl, i) => this._cardHtml(wl, i) + '<div style="text-align:center;margin-top:-0.5rem;margin-bottom:0.5rem"><button class="btn btn-ghost btn-sm delete-wl-btn" data-id="' + wl.id + '" style="color:var(--color-error);font-size:var(--text-xs)">🗑 Delete</button></div>').join('')) + '</div>'}
      </div>`;
    return section;
  },

  /* ---- FOOTER ---- */
  renderFooter() {
    const f = document.createElement('footer'); f.className = 'footer';
    f.innerHTML = `<div class="container"><div class="footer-grid">
      <div><div class="navbar-logo"><span class="navbar-logo-icon">M</span> Medicharo</div><p class="footer-brand-desc">A community where dreams meet kindness.</p></div>
      <div><div class="footer-heading">Platform</div><div class="footer-links"><a href="#/" class="footer-link">Browse</a><a href="#/create" class="footer-link">Create</a><a href="#/profile" class="footer-link">Profile</a></div></div>
      <div><div class="footer-heading">Support</div><div class="footer-links"><a href="#" class="footer-link">FAQs</a><a href="#" class="footer-link">Privacy</a><a href="#" class="footer-link">Terms</a></div></div>
      <div><div class="footer-heading">Community</div><div class="footer-links"><a href="#" class="footer-link">Blog</a><a href="#" class="footer-link">Instagram</a><a href="#" class="footer-link">Twitter</a></div></div>
    </div><div class="footer-bottom"><span>&copy; ${new Date().getFullYear()} Medicharo</span></div></div>`;
    return f;
  },

  /* ---- DONATE MODAL (requires login) ---- */
  openDonateModal(wishlistId) {
    if (!this.state.user) {
      this._pendingDonateId = wishlistId;
      this.openLoginModal(() => {
        const id = this._pendingDonateId;
        if (!id) return;
        Store.getWishlist(id).then(w => {
          if (!w) { this.showToast('Wishlist not found', 'error'); return; }
          if (w.status === 'completed' || (w.raised||0) >= (w.price||0)) { this.showToast('Already fulfilled! 🎉', 'error'); return; }
          this._showDonateModal(w);
        }).catch(() => this.showToast('Error', 'error'));
      });
      return;
    }
    Store.getWishlist(wishlistId).then(w => {
      if (!w) { this.showToast('Wishlist not found', 'error'); return; }
      if (w.status === 'completed' || (w.raised||0) >= (w.price||0)) { this.showToast('Already fulfilled! 🎉', 'error'); return; }
      this._showDonateModal(w);
    }).catch(() => this.showToast('Error loading wishlist', 'error'));
  },

  _showDonateModal(w) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.id = 'donateModal';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header"><div class="modal-title">❤️ Contribute</div><button class="modal-close" id="modalClose">✕</button></div>
        <div class="modal-body">
          <div id="donateContent">
            <div style="margin-bottom:var(--space-4)"><div style="font-weight:600;font-size:var(--text-sm)">Contributing to</div><div style="font-weight:700">${this.esc(w.title)}</div><div class="text-muted" style="font-size:var(--text-sm)">by ${this.esc(w.creatorName)}</div></div>
            <div id="donateError" style="display:none;padding:var(--space-2) var(--space-3);background:var(--color-error-light);color:var(--color-error-dark);border-radius:var(--radius-md);font-size:var(--text-sm);margin-bottom:var(--space-3)"></div>
            <div class="donate-form">
              <div class="form-group">
                <div class="label-row"><label class="form-label">Amount <span style="color:var(--color-error)">*</span></label><span class="help-icon" data-tip="Select a preset or enter a custom amount. The creator set the total goal at ₹${(w.price||0).toLocaleString('en-IN')}." aria-label="Help">!</span></div>
                <div class="donate-amount-grid">${[100,250,500,1000,2000,5000].map(a => '<button class="amount-chip" data-amount="' + a + '">₹' + a.toLocaleString('en-IN') + '</button>').join('')}</div>
              </div>
              <div class="form-group"><label class="form-label">Custom amount</label><input class="form-input" type="number" id="customAmount" placeholder="Enter amount in ₹" min="1"></div>
              <div class="form-group">
                <div class="label-row"><label class="form-label">Your Name</label><span class="help-icon" data-tip="Your name appears in the contributors list. Leave blank for anonymous." aria-label="Help">!</span></div>
                <input class="form-input" type="text" id="donorName" placeholder="How should we call you?" value="${this.state.user ? this.esc(this.state.user.name) : ''}">
              </div>
              <div class="form-group">
                <div class="label-row"><label class="form-label">Message</label><span class="help-icon" data-tip="Leave a note for the creator. They'll see it when confirming!" aria-label="Help">!</span></div>
                <textarea class="form-input" id="donorMessage" rows="2" placeholder="Leave a sweet message..."></textarea>
              </div>
            </div>
          </div>
          <div id="qrContent" style="display:none"></div>
        </div>
        <div class="modal-footer" id="donateFooter">
          <button class="btn btn-outline" id="modalCancel">Cancel</button>
          <button class="btn btn-primary btn-lg" id="donateNextBtn">Proceed to Pay</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    this._donateWishlist = w;
    this._donateAmount = 0;

    overlay.querySelectorAll('.amount-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        overlay.querySelectorAll('.amount-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        document.getElementById('customAmount').value = '';
        this._donateAmount = parseInt(chip.dataset.amount);
      });
    });
    document.getElementById('customAmount').addEventListener('input', (e) => {
      overlay.querySelectorAll('.amount-chip').forEach(c => c.classList.remove('active'));
      this._donateAmount = parseInt(e.target.value) || 0;
    });
    document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
    document.getElementById('modalCancel').addEventListener('click', () => this.closeModal());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeModal(); });
    document.getElementById('donateNextBtn').addEventListener('click', () => this.showQRScreen());
  },

  showQRScreen() {
    const w = this._donateWishlist;
    const amount = this._donateAmount;
    if (!amount || amount <= 0) {
      document.getElementById('donateError').style.display = 'block';
      document.getElementById('donateError').textContent = 'Please select or enter a valid amount.';
      return;
    }
    const rem = (w.price || 0) - (w.raised || 0);
    if (amount > rem) {
      document.getElementById('donateError').style.display = 'block';
      document.getElementById('donateError').textContent = 'Only ₹' + rem.toLocaleString('en-IN') + ' remaining!';
      return;
    }
    document.getElementById('donateError').style.display = 'none';
    document.getElementById('donateContent').style.display = 'none';
    const qrContent = document.getElementById('qrContent');
    qrContent.style.display = 'block';

    const upiStr = 'upi://pay?pa=' + encodeURIComponent(w.upiId) + '&pn=' + encodeURIComponent(w.creatorName||'') + '&am=' + amount + '&cu=INR&tn=' + encodeURIComponent('Contribution to ' + w.title);

    let qrImg = '<div style="padding:1rem;color:var(--color-text-muted)">Generating QR...</div>';
    try {
      if (typeof qrcode !== 'undefined') {
        const qr = qrcode(0, 'L');
        qr.addData(upiStr);
        qr.make();
        qrImg = '<img src="' + qr.createDataURL(5, 4) + '" alt="QR" style="width:100%;height:100%;object-fit:contain">';
      } else {
        qrImg = '<div style="padding:1rem;color:var(--color-error)">Library not loaded. UPI: ' + this.esc(w.upiId) + '</div>';
      }
    } catch (e) {
      qrImg = '<div style="padding:1rem;color:var(--color-error)">QR failed. UPI: ' + this.esc(w.upiId) + '</div>';
    }

    qrContent.innerHTML = `
      <div class="qr-screen">
        <div class="qr-success-badge">✅ Payment Link Generated</div>
        <div class="qr-code-wrapper">${qrImg}</div>
        <div class="qr-amount">₹${amount.toLocaleString('en-IN')}</div>
        <div class="qr-creator">for ${this.esc(w.creatorName)}'s wishlist</div>
        <div class="qr-upi-box"><span class="qr-upi-id">${this.esc(w.upiId)}</span><button class="qr-copy-btn" id="copyUpiBtn">📋 Copy</button></div>
        <div class="qr-instructions">
          <div class="qr-instructions-title">📱 How to Pay</div>
          <ol><li>Open any UPI app</li><li>Scan QR or enter UPI ID</li><li>Amount auto-fills: <strong>₹${amount.toLocaleString('en-IN')}</strong></li><li>Complete payment</li><li>Come back and tap <strong>"I've Paid"</strong></li></ol>
          <div style="margin-top:var(--space-3);padding:var(--space-2);background:var(--color-warning-light, #FFF3E0);border-radius:var(--radius-md);font-size:var(--text-xs);color:var(--color-accent-dark)">
            ⚠️ After paying, tap the button below. The creator will confirm your payment.
          </div>
        </div>
        <button class="qr-paid-btn" id="paidBtn">✅ I've Paid — Notify Creator</button>
      </div>`;

    document.getElementById('donateFooter').innerHTML = '<button class="btn btn-outline" id="qrBackBtn">← Back</button>';
    document.getElementById('qrBackBtn').addEventListener('click', () => {
      document.getElementById('donateContent').style.display = 'block';
      qrContent.style.display = 'none';
      document.getElementById('donateFooter').innerHTML = '<button class="btn btn-outline" id="modalCancel">Cancel</button><button class="btn btn-primary btn-lg" id="donateNextBtn">Proceed to Pay</button>';
      document.getElementById('modalCancel').addEventListener('click', () => this.closeModal());
      document.getElementById('donateNextBtn').addEventListener('click', () => this.showQRScreen());
    });
    document.getElementById('copyUpiBtn').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(w.upiId); this._copied('copyUpiBtn'); }
      catch { const ta = document.createElement('textarea'); ta.value = w.upiId; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); this._copied('copyUpiBtn'); }
    });
    document.getElementById('paidBtn').addEventListener('click', async () => {
      const btn = document.getElementById('paidBtn');
      if (btn.dataset.submitting === 'true') return;
      btn.dataset.submitting = 'true';
      btn.disabled = true;
      btn.textContent = '⏳ Submitting...';
      try {
        const name = document.getElementById('donorName')?.value || '';
        const msg = document.getElementById('donorMessage')?.value || '';
        await Store.addContribution(w.id, { amount, name, message: msg });
        this._pendingContributionWishlistId = w.id;
        this.closeModal();
        this.showToast('🎉 Payment submitted! The creator will confirm it shortly.', 'success');
        if (this.state.currentPage === 'detail' && this.state.currentWishlistId === w.id) this.render();
      } catch (err) {
        delete btn.dataset.submitting;
        btn.disabled = false;
        btn.textContent = '✅ I\'ve Paid — Notify Creator';
        this.showToast(err.message || 'Error submitting payment', 'error');
      }
    });
  },

  _copied(id) {
    const b = document.getElementById(id); if (!b) return;
    b.textContent = '✅ Copied!'; b.classList.add('copied');
    setTimeout(() => { b.textContent = '📋 Copy'; b.classList.remove('copied'); }, 2000);
  },

  closeModal() {
    const m = document.getElementById('donateModal');
    if (m) { m.remove(); document.body.style.overflow = ''; }
    const em = document.getElementById('editProfileModal');
    if (em) { em.remove(); document.body.style.overflow = ''; }
    const lm = document.getElementById('loginModal');
    if (lm) { lm.remove(); document.body.style.overflow = ''; }
    const rm = document.getElementById('reportModal');
    if (rm) { rm.remove(); document.body.style.overflow = ''; }
  },

  showToast(message, type) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = '<span>' + (type === 'success' ? '✅' : '⚠️') + '</span><span>' + message + '</span>';
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100px)'; t.style.transition = 'all 300ms ease'; setTimeout(() => t.remove(), 300); }, 4000);
  },

  /* ---- LOGIN MODAL (with optional callback) ---- */
  openLoginModal(callback) {
    this._loginCallback = callback || null;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.id = 'loginModal';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header"><div class="modal-title">🔐 Sign In Required</div><button class="modal-close" id="loginModalClose">✕</button></div>
        <div class="modal-body">
          <div style="margin-bottom:var(--space-4);padding:var(--space-3);background:var(--color-primary-subtle);border-radius:var(--radius-md);font-size:var(--text-sm);color:var(--color-primary-dark)">
            💡 You need to sign in to continue with this action.
          </div>
          <div id="loginError" style="display:none;padding:var(--space-2) var(--space-3);background:var(--color-error-light);color:var(--color-error-dark);border-radius:var(--radius-md);font-size:var(--text-sm);margin-bottom:var(--space-3)"></div>
          <button class="btn btn-outline btn-lg btn-full" id="googleSignIn" style="justify-content:center;gap:var(--space-3);margin-bottom:var(--space-4)"><span style="font-size:1.25rem">G</span> Continue with Google</button>
          <div style="text-align:center;color:var(--color-text-muted);font-size:var(--text-sm);margin-bottom:var(--space-4)">— or —</div>
          <div style="display:flex;flex-direction:column;gap:var(--space-3)">
            <input class="form-input" id="loginEmail" type="email" placeholder="Email">
            <input class="form-input" id="loginPassword" type="password" placeholder="Password">
            <button class="btn btn-primary btn-full" id="emailSignIn">Sign In</button>
            <button class="btn btn-ghost btn-sm" id="showSignUp" style="font-size:var(--text-sm);color:var(--color-primary)">Don't have an account? Sign up</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const close = () => this.closeModal();
    document.getElementById('loginModalClose').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    const onSuccess = () => {
      close();
      this.showToast('Signed in!', 'success');
      if (this._loginCallback) {
        const cb = this._loginCallback;
        this._loginCallback = null;
        setTimeout(() => cb(), 300);
      }
    };

    document.getElementById('googleSignIn').addEventListener('click', async () => {
      try { await Store.signInWithGoogle(); onSuccess(); }
      catch (e) { this._showLoginError(e.message); }
    });

    document.getElementById('emailSignIn').addEventListener('click', async () => {
      const email = document.getElementById('loginEmail').value.trim();
      const pass = document.getElementById('loginPassword').value;
      if (!email || !pass) { this._showLoginError('Please enter email and password.'); return; }
      try {
        await Store.signInWithEmail(email, pass);
        onSuccess();
      } catch (e) {
        if (e.code === 'auth/user-not-found') {
          try { await Store.signUpWithEmail(email, pass, email.split('@')[0]); onSuccess(); }
          catch (e2) { this._showLoginError(e2.message); }
        } else { this._showLoginError(e.message); }
      }
    });

    document.getElementById('showSignUp').addEventListener('click', async () => {
      const email = document.getElementById('loginEmail').value.trim();
      const pass = document.getElementById('loginPassword').value;
      if (!email || !pass) { this._showLoginError('Enter email and password to sign up.'); return; }
      try { await Store.signUpWithEmail(email, pass, email.split('@')[0]); onSuccess(); }
      catch (e) { this._showLoginError(e.message); }
    });
  },

  _showLoginError(msg) {
    const d = document.getElementById('loginError');
    if (d) { d.textContent = msg; d.style.display = 'block'; }
  },

  /* ---- REPORT MODAL ---- */
  openReportModal(contributionId, wishlistId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.id = 'reportModal';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header"><div class="modal-title">⚠️ Report Issue</div><button class="modal-close" id="reportModalClose">✕</button></div>
        <div class="modal-body">
          <div style="margin-bottom:var(--space-4);padding:var(--space-3);background:var(--color-error-light);border-radius:var(--radius-md);font-size:var(--text-sm);color:var(--color-error-dark)">
            💡 Your contribution was rejected by the creator. If you paid and have proof, please share the details below. Our team will review and take action.
          </div>
          <div id="reportError" style="display:none;padding:var(--space-2) var(--space-3);background:var(--color-error-light);color:var(--color-error-dark);border-radius:var(--radius-md);font-size:var(--text-sm);margin-bottom:var(--space-3)"></div>
          <div class="donate-form">
            <div class="form-group">
              <label class="form-label">Describe the issue <span style="color:var(--color-error)">*</span></label>
              <textarea class="form-input" id="reportReason" rows="4" placeholder="Tell us what happened... Did you pay and the creator rejected without reason? Any details help."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Payment Screenshot</label>
              <div class="image-upload" id="reportImageUpload">
                <div class="image-upload-icon">📸</div>
                <div class="image-upload-text">Upload payment screenshot</div>
                <div class="image-upload-hint" id="reportFileName">PNG or JPG (optional but recommended)</div>
                <input type="file" accept="image/*">
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="reportCancel">Cancel</button>
          <button class="btn btn-primary" id="reportSubmitBtn" disabled>📤 Submit Report</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    const close = () => this.closeModal();
    document.getElementById('reportModalClose').addEventListener('click', close);
    document.getElementById('reportCancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    let screenshotData = '';
    const fileInput = overlay.querySelector('#reportImageUpload input');
    const fileNameEl = document.getElementById('reportFileName');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) { screenshotData = ''; fileNameEl.textContent = 'PNG or JPG (optional)'; return; }
        fileNameEl.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (ev) => { screenshotData = ev.target.result; };
        reader.readAsDataURL(file);
      });
    }

    const reasonEl = document.getElementById('reportReason');
    const submitBtn = document.getElementById('reportSubmitBtn');

    const check = () => { submitBtn.disabled = !reasonEl.value.trim(); };
    reasonEl.addEventListener('input', check);

    submitBtn.addEventListener('click', async () => {
      const reason = reasonEl.value.trim();
      if (!reason) { this._showReportError('Please describe the issue.'); return; }
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Submitting...';
      try {
        await Store.submitReport({ contributionId, wishlistId, reason, screenshot: screenshotData });
        close();
        this.showToast('Report submitted! We\'ll review it soon. 🙏', 'success');
      } catch (e) {
        this._showReportError(e.message);
        submitBtn.disabled = false;
        submitBtn.textContent = '📤 Submit Report';
      }
    });
  },

  _showReportError(msg) {
    const d = document.getElementById('reportError');
    if (d) { d.textContent = msg; d.style.display = 'block'; }
  },

  /* ---- EDIT PROFILE MODAL ---- */
  openEditProfileModal() {
    const u = this.state.user;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.id = 'editProfileModal';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header"><div class="modal-title">✏️ Edit Profile</div><button class="modal-close" id="epClose">✕</button></div>
        <div class="modal-body">
          <div id="epError" style="display:none;padding:var(--space-2) var(--space-3);background:var(--color-error-light);color:var(--color-error-dark);border-radius:var(--radius-md);font-size:var(--text-sm);margin-bottom:var(--space-3)"></div>
          <div class="donate-form">
            <div class="form-group"><label class="form-label">Display Name</label><input class="form-input" id="ep_name" value="${this.esc(u.name)}"></div>
            <div class="form-group"><label class="form-label">UPI ID</label><input class="form-input" id="ep_upi" placeholder="yourname@upi" value="${this.esc(u.upiId || '')}"></div>
          </div>
        </div>
        <div class="modal-footer"><button class="btn btn-outline" id="epCancel">Cancel</button><button class="btn btn-primary" id="epSave">💾 Save</button></div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    const close = () => { overlay.remove(); document.body.style.overflow = ''; };
    document.getElementById('epClose').addEventListener('click', close);
    document.getElementById('epCancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.getElementById('epSave').addEventListener('click', async () => {
      const name = document.getElementById('ep_name')?.value?.trim();
      const upiId = document.getElementById('ep_upi')?.value?.trim();
      if (!name) { document.getElementById('epError').style.display = 'block'; document.getElementById('epError').textContent = 'Name is required.'; return; }
      try {
        if (auth.currentUser) await auth.currentUser.updateProfile({ displayName: name });
        await Store.saveUserProfile(this.state.user.uid, { name, upiId });
        this.state.user.name = name;
        this.state.user.upiId = upiId;
        close();
        this.showToast('Profile updated!', 'success');
        if (this.state.currentPage === 'profile') this.render();
      } catch (e) { this.showToast(e.message, 'error'); }
    });
  },

  /* ---- EVENTS ---- */
  bindEvents() {
    const main = document.getElementById('main-content');

    // Card clicks
    main?.addEventListener('click', (e) => {
      const card = e.target.closest('.wishlist-card');
      if (card && !e.target.closest('.wishlist-card-donate') && !e.target.closest('.delete-wl-btn')) {
        window.location.hash = '/wishlist/' + card.dataset.id;
      }
    });

    // Donate buttons
    main?.addEventListener('click', (e) => {
      const db = e.target.closest('.detail-donate-btn');
      if (db) { this.openDonateModal(db.dataset.id); return; }
      const dc = e.target.closest('.wishlist-card-donate');
      if (dc) { const card = dc.closest('.wishlist-card'); if (card) this.openDonateModal(card.dataset.id); }
    });

    // Tooltip help icons
    document.querySelectorAll('.help-icon').forEach(icon => {
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.help-icon.show-tooltip').forEach(el => { if (el !== icon) el.classList.remove('show-tooltip'); });
        icon.classList.toggle('show-tooltip');
      });
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.help-icon')) document.querySelectorAll('.help-icon.show-tooltip').forEach(el => el.classList.remove('show-tooltip'));
    });

    // Confirm contribution
    document.querySelectorAll('.confirm-contrib').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await Store.confirmContribution(btn.dataset.contrib, btn.dataset.wl);
          this.showToast('✅ Payment confirmed!', 'success');
          this.render();
        } catch (e) { this.showToast(e.message, 'error'); }
      });
    });

    // Reject contribution
    document.querySelectorAll('.reject-contrib').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Reject this payment? The contributor will be notified.')) return;
        try {
          await Store.rejectContribution(btn.dataset.contrib, btn.dataset.wl);
          this.showToast('Payment rejected', 'success');
          this.render();
        } catch (e) { this.showToast(e.message, 'error'); }
      });
    });

    // Confirm/Reject from notification buttons
    main?.addEventListener('click', (e) => {
      const confirmBtn = e.target.closest('.confirm-contrib-notif');
      if (confirmBtn) {
        e.stopPropagation();
        Store.confirmContribution(confirmBtn.dataset.contrib, confirmBtn.dataset.wl)
          .then(() => { this.showToast('✅ Payment confirmed!', 'success'); this.render(); })
          .catch(err => this.showToast(err.message, 'error'));
        return;
      }
      const rejectBtn = e.target.closest('.reject-contrib-notif');
      if (rejectBtn) {
        e.stopPropagation();
        if (!confirm('Reject this payment? The contributor will be notified.')) return;
        Store.rejectContribution(rejectBtn.dataset.contrib, rejectBtn.dataset.wl)
          .then(() => { this.showToast('Payment rejected', 'success'); this.render(); })
          .catch(err => this.showToast(err.message, 'error'));
        return;
      }
    });

    // Report Issue button (from notifications)
    main?.addEventListener('click', (e) => {
      const rp = e.target.closest('.report-notif-btn');
      if (rp) {
        e.stopPropagation();
        const cid = rp.dataset.contrib;
        const wid = rp.dataset.wl;
        if (cid) this.openReportModal(cid, wid);
      }
    });

    // Delete wishlist
    document.querySelectorAll('.delete-wl-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this wishlist?')) return;
        try { await Store.deleteWishlist(btn.dataset.id); this.showToast('Deleted', 'success'); this.render(); }
        catch (err) { this.showToast(err.message, 'error'); }
      });
    });

    // Notification items — mark read
    document.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', async () => {
        const nid = el.dataset.nid;
        if (nid) { await Store.markNotificationRead(nid); this.loadUnreadCount(); }
      });
    });

    // Mark all read
    document.getElementById('markReadAll')?.addEventListener('click', async () => {
      if (this.state.user) { await Store.markAllNotificationsRead(this.state.user.uid); this.loadUnreadCount(); this.render(); }
    });

    // Notification bell
    document.getElementById('notifBtn')?.addEventListener('click', () => {
      if (this.state.user) window.location.hash = '/profile';
    });

    // User avatar → profile
    document.getElementById('userAvatar')?.addEventListener('click', () => {
      window.location.hash = '/profile';
    });

    // Login button
    document.querySelectorAll('#loginBtn').forEach(btn => btn.addEventListener('click', () => this.openLoginModal()));

    // Hero login button
    document.getElementById('loginBtn')?.addEventListener('click', () => this.openLoginModal());

    // Sign out
    document.getElementById('signOutBtn')?.addEventListener('click', async () => {
      await Store.signOut();
      this.state.user = null;
      this.state.unreadCount = 0;
      window.location.hash = '/';
    });

    // Back button
    document.getElementById('backBtn')?.addEventListener('click', () => { window.location.hash = '/'; });

    // Search
    const si = document.getElementById('searchInput');
    if (si) {
      si.addEventListener('input', (e) => {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => { this.state.searchQuery = e.target.value; this.updateGridOnly(); }, 300);
      });
    }
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => { this.state.activeFilter = chip.dataset.filter; this.updateGridOnly(); });
    });
    document.getElementById('sortSelect')?.addEventListener('change', (e) => { this.state.sortBy = e.target.value; this.updateGridOnly(); });
    document.querySelectorAll('.category-card').forEach(card => {
      card.addEventListener('click', () => { this.state.activeFilter = card.dataset.category; this.updateGridOnly(); });
    });
    document.getElementById('clearSearch')?.addEventListener('click', () => { this.state.searchQuery = ''; this.state.activeFilter = 'all'; this.updateGridOnly(); });

    // Theme
    document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());

    // Mobile menu
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
      const links = document.querySelector('.navbar-links');
      if (!links) return;
      const open = links.style.display === 'flex';
      links.style.display = open ? '' : 'flex';
      if (!open) {
        links.style.position = 'absolute'; links.style.top = 'var(--header-height)'; links.style.left = '0'; links.style.right = '0';
        links.style.flexDirection = 'column'; links.style.padding = 'var(--space-4)'; links.style.background = 'var(--color-bg-card)';
        links.style.borderBottom = '1px solid var(--color-border)';
      }
    });

    // Profile tabs
    document.querySelectorAll('.profile-tab').forEach(tab => {
      tab.addEventListener('click', () => { this.state.profileTab = tab.dataset.tab; this.render(); });
    });

    // Edit profile
    document.getElementById('editProfileBtn')?.addEventListener('click', () => this.openEditProfileModal());

    // Image upload
    const imgUp = document.getElementById('imageUpload');
    if (imgUp) {
      const inp = imgUp.querySelector('input');
      inp.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          imgUp.querySelectorAll('.image-upload-preview, .image-upload-remove').forEach(el => el.remove());
          const img = document.createElement('img'); img.className = 'image-upload-preview'; img.src = ev.target.result;
          imgUp.appendChild(img); imgUp.classList.add('has-image');
          const rm = document.createElement('button'); rm.className = 'image-upload-remove'; rm.textContent = '✕'; rm.type = 'button';
          rm.addEventListener('click', (ee) => { ee.preventDefault(); ee.stopPropagation(); img.remove(); rm.remove(); imgUp.classList.remove('has-image'); inp.value = ''; });
          imgUp.appendChild(rm);
        };
        reader.readAsDataURL(file);
      });
    }

    // Create form
    document.getElementById('createForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('createFormError');
      if (errEl) errEl.style.display = 'none';

      const title = document.getElementById('f_title')?.value?.trim();
      const price = parseInt(document.getElementById('f_price')?.value);
      const category = document.getElementById('f_category')?.value;
      const reason = document.getElementById('f_reason')?.value?.trim();
      const upiId = document.getElementById('f_upi')?.value?.trim();
      const creatorName = document.getElementById('f_creatorName')?.value?.trim();
      const link = document.getElementById('f_link')?.value?.trim() || '';
      const preview = document.querySelector('.image-upload-preview');
      const image = preview ? preview.src : '';

      if (!title) { this._formErr('Enter a product name.'); return; }
      if (!price || price <= 0) { this._formErr('Enter a valid price.'); return; }
      if (!category) { this._formErr('Select a category.'); return; }
      if (!reason || reason.length < 10) { this._formErr('Tell your story (min 10 chars).'); return; }
      if (!upiId || !upiId.includes('@')) { this._formErr('Enter a valid UPI ID.'); return; }
      if (!creatorName) { this._formErr('Enter your name.'); return; }

      const btn = document.getElementById('createSubmitBtn');
      btn.disabled = true; btn.textContent = '⏳ Creating...';
      try {
        await Store.createWishlist({ title, price, category, reason, upiId, creatorName, productLink: link, image });
        this.showToast('🎉 Wishlist created! Share it with your community.', 'success');
        setTimeout(() => window.location.hash = '/', 1500);
      } catch (err) {
        btn.disabled = false; btn.textContent = '✨ Create Wishlist';
        this._formErr(err.message || 'Error creating wishlist.');
      }
    });
  },

  _formErr(msg) {
    const d = document.getElementById('createFormError');
    if (d) { d.textContent = msg; d.style.display = 'block'; d.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    this.showToast(msg, 'error');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
