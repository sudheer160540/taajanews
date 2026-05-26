const axios = require('axios');
const OpenAI = require('openai');

let openaiClient = null;

const getOpenAI = () => {
  if (!openaiClient) {
    if (!process.env.OPEN_API_KEY) {
      throw new Error('OPEN_API_KEY is not configured');
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPEN_API_KEY });
  }
  return openaiClient;
};

const SUPPORTED_LANGUAGES = {
  te: 'Telugu',
  en: 'English',
  hi: 'Hindi'
};

const ALL_LANG_CODES = Object.keys(SUPPORTED_LANGUAGES);

const SARVAM_LANG_CODES = {
  te: 'te-IN',
  en: 'en-IN',
  hi: 'hi-IN'
};

const SARVAM_API_URL = 'https://api.sarvam.ai';
const SARVAM_TRANSLATE_LIMIT = 1000;

function chunkText(text, maxLen) {
  if (!text || text.length <= maxLen) return [text];

  const chunks = [];
  const sentences = text.split(/(?<=[.!?।\n])\s*/);
  let current = '';

  for (const sentence of sentences) {
    if (sentence.length > maxLen) {
      if (current) { chunks.push(current); current = ''; }
      for (let i = 0; i < sentence.length; i += maxLen) {
        chunks.push(sentence.slice(i, i + maxLen));
      }
    } else if ((current + ' ' + sentence).trim().length > maxLen) {
      if (current) chunks.push(current);
      current = sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function sarvamTranslate(text, sourceLang, targetLang) {
  if (!text || !text.trim()) return '';

  const chunks = chunkText(text, SARVAM_TRANSLATE_LIMIT);
  const translated = [];

  for (const chunk of chunks) {
    if (!chunk || !chunk.trim()) { translated.push(''); continue; }

    const { data } = await axios.post(`${SARVAM_API_URL}/translate`, {
      input: chunk,
      source_language_code: SARVAM_LANG_CODES[sourceLang],
      target_language_code: SARVAM_LANG_CODES[targetLang],
      model: 'mayura:v1'
    }, {
      headers: { 'api-subscription-key': process.env.SARVAM_API_KEY }
    });

    translated.push(data.translated_text || '');
  }

  return translated.join(' ');
}

async function openaiTranslate(text, targetLangName) {
  if (!text || !text.trim()) return '';

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a professional translator. Translate the given text accurately while preserving meaning, tone, and formatting. Return ONLY the translated text, nothing else.'
      },
      {
        role: 'user',
        content: `Translate the following text to ${targetLangName}:\n\n${text}`
      }
    ],
    temperature: 0.3
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}

async function translateField(text, sourceLang, targetLang) {
  if (!text || !String(text).trim()) return '';
  if (sourceLang === targetLang) return String(text).trim();

  const useSarvam = process.env.TRANSLATE_TYPE === 'sarvam';

  if (useSarvam) {
    return sarvamTranslate(text, sourceLang, targetLang);
  }
  return openaiTranslate(text, SUPPORTED_LANGUAGES[targetLang]);
}

/**
 * Detect whether input is Telugu, Hindi (Devanagari), or English (Latin).
 */
const detectSourceLanguage = (text) => {
  const sample = String(text || '').slice(0, 800);
  const teluguChars = (sample.match(/[\u0C00-\u0C7F]/g) || []).length;
  const hindiChars = (sample.match(/[\u0900-\u097F]/g) || []).length;

  if (teluguChars > hindiChars && teluguChars >= 8) return 'te';
  if (hindiChars >= 8) return 'hi';
  return 'en';
};

/**
 * English-hub translation for te / en / hi:
 *   1) Source (te, en, or hi) → English
 *   2) English → Telugu and Hindi (and English)
 *
 * @param {string} text - Input in any supported language
 * @param {string|null} sourceLangHint - Optional hint ('te'|'en'|'hi'); auto-detect if omitted
 * @param {string[]} allLangs - Language codes to fill (default te, en, hi)
 */
async function twoStepTranslateField(text, sourceLangHint, allLangs = ALL_LANG_CODES) {
  const trimmed = String(text || '').trim();
  const empty = { te: '', en: '', hi: '' };
  if (!trimmed) return empty;

  const hinted =
    sourceLangHint && ALL_LANG_CODES.includes(sourceLangHint) ? sourceLangHint : null;
  const sourceLang = hinted || detectSourceLanguage(trimmed);

  // Step 1: normalize to English first (skip if already English)
  let englishText = trimmed;
  if (sourceLang !== 'en') {
    englishText = await translateField(trimmed, sourceLang, 'en');
  }

  const result = { te: '', en: '', hi: '' };
  if (allLangs.includes('en')) {
    result.en = englishText;
  }

  // Step 2: from English → Telugu and Hindi (parallel)
  const fromEnglish = allLangs.filter((lang) => lang !== 'en');
  if (fromEnglish.length > 0) {
    const pairs = await Promise.all(
      fromEnglish.map(async (lang) => [lang, await translateField(englishText, 'en', lang)])
    );
    for (const [lang, translated] of pairs) {
      result[lang] = translated;
    }
  }

  return result;
}

// ── Source article ingest: config + smart summary/translation ─────────────

const parseSourceSet = (envKey) => {
  const raw = process.env[envKey] || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
};

const getTeluguSourceSet = () => parseSourceSet('TELUGU_SOURCES');
const getEnglishSourceSet = () => parseSourceSet('ENGLISH_SOURCES');

const getSummaryCharLimits = () => {
  const min = Math.max(1, parseInt(process.env.SOURCE_SUMMARY_MIN_CHARS, 10) || 300);
  const max = Math.max(min, parseInt(process.env.SOURCE_SUMMARY_MAX_CHARS, 10) || 500);
  return { min, max };
};

const getContentMaxWords = () =>
  Math.max(1, parseInt(process.env.SOURCE_CONTENT_MAX_WORDS, 10) || 1000);

/**
 * Resolve anchor language for a scraped source article.
 * Telugu/English source lists take precedence; otherwise script detection.
 */
const resolveAnchorLanguage = (sourceName, contentText) => {
  const source = String(sourceName || '').trim().toLowerCase();
  if (getTeluguSourceSet().has(source)) return 'te';
  if (getEnglishSourceSet().has(source)) return 'en';
  return detectSourceLanguage(contentText);
};

const truncateAtSentence = (text, maxChars) => {
  const trimmed = String(text || '').trim();
  if (trimmed.length <= maxChars) return trimmed;

  const cut = trimmed.slice(0, maxChars);
  const punctMatch = cut.match(/^(.*[.!?।])\s*/);
  if (punctMatch && punctMatch[1].length >= maxChars * 0.5) {
    return punctMatch[1].trim();
  }
  return cut.trim();
};

const truncateToWordCount = (text, maxWords) => {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return words.slice(0, maxWords).join(' ');
};

const parseJsonObject = (raw) => {
  const stripped = String(raw || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(stripped);
};

/**
 * OpenAI: condense raw article into summary (300–500 chars) + body (≤1000 words)
 * in the anchor language. Sarvam cannot summarize; this step always uses OpenAI.
 */
async function generateSummaryAndContent(rawText, anchorLang) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) {
    throw new Error('Cannot generate summary/content from empty source text');
  }
  if (!ALL_LANG_CODES.includes(anchorLang)) {
    throw new Error(`Unsupported anchor language: ${anchorLang}`);
  }

  const { min: summaryMin, max: summaryMax } = getSummaryCharLimits();
  const maxWords = getContentMaxWords();
  const languageName = SUPPORTED_LANGUAGES[anchorLang];

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a professional news editor for Taaja News. Produce factual, journalistic ' +
          'summaries and condensed article bodies. Never invent facts, names, dates, or quotes ' +
          'not present in the source. Return ONLY valid JSON with no markdown fences.'
      },
      {
        role: 'user',
        content:
          `Read the following news article and produce two fields in ${languageName}:\n\n` +
          `1) "summary" — ${summaryMin} to ${summaryMax} characters, complete sentences, key facts only\n` +
          `2) "content" — at most ${maxWords} words, condensed full story preserving names, dates, places, and important quotes\n\n` +
          `Return ONLY this JSON shape: {"summary":"...","content":"..."}\n\n` +
          `Source article:\n\n${trimmed}`
      }
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });

  const responseText = completion.choices[0]?.message?.content?.trim();
  if (!responseText) {
    throw new Error('OpenAI returned empty summary/content generation response');
  }

  let parsed;
  try {
    parsed = parseJsonObject(responseText);
  } catch {
    throw new Error('Failed to parse summary/content JSON from OpenAI');
  }

  let summary = String(parsed.summary || '').trim();
  let content = String(parsed.content || '').trim();

  if (!summary) throw new Error('Generated summary is empty');
  if (!content) throw new Error('Generated content is empty');

  if (summary.length > summaryMax) {
    summary = truncateAtSentence(summary, summaryMax);
  }
  content = truncateToWordCount(content, maxWords);

  return { summary, content };
}

