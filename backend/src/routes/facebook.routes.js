/**
 * Facebook token admin API.
 *
 * POST /api/facebook/tokens/exchange
 *   Body: { "shortLivedUserToken": "EAA..." }
 *   Exchange Explorer/login token → long-lived user token → Page tokens (stored in Mongo).
 *
 * Permissions on the short token: pages_show_list, pages_read_engagement, pages_manage_posts
 */

const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  exchangeAndStore,
  getConnection,
  selectPage,
  debugToken
} = require('../utils/facebookToken');

router.post('/tokens/exchange', protect, adminOnly, async (req, res) => {
  try {
    const shortLivedUserToken = String(req.body.shortLivedUserToken || '').trim();
    const result = await exchangeAndStore(shortLivedUserToken, req.user._id);
    res.json({
      ok: true,
      message: 'Facebook Page token stored. Social publish will use the Page token.',
      ...result
    });
  } catch (err) {
    console.error('[facebook] token exchange failed:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/pages', protect, adminOnly, async (req, res) => {
  try {
    const connection = await getConnection();
    if (!connection) {
      return res.json({ connected: false, pages: [], selectedPageId: '' });
    }
    res.json({
      connected: true,
      stale: Boolean(connection.stale),
      staleReason: connection.staleReason || '',
      selectedPageId: connection.selectedPageId || '',
      userTokenExpiresAt: connection.facebookUserTokenExpiresAt,
      pages: (connection.pages || []).map((page) => ({
        pageId: page.pageId,
        pageName: page.pageName,
        tasks: page.tasks
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load Facebook pages' });
  }
});

router.post('/pages/select', protect, adminOnly, async (req, res) => {
  try {
    const result = await selectPage(req.body.pageId);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/tokens/debug', protect, adminOnly, async (req, res) => {
  try {
    const connection = await getConnection();
    const page = connection?.pages?.find((item) => item.pageId === connection.selectedPageId)
      || connection?.pages?.[0];
    const inputToken = String(req.query.inputToken || page?.pageAccessToken || connection?.facebookUserTokenLong || '').trim();
    const info = await debugToken(inputToken);
    res.json({ ok: true, ...info });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;
