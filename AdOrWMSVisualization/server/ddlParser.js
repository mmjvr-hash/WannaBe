/**
 * Parse FOREIGN KEY relationships out of a PostgreSQL DDL string.
 * Handles both:
 *   CREATE TABLE t ( ... FOREIGN KEY (col) REFERENCES other(col) ... )
 *   ALTER TABLE [ONLY] [schema.]t ADD [CONSTRAINT name] FOREIGN KEY (col) REFERENCES [schema.]other(col)
 */
export function parseDDLRelationships(ddl) {
  const relationships = [];

  // Strip comments
  const cleaned = ddl
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');

  // Split on semicolons to get individual statements
  const statements = cleaned.split(';');

  for (const raw of statements) {
    const stmt = raw.trim();
    if (!stmt) continue;

    // ── ALTER TABLE [ONLY] [schema.]table ADD [CONSTRAINT name] FOREIGN KEY ──
    const alterMatch = stmt.match(
      /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:[\w"]+\s*\.\s*)?["']?(\w+)["']?\s+ADD\s+(?:CONSTRAINT\s+\S+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:[\w"]+\s*\.\s*)?["']?(\w+)["']?\s*\(([^)]+)\)/is
    );
    if (alterMatch) {
      push(relationships, alterMatch[1], alterMatch[2], alterMatch[3], alterMatch[4]);
      continue;
    }

    // ── CREATE TABLE [IF NOT EXISTS] [schema.]table ( … FK … ) ──
    const createMatch = stmt.match(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\s*\.\s*)?["']?(\w+)["']?\s*\(/is
    );
    if (createMatch) {
      const tableName = createMatch[1];
      const fkRe = /FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:[\w"]+\s*\.\s*)?["']?(\w+)["']?\s*\(([^)]+)\)/gi;
      let m;
      while ((m = fkRe.exec(stmt)) !== null) {
        push(relationships, tableName, m[1], m[2], m[3]);
      }
    }
  }

  return relationships;
}

function push(list, fromTable, fromCols, toTable, toCols) {
  // Handle composite keys — split by comma and pair them up
  const fc = fromCols.split(',').map(c => c.trim().replace(/"/g, ''));
  const tc = toCols.split(',').map(c => c.trim().replace(/"/g, ''));
  fc.forEach((col, i) => {
    list.push({
      from_table: fromTable.replace(/"/g, ''),
      from_col: col,
      to_table: toTable.replace(/"/g, ''),
      to_col: tc[i] ?? tc[0],
    });
  });
}
