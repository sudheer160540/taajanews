const Anthropic = require('@anthropic-ai/sdk');
const {
  geminiGenerateText,
  openaiGenerateText,
  getTranslateProvider,
  cleanNewsText,
  slugifyTag
} = require('./translateService');

const TITLE_LIMIT = 200;
const SUPERLEAD_LIMIT = 500;
const CONTENT_LIMIT = 10000;

const FIELD_LIMITS = {
  title: TITLE_LIMIT,
  summary: SUPERLEAD_LIMIT,
  content: CONTENT_LIMIT
};

const FIELD_NAMES = ['title', 'summary', 'content'];
const ALL_LANGS = ['te', 'hi', 'en'];

const MIN_TAGS = 4;
const MAX_TAGS = 5;

const LANGUAGE_NAMES = {
  te: 'Telugu',
  hi: 'Hindi',
  en: 'English'
};

const FIELD_LABELS = {
  title: 'news headline',
  summary: 'short summary (superlead)',
  content: 'full news article'
};

let anthropicClient = null;

const getAnthropic = () => {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
};

async function anthropicGenerateText(systemContent, userContent, { temperature = 0.4, maxTokens = 8192 } = {}) {
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

  const message = await getAnthropic().messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemContent,
    messages: [{ role: 'user', content: userContent }]
  });

  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/**
 * Pick the AI engine from TRANSLATE_TYPE. Sarvam is translation-only and cannot
 * rewrite or summarize, so it falls back to OpenAI here; audio (TTS) always uses
 * Sarvam via the /api/translate/audio route. An unset value keeps the previous
 * Anthropic default.
 */
const createGenerator = () => {
  const configured = getTranslateProvider();

  if (configured === 'gemini') {
    return {
      provider: 'gemini',
      generate: (system, user, options = {}) =>
        geminiGenerateText(system, user, {
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
          json: options.json
        })
    };
  }

  if (configured === 'openai' || configured === 'sarvam') {
    return {
      provider: 'openai',
      generate: (system, user, options = {}) => openaiGenerateText(system, user, options)
    };
  }

  return {
    provider: 'anthropic',
    generate: (system, user, options = {}) => anthropicGenerateText(system, user, options)
  };
};

const clamp = (value, limit) => {
  const trimmed = String(value || '').trim();
  return trimmed.length > limit ? trimmed.slice(0, limit).trim() : trimmed;
};

/**
 * Normalize a single translated field: drop markdown, stray section labels, and
 * wrapping quotes, then clamp to the field's character limit.
 */
const cleanField = (value, fieldType) => {
  let text = cleanNewsText(value);
  text = text.replace(/^\s*(HEADING|SUPERLEAD|FULLNEWS|TITLE|SUMMARY|CONTENT)\s*:\s*/i, '');
  text = text.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  if (fieldType === 'title') text = text.replace(/\s*\n\s*/g, ' ').trim();
  return clamp(text, FIELD_LIMITS[fieldType] || CONTENT_LIMIT);
};

const parseSectionBlock = (block) => {
  const headingMatch = block.match(/HEADING:\s*([\s\S]*?)(?=\nSUPERLEAD:|$)/i);
  const superleadMatch = block.match(/SUPERLEAD:\s*([\s\S]*?)(?=\nFULLNEWS:|$)/i);
  const fullnewsMatch = block.match(/FULLNEWS:\s*\n?([\s\S]*?)$/i);

  return {
    title: cleanField(headingMatch?.[1], 'title'),
    summary: cleanField(superleadMatch?.[1], 'summary'),
    content: cleanField(fullnewsMatch?.[1], 'content')
  };
};

const emptyResult = () => ({
  title: { te: '', hi: '', en: '' },
  summary: { te: '', hi: '', en: '' },
  content: { te: '', hi: '', en: '' }
});

// ── Prompts ──────────────────────────────────────────────────────────────

/**
 * Faithful translation of ONE field. The headline rule is explicit because the
 * previous creative-rewrite prompt produced a different headline per language.
 */