/**
 * Expand text to te/en/hi without re-translating the anchor language.
 */
async function toTrilingual(text, anchorLang) {
  const trimmed = String(text || '').trim();
  const result = { te: '', en: '', hi: '' };
  if (!trimmed) return result;

  if (!ALL_LANG_CODES.includes(anchorLang)) {
    throw new Error(`Unsupported anchor language: ${anchorLang}`);
  }

  result[anchorLang] = trimmed;

  const others = ALL_LANG_CODES.filter((lang) => lang !== anchorLang);
  const pairs = await Promise.all(
    others.map(async (lang) => [lang, await translateField(trimmed, anchorLang, lang)])
  );
  for (const [lang, translated] of pairs) {
    result[lang] = translated;
  }

  return result;
}

/**
 * Build title, summary, and content maps for source-article → Article conversion.
 */
async function buildSourceArticleMultilingual({ title, contentText, source }) {
  const titleTrimmed = String(title || '').trim();
  const contentTrimmed = String(contentText || '').trim();

  if (!titleTrimmed) throw new Error('Source article has no title');
  if (!contentTrimmed) throw new Error('Source article has no contentText');

  const anchorLang = resolveAnchorLanguage(source, contentTrimmed);
  const { summary, content } = await generateSummaryAndContent(contentTrimmed, anchorLang);

  const [titleMap, summaryMap, contentMap] = await Promise.all([
    toTrilingual(titleTrimmed, anchorLang),
    toTrilingual(summary, anchorLang),
    toTrilingual(content, anchorLang)
  ]);

  return { title: titleMap, summary: summaryMap, content: contentMap, anchorLang };
}

module.exports = {
  SUPPORTED_LANGUAGES,
  ALL_LANG_CODES,
  chunkText,
  detectSourceLanguage,
  translateField,
  twoStepTranslateField,
  openaiTranslate,
  sarvamTranslate,
  getTeluguSourceSet,
  getEnglishSourceSet,
  resolveAnchorLanguage,
  generateSummaryAndContent,
  toTrilingual,
  buildSourceArticleMultilingual
};
