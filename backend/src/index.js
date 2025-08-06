// backend/src/index.js

require('dotenv').config(); // Load environment variables from .env file

// --- Debugging .env variables (can remove later) ---
console.log('--- Environment Variables Loaded ---');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '****** (password detected)' : '!!!!!! (password NOT detected)');
console.log('PORT:', process.env.PORT); // Check the Node.js server port
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '****** (secret detected)' : '!!!!!! (secret NOT detected)');
console.log('----------------------------------');

// --- 1. Import necessary modules ---
const express = require('express');
const http = require('http'); // Used to create HTTP server for Express and Socket.IO
const { Server } = require('socket.io'); // Socket.IO server
const cors = require('cors'); // For handling Cross-Origin Resource Sharing
const { Pool } = require('pg'); // PostgreSQL client
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For JSON Web Tokens
const { auth, authorizeRoles } = require('./middleware/auth'); // Our custom authentication middleware
const puppeteer = require('puppeteer'); // For PDF generation
const fs = require('fs').promises; // For asynchronous file system operations
const path = require('path'); // For resolving file paths
const multer = require('multer'); // For handling file uploads

// --- 2. Initialize JWT Secret (Critical) ---
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET is not defined in .env! Application will not function securely.');
    process.exit(1); // Exit if secret is missing for security
}

// --- Initialize Express App and HTTP Server ---
const app = express(); // Initialize Express application
const server = http.createServer(app); // Create HTTP server from Express app, needed for Socket.IO

// --- Configure CORS for Express and Socket.IO ---
const allowedOrigins = [
    "http://localhost:3000", // Your React development server
    "http://https://mri-erp-frontend.onrender.com", // Your backend itself (for requests originating from it)
    "app://.", // Electron's custom origin for its renderer process
    "null" // Sometimes Electron or file:// origins register as "null"
];
// CORS for Express routes
app.use(cors({
     origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not ' +
                  'allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true, // Allow cookies/authorization headers
}));
// Middleware to parse JSON request bodies
app.use(express.json());

// CORS for Socket.IO server (allowing all origins for development)
const io = new Server(server, {
    cors: {
        origin: "*", // WARNING: Use specific origins in production!
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
    }
});

const connectedUsers = new Map(); // Store userId -> socket.id for targeted notifications

// --- Multer Configuration for File Uploads ---
// Define the absolute base directory for all uploads (e.g., mri-erp-app/backend/uploads)
const UPLOADS_BASE_DIR = path.join(__dirname, '../uploads');
// Define the specific subdirectory for patient result files (e.g., mri-erp-app/backend/uploads/results)
const UPLOADS_RESULTS_DIR = path.join(UPLOADS_BASE_DIR, 'results');

// Ensure the upload directories exist on startup
fs.mkdir(UPLOADS_BASE_DIR, { recursive: true })
    .then(() => console.log('Base uploads directory ensured:', UPLOADS_BASE_DIR))
    .catch(err => console.error('Error ensuring base uploads directory:', err));
fs.mkdir(UPLOADS_RESULTS_DIR, { recursive: true })
    .then(() => console.log('Results uploads directory ensured:', UPLOADS_RESULTS_DIR))
    .catch(err => console.error('Error ensuring results uploads directory:', err));


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Multer will save files directly into the 'results' subdirectory
        cb(null, UPLOADS_RESULTS_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        // req.params.patientId is used in the route path '/api/patients/:patientId/results/upload'
        const patientId = req.params.patientId;

        // Add a check for patientId just in case it's missing from the URL params
        if (!patientId) {
            console.error("Multer filename error: Patient ID missing from request parameters (req.params.patientId).");
            // Returning an error to multer callback will prevent saving the file
            return cb(new Error('Patient ID is required for file naming.'), `generic-upload_${Date.now()}${ext}`);
        }

        // Custom filename format: patientId_timestamp_originalName.ext
        const fileName = `${patientId}_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`; // Sanitize original name
        cb(null, fileName);
    }
});
const upload = multer({ storage: storage });

// --- Serve static uploaded files ---
// Make the base 'uploads' directory accessible from the web
// Files will be accessible via http://localhost:5001/uploads/... (e.g., /uploads/results/my_file.jpg)
app.use('/uploads', express.static(UPLOADS_BASE_DIR));


// --- Helper functions ---
function generateMriCode() {
    const randomNumbers = String(Math.floor(1000 + Math.random() * 9000)).padStart(4, '0');
    return `G2G-MRI-${randomNumbers}`;
}

function generateReceiptNumber() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `REC-${timestamp}-${random}`.toUpperCase();
}

// --- PostgreSQL Database Connection Pool ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Render's free PostgreSQL
});

// Database connection test on startup
async function testDbConnection() {
    try {
        const client = await pool.connect();
        console.log('Database pool connected successfully!');
        client.release();
    } catch (err) {
        console.error('CRITICAL: Failed to connect to database on startup. Check DB credentials and server status.', err.message);
        console.error('Ensure your PostgreSQL server is running and the credentials in .env are correct.');
        // process.exit(1); // Uncomment if DB connection is absolutely critical for app startup
    }
}
testDbConnection();
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client in pool:', err);
});


// --- Define API Routes ---

// Basic Express Route
app.get('/api', (req, res) => {
    res.send('Welcome to the ERP Backend API!');
});

// Test Database Connection Route
app.get('/api/test-db', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() AS current_time');
        client.release();
        res.json({ message: 'Database Connected Successfully!', currentTime: result.rows[0].current_time });
    } catch (error) {
        console.error('Error on /api/test-db route:', error);
        res.status(500).json({ error: 'Failed to connect to database via route', details: error.message });
    }
});

// User Registration Route (for Medical Staff)
app.post('/api/register', async (req, res) => {
    const { username, password, email, phone_number, full_name } = req.body;

    if (!username || !password || !email || !full_name) {
        return res.status(400).json({ message: 'All required fields (username, password, email, full_name) must be provided.' });
    }

    try {
        const existingUser = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ message: 'Username or Email already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            'INSERT INTO users (username, password_hash, email, phone_number, full_name, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email, full_name, role, is_verified',
            [username, passwordHash, email, phone_number, full_name, 'medical_staff']
        );

        res.status(201).json({
            message: 'Medical staff registered successfully. Awaiting admin verification.',
            user: {
                id: newUser.rows[0].id, username: newUser.rows[0].username, email: newUser.rows[0].email,
                full_name: newUser.rows[0].full_name, role: newUser.rows[0].role, is_verified: newUser.rows[0].is_verified
            }
        });

    } catch (error) {
        console.error('Error during medical staff registration:', error);
        res.status(500).json({ message: 'Server error during registration.', error: error.message });
    }
});

// User Login Route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        if (user.role === 'medical_staff' && !user.is_verified) {
            return res.status(403).json({ message: 'Account not yet verified by an administrator.' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({
            message: 'Login successful!',
            token: token,
            user: {
                id: user.id, username: user.username, email: user.email,
                full_name: user.full_name, role: user.role, is_verified: user.is_verified
            }
        });

    } catch (error) {
        console.error('Error during user login:', error);
        res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
});

// Admin Verification Route
app.patch('/api/admin/verify-medical-staff/:id', auth, authorizeRoles('admin'), async (req, res) => {
    const userId = req.params.id;
    const { suspend } = req.body; // Expect { suspend: true/false } from the admin UI

    try {
        const userResult = await pool.query('SELECT id, username, role, is_verified FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'Medical staff user not found.' });
        }
        if (user.role !== 'medical_staff') {
            return res.status(400).json({ message: 'Cannot verify this user: not a medical staff.' });
        }
        if (user.is_verified === !suspend) { // Check if desired state is already current state
            return res.status(400).json({ message: `Medical staff already ${!suspend ? 'verified' : 'suspended'}.` });
        }

        const newIsVerified = !suspend; // If suspend is true, newIsVerified is FALSE (suspended/unverified state)

        const updatedUser = await pool.query(
            'UPDATE users SET is_verified = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, email, full_name, role, is_verified',
            [newIsVerified, userId]
        );

        res.status(200).json({
            message: `Medical staff ${updatedUser.rows[0].username} (ID: ${updatedUser.rows[0].id}) successfully ${newIsVerified ? 'activated/verified' : 'suspended'}.`,
            user: updatedUser.rows[0]
        });

    } catch (error) {
        console.error('Error during medical staff verification/suspension:', error);
        res.status(500).json({ message: 'Server error during verification/suspension.', error: error.message });
    }
});


