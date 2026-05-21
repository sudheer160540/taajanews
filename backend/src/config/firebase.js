/**
 * Firebase Admin SDK initialization (lazy singleton).
 *
 * SECURITY: Credentials MUST never be hardcoded or committed. This module
 * resolves credentials from environment variables only, in this order:
 *
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON_BASE64
 *      A base64-encoded service-account JSON. Preferred for production
 *      (Render / Heroku / Vercel / Cloud Run secrets, etc.).
 *
 *   2. FIREBASE_SERVICE_ACCOUNT_JSON
 *      Raw JSON string of the service account. Useful when the deployment
 *      platform supports multi-line secrets.
 *
 *   3. GOOGLE_APPLICATION_CREDENTIALS  (or FIREBASE_SERVICE_ACCOUNT_PATH)
 *      Absolute filesystem path to a service-account JSON file. Useful
 *      for local development. The file MUST live outside the repo or be
 *      git-ignored (see .gitignore: *-firebase-adminsdk-*.json).
 *
 * If none of these are configured the module returns `null` from
 * `getMessaging()` and the rest of the app must treat push notifications
 * as a no-op rather than crashing.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

let initialized = false;
let initError = null;
let messagingInstance = null;

const REDACT = (s) => (s ? `${s.slice(0, 6)}…(${s.length} chars)` : 'unset');

const loadServiceAccount = () => {
  const {
    FIREBASE_SERVICE_ACCOUNT_JSON_BASE64,
    FIREBASE_SERVICE_ACCOUNT_JSON,
    FIREBASE_SERVICE_ACCOUNT_PATH,
    GOOGLE_APPLICATION_CREDENTIALS
  } = process.env;

  if (FIREBASE_SERVICE_ACCOUNT_JSON_BASE64) {
    const decoded = Buffer.from(FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString('utf8');
    return { source: 'FIREBASE_SERVICE_ACCOUNT_JSON_BASE64', json: JSON.parse(decoded) };
  }

  if (FIREBASE_SERVICE_ACCOUNT_JSON) {
    return { source: 'FIREBASE_SERVICE_ACCOUNT_JSON', json: JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON) };
  }

  const filePath = FIREBASE_SERVICE_ACCOUNT_PATH || GOOGLE_APPLICATION_CREDENTIALS;
  if (filePath) {
    const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    // basic path-traversal hygiene: must be a real, regular file
    const stat = fs.statSync(absolute);
    if (!stat.isFile()) {
      throw new Error(`Firebase service account path is not a regular file: ${absolute}`);
    }
    const raw = fs.readFileSync(absolute, 'utf8');
    return { source: `file:${absolute}`, json: JSON.parse(raw) };
  }

  return null;
};

const initFirebase = () => {
  if (initialized) return;
  initialized = true;

  try {
    const account = loadServiceAccount();
    if (!account) {
      initError = new Error(
        'Firebase credentials not configured. Push notifications are disabled. ' +
        'Set one of: FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, FIREBASE_SERVICE_ACCOUNT_JSON, ' +
        'FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS.'
      );
      console.warn(`[firebase] ${initError.message}`);
      return;
    }

    if (account.json.type !== 'service_account' || !account.json.project_id || !account.json.private_key) {
      throw new Error('Invalid service-account JSON: missing type/project_id/private_key.');
    }

    admin.initializeApp({
      credential: admin.credential.cert(account.json),
      projectId: account.json.project_id
    });

    messagingInstance = admin.messaging();

    console.log(
      `[firebase] Admin initialized — project=${account.json.project_id} ` +
      `source=${account.source} client_email=${REDACT(account.json.client_email)}`
    );
  } catch (err) {
    initError = err;
    console.error('[firebase] Initialization failed:', err.message);
  }
};

/**
 * Returns an initialized `admin.messaging()` instance, or `null` if Firebase
 * is not configured / failed to initialize. Callers must handle the `null`
 * case (push notifications become a no-op).
 */
const getMessaging = () => {
  if (!initialized) initFirebase();
  return messagingInstance;
};

const isConfigured = () => {
  if (!initialized) initFirebase();
  return messagingInstance !== null;
};

module.exports = {
  getMessaging,
  isConfigured
};
