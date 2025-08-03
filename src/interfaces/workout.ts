// Define workout field requirements
export const WORKOUT_FIELDS = {
  required: ['type', 'time'],
  optional: ['distance', 'duration'],
  types: {
    type: 'string',
    distance: 'number',
    duration: 'number',
    time: 'string'
  }
};

export interface IntentDetectionResult {
  intentType: 'create' | 'update' | 'retrieve' | 'delete' | 'unknown';
  confidence: number;
  extractedFields: Record<string, any>;
}