// Patient Management Routes
app.post('/api/patients', auth, authorizeRoles('medical_staff', 'admin'), async (req, res) => {
    const {
        patient_name, gender, contact_email, contact_phone_number,
        radiographer_name, radiologist_name, remarks,
        age, weight_kg, referral_hospital, referring_doctor,
        payment_type,
        examinations // Array of { name, amount }
    } = req.body;
    const recordedByStaffId = req.user.id;

    if (!patient_name || !examinations || examinations.length === 0) {
        return res.status(400).json({ message: 'Patient name and at least one examination are required.' });
    }

    try {
        const serialNumber = `SN-${Date.now()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
        let mriCode = generateMriCode();
        // Basic check for uniqueness (for both serial and MRI code)
        let uniqueCheck = await pool.query('SELECT id FROM mri_patients WHERE mri_code = $1 OR serial_number = $2', [mriCode, serialNumber]);
        while (uniqueCheck.rows.length > 0) {
            mriCode = generateMriCode();
            uniqueCheck = await pool.query('SELECT id FROM mri_patients WHERE mri_code = $1', [mriCode]); // Check MRI code alone, serial will be unique enough by timestamp/random
            serialNumber = `SN-${Date.now()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`; // Re-generate serial too
        }

        const receiptNumber = generateReceiptNumber();
        const totalAmount = examinations.reduce((sum, exam) => sum + parseFloat(exam.amount || 0), 0);
        // Assuming 'examination_breakdown_amount_naira' is the sum of examination amounts
        const examinationBreakdownAmountNaira = totalAmount; // Based on your previous request

        // Start a database transaction for atomicity (all or nothing)
        const client = await pool.connect();
        try {
            await client.query('BEGIN'); // Start transaction

            const newPatientResult = await client.query(
                `INSERT INTO mri_patients (
                    serial_number, patient_name, gender, contact_email, contact_phone_number,
                    mri_code, recorded_by_staff_id, radiographer_name, radiologist_name, remarks,
                    age, weight_kg, referral_hospital, referring_doctor,
                    total_amount, receipt_number, payment_type, payment_status,
                    examination_test_name, examination_breakdown_amount_naira
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                RETURNING *`, // Return all columns of the new row
                [
                    serialNumber, patient_name, gender, contact_email, contact_phone_number,
                    mriCode, recordedByStaffId, radiographer_name, radiologist_name, remarks,
                    age, parseFloat(weight_kg), referral_hospital, referring_doctor, // Ensure weight is parsed
                    totalAmount, receiptNumber, payment_type, 'Not Paid', // Default status
                    examinations.map(e => e.name).join(', '), // Concatenate examination names
                    examinationBreakdownAmountNaira // The new column
                ]
            );
            const newPatient = newPatientResult.rows[0];

            // Insert associated examinations (into patient_examinations, not mri_patients table)
            // You had `patient_examinations` in your existing code, so I'm keeping that logic
            for (const exam of examinations) {
                await client.query(
                    'INSERT INTO patient_examinations (patient_id, exam_name, exam_amount) VALUES ($1, $2, $3)',
                    [newPatient.id, exam.name, parseFloat(exam.amount || 0)] // Ensure amount is parsed
                );
            }

            await client.query('COMMIT'); // Commit transaction if all successful

            res.status(201).json({
                message: 'Patient record logged successfully!',
                patient: newPatient
            });

        } catch (transactionError) {
            await client.query('ROLLBACK'); // Rollback transaction on any error
            throw transactionError; // Re-throw to be caught by outer catch
        } finally {
            client.release(); // Release client connection back to pool
        }
    } catch (error) {
        console.error('Error logging patient record (outer catch):', error);
        res.status(500).json({ message: 'Server error while logging patient record.', error: error.message });
    }
});

// GET all MRI patients with search and filter options
app.get('/api/patients', auth, authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'), async (req, res) => {
    try {
        const { search, searchField, gender, recordedBy, startDate, endDate } = req.query;

        let query = `
            SELECT
                mp.*,
                u.full_name AS recorded_by_staff_name
            FROM
                mri_patients mp
            LEFT JOIN users u ON mp.recorded_by_staff_id = u.id
            WHERE 1=1 -- A true condition to easily append AND clauses
        `;
        const queryParams = [];
        let paramIndex = 1;

        // Search by keyword in specific fields
        if (search && search.trim() !== '') {
            const searchTerm = `%${search.trim()}%`;
            if (searchField === 'patient_name') {
                query += ` AND mp.patient_name ILIKE $${paramIndex++}`;
                queryParams.push(searchTerm);
            } else if (searchField === 'mri_code') {
                query += ` AND mp.mri_code ILIKE $${paramIndex++}`;
                queryParams.push(searchTerm);
            } else {
                // Default to searching both if no specific field is provided or field is invalid
                query += ` AND (mp.patient_name ILIKE $${paramIndex++} OR mp.mri_code ILIKE $${paramIndex++})`;
                queryParams.push(searchTerm, searchTerm);
            }
        }

        // Filter by gender
        if (gender && gender !== 'All') {
            query += ` AND mp.gender = $${paramIndex++}`;
            queryParams.push(gender);
        }

        // Filter by recordedBy staff ID
        if (recordedBy) {
            query += ` AND mp.recorded_by_staff_id = $${paramIndex++}`;
            queryParams.push(recordedBy);
        }

        // Filter by date range (mri_date_time)
        if (startDate) {
            query += ` AND mp.mri_date_time >= $${paramIndex++}`;
            queryParams.push(startDate); // Assuming startDate is in 'YYYY-MM-DD' format
        }
        if (endDate) {
            query += ` AND mp.mri_date_time <= $${paramIndex++}`;
            queryParams.push(`${endDate} 23:59:59`); // Include the whole end day
        }

        query += ` ORDER BY mp.mri_date_time DESC`; // Always order by date

        const result = await pool.query(query, queryParams);
        res.status(200).json(result.rows);

    } catch (error) {
        console.error('Error fetching patients with search/filter:', error);
        res.status(500).json({ message: 'Server error fetching patients.', error: error.message });
    }
});


// Get Single Patient Record by ID
app.get('/api/patients/:patientId', auth, authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'), async (req, res) => { // Consistent param name, added roles
    const patientId = req.params.patientId; // Changed from :id to :patientId

    try {
        // Fetch patient details and the recording/approving staff's names
        const patientResult = await pool.query(`
            SELECT
                mp.*, -- All columns from mri_patients
                u_rec.full_name AS recorded_by_staff_name,
                u_rec.username AS recorded_by_staff_username,
                u_rec.email AS recorded_by_staff_email,
                u_approver.full_name AS approved_by_staff_name,
                u_approver.username AS approved_by_staff_username
            FROM
                mri_patients mp
            LEFT JOIN -- Use LEFT JOIN in case recording staff or approver is deleted
                users u_rec ON mp.recorded_by_staff_id = u_rec.id
            LEFT JOIN
                users u_approver ON mp.approved_by_user_id = u_approver.id
            WHERE
                mp.id = $1
        `, [patientId]);
        const patient = patientResult.rows[0];

        if (!patient) {
            return res.status(404).json({ message: 'Patient record not found.' });
        }

        // Fetch associated examinations for this patient
        const examinationsResult = await pool.query('SELECT id, exam_name, exam_amount FROM patient_examinations WHERE patient_id = $1', [patientId]);
        patient.examinations = examinationsResult.rows; // Attach examinations array to patient object

        res.status(200).json(patient);

    } catch (error) {
        console.error('Error fetching single patient record:', error);
        res.status(500).json({ message: 'Server error fetching patient record.', error: error.message });
    }
});

// NEW: Endpoint to get a list of medical staff for filtering (optional, but helpful for frontend)
app.get('/api/staff-list', auth, authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'), async (req, res) => {
    try {
        const staffList = await pool.query(`
            SELECT id, full_name, username
            FROM users
            WHERE role = 'medical_staff' OR role = 'admin' OR role = 'doctor'
            ORDER BY full_name ASC
        `);
        res.status(200).json(staffList.rows);
    } catch (error) {
        console.error('Error fetching staff list:', error);
        res.status(500).json({ message: 'Server error fetching staff list for filter.', error: error.message });
    }
});

// --- Patient Results Dashboard Analytics Routes ---

// Get summary of patient results (total, by status)
app.get('/api/analytics/results-summary', auth, authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'), async (req, res) => {
    try {
        const totalResults = await pool.query('SELECT COUNT(*) AS total_results FROM patient_results_files'); // Corrected table name
        const pendingResults = await pool.query('SELECT COUNT(*) AS pending_results FROM patient_results_files WHERE result_status = \'pending_review\''); // Corrected
        const finalResults = await pool.query('SELECT COUNT(*) AS final_results FROM patient_results_files WHERE result_status = \'final\''); // Corrected
        const issuedResults = await pool.query('SELECT COUNT(*) AS issued_results FROM patient_results_files WHERE result_status = \'issued\''); // Corrected

        res.status(200).json({
            total_results: parseInt(totalResults.rows[0].total_results) || 0,
            pending_results: parseInt(pendingResults.rows[0].pending_results) || 0,
            final_results: parseInt(finalResults.rows[0].final_results) || 0,
            issued_results: parseInt(issuedResults.rows[0].issued_results) || 0,
        });

    } catch (error) {
        console.error('Error fetching results summary:', error);
        res.status(500).json({ message: 'Server error fetching results summary.', error: error.message });
    }
});

// Get recent patient results (e.g., last 10)
app.get('/api/analytics/recent-results', auth, authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'), async (req, res) => {
    try {
        const recentResults = await pool.query(`
            SELECT
                prf.file_id, 
                prf.file_name,
                prf.file_type, 
                prf.result_status,
                prf.created_at, 
                mp.patient_name,
                u_uploader.full_name AS uploaded_by_name
            FROM
                patient_results_files prf 
            LEFT JOIN
                mri_patients mp ON prf.patient_id = mp.id
            LEFT JOIN
                users u_uploader ON prf.uploaded_by_user_id = u_uploader.id
            ORDER BY
                prf.created_at DESC
            LIMIT 10
        `);
        res.status(200).json(recentResults.rows);

    } catch (error) {
        console.error('Error fetching recent results:', error);
        res.status(500).json({ message: 'Server error fetching recent results.', error: error.message });
    }
});

// Update Patient Record (Medical Staff & Admin Access)
app.patch('/api/patients/:patientId', auth, authorizeRoles('medical_staff', 'admin'), async (req, res) => { // Consistent param name
    const patientId = req.params.patientId;
    const {
        patient_name, gender, contact_email, contact_phone_number,
        radiographer_name, radiologist_name, remarks,
        age, weight_kg, referral_hospital, referring_doctor,
        payment_type,
        examinations // Array of { id (optional, for existing), name, amount }
    } = req.body;

    try {
        const existingPatientResult = await pool.query('SELECT * FROM mri_patients WHERE id = $1', [patientId]);
        if (existingPatientResult.rows.length === 0) {
            return res.status(404).json({ message: 'Patient record not found.' });
        }

        const client = await pool.connect(); // Start transaction
        try {
            await client.query('BEGIN');

            // 1. Prepare fields for mri_patients table update
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;

            if (patient_name !== undefined) { updateFields.push(`patient_name = $${paramIndex++}`); queryParams.push(patient_name); }
            if (gender !== undefined) { updateFields.push(`gender = $${paramIndex++}`); queryParams.push(gender); }
            if (contact_email !== undefined) { updateFields.push(`contact_email = $${paramIndex++}`); queryParams.push(contact_email); }
            if (contact_phone_number !== undefined) { updateFields.push(`contact_phone_number = $${paramIndex++}`); queryParams.push(contact_phone_number); }
            if (radiographer_name !== undefined) { updateFields.push(`radiographer_name = $${paramIndex++}`); queryParams.push(radiographer_name); }
            if (radiologist_name !== undefined) { updateFields.push(`radiologist_name = $${paramIndex++}`); queryParams.push(radiologist_name); }
            if (remarks !== undefined) { updateFields.push(`remarks = $${paramIndex++}`); queryParams.push(remarks); }
            if (age !== undefined) { updateFields.push(`age = $${paramIndex++}`); queryParams.push(age); }
            if (weight_kg !== undefined) { updateFields.push(`weight_kg = $${paramIndex++}`); queryParams.push(parseFloat(weight_kg)); } // Parse weight
            if (referral_hospital !== undefined) { updateFields.push(`referral_hospital = $${paramIndex++}`); queryParams.push(referral_hospital); }
            if (referring_doctor !== undefined) { updateFields.push(`referring_doctor = $${paramIndex++}`); queryParams.push(referring_doctor); }
            if (payment_type !== undefined) { updateFields.push(`payment_type = $${paramIndex++}`); queryParams.push(payment_type); }

            let recalculatedTotalAmount = 0;
            let recalculatedBreakdownAmount = 0; // For examination_breakdown_amount_naira

            // 2. Handle examinations update/insert/delete (if provided)
            if (examinations !== undefined && Array.isArray(examinations)) {
                // Fetch existing examination IDs for this patient
                const existingExamsResult = await client.query('SELECT id, exam_name, exam_amount FROM patient_examinations WHERE patient_id = $1', [patientId]);
                const existingExamIds = new Set(existingExamsResult.rows.map(row => row.id));
                const updatedExamIds = new Set();

                for (const exam of examinations) {
                    const examAmount = parseFloat(exam.amount || 0);
                    recalculatedTotalAmount += examAmount; // Recalculate total
                    recalculatedBreakdownAmount += examAmount; // Recalculate breakdown

                    if (exam.id) { // If examination has an ID, it's an existing one - update it
                        updatedExamIds.add(exam.id);
                        await client.query(
                            'UPDATE patient_examinations SET exam_name = $1, exam_amount = $2 WHERE id = $3 AND patient_id = $4',
                            [exam.name, examAmount, exam.id, patientId]
                        );
                    } else { // If no ID, it's a new examination - insert it
                        await client.query(
                            'INSERT INTO patient_examinations (patient_id, exam_name, exam_amount) VALUES ($1, $2, $3)',
                            [patientId, exam.name, examAmount]
                        );
                    }
                }

                // Delete examinations that were in DB but not in the updated array
                for (const existingId of existingExamIds) {
                    if (!updatedExamIds.has(existingId)) {
                        await client.query('DELETE FROM patient_examinations WHERE id = $1 AND patient_id = $2', [existingId, patientId]);
                    }
                }
                // Also update `examination_test_name` on the `mri_patients` table
                updateFields.push(`examination_test_name = $${paramIndex++}`);
                queryParams.push(examinations.map(e => e.name).join(', '));
            } else {
                // If 'examinations' array is not provided, keep current total_amount and breakdown amount
                recalculatedTotalAmount = existingPatientResult.rows[0].total_amount;
                recalculatedBreakdownAmount = existingPatientResult.rows[0].examination_breakdown_amount_naira;
                // If examinations are not provided, we don't update examination_test_name
            }

            // Update total_amount and examination_breakdown_amount_naira in mri_patients
            updateFields.push(`total_amount = $${paramIndex++}`);
            queryParams.push(recalculatedTotalAmount);
            updateFields.push(`examination_breakdown_amount_naira = $${paramIndex++}`);
            queryParams.push(recalculatedBreakdownAmount);


            if (updateFields.length === 0) { // If no fields were provided for update (and no examinations were sent)
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'No valid fields or examinations provided for update.' });
            }

            queryParams.push(patientId); // Last parameter for WHERE clause

            const updatedPatientResult = await client.query(
                `UPDATE mri_patients SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
                queryParams
            );
            const updatedPatient = updatedPatientResult.rows[0];

            // Fetch updated examinations to return in the response
            const updatedExamsResult = await client.query('SELECT id, exam_name, exam_amount FROM patient_examinations WHERE patient_id = $1 ORDER BY id ASC', [patientId]);
            updatedPatient.examinations = updatedExamsResult.rows; // Attach them to the patient object

            await client.query('COMMIT'); // Commit transaction if all successful

            res.status(200).json({
                message: 'Patient record updated successfully!',
                patient: updatedPatient
            });

        } catch (transactionError) {
            await client.query('ROLLBACK'); // Rollback transaction on any error
            throw transactionError; // Re-throw to be caught by outer catch
        } finally {
            client.release(); // Release client connection back to pool
        }
    } catch (error) {
        console.error('Error updating patient record (outer catch):', error);
        res.status(500).json({ message: 'Server error while updating patient record.', error: error.message });
    }
});

