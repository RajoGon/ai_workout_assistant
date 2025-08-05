// Define workout field requirements for create
export const CREATE_WORKOUT_FIELDS = {
  required: ['type', 'time'],
  optional: ['distance', 'duration'],
  types: {
    type: 'string',
    distance: 'number',
    duration: 'number',
    time: 'string'
  }
};
// Define workout field requirements for update
export const UPDATE_WORKOUT_FIELDS = {
  required: ['workoutIdentifier'],
  optional: ['type', 'time','distance', 'duration'],
  types: {
    type: 'string',
    distance: 'number',
    duration: 'number',
    time: 'string',
    workoutIdentifier: 'string'
  }
};

export interface IntentDetectionResult {
  intentType: 'create' | 'update' | 'retrieve' | 'delete' | 'unknown';
  confidence: number;
  extractedFields: Record<string, any>;
}
