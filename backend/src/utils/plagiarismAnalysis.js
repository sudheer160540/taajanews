const Anthropic = require('@anthropic-ai/sdk');
const {
  geminiGenerateText,
  openaiGenerateText,
  getTranslateProvider
} = require('./translateService');

const MAX_COMPARE_CHARS = 8000;

const PLAGIARISM_SYSTEM_PROMPT =
  'You are a Plagiarism Analysis Engine. Compare the given original source text and the rewritten text. ' +
  'Calculate the exact lexical and phrase match percentage between them. ' +
  'Strict Rule: Return ONLY the raw match percentage number (from 0 to 100) without any extra words, ' +
  'symbols, explanations, or JSON formatting.';

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

async function anthropicGenerateText(systemContent, userContent, { temperature = 0, maxTokens = 16 } = {}) {
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
    .join('')
    .trim();
}

const createGenerator = () => {
  const configured = getTranslateProvider();

  if (configured === 'gemini') {
    return (system, user, options = {}) =>
      geminiGenerateText(system, user, {
        temperature: options.temperature ?? 0,
        maxOutputTokens: options.maxTokens ?? 16
      });
  }

  if (configured === 'openai' || configured === 'sarvam') {
    return (system, user, options = {}) =>
      openaiGenerateText(system, user, {
        temperature: options.temperature ?? 0,
        maxTokens: options.maxTokens ?? 16
      });
  }

  return (system, user, options = {}) =>
    anthropicGenerateText(system, user, {
      temperature: options.temperature ?? 0,
      maxTokens: options.maxTokens ?? 16
    });
};

/**
 * Parse a model response down to a 0–100 integer. Accepts bare numbers or
 * responses that accidentally include extra characters.
 */
const parsePlagiarismScore = (rawText) => {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return null;

  const direct = trimmed.match(/^(\d{1,3})(?:\.\d+)?$/);
  if (direct) {
    return Math.min(100, Math.max(0, Math.round(Number(direct[1]))));
  }

  const embedded = trimmed.match(/\b(\d{1,3})\b/);
  if (!embedded) return null;

  return Math.min(100, Math.max(0, Math.round(Number(embedded[1]))));
};

/**
 * Lightweight lexical overlap fallback when the AI provider fails.
 */
const calculateLexicalMatchPercentage = (originalText, rewrittenText) => {
  const tokenize = (text) =>
    String(text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2);

  const originalTokens = tokenize(originalText);
  const rewrittenTokens = new Set(tokenize(rewrittenText));
  if (originalTokens.length === 0 || rewrittenTokens.size === 0) return null;

  let matches = 0;
  for (const token of originalTokens) {
    if (rewrittenTokens.has(token)) matches += 1;
  }

  return Math.min(100, Math.max(0, Math.round((matches / originalTokens.length) * 100)));
};

const buildComparisonPrompt = (originalText, rewrittenText) =>
  `Original Text:\n${originalText.slice(0, MAX_COMPARE_CHARS)}\n\n` +
  `Rewritten Text:\n${rewrittenText.slice(0, MAX_COMPARE_CHARS)}\n\n` +
  'Return ONLY the raw match percentage number from 0 to 100.';

/**
 * Compare original scraped/ source text with the AI-rewritten story and return
 * the lexical + phrase match percentage (0 = fully rewritten, 100 = identical).
 */
async function calculatePlagiarismMatchPercentage(originalText, rewrittenText) {
  const original = String(originalText || '').trim();
  const rewritten = String(rewrittenText || '').trim();
  if (!original || !rewritten) return null;

  const generate = createGenerator();

  try {
    const raw = await generate(
      PLAGIARISM_SYSTEM_PROMPT,
      buildComparisonPrompt(original, rewritten),
      { temperature: 0, maxTokens: 16 }
    );
    const parsed = parsePlagiarismScore(raw);
    if (parsed !== null) return parsed;
    console.warn('[plagiarism] Could not parse AI score, using lexical fallback. Raw:', raw);
  } catch (err) {
    console.error('[plagiarism] AI analysis failed, using lexical fallback:', err.message);
  }

  return calculateLexicalMatchPercentage(original, rewritten);
}

module.exports = {
  calculatePlagiarismMatchPercentage,
  parsePlagiarismScore,
  calculateLexicalMatchPercentage
};
