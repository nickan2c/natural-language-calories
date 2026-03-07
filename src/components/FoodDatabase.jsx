import { useState } from 'react';

function FoodDatabase({ foods, onUpdate, onDelete, loading }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  if (loading) {
    return <div className="database-loading">Loading food database...</div>;
  }

  if (foods.length === 0) {
    return (
      <div className="database-empty">
        No foods in the database yet. Start logging foods to build your cache!
      </div>
    );
  }

  const handleEdit = (food) => {
    setEditingId(food.id);
    setEditForm({
      name: food.name,
      calories: food.calories,
      protein: food.protein
    });
  };

  const handleSave = async (foodId) => {
    await onUpdate(foodId, editForm);
    setEditingId(null);
    setEditForm({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const sortedFoods = [...foods].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="food-database">
      <h2>Food Database ({foods.length} foods)</h2>
      <p className="database-description">
        These are the foods cached in your database. Edit or delete as needed.
      </p>

      <div className="database-list">
        {sortedFoods.map((food) => {
          const isEditing = editingId === food.id;

          return (
            <div key={food.id} className="database-item">
              {isEditing ? (
                // Edit mode
                <div className="database-item-edit">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Food name"
                    className="edit-input"
                  />
                  <div className="edit-nutrition">
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
                    <span>g protein</span>
                  </div>
                  <div className="edit-actions">
                    <button onClick={() => handleSave(food.id)} className="btn-save">
                      Save
                    </button>
                    <button onClick={handleCancel} className="btn-cancel">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <>
                  <div className="database-item-content">
                    <div className="database-item-name">{food.name}</div>
                    <div className="database-item-stats">
                      <span className="db-calories">{food.calories} cal</span>
                      <span className="db-protein">{food.protein}g protein</span>
                    </div>
                  </div>
                  <div className="database-item-actions">
                    <button onClick={() => handleEdit(food)} className="btn-edit">
                      Edit
                    </button>
                    <button onClick={() => onDelete(food.id)} className="btn-delete">
                      ×
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FoodDatabase;
