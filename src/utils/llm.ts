import { Ollama } from "ollama";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "../lib/prisma";
import config from "../config/config";



const provider = process.env.LLM_PROVIDER || 'ollama';
const USE_OLLAMA = process.env.USE_OLLAMA === 'true' || process.env.USE_OLLAMA === undefined;
// Environment configuration interface
interface LLMConfig {
  MODEL_PROVIDER: 'ollama' | 'openai' | 'gemini';
  MODEL_NAME: string;
  EMBEDDING_PROVIDER: 'ollama' | 'openai';
  EMBEDDING_MODEL: string;
  OPENAI_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  GEMINI_API_KEY?: string;
}
// Load environment configuration
const llmConfig: LLMConfig = {
  MODEL_PROVIDER: config.MODEL_PROVIDER,
  MODEL_NAME: config.MODEL_NAME,
  EMBEDDING_PROVIDER: config.EMBEDDING_PROVIDER,
  EMBEDDING_MODEL: config.EMBEDDING_MODEL,
  OPENAI_API_KEY: config.OPENAI_API_KEY,
  OLLAMA_BASE_URL: config.OLLAMA_BASE_URL,
  GEMINI_API_KEY: config.GEMINI_API_KEY
};

// Initialize LLM instances
let ollamaInstance: Ollama | null = null;
let openaiInstance: OpenAI | null = null;
let geminiInstance: GoogleGenAI | null = null;

if (llmConfig.MODEL_PROVIDER === 'ollama' || llmConfig.EMBEDDING_PROVIDER === 'ollama') {
  ollamaInstance = new Ollama({
    host: llmConfig.OLLAMA_BASE_URL,
  });
}

if (llmConfig.MODEL_PROVIDER === 'openai' || llmConfig.EMBEDDING_PROVIDER === 'openai') {
  if (!llmConfig.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required when using OpenAI provider');
  }
  openaiInstance = new OpenAI({
    apiKey: llmConfig.OPENAI_API_KEY,
  });
}

if (llmConfig.MODEL_PROVIDER === 'gemini') {
  const geminiConfig = { apiKey: llmConfig.GEMINI_API_KEY }
  console.log('Gemini api', geminiConfig)
  geminiInstance = new GoogleGenAI(geminiConfig);
}
// LLM Model instance
export const llmModel = (() => {
  console.log('Using ', llmConfig.MODEL_PROVIDER)
  switch (llmConfig.MODEL_PROVIDER) {
    case 'ollama':
      if (!ollamaInstance) {
        throw new Error('Ollama instance not initialized');
      }
      return {
        provider: 'ollama' as const,
        instance: ollamaInstance,
        modelName: llmConfig.MODEL_NAME,
        async generate(prompt: string, options?: any) {
          console.log('Prompting ollama', this.modelName, llmConfig.MODEL_NAME)
          const response: any = await ollamaInstance!.generate({
            model: this.modelName,
            prompt,
            stream: false,
            ...options,
          });

          console.log('Response ollama', typeof response)
          return response.response;
        },
        async chat(messages: any[], options?: any) {
          const response: any = await ollamaInstance!.chat({
            model: llmConfig.MODEL_NAME,
            messages,
            stream: false,
            ...options,
          });
          return response.message.content;
        },
      };

    case 'openai':
      if (!openaiInstance) {
        throw new Error('OpenAI instance not initialized');
      }
      return {
        provider: 'openai' as const,
        instance: openaiInstance,
        modelName: llmConfig.MODEL_NAME,
        async generate(prompt: string, options?: any) {
          const response = await openaiInstance!.completions.create({
            model: llmConfig.MODEL_NAME,
            prompt,
            max_tokens: 1000,
            ...options,
          });
          return response.choices[0]?.text || '';
        },
        async chat(messages: any[], options?: any) {
          const response = await openaiInstance!.chat.completions.create({
            model: llmConfig.MODEL_NAME,
            messages,
            max_tokens: 1000,
            ...options,
          });
          return response.choices[0]?.message.content || '';
        },
      };
    case 'gemini':
      if (!geminiInstance) {
        throw new Error('Gemini instance not initialized');
      }
      return {
        provider: 'gemini' as const,
        instance: geminiInstance,
        modelName: llmConfig.MODEL_NAME,

        async generate(prompt: string, options?: any) {
          console.log('Prompting gemini', "gemini-2.5-flash", prompt)
          const response = await geminiInstance.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              thinkingConfig: {
                thinkingBudget: 0, // Disables thinking
              },
            }
          });
          return response.text || null;
        },
        async chat(messages: any[], options?: any) {
          const checkRole = (message: { role: string; }) => {
            let role = ''
            if (messages.length > 1) {
              role = (message.role === 'user') ? 'user' : 'model'
            }
            return role;
          }

          messages = messages.map((messaage) => {
            return {
              role: checkRole(messaage),
              parts: [{ text: messaage.content }]
            }
          })
          console.log('Prompting gemini', "gemini-2.5-flash", JSON.stringify(messages))

          const response = await geminiInstance.models.generateContent({
            model: "gemini-2.5-flash",
            contents: messages,
            config: {
              thinkingConfig: {
                thinkingBudget: 0, // Disables thinking
              },
            }
          });
          return response.text || null;
        },
      };
    default:
      throw new Error(`Unsupported model provider: ${llmConfig.MODEL_PROVIDER}`);
  }
})();

