# 🏃‍♂️ AI Workout Assistant

An intelligent fitness companion that combines **Agentic CRUD operations** with **RAG-powered conversations** to help users manage their workout routines through natural language interactions.





## ✨ Features

### 🤖 Agentic Workout Management
- **Natural Language Processing**: Create, update, retrieve, and delete workouts using conversational commands
- **Intent Detection**: Automatically detects user intentions and guides them through multi-turn conversations
- **Smart Field Extraction**: Intelligently extracts workout details from natural language input
- **Date & Time Parsing**: Handles natural language date expressions like "tomorrow at 6pm", "next Monday morning"

### 🧠 RAG-Powered Recommendations  
- **Personalized Suggestions**: Analyzes workout history to provide tailored recommendations
- **Context-Aware**: Understands user preferences and patterns from past activities
- **Intelligent Prompting**: Seamlessly switches between structured data collection and conversational advice

### 📊 Smart Workout Tracking
- **Automatic Completion**: Marks workouts as completed when end times are provided
- **Duration Calculations**: Automatically calculates actual workout duration from start/end times
- **Comprehensive Metadata**: Tracks workout type, distance, planned vs actual duration, and completion status

### 💬 Advanced Conversation Management
- **Multi-Turn Dialogs**: Maintains context across conversation turns
- **Intent Continuity**: Remembers incomplete workout creation/update processes
- **Message Typing**: Supports different message types (suggestions, confirmations, questions)

## 🛠️ Tech Stack

- **Backend**: Node.js + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Vector Storage**: PostgreSQL with vector extensions for embeddings
- **AI/ML**: Custom LLM integration with JSON response parsing
- **Date Processing**: Chrono-node for natural language date parsing

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v13 or higher with vector extensions)
- Ollama||OpenAI API|| Gemini key or compatible LLM endpoint

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/ai-workout-assistant.git
cd ai-workout-assistant
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/workout_db"
OPENAI_API_KEY="your_openai_api_key_here"
```

### 4. Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database (optional)
npm run seed
```

### 5. Start the Application
```bash
npm run dev
```

## 📖 Usage Examples

### Creating Workouts
```
User: "I want to schedule a 5km run tomorrow at 6pm"
AI: "Great! I'll create a running workout for tomorrow at 6pm for 5km. Would you like to add an estimated duration?"

User: "30 minutes sounds good"
AI: "✅ Workout scheduled successfully!
• Type: Running
• Start: Tomorrow at 6:00 PM  
• Distance: 5 km
• Planned Duration: 30 mins
• Status: Scheduled"
```

### Getting Personalized Recommendations
```
User: "suggest a good time for my next workout"
AI: "Based on your running history, you typically run 5km on weekday evenings and prefer Tuesday/Thursday sessions. How about I schedule a 5km run for this Thursday at 6pm? Would you like me to create this workout?"

User: "Perfect, let's do it!"
AI: "✅ Workout scheduled successfully! [workout details]"
```

### Completing Workouts
```
User: "I just finished my run at 4:30pm"
AI: "Great job! I'll mark your workout as completed and calculate the actual duration.
✅ Workout completed!
• Actual Duration: 28 mins
• Status: Completed ✅"
```

### Workout Management
```
User: "show me my recent workouts"
AI: "Here are your recent workouts:
1. ✅ Running - Today 4:00 PM - 5km - 28min
2. 📅 Yoga - Tomorrow 8:00 AM - 45min
3. ✅ Cycling - Yesterday 6:30 PM - 10km - 35min"

User: "reschedule workout 2 to Saturday morning"  
AI: "I'll update your yoga session to Saturday morning. What time works best for you?"
```

## 🏗️ Architecture

### Core Components

#### `AgenticWorkoutService`
The main service orchestrating all workout operations:
- Intent detection and management
- Multi-turn conversation handling
- RAG integration for personalized recommendations
- CRUD operations with natural language interface

#### Database Schema
```
Users ←→ Workouts ←→ WorkoutEmbeddings
  ↓         ↓
ChatHistory  ChatIntents
```

#### Key Models
- **Workout**: Core workout data with timestamps, duration, completion status
- **ChatIntent**: Tracks ongoing conversations and missing fields
- **ChatHistory**: Stores conversation context with message typing
- **WorkoutEmbedding**: Vector embeddings for RAG-based recommendations

