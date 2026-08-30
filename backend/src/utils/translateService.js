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

// Google Gemini (Generative Language API). Model is configurable via GEMINI_MODEL.
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const getGeminiModel = () => process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry an async API call on rate limits (429), transient 5xx, and network
 * errors, using exponential backoff and honoring a Retry-After header.
 */
async function withRetry(fn, { retries = 4, baseDelayMs = 1500, label = 'API request' } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      // OpenAI SDK errors expose `status` directly; axios errors nest it under `response`.
      const status = err?.response?.status ?? err?.status;
      // A per-day quota (limit resets in hours) will not recover via short backoff,
      // so don't waste retries on it.
      const bodyStr = JSON.stringify(err?.response?.data || err?.error || '');
      const isPerDayQuota = status === 429 && /PerDay|limit:\s*0/.test(bodyStr);
      const isRetriable =
        !isPerDayQuota &&
        (status === 429 ||
          (typeof status === 'number' && status >= 500 && status < 600) ||
          ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN'].includes(err?.code));

      if (!isRetriable || attempt >= retries) throw err;

      const retryAfterSec = Number(err?.response?.headers?.['retry-after']);
      const delay =
        Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? retryAfterSec * 1000
          : baseDelayMs * 2 ** attempt;

      attempt += 1;
      console.warn(`[translate] ${label} failed (${status || err?.code}); retry ${attempt}/${retries} in ${delay}ms`);
      await sleep(delay);
    }
  }
}

/**
 * Taaja News editorial standards (Super Lead + Detailed Story).
 * Used for source-article generation and news-mode translation.
 */
const SOURCE_PLAGIARISM_TARGET = Math.min(
  100,
  Math.max(1, parseInt(process.env.SOURCE_PLAGIARISM_MAX, 10) || 10)
);
const SOURCE_PLAGIARISM_RETRIES = Math.min(
  5,
  Math.max(0, parseInt(process.env.SOURCE_PLAGIARISM_RETRIES, 10) || 2)
);

const NEWS_EDITORIAL_PERSONA =
  'You are a Senior Generalist Editor at a national news desk with 20+ years of experience. ' +
  'You read wire copies, agency feeds, and rival reports, extract verified facts, then publish an entirely original story in a natural human newsroom voice. ' +
  'You never file copy that mirrors source wording, sentence rhythm, or paragraph order.';

const NEWS_EDITORIAL_CORE_RULES = `
EDITORIAL STANDARDS (apply to every language output):
- The story has two parts: (1) "Super Lead" — brief lead summary; (2) "Detailed Story" — full report.
- Sub-headings are OPTIONAL. Add a sub-heading ONLY when the story is long and clearly covers multiple distinct points that benefit from separation. Short or single-topic stories must have NO sub-headings at all — write them as plain paragraphs only.
- Inverted Pyramid: most critical and latest facts first; least important details last.
- 5W-1H: cover Who, What, Where, When, Why, and How in both parts where relevant.
- Complete plagiarism-free rewrite: narrate a brand-new story from verified facts. Do NOT reuse source vocabulary, clause order, or paragraph flow. Target under 10% lexical overlap while keeping 100% factual accuracy.
- Use ACTIVE VOICE.
- Use only short, simple sentences. Do not use complex, compound, or compound-complex sentences.
- NEVER use the word "and" (or "మరియు" / "और" / "maruyu") anywhere in any language. Always use a comma (,) to separate items, ideas, or clauses.
- No honorifics, titles, or suffixes next to names of politicians, celebrities, or any individuals (e.g. NEVER use Garu, Sri, Mr., Mrs., श्री, श्रीमति, Honorable, or official titles like Minister). Use direct names only.
- Write all numbers as digits only (e.g. 30, 17, 5). Do NOT add the spelled-out word in brackets after a number, and do not repeat the number in words in any language.
- Do not invent facts, names, dates, places, or quotes not supported by the fact sheet.

CHARACTER & SPACE CONSTRAINTS:
- The Super Lead is strictly restricted to 500 characters. To keep within this limit in English, always use short forms: "CPS" (Contributory Pension Scheme), "Govt." (Government), "EHS" (Employees Health Scheme), "DA" (Dearness Allowance).

LANGUAGE & TRANSLATION SPECIFICS:
- Telugu: always refer to and compare animals/birds using the feminine gender (జంతువులు/పక్షులను ఆడ జాతిగా, స్త్రీలింగంలో సంబోధించాలి).
- Hindi: instead of the word "maruyu"/"और", always use a comma (,).
- Hindi specific spellings (use exactly):
  * Racha Konda → "राचाकोंडा" (never रचाकोंडा)
  * Kothagudem → "कोत्तागुडेम"
  * Jadcharla → "जडचर्ला" (never जर्चरला)
  * Bandi Sanjay → "Bandi Sanjay (बंडिि संजय)" (never बंदी संजय)

FORMATTING (STRICT — plain text only):
- Output PLAIN TEXT. NEVER use Markdown or any formatting symbols: no #, ##, ###, *, **, _, backticks, >, or bullet characters anywhere.
- For the Detailed Story, start a new paragraph every four to five sentences (depending on the need). Keep paragraphs readable — never write one long block of text.
- If (and only if) a sub-heading is genuinely needed, write it as a short plain-text line on its own, with ONE blank line before it and ONE blank line after it, and no symbol prefix. Do not force sub-headings onto short stories.
- Separate paragraphs with a single blank line. Do not use more than one blank line in a row.
- Do not use repeated punctuation such as ".." or "...". End sentences with a single period.
`.trim();

