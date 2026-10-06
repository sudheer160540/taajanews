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
const getGeminiModel = () =>
  String(process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim() || 'gemini-2.0-flash';

const getOpenAIModel = () =>
  String(process.env.OPENAI_MODEL || 'gpt-4o-mini').trim() || 'gpt-4o-mini';

const getAnthropicModel = () =>
  String(process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim() ||
  'claude-haiku-4-5-20251001';

const API_RETRY_DEFAULT = 4;

/**
 * Provider + model actually used by source-article processing, plus retry knobs
 * from env (SOURCE_PLAGIARISM_RETRIES, SOURCE_PLAGIARISM_MAX, SOURCE_CRON_BATCH_SIZE).
 */
function resolveSourceAiRuntime() {
  const provider = getTranslateProvider() || 'openai';
  let model;
  let modelEnv = 'OPENAI_MODEL';
  if (provider === 'gemini') {
    model = getGeminiModel();
    modelEnv = 'GEMINI_MODEL';
  } else if (provider === 'anthropic') {
    model = getAnthropicModel();
    modelEnv = 'ANTHROPIC_MODEL';
  } else if (provider === 'sarvam') {
    model = `${getOpenAIModel()} (rewrite) + sarvam mayura:v1 (translate)`;
    modelEnv = 'OPENAI_MODEL+SARVAM';
  } else {
    model = getOpenAIModel();
    modelEnv = 'OPENAI_MODEL';
  }

  const plagiarism = getSourcePlagiarismConfig();
  const batchSize = Math.max(1, parseInt(process.env.SOURCE_CRON_BATCH_SIZE, 10) || 5);
  const apiRetries = Math.max(
    0,
    parseInt(process.env.SOURCE_API_RETRIES, 10) || API_RETRY_DEFAULT
  );

  return {
    provider,
    model,
    modelEnv,
    batchSize,
    apiRetries,
    plagiarismRetries: plagiarism.retries,
    plagiarismRetriesEnv: process.env.SOURCE_PLAGIARISM_RETRIES === undefined ||
      process.env.SOURCE_PLAGIARISM_RETRIES === ''
      ? 'default'
      : 'env',
    plagiarismMaxAttempts: plagiarism.maxAttempts,
    plagiarismTarget: plagiarism.target,
    plagiarismTargetEnv:
      process.env.SOURCE_PLAGIARISM_MAX === undefined || process.env.SOURCE_PLAGIARISM_MAX === ''
        ? 'default'
        : 'env'
  };
}

function logSourceAiRuntime(prefix = '[source-cron]') {
  const rt = resolveSourceAiRuntime();
  console.log(
    `${prefix} AI picked provider=${rt.provider} model=${rt.model} (from ${rt.modelEnv})`
  );
  console.log(
    `${prefix} retries config: plagiarismRetries=${rt.plagiarismRetries} ` +
    `(SOURCE_PLAGIARISM_RETRIES ${rt.plagiarismRetriesEnv}, maxAttempts=${rt.plagiarismMaxAttempts} ` +
    `= 1 first try + ${rt.plagiarismRetries} rewrite retries) ` +
    `plagiarismTarget=${rt.plagiarismTarget}% (SOURCE_PLAGIARISM_MAX ${rt.plagiarismTargetEnv}) ` +
    `apiBackoffRetries=${rt.apiRetries} (429/5xx) batchSize=${rt.batchSize} (SOURCE_CRON_BATCH_SIZE)`
  );
  return rt;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry an async API call on rate limits (429), transient 5xx, and network
 * errors, using exponential backoff and honoring a Retry-After header.
 */
async function withRetry(fn, { retries, baseDelayMs = 1500, label = 'API request' } = {}) {
  const maxRetries =
    retries ?? Math.max(0, parseInt(process.env.SOURCE_API_RETRIES, 10) || API_RETRY_DEFAULT);
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

      if (!isRetriable || attempt >= maxRetries) throw err;

      const retryAfterSec = Number(err?.response?.headers?.['retry-after']);
      const delay =
        Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? retryAfterSec * 1000
          : baseDelayMs * 2 ** attempt;

      attempt += 1;
      console.warn(
        `[translate] ${label} failed (${status || err?.code}); retry ${attempt}/${maxRetries} in ${delay}ms`
      );
      await sleep(delay);
    }
  }
}

/**
 * Taaja News editorial standards (Super Lead + Detailed Story).
 * Used for source-article generation and news-mode translation.
 */
const parsePlagiarismTarget = () => {
  const raw = process.env.SOURCE_PLAGIARISM_MAX;
  if (raw === undefined || raw === '') return 10;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) return 10;
  return Math.min(100, Math.max(0, parsed));
};

const parsePlagiarismRetries = () => {
  const raw = process.env.SOURCE_PLAGIARISM_RETRIES;
  if (raw === undefined || raw === '') return 1;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.min(5, Math.max(0, parsed));
};

const getPlagiarismTargetLabel = () => {
  const target = parsePlagiarismTarget();
  return target === 0 ? 'zero (0%)' : `under ${target}%`;
};

