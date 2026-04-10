import { useState, useEffect } from 'react';

const MEDALS = ['🥇', '🥈', '🥉'];
const NUMERIC_TYPES = ['int2', 'int4', 'int8', 'integer', 'bigint', 'smallint', 'float4',
  'float8', 'real', 'numeric', 'decimal', 'double precision', 'money'];

const isNumericCol = c => NUMERIC_TYPES.some(t => c.data_type?.toLowerCase().includes(t));

export default function Leaderboard({ schema, data }) {
  const numericCols = schema.filter(isNumericCol);
  const columns = schema.map(c => c.column_name);

  const [sortCol, setSortCol] = useState('');
  const [dir, setDir] = useState('desc');

  const schemaKey = columns.join(',');
  useEffect(() => {
    setSortCol(numericCols[0]?.column_name ?? columns[0] ?? '');
    setDir('desc');
  }, [schemaKey]);

  const sorted = sortCol
    ? [...data].sort((a, b) => {
        const va = a[sortCol], vb = b[sortCol];
        const na = Number(va), nb = Number(vb);
        const numeric = !isNaN(na) && !isNaN(nb) && va !== null && vb !== null;
        if (numeric) return dir === 'desc' ? nb - na : na - nb;
        return dir === 'desc'
          ? String(vb ?? '').localeCompare(String(va ?? ''))
          : String(va ?? '').localeCompare(String(vb ?? ''));
      })
    : data;

  function handleColClick(col) {
    if (col === sortCol) {
      setDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setDir('desc');
    }
  }

  return (
    <div className="leaderboard">
      <div className="lb-header">
        <h4>Leaderboard</h4>
        <div className="lb-controls">
          <label className="ctrl-label">Rank by</label>
          <select value={sortCol} onChange={e => setSortCol(e.target.value)}>
            {schema.map(c => (
              <option key={c.column_name} value={c.column_name}>{c.column_name}</option>
            ))}
          </select>
          <button
            className="lb-dir-btn"
            onClick={() => setDir(d => d === 'desc' ? 'asc' : 'desc')}
          >
            {dir === 'desc' ? '↓ High → Low' : '↑ Low → High'}
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="lb-table">
          <thead>
            <tr>
              <th className="rank-th">#</th>
              {columns.map(col => (
                <th
                  key={col}
                  className={col === sortCol ? 'lb-col-active' : ''}
                  onClick={() => handleColClick(col)}
                >
                  {col}
                  {col === sortCol && <span className="sort-arrow">{dir === 'desc' ? ' ↓' : ' ↑'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className={i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : ''}>
                <td className="rank-cell">
                  {i < 3
                    ? <span className="medal">{MEDALS[i]}</span>
                    : <span className="rank-num">{i + 1}</span>}
                </td>
                {columns.map(col => (
                  <td key={col} className={col === sortCol ? 'lb-col-highlight' : ''}>
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
    </div>
  );
}