### Conversation Flow
```mermaid
graph TD
    A[User Message] --> B{Existing Intent?}
    B -->|Yes| C{RAG Request?}
    B -->|No| D[Detect New Intent]
    C -->|Yes| E[RAG Mode]
    C -->|No| F{Confirmation?}
    F -->|Yes| G[Process Confirmation]
    F -->|No| H[Continue Intent]
    E --> I[Store Suggestion]
    G --> J[Extract Fields]
    H --> J
    J --> K[Update Intent]
    K --> L{Complete?}
    L -->|Yes| M[Execute Action]
    L -->|No| N[Ask for More Info]
```

## 🔧 Configuration

### Workout Types
Configure supported workout types in the service:
```typescript
private readonly WORKOUT_TYPES = ["Running", "Cycling", "Swimming", "Yoga", "Walking"];
```

### RAG Keywords  
Customize keywords that trigger recommendation mode:
```typescript
private readonly RAG_KEYWORDS = [
  'suggest', 'recommend', 'advice', 'based on', 'history',
  'what do you think', 'should i', 'help me choose'
];
```

### Field Requirements
Define required and optional fields per operation:
```typescript
export const CREATE_WORKOUT_FIELDS = {
  required: ['type', 'startDate'],
  optional: ['distance', 'idealDuration', 'endDate']
};
```

## 📈 Advanced Features

### Intelligent Date Parsing
```typescript
// Handles natural language expressions
"tomorrow at 6pm" → 2024-01-15T18:00:00Z
"next Monday morning" → 2024-01-22T09:00:00Z  
"in 2 hours" → 2024-01-14T16:30:00Z
```

### Automatic Duration Calculation
```typescript
// Calculates actual workout time
startDate: "2024-01-14T18:00:00Z"
endDate: "2024-01-14T18:28:00Z"  
→ actualDuration: 28 minutes
```

### Context-Aware Suggestions
The RAG system analyzes:
- Historical workout patterns
- Preferred times and days
- Distance and duration preferences  
- Workout frequency trends


## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 API Documentation

### Core Methods

#### `agenticChat(userId, chatId, prompt, existingIntent)`
Main entry point for processing user messages

#### `detectIntentAndFields(prompt)`
Analyzes user input to determine intent and extract workout data

#### `searchWorkoutEmbeddings(userId, query)`
Retrieves relevant workout history for personalized recommendations

```

### Environment Variables
```env
USE_OLLAMA=gemini # or openai or ollama
EMBEDDING_PROVIDER=ollama # or openai or gemini
OLLAMA_BASE_URL=http://localhost:11434
MODEL_NAME="qwen2.5:7b-instruct"
EMBEDDING_MODEL="nomic-embed-text:v1.5"
GEMINI_API_KEY = AI...
SUPABASE_URL = https://...
SUPABASE_KEY = sb_...
```

## 📊 Monitoring & Analytics

- Track conversation completion rates
- Monitor LLM response accuracy  
- Analyze user workout patterns
- Performance metrics for database queries

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
npx prisma db push
npx prisma generate
```

**LLM Response Parsing Failures**
- Check API key configuration
- Verify response format matches expected JSON schema

**Date Parsing Issues**
- Ensure chrono-node is properly configured
- Check timezone settings

## 📜 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 🙏 Acknowledgments

- [Prisma](https://prisma.io) for excellent database tooling
- [Chrono](https://github.com/wanasit/chrono) for natural language date parsing
- The open source community for inspiration and contributions

## 📞 Support

- 📧 Email: rajorshi.fm@gmail.com
  
## Chat Samples**
<img width="633" height="729" alt="image" src="https://github.com/user-attachments/assets/31cedbee-98d8-43c9-94bd-d2807bc4b2ab" /> #Creating a workout
<img width="599" height="537" alt="image" src="https://github.com/user-attachments/assets/79a33c81-d417-4ce7-b6f7-66b579e5f505" /> #Updating a workout
<img width="645" height="627" alt="image" src="https://github.com/user-attachments/assets/443a26f7-f17c-4794-9047-f670fc3789d6" /> #Rag chat
---

<p align="center">Made with ❤️ for fitness enthusiasts and AI lovers</p>