app.patch('/api/patients/:patientId/approve-payment', auth, authorizeRoles('admin', 'medical_staff', 'financial_admin'), async (req, res) => { // Consistent param name, added financial_admin
    const patientId = req.params.patientId;
    const { status } = req.body; // Expect { status: 'Approved' | 'Pending' | 'Not Paid' }
    const approverId = req.user.id; // The authenticated user performing the approval

    // Validate incoming status
    const validStatuses = ['Approved', 'Pending', 'Not Paid'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid payment status provided. Must be Approved, Pending, or Not Paid.' });
    }

    try {
        const patient = await pool.query('SELECT id, payment_status FROM mri_patients WHERE id = $1', [patientId]);
        if (patient.rows.length === 0) {
            return res.status(404).json({ message: 'Patient record not found.' });
        }

        let updateFields = [`payment_status = $1`, `updated_at = CURRENT_TIMESTAMP`];
        let queryParams = [status];
        let paramIndex = 2;

        if (status === 'Approved') {
            updateFields.push(`approved_by_user_id = $${paramIndex++}`);
            queryParams.push(approverId);
            updateFields.push(`approved_at = $${paramIndex++}`);
            queryParams.push(new Date());
        } else { // If status is not Approved, clear approval details
            updateFields.push(`approved_by_user_id = NULL`);
            updateFields.push(`approved_at = NULL`);
        }

        queryParams.push(patientId); // Last parameter for WHERE clause

        const updatedPatientResult = await pool.query(
            `UPDATE mri_patients SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            queryParams
        );

        res.status(200).json({
            message: `Payment status for patient ${updatedPatientResult.rows[0].patient_name} updated to "${status}".`,
            patient: updatedPatientResult.rows[0]
        });

    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ message: 'Server error updating payment status.', error: error.message });
    }
});

// Delete Patient Record (Admin Only) - Requires 'admin' role
app.delete('/api/patients/:patientId', auth, authorizeRoles('admin'), async (req, res) => { // Consistent param name
    const patientId = req.params.patientId;

    try {
        // Check if patient exists before attempting deletion
        const existingPatient = await pool.query('SELECT id FROM mri_patients WHERE id = $1', [patientId]);
        if (existingPatient.rows.length === 0) {
            return res.status(404).json({ message: 'Patient record not found.' });
        }

        // Perform deletion
        const deletedPatient = await pool.query('DELETE FROM mri_patients WHERE id = $1 RETURNING id, patient_name', [patientId]);

        res.status(200).json({ message: `Patient record ${deletedPatient.rows[0].patient_name} (ID: ${deletedPatient.rows[0].id}) successfully deleted.` });

    } catch (error) {
        console.error('Error deleting patient record:', error);
        if (error.code === '23503') {
            return res.status(409).json({ message: 'Cannot delete user: this user has recorded patient data. Please reassign their records first (feature to be implemented).' });
        }
        res.status(500).json({ message: 'Server error deleting patient record.', error: error.message });
    }
});

// --- Patient Result Management Routes (Consolidated and Corrected) ---

// Upload a patient result file
app.post('/api/patients/:patientId/results/upload', auth, authorizeRoles('admin', 'medical_staff', 'doctor'), upload.single('resultFile'), async (req, res) => { // Added doctor role
    const patientId = req.params.patientId; // Consistent parameter name
    const uploadedByUserId = req.user.id;
    const { remarks } = req.body; // Remarks should be part of the form data

    const file = req.file; // This 'file' object is populated by Multer

    if (!file) {
        return res.status(400).json({ message: 'No file uploaded. Please select a file.' });
    }

    try {
        // 1. Verify if patient exists
        const patientExists = await pool.query('SELECT id FROM mri_patients WHERE id = $1', [patientId]);
        if (patientExists.rows.length === 0) {
            // If patient not found, delete the uploaded file from disk
            await fs.unlink(file.path); // file.path is absolute path provided by Multer
            return res.status(404).json({ message: 'Patient not found. File not saved.' });
        }

        // 2. Save file details to patient_results_files table
        // file.filename is the name generated by Multer (e.g., patientId_timestamp_originalName.ext)
        // Stored path relative to UPLOADS_BASE_DIR (e.g., 'results/patientId_timestamp_originalName.ext')
        const storedRelativeFilePath = path.join('results', file.filename);

        const newResultRecord = await pool.query( // Using 'newResultRecord' for clarity
            `INSERT INTO patient_results_files (patient_id, uploaded_by_user_id, file_name, file_path, file_type, file_size_kb, result_status, remarks)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending_review', $7)
             RETURNING *`, // Ensure this returns all columns, including 'file_id'
            [patientId, uploadedByUserId, file.originalname, storedRelativeFilePath, file.mimetype, Math.round(file.size / 1024), remarks]
        );

        // 3. Trigger Real-time Notification to Admins for New Result Upload
        try {
            const adminUsers = await pool.query('SELECT id FROM users WHERE role = \'admin\'');
            const notificationMessage = `New result uploaded for Patient (ID: ${patientId}) by ${req.user.username}. File: ${file.originalname}.`;
            for (const admin of adminUsers.rows) {
                const notifResult = await pool.query(
                    `INSERT INTO notifications (user_id, type, message, related_entity_id, related_entity_type) VALUES ($1, 'new_result_upload', $2, $3, 'patient_result') RETURNING *`,
                    [admin.id, notificationMessage, newResultRecord.rows[0].file_id] // Use file_id for notification
                );
                const adminSocketId = connectedUsers.get(admin.id);
                if (adminSocketId) {
                    io.to(adminSocketId).emit('new_notification', notifResult.rows[0]);
                    console.log(`Emitted real-time notification to admin ${admin.id} for new result upload.`);
                }
            }
        } catch (notifError) {
            console.error('Error triggering new result upload notification:', notifError);
        }

        res.status(201).json({
            message: 'Result uploaded successfully!',
            resultFile: newResultRecord.rows[0] // Return the new record with its file_id
        });

    } catch (error) {
        console.error('Error uploading result file:', error);
        // If any error occurs (DB save failed, etc.), delete the uploaded file from disk to prevent junk files
        if (file) await fs.unlink(file.path); // file.path is the absolute temporary path from Multer
        res.status(500).json({ message: 'Server error uploading result file.', error: error.message });
    }
});

// Get all results for a specific patient
app.get('/api/patients/:patientId/results', auth, authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'), async (req, res) => {
    const patientId = req.params.patientId; // Consistent parameter name
    try {
        const results = await pool.query(`
            SELECT
                prf.file_id,
                prf.patient_id,
                prf.file_name,
                prf.file_path,
                prf.file_type,
                prf.result_status,
                prf.issued_to_recipient_name,
                prf.issued_to_recipient_phone,
                prf.issued_to_recipient_relationship,
                prf.issued_to_recipient_email,
                prf.issued_by_user_id,
                prf.created_at,
                prf.remarks,
                u_up.full_name AS uploaded_by_name,
                u_is.full_name AS issued_by_name
            FROM
                patient_results_files prf
            LEFT JOIN users u_up ON prf.uploaded_by_user_id = u_up.id
            LEFT JOIN users u_is ON prf.issued_by_user_id = u_is.id
            WHERE prf.patient_id = $1
            ORDER BY prf.created_at DESC
        `, [patientId]);
        res.status(200).json(results.rows);
    } catch (error) {
        console.error('Error fetching patient results:', error);
        res.status(500).json({ message: 'Server error fetching patient results.', error: error.message });
    }
});

// Download a specific result file
app.get('/api/patients/results/:fileId/download', auth, authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'), async (req, res) => {
    const fileId = req.params.fileId; // Consistent parameter name
    try {
        const resultFileRecord = await pool.query('SELECT file_path, file_name, file_type FROM patient_results_files WHERE file_id = $1', [fileId]); // Query 'patient_results_files' and select 'file_type'
        const file = resultFileRecord.rows[0];

        if (!file) {
            console.error(`Download failed: Result record with file_id ${fileId} not found in DB.`);
            return res.status(404).json({ message: 'Result file not found in database.' });
        }

        // Construct the full, absolute path on the server's disk
        // file.file_path from DB is now 'results/filename.ext'
        // UPLOADS_BASE_DIR is 'mri-erp-app/backend/uploads'
        // path.join(UPLOADS_BASE_DIR, file.file_path) will be 'mri-erp-app/backend/uploads/results/filename.ext'
        const absoluteFilePath = path.join(UPLOADS_BASE_DIR, file.file_path);

        console.log("--- DEBUG DOWNLOAD PATH ---"); // Keep these logs for critical debugging
        console.log("1. fileId from URL:", fileId);
        console.log("2. file object from DB (download route):", file);
        console.log("3. DB file_path value:", file.file_path);
        console.log("4. UPLOADS_BASE_DIR:", UPLOADS_BASE_DIR);
        console.log("5. Full constructed file path (for fs.access):", absoluteFilePath);

        try {
            await fs.access(absoluteFilePath); // Checks if file is accessible (exists and permissions are okay)
            console.log(`6. SUCCESS: File DOES exist at physical path: ${absoluteFilePath}`);
        } catch (err) {
            console.error(`6. ERROR: File not found on disk or inaccessible: ${absoluteFilePath}`, err);
            return res.status(404).json({ message: 'File not found on server disk or access denied.' });
        }

        // Set response headers for file download
        res.setHeader('Content-Type', file.file_type || 'application/octet-stream'); // Use stored file_type
        res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`); // Suggests original filename for download

        // Express's res.download method sends the file
        res.download(absoluteFilePath, file.file_name, (err) => {
            if (err) {
                console.error('Error serving file via res.download:', err);
                if (!res.headersSent) { // Only send error response if headers haven't been sent yet
                    res.status(500).json({ message: 'Error downloading file.' });
                }
            }
        });

    } catch (error) {
        console.error('Error retrieving file for download:', error);
        res.status(500).json({ message: 'Server error retrieving file for download.', error: error.message });
    }
});


