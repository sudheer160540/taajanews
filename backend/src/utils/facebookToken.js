/**
 * Facebook Page token lifecycle.
 * Short user token → long-lived user token (~60d) → Page token (usually no expiry).
 * Publish uses Page token + POST /{pageId}/photos only. Never publish_actions /me/feed.
 */

const axios = require('axios');
const FacebookConnection = require('../models/FacebookConnection');
const { encryptSecret, decryptSecret } = require('./facebookCrypto');

const CONNECTION_KEY = 'default';
const env = (key) => String(process.env[key] || '').trim();

const graphVersion = () => env('FACEBOOK_GRAPH_VERSION') || 'v26.0';
const graphBase = () => `https://graph.facebook.com/${graphVersion()}`;

const graphError = (err, fallback) => {
  const e = err.response?.data?.error;
  if (!e) return err.message || fallback || 'Facebook Graph error';
  const parts = [e.message || fallback || 'Facebook Graph error'];
  if (e.code != null) parts.push(`code ${e.code}`);
  if (e.error_subcode != null) parts.push(`subcode ${e.error_subcode}`);
  return parts.join(' — ');
};

const isGraph190 = (err) => Number(err.response?.data?.error?.code) === 190;

const getConnection = () => FacebookConnection.findOne({ key: CONNECTION_KEY });

const publicConnectionView = (connection) => {
  if (!connection) {
    return {
      status: 'disconnected',
      facebookPageId: '',
      facebookPageName: '',
      facebookUserTokenExpiresAt: null,
      facebookConnectedAt: null,
      facebookLastError: '',
      selectedPageId: '',
      pages: []
    };
  }
  return {
    status: connection.facebookConnectionStatus || 'disconnected',
    facebookPageId: connection.facebookPageId || '',
    facebookPageName: connection.facebookPageName || '',
    facebookUserTokenExpiresAt: connection.facebookUserTokenExpiresAt,
    facebookConnectedAt: connection.facebookConnectedAt,
    facebookLastError: connection.facebookLastError || '',
    selectedPageId: connection.selectedPageId || '',
    pages: (connection.pages || []).map((page) => ({
      pageId: page.pageId,
      pageName: page.pageName,
      tasks: page.tasks
    }))
  };
};

const selectedPageFrom = (connection, preferredPageId) => {
  if (!connection) return null;
  return connection.pages.find((item) => item.pageId === connection.selectedPageId)
    || connection.pages.find((item) => item.pageId === preferredPageId)
    || connection.pages[0]
    || null;
};

