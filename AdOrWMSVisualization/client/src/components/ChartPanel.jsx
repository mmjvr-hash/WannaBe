import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#03506B', '#F9B000', '#22C55E', '#EF4444', '#8B5CF6', '#06B6D4'];

const NUMERIC_TYPES = ['int2', 'int4', 'int8', 'integer', 'bigint', 'smallint', 'float4',
  'float8', 'real', 'numeric', 'decimal', 'double precision', 'money'];
const DATE_TYPES = ['date', 'timestamp', 'timestamptz', 'timestamp without time zone',
  'timestamp with time zone'];

const isNumericCol = c => NUMERIC_TYPES.some(t => c.data_type?.toLowerCase().includes(t));
const isDateCol   = c => DATE_TYPES.some(t => c.data_type?.toLowerCase().includes(t));

function formatXVal(val, asDate) {
  if (val == null) return '(null)';
  if (asDate) return new Date(val).toLocaleDateString();
  return String(val);
}

export default function ChartPanel({ schema, data }) {
  const [xCol, setXCol]       = useState('');
  const [yCols, setYCols]     = useState([]);
  const [chartType, setChartType] = useState('bar');

  const schemaKey = schema.map(c => c.column_name).join(',');

  // Smart defaults whenever the schema changes
  useEffect(() => {
    if (!schema.length) return;
    const numerics   = schema.filter(isNumericCol);
    const dates      = schema.filter(isDateCol);
    const nonNumeric = schema.filter(c => !isNumericCol(c));

    const defaultX = dates[0]?.column_name
      ?? nonNumeric[0]?.column_name
      ?? schema[0]?.column_name
      ?? '';

    setXCol(defaultX);
    setYCols(numerics.slice(0, 3).map(c => c.column_name));
    setChartType(dates.length > 0 ? 'line' : 'bar');
  }, [schemaKey]);

  if (!schema.length || !data.length) return null;

  const numericCols = schema.filter(isNumericCol);
  const xIsDate = xCol ? isDateCol(schema.find(c => c.column_name === xCol) ?? {}) : false;

  function handleXChange(col) {
    setXCol(col);
    if (col && isDateCol(schema.find(c => c.column_name === col) ?? {})) {
      setChartType('line');
    }
  }

  function toggleY(col) {
    setYCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  }

  const rowLimit = chartType === 'line' ? 500 : 100;
  const chartData = xCol && yCols.length > 0
    ? data.slice(0, rowLimit).map(row => ({
        [xCol]: formatXVal(row[xCol], xIsDate),
        ...Object.fromEntries(yCols.map(y => [y, Number(row[y]) || 0])),
      }))
    : [];

  // Pie chart uses first Y col only, sliced to 20 slices for readability
  const pieCol = yCols[0];
  const pieData = xCol && pieCol
    ? data.slice(0, 20).map(row => ({
        name: formatXVal(row[xCol], xIsDate),
        value: Number(row[pieCol]) || 0,
      })).filter(d => d.value > 0)
    : [];

  const canRender = chartType === 'pie'
    ? pieData.length > 0
    : chartData.length > 0 && yCols.length > 0;

  const tooltipStyle = {
    contentStyle: { background: '#162233', border: '1px solid #1E3A4A', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' },
    labelStyle: { color: '#F9B000', fontWeight: 700, fontFamily: 'Montserrat' },
    itemStyle: { color: '#94A3B8' },
  };

  return (
    <div className="chart-panel-wrapper">
      <div className="chart-controls">

        <div className="chart-control-group">
          <label className="ctrl-label">X axis</label>
          <select value={xCol} onChange={e => handleXChange(e.target.value)}>
            <option value="">— none —</option>
            {schema.map(c => (
              <option key={c.column_name} value={c.column_name}>{c.column_name}</option>
            ))}
          </select>
        </div>

        <div className="chart-control-group">
          <label className="ctrl-label">Y axis</label>
          <div className="y-checkboxes">
            {numericCols.length === 0
              ? <span className="no-numeric">No numeric columns</span>
              : numericCols.map((c, i) => (
                <label key={c.column_name} className="y-check">
                  <input
                    type="checkbox"
                    checked={yCols.includes(c.column_name)}
                    onChange={() => toggleY(c.column_name)}
                  />
                  <span style={{ color: COLORS[i % COLORS.length] }}>{c.column_name}</span>
                </label>
              ))
            }
          </div>
        </div>

        <div className="chart-control-group">
          <label className="ctrl-label">Type</label>
          <div className="chart-type-btns">
            {[['bar', 'Bar'], ['line', 'Line'], ['hbar', 'Horiz.'], ['pie', 'Pie']].map(([val, label]) => (
              <button
                key={val}
                className={chartType === val ? 'active' : ''}
                onClick={() => setChartType(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {canRender ? (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={320}>
            {chartType === 'pie' ? (
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                  labelLine={true}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value) => [value, pieCol]}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#64748B', fontFamily: 'Montserrat' }} />
              </PieChart>
            ) : chartType === 'hbar' ? (
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A4A" />
                <XAxis type="number" tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'Montserrat' }} axisLine={false} tickLine={false} />
                <YAxis dataKey={xCol} type="category" width={160} tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'Montserrat' }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#64748B', fontFamily: 'Montserrat' }} />
                {yCols.map((y, i) => (
                  <Bar key={y} dataKey={y} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />
                ))}
              </BarChart>
            ) : chartType === 'line' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A4A" />
                <XAxis dataKey={xCol} tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'Montserrat' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'Montserrat' }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#64748B', fontFamily: 'Montserrat' }} />
                {yCols.map((y, i) => (
                  <Line key={y} type="monotone" dataKey={y} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />
                ))}
              </LineChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A4A" />
                <XAxis dataKey={xCol} tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'Montserrat' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'Montserrat' }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#64748B', fontFamily: 'Montserrat' }} />
                {yCols.map((y, i) => (
                  <Bar key={y} dataKey={y} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="no-charts">
          {!xCol ? 'Select an X axis column.' : 'Select at least one Y axis column.'}
        </p>
      )}
    </div>
  );
}
