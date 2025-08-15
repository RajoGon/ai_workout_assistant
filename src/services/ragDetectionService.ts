
export class RagDetectionService {
    constructor(private llmModel: any) { }

    private readonly RAG_KEYWORDS = [
        'suggest', 'recommend', 'advice', 'based on', 'history', 'past', 'previous',
        'what do you think', 'should i', 'help me choose', 'best time', 'good distance',
        'when should', 'how long', 'analyze', 'look at my', 'considering my'
    ];

    /**
     * Check if user input requires RAG mode during agentic flow
     */
    async shouldUseRagMode(prompt: string): Promise<boolean> {
        const promptLower = prompt.toLowerCase();
        return this.RAG_KEYWORDS.some(keyword => promptLower.includes(keyword));
        // TODO : Add an llm fall back
    }

    /**
   * Check if user is confirming/accepting a RAG suggestion
   */
    async isConfirmingRagSuggestion(prompt: string, userId: string, chatId: string, prisma: any): Promise<boolean> {
        const confirmationKeywords = [
            'yes', 'ok', 'sure', 'sounds good', 'that works', 'perfect', 'great',
            'let\'s do it', 'i agree', 'that\'s good', 'go ahead', 'proceed',
            'book it', 'schedule it', 'let\'s go with that', 'yeah', 'looks good'
        ];

        const promptLower = prompt.toLowerCase();

        // Check for explicit confirmation
        let hasConfirmation = confirmationKeywords.some(keyword =>
            promptLower.includes(keyword)
        );
        // Check if the last assistant message was a suggestion
        const lastMessage = await prisma.chatHistory.findFirst({
            where: {
                userId,
                chatId,
                message: {
                    path: ['role'],
                    equals: 'assistant'
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        if (!lastMessage) return false;
        // Fallback to llm to check for affirmation
        if (!hasConfirmation) {
            hasConfirmation = await this.llmCheckAffirmation(prompt, (lastMessage.message as any).content);
            if (!hasConfirmation) return false;
        }

        // Check if the last message has type 'suggestion'
        return lastMessage.type === 'suggestion';
    }

    /*
    * Checks user affirmation through an llm 
    */
    private async llmCheckAffirmation(prompt: string, suggestion: string): Promise<boolean> {
        const systemPrompt = `
        You are an expert in understanding human emotions and analyze their intention. Here you need to find out 
        if the user is accepting a certain suggestion or rejecting it. Consider spelling mistakes as well for affirmations.
        User was suggested: "${suggestion}"
        They replied: "${prompt}"
        
        Is this an acceptance or affirmation of the suggestion?
        Respond only with: yes or no.
      `;

        const result = await this.llmModel.chat([
            { role: "system", content: systemPrompt }
        ]);

        return result.toLowerCase().includes("yes");
    }

      /**
 * Get context about current intent for RAG prompts
 */
  async getIntentContext(intent: any): Promise<string> {
    const metadata = intent.metadata || {};
    let context = `Intent: ${intent.intentType}\n`;

    if (intent.missingFields && intent.missingFields.length > 0) {
      context += `Missing required fields: ${intent.missingFields.join(', ')}\n`;
    }

    if (intent.optionalFields && intent.optionalFields.length > 0) {
      context += `Optional fields available: ${intent.optionalFields.join(', ')}\n`;
    }

    if (Object.keys(metadata).length > 0) {
      context += `Current data: ${JSON.stringify(metadata, null, 2)}\n`;
    }

    return context;
  }
}