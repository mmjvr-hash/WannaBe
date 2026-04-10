export default function Sidebar({
  schemas, selectedSchema, onSelectSchema,
  tables, selectedTable, onSelectTable,
  views, activeView, onNewQuery, onSelectView, mode,
}) {
  return (
    <aside className="sidebar">
      {schemas.length > 1 && (
        <>
          <h3>Schema</h3>
          <ul>
            {schemas.map(s => (
              <li
                key={s.schema}
                className={s.schema === selectedSchema && mode === 'table' ? 'active' : ''}
                onClick={() => onSelectSchema(s.schema)}
              >
                {s.schema}
                <span className="table-count">{s.table_count}</span>
              </li>
            ))}
          </ul>
          <div className="sidebar-divider" />
        </>
      )}

      <h3>Tables {tables.length > 0 && `(${tables.length})`}</h3>
      {!selectedSchema && <p className="sidebar-empty">Select a schema first</p>}
      {selectedSchema && tables.length === 0 && <p className="sidebar-empty">No tables found</p>}
      <ul>
        {tables.map(t => (
          <li
            key={t}
            className={t === selectedTable && mode === 'table' ? 'active' : ''}
            onClick={() => onSelectTable(t)}
          >
            {t}
          </li>
        ))}
      </ul>

      <div className="sidebar-divider" />

      <div className="sidebar-views-header">
        <h3>Custom Views {views.length > 0 && `(${views.length})`}</h3>
        <button className="btn-new-query" onClick={onNewQuery} title="New query">+</button>
      </div>

      {views.length === 0 && (
        <p className="sidebar-empty">No saved views yet</p>
      )}
      <ul>
        {views.map(v => (
          <li
            key={v.id}
            className={activeView?.id === v.id && mode === 'query' ? 'active' : ''}
            onClick={() => onSelectView(v)}
          >
            {v.name}
          </li>
        ))}
      </ul>
    </aside>
  );
}
