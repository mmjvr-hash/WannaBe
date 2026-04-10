import { useState } from 'react';

const PAGE_SIZE = 50;

export default function DataTable({ schema, data }) {
  const [page, setPage] = useState(0);
  const columns = schema.map(c => c.column_name);
  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  const pageData = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="data-table-section">
      <h4>Data Preview ({data.length.toLocaleString()} rows loaded)</h4>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => <th key={col}>{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr key={i}>
                {columns.map(col => (
                  <td key={col} title={row[col] == null ? 'null' : String(row[col])}>
                    {row[col] == null
                      ? <span className="null-val">null</span>
                      : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span>Page {page + 1} of {totalPages}</span>
          <button disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
