import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChartPanel from './components/ChartPanel';
import DataTable from './components/DataTable';
import QueryEditor from './components/QueryEditor';
import Leaderboard from './components/Leaderboard';
import SavedViewsPage from './pages/SavedViewsPage';
import AIQueryPage from './pages/AIQueryPage';
import SchemaPage from './pages/SchemaPage';
import './index.css';

const API = 'http://localhost:3001/api';

function loadViews() {
  try { return JSON.parse(localStorage.getItem('adorwms-views') || '[]'); }
  catch { return []; }
}

function saveViews(views) {
  localStorage.setItem('adorwms-views', JSON.stringify(views));
}

export default function App() {
  const [schemas, setSchemas] = useState([]);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableSchema, setTableSchema] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rowLimit, setRowLimit] = useState(500);
  const [tableViewMode, setTableViewMode] = useState('table'); // 'table' | 'leaderboard'

  // Top-level tab
  const [tab, setTab] = useState('explorer'); // 'explorer' | 'views'

  // Query / saved views
  const [views, setViews] = useState(loadViews);

  // Sync views when AIQueryPage saves directly to localStorage
  useEffect(() => {
    const sync = () => setViews(loadViews());
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const [activeView, setActiveView] = useState(null); // null = new query, object = saved view
  const [mode, setMode] = useState('table'); // 'table' | 'query'

  // Load schemas on mount
  useEffect(() => {
    fetch(`${API}/schemas`)
      .then(r => r.json())
      .then(data => {
        setSchemas(data);
        if (data.length === 1) setSelectedSchema(data[0].schema);
      })
      .catch(() => setError('Could not connect to server. Is it running on port 3001?'));
  }, []);

  // Load tables when schema changes
  useEffect(() => {
    if (!selectedSchema) return;
    setTables([]);
    setSelectedTable(null);
    fetch(`${API}/schemas/${selectedSchema}/tables`)
      .then(r => r.json())
      .then(setTables)
      .catch(e => setError(`Failed to load tables: ${e.message}`));
  }, [selectedSchema]);

  // Load table data when table or limit changes
  useEffect(() => {
    if (!selectedSchema || !selectedTable || mode !== 'table') return;
    setLoading(true);
    setError(null);
    setData([]);
    setTableSchema([]);
    const base = `${API}/schemas/${selectedSchema}/tables/${selectedTable}`;
    Promise.all([
      fetch(`${base}/schema`).then(r => r.json()),
      fetch(`${base}/data?limit=${rowLimit}`).then(r => r.json()),
    ])
      .then(([s, d]) => { setTableSchema(s); setData(d); })
      .catch(e => setError(`Failed to load table: ${e.message}`))
      .finally(() => setLoading(false));
  }, [selectedSchema, selectedTable, rowLimit, mode]);

  function handleSelectTable(t) {
    setSelectedTable(t);
    setMode('table');
    setActiveView(null);
  }

  function handleNewQuery() {
    setMode('query');
    setActiveView(null);
    setSelectedTable(null);
  }

  function handleSelectView(view) {
    setMode('query');
    setActiveView(view);
    setSelectedTable(null);
  }

  function handleSaveView({ id, name, schema, sql }) {
    setViews(prev => {
      const updated = id
        ? prev.map(v => v.id === id ? { ...v, name, schema, sql } : v)
        : [...prev, { id: crypto.randomUUID(), name, schema, sql }];
      saveViews(updated);
      return updated;
    });
  }

  function handleDeleteView(id) {
    setViews(prev => {
      const updated = prev.filter(v => v.id !== id);
      saveViews(updated);
      return updated;
    });
    setMode('table');
    setActiveView(null);
  }

  return (
    <div className="app">
      <header className="header">
        <h1><span>AdOr</span> WMS Visualization</h1>
        <nav className="nav-tabs">
          <button className={tab === 'explorer' ? 'active' : ''} onClick={() => setTab('explorer')}>Explorer</button>
          <button className={tab === 'schema' ? 'active' : ''} onClick={() => setTab('schema')}>Schema</button>
          <button className={tab === 'views' ? 'active' : ''} onClick={() => setTab('views')}>
            Saved Views {views.length > 0 && <span className="tab-badge">{views.length}</span>}
          </button>
          <button className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>✦ AI Generator</button>
        </nav>
      </header>

      {tab === 'views' && (
        <div className="main" style={{ overflowY: 'auto' }}>
          <SavedViewsPage views={views} />
        </div>
      )}

      {tab === 'ai' && (
        <div className="main" style={{ overflowY: 'auto' }}>
          <AIQueryPage schemas={schemas} />
        </div>
      )}

      {tab === 'schema' && (
        <div className="main" style={{ overflowY: 'auto' }}>
          <SchemaPage schemas={schemas} />
        </div>
      )}

      {tab === 'explorer' && (
      <div className="layout">
        <Sidebar
          schemas={schemas}
          selectedSchema={selectedSchema}
          onSelectSchema={s => { setSelectedSchema(s); setSelectedTable(null); }}
          tables={tables}
          selectedTable={selectedTable}
          onSelectTable={handleSelectTable}
          views={views}
          activeView={activeView}
          onNewQuery={handleNewQuery}
          onSelectView={handleSelectView}
          mode={mode}
        />
        <main className="main">
          {error && <div className="error">{error}</div>}

          {/* Query / Custom View mode */}
          {mode === 'query' && (
            <QueryEditor
              key={activeView?.id ?? 'new'}
              schemas={schemas}
              view={activeView}
              onSave={handleSaveView}
              onDelete={handleDeleteView}
            />
          )}

          {/* Table browse mode */}
          {mode === 'table' && (
            <>
              {!selectedTable && !error && (
                <div className="empty-state">
                  {schemas.length === 0
                    ? 'Connecting to database…'
                    : selectedSchema
                      ? 'Select a table or create a custom view.'
                      : 'Select a schema from the sidebar.'}
                </div>
              )}

              {selectedTable && loading && <div className="loading">Loading {selectedTable}…</div>}

              {selectedTable && !loading && data.length > 0 && (
                <>
                  <div className="table-header">
                    <h2>{selectedTable}</h2>
                    <label>
                      Row limit:
                      <select value={rowLimit} onChange={e => setRowLimit(Number(e.target.value))}>
                        <option value={100}>100</option>
                        <option value={500}>500</option>
                        <option value={1000}>1,000</option>
                        <option value={5000}>5,000</option>
                      </select>
                    </label>
                  </div>
                  <ChartPanel schema={tableSchema} data={data} />
                  <div className="view-toggle">
                    <button className={tableViewMode === 'table' ? 'active' : ''} onClick={() => setTableViewMode('table')}>Table</button>
                    <button className={tableViewMode === 'leaderboard' ? 'active' : ''} onClick={() => setTableViewMode('leaderboard')}>Leaderboard</button>
                  </div>
                  {tableViewMode === 'table'
                    ? <DataTable schema={tableSchema} data={data} />
                    : <Leaderboard schema={tableSchema} data={data} />}
                </>
              )}

              {selectedTable && !loading && data.length === 0 && !error && (
                <div className="empty-state">This table has no rows.</div>
              )}
            </>
          )}
        </main>
      </div>
      )}
    </div>
  );
}
