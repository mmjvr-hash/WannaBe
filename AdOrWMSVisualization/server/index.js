import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { parseDDLRelationships } from './ddlParser.js';
import pool from './db.js';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

// In-memory store of DDL-parsed relationships keyed by schema
const REL_FILE = new URL('./relationships.json', import.meta.url).pathname;
let storedRelationships = {};
if (existsSync(REL_FILE)) {
  try { storedRelationships = JSON.parse(readFileSync(REL_FILE, 'utf8')); } catch {}
}

const SYSTEM_SCHEMAS = ['pg_catalog', 'information_schema', 'pg_toast'];

// Validate that a schema exists
async function validateSchema(schema) {
  const result = await pool.query(
    `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
    [schema]
  );
  return result.rowCount > 0;
}

// Validate that a table exists in a given schema
async function validateTable(schema, table) {
  const result = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = $1 AND table_name = $2`,
    [schema, table]
  );
  return result.rowCount > 0;
}

// GET /api/schemas — list all user schemas
app.get('/api/schemas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_schema AS schema, COUNT(*) AS table_count
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN (${SYSTEM_SCHEMAS.map((_, i) => `$${i + 1}`).join(',')})
      GROUP BY table_schema
      ORDER BY table_schema
    `, SYSTEM_SCHEMAS);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schemas/:schema/tables — list tables in a schema
app.get('/api/schemas/:schema/tables', async (req, res) => {
  try {
    if (!(await validateSchema(req.params.schema))) {
      return res.status(404).json({ error: 'Schema not found' });
    }
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `, [req.params.schema]);
    res.json(result.rows.map(r => r.table_name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schemas/:schema/tables/:table/schema — column names and types
app.get('/api/schemas/:schema/tables/:table/schema', async (req, res) => {
  const { schema, table } = req.params;
  try {
    if (!(await validateTable(schema, table))) {
      return res.status(404).json({ error: 'Table not found' });
    }
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `, [schema, table]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schemas/:schema/tables/:table/data?limit=500 — fetch rows
app.get('/api/schemas/:schema/tables/:table/data', async (req, res) => {
  const { schema, table } = req.params;
  const limit = Math.min(Number(req.query.limit) || 500, 5000);
  try {
    if (!(await validateTable(schema, table))) {
      return res.status(404).json({ error: 'Table not found' });
    }
    const result = await pool.query(
      `SELECT * FROM "${schema}"."${table}" LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schemas/:schema/tables/:table/stats — row count and column count
app.get('/api/schemas/:schema/tables/:table/stats', async (req, res) => {
  const { schema, table } = req.params;
  try {
    if (!(await validateTable(schema, table))) {
      return res.status(404).json({ error: 'Table not found' });
    }
    const [countResult, colResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM "${schema}"."${table}"`),
      pool.query(
        `SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2`,
        [schema, table]
      ),
    ]);
    res.json({
      rowCount: Number(countResult.rows[0].count),
      columnCount: Number(colResult.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/query — execute a read-only SQL query with optional schema search_path
app.post('/api/query', async (req, res) => {
  const { sql, schema } = req.body;

  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ error: 'sql is required' });
  }

  // Only allow SELECT / WITH (CTE) statements
  // Strip block comments and line comments before checking
  const first = sql.trim()
    .replace(/\/\*[\s\S]*?\*\//g, '')   // remove /* ... */ comments
    .replace(/--[^\n]*/g, '')            // remove -- line comments
    .trim()
    .toLowerCase();
  if (!first.startsWith('select') && !first.startsWith('with')) {
    return res.status(400).json({ error: 'Only SELECT queries are allowed.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (schema) {
      // SET LOCAL only works inside a transaction
      await client.query(`SET LOCAL search_path TO "${schema}", public`);
    }
    const result = await client.query(sql);
    await client.query('COMMIT');

    // Resolve type names from pg_type for each field
    const oids = [...new Set(result.fields.map(f => f.dataTypeID))];
    const typeRows = oids.length
      ? (await client.query(`SELECT oid, typname FROM pg_type WHERE oid = ANY($1)`, [oids])).rows
      : [];
    const typeMap = Object.fromEntries(typeRows.map(r => [r.oid, r.typname]));

    res.json({
      rows: result.rows,
      fields: result.fields.map(f => ({
        name: f.name,
        type: typeMap[f.dataTypeID] || 'text',
      })),
      rowCount: result.rowCount,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/ai-query — generate SQL from a natural language prompt using Claude
app.post('/api/ai-query', async (req, res) => {
  const { prompt, schema } = req.body;

  if (!prompt) return res.status(400).json({ error: 'prompt is required' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set in server/.env' });
  }

  try {
    // Fetch all table columns once
    const colsResult = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = $1
      ORDER BY table_name, ordinal_position
    `, [schema]);

    const tables = {};
    for (const { table_name, column_name, data_type } of colsResult.rows) {
      (tables[table_name] ??= []).push(`${column_name} ${data_type}`);
    }

    // Smart context: full columns only for tables mentioned in the prompt,
    // bare names for everything else — keeps token count small.
    const promptLower = prompt.toLowerCase();
    const tableNames = Object.keys(tables);

    const mentioned = new Set(
      tableNames.filter(t => promptLower.includes(t.toLowerCase()))
    );

    // Also expand via relationships — if a mentioned table has FK partners, include those too
    const allRels = storedRelationships[schema] ?? [];
    allRels.forEach(r => {
      if (mentioned.has(r.from_table)) mentioned.add(r.to_table);
      if (mentioned.has(r.to_table))   mentioned.add(r.from_table);
    });

    const schemaContext = tableNames.map(t =>
      mentioned.has(t)
        ? `${t}(${tables[t].join(', ')})`
        : t
    ).join('\n');

    // Relationships: only those involving mentioned tables (or all if nothing matched)
    let relationshipsText;
    if (storedRelationships[schema]?.length) {
      const relSubset = mentioned.size
        ? allRels.filter(r => mentioned.has(r.from_table) || mentioned.has(r.to_table))
        : allRels;
      relationshipsText = relSubset
        .map(r => `${r.from_table}.${r.from_col} → ${r.to_table}.${r.to_col}`)
        .join('\n');
    } else {
      const relResult = await pool.query(`
        SELECT column_name, string_agg(table_name, ', ' ORDER BY table_name) AS tables
        FROM information_schema.columns
        WHERE table_schema = $1
          AND data_type = 'integer'
          AND column_name LIKE '%id'
          AND column_name NOT IN ('statusid','createuid','exportid','exportid_av','exportid_pp',
                                   'exportid_amt','exportid_start','exportid_batchid','exportid_state',
                                   'exportid_zando','exportid_bi','exportid_courier')
        GROUP BY column_name
        HAVING count(DISTINCT table_name) BETWEEN 2 AND 25
        ORDER BY count(DISTINCT table_name) DESC, column_name
        LIMIT 40
      `, [schema]);
      relationshipsText = relResult.rows.map(r => `${r.column_name}: ${r.tables}`).join('\n');
    }

    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `PostgreSQL expert. Generate one valid SELECT query for the request. search_path="${schema}" — use table names only, no schema prefix. Output raw SQL only.`,
      messages: [{
        role: 'user',
        content: `Tables:\n${schemaContext}\n\nJoins:\n${relationshipsText}\n\nRequest: ${prompt}`,
      }],
    });

    // Strip any markdown fences or prose Claude might prepend/append
    let sql = message.content[0].text.trim();
    const fenceMatch = sql.match(/```(?:sql)?\s*([\s\S]*?)```/i);
    if (fenceMatch) sql = fenceMatch[1].trim();
    // If response starts with prose before the SELECT/WITH, skip to the SQL
    const sqlStart = sql.search(/\b(select|with)\b/i);
    if (sqlStart > 0) sql = sql.slice(sqlStart);

    res.json({ sql });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schema/ddl — parse DDL and store relationships for a schema
app.post('/api/schema/ddl', (req, res) => {
  const { ddl, schema } = req.body;
  if (!ddl || !schema) return res.status(400).json({ error: 'ddl and schema are required' });

  try {
    const relationships = parseDDLRelationships(ddl);
    storedRelationships[schema] = relationships;
    writeFileSync(REL_FILE, JSON.stringify(storedRelationships, null, 2));
    res.json({ count: relationships.length, relationships });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schema/relationships/:schema — return stored relationships
app.get('/api/schema/relationships/:schema', (req, res) => {
  const rels = storedRelationships[req.params.schema] ?? [];
  res.json({ count: rels.length, relationships: rels, source: rels.length ? 'ddl' : 'auto-detect' });
});

// DELETE /api/schema/relationships/:schema — clear stored DDL relationships
app.delete('/api/schema/relationships/:schema', (req, res) => {
  delete storedRelationships[req.params.schema];
  writeFileSync(REL_FILE, JSON.stringify(storedRelationships, null, 2));
  res.json({ ok: true });
});

app.listen(3001, () => console.log('Server running on http://localhost:3001'));
