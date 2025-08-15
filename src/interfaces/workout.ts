export interface WorkoutIntent {
  id?: string;
  chatId: string;
  userId: string;
  intentType: string;
  metadata: Record<string, any>;
  missingFields: string[];
  optionalFields: string[];
  fulfilled?: boolean;
  workoutId?: string;
  intentContext?: string;
}

export interface Workout {
  type: string;
  distance?: number | null;
  idealDuration?: number | null;
  actualDuration?: number | null;
  startDate: Date;
  endDate?: Date | null;
  completed: boolean;
}

export interface WorkoutMetadata {
  [key: string]: any;
}

export const CREATE_WORKOUT_FIELDS = {
  required: ['type', 'startDate'],
  optional: ['distance', 'idealDuration', 'endDate'],
  types: {
    type: 'string',
    distance: 'number',
    idealDuration: 'number',
    startDate: 'string', // Will be parsed to DateTime
    endDate: 'string'    // Will be parsed to DateTime
  }
};

export const UPDATE_WORKOUT_FIELDS = {
  required: ['workoutIdentifier'],
  optional: ['type', 'startDate', 'endDate', 'distance', 'idealDuration'],
  types: {
    type: 'string',
    distance: 'number',
    idealDuration: 'number',
    startDate: 'string',
    endDate: 'string',
    workoutIdentifier: 'string'
  }
};

export interface IntentDetectionResult {
  intentType: 'create' | 'update' | 'retrieve' | 'delete' | 'unknown';
  confidence: number;
  extractedFields: Record<string, any>;
}

export const WORKOUT_TYPES = ["Running", "Cycling", "Swimming", "Yoga", "Walking"];
export const RAG_KEYWORDS = [
  'suggest', 'recommend', 'advice', 'based on', 'history', 'past', 'previous',
  'what do you think', 'should i', 'help me choose', 'best time', 'good distance',
  'when should', 'how long', 'analyze', 'look at my', 'considering my'
];
