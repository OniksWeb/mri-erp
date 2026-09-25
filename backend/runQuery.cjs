const { Pool } = require('pg');
require('dotenv').config();

// Explicitly pass ssl configuration required by DigitalOcean cloud databases
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  const migrationQuery = `
    CREATE TABLE IF NOT EXISTS inventory_movements (
        id SERIAL PRIMARY KEY,
        item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
        movement_type VARCHAR(50) NOT NULL,
        quantity_changed INTEGER NOT NULL,
        previous_stock INTEGER NOT NULL,
        new_stock INTEGER NOT NULL,
        location_id INTEGER REFERENCES locations(id),
        performed_by INTEGER REFERENCES users(id),
        reference_number VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS store_custody_logs (
        id SERIAL PRIMARY KEY,
        store_item_id INTEGER REFERENCES store_items(id) ON DELETE CASCADE,
        borrower_name VARCHAR(255) NOT NULL,
        borrower_id_or_staff VARCHAR(100) NOT NULL,
        customer_or_department VARCHAR(255),
        location_id INTEGER REFERENCES locations(id),
        status VARCHAR(50) DEFAULT 'CHECKED_OUT',
        checkout_condition TEXT NOT NULL,
        return_condition TEXT,
        checked_out_by INTEGER REFERENCES users(id),
        returned_to INTEGER REFERENCES users(id),
        checked_out_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        returned_at TIMESTAMP WITH TIME ZONE,
        notes TEXT
    );
  `;

  try {
    console.log('Connecting to DigitalOcean PostgreSQL cluster...');
    await pool.query('SELECT NOW();'); // Test handshake
    console.log('Connected successfully! Running database migration...');
    
    await pool.query(migrationQuery);
    console.log('Migration completed successfully: Both tables created.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

runMigration();