// Embedding instance
export const embedder = (() => {
  switch (llmConfig.EMBEDDING_PROVIDER) {
    case 'ollama':
      if (!ollamaInstance) {
        throw new Error('Ollama instance not initialized');
      }
      return {
        provider: 'ollama' as const,
        modelName: llmConfig.EMBEDDING_MODEL,
        async embed(text: string | string[]) {
          if (Array.isArray(text)) {
            const embeddings = await Promise.all(
              text.map(async (t) => {
                const response = await ollamaInstance!.embeddings({
                  model: llmConfig.EMBEDDING_MODEL,
                  prompt: t,
                });
                return response.embedding;
              })
            );
            return embeddings;
          } else {
            const response = await ollamaInstance!.embeddings({
              model: llmConfig.EMBEDDING_MODEL,
              prompt: text,
            });
            return response.embedding;
          }
        },
      };

    case 'openai':
      if (!openaiInstance) {
        throw new Error('OpenAI instance not initialized');
      }
      return {
        provider: 'openai' as const,
        modelName: llmConfig.EMBEDDING_MODEL,
        async embed(text: string | string[]) {
          const input = Array.isArray(text) ? text : [text];
          const response = await openaiInstance!.embeddings.create({
            model: llmConfig.EMBEDDING_MODEL,
            input,
          });

          const embeddings = response.data.map(item => item.embedding);
          return Array.isArray(text) ? embeddings : embeddings[0];
        },
      };

    default:
      throw new Error(`Unsupported embedding provider: ${llmConfig.EMBEDDING_PROVIDER}`);
  }
})();
// Vector search function
interface VectorSearchOptions {
  table: string;
  embeddingColumn: string;
  contentColumn?: string;
  queryEmbedding: number[];
  limit?: number;
  threshold?: number;
  additionalColumns?: string[];
  userId: string
}
export async function vectorSearch<T = any>({
  table,
  embeddingColumn,
  contentColumn = 'content',
  queryEmbedding,
  limit = 5,
  threshold,
  additionalColumns = [],
  userId = ''
}: VectorSearchOptions): Promise<T[] | null> {
  //  const embeddingString = `[${queryEmbedding.join(', ')}]`;
  if (Array.isArray(queryEmbedding)) {
    queryEmbedding = `[${queryEmbedding.join(', ')}]` as any;
  }

  // Build the SELECT clause
  const selectColumns = [contentColumn, ...additionalColumns];
  const selectClause = selectColumns.join(', ');

  // Build the query with optional threshold
  let whereClause = '';
  if (threshold !== undefined) {
    whereClause = `WHERE ${embeddingColumn} <=> '${queryEmbedding}' < ${threshold}`;
  }
  console.log('Filtering embeddings for user', userId);
  if (userId) {
    whereClause += ` AND "userId" = '${userId}'`;
  }

  const query = `
    SELECT ${selectClause}, (${embeddingColumn} <=> '${queryEmbedding}') as distance
    FROM "${table}"
    ${whereClause}
    ORDER BY ${embeddingColumn} <=> '${queryEmbedding}'
    LIMIT ${limit}
  `;

  const results = await prisma.$queryRawUnsafe<T[]>(query);
  if (!results) {
    return null;
  }
  const resultStringified = results.map((result: any) => {
    return `${result.content}`
  })
  return resultStringified as any;
}
// Helper function to search with text query (automatically generates embedding)
export async function searchWithText(
  text: string,
  options: Omit<VectorSearchOptions, 'queryEmbedding'>
) {
  const embedding = await embedder.embed(text);
  // const queryEmbedding = Array.isArray(embedding) ? embedding[0] : embedding;

  const queryEmbedding = Array.isArray(embedding) ? embedding[0] as Array<any> : embedding;

  return vectorSearch({
    ...options,
    queryEmbedding,
  });
}

export function parseLlmResponseAsJson(response: any) {
  try {
    const simplyParsed = JSON.parse(response.toString());
    console.log('Simple parse', simplyParsed);
    return simplyParsed;
  } catch (e1) {
    console.log('Simple parse failed, trying regex');

    try {
      const regex = /```json\s*([\s\S]*?)\s*```/g;
      const regexParsed = regex.exec(response);

      console.log('Regex parser result', regexParsed);

      if (regexParsed && regexParsed[1]) {
        return JSON.parse(regexParsed[1]); // Use the capture group, not full match
      } else {
        console.log('Regex did not match or extract JSON');
        throw new Error('Cannot parse via regex');
      }
    } catch (e2) {
      throw new Error('Cannot parse this Json');

    }
  }
}

// Export configuration for reference
export { llmConfig };

// Type exports
export type LLMProvider = 'ollama' | 'openai';
export type EmbeddingProvider = 'ollama' | 'openai';
