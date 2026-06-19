export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="navbar-logo"><span className="navbar-logo-icon">M</span> Medicharo</div>
            <p className="footer-brand-desc">A community where dreams meet kindness.</p>
          </div>
          <div>
            <div className="footer-heading">Platform</div>
            <div className="footer-links">
              <a href="/" className="footer-link">Browse</a>
              <a href="/create" className="footer-link">Create</a>
              <a href="/profile" className="footer-link">Profile</a>
            </div>
          </div>
          <div>
            <div className="footer-heading">Support</div>
            <div className="footer-links">
              <a href="#" className="footer-link">FAQs</a>
              <a href="#" className="footer-link">Privacy</a>
              <a href="#" className="footer-link">Terms</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom"><span>&copy; {new Date().getFullYear()} Medicharo</span></div>
      </div>
    </footer>
  );
}
