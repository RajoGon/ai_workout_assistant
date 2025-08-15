export interface IntentHandlerTool {
    execute(intent: any, chatId: string, userId: string): Promise<string>;
}

export interface IIntentHandlerFactory {
    /**
     * Creates and returns a handler for the specified intent type
     * @param intentType - The type of intent to handle (e.g., 'create', 'update')
     * @returns The appropriate intent handler tool
     * @throws Error if the intent type is not supported
     */
    createHandler(intentType: string): IntentHandlerTool;
  
    /**
     * Returns an array of all supported intent types
     * @returns Array of supported intent type strings
     */
    getSupportedIntents(): string[];
  }