
import dotenv from 'dotenv';

dotenv.config();
interface Config {
  PORT: number;
  MODEL_PROVIDER: 'ollama' | 'openai' | 'gemini';
  MODEL_NAME: string;
  EMBEDDING_PROVIDER: 'ollama' | 'openai';
  EMBEDDING_MODEL: string;
  OPENAI_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  GEMINI_API_KEY?: string;
  X_API_KEY_1?: string
}
const config: Config = {
  PORT: Number(process.env.PORT) || 3000,
  MODEL_PROVIDER: (process.env.USE_OLLAMA as 'ollama' | 'openai' | 'gemini') || 'gemini',
  MODEL_NAME: process.env.MODEL_NAME || 'qwen2.5:7b-instruct',
  EMBEDDING_PROVIDER: (process.env.EMBEDDING_PROVIDER as 'ollama' | 'openai') || 'ollama',
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  X_API_KEY_1: process.env.X_API_KEY_1 || ''
}
export default config;
