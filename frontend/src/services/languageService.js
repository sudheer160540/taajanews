import api from './api';

const CACHE_KEY = 'taaja_languages';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

/**
 * Language Service
 * Manages available languages and provides helper functions
 */
class LanguageService {
  constructor() {
    this.languages = [];
    this.defaultLanguage = null;
    this.lastFetch = null;
  }

  /**
   * Get languages from cache or API
   */
  async getLanguages(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh && this.languages.length > 0 && this.lastFetch) {
      const cacheAge = Date.now() - this.lastFetch;
      if (cacheAge < CACHE_EXPIRY) {
        return this.languages;
      }
    }

    // Check localStorage cache
    if (!forceRefresh) {
      const cached = this.getFromLocalStorage();
      if (cached) {
        this.languages = cached.languages;
        this.defaultLanguage = cached.defaultLanguage;
        this.lastFetch = cached.timestamp;
        
        // If cache is still valid, return it
        if (Date.now() - cached.timestamp < CACHE_EXPIRY) {
          return this.languages;
        }
      }
    }

    // Fetch from API
    try {
      const response = await api.get('/languages');
      this.languages = response.data.languages || [];
      this.defaultLanguage = this.languages.find(l => l.isDefault) || this.languages[0];
      this.lastFetch = Date.now();
      
      // Save to localStorage
      this.saveToLocalStorage();
      
      return this.languages;
    } catch (error) {
      console.error('Failed to fetch languages:', error);
      
      // Return cached data if available
      if (this.languages.length > 0) {
        return this.languages;
      }
      
      // Return fallback
      return [
        { code: 'en', name: 'English', nativeName: 'English', isDefault: true, isActive: true },
        { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', isDefault: false, isActive: true }
      ];
    }
  }

  /**
   * Get default language
   */
  async getDefaultLanguage() {
    if (!this.defaultLanguage) {
      await this.getLanguages();
    }
    return this.defaultLanguage;
  }

  /**
   * Get default language code
   */
  async getDefaultLanguageCode() {
    const defaultLang = await this.getDefaultLanguage();
    return defaultLang?.code || 'en';
  }

  /**
   * Get active language codes
   */
  async getActiveLanguageCodes() {
    const languages = await this.getLanguages();
    return languages.filter(l => l.isActive).map(l => l.code);
  }

  /**
   * Check if language code is valid
   */
  async isValidLanguageCode(code) {
    const codes = await this.getActiveLanguageCodes();
    return codes.includes(code);
  }

  /**
   * Get language by code
   */
  async getLanguageByCode(code) {
    const languages = await this.getLanguages();
    return languages.find(l => l.code === code);
  }

  /**
   * Clear cache and refresh
   */
  async refreshCache() {
    this.languages = [];
    this.defaultLanguage = null;
    this.lastFetch = null;
    localStorage.removeItem(CACHE_KEY);
    return this.getLanguages(true);
  }

  /**
   * Save to localStorage
   */
  saveToLocalStorage() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        languages: this.languages,
        defaultLanguage: this.defaultLanguage,
        timestamp: this.lastFetch
      }));
    } catch (error) {
      console.warn('Failed to save languages to localStorage:', error);
    }
  }

  /**
   * Get from localStorage
   */
  getFromLocalStorage() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Failed to read languages from localStorage:', error);
    }
    return null;
  }

  // ============ Admin API Methods ============

  /**
   * Get all languages (including inactive)
   */
  async getAllLanguages() {
    const response = await api.get('/languages/all');
    return response.data.languages;
  }

  /**
   * Create new language
   */
  async createLanguage(languageData) {
    const response = await api.post('/languages', languageData);
    await this.refreshCache();
    return response.data;
  }

  /**
   * Update language
   */
  async updateLanguage(id, languageData) {
    const response = await api.put(`/languages/${id}`, languageData);
    await this.refreshCache();
    return response.data;
  }

  /**
   * Set language as default
   */
  async setDefaultLanguage(id) {
    const response = await api.put(`/languages/${id}/default`);
    await this.refreshCache();
    return response.data;
  }

  /**
   * Delete/deactivate language
   */
  async deleteLanguage(id) {
    const response = await api.delete(`/languages/${id}`);
    await this.refreshCache();
    return response.data;
  }

  /**
   * Reorder languages
   */
  async reorderLanguages(orders) {
    const response = await api.put('/languages/reorder/batch', { orders });
    await this.refreshCache();
    return response.data;
  }
}

// Export singleton instance
const languageService = new LanguageService();
export default languageService;

// Export helper function
export const getLocalizedValue = (field, lang, fallbackLang = 'en') => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field[lang] || field[fallbackLang] || Object.values(field)[0] || '';
};
