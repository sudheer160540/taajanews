const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { audioContainerClient } = require('../config/azure');
const { chunkText } = require('./translateService');

/**
 * Text-to-speech always runs on Sarvam. Gemini/OpenAI/Anthropic handle text
 * translation only.
 */
const SARVAM_API_URL = 'https://api.sarvam.ai';
const SARVAM_TTS_LIMIT = 2500;

const SARVAM_LANG_CODES = {
  te: 'te-IN',
  en: 'en-IN',
  hi: 'hi-IN'
};

const AUDIO_LANGS = Object.keys(SARVAM_LANG_CODES);

/** Language codes that actually have text to speak. */
const getFilledAudioLanguages = (textMap) =>
  AUDIO_LANGS.filter((lang) => String(textMap?.[lang] || '').trim());

/**
 * Convert one language's text to speech and upload the WAV to Azure.
 * Returns the public blob URL, or null when Sarvam produced no audio.
 */
async function generateSpeechForLanguage(text, langCode) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  if (!SARVAM_LANG_CODES[langCode]) {
    throw new Error(`Unsupported audio language: ${langCode}`);
  }
  if (!process.env.SARVAM_API_KEY) {
    throw new Error('SARVAM_API_KEY is not configured');
  }

  const chunks = chunkText(trimmed, SARVAM_TTS_LIMIT);
  const audioBuffers = [];

  for (const chunk of chunks) {
    if (!chunk || !chunk.trim()) continue;

    const { data } = await axios.post(
      `${SARVAM_API_URL}/text-to-speech`,
      {
        text: chunk,
        target_language_code: SARVAM_LANG_CODES[langCode],
        speaker: 'priya',
        model: 'bulbul:v3'
      },
      {
        headers: { 'api-subscription-key': process.env.SARVAM_API_KEY },
        timeout: 60000
      }
    );

    if (data.audios && data.audios[0]) {
      audioBuffers.push(Buffer.from(data.audios[0], 'base64'));
    }
  }

  if (audioBuffers.length === 0) return null;

  const blobName = `${Date.now()}-${uuidv4()}-${langCode}.wav`;
  const blockBlobClient = audioContainerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(Buffer.concat(audioBuffers), {
    blobHTTPHeaders: { blobContentType: 'audio/wav' }
  });

  const audioContainer = process.env.AZURE_STORAGE_AUDIO_CONTAINER || 'audio';
  return `${process.env.AZURE_STORAGE_URL}/${audioContainer}/${blobName}`;
}

/**
 * Generate audio for every language that has text. A failure in one language
 * never aborts the others; failed codes come back in `failed`.
 */
async function generateAudioForLanguages(textMap) {
  const langs = getFilledAudioLanguages(textMap);
  const audio = {};
  const failed = [];

  for (const lang of langs) {
    try {
      const url = await generateSpeechForLanguage(textMap[lang], lang);
      if (url) audio[lang] = url;
      else failed.push(lang);
    } catch (err) {
      failed.push(lang);
      console.error(`[audio] Sarvam TTS failed for ${lang}:`, err.message, err.response?.data || '');
    }
  }

  return { audio, failed, requested: langs };
}

module.exports = {
  SARVAM_LANG_CODES,
  AUDIO_LANGS,
  getFilledAudioLanguages,
  generateSpeechForLanguage,
  generateAudioForLanguages
};
