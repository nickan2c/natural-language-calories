import { useState } from 'react';
import { formatTimestamp } from '../utils/dateUtils';

function MealList({ entries, loading, onDelete, onUpdate }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    // Convert timestamp to datetime-local format
    const timestamp = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date(entry.createdAt);
    const dateTimeLocal = timestamp.toISOString().slice(0, 16);

    const qty = entry.quantity !== undefined && entry.quantity > 0 ? entry.quantity : 1;
    // Show per-item calories/protein so the form reads: quantity × cal_per_item = total
    const caloriesPerItem = Math.round(entry.calories / qty);
    const proteinPerItem = Math.round(entry.protein / qty);

    setEditForm({
      foodName: entry.foodName,
      calories: caloriesPerItem,
      protein: proteinPerItem,
      quantity: qty,
      meal: entry.meal,
      createdAt: dateTimeLocal
    });
  };

  const handleSave = async (entryId) => {
    const qty = editForm.quantity > 0 ? editForm.quantity : 1;
    // Form stores per-item values; convert back to totals for storage
    const totalCalories = Math.round((editForm.calories || 0) * qty);
    const totalProtein = Math.round((editForm.protein || 0) * qty);

    const updates = {
      foodName: editForm.foodName,
      calories: totalCalories,
      protein: totalProtein,
      quantity: qty,
      meal: editForm.meal,
      createdAt: new Date(editForm.createdAt)
    };
    await onUpdate(entryId, updates);
    setEditingId(null);
    setEditForm({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  if (loading) {
    return <div className="meal-list-loading">Loading today's meals...</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="meal-list-empty">
        No meals logged yet today. Start by adding your first food above!
      </div>
    );
  }

  // Group entries by meal type
  const groupedEntries = entries.reduce((groups, entry) => {
    const meal = entry.meal || 'other';
    if (!groups[meal]) {
      groups[meal] = [];
    }
    groups[meal].push(entry);
    return groups;
  }, {});

  const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];

  return (
    <div className="meal-list">
      <h2>Today's Meals</h2>
      {mealOrder.map((mealType) => {
        const mealEntries = groupedEntries[mealType];
        if (!mealEntries || mealEntries.length === 0) return null;

        return (
          <div key={mealType} className="meal-group">
            <h3 className="meal-type-header">
              {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
            </h3>
            <div className="meal-entries">
              {mealEntries.map((entry) => {
                const isEditing = editingId === entry.id;

                return (
                  <div key={entry.id} className="meal-entry">
                    {isEditing ? (
                      // Edit mode
                      <div className="entry-edit-mode">
                        <input
                          type="text"
                          value={editForm.foodName}
                          onChange={(e) => setEditForm({ ...editForm, foodName: e.target.value })}
                          placeholder="Food name"
                          className="edit-input"
                        />
                        <div className="edit-nutrition-inline">
                          <input
                            type="number"
                            step="0.1"
                            value={editForm.quantity}
                            onChange={(e) => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) })}
                            placeholder="Qty"
                            className="edit-input-tiny"
                          />
                          <span>×</span>
                          <input
                            type="number"
                            value={editForm.calories}
                            onChange={(e) => setEditForm({ ...editForm, calories: parseInt(e.target.value) })}
                            placeholder="Calories"
                            className="edit-input-small"
                          />
                          <span>cal</span>
                          <input
                            type="number"
                            value={editForm.protein}
                            onChange={(e) => setEditForm({ ...editForm, protein: parseInt(e.target.value) })}
                            placeholder="Protein"
                            className="edit-input-small"
                          />
                          <span>g</span>
                          <select
                            value={editForm.meal}
                            onChange={(e) => setEditForm({ ...editForm, meal: e.target.value })}
                            className="edit-select"
                          >
                            <option value="breakfast">Breakfast</option>
                            <option value="lunch">Lunch</option>
                            <option value="dinner">Dinner</option>
                            <option value="snack">Snack</option>
                          </select>
                        </div>
                        <div className="edit-time">
                          <input
                            type="datetime-local"
                            value={editForm.createdAt}
                            onChange={(e) => setEditForm({ ...editForm, createdAt: e.target.value })}
                            className="edit-input"
                          />
                        </div>
                        <div className="edit-actions-inline">
                          <button onClick={() => handleSave(entry.id)} className="btn-save-inline">
                            Save
                          </button>
                          <button onClick={handleCancel} className="btn-cancel-inline">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="entry-content" onClick={() => handleEdit(entry)}>
                          <div className="entry-food">
                            {entry.quantity && entry.quantity !== 1 ? `${entry.quantity}× ` : ''}
                            {entry.foodName}
                          </div>
                          <div className="entry-stats">
                            <span className="entry-calories">{entry.calories} cal</span>
                            <span className="entry-protein">{entry.protein}g protein</span>
                            <span className="entry-time">
                              {formatTimestamp(entry.createdAt)}
                            </span>
                          </div>
                        </div>
                        <button
                          className="entry-delete"
                          onClick={() => onDelete(entry.id)}
                          title="Delete this entry"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MealList;
