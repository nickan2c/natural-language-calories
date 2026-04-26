import { useState, useEffect } from 'react';

function FoodInput({ onSubmit, loading, successMessage }) {
  const [text, setText] = useState('');
  const [mealType, setMealType] = useState('breakfast');
  const [tipsDismissed, setTipsDismissed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Show success message when it changes and is not empty
  useEffect(() => {
    if (successMessage) {
      setShowSuccess(true);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim() && !loading) {
      onSubmit(text, mealType);
      setText('');
    }
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="food-input-card">
      <h2>Log Your Food</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., 2 eggs and a banana&#10;&#10;Or with known nutrition: I had a protein bar, it was 200kcal 20g protein&#10;&#10;Press Enter to submit (Shift+Enter for new line)"
          rows="3"
          disabled={loading}
        />

        <div className="input-controls">
          <select
            value={mealType}
            onChange={(e) => setMealType(e.target.value)}
            disabled={loading}
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>

          <button type="submit" disabled={!text.trim() || loading}>
            {loading ? 'Processing...' : 'Add Food'}
          </button>
        </div>
      </form>

      {loading && (
        <div className="loading-indicator">
          Processing your food...
        </div>
      )}

      {!loading && showSuccess && successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      {!loading && !showSuccess && !tipsDismissed && (
        <div className="input-help">
          <span>💡 <strong>Tips:</strong> Know the nutrition? Just say "I had a [food], it was [X]kcal [Y]g protein". Made a mistake? Type "actually the [food] was [X]kcal [Y]g protein" to correct it!</span>
          <button
            type="button"
            className="input-help-dismiss"
            onClick={() => setTipsDismissed(true)}
            title="Dismiss tips"
            aria-label="Dismiss tips"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default FoodInput;