const getSourcePlagiarismConfig = () => {
  const target = parsePlagiarismTarget();
  const retries = parsePlagiarismRetries();
  return {
    target,
    retries,
    maxAttempts: retries + 1,
    targetLabel: getPlagiarismTargetLabel()
  };
};

// Backward-compatible snapshots (prefer getSourcePlagiarismConfig() at runtime).
const SOURCE_PLAGIARISM_TARGET = parsePlagiarismTarget();
const SOURCE_PLAGIARISM_RETRIES = parsePlagiarismRetries();

const SOURCE_LOG_PREVIEW = 140;

function previewText(text) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  if (!compact) return '(empty)';
  if (compact.length <= SOURCE_LOG_PREVIEW) return compact;
  return `${compact.slice(0, SOURCE_LOG_PREVIEW)}…`;
}

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function logSource(stage, extra = '') {
  console.log(`[source-translate] ${stage}${extra ? ` | ${extra}` : ''}`);
}

function elapsedMs(startedAt) {
  return Date.now() - startedAt;
}

let defaultPlagiarismChecker = null;
const resolvePlagiarismChecker = (options = {}) => {
  if (options.checkPlagiarism === false) return null;
  if (typeof options.checkPlagiarism === 'function') return options.checkPlagiarism;
  if (!defaultPlagiarismChecker) {
    defaultPlagiarismChecker = require('./plagiarismAnalysis').calculatePlagiarismMatchPercentage;
  }
  return defaultPlagiarismChecker;
};

const NEWS_EDITORIAL_PERSONA =
  'You are a Senior Generalist Editor at a national news desk with 20+ years of experience. ' +
  'You read wire copies, agency feeds, and rival reports, extract verified facts, then publish an entirely original story in a natural human newsroom voice. ' +
  'You never file copy that mirrors source wording, sentence rhythm, or paragraph order.';

const buildLanguageStyleConstraints = () => `
LANGUAGE & STYLE CONSTRAINTS (mandatory — apply while writing and while translating):
1. Never use the word "మరియు" or "and" (or Hindi "और"). Use only commas (,) to separate items or thoughts.
2. Use only short, punchy, simple sentences. Strictly avoid compound sentences.
3. Never use Telugu words like "గవుట్." or "గవర్నమెంట్". Use only "ప్రభుత్వం" or "సర్కార్".
4. Translate Hindi "स्वाभिमान" strictly as Telugu "ఆత్మాభిమానం" (never స్వాభిమానం).
5. Address all animals and birds in feminine gender in Telugu (ఆడ జాతి, స్త్రీలింగం).
6. No honorific suffixes or titles next to names (never శ్రీ, గారు, Sri, Mr., Mrs., श्री). Use the direct name only.
7. Mandatory designation BEFORE elected representatives' names:
   - MLA for Assembly members
   - MP for Parliament members
   - సీఎం or CM for Chief Minister
   - గవర్నర్ for Governor
   - రాష్ట్రపతి for President
8. Write all numbers as digits only (e.g. 30, 17, 5). Do NOT add the spelled-out word in brackets after a number.
`.trim();

