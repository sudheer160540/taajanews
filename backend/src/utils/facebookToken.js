/**
 * Facebook token lifecycle: short user token → long-lived user → Page tokens.
 * Publish must use Page access_token only. Never log tokens or App Secret.
 */

const axios = require('axios');
const FacebookConnection = require('../models/FacebookConnection');

const GRAPH_VERSION = 'v26.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const CONNECTION_KEY = 'default';

const env = (key) => String(process.env[key] || '').trim();

const graphError = (err, fallback) => {
  const e = err.response?.data?.error;
  if (!e) return err.message || fallback || 'Facebook Graph error';
  const parts = [e.message || fallback || 'Facebook Graph error'];
  if (e.code != null) parts.push(`code ${e.code}`);
  if (e.error_subcode != null) parts.push(`subcode ${e.error_subcode}`);
  return parts.join(' — ');
};

const isGraph190 = (err) => Number(err.response?.data?.error?.code) === 190;

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
    const { data } = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
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
    const { data } = await axios.get(`${GRAPH_BASE}/me/accounts`, {
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

const getConnection = () => FacebookConnection.findOne({ key: CONNECTION_KEY });

const persistExchange = async ({ longLivedUserToken, expiresIn, pages, userId }) => {
  const preferredPageId = env('FACEBOOK_PAGE_ID');
  const selected = pages.find((page) => page.pageId === preferredPageId) || pages[0];
  const payload = {
    facebookUserTokenLong: longLivedUserToken,
    facebookUserTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
    pages,
    selectedPageId: selected?.pageId || '',
    stale: false,
    staleReason: '',
    updatedBy: userId || null
  };
  return FacebookConnection.findOneAndUpdate(
    { key: CONNECTION_KEY },
    payload,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const exchangeAndStore = async (shortLivedUserToken, userId) => {
  const exchanged = await exchangeShortLivedUserToken(shortLivedUserToken);
  const pages = await fetchPages(exchanged.longLivedUserToken);
  if (!pages.length) {
    const error = new Error('No Facebook Pages returned. Confirm pages_show_list and Page admin role.');
    error.statusCode = 400;
    throw error;
  }
  const saved = await persistExchange({ ...exchanged, pages, userId });
  return {
    userTokenExpiresIn: exchanged.expiresIn,
    userTokenExpiresAt: saved.facebookUserTokenExpiresAt,
    selectedPageId: saved.selectedPageId,
    pages: saved.pages.map((page) => ({
      pageId: page.pageId,
      pageName: page.pageName,
      tasks: page.tasks
    }))
  };
};

const selectPage = async (pageId) => {
  const connection = await getConnection();
  if (!connection) {
    const error = new Error('Facebook is not connected. Exchange a short-lived token first.');
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
  connection.stale = false;
  connection.staleReason = '';
  await connection.save();
  return { selectedPageId: connection.selectedPageId, pageName: page.pageName };
};

const markFacebookStale = async (reason = 'Facebook session expired — reconnect') => {
  await FacebookConnection.findOneAndUpdate(
    { key: CONNECTION_KEY },
    { stale: true, staleReason: reason }
  );
};

/** Never return a user token — /photos with a user token triggers deprecated publish_actions. */
const resolvePageTokenFromUserToken = async (userToken, preferredPageId) => {
  const { data } = await axios.get(`${GRAPH_BASE}/me/accounts`, {
    params: { fields: 'id,name,access_token,tasks', access_token: userToken },
    timeout: 20000
  });
  const pages = (data.data || [])
    .map((page) => ({
      pageId: String(page.id),
      pageName: page.name || '',
      pageAccessToken: page.access_token || '',
      tasks: page.tasks || []
    }))
    .filter((page) => page.pageId && page.pageAccessToken);
  const page = pages.find((item) => item.pageId === preferredPageId) || pages[0];
  if (!page) {
    const error = new Error('No Facebook Pages on this token. Need pages_show_list + Page admin.');
    error.statusCode = 400;
    throw error;
  }
  return { page, pages };
};

/** Page id + Page access token only. User tokens are exchanged via /me/accounts. */
const getFacebookPageAuth = async () => {
  const preferredPageId = env('FACEBOOK_PAGE_ID');
  const connection = await getConnection();
  if (connection && !connection.stale) {
    const page = connection.pages.find((item) => item.pageId === connection.selectedPageId)
      || connection.pages.find((item) => item.pageId === preferredPageId)
      || connection.pages[0];
    if (page?.pageAccessToken) {
      return { pageId: page.pageId, token: page.pageAccessToken, source: 'db' };
    }
  }

  const envToken = env('FACEBOOK_PAGE_ACCESS_TOKEN');
  if (!envToken) {
    if (connection?.stale) {
      return {
        skipped: 'facebook_reconnect_required',
        error: connection.staleReason || 'Facebook session expired — reconnect'
      };
    }
    return { skipped: 'missing_credentials' };
  }

  try {
    const { page, pages } = await resolvePageTokenFromUserToken(envToken, preferredPageId);
    await persistExchange({
      longLivedUserToken: envToken,
      expiresIn: 0,
      pages,
      userId: null
    });
    console.log(`[social] facebook resolved Page token via /me/accounts page=${page.pageId}`);
    return { pageId: page.pageId, token: page.pageAccessToken, source: 'me_accounts' };
  } catch (err) {
    if (isGraph190(err)) {
      await markFacebookStale('Facebook session expired — reconnect');
      return { skipped: 'facebook_reconnect_required', error: 'Facebook session expired — reconnect' };
    }
    // Env token may already be a Page token (cannot call /me/accounts).
    if (preferredPageId) {
      try {
        await axios.get(`${GRAPH_BASE}/${preferredPageId}`, {
          params: { fields: 'id,name', access_token: envToken },
          timeout: 15000
        });
        return { pageId: preferredPageId, token: envToken, source: 'env_page' };
      } catch (pageErr) {
        console.log(`[social] facebook env token is not a usable Page token: ${graphError(pageErr)}`);
      }
    }
    return {
      skipped: 'facebook_reconnect_required',
      error: graphError(err, 'Facebook needs a Page token. POST /api/facebook/tokens/exchange')
    };
  }
};

const debugToken = async (inputToken) => {
  const appId = env('FACEBOOK_APP_ID');
  const appSecret = env('FACEBOOK_APP_SECRET');
  if (!appId || !appSecret) {
    const error = new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set');
    error.statusCode = 500;
    throw error;
  }
  if (!inputToken) {
    const error = new Error('inputToken is required');
    error.statusCode = 400;
    throw error;
  }
  try {
    const { data } = await axios.get(`${GRAPH_BASE}/debug_token`, {
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
      appId: info.app_id || ''
    };
  } catch (err) {
    const error = new Error(graphError(err, 'Facebook debug_token failed'));
    error.statusCode = err.response?.status || 400;
    throw error;
  }
};

module.exports = {
  GRAPH_BASE,
  isGraph190,
  graphError,
  exchangeAndStore,
  getConnection,
  selectPage,
  markFacebookStale,
  getFacebookPageAuth,
  debugToken
};
