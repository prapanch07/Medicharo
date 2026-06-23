// Single source of truth for notification headline + body text across
// the bell modal and the /notifications page.
export function renderNotifText(n) {
  const amt = '₹' + (n.amount || 0);
  const title = n.wishlistTitle || 'a wishlist';
  switch (n.type) {
    case 'new_contribution':
      return {
        headline: '💰 ' + (n.fromName || 'Someone') + ' contributed',
        body: amt + ' · ' + (n.message ? '"' + n.message + '"' : 'No message')
      };
    case 'confirmed':
      return {
        headline: '✅ Payment confirmed',
        body: amt + ' for ' + title + ' was confirmed'
      };
    case 'rejected':
      return {
        headline: '⚠️ Payment rejected',
        body: amt + ' for ' + title + ' was rejected'
      };
    case 'report_accepted':
      return {
        headline: '✅ Your report was upheld',
        body: amt + ' credited to ' + title
      };
    case 'report_accepted_against':
      return {
        headline: '⚠️ Admin override',
        body: 'An admin credited ' + amt + ' for ' + title + '. Repeated rejections may restrict your account.'
      };
    case 'report_dismissed':
      return {
        headline: 'ℹ️ Report dismissed',
        body: 'Your report for ' + title + ' was dismissed by an admin.'
      };
    case 'report_dismissed_for':
      return {
        headline: 'ℹ️ Report cleared',
        body: 'A report against you for ' + title + ' was dismissed.'
      };
    case 'report_submitted':
      return {
        headline: '🚩 Report submitted',
        body: 'Your report on ' + title + ' for ' + amt + ' was filed. Admin will review it shortly.'
      };
    default:
      return { headline: 'Notification', body: '' };
  }
}
