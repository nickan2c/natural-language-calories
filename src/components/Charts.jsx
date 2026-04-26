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
  const [range, setRange] = useState('30');

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

  const filteredData = (() => {
    if (range === 'all') return data;
    const days = parseInt(range);
    return data.slice(-days);
  })();

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const avgCalories = filteredData.length
    ? Math.round(filteredData.reduce((s, d) => s + (d.calories || 0), 0) / filteredData.filter(d => d.calories).length)
    : 0;
  const avgProtein = filteredData.length
    ? Math.round(filteredData.reduce((s, d) => s + (d.protein || 0), 0) / filteredData.filter(d => d.protein).length)
    : 0;
  const avgSteps = filteredData.length
    ? Math.round(filteredData.reduce((s, d) => s + (d.steps || 0), 0) / filteredData.filter(d => d.steps).length)
    : 0;

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
              className={`range-btn ${range === value ? 'active' : ''}`}
              onClick={() => setRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

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
