// backend/config/db.js
import pkg from 'pg';
const { Pool } = pkg;

// If DATABASE_URL has query parameters forcing strict SSL, we strip them and enforce our own SSL rules
const connectionString = process.env.DATABASE_URL ? process.env.DATABASE_URL.split('?')[0] : undefined;

export const pool = new Pool({
  connectionString: connectionString,
  // Fallback to explicit properties if needed, or rely on the cleaned connection string
  ssl: {
    rejectUnauthorized: false
  }
});

export default pool;