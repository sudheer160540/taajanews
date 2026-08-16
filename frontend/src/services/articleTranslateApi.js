import api from './api';

/**
 * Article translation + audio endpoints.
 *
 * Translation runs on the engine chosen by the backend's TRANSLATE_TYPE
 * (Gemini, OpenAI, or Anthropic). Text-to-speech always runs on Sarvam.
 */
export const articleTranslateApi = {
  /**
   * Translate an already written title, summary, and content into Telugu, Hindi,
   * and English. Each field is translated faithfully, so the headline keeps the
   * same meaning in every language.
   */
  translateFields: ({ title, summary, content, sourceLang = 'te' }) =>
    api.post('/articles/translate-all', { title, summary, content, sourceLang }),

  /**
   * Send raw article text in one language and let the AI decide the headline,
   * superlead, and full story before translating all three into every language.
   */
  generateFromText: ({ text, sourceLang = 'te' }) =>
    api.post('/articles/generate-translate', { text, sourceLang }),

  /**
   * Convert the article summary to speech with Sarvam. Only the languages that
   * already have a summary are converted.
   */
  convertAudio: ({ summary }) => api.post('/articles/convert-audio', { summary })
};

export default articleTranslateApi;
