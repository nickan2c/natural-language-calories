# Setup Checklist

Follow these steps to get your Natural Language Calorie Logger up and running.

## Prerequisites

- [ ] Node.js installed (v18 or higher recommended)
- [ ] Git installed

## Step 1: Install Dependencies

```bash
npm install
```

Expected output: Dependencies installed successfully (should see firebase and axios among packages)

## Step 2: Get Groq API Key

1. [ ] Visit https://console.groq.com
2. [ ] Sign up or log in
3. [ ] Go to API Keys section
4. [ ] Click "Create API Key"
5. [ ] Copy the API key (save it somewhere - you'll need it next)

## Step 3: Get Firebase Configuration

### Option A: Using Existing Firebase Project

If you already have a Firebase project:

1. [ ] Go to https://console.firebase.google.com/
2. [ ] Select your project
3. [ ] Go to Project Settings (gear icon) > General
4. [ ] Under "Your apps", find your web app or click "Add app" > Web
5. [ ] Copy all the config values (apiKey, authDomain, etc.)

### Option B: Create New Firebase Project

1. [ ] Go to https://console.firebase.google.com/
2. [ ] Click "Create a project"
3. [ ] Enter project name (e.g., "calorie-logger")
4. [ ] Disable Google Analytics (optional for this project)
5. [ ] Click "Create project"
6. [ ] Once created, click the settings gear > Project Settings
7. [ ] Under "Your apps", click "Web" (</> icon)
8. [ ] Register app (name: "Natural Language Calorie Logger")
9. [ ] Copy the firebaseConfig values

### Enable Firestore

1. [ ] In Firebase Console, go to "Firestore Database"
2. [ ] Click "Create database"
3. [ ] Choose "Start in test mode" (we'll configure rules next)
4. [ ] Select a location (choose closest to you)
5. [ ] Click "Enable"

### Set Security Rules

1. [ ] In Firestore Database, click "Rules" tab
2. [ ] Replace the rules with:

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

3. [ ] Click "Publish"

**Warning**: These rules allow anyone to read/write. Only use for development/testing.

## Step 4: Configure Environment Variables

1. [ ] Copy the example file:
```bash
cp .env.example .env.local
```

2. [ ] Edit `.env.local` and fill in all values:

```env
VITE_GROQ_API_KEY=your_groq_api_key_from_step_2
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

3. [ ] Save the file

## Step 5: Test the Application

1. [ ] Start the dev server:
```bash
npm run dev
```

2. [ ] Open http://localhost:5173 in your browser

3. [ ] Test basic functionality:
   - [ ] Page loads without errors (check browser console - F12)
   - [ ] Enter "2 eggs and a banana" in the input
   - [ ] Select "Breakfast" as meal type
   - [ ] Click "Add Food"
   - [ ] Wait for processing (should see "Processing your food...")
   - [ ] Verify entries appear in the list
   - [ ] Verify daily totals update
   - [ ] Refresh page - entries should persist

## Troubleshooting

### "Failed to initialize Firebase"
- Check that all Firebase config values in `.env.local` are correct
- Ensure you're using `VITE_` prefix for all variables
- Restart dev server after changing `.env.local`

### "Failed to parse food input"
- Check that Groq API key is correct in `.env.local`
- Verify you have internet connection
- Check browser console for detailed error

### "Permission denied" when saving to Firestore
- Verify Firestore security rules are set to allow public access
- Check that Firestore is enabled in your Firebase project
- Confirm you published the security rules

### Entries don't appear after adding
- Check browser console for errors (F12 > Console tab)
- Verify Firestore security rules allow writes
- Check network tab to see if API calls are succeeding

## Next Steps

Once everything is working:

1. Try adding different foods to test the extraction
2. Check Firebase Console > Firestore Database to see your data
3. Look at the `foods` collection to see cached nutrition values
4. Look at `meals/{today's date}/entries` to see your logged foods

## Development Notes

- The app runs on http://localhost:5173 by default
- Hot module replacement (HMR) is enabled - changes auto-refresh
- Check browser console for helpful debug logs
- All environment variables must start with `VITE_` to be accessible in the app