const NEWS_ORIGINALITY_RULES = `
ORIGINALITY & HUMAN VOICE (apply to every language output):
- Think like a senior desk editor on deadline: sharp, neutral, readable, unmistakably human.
- Core objective: the finished copy must score under ${SOURCE_PLAGIARISM_TARGET}% lexical and phrase overlap if compared to the original feed, while remaining fact-perfect.
- Zero literal matching: never copy phrases, clauses, or sentence structures. Replace vocabulary entirely with synonyms, strong verbs, and varied phrasing.
- Restructure the narrative: do NOT follow the source's paragraph-by-paragraph flow. Reorder facts, change the lead emphasis, weave background differently.
- Active voice and engaging tone: punchy, journalistic, never robotic or template-like.
- No AI clichés: avoid "In conclusion", "It is important to note", "Testament to", "Delve", "Landscape", "Tapestry", "In a significant development".
`.trim();

const ANTI_PLAGIARISM_RULES = `
ANTI-PLAGIARISM MANDATE (non-negotiable — lexical and phrase overlap with the source must stay under ${SOURCE_PLAGIARISM_TARGET}%):
- Write ONLY from the fact sheet provided. Treat the original source as already discarded.
- Forbidden: any copied phrase of 3+ consecutive words, mirroring sentence order, keeping the same paragraph sequence, or lightly editing the source.
- Required: a fresh headline angle, a new lead hook, reordered paragraphs, new verbs and collocations, varied sentence length, and a human editor's cadence.
- Quotes: keep speaker names and quote meaning exact, but express attribution in fresh words when the fact sheet allows.
- Facts, names, numbers, dates, and places must stay 100% accurate.
`.trim();

const FACT_EXTRACTION_SYSTEM_PROMPT =
  'You are a senior news desk fact checker. Read the source once and extract verified facts only. ' +
  'Do NOT copy sentences or phrases from the source. Use short neutral fact strings. ' +
  'Return ONLY valid JSON with keys: "who" (array), "what", "when", "where", "why", "how", "background" (array), ' +
  '"quotes" (array of {"speaker","text"}), "numbers" (array). No markdown.';

const buildNewsGenerationSystemPrompt = (strictRewrite = false) =>
  `${NEWS_EDITORIAL_PERSONA}
${NEWS_EDITORIAL_CORE_RULES}
${NEWS_ORIGINALITY_RULES}
${ANTI_PLAGIARISM_RULES}
${strictRewrite ? 'STRICT REWRITE PASS: your previous draft scored too high on plagiarism. Change the headline completely, reorder every paragraph, and replace all verbs and noun phrases. Target under 5% overlap.\n' : ''}
Return ONLY valid JSON with keys "title" (headline), "summary" (Super Lead), and "content" (Detailed Story). The values must be PLAIN TEXT (no markdown, no #, no *). No markdown code fences.`;

const buildNewsTranslationSystemPrompt = (targetLangName, fieldLabel) =>
  `${NEWS_EDITORIAL_PERSONA}
Translate/adapt the following ${fieldLabel} into ${targetLangName}, applying ALL rules below to the ${targetLangName} output.
${NEWS_EDITORIAL_CORE_RULES}
Preserve the inverted-pyramid structure and factual meaning. Keep the same paragraph and sub-heading structure as the source: if the source has sub-headings, keep them as plain-text lines on their own with a blank line before and after; if it has none, do NOT add any.
Return ONLY the translated text in ${targetLangName} as PLAIN TEXT, nothing else.`;

