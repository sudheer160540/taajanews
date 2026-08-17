import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  normalizeLang,
  getLocalizedArticle,
  getLocalizedField,
  getUnavailableMessage
} from '../utils/articleLocalization';

const LanguageContext = createContext(null);

/**
 * Single global language source of truth for the whole website.
 * - UI strings: react-i18next (synced via changeLanguage)
 * - Article data: getLocalizedArticle(article, language)
 * - Persistence: localStorage + cookie via i18n languageChanged handler
 */
export const LanguageProvider = ({ children }) => {
  const { i18n, t } = useTranslation();
  const [language, setLanguageState] = useState(() =>
    normalizeLang(i18n.language || DEFAULT_LANGUAGE)
  );

  const setLanguage = useCallback(
    (nextLang) => {
      const code = normalizeLang(nextLang);
      if (!SUPPORTED_LANGUAGES.includes(code)) return;
      setLanguageState(code);
      if (normalizeLang(i18n.language) !== code) {
        i18n.changeLanguage(code);
      }
    },
    [i18n]
  );

  // Keep React state in sync if i18n changes elsewhere (e.g. onboarding)
  useEffect(() => {
    const handleChange = (lng) => {
      setLanguageState(normalizeLang(lng));
    };
    i18n.on('languageChanged', handleChange);
    // Ensure i18n matches our normalized code on mount
    const current = normalizeLang(i18n.language);
    if (normalizeLang(i18n.language) !== current) {
      i18n.changeLanguage(current);
    } else {
      setLanguageState(current);
    }
    return () => {
      i18n.off('languageChanged', handleChange);
    };
  }, [i18n]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      supportedLanguages: SUPPORTED_LANGUAGES,
      defaultLanguage: DEFAULT_LANGUAGE,
      t,
      /** Localize an article to the current global language */
      localizeArticle: (article) => getLocalizedArticle(article, language),
      /** Localize a multilingual field (category name, etc.) */
      localizeField: (field) => getLocalizedField(field, language),
      unavailableMessage: getUnavailableMessage(language)
    }),
    [language, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
};

export default LanguageContext;
