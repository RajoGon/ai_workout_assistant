import { CREATE_WORKOUT_FIELDS, UPDATE_WORKOUT_FIELDS } from "../interfaces/workout";

export class FieldValidationService {

    findMissingFields(intentType: string, extractedFields: Record<string, any>): { missing: string[], optional: string[] } {
        let workoutFields;
        switch (intentType) {
            case 'create':
                workoutFields = CREATE_WORKOUT_FIELDS;
                break;
            case 'update':
                workoutFields = UPDATE_WORKOUT_FIELDS;
                break;
            default:
                workoutFields = CREATE_WORKOUT_FIELDS;
                break;
        }

        const missing = workoutFields.required.filter(field =>
            extractedFields[field] == null ||
            extractedFields[field] === undefined ||
            extractedFields[field] === '' ||
            !(field in extractedFields)
        );

        const optional = workoutFields.optional.filter(field => !(field in extractedFields));

        return { missing, optional };
    }

    getFieldPrompt(field: string): string {
        const prompts = {
            type: 'workout type (Running, Cycling, Swimming, Yoga, Walking)',
            distance: 'distance (e.g., 5 km)',
            idealDuration: 'planned duration (e.g., 30 minutes)',
            startDate: 'start date and time (e.g., "tomorrow at 6pm", "next Monday 9am")',
            endDate: 'end date and time (e.g., "today at 4pm", "now")',
            workoutIdentifier: 'which workout to update (e.g., "1", "last workout", "yesterday\'s run")'
        };
        return prompts[field as keyof typeof prompts] || field;
    }
}