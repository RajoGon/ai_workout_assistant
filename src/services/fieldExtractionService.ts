import { WORKOUT_TYPES } from "../interfaces/workout";
import { ChatUtils } from "../utils/chatUtils";
import { DateUtils } from "../utils/dateUtils";
import { parseLlmResponseAsJson } from "../utils/llm";

export class FielExtractionService{
    constructor(private llmModel: any){}
      async extractSuggestedFields(userId: string, chatId: string, intent: any): Promise<Record<string, any>> {
        // Get recent conversation context (last few messages)
        const recentHistory = await ChatUtils.getRecentChatHistory(userId, chatId, 5);
        const conversationContext = recentHistory
          .map((msg: { role: any; content: any; }) => `${msg.role}: ${msg.content}`)
          .join('\n');
        const extractPrompt = `
      Based on this recent conversation, extract the workout details that were suggested and confirmed:
      
      CONVERSATION:
      ${conversationContext}
      
      CURRENT INTENT: ${intent.intentType}
      MISSING FIELDS: ${JSON.stringify(intent.missingFields)}
      
      Extract the specific workout details that were suggested by the assistant and confirmed by the user.
      Focus on concrete details like times, dates, distances, durations, workout types.
      
      FIELD MAPPING:
      - time/startDate: Extract specific times mentioned (e.g., "6pm tomorrow", "Monday 9am")
      - time/endDate: Extract specific times mentioned (e.g., "6pm tomorrow", "Monday 9am") only during 'update' or 'delete' intent when user wants to end the workout.
      - duration/idealDuration: Extract planned workout duration in minutes
      - distance: Extract distance values in kilometers
      - type: Extract workout type (Running, Cycling, Swimming, Yoga, Walking)
      
      Rules:
      - Only extract fields that were clearly suggested and confirmed
      - Preserve natural language time expressions for startDate
      - Preserve natural language time expressions for endDate only when intent is 'update' or 'delete'
      - Convert durations to minutes as numbers
      - Map workout types to valid options
      - Return empty object if no clear confirmations found
      
      Return JSON format:
      {"startDate": "tomorrow at 6pm", "idealDuration": 30, "distance": 5} or {}
      `;
    
        try {
          const result = await this.llmModel.generate(extractPrompt);
          const extractedFields = await parseLlmResponseAsJson(result);
    
          // Parse any dates in the extracted fields
          return await DateUtils.parseDatesInFields(extractedFields, conversationContext);
        } catch (error) {
          console.error('Error extracting suggested fields:', error);
          return {};
        }
      }

      /**
     * Extract fields from user response
     */
      async extractFieldsFromResponse(response: string, intent: { metadata: { startDate: any; endDate: any; }; }): Promise<Record<string, any>> {
    
        if (response.toLowerCase().includes('skip')) {
          return {};
        }
    
        const extractPrompt = `
      Extract workout fields from this user response. Return only confident extractions.
      
      VALID WORKOUT TYPES: ${WORKOUT_TYPES.join(', ')}
      ${intent.metadata.startDate ? 'OBTAINED STARTDATE :' + new Date(intent.metadata.startDate).toLocaleString() +
            '. START DATE is already captured. If user adds any more information to it append it to existing startDate. EXAMPLE - Existing startDate has "8/18/2025, 12:00:00 PM" and user adds "at 9pm". The final startDate should be "18th August at 9pm"' :
            ''}
    
      ${intent.metadata.endDate ? 'OBTAINED ENDDATE :' + new Date(intent.metadata.endDate).toLocaleString() +
            '. END DATE is already captured. If user adds any more information to it append it to existing endDate. EXAMPLE - Existing endDate has "8/20/2025, 10:00:00 PM" and user adds "finished at 8am". The final endDate should be "20th August at 8am"' :
            ''}
      
      FIELD TYPES:
      - type: Workout type (map to valid types above)
      - distance: Numeric value for distance  
      - idealDuration: Planned duration in minutes (user-set target)
      - startDate: When workout starts - extract natural language time expressions
      - endDate: When workout ends - extract if mentioned
      - workoutIdentifier: Specific workout reference ("1", "2", "last workout", "yesterday's run")
      
      DATE EXAMPLES:
      - "at 3pm" → startDate: "today at 3pm"
      - "tomorrow morning" → startDate: "tomorrow morning"
      - "I finished at 4pm" → endDate: "today at 4pm"
      - "next week Monday 9am" → startDate: "next week Monday 9am"
      
      USER RESPONSE: "${response}"
      
      Rules:
      - Only extract fields you're certain about
      - For dates, preserve the natural language expression
      - Don't confuse idealDuration with calculated actualDuration
      - Return empty object {} if no clear fields found
      - Do not include null/undefined values
      
      Return JSON format:
      {"distance": 5, "idealDuration": 30} or {"workoutIdentifier": "1"} or {"endDate": "now"} or {}
      `;
    
        try {
          const result = await this.llmModel.generate(extractPrompt);
          const parsedResult = await parseLlmResponseAsJson(result);
    
          // Parse any dates in the extracted fields
          return await DateUtils.parseDatesInFields(parsedResult, response);
        } catch (error) {
          console.error('Error extracting fields from response:', error);
          return {};
        }
      }
}