const buildTranslateSystemPrompt = (fieldType, sourceName, targetName) => {
  const label = FIELD_LABELS[fieldType];
  const limit = FIELD_LIMITS[fieldType];

  const fieldRule =
    fieldType === 'title'
      ? `- This is a headline. The ${targetName} headline MUST carry the SAME message as the ${sourceName} headline. Never replace it with a different, new, or more creative headline.`
      : fieldType === 'summary'
        ? '- Keep it a single short summary paragraph, same facts and same emphasis as the source.'
        : '- Keep the same paragraph breaks, the same order of information, and the same level of detail as the source.';

  return `You are a professional news translator for a newspaper. Translate the given ${label} from ${sourceName} into ${targetName}.

TRANSLATION RULES:
- Translate faithfully. Keep exactly the same meaning, facts, names, numbers, dates, figures, and quotes.
- Do NOT add information, do NOT remove information, do NOT invent details, do NOT add your own commentary.
${fieldRule}
- Write natural, fluent ${targetName} news language. Do not translate word for word.
- Keep proper nouns (people, places, organizations) in the form normally used in ${targetName} news.
- Keep the translation within ${limit} characters.
- Output PLAIN TEXT only: no markdown, no #, no *, no section labels, no surrounding quotes, no notes or explanations.

Return ONLY the translated ${targetName} text and nothing else.`;
};

const PERSONA =
  'You are an expert investigative journalist and master wordsmith writing for a newspaper.';

/** Creative rewrite of raw source text into headline + superlead + full story. */
const buildGenerateSystemPrompt = (languageName) => `${PERSONA} Turn the raw article the user provides into a finished news piece written in ${languageName}. Produce three parts:
- HEADING: a concise, compelling news headline. Must stay below ${TITLE_LIMIT} characters.
- SUPERLEAD: a short summary of the story. Must stay below ${SUPERLEAD_LIMIT} characters.
- FULLNEWS: the full paraphrased article in a journalistic tone matching ${languageName} news writing conventions. Must stay below ${CONTENT_LIMIT} characters.

ORIGINALITY & HUMAN VOICE:
- Core objective: rewrite so thoroughly that it reads as 0% plagiarism, feels entirely human-written, and bypasses AI-content detectors.
- Zero literal matching: do NOT copy phrases, clauses, or sentence structures from the source. Change the vocabulary entirely using synonyms, dynamic verbs, and varied phrasing.
- Restructure the narrative: do NOT follow the source's paragraph-by-paragraph flow. Reorder how facts are presented while keeping the core facts, dates, names, and quotes 100% accurate.
- Active voice and engaging tone: write primarily in active voice. Keep it punchy and journalistic. Avoid robotic, formulaic, or repetitive sentence patterns.
- No AI clichés: strictly avoid overused filler such as "In conclusion", "It is important to note", "Testament to", "Delve", "Landscape", "Tapestry".
- Do not invent facts, names, dates, places, or quotes that the source does not support.

Write all three parts in ${languageName} only. Return exactly this format and nothing else — no preamble, no notes, no markdown:

HEADING: <headline>
SUPERLEAD: <summary>
FULLNEWS:
<full article>`;

// ── Core operations ──────────────────────────────────────────────────────

/**
 * Translate the given source fields into every other language, one request per
 * field per language so a long story can never be cut off by output-token caps.
 */
async function translateFieldsToAllLanguages(sourceParts, sourceLang, generate) {
  const result = emptyResult();
  const sourceName = LANGUAGE_NAMES[sourceLang];

  for (const field of FIELD_NAMES) {
    result[field][sourceLang] = sourceParts[field] || '';
  }

  const targets = ALL_LANGS.filter((lang) => lang !== sourceLang);

  // Sequential (not parallel) to avoid bursting provider rate limits (e.g. Gemini 429).
  for (const lang of targets) {
    const targetName = LANGUAGE_NAMES[lang];

    for (const field of FIELD_NAMES) {
      const sourceText = sourceParts[field];
      if (!sourceText) continue;

      const raw = await generate(
        buildTranslateSystemPrompt(field, sourceName, targetName),
        `Translate this ${FIELD_LABELS[field]} into ${targetName}:\n\n${sourceText}`,
        { temperature: 0.2, maxTokens: 8192 }
      );

      const translated = cleanField(raw, field);
      if (!translated) {
        throw new Error(`Empty ${targetName} translation returned for the ${field}`);
      }
      result[field][lang] = translated;
    }
  }

  return result;
}

const TAGS_SYSTEM_PROMPT =
  'You are a news SEO editor. Read a news article and extract its key topic tags: ' +
  'the people, places, organizations, and themes a reader would search for. ' +
  'Tags must be in ENGLISH, lowercase, 1 to 3 words each, no hashtags and no punctuation. ' +
  'Return ONLY valid JSON in the form {"tags": ["tag one", "tag two"]}. No markdown, no code fences, no commentary.';

/**
 * Pull the tag list out of a model response. Providers occasionally wrap JSON in
 * code fences or answer with a plain list, so both shapes are accepted.
 */