// Update result status (e.g., 'pending_review' to 'final')
app.patch('/api/patients/results/:fileId/status', auth, authorizeRoles('admin', 'medical_staff', 'doctor', 'financial_admin'), async (req, res) => { // Consistent param name, added roles
    const fileId = req.params.fileId; // Consistent parameter name
    const { status } = req.body; // Expects { status: 'pending_review' | 'final' | 'issued' }

    const validStatuses = ['pending_review', 'final', 'issued'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid result status provided.' });
    }

    try {
        const updatedResult = await pool.query(
            'UPDATE patient_results_files SET result_status = $1, updated_at = CURRENT_TIMESTAMP WHERE file_id = $2 RETURNING *', // Update 'patient_results_files' and use 'file_id'
            [status, fileId]
        );
        if (updatedResult.rows.length === 0) {
            return res.status(404).json({ message: 'Result not found.' });
        }
        res.status(200).json({ message: 'Result status updated successfully.', result: updatedResult.rows[0] });
    } catch (error) {
        console.error('Error updating result status:', error);
        res.status(500).json({ message: 'Server error updating result status.', error: error.message });
    }
});

// Mark result as issued to recipient
app.patch('/api/patients/results/:fileId/issue', auth, authorizeRoles('admin', 'medical_staff', 'doctor', 'financial_admin'), async (req, res) => { // Consistent param name, added roles
    const fileId = req.params.fileId; // Consistent parameter name
    const { recipient_name, recipient_phone, recipient_relationship, recipient_email } = req.body; // Destructure all recipient fields
    const issuedByUserId = req.user.id; // Authenticated user who issues the result

    if (!recipient_name || recipient_name.trim() === '') {
        return res.status(400).json({ message: 'Recipient name is required to issue result.' });
    }

    try {
        const updatedResult = await pool.query(
            `UPDATE patient_results_files SET
                result_status = 'issued',
                issued_to_recipient_name = $1,
                issued_to_recipient_phone = $2,
                issued_to_recipient_relationship = $3,
                issued_to_recipient_email = $4,
                issued_by_user_id = $5,
                issued_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
             WHERE file_id = $6 RETURNING *`,
            [recipient_name, recipient_phone, recipient_relationship, recipient_email, issuedByUserId, fileId]
        );
        if (updatedResult.rows.length === 0) {
            return res.status(404).json({ message: 'Result not found or status could not be updated.' });
        }

        // --- Trigger Notification for Result Issued ---
        try {
            const patientId = updatedResult.rows[0].patient_id;
            const patientRecord = await pool.query('SELECT patient_name FROM mri_patients WHERE id = $1', [patientId]);
            const patientName = patientRecord.rows[0]?.patient_name || 'Unknown Patient';

            const notificationMessage = `Result for Patient "${patientName}" (ID: ${patientId}) has been issued to ${recipient_name}.`;
            const adminUsers = await pool.query('SELECT id FROM users WHERE role = \'admin\'');
            for (const admin of adminUsers.rows) {
                const notifResult = await pool.query(
                    `INSERT INTO notifications (user_id, type, message, related_entity_id, related_entity_type) VALUES ($1, 'result_issued', $2, $3, 'patient_result') RETURNING *`,
                    [admin.id, notificationMessage, updatedResult.rows[0].file_id] // Use file_id for notification
                );
                const adminSocketId = connectedUsers.get(admin.id);
                if (adminSocketId) {
                    io.to(adminSocketId).emit('new_notification', notifResult.rows[0]);
                    console.log(`Emitted notification to admin ${admin.id} for result issued.`);
                }
            }
        } catch (notifError) {
            console.error('Error triggering result issued notification:', notifError);
        }
        // --- END Notification Trigger ---

        res.status(200).json({ message: 'Result marked as issued successfully.', result: updatedResult.rows[0] });
    } catch (error) {
        console.error('Error issuing result:', error);
        res.status(500).json({ message: 'Server error issuing result.', error: error.message });
    }
});


