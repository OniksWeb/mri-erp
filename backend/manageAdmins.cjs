// backend/manageAdmins.cjs

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const TARGET_ADMIN_EMAIL_TO_DELETE = null; // Change to target email if deleting

async function manageAdmins() {
    try {
        console.log('Connecting to DigitalOcean database...');

        const result = await pool.query(
            "SELECT id, username, email, role, created_at FROM users WHERE role = 'admin' ORDER BY created_at DESC"
        );

        console.log('\n--- 📋 CURRENT ADMIN USERS ---');
        if (result.rows.length === 0) {
            console.log('No admin users found.');
        } else {
            result.rows.forEach((admin, index) => {
                console.log(`${index + 1}. ID: ${admin.id} | Name: ${admin.username} | Email: ${admin.email} | Created: ${admin.created_at}`);
            });
        }

        if (TARGET_ADMIN_EMAIL_TO_DELETE) {
            console.log(`\nAttempting to delete admin with email: ${TARGET_ADMIN_EMAIL_TO_DELETE}...`);
            const deleteResult = await pool.query(
                "DELETE FROM users WHERE email = $1 AND role = 'admin' RETURNING id, email",
                [TARGET_ADMIN_EMAIL_TO_DELETE]
            );

            if (deleteResult.rows.length > 0) {
                console.log(`✅ Successfully deleted admin: ${deleteResult.rows[0].email}`);
            } else {
                console.log(`❌ No admin found with email "${TARGET_ADMIN_EMAIL_TO_DELETE}".`);
            }
        } else {
            console.log('\nℹ️ Skipping deletion (TARGET_ADMIN_EMAIL_TO_DELETE is null).');
        }

        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error managing admins:', err);
        await pool.end();
        process.exit(1);
    }
}

manageAdmins();