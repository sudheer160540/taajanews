/**
 * Facebook Page connect (admin).
 *
 * POST /api/facebook/connect
 *   { "shortLivedUserToken": "EAA..." }
 *   Exchanges short user token → long-lived user token → stores Page token.
 *   Scopes on the short token: pages_show_list, pages_read_engagement, pages_manage_posts
 *
 * GET  /api/facebook/status
 * POST /api/facebook/pages/select  { pageId }
 * POST /api/facebook/disconnect
 * GET  /api/facebook/tokens/debug
 *
 * Tokens never returned to the client.
 */

const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  connectWithShortLivedToken,
  getConnection,
  publicConnectionView,
  selectPage,
  disconnectFacebook,
  debugToken
} = require('../utils/facebookToken');

const handleConnect = async (req, res) => {
  try {
    const shortLivedUserToken = String(req.body.shortLivedUserToken || '').trim();
    const result = await connectWithShortLivedToken(shortLivedUserToken, req.user._id);
    res.json({
      ok: true,
      message: 'Facebook connected. Social publish uses the stored Page token.',
      ...result
    });
  } catch (err) {
    console.error('[facebook] connect failed:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

router.post('/connect', protect, adminOnly, handleConnect);
router.post('/tokens/exchange', protect, adminOnly, handleConnect);

router.get('/status', protect, adminOnly, async (req, res) => {
  try {
    const connection = await getConnection();
    res.json({ ok: true, ...publicConnectionView(connection) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load Facebook status' });
  }
});

router.get('/pages', protect, adminOnly, async (req, res) => {
  try {
    const connection = await getConnection();
    const view = publicConnectionView(connection);
    res.json({
      connected: view.status === 'connected',
      stale: view.status === 'expired',
      staleReason: view.facebookLastError,
      selectedPageId: view.selectedPageId,
      userTokenExpiresAt: view.facebookUserTokenExpiresAt,
      pages: view.pages
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

router.post('/disconnect', protect, adminOnly, async (req, res) => {
  try {
    const result = await disconnectFacebook();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect Facebook' });
  }
});

router.get('/tokens/debug', protect, adminOnly, async (req, res) => {
  try {
    const info = await debugToken();
    res.json({ ok: true, ...info });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;
