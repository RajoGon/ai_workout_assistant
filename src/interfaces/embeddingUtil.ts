export abstract class IEmbeddingUtil{
    /**
     * Search for similar embeddings based on a query
     * @param userId - The user ID to filter results by
     * @param query - The search query string
     * @param limit - Maximum number of results to return (default: 5)
     * @param threshold - Similarity threshold for filtering results (default: 0.8)
     * @returns Promise resolving to search results or null if none found
     */
     static async searchEmbeddings(
      userId: string,
      query: string,
      limit?: number,
      threshold?: number
    ){};
  
    /**
     * Generate an embedding vector from text content
     * @param content - The text content to embed
     * @returns Promise resolving to the embedding vector
     */
    static async generateEmbedding(content: string){};
  
    /**
     * Create and store an embedding in the database
     * @param entityId - The ID of the entity being embedded (e.g., workoutId)
     * @param userId - The user ID associated with this embedding
     * @param content - The text content that was embedded
     * @param embedding - The embedding vector
     * @param metadata - Optional metadata to store with the embedding
     * @returns Promise resolving to the created embedding ID
     */
    static async  createEmbedding(
      entityId: string,
      userId: string,
      content: string,
      embedding: number[],
      metadata?: any
    ){};
  
    /**
     * Generate a text representation from an entity for embedding
     * @param entity - The entity to convert to text
     * @returns The text representation suitable for embedding
     */
    static async  generateEmbeddingText(entity: any){};
  }