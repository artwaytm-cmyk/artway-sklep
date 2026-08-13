export const BENCHMARK_DATABASE = 'artway_benchmark';
export const BENCHMARK_ROLE = 'artway_benchmark';

export function assertIsolatedBenchmarkIdentity(identity = {}) {
  const database = String(identity.database || '').trim();
  const role = String(identity.role || '').trim();
  const superuser = identity.superuser === true;
  if (database !== BENCHMARK_DATABASE || role !== BENCHMARK_ROLE || superuser) {
    const error = new Error(
      `Benchmark zablokowany: wymagane są baza ${BENCHMARK_DATABASE} i rola ${BENCHMARK_ROLE} bez uprawnień superuser.`,
    );
    error.code = 'benchmark_database_isolation';
    throw error;
  }
  return { database, role, superuser: false };
}

export async function verifyIsolatedBenchmarkDatabase(pool) {
  const result = await pool.query(`
    SELECT current_database() AS database,
           current_user AS role,
           COALESCE((SELECT rolsuper FROM pg_roles WHERE rolname=current_user), false) AS superuser
  `);
  return assertIsolatedBenchmarkIdentity(result.rows[0] || {});
}