const parseTags = (rawText) => {
  const text = String(rawText || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  if (!text) return [];

  let values = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) values = parsed;
    else if (Array.isArray(parsed?.tags)) values = parsed.tags;
  } catch {
    // Not JSON — fall back to a comma or newline separated list.
    values = text.split(/[,\n]/);
  }

  const seen = new Set();
  const tags = [];
  for (const value of values) {
    const slug = slugifyTag(value);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    tags.push(slug);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
};

/**
 * Generate English topic tags from the English version of the story. Tags are a
 * nice-to-have, so any failure returns an empty list instead of failing the
 * whole translation request.
 */
async function generateEnglishTags({ title, content, summary }, generate) {
  const source = [title, content || summary].filter(Boolean).join('\n\n').trim();
  if (!source) return [];

  try {
    const raw = await generate(
      TAGS_SYSTEM_PROMPT,
      `Generate ${MIN_TAGS} to ${MAX_TAGS} English tags for this article. Return ONLY {"tags": [...]}.\n\n${source.slice(0, 6000)}`,
      { temperature: 0.3, maxTokens: 512, json: true }
    );
    return parseTags(raw);
  } catch (err) {
    console.error('[translate] Tag generation failed:', err.message);
    return [];
  }
}

const resolveSourceLang = (title, summary, content, preferredLang = 'te') => {
  const fields = [title, summary, content];
  if (fields.some((f) => f?.[preferredLang]?.trim())) return preferredLang;

  for (const lang of ALL_LANGS) {
    if (fields.some((f) => f?.[lang]?.trim())) return lang;
  }
  return preferredLang;
};

/**
 * Requirement 1 — "Translate to All Languages".
 * The reporter already wrote the title, summary, and content in one language;
 * translate each field faithfully into the remaining languages so the headline
 * means the same thing in Telugu, Hindi, and English.
 */
async function translateArticleFields({ title, summary, content, sourceLang = 'te' }) {
  const resolvedSourceLang = resolveSourceLang(title, summary, content, sourceLang);

  const sourceParts = {
    title: clamp(title?.[resolvedSourceLang], TITLE_LIMIT),
    summary: clamp(summary?.[resolvedSourceLang], SUPERLEAD_LIMIT),
    content: clamp(content?.[resolvedSourceLang], CONTENT_LIMIT)
  };

  if (!sourceParts.title && !sourceParts.summary && !sourceParts.content) {
    throw new Error('Please provide article content in at least one language');
  }

  const { provider, generate } = createGenerator();
  console.log(
    `[translate-all] provider=${provider} sourceLang=${resolvedSourceLang} ` +
    `fields=${FIELD_NAMES.filter((f) => sourceParts[f]).join(',')}`
  );

  const translated = await translateFieldsToAllLanguages(sourceParts, resolvedSourceLang, generate);
  const tags = await generateEnglishTags(
    {
      title: translated.title.en,
      summary: translated.summary.en,
      content: translated.content.en
    },
    generate
  );

  return { ...translated, tags, sourceLang: resolvedSourceLang, provider };
}

/**
 * Requirement 2 — raw text in one language only.
 * Decide the headline, superlead, and full story in the source language first,
 * then translate those three parts into the other languages. Generating once and
 * translating keeps the headline consistent across all languages.
 */
async function generateAndTranslateArticle({ text, sourceLang = 'te' }) {
  const articleText = String(text || '').trim();
  if (!articleText) {
    throw new Error('Please provide article content in at least one language');
  }

  const resolvedSourceLang = ALL_LANGS.includes(sourceLang) ? sourceLang : 'te';
  const { provider, generate } = createGenerator();

  console.log(
    `[generate-translate] provider=${provider} sourceLang=${resolvedSourceLang} chars=${articleText.length}`
  );

  const raw = await generate(
    buildGenerateSystemPrompt(LANGUAGE_NAMES[resolvedSourceLang]),
    `Raw article:\n\n${articleText}`,
    { temperature: 0.7, maxTokens: 8192 }
  );

  const generated = parseSectionBlock(String(raw || ''));
  if (!generated.title || !generated.summary || !generated.content) {
    throw new Error('The AI provider returned an incomplete article draft');
  }

  const translated = await translateFieldsToAllLanguages(generated, resolvedSourceLang, generate);
  const tags = await generateEnglishTags(
    {
      title: translated.title.en,
      summary: translated.summary.en,
      content: translated.content.en
    },
    generate
  );

  return { ...translated, tags, sourceLang: resolvedSourceLang, provider };
}

module.exports = {
  TITLE_LIMIT,
  SUPERLEAD_LIMIT,
  CONTENT_LIMIT,
  parseSectionBlock,
  cleanField,
  translateArticleFields,
  generateAndTranslateArticle
};
