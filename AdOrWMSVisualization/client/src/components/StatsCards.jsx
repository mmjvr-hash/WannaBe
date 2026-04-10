export default function StatsCards({ stats }) {
  return (
    <div className="stats-cards">
      <div className="stat-card">
        <span className="stat-value">{stats.rowCount.toLocaleString()}</span>
        <span className="stat-label">Total Rows</span>
      </div>
      <div className="stat-card">
        <span className="stat-value">{stats.columnCount}</span>
        <span className="stat-label">Columns</span>
      </div>
    </div>
  );
}