const buildNewsEditorialCoreRules = () => `
EDITORIAL STANDARDS (apply to every language output):
- The story has two parts: (1) "Super Lead" — brief lead summary; (2) "Detailed Story" — full report.
- Sub-headings are OPTIONAL. Add a sub-heading ONLY when the story is long and clearly covers multiple distinct points that benefit from separation. Short or single-topic stories must have NO sub-headings at all — write them as plain paragraphs only.
- Inverted Pyramid: most critical and latest facts first; least important details last.
- 5W-1H: cover Who, What, Where, When, Why, and How in both parts where relevant.
- Complete plagiarism-free rewrite: narrate a brand-new story from verified facts. Do NOT reuse source vocabulary, clause order, or paragraph flow. Target ${getPlagiarismTargetLabel()} lexical overlap while keeping 100% factual accuracy.
- Use ACTIVE VOICE.
- Do not invent facts, names, dates, places, or quotes not supported by the fact sheet.

${buildLanguageStyleConstraints()}

HEADLINE COMPLETENESS (mandatory — never ship a cut-off title):
- The headline must be a finished news heading a reader can understand alone: WHO did WHAT (and to whom / where).
- Never end on a hanging participle, connector, or half clause. Compress extra details; do NOT chop the last words of a longer line.
- Forbidden Telugu endings: చేస్తూ, అంటూ, అని, కోసం, గురించి, ఆశ్రయించిన, చేసిన, ఇచ్చిన (unless the object that follows is already in the headline).
- BAD: "ఏపీలో బీసీ రిజర్వేషన్ల పరిమితులపై హైకోర్టు తీర్పును సవాలు చేస్తూ సుప్రీంకోర్టును ఆశ్రయించిన"
- GOOD: "బీసీ రిజర్వేషన్ పరిమితిపై హైకోర్టు తీర్పును సవాల్ చేస్తూ సుప్రీంకోర్టులో పిటిషన్"
- Forbidden English endings: to, for, after, as, by, with, and, of, in, on.

CHARACTER & SPACE CONSTRAINTS:
- Headline: 55 to 70 characters in EVERY language. Prefer ~65. Hard cap 80. Stay complete; never cut mid-thought.
- Super Lead: 300 to 450 characters in EVERY language. Prefer ~380. Hard cap 450.
- In English Super Lead only, short forms are allowed: "CPS" (Contributory Pension Scheme), "Govt." (Government), "EHS" (Employees Health Scheme), "DA" (Dearness Allowance). Never carry those English short forms into Telugu.

LANGUAGE & TRANSLATION SPECIFICS:
- Hindi: instead of "और", always use a comma (,).
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

const buildNewsOriginalityRules = () => `
ORIGINALITY & HUMAN VOICE (apply to every language output):
- Think like a senior desk editor on deadline: sharp, neutral, readable, unmistakably human.
- Core objective: the finished copy must score ${getPlagiarismTargetLabel()} lexical and phrase overlap if compared to the original feed, while remaining fact-perfect.
- Zero literal matching: never copy phrases, clauses, or sentence structures. Replace vocabulary entirely with synonyms, strong verbs, and varied phrasing.
- Restructure the narrative: do NOT follow the source's paragraph-by-paragraph flow. Reorder facts, change the lead emphasis, weave background differently.
- Active voice and engaging tone: punchy, journalistic, never robotic or template-like.
- No AI clichés: avoid "In conclusion", "It is important to note", "Testament to", "Delve", "Landscape", "Tapestry", "In a significant development".
`.trim();

const buildAntiPlagiarismRules = () => `
ANTI-PLAGIARISM MANDATE (non-negotiable — lexical and phrase overlap with the source must stay ${getPlagiarismTargetLabel()}):
- Write ONLY from the fact sheet provided. Treat the original source as already discarded.
- Forbidden: any copied phrase of 3+ consecutive words, mirroring sentence order, keeping the same paragraph sequence, or lightly editing the source.
- Required: a fresh headline angle, a new lead hook, reordered paragraphs, new verbs and collocations, varied sentence length, and a human editor's cadence.
- Quotes: keep speaker names and quote meaning exact, but express attribution in fresh words when the fact sheet allows.
- Facts, names, numbers, dates, and places must stay 100% accurate.
`.trim();

// Static snapshot for callers that import the string constant directly.
const NEWS_EDITORIAL_CORE_RULES = buildNewsEditorialCoreRules();

const buildNewsGenerationSystemPrompt = (strictRewrite = false) => {
  const plagiarismTarget = parsePlagiarismTarget();
  const targetLabel = getPlagiarismTargetLabel();
  return `${NEWS_EDITORIAL_PERSONA}
${buildNewsEditorialCoreRules()}
${buildNewsOriginalityRules()}
${buildAntiPlagiarismRules()}
${strictRewrite ? `STRICT REWRITE PASS: your previous draft scored too high on plagiarism. Change the headline completely, reorder every paragraph, and replace all verbs and noun phrases. Target ${plagiarismTarget === 0 ? '0% overlap (no shared phrases with the source)' : `${targetLabel} overlap`}.\n` : ''}
Return ONLY valid JSON with keys "title" (headline), "summary" (Super Lead), and "content" (Detailed Story). The values must be PLAIN TEXT (no markdown, no #, no *). No markdown code fences.`;
};

const buildNewsTranslationSystemPrompt = (targetLangName, fieldLabel) => {
  const lang = String(targetLangName || '').toLowerCase();
  const langCode = lang.includes('telugu') ? 'te' : lang.includes('hindi') ? 'hi' : 'en';
  return `${NEWS_EDITORIAL_PERSONA}
You are adapting an original English rewrite into ${targetLangName} for the ${fieldLabel}.
This is not a literal translation. Keep every fact, name, number, date, quote, and designation. Change sentence structure and word choice so it reads as original ${targetLangName} reporting.
Do not reconstruct or echo the original source article's Telugu or Hindi phrasing even if you recognize the story.
${buildNewsEditorialCoreRules()}
${buildLanguageStyleConstraints(langCode)}
${buildNewsOriginalityRules()}
Preserve inverted-pyramid meaning. Keep the English rewrite's paragraph and sub-heading layout as plain text: if it has sub-headings, keep them as plain-text lines with a blank line before and after; if it has none, do NOT add any.
${fieldLabel === 'headline' ? `HEADLINE: finished thought only (who + what). 55–70 characters, hard cap 80. Compress; never chop the last words. Never end on ఆశ్రయించిన / చేస్తూ / to / for.` : fieldLabel.includes('Super Lead') ? `LENGTH: the ${targetLangName} Super Lead MUST be 300–450 characters. Hard cap 450. Compress if needed; keep all key facts.` : ''}
Return ONLY the ${targetLangName} text as PLAIN TEXT, nothing else.`;
};

const PIVOT_TO_ENGLISH_SYSTEM =
  'You are a news desk translator. Convert the text into natural English. ' +
  'Preserve every fact, name, number, date, quote, and designation. Do not add or invent facts. ' +
  'Use fluent English wording — not a word-for-word calque. Return ONLY the English text as PLAIN TEXT.';

