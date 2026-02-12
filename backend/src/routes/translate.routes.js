const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { protect } = require('../middleware/auth');

const openai = new OpenAI({
  apiKey: process.env.OPEN_API_KEY
});

const SUPPORTED_LANGUAGES = {
  te: 'Telugu',
  en: 'English',
  hi: 'Hindi'
};

// @route   POST /api/translate
// @desc    Translate article fields into missing languages using OpenAI
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { title, summary, content } = req.body;

    if (!title && !summary && !content) {
      return res.status(400).json({ error: 'At least one field (title, summary, or content) is required' });
    }

    const allLangs = Object.keys(SUPPORTED_LANGUAGES);

    // Helper: get non-empty entries from a multilingual object
    const getFilledLangs = (obj) => {
      if (!obj) return {};
      const filled = {};
      for (const [lang, text] of Object.entries(obj)) {
        if (text && text.trim()) {
          filled[lang] = text.trim();
        }
      }
      return filled;
    };

    const filledTitle = getFilledLangs(title);
    const filledSummary = getFilledLangs(summary);
    const filledContent = getFilledLangs(content);

    // Check there is at least something to translate
    if (Object.keys(filledTitle).length === 0 && Object.keys(filledSummary).length === 0 && Object.keys(filledContent).length === 0) {
      return res.status(400).json({ error: 'Please provide content in at least one language to translate' });
    }

    // Determine which languages need translation for each field
    const missingTitle = allLangs.filter(l => !filledTitle[l]);
    const missingSummary = allLangs.filter(l => !filledSummary[l]);
    const missingContent = allLangs.filter(l => !filledContent[l]);

    // If nothing needs translating
    if (missingTitle.length === 0 && missingSummary.length === 0 && missingContent.length === 0) {
      return res.json({ title: filledTitle, summary: filledSummary, content: filledContent });
    }

    // Build the prompt
    const inputParts = [];
    const translationInstructions = [];

    if (Object.keys(filledTitle).length > 0) {
      const sourceLang = Object.keys(filledTitle)[0];
      inputParts.push(`TITLE (provided in ${SUPPORTED_LANGUAGES[sourceLang]}):\n${filledTitle[sourceLang]}`);
      if (missingTitle.length > 0) {
        translationInstructions.push(`Translate the TITLE into: ${missingTitle.map(l => SUPPORTED_LANGUAGES[l]).join(', ')}`);
      }
    }

    if (Object.keys(filledSummary).length > 0) {
      const sourceLang = Object.keys(filledSummary)[0];
      inputParts.push(`SUMMARY (provided in ${SUPPORTED_LANGUAGES[sourceLang]}):\n${filledSummary[sourceLang]}`);
      if (missingSummary.length > 0) {
        translationInstructions.push(`Translate the SUMMARY into: ${missingSummary.map(l => SUPPORTED_LANGUAGES[l]).join(', ')}`);
      }
    }

    if (Object.keys(filledContent).length > 0) {
      const sourceLang = Object.keys(filledContent)[0];
      inputParts.push(`CONTENT (provided in ${SUPPORTED_LANGUAGES[sourceLang]}):\n${filledContent[sourceLang]}`);
      if (missingContent.length > 0) {
        translationInstructions.push(`Translate the CONTENT into: ${missingContent.map(l => SUPPORTED_LANGUAGES[l]).join(', ')}`);
      }
    }

    const prompt = `You are a professional news article translator. Translate the following news article fields accurately while preserving the original meaning, tone, and formatting (paragraphs, line breaks).

${inputParts.join('\n\n')}

Instructions:
${translationInstructions.join('\n')}

IMPORTANT:
- Do NOT re-translate content that is already provided. Keep the original text exactly as-is.
- Translate naturally as a native speaker would write a news article in each target language.
- Preserve all formatting including paragraphs and line breaks.
- Return ONLY valid JSON, no markdown, no code fences, no extra text.

Return the result as JSON in this exact format (include ALL three languages for each field that has content, using the original text for the source language and translations for the others):
{
  ${Object.keys(filledTitle).length > 0 ? '"title": { "te": "...", "en": "...", "hi": "..." },' : ''}
  ${Object.keys(filledSummary).length > 0 ? '"summary": { "te": "...", "en": "...", "hi": "..." },' : ''}
  ${Object.keys(filledContent).length > 0 ? '"content": { "te": "...", "en": "...", "hi": "..." }' : ''}
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional multilingual news translator. You output only valid JSON. No markdown formatting, no code blocks, just raw JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });

    const responseText = completion.choices[0]?.message?.content?.trim();

    if (!responseText) {
      return res.status(500).json({ error: 'Empty response from translation service' });
    }

    // Parse the JSON response (strip any accidental markdown fences)
    let translated;
    try {
      const cleanJson = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      translated = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', responseText);
      return res.status(500).json({ error: 'Failed to parse translation response' });
    }

    // Build final result: merge original input with translations
    const result = {};

    if (Object.keys(filledTitle).length > 0) {
      result.title = {};
      for (const lang of allLangs) {
        result.title[lang] = filledTitle[lang] || translated.title?.[lang] || '';
      }
    }

    if (Object.keys(filledSummary).length > 0) {
      result.summary = {};
      for (const lang of allLangs) {
        result.summary[lang] = filledSummary[lang] || translated.summary?.[lang] || '';
      }
    }

    if (Object.keys(filledContent).length > 0) {
      result.content = {};
      for (const lang of allLangs) {
        result.content[lang] = filledContent[lang] || translated.content?.[lang] || '';
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Translation error:', error);

    if (error?.status === 401 || error?.code === 'invalid_api_key') {
      return res.status(500).json({ error: 'Invalid OpenAI API key configuration' });
    }
    if (error?.status === 429) {
      return res.status(429).json({ error: 'Translation rate limit exceeded. Please try again later.' });
    }

    res.status(500).json({ error: 'Translation failed. Please try again.' });
  }
});

module.exports = router;
