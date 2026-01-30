/**
 * Language Cache Utility
 * Caches active languages in memory to avoid DB queries on every request
 */

let cachedLanguages = null;
let defaultLanguage = null;
let lastRefresh = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get the Language model (lazy loaded to avoid circular dependencies)
 */
const getLanguageModel = () => {
  return require('../models/Language');
};

/**
 * Check if cache needs refresh
 */
const needsRefresh = () => {
  if (!cachedLanguages || !lastRefresh) return true;
  return Date.now() - lastRefresh > CACHE_TTL;
};

/**
 * Refresh the language cache from database
 */
const refreshCache = async () => {
  try {
    const Language = getLanguageModel();
    cachedLanguages = await Language.find({ isActive: true }).sort({ order: 1 }).lean();
    
    const defaultLang = cachedLanguages.find(l => l.isDefault);
    defaultLanguage = defaultLang || cachedLanguages[0] || { code: 'en', name: 'English', nativeName: 'English' };
    
    lastRefresh = Date.now();
    
    return cachedLanguages;
  } catch (error) {
    console.error('Failed to refresh language cache:', error);
    // Return fallback if cache refresh fails
    if (!cachedLanguages) {
      cachedLanguages = [{ code: 'en', name: 'English', nativeName: 'English', isDefault: true, isActive: true }];
      defaultLanguage = cachedLanguages[0];
    }
    return cachedLanguages;
  }
};

/**
 * Get all active languages (from cache)
 */
const getActiveLanguages = async () => {
  if (needsRefresh()) {
    await refreshCache();
  }
  return cachedLanguages;
};

/**
 * Get the default language (from cache)
 */
const getDefaultLanguage = async () => {
  if (needsRefresh()) {
    await refreshCache();
  }
  return defaultLanguage;
};

/**
 * Get the default language code
 */
const getDefaultLanguageCode = async () => {
  const lang = await getDefaultLanguage();
  return lang?.code || 'en';
};

/**
 * Get all active language codes
 */
const getActiveLanguageCodes = async () => {
  const languages = await getActiveLanguages();
  return languages.map(l => l.code);
};

/**
 * Check if a language code is valid/active
 */
const isValidLanguageCode = async (code) => {
  const codes = await getActiveLanguageCodes();
  return codes.includes(code);
};

/**
 * Initialize cache on startup
 */
const initializeCache = async () => {
  try {
    await refreshCache();
    console.log(`Language cache initialized with ${cachedLanguages.length} languages`);
  } catch (error) {
    console.error('Failed to initialize language cache:', error);
  }
};

/**
 * Clear the cache (useful for testing)
 */
const clearCache = () => {
  cachedLanguages = null;
  defaultLanguage = null;
  lastRefresh = null;
};

module.exports = {
  refreshCache,
  getActiveLanguages,
  getDefaultLanguage,
  getDefaultLanguageCode,
  getActiveLanguageCodes,
  isValidLanguageCode,
  initializeCache,
  clearCache
};