// --- Invoice Generation Endpoint ---
// This route now uses the 'patient_examinations' table for invoice items
app.get('/api/patients/:patientId/invoice', auth, authorizeRoles('medical_staff', 'admin', 'financial_admin'), async (req, res) => { // Added financial_admin role
    const patientId = req.params.patientId; // Consistent patientId parameter name

    try {
        // 1. Fetch Patient Data (and staff who recorded it) from database
        const patientResult = await pool.query(`
            SELECT
                mp.*,
                u_rec.full_name AS recorded_by_staff_name,
                u_rec.username AS recorded_by_staff_username
            FROM
                mri_patients mp
            LEFT JOIN
                users u_rec ON mp.recorded_by_staff_id = u_rec.id
            WHERE
                mp.id = $1
        `, [patientId]);
        const patient = patientResult.rows[0];

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found for invoice generation.' });
        }

        // Fetch associated examinations to dynamically build invoice items
        const examinationsResult = await pool.query('SELECT exam_name, exam_amount FROM patient_examinations WHERE patient_id = $1', [patientId]);
        const examinationItems = examinationsResult.rows.map(exam => ({
            description: exam.exam_name,
            quantity: 1, // Always 1 for an examination item
            unitPrice: parseFloat(exam.exam_amount),
            amount: parseFloat(exam.amount)
        }));

        // Use patient.total_amount for the sum from the DB if it's reliable
        const invoiceTotalAmount = patient.total_amount;


        // 2. Prepare dynamic invoice data object
        const invoiceData = {
            invoiceId: `INV-${new Date().getFullYear()}-${String(patient.id).padStart(4, '0')}`,
            invoiceDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            mriCode: patient.mri_code,
            patientName: patient.patient_name,
            patientGender: patient.gender,
            patientContact: `${patient.contact_email || 'N/A'} / ${patient.contact_phone_number || 'N/A'}`,
            items: examinationItems.length > 0 ? examinationItems : [{ description: 'No examinations recorded', quantity: 1, unitPrice: 0, amount: 0 }],
            totalAmount: parseFloat(invoiceTotalAmount || 0).toFixed(2), // Ensure it's a number and formatted
            patientRemarks: patient.remarks || 'N/A',
            radiographerName: patient.radiographer_name || 'N/A',
            radiologistName: patient.radiologist_name || 'N/A',
            recordedByStaffName: patient.recorded_by_staff_name || 'N/A',
        };


        // 3. Read the HTML template file
        const templatePath = path.join(__dirname, '../invoice_templates', 'invoice.html');
        let htmlContent = await fs.readFile(templatePath, 'utf8');

        // 4. Launch Puppeteer browser and generate PDF
        const browser = await puppeteer.launch({
            headless: true, // Run in headless mode (no browser UI)
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Recommended for Docker/Linux environments
        });
        const page = await browser.newPage();

        // Set the HTML content and evaluate the JavaScript function to inject data
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' }); // Wait for network to be idle
        await page.evaluate(data => {
            // This 'populateInvoice' function is defined in invoice.html
            // It will fill the HTML elements with the passed 'data'
            // Ensure this function exists in your invoice.html and handles all passed data
            if (window.populateInvoice) {
                window.populateInvoice(data);
            } else {
                console.error("populateInvoice function not found in HTML template.");
                // Fallback: manually inject data if populateInvoice isn't there
                // This is a minimal fallback, ideally invoice.html has proper IDs
                document.getElementById('invoice-id').innerText = data.invoiceId;
                document.getElementById('invoice-date').innerText = data.invoiceDate;
                document.getElementById('mri-code').innerText = data.mriCode;
                document.getElementById('patient-name').innerText = data.patientName;
                document.getElementById('patient-gender').innerText = data.patientGender;
                document.getElementById('patient-contact').innerText = data.patientContact;

                const itemsTableBody = document.getElementById('invoice-items-body');
                if (itemsTableBody) {
                    itemsTableBody.innerHTML = ''; // Clear existing
                    data.items.forEach(item => {
                        const row = `<tr>
                            <td>${item.description}</td>
                            <td>${item.quantity}</td>
                            <td>₦${item.unitPrice.toFixed(2)}</td>
                            <td>₦${item.amount.toFixed(2)}</td>
                        </tr>`;
                        itemsTableBody.innerHTML += row;
                    });
                }
                document.getElementById('total-amount').innerText = `₦${data.totalAmount}`;
                document.getElementById('patient-remarks').innerText = data.patientRemarks;
                document.getElementById('radiographer-name').innerText = data.radiographerName;
                document.getElementById('radiologist-name').innerText = data.radiologistName;
                document.getElementById('recorded-by-staff-name').innerText = data.recordedByStaffName;
            }

        }, invoiceData); // Pass the invoice data to the function inside the browser context

        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true, // Ensure background colors/images are printed
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' } // Adjust margins as needed
        });

        await browser.close(); // Close the browser to free up resources

        // 5. Send the PDF as a response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="invoice_${patient.mri_code}.pdf"`); // Forces download
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error generating invoice PDF:', error);
        res.status(500).json({ message: 'Server error generating invoice PDF.', error: error.message });
    }
});

