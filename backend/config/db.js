// backend/config/db.js
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ? process.env.DATABASE_URL.split('?')[0] : undefined,
  ssl: { 
    rejectUnauthorized: false 
  },
});

export default pool;