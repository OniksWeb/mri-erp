// backend/src/index.js

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

// Use dynamic PORT provided by Render, fallback to 5001 for local dev
const PORT = process.env.PORT || 5001;

// Database Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Simple check to ensure database connection is successful on startup
pool.connect()
    .then(client => {
        console.log("Database connected successfully!");
        client.release();
    })
    .catch(err => {
        console.error('CRITICAL: Failed to connect to database on startup.', err);
        process.exit(1);
    });

// Enable CORS for all origins (for this test only)
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"]
}));

// Define a single test route
app.get('/api/test', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() AS current_time');
        client.release();
        res.json({
            message: 'Hello from the backend! Database is connected!',
            currentTime: result.rows[0].current_time
        });
    } catch (err) {
        console.error('Error on /api/test route:', err);
        res.status(500).json({ error: 'Database connection failed.', details: err.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Minimal backend server running on port ${PORT}`);
});