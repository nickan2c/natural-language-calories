import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { fetchNotionDailyLogs } from '../services/notionService';

function Charts() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('days'); // 'days' or 'month'
  const [range, setRange] = useState('30');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const logs = await fetchNotionDailyLogs();
      setData(logs);
    } catch (err) {
      console.error('Failed to fetch Notion data:', err);
      setError('Failed to load data from Notion');
    } finally {
      setLoading(false);
    }
  }

  // Get available months from data
  const availableMonths = [...new Set(data.map(d => d.date?.substring(0, 7)).filter(Boolean))].sort();

  const filteredData = (() => {
    if (mode === 'month') {
      return data.filter(d => d.date?.startsWith(selectedMonth));
    }
    if (range === 'all') return data;
    return data.slice(-parseInt(range));
  })();

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return mode === 'month'
      ? d.getDate().toString()
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatMonth = (monthStr) => {
    const [y, m] = monthStr.split('-');
    return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const safeAvg = (arr, key) => {
    const valid = arr.filter(d => d[key] != null);
    return valid.length ? Math.round(valid.reduce((s, d) => s + d[key], 0) / valid.length) : 0;
  };

  const avgCalories = safeAvg(filteredData, 'calories');
  const avgProtein = safeAvg(filteredData, 'protein');
  const avgSteps = safeAvg(filteredData, 'steps');

  const shiftMonth = (dir) => {
    const idx = availableMonths.indexOf(selectedMonth);
    const newIdx = idx + dir;
    if (newIdx >= 0 && newIdx < availableMonths.length) {
      setSelectedMonth(availableMonths[newIdx]);
    }
  };

  if (loading) {
    return <div className="charts-loading">Loading charts from Notion...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="charts-page">
      <div className="charts-controls">
        <div className="range-buttons">
          {[
            ['7', '7d'],
            ['14', '14d'],
            ['30', '30d'],
            ['all', 'All'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={`range-btn ${mode === 'days' && range === value ? 'active' : ''}`}
              onClick={() => { setMode('days'); setRange(value); }}
            >
              {label}
            </button>
          ))}
          <button
            className={`range-btn ${mode === 'month' ? 'active' : ''}`}
            onClick={() => setMode('month')}
          >
            Month
          </button>
        </div>
      </div>

      {mode === 'month' && (
        <div className="month-nav">
          <button
            className="date-nav-btn"
            onClick={() => shiftMonth(-1)}
            disabled={availableMonths.indexOf(selectedMonth) <= 0}
          >
            ‹
          </button>
          <span className="month-label">{formatMonth(selectedMonth)}</span>
          <button
            className="date-nav-btn"
            onClick={() => shiftMonth(1)}
            disabled={availableMonths.indexOf(selectedMonth) >= availableMonths.length - 1}
          >
            ›
          </button>
        </div>
      )}

      <div className="charts-averages">
        <div className="avg-stat">
          <span className="avg-value avg-cal">{avgCalories}</span>
          <span className="avg-label">avg cal</span>
        </div>
        <div className="avg-stat">
          <span className="avg-value avg-protein">{avgProtein}g</span>
          <span className="avg-label">avg protein</span>
        </div>
        <div className="avg-stat">
          <span className="avg-value avg-steps">{avgSteps.toLocaleString()}</span>
          <span className="avg-label">avg steps</span>
        </div>
      </div>

      <div className="chart-card">
        <h3>Calories</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6 }}
              labelFormatter={formatDate}
            />
            <ReferenceLine y={2700} stroke="var(--error)" strokeDasharray="5 5" label={{ value: '2700', fill: 'var(--error)', fontSize: 12 }} />
            <Bar dataKey="calories" fill="var(--calories)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Protein (g)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6 }}
              labelFormatter={formatDate}
            />
            <ReferenceLine y={180} stroke="var(--protein)" strokeDasharray="5 5" label={{ value: '180g', fill: 'var(--protein)', fontSize: 12 }} />
            <Line type="monotone" dataKey="protein" stroke="var(--protein)" strokeWidth={2} dot={{ r: 3, fill: 'var(--protein)' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Steps</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6 }}
              labelFormatter={formatDate}
            />
            <ReferenceLine y={10000} stroke="var(--text-muted)" strokeDasharray="5 5" label={{ value: '10k', fill: 'var(--text-muted)', fontSize: 12 }} />
            <Bar dataKey="steps" fill="#6b9bd2" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Calories vs 2700 Target</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6 }}
              labelFormatter={formatDate}
              formatter={(value) => [value > 0 ? `+${value}` : value, 'vs target']}
            />
            <ReferenceLine y={0} stroke="var(--text-muted)" />
            <Bar
              dataKey="caloriesVsTarget"
              fill="var(--calories)"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default Charts;
