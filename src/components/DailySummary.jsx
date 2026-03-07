function DailySummary({ entries }) {
  const totalCalories = entries.reduce((sum, entry) => sum + (entry.calories || 0), 0);
  const totalProtein = entries.reduce((sum, entry) => sum + (entry.protein || 0), 0);

  return (
    <div className="daily-summary">
      <div className="summary-stat">
        <div className="stat-value">{totalCalories}</div>
        <div className="stat-label">Calories</div>
      </div>
      <div className="summary-stat">
        <div className="stat-value">{totalProtein}g</div>
        <div className="stat-label">Protein</div>
      </div>
    </div>
  );
}

export default DailySummary;
