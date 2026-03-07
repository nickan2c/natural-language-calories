import { getTodayDateString } from '../utils/dateUtils';

function DateNavigator({ currentDate, onDateChange }) {
  const handlePrevDay = () => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() - 1);
    onDateChange(date.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + 1);
    onDateChange(date.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    onDateChange(getTodayDateString());
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date(getTodayDateString() + 'T00:00:00');
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dateStr === getTodayDateString()) {
      return 'Today';
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    } else if (dateStr === tomorrow.toISOString().split('T')[0]) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const isToday = currentDate === getTodayDateString();
  const isFuture = currentDate > getTodayDateString();

  return (
    <div className="date-navigator">
      <button
        onClick={handlePrevDay}
        className="date-nav-btn"
        aria-label="Previous day"
      >
        ‹
      </button>

      <div className="date-display">
        <div className="date-label">{formatDate(currentDate)}</div>
        <div className="date-full">
          {new Date(currentDate + 'T00:00:00').toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}
        </div>
      </div>

      <button
        onClick={handleNextDay}
        className="date-nav-btn"
        aria-label="Next day"
      >
        ›
      </button>

      {!isToday && (
        <button
          onClick={handleToday}
          className="today-btn"
        >
          Today
        </button>
      )}
    </div>
  );
}

export default DateNavigator;
