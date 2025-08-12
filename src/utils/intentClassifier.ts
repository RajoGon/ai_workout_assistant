import { llmModel } from "./llm";

export async function classifyPrompt(prompt: string, mode: 'llm' | 'rules' = 'rules'): Promise<'rag' | 'agent'> {
  if (mode === 'llm') {
    const classification = await llmModel.generate(
      `You are a classifier. Classify the user input below into one of two categories: "rag" (for general questions) or "agent" (for action or CRUD-related instructions like create/edit/delete workout).\n\nUser Input: "${prompt}"\nCategory:`
    );

    const cleaned = classification.trim().toLowerCase();
    return cleaned.includes('agent') ? 'agent' : 'rag';
  }

  // fallback to rule-based
  return ruleBasedClassification(prompt);
}

function ruleBasedClassification(prompt: string): 'rag' | 'agent' {
  const actionKeywords = ['create', 'delete', 'update', 'edit', 'add', 'schedule', 'change', 'cancel', 'move', 're-schedule', 'reschedule', 'initiate', 'modify'];
  const workoutKeywords = ['run', 'swim', 'bike', 'workout', 'exercise', 'gym', 'session', 'running', 'yoga', 'Zumba', 'it'];

  const promptLower = prompt.toLowerCase();

  const isAgentic =
    actionKeywords.some((kw) => promptLower.includes(kw)) &&
    workoutKeywords.some((kw) => promptLower.includes(kw));

  return isAgentic ? 'agent' : 'rag';
}
