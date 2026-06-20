import { useState, useEffect, useContext, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserContext, ToastContext } from '../App';
import { subscribeWishlists, formatTime } from '../firebase';
import DonateModal from './DonateModal';
import LoginModal from './LoginModal';

const CATEGORIES = ['Electronics', 'Lifestyle', 'Music', 'Furniture', 'Books', 'Sports', 'Fashion', 'Health'];

export default function Home() {
  const { user } = useContext(UserContext);
  const showToast = useContext(ToastContext);
  const navigate = useNavigate();

  const [wl, setWl] = useState([]);
  const [wlLoading, setWlLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('latest');
  const [donateId, setDonateId] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingLogin, setPendingLogin] = useState(null);

  const stats = useMemo(() => ({
    totalWishes: wl.length,
    activeWishes: wl.filter(w => w.status === 'active' || !w.status).length,
    completedWishes: wl.filter(w => w.status === 'completed').length,
    totalRaised: wl.reduce((s, w) => s + (w.raised || 0), 0)
  }), [wl]);

  useEffect(() => {
    const unsub = subscribeWishlists(list => {
      setWl(list);
      setWlLoading(false);
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    let list = [...wl];
    if (user) list = list.filter(w => w.creatorUid !== user.uid);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(w => w.title?.toLowerCase().includes(q) || w.reason?.toLowerCase().includes(q) || w.creatorName?.toLowerCase().includes(q));
    }
    if (filter !== 'all') list = list.filter(w => w.category === filter);
    list.sort((a, b) => {
      if (sort === 'oldest') return (a.createdAt?.toDate?.()?.getTime() || 0) - (b.createdAt?.toDate?.()?.getTime() || 0);
      if (sort === 'amount') return (b.price || 0) - (a.price || 0);
      return (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0);
    });
    return list;
  }, [wl, search, filter, sort, user]);

  const handleDonate = (id) => {
    if (!user) { setPendingLogin(id); setShowLogin(true); return; }
    setDonateId(id);
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    if (pendingLogin === 'create') {
      navigate('/create');
    } else if (pendingLogin) {
      setDonateId(pendingLogin);
    }
    setPendingLogin(null);
  };

  return (
    <main id="main-content">
      <section className="hero">
        <div className="container">
          <div className="hero-content animate-on-enter">
            {stats && (
              <div className="hero-badge">
                🎉 {stats.totalWishes} wishes shared
              </div>
            )}
            <h1 className="hero-title">Where Dreams<br />Meet <span className="text-gradient">Kindness</span></h1>
            <p className="hero-description">A community-powered wishlist platform. Share your dreams, contribute to others', and make kindness real — one UPI transfer at a time.</p>
            <div className="hero-actions">
              <Link to="/create" className="btn btn-primary btn-lg">{user ? '✨ Create a Wishlist' : '✨ Create Your First Wish'}</Link>
              {!user && <button className="btn btn-outline btn-lg" onClick={() => { setPendingLogin('create'); setShowLogin(true); }}>Sign In to Create</button>}
            </div>
          </div>
          {wlLoading ? (
            <div className="loader-inline" style={{ justifyContent: 'center', padding: '2rem' }}><span className="spinner"></span> Loading stats...</div>
          ) : (
            <div className="hero-stats animate-on-enter">
              <div className="hero-stat">
                <div className="hero-stat-value">{stats.totalWishes}</div>
                <div className="hero-stat-label">Wishes</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">₹{(stats.totalRaised || 0).toLocaleString('en-IN')}</div>
                <div className="hero-stat-label">Raised</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">{stats.completedWishes}</div>
                <div className="hero-stat-label">Fulfilled</div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="search-section">
        <div className="container">
          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input className="search-input" type="text" placeholder="Search wishes, stories, or creators..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
          <div className="search-filters">
            <button className={'filter-chip' + (filter === 'all' ? ' active' : '')} onClick={() => setFilter('all')}>All</button>
            {CATEGORIES.map(c => (
              <button key={c} className={'filter-chip' + (filter === c ? ' active' : '')} onClick={() => setFilter(c)}>{c}</button>
            ))}
            <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
              <option value="amount">Highest price</option>
            </select>
          </div>
        </div>
      </div>

      <section className="wishlist-section">
        <div className="container">
          <div className="section-header animate-on-enter">
            <div className="section-header-content">
              <h2 className="section-title">
                {filter !== 'all' ? filter : (search ? `Search results (${filtered.length})` : 'Explore Wishes')}
              </h2>
              <p className="section-subtitle">
                {filter !== 'all' ? `Showing ${filter} wishes` : (search ? `Found ${filtered.length} results` : 'Discover wishes from the community')}
              </p>
            </div>
          </div>
          {wlLoading ? (
            <div className="loader-inline" style={{ justifyContent: 'center', padding: '3rem' }}><span className="spinner"></span> Loading wishes...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">No wishes found</div>
              <div className="empty-state-text">{search ? 'Try a different search term.' : 'Be the first to create one!'}</div>
              <Link to="/create" className="btn btn-primary" style={{ marginTop: '1rem' }}>✨ Create a Wishlist</Link>
            </div>
          ) : (
            <div className="wishlist-grid">
              {filtered.map((w, i) => (
                <div key={w.id} className={'wishlist-card animate-on-enter' + (w.status === 'completed' ? ' completed' : '')} style={{ animationDelay: (i % 6 * 50) + 'ms' }} onClick={() => navigate('/wishlist/' + w.id)}>
                  <div className="wishlist-card-image">
                    {w.image ? <img src={w.image} alt={w.title} loading="lazy" /> : <div className="wishlist-card-placeholder">✨</div>}
                    <div className="wishlist-card-category">{w.category}</div>
                    {w.status === 'completed' && <div className="wishlist-card-fulfilled">🎉 Fulfilled!</div>}
                    <div className="wishlist-card-raise-progress">
                      <div className="wishlist-card-raise-fill" style={{ width: Math.min(100, ((w.raised || 0) / (w.price || 1)) * 100) + '%' }}></div>
                    </div>
                  </div>
                  <div className="wishlist-card-body">
                    <h3 className="wishlist-card-title">{w.title}</h3>
                    <div className="wishlist-card-creator">by {w.creatorName}</div>
                    <div className="wishlist-card-footer">
                      <div>
                        <div className="wishlist-card-price">₹{(w.raised || 0).toLocaleString('en-IN')}</div>
                        <div className="wishlist-card-raised">raised of ₹{(w.price || 0).toLocaleString('en-IN')}</div>
                      </div>
                      {w.status !== 'completed' && <button className="wishlist-card-donate" onClick={e => { e.stopPropagation(); handleDonate(w.id); }}>❤️</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {showLogin && <LoginModal onClose={() => { setShowLogin(false); setPendingLogin(null); }} onSuccess={handleLoginSuccess} />}
      {donateId && <DonateModal wishlistId={donateId} onClose={() => setDonateId(null)} />}
    </main>
  );
}