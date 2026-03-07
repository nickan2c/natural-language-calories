import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  getDocs,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { extractFoods, estimateNutrition, parseCorrection, parseKnownNutrition } from './llmService';
import { getTodayDateString } from '../utils/dateUtils';

/**
 * Check if a food is in the cache
 */
export async function checkFoodCache(foodName, userId) {
  try {
    if (!userId) throw new Error('User ID required');

    const normalizedName = foodName.toLowerCase().trim();
    const foodRef = doc(db, 'users', userId, 'foods', normalizedName);
    const foodDoc = await getDoc(foodRef);

    if (foodDoc.exists()) {
      return foodDoc.data();
    }
    return null;
  } catch (error) {
    console.error('Error checking food cache:', error);
    return null;
  }
}

/**
 * Add a food to the cache
 */
export async function addToCache(foodName, calories, protein, userId) {
  try {
    if (!userId) throw new Error('User ID required');

    const normalizedName = foodName.toLowerCase().trim();
    const foodRef = doc(db, 'users', userId, 'foods', normalizedName);

    await setDoc(foodRef, {
      name: normalizedName,
      calories,
      protein,
      createdAt: serverTimestamp()
    });

    console.log(`Cached nutrition for: ${normalizedName}`);
  } catch (error) {
    console.error('Error adding to cache:', error);
  }
}

/**
 * Get all cached foods
 */
