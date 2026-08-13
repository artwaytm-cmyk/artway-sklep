export async function assertPostgresRelations(poolOrClient, relations = [], area = 'backend') {
  const names = [...new Set(relations.map((name) => String(name || '').trim()).filter(Boolean))];
  if (!names.length) return true;
  const result = await poolOrClient.query(`
    SELECT relation_name
    FROM unnest($1::text[]) AS relation_name
    WHERE to_regclass('public.'||relation_name) IS NULL
    ORDER BY relation_name
  `, [names]);
  if (!result.rowCount) return true;
  const missing = result.rows.map((row) => row.relation_name);
  const error = new Error(
    `Brakuje migracji PostgreSQL dla ${area}: ${missing.join(', ')}.`
  );
  error.code = 'postgres_schema_missing';
  error.status = 503;
  error.missingRelations = missing;
  throw error;
}
