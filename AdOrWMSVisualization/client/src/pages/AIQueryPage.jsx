import { useState, useRef } from 'react';
import ChartPanel from '../components/ChartPanel';
import DataTable from '../components/DataTable';
import Leaderboard from '../components/Leaderboard';

const API = 'http://localhost:3001/api';

function fieldsToSchema(fields) {
  return fields.map(f => ({ column_name: f.name, data_type: f.type }));
}

export default function AIQueryPage({ schemas }) {
  const [schema, setSchema]         = useState(schemas[0]?.schema ?? '');
  const [prompt, setPrompt]         = useState('');
  const [generatedSql, setGeneratedSql] = useState('');
  const [generating, setGenerating] = useState(false);
  const [running, setRunning]       = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);
  const [viewMode, setViewMode]     = useState('table');
  const [saveMsg, setSaveMsg]       = useState('');
  const promptRef = useRef(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    setGeneratedSql('');
    setResult(null);

    try {
      const res = await fetch(`${API}/ai-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, schema }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGeneratedSql(data.sql);
      // Auto-run the generated query
      await runSql(data.sql, schema);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function runSql(sql, schemaOverride) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`${API}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, schema: schemaOverride ?? schema }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      setViewMode('table');
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  function handlePromptKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
    }
  }

  function saveView() {
    if (!generatedSql) return;
    const name = prompt.trim().slice(0, 60) || 'AI View';
    const views = JSON.parse(localStorage.getItem('adorwms-views') || '[]');
    views.push({ id: crypto.randomUUID(), name, schema, sql: generatedSql });
    localStorage.setItem('adorwms-views', JSON.stringify(views));
    setSaveMsg('Saved!');
    setTimeout(() => setSaveMsg(''), 2000);
    // Force App to re-read views by dispatching a storage event (cross-component sync)
    window.dispatchEvent(new Event('storage'));
  }

  const derivedSchema = result ? fieldsToSchema(result.fields) : [];

  return (
    <div className="ai-page">
      {/* Prompt panel */}
      <div className="ai-prompt-panel">
        <div className="ai-prompt-header">
          <h2>AI Query Generator</h2>
          <select
            className="qe-schema-select"
            value={schema}
            onChange={e => setSchema(e.target.value)}
          >
            {schemas.map(s => (
              <option key={s.schema} value={s.schema}>{s.schema}</option>
            ))}
          </select>
        </div>

        <textarea
          ref={promptRef}
          className="ai-prompt-input"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handlePromptKeyDown}
          placeholder="Describe what you want to see… e.g. &quot;Show the top 10 customers by total order value this month&quot;"
          rows={3}
        />

        <div className="ai-prompt-actions">
          <button className="btn-run" onClick={handleGenerate} disabled={generating || !prompt.trim()}>
            {generating ? 'Generating…' : '✦ Generate & Run'}
            {!generating && <span className="btn-hint">Ctrl+Enter</span>}
          </button>

          {generatedSql && (
            <button className="btn-save" onClick={saveView}>
              {saveMsg || 'Save as view'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Generated SQL preview */}
      {generatedSql && (
        <div className="ai-sql-preview">
          <div className="ai-sql-label">
            Generated SQL
            <button
              className="ai-rerun-btn"
              onClick={() => runSql(generatedSql)}
              disabled={running}
            >
              ↻ Re-run
            </button>
          </div>
          <textarea
            className="qe-textarea"
            style={{ minHeight: 100 }}
            value={generatedSql}
            onChange={e => setGeneratedSql(e.target.value)}
            spellCheck={false}
          />
        </div>
      )}

      {/* Results */}
      {running && <div className="loading">Running query…</div>}

      {result && !running && (
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

      {!generatedSql && !error && (
        <div className="ai-empty">
          <div className="ai-empty-icon">✦</div>
          <p>Type a question above and hit <strong>Generate &amp; Run</strong>.</p>
          <p className="ai-empty-hint">The AI will write the SQL query and run it automatically.</p>
        </div>
      )}
    </div>
  );
}
