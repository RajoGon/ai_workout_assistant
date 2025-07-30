export interface Workout {
  id: string,
  createdAt: string,
  updatedAd: string,
  type: string,
  time: string,
  completed: boolean,
  userId: string,
  workoutId: string,
  distance?: number,
  duration?: number
}
