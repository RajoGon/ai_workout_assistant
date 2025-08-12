import * as chrono from "chrono-node";
  /**
   * Parse natural language dates in extracted fields
   */
  export async function parseDatesInFields(fields: Record<string, any>, originalPrompt: string): Promise<Record<string, any>> {
    const parsedFields = { ...fields };

    // Parse startDate if present
    if (fields.startDate && typeof fields.startDate === 'string') {
      const parsedDate = chrono.parseDate(fields.startDate);
      if (parsedDate) {
        parsedFields.startDate = parsedDate.toISOString();
      } else {
        // Try parsing from the full prompt context
        const contextualDate = chrono.parseDate(originalPrompt);
        if (contextualDate) {
          parsedFields.startDate = contextualDate.toISOString();
        }
      }
    }

    // Parse endDate if present
    if (fields.endDate && typeof fields.endDate === 'string') {
      const parsedDate = chrono.parseDate(fields.endDate);
      if (parsedDate) {
        parsedFields.endDate = parsedDate.toISOString();
        
        // Calculate actualDuration if both dates are available
        if (parsedFields.startDate) {
          parsedFields.actualDuration = await calculateDuration(
            new Date(parsedFields.startDate),
            new Date(parsedFields.endDate)
          );
        }
      }
    }

    return parsedFields;
  }


    /**
   * Calculate duration between two dates in minutes
   */
    export async function calculateDuration(startDate: Date, endDate: Date): Promise<number> {
      const diffMs = endDate.getTime() - startDate.getTime();
      return Math.round(diffMs / (1000 * 60)); // Convert to minutes
    }