/**
 * Strip Markdown / stray formatting from AI-generated news text and normalize
 * spacing. Sub-headings are kept on their own line with a blank line before and
 * after so the body reads cleanly without "###", "**", or "..".
 */
function cleanNewsText(input) {
  let text = String(input || '');
  if (!text.trim()) return '';

  // Normalize line endings, drop code fences.
  text = text.replace(/\r\n?/g, '\n');
  text = text.replace(/```[a-zA-Z0-9]*\n?/g, '').replace(/```/g, '');

  const lines = text.split('\n');
  const out = [];

  for (const rawLine of lines) {
    let line = rawLine.trim();

    // Heading line: leading #'s (and optional trailing #'s). Keep the text only.
    let isHeading = false;
    const headingMatch = line.match(/^#{1,6}\s*(.+?)\s*#*$/);
    if (headingMatch) {
      line = headingMatch[1].trim();
      isHeading = true;
    }

    // Remove paired emphasis/code markers, keeping the inner text.
    line = line
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`([^`]*)`/g, '$1');

    // Remove markdown bullet / blockquote prefixes.
    line = line.replace(/^\s*(?:[-•>]|\*)\s+/, '');

    // Strip any leftover stray markdown symbols.
    line = line.replace(/[*`#]+/g, '');

    // Collapse repeated dots and excess inline whitespace.
    line = line.replace(/\.{2,}/g, '.').replace(/[ \t]{2,}/g, ' ').trim();

    if (isHeading && line) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      out.push(line);
      out.push('');
    } else {
      out.push(line);
    }
  }

  // Collapse 3+ newlines down to a single blank line.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

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
 * Low-level OpenAI call. Sends a system + user message and returns the text output.
 * Set `json: true` to request a JSON response.
 */
async function openaiGenerateText(systemContent, userContent, { temperature = 0.3, json = false, maxTokens } = {}) {
  const request = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent }
    ],
    temperature
  };
  if (json) request.response_format = { type: 'json_object' };
  if (maxTokens) request.max_tokens = maxTokens;

  const completion = await withRetry(() => getOpenAI().chat.completions.create(request), {
    label: 'OpenAI gpt-4o-mini'
  });

  return completion.choices[0]?.message?.content?.trim() || '';
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

  return openaiGenerateText(systemContent, userContent, { temperature: 0.3 });
}

/**
 * Low-level Gemini call. Sends a system instruction + user prompt and returns
 * the model's text output. Set `json: true` to request a JSON response.
 */
async function geminiGenerateText(
  systemContent,
  userContent,
  { temperature = 0.3, json = false, maxOutputTokens } = {}
) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const generationConfig = { temperature };
  if (json) generationConfig.responseMimeType = 'application/json';
  if (maxOutputTokens) generationConfig.maxOutputTokens = maxOutputTokens;

  const model = getGeminiModel();
  let data;
  try {
    ({ data } = await withRetry(
      () =>
        axios.post(
          `${GEMINI_API_URL}/${encodeURIComponent(model)}:generateContent`,
          {
            systemInstruction: { parts: [{ text: systemContent }] },
            contents: [{ role: 'user', parts: [{ text: userContent }] }],
            generationConfig
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': process.env.GEMINI_API_KEY
            },
            timeout: 60000
          }
        ),
      { label: `Gemini ${model}` }
    ));
  } catch (err) {
    // Surface the real Gemini reason (e.g. quota exhausted) instead of a generic
    // "Request failed with status code 429".
    const apiMsg = err?.response?.data?.error?.message;
    if (apiMsg) {
      throw new Error(`Gemini API error (${err.response.status}, model ${model}): ${apiMsg}`);
    }
    throw err;
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p?.text || '').join('').trim();
}

/** Active translation/generation provider from TRANSLATE_TYPE (openai | sarvam | gemini | anthropic). */
const getTranslateProvider = () => (process.env.TRANSLATE_TYPE || '').trim().toLowerCase();

/** True when the active translation/generation provider is Gemini. */
const isGeminiProvider = () => getTranslateProvider() === 'gemini';