function buildTranslateSystemAndUser(text, targetLangName, options = {}) {
  const mode = options.mode || 'plain';
  const fieldType = options.fieldType || 'content';
  const fieldLabels = {
    title: 'headline',
    summary: 'Super Lead section',
    content: 'Detailed Story section'
  };
  const fieldLabel = fieldLabels[fieldType] || 'text';

  if (mode === 'pivot') {
    return {
      systemContent: PIVOT_TO_ENGLISH_SYSTEM,
      userContent: `Convert this ${fieldLabel} to natural English:\n\n${text}`,
      temperature: 0.25
    };
  }

  if (mode === 'news') {
    const lengthRule =
      fieldType === 'title'
        ? ' Keep 55–70 characters (hard cap 80). The headline MUST be a complete thought (who + what). Never end hanging like "ఆశ్రయించిన" or "to/for". Compress extra clauses instead of cutting the last words.'
        : fieldType === 'summary'
          ? ' Keep the result between 300 and 450 characters (hard cap 450).'
          : '';
    return {
      systemContent: buildNewsTranslationSystemPrompt(targetLangName, fieldLabel),
      userContent:
        `Rewrite this ${fieldLabel} in ${targetLangName} from the English meaning. ` +
        `Do not restore original-source wording.${lengthRule}\n\n${text}`,
      temperature: 0.42
    };
  }

  return {
    systemContent:
      'You are a professional translator. Translate the given text accurately while preserving meaning, tone, and formatting. Return ONLY the translated text, nothing else.',
    userContent: `Translate the following text to ${targetLangName}:\n\n${text}`,
    temperature: 0.3
  };
}

