// backend/migrate.js
import dotenv from 'dotenv';
dotenv.config();

import pkg from 'pg';
const { Pool } = pkg;

// Ensure sslmode=require is part of the connection options
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

const runMigration = async () => {
    try {
        console.log('Connecting to DigitalOcean database...');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS store_items (
                id SERIAL PRIMARY KEY,
                item_name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                serial_number VARCHAR(100) UNIQUE,
                total_units INT NOT NULL DEFAULT 1,
                available_units INT NOT NULL DEFAULT 1,
                location_id INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS store_logs (
                id SERIAL PRIMARY KEY,
                store_item_id INT REFERENCES store_items(id) ON DELETE CASCADE,
                borrower_name VARCHAR(255) NOT NULL,
                borrower_id_or_staff VARCHAR(100),
                transaction_type VARCHAR(50) NOT NULL,
                checkout_condition TEXT,
                return_condition TEXT,
                status VARCHAR(50) DEFAULT 'CHECKED_OUT',
                checked_out_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                returned_at TIMESTAMP NULL,
                notes TEXT
            );
        `);

        console.log('✅ Store tables created successfully on DigitalOcean!');
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed with full error details:', err);
        await pool.end();
        process.exit(1);
    }
};

runMigration();