/**
 * Translate/adapt text with Google Gemini, applying the same news editorial
 * prompts as the OpenAI path so all rules carry over.
 *
 * @param {string} text
 * @param {string} targetLangName - e.g. "Telugu", "English", "Hindi"
 * @param {{ mode?: 'plain'|'news', fieldType?: 'title'|'summary'|'content' }} [options]
 */
async function geminiTranslate(text, targetLangName, options = {}) {
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

  return geminiGenerateText(systemContent, userContent, { temperature: 0.3 });
}

/**
 * @param {{ mode?: 'plain'|'news', fieldType?: 'title'|'summary'|'content' }} [options]
 */
async function translateField(text, sourceLang, targetLang, options = {}) {
  if (!text || !String(text).trim()) return '';
  if (sourceLang === targetLang) return String(text).trim();

  const translateType = (process.env.TRANSLATE_TYPE || '').toLowerCase();

  if (translateType === 'sarvam') {
    return sarvamTranslate(text, sourceLang, targetLang);
  }
  if (translateType === 'gemini') {
    return geminiTranslate(text, SUPPORTED_LANGUAGES[targetLang], options);
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

/** Headline (stored in Article.title) */
const getHeadlineLimits = () => {
  const maxChars = Math.max(40, parseInt(process.env.SOURCE_TITLE_MAX_CHARS, 10) || 200);
  return { maxChars };
};

const cleanHeadline = (text) =>
  cleanNewsText(text)
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

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
  const str = String(text || '').trim();
  if (!str) return '';

  const words = str.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return str; // keep paragraph/heading line breaks

  // Walk the original string so newlines and spacing are preserved on truncation.
  const wordRe = /\S+\s*/g;
  let count = 0;
  let end = str.length;
  let match;
  while ((match = wordRe.exec(str)) !== null) {
    count++;
    if (count === maxWords) {
      end = wordRe.lastIndex;
      break;
    }
  }
  return str.slice(0, end).trim();
};

const parseJsonObject = (raw) => {
  const stripped = String(raw || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(stripped);
};

/**
 * Pass 1 — pull neutral facts out of the scraped source without keeping its wording.
 * The writer pass never sees the raw source, which keeps lexical overlap low.
 */
async function extractSourceFacts(rawText) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) {
    throw new Error('Cannot extract facts from empty source text');
  }

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: FACT_EXTRACTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content:
          'Extract verified facts only. Do not copy any sentence from the source.\n\n' +
          trimmed.slice(0, 12000)
      }
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' }
  });

  const responseText = completion.choices[0]?.message?.content?.trim();
  if (!responseText) {
    throw new Error('OpenAI returned empty fact extraction response');
  }

  try {
    return parseJsonObject(responseText);
  } catch {
    throw new Error('Failed to parse fact extraction JSON from OpenAI');
  }
}

const buildGenerationUserPrompt = ({
  languageName,
  headline,
  superLead,
  detailed,
  sourceTitle,
  factSheet,
  strictRewrite
}) => {
  const sourceTitleNote = sourceTitle
    ? `\nOriginal feed headline (context only — never copy or lightly rephrase): "${sourceTitle}"\n`
    : '';

  const strictNote = strictRewrite
    ? '\nSTRICT REWRITE: the prior draft was too close to the source. Use a completely different headline, lead, and paragraph order. Replace every shared phrase.\n'
    : '';

  return (
    `You are the Senior Generalist Editor. Write a fresh ${languageName} news story using ONLY the fact sheet below — not the original feed wording.\n\n` +
    `Plagiarism target: under ${SOURCE_PLAGIARISM_TARGET}% lexical and phrase overlap with any source.\n\n` +
    `Return ONLY JSON with:\n` +
    `1) "title" — HEADLINE: complete, compelling, fresh angle; single line; max ${headline.maxChars} characters.\n` +
    `2) "summary" — SUPER LEAD: ${superLead.minWords}-${superLead.maxWords} words OR ${superLead.minSentences}-${superLead.maxSentences} short sentences; inverted pyramid; 5W-1H.\n` +
    `3) "content" — DETAILED STORY: ${detailed.minWords}-${detailed.maxWords} words; background where needed; new paragraph every 4-5 sentences; sub-headings only if truly needed.\n\n` +
    `Write like a human editor. Vary sentence length. Do not mirror the fact-sheet bullet order paragraph by paragraph.\n` +
    `${strictNote}` +
    `${sourceTitleNote}\n` +
    `Fact sheet (your ONLY source of truth):\n${JSON.stringify(factSheet, null, 2)}\n\n` +
    'Return ONLY: {"title":"...","summary":"...","content":"..."}'
  );
};

