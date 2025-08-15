import { IntentDetectionResult, WORKOUT_TYPES } from "../interfaces/workout";
import { DateUtils } from "../utils/dateUtils";
import { parseLlmResponseAsJson } from "../utils/llm";

export class IntentDetectionService {
    constructor(private llmModel: any) { }

    async detectIntentAndFields(prompt: string): Promise<IntentDetectionResult> {
        const intentPrompt = this.buildIntentDetectionPrompt(prompt);

        try {
            const response = await this.llmModel.generate(intentPrompt);
            const result = await parseLlmResponseAsJson(response);

            // Parse dates using chrono-node
            if (result.extractedFields) {
                result.extractedFields = await DateUtils.parseDatesInFields(result.extractedFields, prompt);
            }

            return result;
        } catch (error) {
            console.error('Error in intent detection:', error);
            return { intentType: 'unknown', confidence: 0, extractedFields: {} };
        }
    }

    /**
      * Build structured prompt for intent detection
      */
    private buildIntentDetectionPrompt(prompt: string): string {
        return `
        You are a workout assistant. Analyze this message and determine the user's intent.

        VALID INTENTS:
        - create: Adding new workouts (keywords: add, create, log, record, new, did, completed, schedule, plan)
        - update: Modifying existing workouts (keywords: update, change, modify, edit, correct, fix, reschedule, finish, complete, end)  
        - retrieve: Finding/showing workouts (keywords: show, get, find, search, history, previous)
        - delete: Removing workouts (keywords: delete, remove, cancel)
        - unknown: When intent is unclear

        VALID WORKOUT TYPES: ${WORKOUT_TYPES.join(', ')}
        Map similar terms: run→Running, stroll→Walking, bike→Cycling, etc.

        FIELD EXTRACTION RULES:
        - type: Only use valid workout types above
        - distance: Numbers with unit context (5km, 3 miles)
        - idealDuration: Planned time for exercise (30 minutes, 1 hour) - user sets this when planning
        - actualDuration: DO NOT extract this - it's calculated automatically from start/end dates
        - startDate: When workout starts/started - extract natural language time expressions
        - endDate: When workout ends/ended - extract if user mentions completion or end time
        - workoutIdentifier: For updates only, specific workout references ("1", "last workout", "yesterday's run")

        DATE EXTRACTION:
        - Look for time expressions like: "tomorrow at 6pm", "next Monday 9am", "in 2 hours", "day after tomorrow at 3pm"
        - Extract the full time expression as text for startDate/endDate fields
        - Examples: "tomorrow at 6pm" → startDate: "tomorrow at 6pm"

        MESSAGE: "${prompt}"

        Return JSON format examples:

        CREATE: {"intentType": "create", "extractedFields": {"type": "Running", "distance": 5, "startDate": "tomorrow at 6pm", "idealDuration": 30}}

        UPDATE (schedule): {"intentType": "update", "extractedFields": {"workoutIdentifier": "1", "startDate": "day after tomorrow at 3pm"}}

        UPDATE (complete): {"intentType": "update", "extractedFields": {"workoutIdentifier": "last workout", "endDate": "now"}}

        Only include fields you're confident about. Do not guess or assume.
        For startDate/endDate, preserve the natural language expression exactly as written.
        `;
    }

}