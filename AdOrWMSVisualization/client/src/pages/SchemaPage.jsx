import { useState, useEffect, useRef } from 'react';

const API = 'http://localhost:3001/api';

export default function SchemaPage({ schemas }) {
  const [schema, setSchema]           = useState(schemas[0]?.schema ?? '');
  const [ddl, setDdl]                 = useState('');
  const [parsing, setParsing]         = useState(false);
  const [result, setResult]           = useState(null);   // { count, relationships }
  const [existing, setExisting]       = useState(null);   // already-stored rels
  const [error, setError]             = useState(null);
  const [filter, setFilter]           = useState('');
  const fileRef = useRef(null);

  // Load existing relationships when schema changes
  useEffect(() => {
    if (!schema) return;
    setExisting(null);
    setResult(null);
    fetch(`${API}/schema/relationships/${schema}`)
      .then(r => r.json())
      .then(data => { if (data.count > 0) setExisting(data); })
      .catch(() => {});
  }, [schema]);

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setDdl(ev.target.result);
    reader.readAsText(file);
  }

  async function handleParse() {
    if (!ddl.trim()) return;
    setParsing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API}/schema/ddl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ddl, schema }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      setExisting(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setParsing(false);
    }
  }

  async function handleClear() {
    await fetch(`${API}/schema/relationships/${schema}`, { method: 'DELETE' });
    setExisting(null);
    setResult(null);
    setDdl('');
  }

  const displayRels = (result ?? existing)?.relationships ?? [];
  const filtered = filter
    ? displayRels.filter(r =>
        r.from_table.includes(filter) || r.to_table.includes(filter) ||
        r.from_col.includes(filter) || r.to_col.includes(filter))
    : displayRels;

  return (
    <div className="schema-page">
      <div className="schema-header">
        <div>
          <h2>DDL Relationships</h2>
          <p className="schema-subtitle">
            Upload your DDL file to extract foreign key relationships. The AI Query generator will use these exact joins instead of guessing.
          </p>
        </div>
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

      {/* Status badge */}
      {existing && (
        <div className="schema-status">
          <span className="status-dot active" />
          {existing.count} relationships loaded for <strong>{schema}</strong>
          <button className="schema-clear-btn" onClick={handleClear}>Clear</button>
        </div>
      )}
      {!existing && (
        <div className="schema-status">
          <span className="status-dot inactive" />
          No DDL loaded for <strong>{schema}</strong> — using column-name auto-detection
        </div>
      )}

      {/* Upload panel */}
      <div className="schema-upload-panel">
        <div className="schema-upload-toolbar">
          <label className="schema-file-btn">
            Choose file (.sql / .ddl / .txt)
            <input ref={fileRef} type="file" accept=".sql,.ddl,.txt" onChange={handleFileChange} hidden />
          </label>
          <span className="schema-or">or paste DDL below</span>
          {ddl && <span className="schema-char-count">{ddl.length.toLocaleString()} chars</span>}
        </div>

        <textarea
          className="qe-textarea schema-textarea"
          value={ddl}
          onChange={e => setDdl(e.target.value)}
          placeholder={'Paste CREATE TABLE / ALTER TABLE DDL here...\n\nExample:\nALTER TABLE orderline\n  ADD CONSTRAINT fk_orderline_order\n  FOREIGN KEY (orderid) REFERENCES orderheader(orderid);'}
          spellCheck={false}
        />

        <div className="schema-actions">
          <button className="btn-run" onClick={handleParse} disabled={parsing || !ddl.trim()}>
            {parsing ? 'Parsing…' : '✦ Parse & Save'}
          </button>
          {ddl && (
            <button className="btn-save" onClick={() => setDdl('')}>Clear DDL</button>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="schema-parse-result">
          Found <strong>{result.count}</strong> foreign key relationship{result.count !== 1 ? 's' : ''}.
          {result.count === 0 && ' Check that your DDL contains FOREIGN KEY … REFERENCES … statements.'}
        </div>
      )}

      {/* Relationships table */}
      {displayRels.length > 0 && (
        <div className="schema-rels-section">
          <div className="schema-rels-header">
            <h3>Stored Relationships ({displayRels.length})</h3>
            <input
              className="schema-filter"
              type="text"
              placeholder="Filter by table or column…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
          <div className="table-wrapper">
            <table className="lb-table">
              <thead>
                <tr>
                  <th>From table</th>
                  <th>From column</th>
                  <th></th>
                  <th>To table</th>
                  <th>To column</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td style={{ color: '#a78bfa', fontWeight: 600 }}>{r.from_table}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.from_col}</td>
                    <td style={{ color: '#4c4980', textAlign: 'center' }}>→</td>
                    <td style={{ color: '#a78bfa', fontWeight: 600 }}>{r.to_table}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.to_col}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filter && filtered.length === 0 && (
            <p style={{ color: '#4c4980', fontSize: '0.875rem', marginTop: 12 }}>No matches for "{filter}"</p>
          )}
        </div>
      )}
    </div>
  );
}
