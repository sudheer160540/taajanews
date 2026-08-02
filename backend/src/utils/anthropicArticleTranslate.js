const Anthropic = require('@anthropic-ai/sdk');

const TITLE_LIMIT = 200;
const SUPERLEAD_LIMIT = 500;
const CONTENT_LIMIT = 10000;

const LANG_SECTIONS = {
  TELUGU: 'te',
  HINDI: 'hi',
  ENGLISH: 'en'
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

const buildPrompt = (text) => `You are paraphrasing a news article for a newspaper that publishes in Telugu, Hindi, and English. For each of the three languages, produce three parts:
- HEADING: a concise news headline for the article. Must stay below ${TITLE_LIMIT} characters.
- SUPERLEAD: a short summary of the story. Must stay below ${SUPERLEAD_LIMIT} characters.
- FULLNEWS: the full paraphrased article, in a journalistic tone matching that language's news writing conventions. Must stay below ${CONTENT_LIMIT} characters.

If the input is in a different language, translate as part of the rewrite. Preserve all facts, names, places, dates, and figures exactly in every version.

Return exactly this format and nothing else — no preamble, no notes:

===TELUGU===
HEADING: <headline>
SUPERLEAD: <summary>
FULLNEWS:
<full article>
===HINDI===
HEADING: <headline>
SUPERLEAD: <summary>
FULLNEWS:
<full article>
===ENGLISH===
HEADING: <headline>
SUPERLEAD: <summary>
FULLNEWS:
<full article>

Article:
${text}`;

const clamp = (value, limit) => {
  if (!value) return '';
  const trimmed = value.trim();
  return trimmed.length > limit ? trimmed.slice(0, limit) : trimmed;
};

const parseSectionBlock = (block) => {
  const headingMatch = block.match(/HEADING:\s*([\s\S]*?)(?=\nSUPERLEAD:|$)/i);
  const superleadMatch = block.match(/SUPERLEAD:\s*([\s\S]*?)(?=\nFULLNEWS:|$)/i);
  const fullnewsMatch = block.match(/FULLNEWS:\s*\n?([\s\S]*?)$/i);

  return {
    title: clamp(headingMatch?.[1], TITLE_LIMIT),
    summary: clamp(superleadMatch?.[1], SUPERLEAD_LIMIT),
    content: clamp(fullnewsMatch?.[1], CONTENT_LIMIT)
  };
};

const parseAnthropicResponse = (rawText) => {
  const result = {
    title: { te: '', hi: '', en: '' },
    summary: { te: '', hi: '', en: '' },
    content: { te: '', hi: '', en: '' }
  };

  for (const [sectionName, langCode] of Object.entries(LANG_SECTIONS)) {
    const regex = new RegExp(`===${sectionName}===\\s*([\\s\\S]*?)(?====|$)`, 'i');
    const match = rawText.match(regex);
    if (!match) continue;

    const parsed = parseSectionBlock(match[1]);
    result.title[langCode] = parsed.title;
    result.summary[langCode] = parsed.summary;
    result.content[langCode] = parsed.content;
  }

  const hasAnyContent = ['te', 'hi', 'en'].some(
    (lang) => result.title[lang] || result.summary[lang] || result.content[lang]
  );
  if (!hasAnyContent) {
    throw new Error('Failed to parse translation response from AI');
  }

  return result;
};

const buildArticleText = ({ title, summary, content, sourceLang = 'te' }) => {
  const parts = [];
  const t = title?.[sourceLang]?.trim();
  const s = summary?.[sourceLang]?.trim();
  const c = content?.[sourceLang]?.trim();

  if (t) parts.push(t);
  if (s) parts.push(s);
  if (c) parts.push(c);

  return parts.join('\n\n');
};

const resolveSourceLang = (title, summary, content, preferredLang = 'te') => {
  const fields = [title, summary, content];
  if (fields.some((f) => f?.[preferredLang]?.trim())) return preferredLang;

  for (const lang of ['te', 'hi', 'en']) {
    if (fields.some((f) => f?.[lang]?.trim())) return lang;
  }
  return preferredLang;
};

async function translateArticleWithAnthropic({ title, summary, content, sourceLang = 'te' }) {
  const resolvedSourceLang = resolveSourceLang(title, summary, content, sourceLang);
  const articleText = buildArticleText({
    title,
    summary,
    content,
    sourceLang: resolvedSourceLang
  });

  if (!articleText.trim()) {
    throw new Error('Please provide article content in at least one language');
  }

  const client = getAnthropic();
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

  const message = await client.messages.create({
    model,
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: buildPrompt(articleText)
      }
    ]
  });

  const rawText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  const parsed = parseAnthropicResponse(rawText);

  return {
    ...parsed,
    sourceLang: resolvedSourceLang
  };
}

module.exports = {
  TITLE_LIMIT,
  SUPERLEAD_LIMIT,
  CONTENT_LIMIT,
  buildArticleText,
  parseAnthropicResponse,
  translateArticleWithAnthropic
};
