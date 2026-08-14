import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeLangCode } from '../i18n';

/**
 * Apply ?lang= from the current URL (shared article links, etc.).
 * Persists via i18n languageChanged → localStorage taaja_lang.
 */
const LanguageFromUrl = () => {
  const [searchParams] = useSearchParams();
  const { i18n } = useTranslation();

  useEffect(() => {
    const fromUrl = normalizeLangCode(searchParams.get('lang'));
    if (!fromUrl) return;

    const current = normalizeLangCode(i18n.language) || i18n.language;
    if (current === fromUrl) return;

    i18n.changeLanguage(fromUrl);
  }, [searchParams, i18n]);

  return null;
};

export default LanguageFromUrl;