/**
 * OpenAI: rewrite source into headline + Super Lead + Detailed Story in anchor language.
 * Sarvam cannot summarize; this step always uses OpenAI.
 *
 * @param {string} rawText - full source article body
 * @param {string} anchorLang - te | en | hi
 * @param {{ sourceTitle?: string, strictRewrite?: boolean }} [options]
 */
async function generateSummaryAndContent(rawText, anchorLang, options = {}) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) {
    throw new Error('Cannot generate summary/content from empty source text');
  }
  if (!ALL_LANG_CODES.includes(anchorLang)) {
    throw new Error(`Unsupported anchor language: ${anchorLang}`);
  }

  const superLead = getSuperLeadLimits();
  const detailed = getDetailedStoryLimits();
  const headline = getHeadlineLimits();
  const languageName = SUPPORTED_LANGUAGES[anchorLang];
  const sourceTitle = String(options.sourceTitle || '').trim();
  const strictRewrite = Boolean(options.strictRewrite);

  const factSheet = await extractSourceFacts(trimmed);

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildNewsGenerationSystemPrompt(strictRewrite) },
      {
        role: 'user',
        content: buildGenerationUserPrompt({
          languageName,
          headline,
          superLead,
          detailed,
          sourceTitle,
          factSheet,
          strictRewrite
        })
      }
    ],
    temperature: strictRewrite ? 0.62 : 0.52,
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

  let title = cleanHeadline(parsed.title);
  let summary = cleanNewsText(parsed.summary);
  let content = cleanNewsText(parsed.content);

  if (!title) {
    // Fallback: derive a headline from the Super Lead rather than reuse the scraped title.
    title = cleanHeadline(truncateAtSentence(summary, headline.maxChars));
  }
  if (title.length > headline.maxChars) {
    title = truncateAtSentence(title, headline.maxChars);
  }

  if (!summary) throw new Error('Generated Super Lead (summary) is empty');
  if (!content) throw new Error('Generated Detailed Story (content) is empty');

  content = cleanNewsText(truncateToWordCount(content, detailed.maxWords));

  return { title, summary, content };
}

/** Convert a free-form tag into a lowercase, hyphenated slug (e.g. "HITEC City" → "hitec-city"). */
const slugifyTag = (raw) =>
  String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // keep letters/numbers (any script), spaces, hyphens
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Generate 4–5 concise topic tags (lowercase slugs) from article text using OpenAI.
 * Tags cover key people, places, organizations, and topics. Returns [] on failure
 * so tag generation never blocks article creation.
 */
async function generateTags(text, { min = 4, max = 5 } = {}) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a news SEO editor. Extract concise topic tags from an article: key people, places, organizations, and themes. ' +
            'Tags must be in lowercase English, 1 to 3 words each. ' +
            'Return ONLY valid JSON: {"tags": ["tag one", "tag two", ...]}. No markdown.'
        },
        {
          role: 'user',
          content:
            `Generate ${min} to ${max} relevant tags for the following article. ` +
            `Return ONLY {"tags": [...]}.\n\n${trimmed}`
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) return [];

    let parsed;
    try {
      parsed = parseJsonObject(responseText);
    } catch {
      return [];
    }

    const rawTags = Array.isArray(parsed?.tags) ? parsed.tags : [];
    const seen = new Set();
    const tags = [];
    for (const raw of rawTags) {
      const slug = slugifyTag(raw);
      if (slug && !seen.has(slug)) {
        seen.add(slug);
        tags.push(slug);
      }
      if (tags.length >= max) break;
    }
    return tags;
  } catch (err) {
    console.error('[translate] Tag generation failed:', err.message);
    return [];
  }
}

/**
 * Expand text to te/en/hi without re-translating the anchor language.
 * @param {'title'|'summary'|'content'} [fieldType]
 */
