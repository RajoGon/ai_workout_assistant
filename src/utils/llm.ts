import { Ollama } from "ollama";
import OpenAI from "openai";
import { prisma } from "../..";
import { GoogleGenAI } from "@google/genai";

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
const config: LLMConfig = {
  MODEL_PROVIDER: (process.env.USE_OLLAMA as 'ollama' | 'openai' | 'gemini') || 'gemini',
  MODEL_NAME: process.env.MODEL_NAME || 'qwen2.5:7b-instruct',
  EMBEDDING_PROVIDER: (process.env.EMBEDDING_PROVIDER as 'ollama' | 'openai') || 'ollama',
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  GEMINI_API_KEY : process.env.GEMINI_API_KEY || ''
};

// Initialize LLM instances
let ollamaInstance: Ollama | null = null;
let openaiInstance: OpenAI | null = null;
let geminiInstance : GoogleGenAI | null = null;

if (config.MODEL_PROVIDER === 'ollama' || config.EMBEDDING_PROVIDER === 'ollama') {
  ollamaInstance = new Ollama({
    host: config.OLLAMA_BASE_URL,
  });
}

if (config.MODEL_PROVIDER === 'openai' || config.EMBEDDING_PROVIDER === 'openai') {
  if (!config.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required when using OpenAI provider');
  }
  openaiInstance = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
  });
}

if (config.MODEL_PROVIDER === 'gemini') {
  const geminiConfig = {apiKey: "AIzaSyAhZCVHAH1zYr5Y2jSHJnLwVQAdbTURtKU"}
  console.log('Gemini api', geminiConfig)
  geminiInstance = new GoogleGenAI(geminiConfig);
}
// LLM Model instance
export const llmModel = (() => {
  console.log('Using ', config.MODEL_PROVIDER)
  switch (config.MODEL_PROVIDER) {
    case 'ollama':
      if (!ollamaInstance) {
        throw new Error('Ollama instance not initialized');
      }
      return {
        provider: 'ollama' as const,
        instance: ollamaInstance,
        modelName: config.MODEL_NAME,
        async generate(prompt: string, options?: any) {
          console.log('Prompting ollama', this.modelName, config.MODEL_NAME)
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
            model: config.MODEL_NAME,
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
        modelName: config.MODEL_NAME,
        async generate(prompt: string, options?: any) {
          const response = await openaiInstance!.completions.create({
            model: config.MODEL_NAME,
            prompt,
            max_tokens: 1000,
            ...options,
          });
          return response.choices[0]?.text || '';
        },
        async chat(messages: any[], options?: any) {
          const response = await openaiInstance!.chat.completions.create({
            model: config.MODEL_NAME,
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
        modelName: config.MODEL_NAME,

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
          const checkRole = (message: { role: string; })=>{
            let role=''
          if(messages.length>1){
            role=(message.role === 'user')? 'user': 'model'
          }
          return role;
          }
          
          messages = messages.map((messaage)=>{
            return { 
              role: checkRole(messaage),
              parts: [{text:messaage.content}]
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
      throw new Error(`Unsupported model provider: ${config.MODEL_PROVIDER}`);
  }
})();

// Embedding instance
export const embedder = (() => {
  switch (config.EMBEDDING_PROVIDER) {
    case 'ollama':
      if (!ollamaInstance) {
        throw new Error('Ollama instance not initialized');
      }
      return {
        provider: 'ollama' as const,
        modelName: config.EMBEDDING_MODEL,
        async embed(text: string | string[]) {
          if (Array.isArray(text)) {
            const embeddings = await Promise.all(
              text.map(async (t) => {
                const response = await ollamaInstance!.embeddings({
                  model: config.EMBEDDING_MODEL,
                  prompt: t,
                });
                return response.embedding;
              })
            );
            return embeddings;
          } else {
            const response = await ollamaInstance!.embeddings({
              model: config.EMBEDDING_MODEL,
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
        modelName: config.EMBEDDING_MODEL,
        async embed(text: string | string[]) {
          const input = Array.isArray(text) ? text : [text];
          const response = await openaiInstance!.embeddings.create({
            model: config.EMBEDDING_MODEL,
            input,
          });

          const embeddings = response.data.map(item => item.embedding);
          return Array.isArray(text) ? embeddings : embeddings[0];
        },
      };

    default:
      throw new Error(`Unsupported embedding provider: ${config.EMBEDDING_PROVIDER}`);
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
}: VectorSearchOptions): Promise<T[]| null> {
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
  if(!results){
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
export { config as llmConfig };

// Type exports
export type LLMProvider = 'ollama' | 'openai';
export type EmbeddingProvider = 'ollama' | 'openai';
