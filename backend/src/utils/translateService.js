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

/**
 * Taaja News editorial standards (Super Lead + Detailed Story).
 * Used for source-article generation and news-mode translation.
 */
const NEWS_EDITORIAL_CORE_RULES = `
EDITORIAL STANDARDS (apply to every language output):
- The story has two parts: (1) "Super Lead" — brief lead summary; (2) "Detailed Story" — full report with sub-headings.
- Inverted Pyramid: most critical and latest facts first; least important details last.
- 5W-1H: cover Who, What, Where, When, Why, and How in both parts where relevant.
- Honorifics/titles/suffixes are forbidden (e.g. Garu, Sri/Mr/श्री, Smt/Mrs/श्रीमति).
- Do not use the word "and" or its equivalents (Telugu మరియు, Hindi और); use a comma (,) instead.
- When a single digit appears, follow it with the written word in brackets (e.g. 5 (five), 9 (nine)).
- Use only short, simple sentences. Do not use complex, compound, or compound-complex sentences.
- Read the source first, then rewrite in fresh vocabulary and new sentence structures — zero plagiarism; do not copy phrases from the source.
- Do not invent facts, names, dates, places, or quotes not supported by the source.
`.trim();

const buildNewsGenerationSystemPrompt = () =>
  `You are a senior news editor for Taaja News. You rewrite scraped articles into publish-ready copy.
${NEWS_EDITORIAL_CORE_RULES}
Return ONLY valid JSON with keys "summary" (Super Lead) and "content" (Detailed Story). No markdown code fences.`;

const buildNewsTranslationSystemPrompt = (targetLangName, fieldLabel) =>
  `You are a professional news translator for Taaja News. Translate the following ${fieldLabel} into ${targetLangName}.
${NEWS_EDITORIAL_CORE_RULES}
Preserve the inverted-pyramid structure, sub-headings in the Detailed Story (use plain lines ending with a colon or short ALL-CAPS labels), and factual meaning.
Return ONLY the translated text in ${targetLangName}, nothing else.`;

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

/**
 * @param {string} text
 * @param {string} targetLangName - e.g. "Telugu", "English", "Hindi"
 * @param {{ mode?: 'plain'|'news', fieldType?: 'title'|'summary'|'content' }} [options]
 */
async function openaiTranslate(text, targetLangName, options = {}) {
  if (!text || !text.trim()) return '';

  const mode = options.mode || 'plain';
  const fieldType = options.fieldType || 'content';
  const fieldLabels = {
    title: 'headline',
    summary: 'Super Lead section',
    content: 'Detailed Story section'
  };
  const fieldLabel = fieldLabels[fieldType] || 'text';

  const systemContent =
    mode === 'news'
      ? buildNewsTranslationSystemPrompt(targetLangName, fieldLabel)
      : 'You are a professional translator. Translate the given text accurately while preserving meaning, tone, and formatting. Return ONLY the translated text, nothing else.';

  const userContent =
    mode === 'news'
      ? `Translate this ${fieldLabel} to ${targetLangName}:\n\n${text}`
      : `Translate the following text to ${targetLangName}:\n\n${text}`;

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent }
    ],
    temperature: 0.3
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}

/**
 * @param {{ mode?: 'plain'|'news', fieldType?: 'title'|'summary'|'content' }} [options]
 */