async function toTrilingual(text, anchorLang, fieldType = 'content') {
  // Titles are single-line; keep them clean but without forced heading spacing.
  const isTitle = fieldType === 'title';
  const clean = (value) => {
    const cleaned = cleanNewsText(value);
    return isTitle ? cleaned.replace(/\s*\n\s*/g, ' ').trim() : cleaned;
  };

  const trimmed = clean(text);
  const result = { te: '', en: '', hi: '' };
  if (!trimmed) return result;

  if (!ALL_LANG_CODES.includes(anchorLang)) {
    throw new Error(`Unsupported anchor language: ${anchorLang}`);
  }

  result[anchorLang] = trimmed;

  const others = ALL_LANG_CODES.filter((lang) => lang !== anchorLang);
  const translateOptions = { mode: 'news', fieldType };

  // Sequential (not parallel) to avoid bursting provider rate limits (e.g. Gemini 429).
  for (const lang of others) {
    result[lang] = clean(await translateField(trimmed, anchorLang, lang, translateOptions));
  }

  return result;
}

/**
 * Build title, summary, and content maps for source-article → Article conversion.
 * Title is AI-generated from content (not the scraped RSS headline).
 *
 * @param {{ title?: string, contentText: string, source?: string }} input
 * @param {{ checkPlagiarism?: (original: string, rewritten: string) => Promise<number|null> }} [options]
 */
async function buildSourceArticleMultilingual(input, options = {}) {
  const { title, contentText, source } = input;
  const titleTrimmed = String(title || '').trim();
  const contentTrimmed = String(contentText || '').trim();

  if (!contentTrimmed) throw new Error('Source article has no contentText');

  const anchorLang = resolveAnchorLanguage(source, contentTrimmed);
  const checkPlagiarism = typeof options.checkPlagiarism === 'function'
    ? options.checkPlagiarism
    : null;

  let bestDraft = null;
  let bestScore = 101;
  const maxAttempts = checkPlagiarism ? SOURCE_PLAGIARISM_RETRIES + 1 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const strictRewrite = attempt > 0;
    const draft = await generateSummaryAndContent(contentTrimmed, anchorLang, {
      sourceTitle: titleTrimmed,
      strictRewrite
    });

    if (!checkPlagiarism) {
      bestDraft = draft;
      break;
    }

    const score = await checkPlagiarism(contentTrimmed, draft.content);
    const normalizedScore = score == null ? 101 : score;

    if (normalizedScore < bestScore) {
      bestScore = normalizedScore;
      bestDraft = draft;
    }

    console.log(
      `[source-translate] plagiarism=${normalizedScore}% attempt=${attempt + 1}/${maxAttempts} ` +
      `source=${String(source || 'unknown')} lang=${anchorLang}`
    );

    if (normalizedScore <= SOURCE_PLAGIARISM_TARGET) break;
  }

  if (!bestDraft) {
    throw new Error('Failed to generate rewritten source article');
  }

  const { title: anchorTitle, summary, content } = bestDraft;

  // Sequential to keep provider request bursts low (avoids 429 rate limits).
  const titleMap = await toTrilingual(anchorTitle, anchorLang, 'title');
  const summaryMap = await toTrilingual(summary, anchorLang, 'summary');
  const contentMap = await toTrilingual(content, anchorLang, 'content');

  // Generate tags from English text when available (slugs read best in English),
  // falling back to the anchor-language headline + story.
  const tagSourceText = [
    titleMap.en || titleMap[anchorLang],
    contentMap.en || contentMap[anchorLang]
  ]
    .filter(Boolean)
    .join('\n\n');
  const tags = await generateTags(tagSourceText);

  return {
    title: titleMap,
    summary: summaryMap,
    content: contentMap,
    tags,
    anchorLang,
    plagiarismScore: bestScore <= 100 ? bestScore : null
  };
}

module.exports = {
  SUPPORTED_LANGUAGES,
  ALL_LANG_CODES,
  chunkText,
  cleanNewsText,
  detectSourceLanguage,
  translateField,
  twoStepTranslateField,
  openaiTranslate,
  openaiGenerateText,
  sarvamTranslate,
  geminiTranslate,
  geminiGenerateText,
  getTranslateProvider,
  getTeluguSourceSet,
  getEnglishSourceSet,
  resolveAnchorLanguage,
  generateSummaryAndContent,
  generateTags,
  slugifyTag,
  toTrilingual,
  buildSourceArticleMultilingual,
  SOURCE_PLAGIARISM_TARGET,
  SOURCE_PLAGIARISM_RETRIES,
  extractSourceFacts,
  NEWS_EDITORIAL_CORE_RULES,
  buildNewsGenerationSystemPrompt,
  buildNewsTranslationSystemPrompt
};
