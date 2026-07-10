const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { protect, reporterOrAdmin } = require('../middleware/auth');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TITLE_LIMIT = 200;
const SUPERLEAD_LIMIT = 500;
const CONTENT_LIMIT = 10000;

function emptySegments() {
  return { heading: '', superlead: '', fullNews: '' };
}

function parseSegments(block) {
  const heading = block.match(/HEADING:\s*([\s\S]*?)\s*(?:SUPERLEAD:|$)/)?.[1] ?? '';
  const superlead = block.match(/SUPERLEAD:\s*([\s\S]*?)\s*(?:FULLNEWS:|$)/)?.[1] ?? '';
  const fullNews = block.match(/FULLNEWS:\s*([\s\S]*)$/)?.[1] ?? '';
  return {
    heading: heading.trim().slice(0, TITLE_LIMIT),
    superlead: superlead.trim().slice(0, SUPERLEAD_LIMIT),
    fullNews: fullNews.trim().slice(0, CONTENT_LIMIT)
  };
}

// ponytail: parsed from plain-text delimiters rather than a JSON response —
// Claude follows the format reliably enough for this; revisit with tool-use
// structured output if parsing ever proves flaky in practice.
function parseLanguages(raw) {
  const teBlock = raw.match(/===TELUGU===\s*([\s\S]*?)\s*(?:===HINDI===|$)/)?.[1] ?? '';
  const hiBlock = raw.match(/===HINDI===\s*([\s\S]*?)\s*(?:===ENGLISH===|$)/)?.[1] ?? '';
  const enBlock = raw.match(/===ENGLISH===\s*([\s\S]*)$/)?.[1] ?? '';

  if (!teBlock && !hiBlock && !enBlock) {
    return { te: { heading: '', superlead: '', fullNews: raw.trim() }, hi: emptySegments(), en: emptySegments() };
  }

  return {
    te: teBlock ? parseSegments(teBlock) : emptySegments(),
    hi: hiBlock ? parseSegments(hiBlock) : emptySegments(),
    en: enBlock ? parseSegments(enBlock) : emptySegments()
  };
}

// @route   POST /api/paraphrase
// @desc    Paraphrase a pasted news article into TE/HI/EN heading + superlead + full story via Claude
// @access  Private/Reporter
router.post('/', protect, reporterOrAdmin, async (req, res) => {
  const text = req.body?.text?.trim();
  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    const message = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 20000,
      messages: [{
        role: 'user',
        content: `You are paraphrasing a news article for a newspaper that publishes in Telugu, Hindi, and English. For each of the three languages, produce three parts:
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
${text}`
      }]
    });

    const raw = message.content[0]?.text ?? '';
    res.json({ paraphrased: parseLanguages(raw) });
  } catch (err) {
    console.error('Paraphrase error:', err?.response?.data || err.message || err);
    res.status(502).json({ error: 'Failed to paraphrase text' });
  }
});

module.exports = router;
