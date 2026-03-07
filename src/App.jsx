import { useState, useEffect } from 'react';
import './App.css';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './services/firebase';
import Auth from './components/Auth';
import FoodInput from './components/FoodInput';
import DailySummary from './components/DailySummary';
import MealList from './components/MealList';
import LLMLog from './components/LLMLog';
import FoodDatabase from './components/FoodDatabase';
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

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('log'); // 'log' or 'database'
  const [currentDate, setCurrentDate] = useState(getTodayDateString());
  const [entries, setEntries] = useState([]);
  const [cachedFoods, setCachedFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [dbLoading, setDbLoading] = useState(false);
  const [error, setError] = useState(null);
  const [llmLogs, setLlmLogs] = useState([]);

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

  async function handleFoodSubmit(text, mealType) {
    setLoading(true);
    setError(null);

    try {
      // First, check if user is providing known nutrition
      const knownNutritionResult = await handleKnownNutrition(text, mealType, currentDate, user.uid);

      if (knownNutritionResult.hasKnownNutrition) {
        // Handle food with known nutrition
        const { entries: newEntries, logs } = knownNutritionResult;

        // Add new entries to the top of the list
        setEntries((prev) => [...newEntries, ...prev]);

        // Add logs
        setLlmLogs((prev) => [...prev, ...logs]);
      } else {
        // Not known nutrition, check if this is a correction
        const correctionResult = await handleCorrection(text, entries, currentDate, user.uid);

        if (correctionResult.correctionMade) {
          // Handle correction
          const { updatedEntry, logs } = correctionResult;

          // Update the entry in the list
          setEntries((prev) =>
            prev.map((entry) =>
              entry.id === updatedEntry.id ? updatedEntry : entry
            )
          );

          // Add logs (include known nutrition check + correction logs)
          setLlmLogs((prev) => [...prev, ...knownNutritionResult.logs, ...logs]);
        } else {
          // Not a correction, process as normal food entry
          const { entries: newEntries, logs } = await processFoodText(text, mealType, currentDate, user.uid);

          // Add new entries to the top of the list
          setEntries((prev) => [...newEntries, ...prev]);

          // Add logs to the log list (include all checks + food processing logs)
          setLlmLogs((prev) => [...prev, ...knownNutritionResult.logs, ...correctionResult.logs, ...logs]);
        }
      }
    } catch (err) {
      console.error('Error processing food:', err);
      setError(err.message || 'Failed to process food. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateEntry(entryId, updates) {
    try {
      await updateMealEntry(entryId, updates, currentDate, user.uid);

      // Update the entry in the list
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId ? { ...entry, ...updates } : entry
        )
      );
    } catch (err) {
      console.error('Error updating entry:', err);
      setError('Failed to update entry. Please try again.');
    }
  }

  async function handleDeleteEntry(entryId) {
    try {
      await deleteMealEntry(entryId, currentDate, user.uid);

      // Remove the entry from the list
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
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
            <FoodInput onSubmit={handleFoodSubmit} loading={loading} />

            <DailySummary entries={entries} />

            <LLMLog logs={llmLogs} />

            <MealList
              entries={entries}
              loading={initialLoad}
              onUpdate={handleUpdateEntry}
              onDelete={handleDeleteEntry}
            />
          </>
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