const FACT_EXTRACTION_SYSTEM_PROMPT =
  'You are a senior news desk fact checker. Read the source once and extract verified facts only. ' +
  'Do NOT copy sentences or phrases from the source. Use short neutral fact strings. ' +
  'Return ONLY valid JSON with keys: "who" (array), "what", "when", "where", "why", "how", "background" (array), ' +
  '"quotes" (array of {"speaker","text"}), "numbers" (array). No markdown.';

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
    model: getOpenAIModel(),
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent }
    ],
    temperature
  };
  if (json) request.response_format = { type: 'json_object' };
  if (maxTokens) request.max_tokens = maxTokens;

  const completion = await withRetry(() => getOpenAI().chat.completions.create(request), {
    label: `OpenAI ${getOpenAIModel()}`
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}

/**
 * @param {string} text
 * @param {string} targetLangName - e.g. "Telugu", "English", "Hindi"
 * @param {{ mode?: 'plain'|'news'|'pivot', fieldType?: 'title'|'summary'|'content' }} [options]
 */
async function openaiTranslate(text, targetLangName, options = {}) {
  if (!text || !text.trim()) return '';

  const { systemContent, userContent, temperature } = buildTranslateSystemAndUser(
    text,
    targetLangName,
    options
  );

  return openaiGenerateText(systemContent, userContent, { temperature });
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

/**
 * JSON/text generation for source-article rewrite. Gemini when TRANSLATE_TYPE=gemini;
 * otherwise OpenAI (including sarvam, which cannot rewrite).
 */
async function generateProviderText(systemContent, userContent, options = {}) {
  if (getTranslateProvider() === 'gemini') {
    return geminiGenerateText(systemContent, userContent, {
      temperature: options.temperature,
      json: options.json,
      maxOutputTokens: options.maxTokens
    });
  }
  return openaiGenerateText(systemContent, userContent, options);
}

/** True when the active translation/generation provider is Gemini. */
const isGeminiProvider = () => getTranslateProvider() === 'gemini';

/**
 * Translate/adapt text with Google Gemini, applying the same news editorial
 * prompts as the OpenAI path so all rules carry over.
 *
 * @param {string} text
 * @param {string} targetLangName - e.g. "Telugu", "English", "Hindi"
 * @param {{ mode?: 'plain'|'news'|'pivot', fieldType?: 'title'|'summary'|'content' }} [options]
 */
async function geminiTranslate(text, targetLangName, options = {}) {
  if (!text || !text.trim()) return '';

  const { systemContent, userContent, temperature } = buildTranslateSystemAndUser(
    text,
    targetLangName,
    options
  );

  return geminiGenerateText(systemContent, userContent, { temperature });
}

/**
 * @param {{ mode?: 'plain'|'news'|'pivot', fieldType?: 'title'|'summary'|'content' }} [options]
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

/**
 * Super Lead (stored in Article.summary).
 * Character band 300–450. Hard cap 450.
 */
const getSuperLeadLimits = () => {
  const minChars = Math.max(100, parseInt(process.env.SOURCE_SUPER_LEAD_MIN_CHARS, 10) || 300);
  const maxChars = Math.max(minChars, parseInt(process.env.SOURCE_SUPER_LEAD_MAX_CHARS, 10) || 450);
  const minWords = Math.max(1, parseInt(process.env.SOURCE_SUPER_LEAD_MIN_WORDS, 10) || 50);
  const maxWords = Math.max(minWords, parseInt(process.env.SOURCE_SUPER_LEAD_MAX_WORDS, 10) || 90);
  const minSentences = Math.max(1, parseInt(process.env.SOURCE_SUPER_LEAD_MIN_SENTENCES, 10) || 3);
  const maxSentences = Math.max(minSentences, parseInt(process.env.SOURCE_SUPER_LEAD_MAX_SENTENCES, 10) || 5);
  return { minChars, maxChars, minWords, maxWords, minSentences, maxSentences };
};

/** Detailed Story (stored in Article.content) */
const getDetailedStoryLimits = () => {
  const minWords = Math.max(1, parseInt(process.env.SOURCE_CONTENT_MIN_WORDS, 10) || 500);
  const maxWords = Math.max(minWords, parseInt(process.env.SOURCE_CONTENT_MAX_WORDS, 10) || 1200);
  return { minWords, maxWords };
};

/** Headline (stored in Article.title) — target 55–70, hard cap 80. */
const getHeadlineLimits = () => {
  const minChars = Math.max(40, parseInt(process.env.SOURCE_TITLE_MIN_CHARS, 10) || 55);
  const targetMax = Math.max(minChars, parseInt(process.env.SOURCE_TITLE_TARGET_CHARS, 10) || 70);
  const maxChars = Math.max(targetMax, parseInt(process.env.SOURCE_TITLE_MAX_CHARS, 10) || 80);
  return { minChars, targetMax, maxChars };
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
  const spaceIdx = cut.lastIndexOf(' ');
  if (spaceIdx >= Math.floor(maxChars * 0.6)) {
    return cut.slice(0, spaceIdx).trim();
  }
  return cut.trim();
};

const INCOMPLETE_HEADLINE_TE =
  /(చేస్తూ|అంటూ|అని|కోసం|గురించి|ద్వారా|ఆశ్రయించిన|చేసిన|ఇచ్చిన|వేసిన|పెట్టిన|అయిన|చేపట్టిన|కోరిన|వేడుకున్న)$/;
const INCOMPLETE_HEADLINE_EN =
  /\b(to|for|after|as|by|with|and|the|a|an|in|on|of|from|that|who|which|into)$/i;
const INCOMPLETE_HEADLINE_HI = /(करते हुए|के लिए|की|के|से|पर|को|ने|हुआ|हुई|हुए)$/;

function isIncompleteHeadline(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return true;
  if (/[-–,]$/.test(trimmed)) return true;
  const last = trimmed.split(/\s+/).pop() || '';
  return (
    INCOMPLETE_HEADLINE_TE.test(last) ||
    INCOMPLETE_HEADLINE_EN.test(last) ||
    INCOMPLETE_HEADLINE_HI.test(last)
  );
}

function enforceFieldChars(text, fieldType) {
  if (fieldType === 'title') {
    const cleaned = cleanHeadline(text);
    const { maxChars } = getHeadlineLimits();
    if (cleaned.length <= maxChars) return cleaned;
    const sliced = truncateAtSentence(cleaned, maxChars);
    if (isIncompleteHeadline(sliced)) {
      logSource(
        'title.skipTruncate',
        `keepComplete chars=${cleaned.length} slicedWouldBe=${previewText(sliced)}`
      );
      return cleaned;
    }
    return sliced;
  }
  if (fieldType === 'summary') {
    const { maxChars } = getSuperLeadLimits();
    return truncateAtSentence(cleanNewsText(text), maxChars);
  }
  return cleanNewsText(text);
}

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
async function extractSourceFacts(rawText, options = {}) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) {
    throw new Error('Cannot extract facts from empty source text');
  }

  const strictRewrite = Boolean(options.strictRewrite);
  logSource('facts.start', `strict=${strictRewrite} chars=${trimmed.length}`);
  const systemPrompt = strictRewrite
    ? `${FACT_EXTRACTION_SYSTEM_PROMPT} Restate every fact in completely different neutral wording. Shuffle the order of array items.`
    : FACT_EXTRACTION_SYSTEM_PROMPT;
  const userPrefix = strictRewrite
    ? 'Extract verified facts only. Restate each fact in fresh words. Do not copy any sentence from the source.\n\n'
    : 'Extract verified facts only. Do not copy any sentence from the source.\n\n';

  const responseText = await generateProviderText(
    systemPrompt,
    userPrefix + trimmed.slice(0, 12000),
    { temperature: strictRewrite ? 0.35 : 0.1, json: true, maxTokens: 1500 }
  );
  if (!responseText) {
    throw new Error('Fact extraction returned an empty response');
  }

  try {
    const facts = parseJsonObject(responseText);
    const who = Array.isArray(facts.who) ? facts.who.length : 0;
    const quotes = Array.isArray(facts.quotes) ? facts.quotes.length : 0;
    const numbers = Array.isArray(facts.numbers) ? facts.numbers.length : 0;
    logSource(
      'facts.done',
      `strict=${strictRewrite} who=${who} quotes=${quotes} numbers=${numbers} what=${previewText(facts.what)}`
    );
    return facts;
  } catch {
    throw new Error('Failed to parse fact extraction JSON');
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
    `Plagiarism target: ${getPlagiarismTargetLabel()} lexical and phrase overlap with any source.\n\n` +
    `Return ONLY JSON with:\n` +
    `1) "title" — HEADLINE: a FINISHED thought (who + what); single line; ${headline.minChars}–${headline.targetMax} characters, hard cap ${headline.maxChars}. Compress extra clauses. NEVER cut the last words. NEVER end on ఆశ్రయించిన, చేస్తూ, అంటూ, అని, to, for, after.\n` +
    `2) "summary" — SUPER LEAD: ${superLead.minChars}-${superLead.maxChars} characters (never over ${superLead.maxChars}); ${superLead.minSentences}-${superLead.maxSentences} short sentences; inverted pyramid; 5W-1H.\n` +
    `3) "content" — DETAILED STORY: ${detailed.minWords}-${detailed.maxWords} words; do not repeat the Super Lead; do not pad — if the fact sheet is thin, stay near the minimum; background where needed; new paragraph every 4-5 sentences; sub-headings only if truly needed.\n\n` +
    `Write like a human editor. Vary sentence length. Do not mirror the fact-sheet bullet order paragraph by paragraph.\n` +
    `${strictNote}` +
    `${sourceTitleNote}\n` +
    `Fact sheet (your ONLY source of truth):\n${JSON.stringify(factSheet)}\n\n` +
    'Return ONLY: {"title":"...","summary":"...","content":"..."}'
  );
};