const exchangeShortLivedUserToken = async (shortLivedUserToken) => {
  const appId = env('FACEBOOK_APP_ID');
  const appSecret = env('FACEBOOK_APP_SECRET');
  if (!appId || !appSecret) {
    const error = new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set');
    error.statusCode = 500;
    throw error;
  }
  if (!shortLivedUserToken) {
    const error = new Error('shortLivedUserToken is required');
    error.statusCode = 400;
    throw error;
  }

  try {
    const { data } = await axios.get(`${graphBase()}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedUserToken
      },
      timeout: 20000
    });
    if (!data?.access_token) {
      const error = new Error('Facebook token exchange returned no access_token');
      error.statusCode = 400;
      throw error;
    }
    return {
      longLivedUserToken: data.access_token,
      expiresIn: Number(data.expires_in) || 5184000
    };
  } catch (err) {
    if (err.statusCode) throw err;
    const error = new Error(graphError(err, 'Facebook token exchange failed'));
    error.statusCode = err.response?.status || 400;
    throw error;
  }
};

const fetchPages = async (longLivedUserToken) => {
  try {
    const { data } = await axios.get(`${graphBase()}/me/accounts`, {
      params: {
        fields: 'id,name,access_token,tasks',
        access_token: longLivedUserToken
      },
      timeout: 20000
    });
    return (data.data || []).map((page) => ({
      pageId: String(page.id),
      pageName: page.name || '',
      pageAccessToken: page.access_token || '',
      tasks: page.tasks || []
    })).filter((page) => page.pageId && page.pageAccessToken);
  } catch (err) {
    const error = new Error(graphError(err, 'Failed to list Facebook Pages'));
    error.statusCode = err.response?.status || 400;
    throw error;
  }
};

const persistConnected = async ({ longLivedUserToken, expiresIn, pages, userId }) => {
  const preferredPageId = env('FACEBOOK_PAGE_ID');
  const selected = pages.find((page) => page.pageId === preferredPageId) || pages[0];
  const encryptedPages = pages.map((page) => ({
    ...page,
    pageAccessToken: encryptSecret(page.pageAccessToken)
  }));
  const payload = {
    facebookUserAccessTokenLong: encryptSecret(longLivedUserToken),
    facebookUserTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
    facebookPageId: selected?.pageId || '',
    facebookPageAccessToken: selected ? encryptSecret(selected.pageAccessToken) : '',
    facebookPageName: selected?.pageName || '',
    facebookConnectionStatus: 'connected',
    facebookConnectedAt: new Date(),
    facebookLastError: '',
    pages: encryptedPages,
    selectedPageId: selected?.pageId || '',
    updatedBy: userId || null
  };
  return FacebookConnection.findOneAndUpdate(
    { key: CONNECTION_KEY },
    payload,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const connectWithShortLivedToken = async (shortLivedUserToken, userId) => {
  const exchanged = await exchangeShortLivedUserToken(shortLivedUserToken);
  const pages = await fetchPages(exchanged.longLivedUserToken);
  if (!pages.length) {
    const error = new Error('No Facebook Pages returned. Confirm pages_show_list and Page admin role.');
    error.statusCode = 400;
    throw error;
  }
  const saved = await persistConnected({ ...exchanged, pages, userId });
  return publicConnectionView(saved);
};

const selectPage = async (pageId) => {
  const connection = await getConnection();
  if (!connection || connection.facebookConnectionStatus === 'disconnected') {
    const error = new Error('Facebook is not connected. POST /api/facebook/connect first.');
    error.statusCode = 400;
    throw error;
  }
  const page = connection.pages.find((item) => item.pageId === String(pageId));
  if (!page) {
    const error = new Error('Page not found in stored Facebook connection');
    error.statusCode = 404;
    throw error;
  }
  connection.selectedPageId = page.pageId;
  connection.facebookPageId = page.pageId;
  connection.facebookPageName = page.pageName;
  connection.facebookPageAccessToken = page.pageAccessToken;
  connection.facebookConnectionStatus = 'connected';
  connection.facebookLastError = '';
  await connection.save();
  return {
    selectedPageId: connection.selectedPageId,
    facebookPageName: page.pageName,
    status: 'connected'
  };
};

const markFacebookExpired = async (reason = 'Facebook session expired — reconnect') => {
  await FacebookConnection.findOneAndUpdate(
    { key: CONNECTION_KEY },
    {
      facebookConnectionStatus: 'expired',
      facebookLastError: reason,
      stale: undefined
    }
  );
};

const disconnectFacebook = async () => {
  await FacebookConnection.findOneAndUpdate(
    { key: CONNECTION_KEY },
    {
      facebookUserAccessTokenLong: '',
      facebookUserTokenExpiresAt: null,
      facebookPageId: '',
      facebookPageAccessToken: '',
      facebookPageName: '',
      facebookConnectionStatus: 'disconnected',
      facebookConnectedAt: null,
      facebookLastError: '',
      pages: [],
      selectedPageId: ''
    },
    { upsert: true }
  );
  return { status: 'disconnected' };
};

/** Page id + Page token for publish. Never returns a user token. */
const getFacebookPageAuth = async () => {
  const preferredPageId = env('FACEBOOK_PAGE_ID');
  const connection = await getConnection();
  const status = connection?.facebookConnectionStatus;

  if (connection && status === 'connected') {
    const page = selectedPageFrom(connection, preferredPageId);
    const token = decryptSecret(page?.pageAccessToken || connection.facebookPageAccessToken);
    const pageId = page?.pageId || connection.facebookPageId;
    if (pageId && token) {
      return { pageId, token, source: 'db' };
    }
  }

  if (status === 'expired') {
    return {
      skipped: 'facebook_reconnect_required',
      error: connection.facebookLastError || 'Facebook session expired — reconnect'
    };
  }

  return {
    skipped: 'facebook_reconnect_required',
    error: 'Facebook is not connected. Admin: POST /api/facebook/connect with a short-lived user token.'
  };
};

const debugStoredPageToken = async () => {
  const appId = env('FACEBOOK_APP_ID');
  const appSecret = env('FACEBOOK_APP_SECRET');
  if (!appId || !appSecret) {
    const error = new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set');
    error.statusCode = 500;
    throw error;
  }
  const connection = await getConnection();
  const page = selectedPageFrom(connection, env('FACEBOOK_PAGE_ID'));
  const inputToken = decryptSecret(page?.pageAccessToken || connection?.facebookPageAccessToken);
  if (!inputToken) {
    const error = new Error('No stored Page token. POST /api/facebook/connect first.');
    error.statusCode = 400;
    throw error;
  }
  try {
    const { data } = await axios.get(`${graphBase()}/debug_token`, {
      params: {
        input_token: inputToken,
        access_token: `${appId}|${appSecret}`
      },
      timeout: 15000
    });
    const info = data.data || {};
    return {
      isValid: Boolean(info.is_valid),
      expiresAt: info.expires_at || 0,
      scopes: info.scopes || [],
      type: info.type || '',
      appId: info.app_id || '',
      status: connection?.facebookConnectionStatus || 'disconnected'
    };
  } catch (err) {
    const error = new Error(graphError(err, 'Facebook debug_token failed'));
    error.statusCode = err.response?.status || 400;
    throw error;
  }
};

module.exports = {
  graphBase,
  isGraph190,
  graphError,
  connectWithShortLivedToken,
  exchangeAndStore: connectWithShortLivedToken,
  getConnection,
  publicConnectionView,
  selectPage,
  markFacebookExpired,
  markFacebookStale: markFacebookExpired,
  disconnectFacebook,
  getFacebookPageAuth,
  debugToken: debugStoredPageToken
};
