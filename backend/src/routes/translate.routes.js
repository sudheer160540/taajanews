const express = require('express');
const router = express.Router();
const axios = require('axios');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const { protect } = require('../middleware/auth');
const { containerClient } = require('../config/azure');

const openai = new OpenAI({
  apiKey: process.env.OPEN_API_KEY
});

const SUPPORTED_LANGUAGES = {
  te: 'Telugu',
  en: 'English',
  hi: 'Hindi'
};

const SARVAM_LANG_CODES = {
  te: 'te-IN',
  en: 'en-IN',
  hi: 'hi-IN'
};

const SARVAM_API_URL = 'https://api.sarvam.ai';
const SARVAM_TRANSLATE_LIMIT = 1000;
const SARVAM_TTS_LIMIT = 2500;

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

async function openaiTranslate(text, targetLangName) {
  if (!text || !text.trim()) return '';

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a professional translator. Translate the given text accurately while preserving meaning, tone, and formatting. Return ONLY the translated text, nothing else.'
      },
      {
        role: 'user',
        content: `Translate the following text to ${targetLangName}:\n\n${text}`
      }
    ],
    temperature: 0.3
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}

async function translateField(text, sourceLang, targetLang) {
  const useSarvam = process.env.TRANSLATE_TYPE === 'sarvam';

  if (useSarvam) {
    return sarvamTranslate(text, sourceLang, targetLang);
  }
  return openaiTranslate(text, SUPPORTED_LANGUAGES[targetLang]);
}

async function twoStepTranslateField(text, sourceLang, allLangs) {
  const result = {};
  result[sourceLang] = text;

  const targetLangs = allLangs.filter(l => l !== sourceLang);

  if (sourceLang !== 'en') {
    const englishText = await translateField(text, sourceLang, 'en');
    result['en'] = englishText;

    const otherLangs = targetLangs.filter(l => l !== 'en');
    for (const lang of otherLangs) {
      result[lang] = await translateField(englishText, 'en', lang);
    }
  } else {
    for (const lang of targetLangs) {
      result[lang] = await translateField(text, 'en', lang);
    }
  }

  return result;
}

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

  const blobName = `audio/${Date.now()}-${uuidv4()}-${langCode}.wav`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(combined, {
    blobHTTPHeaders: { blobContentType: 'audio/wav' }
  });

  return `${process.env.AZURE_STORAGE_URL}/${process.env.AZURE_STORAGE_CONTAINER}/${blobName}`;
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
