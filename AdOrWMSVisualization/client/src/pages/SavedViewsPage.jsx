import { useState, useEffect } from 'react';
import ChartPanel from '../components/ChartPanel';
import DataTable from '../components/DataTable';
import Leaderboard from '../components/Leaderboard';

const API = 'http://localhost:3001/api';

function fieldsToSchema(fields) {
  return fields.map(f => ({ column_name: f.name, data_type: f.type }));
}

export default function SavedViewsPage({ views }) {
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('table');

  // Auto-run when a view is selected
  useEffect(() => {
    if (!selected) return;
    setResult(null);
    setError(null);
    setViewMode('table');
    setLoading(true);

    fetch(`${API}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: selected.sql, schema: selected.schema }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setResult(data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected?.id]);

  const derivedSchema = result ? fieldsToSchema(result.fields) : [];

  if (views.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 80 }}>
        No saved views yet — create one in the <strong>Explorer</strong> tab using the query editor.
      </div>
    );
  }

  return (
    <div className="sv-page">
      {/* View cards */}
      <div className="sv-grid">
        {views.map(v => (
          <div
            key={v.id}
            className={`sv-card ${selected?.id === v.id ? 'active' : ''}`}
            onClick={() => setSelected(v)}
          >
            <div className="sv-card-name">{v.name}</div>
            <div className="sv-card-schema">{v.schema}</div>
            <div className="sv-card-sql">{v.sql.trim().slice(0, 100)}{v.sql.length > 100 ? '…' : ''}</div>
          </div>
        ))}
      </div>

      {/* Results */}
      {selected && (
        <div className="sv-results">
          <div className="sv-results-header">
            <h2>{selected.name}</h2>
            <span className="sv-schema-badge">{selected.schema}</span>
            <button
              className="sv-refresh-btn"
              onClick={() => setSelected({ ...selected })}
              disabled={loading}
            >
              ↻ Refresh
            </button>
          </div>

          {loading && <div className="loading">Running {selected.name}…</div>}
          {error && <div className="error">{error}</div>}

          {result && !loading && (
            <>
              <ChartPanel schema={derivedSchema} data={result.rows} />
              <div className="view-toggle">
                <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>Table</button>
                <button className={viewMode === 'leaderboard' ? 'active' : ''} onClick={() => setViewMode('leaderboard')}>Leaderboard</button>
              </div>
              {viewMode === 'table'
                ? <DataTable schema={derivedSchema} data={result.rows} />
                : <Leaderboard schema={derivedSchema} data={result.rows} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
