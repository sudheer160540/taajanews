const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { protect } = require('../middleware/auth');
const { audioContainerClient } = require('../config/azure');
const {
  SUPPORTED_LANGUAGES,
  chunkText,
  twoStepTranslateField
} = require('../utils/translateService');

const SARVAM_LANG_CODES = {
  te: 'te-IN',
  en: 'en-IN',
  hi: 'hi-IN'
};

const SARVAM_API_URL = 'https://api.sarvam.ai';
const SARVAM_TTS_LIMIT = 2500;

async function generateTTSForLanguage(text, langCode) {
  if (!text || !text.trim()) return null;

  const chunks = chunkText(text, SARVAM_TTS_LIMIT);
  const audioBuffers = [];

  for (const chunk of chunks) {
    if (!chunk || !chunk.trim()) continue;

    const { data } = await axios.post(`${SARVAM_API_URL}/text-to-speech`, {
      text: chunk,
      target_language_code: SARVAM_LANG_CODES[langCode],
      speaker: 'priya',
      model: 'bulbul:v3'
    }, {
      headers: { 'api-subscription-key': process.env.SARVAM_API_KEY }
    });

    if (data.audios && data.audios[0]) {
      audioBuffers.push(Buffer.from(data.audios[0], 'base64'));
    }
  }

  if (audioBuffers.length === 0) return null;

  const combined = Buffer.concat(audioBuffers);

  const blobName = `${Date.now()}-${uuidv4()}-${langCode}.wav`;
  const blockBlobClient = audioContainerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(combined, {
    blobHTTPHeaders: { blobContentType: 'audio/wav' }
  });

  const audioContainer = process.env.AZURE_STORAGE_AUDIO_CONTAINER || 'audio';
  return `${process.env.AZURE_STORAGE_URL}/${audioContainer}/${blobName}`;
}

router.post('/', protect, async (req, res) => {
  try {
    const { title, summary, content, generateAudio } = req.body;

    if (!title && !summary && !content) {
      return res.status(400).json({ error: 'At least one field (title, summary, or content) is required' });
    }

    const allLangs = Object.keys(SUPPORTED_LANGUAGES);

    const getFilledLangs = (obj) => {
      if (!obj) return {};
      const filled = {};
      for (const [lang, text] of Object.entries(obj)) {
        if (text && text.trim()) filled[lang] = text.trim();
      }
      return filled;
    };

    const filledTitle = getFilledLangs(title);
    const filledSummary = getFilledLangs(summary);
    const filledContent = getFilledLangs(content);

    if (!Object.keys(filledTitle).length && !Object.keys(filledSummary).length && !Object.keys(filledContent).length) {
      return res.status(400).json({ error: 'Please provide content in at least one language to translate' });
    }

    const result = {};

    const translateMultilingual = async (filled, fieldName) => {
      if (!Object.keys(filled).length) return;

      const sourceLang = Object.keys(filled)[0];
      const sourceText = filled[sourceLang];

      const translated = await twoStepTranslateField(sourceText, sourceLang, allLangs);

      result[fieldName] = {};
      for (const lang of allLangs) {
        result[fieldName][lang] = filled[lang] || translated[lang] || '';
      }
    };

    await translateMultilingual(filledTitle, 'title');
    await translateMultilingual(filledSummary, 'summary');
    await translateMultilingual(filledContent, 'content');

    if (generateAudio && result.content) {
      const audio = {};

      for (const lang of allLangs) {
        const text = result.content[lang];
        if (!text) continue;

        try {
          const url = await generateTTSForLanguage(text, lang);
          if (url) audio[lang] = url;
        } catch (ttsErr) {
          console.error(`TTS failed for ${lang}:`, ttsErr.message, ttsErr.response?.data || '');
        }
      }

      if (Object.keys(audio).length > 0) {
        result.audio = audio;
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Translation error:', error?.response?.data || error.message || error);

    if (error?.status === 401 || error?.code === 'invalid_api_key') {
      return res.status(500).json({ error: 'Invalid API key configuration' });
    }
    if (error?.status === 429 || error?.response?.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    res.status(500).json({ error: 'Translation failed. Please try again.' });
  }
});

module.exports = router;
