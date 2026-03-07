import { useState, useEffect } from 'react';
import './App.css';
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
    loadEntriesForDate(currentDate);
  }, [currentDate]);

  useEffect(() => {
    if (activeTab === 'database') {
      loadCachedFoods();
    }
  }, [activeTab]);

  async function loadEntriesForDate(date) {
    setInitialLoad(true);
    try {
      const dateEntries = await getEntriesForDate(date);
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
    setDbLoading(true);
    try {
      const foods = await getAllCachedFoods();
      setCachedFoods(foods);
    } catch (err) {
      console.error('Error loading cached foods:', err);
      setError('Failed to load food database');
    } finally {
      setDbLoading(false);
    }
  }

  async function handleFoodSubmit(text, mealType) {
    setLoading(true);
    setError(null);

    try {
      // First, check if user is providing known nutrition
      const knownNutritionResult = await handleKnownNutrition(text, mealType, currentDate);

      if (knownNutritionResult.hasKnownNutrition) {
        // Handle food with known nutrition
        const { entries: newEntries, logs } = knownNutritionResult;

        // Add new entries to the top of the list
        setEntries((prev) => [...newEntries, ...prev]);

        // Add logs
        setLlmLogs((prev) => [...prev, ...logs]);
      } else {
        // Not known nutrition, check if this is a correction
        const correctionResult = await handleCorrection(text, entries, currentDate);

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
          const { entries: newEntries, logs } = await processFoodText(text, mealType, currentDate);

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
      await updateMealEntry(entryId, updates, currentDate);

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
      await deleteMealEntry(entryId, currentDate);

      // Remove the entry from the list
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    } catch (err) {
      console.error('Error deleting entry:', err);
      setError('Failed to delete entry. Please try again.');
    }
  }

  async function handleUpdateCachedFood(foodId, updates) {
    try {
      await updateCachedFood(foodId, updates);

      // Reload cached foods
      await loadCachedFoods();
    } catch (err) {
      console.error('Error updating cached food:', err);
      setError('Failed to update food. Please try again.');
    }
  }

  async function handleDeleteCachedFood(foodId) {
    try {
      await deleteCachedFood(foodId);

      // Remove from list
      setCachedFoods((prev) => prev.filter((food) => food.id !== foodId));
    } catch (err) {
      console.error('Error deleting cached food:', err);
      setError('Failed to delete food. Please try again.');
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Natural Language Calorie Logger</h1>
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