export async function getAllCachedFoods(userId) {
  try {
    if (!userId) throw new Error('User ID required');

    const foodsRef = collection(db, 'users', userId, 'foods');
    const q = query(foodsRef, orderBy('name', 'asc'));

    const querySnapshot = await getDocs(q);
    const foods = [];

    querySnapshot.forEach((doc) => {
      foods.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return foods;
  } catch (error) {
    console.error('Error getting cached foods:', error);
    return [];
  }
}

/**
 * Update a cached food
 */
export async function updateCachedFood(foodId, updates, userId) {
  try {
    if (!userId) throw new Error('User ID required');

    const foodRef = doc(db, 'users', userId, 'foods', foodId);

    await updateDoc(foodRef, {
      name: updates.name.toLowerCase().trim(),
      calories: updates.calories,
      protein: updates.protein
    });

    console.log(`Updated cached food: ${foodId}`);
  } catch (error) {
    console.error('Error updating cached food:', error);
    throw error;
  }
}

/**
 * Delete a cached food
 */
export async function deleteCachedFood(foodId, userId) {
  try {
    if (!userId) throw new Error('User ID required');

    const foodRef = doc(db, 'users', userId, 'foods', foodId);
    await deleteDoc(foodRef);

    console.log(`Deleted cached food: ${foodId}`);
  } catch (error) {
    console.error('Error deleting cached food:', error);
    throw error;
  }
}

/**
 * Create a meal entry
 */
export async function createMealEntry(date, foodName, calories, protein, meal, quantity = 1, userId) {
  try {
    if (!userId) throw new Error('User ID required');

    const entriesRef = collection(db, 'users', userId, 'meals', date, 'entries');

    const entry = {
      foodName,
      calories,
      protein,
      quantity,
      meal,
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(entriesRef, entry);

    return {
      id: docRef.id,
      foodName,
      calories,
      protein,
      quantity,
      meal,
      createdAt: new Date() // Use local time for immediate display
    };
  } catch (error) {
    console.error('Error creating meal entry:', error);
    throw error;
  }
}

/**
 * Get meal entries for a specific date
 */
export async function getEntriesForDate(date = null, userId) {
  try {
    if (!userId) throw new Error('User ID required');

    const targetDate = date || getTodayDateString();
    const entriesRef = collection(db, 'users', userId, 'meals', targetDate, 'entries');
    const q = query(entriesRef, orderBy('createdAt', 'desc'));

    const querySnapshot = await getDocs(q);
    const entries = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      entries.push({
        id: doc.id,
        ...data,
        quantity: data.quantity !== undefined ? Number(data.quantity) : 1
      });
    });

    return entries;
  } catch (error) {
    console.error('Error getting entries for date:', error);
    return [];
  }
}

/**
 * Get today's meal entries (convenience wrapper)
 */
export async function getTodayEntries(userId) {
  return getEntriesForDate(null, userId);
}

/**
 * Main workflow: Process natural language food text
 * Returns { entries, logs }
 */
export async function processFoodText(text, mealType, date = null, userId) {
  const logs = [];
  const targetDate = date || getTodayDateString();

  if (!userId) throw new Error('User ID required');

  const addLog = (type, label, message) => {
    logs.push({
      type,
      label,
      message,
      timestamp: new Date().toLocaleTimeString()
    });
  };

  try {
    addLog('input', 'User Input', `"${text}" → ${mealType}`);

    // Step 1: Extract foods from text
    const { foods, rawResponse } = await extractFoods(text);
    addLog('llm', 'LLM Extraction', rawResponse);

    if (!foods || foods.length === 0) {
      throw new Error('No foods found in text');
    }

    addLog('success', 'Parsed Foods', foods);

    const createdEntries = [];

    // Step 2: Process each food
    for (const { food, quantity } of foods) {
      const qty = parseFloat(quantity) || 1;

      // Check cache for base nutrition (per single serving)
      let baseNutrition = await checkFoodCache(food, userId);
      let rawNutritionResponse = null;

      if (baseNutrition) {
        addLog('cache', 'Cache Hit', `Found "${food}" in cache: ${baseNutrition.calories} cal, ${baseNutrition.protein}g protein (per serving)`);
      } else {
        // Cache miss - estimate nutrition for 1 serving
        addLog('cache', 'Cache Miss', `"${food}" not cached, asking LLM for single serving...`);

        const nutritionResult = await estimateNutrition(food, '1');
        baseNutrition = nutritionResult;
        rawNutritionResponse = nutritionResult.rawResponse;

        addLog('llm', `Nutrition Estimate (${food} x1)`, rawNutritionResponse);

        // Store in cache (single serving)
        await addToCache(food, baseNutrition.calories, baseNutrition.protein, userId);
        addLog('cache', 'Cached', `Saved "${food}" to cache (per serving: ${baseNutrition.calories} cal, ${baseNutrition.protein}g protein)`);
      }

      // Scale nutrition by quantity
      const scaledCalories = Math.round(baseNutrition.calories * qty);
      const scaledProtein = Math.round(baseNutrition.protein * qty);

      addLog('info', 'Final Values', `${food}: ${baseNutrition.calories} cal/serving × ${qty} = ${scaledCalories} cal, ${scaledProtein}g protein`);

      // Create meal entry
      const entry = await createMealEntry(
        targetDate,
        food.charAt(0).toUpperCase() + food.slice(1), // Capitalize first letter
        scaledCalories,
        scaledProtein,
        mealType,
        qty,
        userId
      );

      createdEntries.push(entry);
    }

    addLog('success', 'Complete', `Added ${createdEntries.length} food(s) to ${mealType}`);

    return { entries: createdEntries, logs };
  } catch (error) {
    console.error('Error processing food text:', error);
    addLog('error', 'Error', error.message);
    throw error;
  }
}

/**
 * Handle food with known nutrition (user provides calories/protein)
 * Returns { entries, logs, hasKnownNutrition: boolean }
 */
export async function handleKnownNutrition(text, mealType, date = null, userId) {
  const logs = [];
  const targetDate = date || getTodayDateString();

  if (!userId) throw new Error('User ID required');

  const addLog = (type, label, message) => {
    logs.push({
      type,
      label,
      message,
      timestamp: new Date().toLocaleTimeString()
    });
  };

  try {
    addLog('input', 'User Input', `"${text}" → ${mealType}`);

    // Check if user is providing known nutrition
    const knownNutrition = await parseKnownNutrition(text);
    addLog('llm', 'Known Nutrition Parser', knownNutrition.rawResponse);

    if (!knownNutrition.hasNutrition) {
      addLog('info', 'No Known Nutrition', 'User did not provide nutrition values.');
      return { hasKnownNutrition: false, logs };
    }

    const { food, quantity, calories, protein, isPerItem } = knownNutrition;
    const qty = quantity || 1;

    // Determine per-item values (for caching) and total values (for entry)
    let perItemCalories, perItemProtein, totalCalories, totalProtein;

    if (isPerItem) {
      // User said "X each" - calories/protein are per item
      perItemCalories = calories;
      perItemProtein = protein;
      totalCalories = Math.round(calories * qty);
      totalProtein = Math.round(protein * qty);
      addLog('success', 'Known Nutrition Detected', `${qty}× ${food} @ ${calories} cal, ${protein}g each = ${totalCalories} cal, ${totalProtein}g total`);
    } else {
      // User gave total values
      perItemCalories = Math.round(calories / qty);
      perItemProtein = Math.round(protein / qty);
      totalCalories = calories;
      totalProtein = protein;
      addLog('success', 'Known Nutrition Detected', `${qty}× ${food} = ${totalCalories} cal, ${totalProtein}g total (${perItemCalories} cal, ${perItemProtein}g per item)`);
    }

    // Add to cache (always cache per-item values)
    await addToCache(food, perItemCalories, perItemProtein, userId);
    addLog('cache', 'Cached', `Saved "${food}" to cache (per item: ${perItemCalories} cal, ${perItemProtein}g)`);

    // Create meal entry with total values
    const entry = await createMealEntry(
      targetDate,
      food.charAt(0).toUpperCase() + food.slice(1),
      totalCalories,
      totalProtein,
      mealType,
      qty,
      userId
    );

    addLog('success', 'Complete', `Added ${qty}× "${food}" to ${mealType} (${totalCalories} cal, ${totalProtein}g protein)`);

    return { entries: [entry], logs, hasKnownNutrition: true };
  } catch (error) {
    console.error('Error handling known nutrition:', error);
    addLog('error', 'Error', error.message);
    throw error;
  }
}

/**
 * Handle correction of a food entry
 * Returns { updatedEntry, logs, correctionMade: boolean }
 */
export async function handleCorrection(text, currentEntries, date = null, userId) {
  const logs = [];
  const targetDate = date || getTodayDateString();

  if (!userId) throw new Error('User ID required');

  const addLog = (type, label, message) => {
    logs.push({
      type,
      label,
      message,
      timestamp: new Date().toLocaleTimeString()
    });
  };

  try {
    addLog('input', 'Correction Input', `"${text}"`);

    // Parse the correction
    const correction = await parseCorrection(text);
    addLog('llm', 'Correction Parser', correction.rawResponse);

    if (!correction.isCorrection) {
      addLog('info', 'Not a Correction', 'This does not appear to be a correction.');
      return { correctionMade: false, logs };
    }

    const { food, calories, protein } = correction;
    addLog('success', 'Correction Detected', `Food: ${food}, Calories: ${calories}, Protein: ${protein}g`);

    // Find the most recent entry matching this food
    const normalizedFood = food.toLowerCase();
    const matchingEntry = currentEntries.find(entry =>
      entry.foodName.toLowerCase().includes(normalizedFood) ||
      normalizedFood.includes(entry.foodName.toLowerCase())
    );

    if (!matchingEntry) {
      addLog('error', 'No Match Found', `Could not find a recent entry for "${food}". Try being more specific.`);
      throw new Error(`Could not find a recent entry for "${food}". Please be more specific.`);
    }

    addLog('info', 'Found Entry', `Updating "${matchingEntry.foodName}" (currently ${matchingEntry.calories} cal, ${matchingEntry.protein}g protein)`);

    // Update the cache
    const normalizedFoodName = matchingEntry.foodName.toLowerCase();
    await addToCache(normalizedFoodName, calories, protein, userId);
    addLog('cache', 'Cache Updated', `Updated cache for "${normalizedFoodName}"`);

    // Update the Firestore entry
    const entryRef = doc(db, 'users', userId, 'meals', targetDate, 'entries', matchingEntry.id);

    await updateDoc(entryRef, {
      calories,
      protein
    });

    addLog('success', 'Entry Updated', `Updated "${matchingEntry.foodName}" to ${calories} cal, ${protein}g protein`);

    // Return the updated entry
    const updatedEntry = {
      ...matchingEntry,
      calories,
      protein
    };

    return { updatedEntry, logs, correctionMade: true };
  } catch (error) {
    console.error('Error handling correction:', error);
    addLog('error', 'Error', error.message);
    throw error;
  }
}

/**
 * Update a meal entry
 */
export async function updateMealEntry(entryId, updates, date = null, userId) {
  try {
    if (!userId) throw new Error('User ID required');

    const targetDate = date || getTodayDateString();
    const entryRef = doc(db, 'users', userId, 'meals', targetDate, 'entries', entryId);

    console.log(`Updating entry ${entryId} with:`, updates);
    await updateDoc(entryRef, updates);

    console.log(`Updated entry: ${entryId}`);
  } catch (error) {
    console.error('Error updating meal entry:', error);
    throw error;
  }
}

/**
 * Delete a meal entry
 */
export async function deleteMealEntry(entryId, date = null, userId) {
  try {
    if (!userId) throw new Error('User ID required');

    const targetDate = date || getTodayDateString();
    const entryRef = doc(db, 'users', userId, 'meals', targetDate, 'entries', entryId);

    await deleteDoc(entryRef);

    console.log(`Deleted entry: ${entryId}`);
  } catch (error) {
    console.error('Error deleting meal entry:', error);
    throw error;
  }
}
