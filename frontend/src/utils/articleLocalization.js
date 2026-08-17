/**
 * Central article localization — REAL API/DB shape:
 *
 *   title:   { te, en, hi }
 *   summary: { te, en, hi }
 *   content: { te, en, hi }
 *   audio:   { te, en, hi }   // Azure URLs
 *
 * CRITICAL: Never fall back across languages.
 * Missing fields → explicit unavailable message.
 */

export const SUPPORTED_LANGUAGES = ['te', 'en', 'hi'];
export const DEFAULT_LANGUAGE = 'te';

export const normalizeLang = (lang) => {
  const code = String(lang || DEFAULT_LANGUAGE).split('-')[0].toLowerCase();
  return SUPPORTED_LANGUAGES.includes(code) ? code : DEFAULT_LANGUAGE;
};

const LANG_KEYS = new Set(SUPPORTED_LANGUAGES);

const LANGUAGE_LABELS = {
  te: 'Telugu',
  en: 'English',
  hi: 'Hindi'
};

export const getLanguageLabel = (lang) => LANGUAGE_LABELS[normalizeLang(lang)] || normalizeLang(lang);

/**
 * Convert API value into a lang→string map when possible.
 * Returns null when the value is a single legacy flattened string.
 */
export const toLanguageMap = (value) => {
  if (value == null) return null;
  if (typeof value === 'string') return null;
  if (value instanceof Map) {
    const out = {};
    value.forEach((v, k) => {
      if (typeof v === 'string' && v.trim()) out[String(k)] = v.trim();
    });
    return out;
  }
  if (typeof value === 'object') {
    const out = {};
    let foundLangKey = false;
    Object.entries(value).forEach(([k, v]) => {
      if (typeof v === 'string' && v.trim()) {
        out[k] = v.trim();
        if (LANG_KEYS.has(k)) foundLangKey = true;
      }
    });
    if (Object.keys(value).length === 0) return {};
    if (foundLangKey || Object.keys(out).length > 0) return out;
  }
  return null;
};

/** Pick ONLY the selected language from a map — never another language. */
const pickStrict = (map, lang) => {
  if (!map) return '';
  const value = map[lang];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
};

/**
 * Category / metadata helper.
 * Selected language only — NO cross-language fallback.
 */
export const getLocalizedField = (field, lang) => {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  const code = normalizeLang(lang);
  const map = toLanguageMap(field);
  if (!map) return '';
  return pickStrict(map, code);
};

const UNAVAILABLE_MESSAGES = {
  te: 'తెలుగు వెర్షన్ అందుబాటులో లేదు',
  en: 'English version unavailable',
  hi: 'हिंदी संस्करण उपलब्ध नहीं है'
};

export const getUnavailableMessage = (lang) =>
  UNAVAILABLE_MESSAGES[normalizeLang(lang)] || 'Version unavailable';

/**
 * ONE language for title + summary + content + audio.
 * Never mixes languages. Never falls back to another language.
 */
export const getLocalizedArticle = (article, selectedLanguage) => {
  if (!article) return null;
  const lang = normalizeLang(selectedLanguage);

  const titleMap = toLanguageMap(article.title);
  const summaryMap = toLanguageMap(article.summary);
  const contentMap = toLanguageMap(article.content);
  const audioMap = toLanguageMap(article.audio);

  /**
   * Prefer language maps (full multilingual payloads).
   * If the API already flattened to a single string for this request's lang,
   * trust that string for the selected language only — never read another language key.
   */
  const resolveText = (map, legacyValue) => {
    if (map) {
      const value = pickStrict(map, lang);
      return { value, missing: !value };
    }
    if (typeof legacyValue === 'string' && legacyValue.trim()) {
      return { value: legacyValue.trim(), missing: false };
    }
    return { value: '', missing: true };
  };

  const titleResult = resolveText(titleMap, article.title);
  const summaryResult = resolveText(summaryMap, article.summary);
  const contentResult = resolveText(contentMap, article.content);

  const audioUrl = audioMap ? pickStrict(audioMap, lang) || null : null;
  const audioMissing = !audioUrl;

  const missing = {
    title: titleResult.missing,
    summary: summaryResult.missing,
    content: contentResult.missing,
    audio: audioMissing
  };

  const hasAnySelectedText = !!(titleResult.value || summaryResult.value || contentResult.value);

  if (lang !== 'te') {
    const missingFields = Object.entries(missing)
      .filter(([, isMissing]) => isMissing)
      .map(([field]) => field);
    if (missingFields.length) {
      console.warn(
        `[localization] ${getLanguageLabel(lang)} selected — missing fields (NO cross-language fallback):`,
        missingFields,
        {
          articleId: article._id || article.slug,
          titleKeys: titleMap ? Object.keys(titleMap) : typeof article.title,
          summaryKeys: summaryMap ? Object.keys(summaryMap) : typeof article.summary,
          contentKeys: contentMap ? Object.keys(contentMap) : typeof article.content,
          audioKeys: audioMap ? Object.keys(audioMap) : typeof article.audio
        }
      );
    }
  }

  return {
    ...article,
    title: titleResult.value,
    summary: summaryResult.value,
    content: contentResult.value,
    audioUrl,
    localization: {
      lang,
      label: getLanguageLabel(lang),
      missing,
      unavailable: !hasAnySelectedText,
      unavailableMessage: getUnavailableMessage(lang),
      maps: {
        title: titleMap,
        summary: summaryMap,
        content: contentMap,
        audio: audioMap
      }
    },
    category: article.category
      ? {
          ...article.category,
          name: getLocalizedField(article.category.name, lang)
        }
      : article.category
  };
};