async function repairIncompleteHeadline(title, languageName, factSheet, headline) {
  const broken = cleanHeadline(title);
  logSource('title.incomplete.repair', `lang=${languageName} broken=${previewText(broken)}`);
  const factHint = factSheet ? JSON.stringify(factSheet).slice(0, 1200) : '';
  const repaired = await generateProviderText(
    'You write complete newspaper headlines only. Return ONLY the headline as plain text.',
    `This ${languageName} headline is incomplete (hanging last word). Rewrite it as a FINISHED news heading.\n` +
      `Rules: who + what must be clear. ${headline.minChars}–${headline.targetMax} characters, hard cap ${headline.maxChars}. ` +
      `Compress extra clauses. Never chop the last words. Never end on ఆశ్రయించిన, చేస్తూ, అంటూ, అని, to, for, after.\n` +
      `Broken headline: ${broken}\n` +
      (factHint ? `Facts:\n${factHint}\n` : '') +
      'Return ONLY the complete headline.',
    { temperature: 0.35, maxTokens: 200 }
  );
  const next = enforceFieldChars(repaired, 'title');
  if (!next || isIncompleteHeadline(next)) {
    logSource('title.incomplete.unfixed', `kept=${previewText(broken)}`);
    return broken;
  }
  logSource('title.incomplete.fixed', `chars=${next.length} title=${previewText(next)}`);
  return next;
}

/**
 * Rewrite source into headline + Super Lead + Detailed Story in anchor language.
 * Uses Gemini when TRANSLATE_TYPE=gemini; otherwise OpenAI (Sarvam cannot rewrite).
 *
 * @param {string} rawText - full source article body
 * @param {string} anchorLang - te | en | hi
 * @param {{ sourceTitle?: string, strictRewrite?: boolean, factSheet?: object }} [options]
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

  // Callers may pass a fact sheet from a previous attempt to skip re-extraction.
  const factSheet = options.factSheet || (await extractSourceFacts(trimmed, { strictRewrite }));

  const responseText = await generateProviderText(
    buildNewsGenerationSystemPrompt(strictRewrite),
    buildGenerationUserPrompt({
      languageName,
      headline,
      superLead,
      detailed,
      sourceTitle,
      factSheet,
      strictRewrite
    }),
    {
      temperature: strictRewrite ? 0.62 : 0.52,
      json: true,
      maxTokens: parseInt(process.env.SOURCE_GENERATION_MAX_TOKENS, 10) || 6000
    }
  );
  if (!responseText) {
    throw new Error('Summary/content generation returned an empty response');
  }

  let parsed;
  try {
    parsed = parseJsonObject(responseText);
  } catch {
    throw new Error('Failed to parse summary/content JSON');
  }

  let title = enforceFieldChars(parsed.title, 'title');
  let summary = enforceFieldChars(parsed.summary, 'summary');
  let content = cleanNewsText(parsed.content);

  if (!title) {
    // Fallback: derive a headline from the Super Lead rather than reuse the scraped title.
    title = enforceFieldChars(summary, 'title');
  }
  if (isIncompleteHeadline(title)) {
    title = await repairIncompleteHeadline(title, languageName, factSheet, headline);
  }

  if (!summary) throw new Error('Generated Super Lead (summary) is empty');
  if (!content) throw new Error('Generated Detailed Story (content) is empty');

  content = cleanNewsText(truncateToWordCount(content, detailed.maxWords));

  logSource(
    'rewrite.en.done',
    `strict=${strictRewrite} titleChars=${title.length}/${headline.maxChars} ` +
    `summaryChars=${summary.length}/${superLead.maxChars} ` +
    `contentWords=${wordCount(content)} title=${previewText(title)}`
  );

  return { title, summary, content, factSheet };
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
 * Generate 4–5 concise topic tags (lowercase slugs) from article text.
 * Tags cover key people, places, organizations, and topics. Returns [] on failure
 * so tag generation never blocks article creation.
 */