// --- Analytics Routes ---
// Get total number of MRI patients
app.get('/api/analytics/total-patients', auth, authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'), async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) AS total_patients FROM mri_patients');
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching total patients:', error);
        res.status(500).json({ message: 'Server error fetching total patients.', error: error.message });
    }
});

// Get MRI patients count by gender
app.get('/api/analytics/patients-by-gender', auth, authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                gender,
                COUNT(*) AS count
            FROM
                mri_patients
            GROUP BY
                gender
            ORDER BY
                gender
        `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching patients by gender:', error);
        res.status(500).json({ message: 'Server error fetching patients by gender.', error: error.message });
    }
});

// Get MRI patients count by day (for the last 30 days)
app.get('/api/analytics/mris-by-day', auth, authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                DATE_TRUNC('day', mri_date_time) AS date,
                COUNT(*) AS count
            FROM
                mri_patients
            WHERE
                mri_date_time >= NOW() - INTERVAL '30 days'
            GROUP BY
                date
            ORDER BY
                date ASC
        `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching MRIs by day:', error);
        res.status(500).json({ message: 'Server error fetching MRIs by day.', error: error.message });
    }
});

// Get recent patient registrations (e.g., last 5)
app.get('/api/analytics/recent-patients', auth, authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id, patient_name, mri_code, mri_date_time
            FROM
                mri_patients
            ORDER BY
                mri_date_time DESC
            LIMIT 5
        `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching recent patients:', error);
        res.status(500).json({ message: 'Server error fetching recent patients.', error: error.message });
    }
});

// --- Admin User Management Routes (Admin-only) ---
// Get all medical staff users (for Admin to manage)
app.get('/api/admin/medical-staff', auth, authorizeRoles('admin'), async (req, res) => {
    try {
        const staffUsers = await pool.query('SELECT id, username, email, full_name, role, is_verified, created_at, updated_at FROM users WHERE role = \'medical_staff\' ORDER BY created_at DESC');
        res.status(200).json(staffUsers.rows);
    } catch (error) {
        console.error('Error fetching medical staff users for admin:', error);
        res.status(500).json({ message: 'Server error fetching medical staff users.', error: error.message });
    }
});

// --- Admin Staff Activity Analytics Route ---
app.get('/api/admin/analytics/staff-activity', auth, authorizeRoles('admin'), async (req, res) => {
    try {
        // Fetch data for all medical staff, including their patient logging count and query submission count
        const staffActivity = await pool.query(`
            SELECT
                u.id,
                u.username,
                u.full_name,
                u.email,
                u.is_verified,
                u.created_at AS user_created_at,
                COUNT(DISTINCT mp.id) AS patients_logged_count,
                COUNT(DISTINCT uq.id) AS queries_submitted_count,
                MAX(mp.mri_date_time) AS last_patient_logged_at,
                MAX(uq.created_at) AS last_query_submitted_at
            FROM
                users u
            LEFT JOIN
                mri_patients mp ON u.id = mp.recorded_by_staff_id
            LEFT JOIN
                user_queries uq ON u.id = uq.sender_id
            WHERE
                u.role = 'medical_staff' -- Only consider medical staff
            GROUP BY
                u.id, u.username, u.full_name, u.email, u.is_verified, u.created_at
            ORDER BY
                u.created_at ASC
        `);

        res.status(200).json(staffActivity.rows); // Send JSON response

    } catch (error) {
        console.error('Error fetching admin staff activity analytics:', error);
        res.status(500).json({ message: 'Server error fetching staff activity analytics.', error: error.message });
    }
});

// Suspend/Activate Medical Staff Account
app.patch('/api/admin/medical-staff/:id/status', auth, authorizeRoles('admin'), async (req, res) => {
    const userId = req.params.id;
    const { suspend } = req.body;

    if (typeof suspend !== 'boolean') {
        return res.status(400).json({ message: 'Invalid status provided. Expected boolean for "suspend".' });
    }

    try {
        const targetUserResult = await pool.query('SELECT id, username, role, is_verified FROM users WHERE id = $1', [userId]);
        const targetUser = targetUserResult.rows[0];

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found.' });
        }
        if (targetUser.role === 'admin') {
            return res.status(403).json({ message: 'Cannot suspend/activate another admin account.' });
        }
        if (targetUser.id === req.user.id) {
            return res.status(403).json({ message: 'Cannot suspend/activate your own account.' });
        }

        const newIsVerified = !suspend;

        const updatedUser = await pool.query(
            'UPDATE users SET is_verified = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, email, full_name, role, is_verified',
            [newIsVerified, userId]
        );

        res.status(200).json({
            message: `Medical staff ${updatedUser.rows[0].username} (ID: ${updatedUser.rows[0].id}) successfully ${newIsVerified ? 'activated' : 'suspended'}.`,
            user: updatedUser.rows[0]
        });

    } catch (error) {
        console.error('Error suspending/activating medical staff:', error);
        res.status(500).json({ message: 'Server error updating user status.', error: error.message });
    }
});

// Delete Medical Staff Account
app.delete('/api/admin/medical-staff/:id', auth, authorizeRoles('admin'), async (req, res) => {
    const userId = req.params.id;

    try {
        const targetUserResult = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        const targetUser = targetUserResult.rows[0];

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found.' });
        }
        if (targetUser.role === 'admin') {
            return res.status(403).json({ message: 'Cannot delete another admin account.' });
        }
        if (targetUser.id === req.user.id) {
            return res.status(403).json({ message: 'Cannot delete your own account.' });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [userId]);

        res.status(200).json({ message: `Medical staff user (ID: ${userId}) successfully deleted.` });

    } catch (error) {
        console.error('Error deleting medical staff:', error);
        if (error.code === '23503') {
            return res.status(409).json({ message: 'Cannot delete user: this user has recorded patient data. Please reassign their records first (feature to be implemented).' });
        }
        res.status(500).json({ message: 'Server error deleting user.', error: error.message });
    }
});

// --- Chat History API (Authenticated) ---
app.get('/api/chat/history', auth, authorizeRoles('medical_staff', 'admin'), async (req, res) => {
    try {
        const messages = await pool.query(`
            SELECT
                cm.id,
                cm.message,
                cm.timestamp,
                cm.sender_id,
                u.username AS sender_username,
                u.full_name AS sender_full_name
            FROM
                chat_messages cm
            JOIN
                users u ON cm.sender_id = u.id
            ORDER BY
                cm.timestamp ASC
            LIMIT 100
        `);
        res.status(200).json(messages.rows);
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ message: 'Server error fetching chat history.', error: error.message });
    }
});

// --- User Query Routes (Medical Staff & Admin) ---

// Submit a new query (Medical Staff only)
app.post('/api/queries', auth, authorizeRoles('medical_staff'), async (req, res) => {
    const { subject, message } = req.body;
    const senderId = req.user.id; // Sender is the authenticated user

    if (!subject || !message) {
        return res.status(400).json({ message: 'Subject and message are required for a query.' });
    }

    try {
        const newQuery = await pool.query(
            `INSERT INTO user_queries (sender_id, subject, message, status)
             VALUES ($1, $2, $3, 'open')
             RETURNING id, sender_id, subject, message, status, created_at`,
            [senderId, subject, message]
        );
        res.status(201).json({
            message: 'Query submitted successfully!',
            query: newQuery.rows[0]
        });

        // --- NEW: Trigger Notification to Admins (New Query) ---
        try {
            const adminUsers = await pool.query('SELECT id FROM users WHERE role = \'admin\'');
            const notificationMessage = `New query from ${req.user.username}: "${newQuery.rows[0].subject}".`;
            for (const admin of adminUsers.rows) {
                const notifResult = await pool.query(
                    `INSERT INTO notifications (user_id, type, message, related_entity_id, related_entity_type) VALUES ($1, 'new_query', $2, $3, 'query') RETURNING *`,
                    [admin.id, notificationMessage, newQuery.rows[0].id]
                );
                const adminSocketId = connectedUsers.get(admin.id);
                if (adminSocketId) {
                    io.to(adminSocketId).emit('new_notification', notifResult.rows[0]);
                    console.log(`Emitted real-time notification to admin ${admin.id} for new query.`);
                }
            }
        } catch (notifError) {
            console.error('Error triggering new query notification:', notifError);
        }
        // --- END NEW: Trigger Notification ---

    } catch (error) {
        console.error('Error submitting query:', error);
        res.status(500).json({ message: 'Server error submitting query.', error: error.message });
    }
});

// Get a user's own queries (Medical Staff & Admin)
app.get('/api/queries/my', auth, authorizeRoles('medical_staff', 'admin'), async (req, res) => {
    const userId = req.user.id;
    try {
        const myQueries = await pool.query(`SELECT
            uq.id, uq.subject, uq.message, uq.status, uq.admin_response,
            uq.created_at, uq.updated_at, uq.resolved_at,
            u_sender.username AS sender_username,
            u_sender.full_name AS sender_full_name,
            u_resolver.username AS resolver_username,
            u_resolver.full_name AS resolver_full_name
        FROM
            user_queries uq
        JOIN
            users u_sender ON uq.sender_id = u_sender.id
        LEFT JOIN
            users u_resolver ON uq.resolved_by_admin_id = u_resolver.id
        WHERE
            uq.sender_id = $1
        ORDER BY
            uq.created_at DESC
        `,[userId]); 
        res.status(200).json(myQueries.rows);
    } catch (error) {
        console.error('Error fetching user\'s own queries:', error);
        res.status(500).json({ message: 'Server error fetching your queries.', error: error.message });
    }
});

// Get all queries (Admin only)
app.get('/api/admin/queries', auth, authorizeRoles('admin'), async (req, res) => {
    try {
        const allQueries = await pool.query(`
            SELECT
                uq.id, uq.subject, uq.message, uq.status, uq.admin_response,
                uq.created_at, uq.updated_at, uq.resolved_at,
                u_sender.username AS sender_username,
                u_sender.full_name AS sender_full_name,
                u_resolver.username AS resolver_username,
                u_resolver.full_name AS resolver_full_name
            FROM
                user_queries uq
            JOIN
                users u_sender ON uq.sender_id = u_sender.id
            LEFT JOIN
                users u_resolver ON uq.resolved_by_admin_id = u_resolver.id
            ORDER BY
                uq.created_at DESC
        `);
        res.status(200).json(allQueries.rows);
    } catch (error) {
        console.error('Error fetching all queries for admin:', error);
        res.status(500).json({ message: 'Server error fetching all queries.', error: error.message });
    }
});

// Update query status/response (Admin only)
app.patch('/api/admin/queries/:id', auth, authorizeRoles('admin'), async (req, res) => {
    const queryId = req.params.id;
    const { status, admin_response } = req.body; // Can update status, or add/update admin_response
    const adminId = req.user.id;

    try {
        const currentQuery = await pool.query('SELECT status FROM user_queries WHERE id = $1', [queryId]);
        if (currentQuery.rows.length === 0) {
            return res.status(404).json({ message: 'Query not found.' });
        }

        let updateFields = [];
        let queryParams = [];
        let paramIndex = 1;

        if (status) {
            const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ message: 'Invalid status provided.' });
            }
            updateFields.push(`status = $${paramIndex++}`);
            queryParams.push(status);

            // If status is 'resolved' or 'closed', set resolved_at and resolved_by_admin_id
            if (status === 'resolved' || status === 'closed') {
                updateFields.push(`resolved_at = $${paramIndex++}`);
                queryParams.push(new Date());
                updateFields.push(`resolved_by_admin_id = $${paramIndex++}`);
                queryParams.push(adminId);
            } else if (currentQuery.rows[0].status === 'resolved' || currentQuery.rows[0].status === 'closed') {
                // If changing from resolved/closed to open/in_progress, clear resolution details
                updateFields.push(`resolved_at = NULL`);
                updateFields.push(`resolved_by_admin_id = NULL`);
            }
        }

        if (admin_response !== undefined) { // Allow admin_response to be an empty string
            updateFields.push(`admin_response = $${paramIndex++}`);
            queryParams.push(admin_response);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'No valid fields provided for update.' });
        }

        queryParams.push(queryId); // Last parameter is the query ID

        const updatedQuery = await pool.query(
            `UPDATE user_queries SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramIndex} RETURNING *`,
            queryParams
        );

        res.status(200).json({
            message: 'Query updated successfully!',
            query: updatedQuery.rows[0]
        });

        // --- NEW: Trigger Notification to Query Sender (Query Updated) ---
        try {
            const querySenderId = updatedQuery.rows[0].sender_id;
            const notificationMessage = `Your query "${updatedQuery.rows[0].subject}" has been updated by an admin. Status: ${updatedQuery.rows[0].status}.`;
            const notifResult = await pool.query(
                `INSERT INTO notifications (user_id, type, message, related_entity_id, related_entity_type) VALUES ($1, 'query_update', $2, $3, 'query') RETURNING *`,
                [querySenderId, notificationMessage, updatedQuery.rows[0].id]
            );
            const senderSocketId = connectedUsers.get(querySenderId);
            if (senderSocketId) {
                io.to(senderSocketId).emit('new_notification', notifResult.rows[0]);
                console.log(`Emitted real-time notification to query sender ${querySenderId} for query update.`);
            }
        } catch (notifError) {
            console.error('Error triggering query update notification:', notifError);
        }
        // --- END NEW: Trigger Notification ---

    } catch (error) {
        console.error('Error updating query:', error);
        res.status(500).json({ message: 'Server error updating query.', error: error.message });
    }
});

// --- Notification Routes ---

// Create a notification (Admin-only for now, but can be triggered by events later)
app.post('/api/notifications', auth, authorizeRoles('admin'), async (req, res) => {
    const { userId, type, message, relatedEntityId, relatedEntityType } = req.body; // userId is who receives it

    if (!userId || !type || !message) {
        return res.status(400).json({ message: 'User ID, type, and message are required to create a notification.' });
    }

    try {
        // Verify if target user exists
        const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userExists.rows.length === 0) {
            return res.status(404).json({ message: 'Target user for notification not found.' });
        }

        const newNotification = await pool.query(
            `INSERT INTO notifications (user_id, type, message, related_entity_id, related_entity_type)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [userId, type, message, relatedEntityId, relatedEntityType]
        );
        res.status(201).json({
            message: 'Notification created successfully.',
            notification: newNotification.rows[0]
        });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ message: 'Server error creating notification.', error: error.message });
    }
});

