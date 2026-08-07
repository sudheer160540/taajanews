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
      const status = err?.response?.status;
      // A per-day quota (limit resets in hours) will not recover via short backoff,
      // so don't waste retries on it.
      const bodyStr = JSON.stringify(err?.response?.data || '');
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
const NEWS_EDITORIAL_PERSONA =
  'You are a highly creative, professional, elite Short-News Journalist for the TAAJA News App. ' +
  'You transform raw news data, scraped feeds, or breaking items into professional short news stories. ' +
  'You write with a neutral, journalistic, professional tone, completely avoiding sensationalism while keeping the content highly engaging.';

const NEWS_EDITORIAL_CORE_RULES = `
EDITORIAL STANDARDS (apply to every language output):
- The story has two parts: (1) "Super Lead" — brief lead summary; (2) "Detailed Story" — full report.
- Sub-headings are OPTIONAL. Add a sub-heading ONLY when the story is long and clearly covers multiple distinct points that benefit from separation. Short or single-topic stories must have NO sub-headings at all — write them as plain paragraphs only.
- Inverted Pyramid: most critical and latest facts first; least important details last.
- 5W-1H: cover Who, What, Where, When, Why, and How in both parts where relevant.
- Complete plagiarism-free rewrite: read the source fully, then narrate a brand-new story. Do NOT reuse the source's sentence structure or vocabulary. Ensure zero lexical overlap while keeping 100% factual accuracy. No copy-pasting of sentences.
- Use ACTIVE VOICE.
- Use only short, simple sentences. Do not use complex, compound, or compound-complex sentences.
- NEVER use the word "and" (or "మరియు" / "और" / "maruyu") anywhere in any language. Always use a comma (,) to separate items, ideas, or clauses.
- No honorifics, titles, or suffixes next to names of politicians, celebrities, or any individuals (e.g. NEVER use Garu, Sri, Mr., Mrs., श्री, श्रीमति, Honorable, or official titles like Minister). Use direct names only.
- Write all numbers as digits only (e.g. 30, 17, 5). Do NOT add the spelled-out word in brackets after a number, and do not repeat the number in words in any language.
- Do not invent facts, names, dates, places, or quotes not supported by the source.

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
- You are also an expert investigative journalist and master wordsmith. Completely transform the source into an original, freshly written story.
- Core objective: rewrite so thoroughly that it reads as 0% plagiarism, feels entirely human-written, and bypasses AI-content detectors.
- Zero literal matching: never copy phrases, clauses, or sentence structures from the source. Replace the vocabulary entirely with synonyms, dynamic verbs, and varied phrasing.
- Restructure the narrative: do NOT follow the source's paragraph-by-paragraph flow. Reorder how facts are presented (weave in background differently, shift the emphasis of the lead) while keeping all core facts, dates, names, and quotes 100% accurate.
- Active voice and engaging tone: write primarily in active voice. Keep it punchy, journalistic, and engaging for a blog audience. Avoid robotic, formulaic, or repetitive sentence patterns.
- No AI clichés: strictly avoid overused AI filler words and transitions such as "In conclusion", "It is important to note", "Testament to", "Delve", "Landscape", "Tapestry".
`.trim();

const buildNewsGenerationSystemPrompt = () =>
  `${NEWS_EDITORIAL_PERSONA}
${NEWS_EDITORIAL_CORE_RULES}
${NEWS_ORIGINALITY_RULES}
Return ONLY valid JSON with keys "summary" (Super Lead) and "content" (Detailed Story). The values must be PLAIN TEXT (no markdown, no #, no *). No markdown code fences.`;

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
 * Low-level Gemini call. Sends a system instruction + user prompt and returns
 * the model's text output. Set `json: true` to request a JSON response.
 */
async function geminiGenerateText(systemContent, userContent, { temperature = 0.3, json = false } = {}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const generationConfig = { temperature };
  if (json) generationConfig.responseMimeType = 'application/json';

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

/** True when the active translation/generation provider is Gemini. */
const isGeminiProvider = () => (process.env.TRANSLATE_TYPE || '').toLowerCase() === 'gemini';

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
          `   - Engaging, not overly terse. Write without plagiarism (fresh wording, do not copy source phrases).\n` +
          `   - Start a new paragraph every four to five sentences (depending on the need); never write one long block.\n` +
          `   - Add a sub-heading (a short plain-text label on its own line) ONLY if the story is long and covers multiple distinct points; for short or single-topic stories use plain paragraphs with NO sub-headings.\n` +
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

  let summary = cleanNewsText(parsed.summary);
  let content = cleanNewsText(parsed.content);

  if (!summary) throw new Error('Generated Super Lead (summary) is empty');
  if (!content) throw new Error('Generated Detailed Story (content) is empty');

  content = cleanNewsText(truncateToWordCount(content, detailed.maxWords));

  return { summary, content };
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
 */
async function buildSourceArticleMultilingual({ title, contentText, source }) {
  const titleTrimmed = String(title || '').trim();
  const contentTrimmed = String(contentText || '').trim();

  if (!titleTrimmed) throw new Error('Source article has no title');
  if (!contentTrimmed) throw new Error('Source article has no contentText');

  const anchorLang = resolveAnchorLanguage(source, contentTrimmed);
  const { summary, content } = await generateSummaryAndContent(contentTrimmed, anchorLang);

  // Sequential to keep provider request bursts low (avoids 429 rate limits).
  const titleMap = await toTrilingual(titleTrimmed, anchorLang, 'title');
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

  return { title: titleMap, summary: summaryMap, content: contentMap, tags, anchorLang };
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
  sarvamTranslate,
  geminiTranslate,
  getTeluguSourceSet,
  getEnglishSourceSet,
  resolveAnchorLanguage,
  generateSummaryAndContent,
  generateTags,
  slugifyTag,
  toTrilingual,
  buildSourceArticleMultilingual,
  NEWS_EDITORIAL_CORE_RULES,
  buildNewsGenerationSystemPrompt,
  buildNewsTranslationSystemPrompt
};