async function generateTags(text, { min = 4, max = 5 } = {}) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];

  try {
    const responseText = await generateProviderText(
      'You are a news SEO editor. Extract concise topic tags from an article: key people, places, organizations, and themes. ' +
        'Tags must be in lowercase English, 1 to 3 words each. ' +
        'Return ONLY valid JSON: {"tags": ["tag one", "tag two", ...]}. No markdown.',
      `Generate ${min} to ${max} relevant tags for the following article. ` +
        `Return ONLY {"tags": [...]}.\n\n${trimmed}`,
      { temperature: 0.3, json: true }
    );
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
 * Expand rewritten text to te/en/hi.
 * English is the translation hub:
 *   1) Keep the rewritten text in the anchor language (no round-trip).
 *   2) If anchor is not English, translate it to English first.
 *   3) Translate from English into the remaining languages (e.g. te → en → hi).
 *
 * @param {'title'|'summary'|'content'} [fieldType]
 */
async function toTrilingual(text, anchorLang, fieldType = 'content') {
  const isTitle = fieldType === 'title';
  const clean = (value) => enforceFieldChars(value, fieldType);

  const trimmed = clean(text);
  const result = { te: '', en: '', hi: '' };
  if (!trimmed) return result;

  if (!ALL_LANG_CODES.includes(anchorLang)) {
    throw new Error(`Unsupported anchor language: ${anchorLang}`);
  }

  const translateOptions = { mode: 'news', fieldType };
  result[anchorLang] = trimmed;
  logSource(`expand.${fieldType}.keep`, `lang=${anchorLang} chars=${trimmed.length}`);

  let englishText = trimmed;
  if (anchorLang !== 'en') {
    const startedAt = Date.now();
    englishText = clean(await translateField(trimmed, anchorLang, 'en', translateOptions));
    result.en = englishText;
    logSource(
      `expand.${fieldType}.${anchorLang}→en`,
      `ms=${elapsedMs(startedAt)} chars=${englishText.length} preview=${previewText(englishText)}`
    );
  }

  const remaining = ALL_LANG_CODES.filter((lang) => lang !== 'en' && lang !== anchorLang);
  // Sequential to avoid bursting provider rate limits (e.g. Gemini 429).
  for (const lang of remaining) {
    const startedAt = Date.now();
    result[lang] = clean(await translateField(englishText, 'en', lang, translateOptions));
    logSource(
      `expand.${fieldType}.en→${lang}`,
      `ms=${elapsedMs(startedAt)} chars=${result[lang].length} preview=${previewText(result[lang])}`
    );
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
async function pivotSourceToEnglish(text, sourceLang, fieldType) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    logSource(`pivot.${fieldType}.skip`, 'empty');
    return '';
  }
  if (sourceLang === 'en') {
    logSource(
      `pivot.${fieldType}.skip`,
      `already-en chars=${trimmed.length} preview=${previewText(trimmed)}`
    );
    return trimmed;
  }
  const startedAt = Date.now();
  logSource(
    `pivot.${fieldType}.start`,
    `${sourceLang}→en chars=${trimmed.length} preview=${previewText(trimmed)}`
  );
  const pivoted = await translateField(trimmed, sourceLang, 'en', {
    mode: 'pivot',
    fieldType
  });
  const out = fieldType === 'title' ? cleanHeadline(pivoted) : cleanNewsText(pivoted);
  logSource(
    `pivot.${fieldType}.done`,
    `ms=${elapsedMs(startedAt)} chars=${out.length} preview=${previewText(out)}`
  );
  return out;
}

