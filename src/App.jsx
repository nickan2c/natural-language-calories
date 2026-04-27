import { useState, useEffect } from 'react';
import './App.css';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './services/firebase';
import Auth from './components/Auth';
import ChatInput from './components/ChatInput';
import DailySummary from './components/DailySummary';
import MealList from './components/MealList';
import LLMLog from './components/LLMLog';
import FoodDatabase from './components/FoodDatabase';
import Charts from './components/Charts';
import DateNavigator from './components/DateNavigator';
import {
  processFoodText,
  getTodayEntries,
  getEntriesForDate,
  handleCorrection,
  handleKnownNutrition,
  deleteMealEntry,
  updateMealEntry,
  getAllCachedFoods,
  updateCachedFood,
  deleteCachedFood
} from './services/foodService';
import { getTodayDateString } from './utils/dateUtils';
import { generateGenZResponse, routeMessage, generateChatResponse } from './services/llmService';
import { getRecentNotionLogs, syncToNotion, updateNotionFields } from './services/notionService';

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('log'); // 'log', 'database', or 'charts'
  const [currentDate, setCurrentDate] = useState(getTodayDateString());
  const [entries, setEntries] = useState([]);
  const [cachedFoods, setCachedFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [dbLoading, setDbLoading] = useState(false);
  const [error, setError] = useState(null);
  const [llmLogs, setLlmLogs] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadEntriesForDate(currentDate);
    }
  }, [currentDate, user]);

  useEffect(() => {
    if (user && activeTab === 'database') {
      loadCachedFoods();
    }
  }, [activeTab, user]);

  async function loadEntriesForDate(date) {
    if (!user) return;

    setInitialLoad(true);
    try {
      const dateEntries = await getEntriesForDate(date, user.uid);
      setEntries(dateEntries);
    } catch (err) {
      console.error('Error loading entries:', err);
      setError('Failed to load meals');
    } finally {
      setInitialLoad(false);
    }
  }

  function handleDateChange(newDate) {
    setCurrentDate(newDate);
  }

  async function loadCachedFoods() {
    if (!user) return;

    setDbLoading(true);
    try {
      const foods = await getAllCachedFoods(user.uid);
      setCachedFoods(foods);
    } catch (err) {
      console.error('Error loading cached foods:', err);
      setError('Failed to load food database');
    } finally {
      setDbLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      setEntries([]);
      setCachedFoods([]);
      setLlmLogs([]);
    } catch (err) {
      console.error('Sign out error:', err);
      setError('Failed to sign out');
    }
  }

  async function handleChatSubmit(text) {
    // Add user message to chat
    setChatMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);
    setError(null);

    try {
      // Route the message
      const route = await routeMessage(text);

      if (route.intent === 'chat') {
        // Casual chat
        const weeklyContext = await getRecentNotionLogs(7).catch(() => []);
        const dailyCalories = entries.reduce((sum, e) => sum + (e.calories || 0), 0);
        const dailyProtein = entries.reduce((sum, e) => sum + (e.protein || 0), 0);
        const response = await generateChatResponse(text, weeklyContext, dailyCalories, dailyProtein);
        setChatMessages((prev) => [...prev, { role: 'bot', text: response.message }]);

      } else if (route.intent === 'data_update') {
        // Update Notion fields (steps, etc.)
        const success = await updateNotionFields(route.date, route.updates);
        const fields = Object.entries(route.updates).map(([k, v]) => `${k}: ${v}`).join(', ');
        const dateLabel = new Date(route.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        if (success) {
          setChatMessages((prev) => [...prev, {
            role: 'bot',
            text: `updated ${dateLabel} - ${fields} locked in bestie`,
          }]);
        } else {
          setChatMessages((prev) => [...prev, { role: 'bot', text: "couldn't update notion rn, try again?" }]);
        }

      } else {
        // Food-related intents (food, known_nutrition, correction)
        const mealType = route.mealType || 'snack';
        let newEntriesAdded = [];
        let allEntries = [];

        if (route.intent === 'known_nutrition') {
          const result = await handleKnownNutrition(text, mealType, currentDate, user.uid);
          if (result.hasKnownNutrition) {
            setEntries((prev) => { allEntries = [...result.entries, ...prev]; return allEntries; });
            newEntriesAdded = result.entries;
            setLlmLogs((prev) => [...prev, ...result.logs]);
          }
        }

        if (route.intent === 'correction' || (route.intent === 'known_nutrition' && newEntriesAdded.length === 0)) {
          const result = await handleCorrection(text, entries, currentDate, user.uid);
          if (result.correctionMade) {
            setEntries((prev) => { allEntries = prev.map((e) => e.id === result.updatedEntry.id ? result.updatedEntry : e); return allEntries; });
            newEntriesAdded = [result.updatedEntry];
            setLlmLogs((prev) => [...prev, ...result.logs]);
          }
        }

        if (newEntriesAdded.length === 0) {
          // Regular food logging
          const { entries: newEntries, logs } = await processFoodText(text, mealType, currentDate, user.uid);
          setEntries((prev) => { allEntries = [...newEntries, ...prev]; return allEntries; });
          newEntriesAdded = newEntries;
          setLlmLogs((prev) => [...prev, ...logs]);
        }

        // Generate response + sync
        if (newEntriesAdded.length > 0) {
          const totalCaloriesAdded = newEntriesAdded.reduce((sum, e) => sum + (e.calories || 0), 0);
          const totalProteinAdded = newEntriesAdded.reduce((sum, e) => sum + (e.protein || 0), 0);
          const dailyCalories = allEntries.reduce((sum, e) => sum + (e.calories || 0), 0);
          const dailyProtein = allEntries.reduce((sum, e) => sum + (e.protein || 0), 0);
          const foodNames = newEntriesAdded.map(e => e.foodName || e.food);

          const [weeklyContext] = await Promise.all([
            getRecentNotionLogs(7).catch(() => []),
            syncToNotion(currentDate, dailyCalories, dailyProtein),
          ]);

          const genZResponse = await generateGenZResponse(
            foodNames, totalCaloriesAdded, totalProteinAdded, dailyCalories, dailyProtein, weeklyContext
          );

          setChatMessages((prev) => [...prev, {
            role: 'bot',
            text: genZResponse.message,
            detail: `+${totalCaloriesAdded} cal, +${totalProteinAdded}g protein`,
          }]);
        }
      }
    } catch (err) {
      console.error('Error processing message:', err);
      setChatMessages((prev) => [...prev, {
        role: 'bot',
        text: `something went wrong: ${err.message || 'try again bestie'}`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateEntry(entryId, updates) {
    try {
      await updateMealEntry(entryId, updates, currentDate, user.uid);

      // Update the entry in the list
      let updatedEntries;
      setEntries((prev) => {
        updatedEntries = prev.map((entry) =>
          entry.id === entryId ? { ...entry, ...updates } : entry
        );
        return updatedEntries;
      });

      // Sync to Notion
      const dailyCalories = updatedEntries.reduce((sum, e) => sum + (e.calories || 0), 0);
      const dailyProtein = updatedEntries.reduce((sum, e) => sum + (e.protein || 0), 0);
      syncToNotion(currentDate, dailyCalories, dailyProtein);
    } catch (err) {
      console.error('Error updating entry:', err);
      setError('Failed to update entry. Please try again.');
    }
  }

  async function handleDeleteEntry(entryId) {
    try {
      await deleteMealEntry(entryId, currentDate, user.uid);

      // Remove the entry from the list
      let updatedEntries;
      setEntries((prev) => {
        updatedEntries = prev.filter((entry) => entry.id !== entryId);
        return updatedEntries;
      });

      // Sync to Notion
      const dailyCalories = updatedEntries.reduce((sum, e) => sum + (e.calories || 0), 0);
      const dailyProtein = updatedEntries.reduce((sum, e) => sum + (e.protein || 0), 0);
      syncToNotion(currentDate, dailyCalories, dailyProtein);
    } catch (err) {
      console.error('Error deleting entry:', err);
      setError('Failed to delete entry. Please try again.');
    }
  }

  async function handleUpdateCachedFood(foodId, updates) {
    try {
      await updateCachedFood(foodId, updates, user.uid);

      // Reload cached foods
      await loadCachedFoods();
    } catch (err) {
      console.error('Error updating cached food:', err);
      setError('Failed to update food. Please try again.');
    }
  }

  async function handleDeleteCachedFood(foodId) {
    try {
      await deleteCachedFood(foodId, user.uid);

      // Remove from list
      setCachedFoods((prev) => prev.filter((food) => food.id !== foodId));
    } catch (err) {
      console.error('Error deleting cached food:', err);
      setError('Failed to delete food. Please try again.');
    }
  }

  if (authLoading) {
    return (
      <div className="app">
        <div className="loading-auth">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Natural Language Calorie Logger</h1>
        <button onClick={handleSignOut} className="sign-out-btn">
          Sign Out
        </button>
      </header>

      {activeTab === 'log' && (
        <DateNavigator
          currentDate={currentDate}
          onDateChange={handleDateChange}
        />
      )}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'log' ? 'active' : ''}`}
          onClick={() => setActiveTab('log')}
        >
          Daily Log
        </button>
        <button
          className={`tab ${activeTab === 'charts' ? 'active' : ''}`}
          onClick={() => setActiveTab('charts')}
        >
          Charts
        </button>
        <button
          className={`tab ${activeTab === 'database' ? 'active' : ''}`}
          onClick={() => setActiveTab('database')}
        >
          Food Database
        </button>
      </div>

      <main className="app-main">
        {error && <div className="error-message">{error}</div>}

        {activeTab === 'log' ? (
          <>
            <ChatInput onSubmit={handleChatSubmit} loading={loading} messages={chatMessages} />

            <DailySummary entries={entries} />

            <LLMLog logs={llmLogs} />

            <MealList
              entries={entries}
              loading={initialLoad}
              onUpdate={handleUpdateEntry}
              onDelete={handleDeleteEntry}
            />
          </>
        ) : activeTab === 'charts' ? (
          <Charts />
        ) : (
          <FoodDatabase
            foods={cachedFoods}
            onUpdate={handleUpdateCachedFood}
            onDelete={handleDeleteCachedFood}
            loading={dbLoading}
          />
        )}
      </main>
    </div>
  );
}

export default App;
