import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';

// ---------------------------------------------------------------------------
// ai.js — Configurable AI Provider Factory
//
// The rest of the application never imports a provider directly.
// They call getChatModel() and receive a LangChain-compatible chat model.
//
// To switch providers: change AI_PROVIDER in .env.
// No workflow logic needs to change.
// ---------------------------------------------------------------------------

/**
 * Returns a configured LangChain chat model based on the AI_PROVIDER env var.
 *
 * Supported providers:
 *   - "google"  → Google Gemini (default, free tier available)
 *   - "openai"  → OpenAI GPT
 *
 * Temperature is set to 0 for classification tasks (deterministic output).
 * For response generation, callers can override via options.
 *
 * @param {object} options
 * @param {number} [options.temperature=0] - Controls output randomness (0 = deterministic)
 * @returns {import('@langchain/core/language_models/chat_models').BaseChatModel}
 */
export function getChatModel(options = {}) {
  const provider = process.env.AI_PROVIDER || 'google';
  const temperature = options.temperature ?? 0;

  if (provider === 'google') {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY is not set in environment variables');
    }
    return new ChatGoogleGenerativeAI({
      model: process.env.GOOGLE_CHAT_MODEL || 'gemini-2.0-flash',
      apiKey: process.env.GOOGLE_API_KEY,
      temperature,
    });
  }

  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    return new ChatOpenAI({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY,
      temperature,
    });
  }

  throw new Error(
    `Unsupported AI_PROVIDER: "${provider}". Valid options are "google" or "openai".`
  );
}