async function buildSourceArticleMultilingual(input, options = {}) {
  const { title, contentText, source } = input;
  const titleTrimmed = String(title || '').trim();
  const contentTrimmed = String(contentText || '').trim();

  if (!contentTrimmed) throw new Error('Source article has no contentText');

  const pipelineStartedAt = Date.now();
  const sourceLang = resolveAnchorLanguage(source, contentTrimmed);
  const rewriteLang = 'en';
  const provider = getTranslateProvider() || 'openai';
  const runtime = resolveSourceAiRuntime();
  const checkPlagiarism = resolvePlagiarismChecker(options);
  const { target: plagiarismTarget, retries: plagiarismRetries } = getSourcePlagiarismConfig();
  const maxAttempts = checkPlagiarism ? plagiarismRetries + 1 : 1;

  logSource(
    'start',
    `source=${String(source || 'unknown')} provider=${runtime.provider} model=${runtime.model} ` +
    `sourceLang=${sourceLang} rewriteLang=${rewriteLang} flow=${sourceLang}→en rewrite→te/hi ` +
    `plagiarism=${checkPlagiarism ? `on target=${plagiarismTarget}% retries=${plagiarismRetries} maxAttempts=${maxAttempts}` : 'off'} ` +
    `titleChars=${titleTrimmed.length} contentChars=${contentTrimmed.length} ` +
    `title=${previewText(titleTrimmed)}`
  );

  const englishBody = await pivotSourceToEnglish(contentTrimmed, sourceLang, 'content');
  if (!englishBody) throw new Error('Failed to pivot source article to English');
  const englishTitle = await pivotSourceToEnglish(titleTrimmed, sourceLang, 'title');

  let bestPack = null;
  let bestScore = 101;
  let factSheet = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attemptStartedAt = Date.now();
    const strictRewrite = attempt > 0;
    logSource(
      'attempt.start',
      `${attempt + 1}/${maxAttempts} strict=${strictRewrite} extractFacts=${!factSheet}`
    );

    const draft = await generateSummaryAndContent(englishBody, rewriteLang, {
      sourceTitle: englishTitle,
      strictRewrite,
      factSheet
    });
    factSheet = draft.factSheet;

    logSource('expand.start', `attempt=${attempt + 1} fields=title,summary,content hub=en`);
    const titleMap = await toTrilingual(draft.title, rewriteLang, 'title');
    const headlineLimits = getHeadlineLimits();
    for (const lang of ALL_LANG_CODES) {
      if (isIncompleteHeadline(titleMap[lang])) {
        titleMap[lang] = await repairIncompleteHeadline(
          titleMap[lang],
          SUPPORTED_LANGUAGES[lang],
          factSheet,
          headlineLimits
        );
      }
    }
    const summaryMap = await toTrilingual(draft.summary, rewriteLang, 'summary');
    const contentMap = await toTrilingual(draft.content, rewriteLang, 'content');
    const pack = { titleMap, summaryMap, contentMap };

    logSource(
      'expand.done',
      `teTitle=${previewText(titleMap.te)} enTitle=${previewText(titleMap.en)} hiTitle=${previewText(titleMap.hi)} ` +
      `teContentWords=${wordCount(contentMap.te)} enContentWords=${wordCount(contentMap.en)} hiContentWords=${wordCount(contentMap.hi)}`
    );

    if (!checkPlagiarism) {
      bestPack = pack;
      bestScore = 101;
      logSource('plagiarism.skip', 'checker disabled');
      break;
    }

    const rewrittenForCheck = contentMap[sourceLang] || contentMap.en;
    logSource(
      'plagiarism.compare',
      `originalLang=${sourceLang} originalChars=${contentTrimmed.length} ` +
      `rewrittenChars=${String(rewrittenForCheck || '').length} ` +
      `originalPreview=${previewText(contentTrimmed)} ` +
      `rewrittenPreview=${previewText(rewrittenForCheck)}`
    );
    const score = await checkPlagiarism(contentTrimmed, rewrittenForCheck);
    const normalizedScore = score == null ? 101 : score;

    if (normalizedScore < bestScore) {
      bestScore = normalizedScore;
      bestPack = pack;
    }

    const passed = normalizedScore <= plagiarismTarget;
    logSource(
      'plagiarism.result',
      `score=${normalizedScore}% best=${bestScore}% target=${plagiarismTarget}% ` +
      `attempt=${attempt + 1}/${maxAttempts} ms=${elapsedMs(attemptStartedAt)} ` +
      `${passed ? 'PASS' : 'RETRY'}`
    );

    if (passed) break;
  }

  if (!bestPack) {
    throw new Error('Failed to generate rewritten source article');
  }

  const tagSourceText = [
    bestPack.titleMap.en,
    bestPack.contentMap.en
  ]
    .filter(Boolean)
    .join('\n\n');
  const tags = await generateTags(tagSourceText);

  logSource(
    'done',
    `ms=${elapsedMs(pipelineStartedAt)} plagiarism=${bestScore <= 100 ? `${bestScore}%` : 'n/a'} ` +
    `tags=${tags.join(',') || 'none'} teTitle=${previewText(bestPack.titleMap.te)}`
  );

  return {
    title: bestPack.titleMap,
    summary: bestPack.summaryMap,
    content: bestPack.contentMap,
    tags,
    anchorLang: sourceLang,
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
  getGeminiModel,
  getOpenAIModel,
  resolveSourceAiRuntime,
  logSourceAiRuntime,
  getTeluguSourceSet,
  getEnglishSourceSet,
  resolveAnchorLanguage,
  generateSummaryAndContent,
  generateTags,
  slugifyTag,
  toTrilingual,
  buildSourceArticleMultilingual,
  getSourcePlagiarismConfig,
  parsePlagiarismTarget,
  parsePlagiarismRetries,
  SOURCE_PLAGIARISM_TARGET,
  SOURCE_PLAGIARISM_RETRIES,
  extractSourceFacts,
  NEWS_EDITORIAL_CORE_RULES,
  buildLanguageStyleConstraints,
  buildNewsGenerationSystemPrompt,
  buildNewsTranslationSystemPrompt
};
