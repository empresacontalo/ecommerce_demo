import { Pool } from 'pg'

let pool: Pool

const globalRef = global as any

function getConnectionString(): string {
  // Priority: DATABASE_URL > individual env vars > fallback
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const host = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost'
  const port = process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'
  const user = process.env.DB_USER || process.env.POSTGRES_USER || 'postgres'
  const password = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || ''
  const db = process.env.DB_NAME || process.env.POSTGRES_DB || 'postgres'

  return `postgresql://${user}:${password}@${host}:${port}/${db}`
}

if (!globalRef.pgPool) {
  globalRef.pgPool = new Pool({
    connectionString: getConnectionString(),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })
}

pool = globalRef.pgPool

export { pool }

export async function query(text: string, params?: any[]) {
  const res = await pool.query(text, params)
  return res
}
