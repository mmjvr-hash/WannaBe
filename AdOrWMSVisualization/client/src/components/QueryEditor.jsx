import { useState, useEffect, useRef } from 'react';
import ChartPanel from './ChartPanel';
import DataTable from './DataTable';
import Leaderboard from './Leaderboard';

const API = 'http://localhost:3001/api';

// Map pg typnames to data_type strings ChartPanel understands
function fieldsToSchema(fields) {
  return fields.map(f => ({ column_name: f.name, data_type: f.type }));
}

export default function QueryEditor({ schemas, view, onSave, onDelete }) {
  const [sql, setSql] = useState(view?.sql ?? '');
  const [schema, setSchema] = useState(view?.schema ?? schemas[0]?.schema ?? '');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null); // { rows, fields, rowCount }
  const [error, setError] = useState(null);
  const [saveName, setSaveName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const textareaRef = useRef(null);

  // Auto-run saved views when opened
  useEffect(() => {
    if (view?.sql) runQuery(view.sql, view.schema);
  }, [view?.id]);

  async function runQuery(sqlToRun = sql, schemaToUse = schema) {
    if (!sqlToRun.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlToRun, schema: schemaToUse }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
    }
    // Tab inserts spaces instead of changing focus
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = sql.substring(0, start) + '  ' + sql.substring(end);
      setSql(newVal);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2; });
    }
  }

  function handleSave() {
    const name = saveName.trim() || 'Untitled view';
    onSave({ id: view?.id, name, schema, sql });
    setShowSaveForm(false);
    setSaveName('');
  }

  const derivedSchema = result ? fieldsToSchema(result.fields) : [];

  return (
    <div className="query-editor">
      <div className="qe-toolbar">
        <select
          className="qe-schema-select"
          value={schema}
          onChange={e => setSchema(e.target.value)}
        >
          {schemas.map(s => (
            <option key={s.schema} value={s.schema}>{s.schema}</option>
          ))}
        </select>

        <button className="btn-run" onClick={() => runQuery()} disabled={running}>
          {running ? 'Running…' : '▶ Run'}
          <span className="btn-hint">Ctrl+Enter</span>
        </button>

        <button className="btn-save" onClick={() => {
          setSaveName(view?.name ?? '');
          setShowSaveForm(v => !v);
        }}>
          {view ? 'Update view' : 'Save view'}
        </button>

        {view && (
          <button className="btn-delete" onClick={() => onDelete(view.id)}>
            Delete
          </button>
        )}
      </div>

      {showSaveForm && (
        <div className="qe-save-form">
          <input
            autoFocus
            type="text"
            placeholder="View name…"
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button onClick={handleSave}>Save</button>
          <button onClick={() => setShowSaveForm(false)}>Cancel</button>
        </div>
      )}

      <textarea
        ref={textareaRef}
        className="qe-textarea"
        value={sql}
        onChange={e => setSql(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`SELECT *\nFROM your_table\nLIMIT 100`}
        spellCheck={false}
      />

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="qe-results">
          <ChartPanel schema={derivedSchema} data={result.rows} />
          <div className="view-toggle">
            <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>Table</button>
            <button className={viewMode === 'leaderboard' ? 'active' : ''} onClick={() => setViewMode('leaderboard')}>Leaderboard</button>
          </div>
          {viewMode === 'table'
            ? <DataTable schema={derivedSchema} data={result.rows} />
            : <Leaderboard schema={derivedSchema} data={result.rows} />}
        </div>
      )}
    </div>
  );
}