async function translateField(text, sourceLang, targetLang, options = {}) {
  if (!text || !String(text).trim()) return '';
  if (sourceLang === targetLang) return String(text).trim();

  const useSarvam = process.env.TRANSLATE_TYPE === 'sarvam';

  if (useSarvam) {
    return sarvamTranslate(text, sourceLang, targetLang);
  }
  return openaiTranslate(text, SUPPORTED_LANGUAGES[targetLang], options);
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

/** Super Lead (stored in Article.summary) — words or sentence band */
const getSuperLeadLimits = () => {
  const minWords = Math.max(1, parseInt(process.env.SOURCE_SUPER_LEAD_MIN_WORDS, 10) || 500);
  const maxWords = Math.max(minWords, parseInt(process.env.SOURCE_SUPER_LEAD_MAX_WORDS, 10) || 600);
  const minSentences = Math.max(1, parseInt(process.env.SOURCE_SUPER_LEAD_MIN_SENTENCES, 10) || 5);
  const maxSentences = Math.max(minSentences, parseInt(process.env.SOURCE_SUPER_LEAD_MAX_SENTENCES, 10) || 8);
  return { minWords, maxWords, minSentences, maxSentences };
};

/** Detailed Story (stored in Article.content) */
const getDetailedStoryLimits = () => {
  const minWords = Math.max(1, parseInt(process.env.SOURCE_CONTENT_MIN_WORDS, 10) || 500);
  const maxWords = Math.max(minWords, parseInt(process.env.SOURCE_CONTENT_MAX_WORDS, 10) || 1200);
  return { minWords, maxWords };
};

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
 * OpenAI: rewrite source into Super Lead + Detailed Story in anchor language.
 * Sarvam cannot summarize; this step always uses OpenAI.
 */
async function generateSummaryAndContent(rawText, anchorLang) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) {
    throw new Error('Cannot generate summary/content from empty source text');
  }
  if (!ALL_LANG_CODES.includes(anchorLang)) {
    throw new Error(`Unsupported anchor language: ${anchorLang}`);
  }

  const superLead = getSuperLeadLimits();
  const detailed = getDetailedStoryLimits();
  const languageName = SUPPORTED_LANGUAGES[anchorLang];

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildNewsGenerationSystemPrompt() },
      {
        role: 'user',
        content:
          `Read the source article below, summarize it mentally, then rewrite it in ${languageName} as two JSON fields.\n\n` +
          `1) "summary" — SUPER LEAD:\n` +
          `   - Either ${superLead.minWords} to ${superLead.maxWords} words OR ${superLead.minSentences} to ${superLead.maxSentences} short sentences (choose whichever fits the story better).\n` +
          `   - Brief summary of the main news; inverted pyramid; full 5W-1H where possible.\n\n` +
          `2) "content" — DETAILED STORY:\n` +
          `   - ${detailed.minWords} to ${detailed.maxWords} words.\n` +
          `   - Same 5W-1H and inverted pyramid; include background/context so readers understand linked past events.\n` +
          `   - Engaging, not overly terse; include sub-headings (short labels on their own line) to improve readability.\n` +
          `   - When one event follows another, briefly explain prior context.\n\n` +
          `Return ONLY: {"summary":"...","content":"..."}\n\n` +
          `Source article:\n\n${trimmed}`
      }
    ],
    temperature: 0.35,
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

  if (!summary) throw new Error('Generated Super Lead (summary) is empty');
  if (!content) throw new Error('Generated Detailed Story (content) is empty');

  content = truncateToWordCount(content, detailed.maxWords);

  return { summary, content };
}

/**
 * Expand text to te/en/hi without re-translating the anchor language.
 * @param {'title'|'summary'|'content'} [fieldType]
 */
async function toTrilingual(text, anchorLang, fieldType = 'content') {
  const trimmed = String(text || '').trim();
  const result = { te: '', en: '', hi: '' };
  if (!trimmed) return result;

  if (!ALL_LANG_CODES.includes(anchorLang)) {
    throw new Error(`Unsupported anchor language: ${anchorLang}`);
  }

  result[anchorLang] = trimmed;

  const others = ALL_LANG_CODES.filter((lang) => lang !== anchorLang);
  const translateOptions = { mode: 'news', fieldType };
  const pairs = await Promise.all(
    others.map(async (lang) => [
      lang,
      await translateField(trimmed, anchorLang, lang, translateOptions)
    ])
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
    toTrilingual(titleTrimmed, anchorLang, 'title'),
    toTrilingual(summary, anchorLang, 'summary'),
    toTrilingual(content, anchorLang, 'content')
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
  buildSourceArticleMultilingual,
  NEWS_EDITORIAL_CORE_RULES,
  buildNewsGenerationSystemPrompt,
  buildNewsTranslationSystemPrompt
};