// --- Calendar Event Routes ---

// Create a new event (Medical Staff & Admin)
app.post('/api/events', auth, authorizeRoles('medical_staff', 'admin', 'doctor'), async (req, res) => {
    const { title, description, start_time, end_time, all_day, patient_id } = req.body;
    const userId = req.user.id; // Event creator is the authenticated user

    if (!title || !start_time || !end_time) {
        return res.status(400).json({ message: 'Title, start time, and end time are required for an event.' });
    }

    try {
        const newEvent = await pool.query(
            `INSERT INTO calendar_events (title, description, start_time, end_time, all_day, user_id, patient_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [title, description, start_time, end_time, all_day || false, userId, patient_id || null]
        );
        res.status(201).json({
            message: 'Event created successfully!',
            event: newEvent.rows[0]
        });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ message: 'Server error creating event.', error: error.message });
    }
});

// Get all events for the authenticated user (or all if admin) - filtering by time range is common
app.get('/api/events/my', auth, authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'), async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { start, end } = req.query; // Optional: query parameters for date range

    let query = `
        SELECT
            ce.id, ce.title, ce.description, ce.start_time, ce.end_time, ce.all_day,
            ce.created_at, ce.updated_at,
            u_creator.full_name AS creator_name,
            mp.patient_name
        FROM
            calendar_events ce
        JOIN
            users u_creator ON ce.user_id = u_creator.id
        LEFT JOIN
            mri_patients mp ON ce.patient_id = mp.id
    `;
    const queryParams = [];
    let paramIndex = 1;

    if (userRole !== 'admin') {
        query += ` WHERE ce.user_id = $${paramIndex++}`;
        queryParams.push(userId);
    }

    // Add time range filtering if provided
    if (start && end) {
        query += `${queryParams.length > 0 ? ' AND' : ' WHERE'} (ce.start_time BETWEEN $${paramIndex++} AND $${paramIndex++})`;
        queryParams.push(start, end);
    }

    query += ` ORDER BY ce.start_time ASC`;

    try {
        const events = await pool.query(query, queryParams);
        res.status(200).json(events.rows);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Server error fetching events.', error: error.message });
    }
});

// Update an event (only by creator or admin)
app.put('/api/events/:id', auth, authorizeRoles('medical_staff', 'admin', 'doctor'), async (req, res) => {
    const eventId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { title, description, start_time, end_time, all_day, patient_id } = req.body;

    if (!title || !start_time || !end_time) {
        return res.status(400).json({ message: 'Title, start time, and end time are required.' });
    }

    try {
        // First, check if the event exists and if the user has permission to update it
        const existingEvent = await pool.query('SELECT user_id FROM calendar_events WHERE id = $1', [eventId]);
        if (existingEvent.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found.' });
        }
        if (existingEvent.rows[0].user_id !== userId && userRole !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: You can only update your own events or be an admin.' });
        }

        const updatedEvent = await pool.query(
            `UPDATE calendar_events
             SET title = $1, description = $2, start_time = $3, end_time = $4, all_day = $5, patient_id = $6, updated_at = CURRENT_TIMESTAMP
             WHERE id = $7
             RETURNING *`,
            [title, description, start_time, end_time, all_day || false, patient_id || null, eventId]
        );

        res.status(200).json({
            message: 'Event updated successfully!',
            event: updatedEvent.rows[0]
        });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ message: 'Server error updating event.', error: error.message });
    }
});

// Delete an event (only by creator or admin)
app.delete('/api/events/:id', auth, authorizeRoles('medical_staff', 'admin', 'doctor'), async (req, res) => {
    const eventId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        // First, check if the event exists and if the user has permission to delete it
        const existingEvent = await pool.query('SELECT user_id FROM calendar_events WHERE id = $1', [eventId]);
        if (existingEvent.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found.' });
        }
        if (existingEvent.rows[0].user_id !== userId && userRole !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: You can only delete your own events or be an admin.' });
        }

        const deleteResult = await pool.query('DELETE FROM calendar_events WHERE id = $1 RETURNING *', [eventId]);

        res.status(200).json({ message: 'Event deleted successfully!', event: deleteResult.rows[0] });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ message: 'Server error deleting event.', error: error.message });
    }
});

// Get my notifications (Authenticated users only)
app.get('/api/notifications/my', auth, authorizeRoles('medical_staff', 'admin'), async (req, res) => {
    const userId = req.user.id; // Get ID of the authenticated user
    const { readStatus } = req.query; // Optional: 'read', 'unread', or 'all'

    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    const queryParams = [userId];
    let paramIndex = 2;

    if (readStatus === 'read') {
        query += ` AND is_read = TRUE`;
    } else if (readStatus === 'unread') {
        query += ` AND is_read = FALSE`;
    }
    query += ` ORDER BY created_at DESC`;

    try {
        const myNotifications = await pool.query(query, queryParams);
        res.status(200).json(myNotifications.rows);
    } catch (error) {
        console.error('Error fetching user notifications:', error);
        res.status(500).json({ message: 'Server error fetching notifications.', error: error.message });
    }
});

// Mark a specific notification as read
app.patch('/api/notifications/:id/read', auth, authorizeRoles('medical_staff', 'admin'), async (req, res) => {
    const notificationId = req.params.id;
    const userId = req.user.id; // Authenticated user must own the notification

    try {
        const updatedNotification = await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
            [notificationId, userId]
        );
        if (updatedNotification.rows.length === 0) {
            return res.status(404).json({ message: 'Notification not found or you do not have permission to update it.' });
        }
        res.status(200).json({ message: 'Notification marked as read.', notification: updatedNotification.rows[0] });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Server error marking notification as read.', error: error.message });
    }
});

// Mark all notifications for a user as read
app.patch('/api/notifications/mark-all-read', auth, authorizeRoles('medical_staff', 'admin'), async (req, res) => {
    const userId = req.user.id; // Authenticated user

    try {
        await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
            [userId]
        );
        res.status(200).json({ message: 'All unread notifications marked as read.' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ message: 'Server error marking all notifications as read.', error: error.message });
    }
});

// --- Socket.IO for Chat ---
io.on('connection', (socket) => {
    console.log('A user connected to chat/notifications:', socket.id);

    // Client will emit 'set_user_id' after successful login to associate socket with user
    socket.on('set_user_id', (userId) => {
        if (userId) {
            connectedUsers.set(userId, socket.id);
            console.log(`User ${userId} associated with socket ${socket.id}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Remove user from map on disconnect
        // It's more efficient to find the user ID by socket ID if you can
        // Or, when storing, map socket.id -> userId if user can have multiple connections
        // For now, this loop is okay for small numbers of connected users
        for (let [userId, socketId] of connectedUsers.entries()) {
            if (socketId === socket.id) {
                connectedUsers.delete(userId);
                console.log(`User ${userId} removed from connectedUsers.`);
            }
        }
    });

    // Chat message handling (existing logic)
    socket.on('chat message', async (msg) => {
        console.log('Received chat message:', msg);
        try {
            if (!msg.text || !msg.senderId) {
                console.warn('Invalid chat message format received: text or senderId missing.', msg);
                return;
            }
            await pool.query(
                'INSERT INTO chat_messages (sender_id, message) VALUES ($1, $2)',
                [msg.senderId, msg.text]
            );

            const senderInfoResult = await pool.query('SELECT username, full_name FROM users WHERE id = $1', [msg.senderId]);
            const senderUsername = senderInfoResult.rows[0]?.username || 'Unknown';
            const senderFullName = senderInfoResult.rows[0]?.full_name || 'Unknown User';

            io.emit('chat message', {
                text: msg.text,
                senderId: msg.senderId,
                senderUsername: senderUsername,
                senderFullName: senderFullName,
                timestamp: new Date().toISOString()
            });
        } catch (dbError) {
            console.error('Error saving or broadcasting chat message:', dbError);
        }
    });
});

// --- Start the Server ---
const PORT = process.env.PORT || 5001; // Use 5001 consistently
server.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});

module.exports = { pool };