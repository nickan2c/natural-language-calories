# Natural Language Calorie Logger

A web app that lets you log foods using natural language (e.g., "2 eggs and a banana") and automatically estimates calories and protein using AI.

## Features

- Natural language food input
- LLM-powered food extraction and nutrition estimation
- Smart caching to minimize API calls
- Daily calorie and protein tracking
- Organized by meal type (breakfast, lunch, dinner, snack)

## Tech Stack

- **Frontend**: React with Vite
- **Database**: Firebase Firestore
- **LLM**: Groq API (Llama 3)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your actual API keys:

#### Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Go to Project Settings > General
4. Under "Your apps", create a web app
5. Copy the Firebase configuration values to `.env.local`

#### Groq API Setup

1. Visit [Groq Console](https://console.groq.com)
2. Create a free account or sign in
3. Navigate to API Keys section
4. Click "Create API Key"
5. Copy the API key to `.env.local` as `VITE_GROQ_API_KEY`

#### Firestore Security Rules

In Firebase Console, go to Firestore Database > Rules and set:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Note**: These rules allow public access. For production, implement proper authentication and security rules.

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Usage

1. Type your food in natural language (e.g., "2 eggs and a banana")
2. Select the meal type (breakfast, lunch, dinner, or snack)
3. Click "Add Food"
4. The app will parse your input, estimate nutrition, and log the entries
5. View your daily totals and meal history

## Database Structure

### `foods` Collection
Caches nutrition info to avoid repeated LLM calls:
```
foods/{foodId}
{
  name: "eggs",
  calories: 156,
  protein: 12,
  createdAt: timestamp
}
```

### `meals` Collection
Stores daily entries:
```
meals/{YYYY-MM-DD}/entries/{entryId}
{
  foodName: "Eggs",
  calories: 156,
  protein: 12,
  meal: "breakfast",
  createdAt: timestamp
}
```

## Build for Production

```bash
npm run build
```

The build output will be in the `dist` directory.

## License

MIT
