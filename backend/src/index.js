// backend/src/index.js
// ------------------ Environment ------------------
import 'dotenv/config'; 

// ------------------ AWS SDK ------------------
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ------------------ Node & Express ------------------
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import path from "path";

// ------------------ Database & Auth ------------------
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { auth, authorizeRoles } from "./middleware/auth.js";

// ------------------ Upload & Puppeteer ------------------
import multer from "multer";
import puppeteer from "puppeteer";

// ------------------ Config & Utils ------------------
import { s3Client } from "../config/s3.js";
import { v4 as uuidv4 } from "uuid";
import pdf from "html-pdf-node"; 
import htmlPdf from "html-pdf-node";
import Handlebars from "handlebars";

import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import ExcelJS from "exceljs";

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { formatNumbersInResponse } from "../utils/formatNumber.js";

// ------------------ Config checks ------------------
if (!process.env.JWT_SECRET) {
  console.error('CRITICAL WARNING: JWT_SECRET is NOT set.');
} 
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change';

// --- Initialize Express App and HTTP Server ---
const app = express();
const server = http.createServer(app);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// backend/server.js (or app.js)
const inventoryRoutes = require('./routes/inventoryRoutes');

// --- Configure CORS properly ---
const allowedOrigins = [
  "http://localhost:3000", 
  "http://localhost:3001",
  "https://g2g-mri-erp-bfw57.ondigitalocean.app", 
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); 
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("CORS blocked: " + origin), false);
      }
    },
    credentials: true, 
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors());
app.use(express.json());

// safe headers fallback
app.use((req, res, next) => {
  if (!res.getHeader('Access-Control-Allow-Origin')) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  }
  if (!res.getHeader('Access-Control-Allow-Methods')) {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (!res.getHeader('Access-Control-Allow-Headers')) {
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ... your other middleware and routes ...
app.use('/api/inventory', inventoryRoutes);

// At the top of index.js
const connectedUsers = new Map();

// ------------------ Socket.IO ------------------
const io = new Server(server, {
  path: '/socket.io/', 
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : '*',
    methods: ['GET','POST'],
    credentials: true
  },
  allowEIO3: true 
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  
  socket.on("register_user", (userId) => {
    connectedUsers.set(String(userId), socket.id);
    console.log(`User ${userId} registered with socket ${socket.id}`);
  });

  socket.on('set_user_id', (userId) => {
    if (userId) {
      connectedUsers.set(String(userId), socket.id);
    }
  });

  socket.on("chat message", async (msg) => {
    try {
      if (!msg.text || !msg.senderId) return;
      await pool.query('INSERT INTO chat_messages (sender_id, message) VALUES ($1, $2)', [msg.senderId, msg.text]);
      
      const senderInfo = await pool.query('SELECT username, full_name FROM users WHERE id = $1', [msg.senderId]);
      
      io.emit("chat message", { 
        text: msg.text, 
        senderId: msg.senderId, 
        senderUsername: senderInfo.rows[0]?.username, 
        senderFullName: senderInfo.rows[0]?.full_name,
        timestamp: new Date().toISOString() 
      });
    } catch (dbError) { console.error('Chat Error:', dbError); }
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) { connectedUsers.delete(userId); break; }
    }
  });
});

// ------------------ Uploads (multer) ------------------
const UPLOADS_BASE_DIR = path.join(__dirname, '..', 'uploads');
const UPLOADS_RESULTS_DIR = path.join(UPLOADS_BASE_DIR, 'results');

(async () => {
  try {
    await fs.promises.mkdir(UPLOADS_BASE_DIR, { recursive: true });
    await fs.promises.mkdir(UPLOADS_RESULTS_DIR, { recursive: true });
  } catch (err) { console.error('❌ Failed to ensure uploads directories:', err); }
})();

app.use('/uploads', express.static(UPLOADS_BASE_DIR));

// ------------------ Helpers ------------------

// ✅ UPDATED: Dynamic Exam Code Generator (Location + Modality Aware)
async function generateExamCode(locationId, modalityId) {
  if (!locationId || !modalityId) return `GEN--${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  
  const info = await pool.query(`
    SELECT l.location_code, m.modality_name 
    FROM locations l, modality_types m 
    WHERE l.id = $1 AND m.id = $2`, [locationId, modalityId]);
  
  const loc = info.rows[0]?.location_code || 'GEN';
  const mod = info.rows[0]?.modality_name?.substring(0, 3).toUpperCase() || 'SCAN';
  const year = new Date().getFullYear();
  const randomNumbers = String(Math.floor(1000 + Math.random() * 9000));
  return `${loc}-${mod}-${year}-${randomNumbers}`;
}

function generateReceiptNumber() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `REC-${timestamp}-${random}`.toUpperCase();
}

function sanitizeCurrency(value) {
  if (!value) return 0;
  const floatVal = parseFloat(String(value).replace(/,/g, ''));
  return Math.round((floatVal + Number.EPSILON) * 100) / 100;
}

// ✅ NEW: Helper for Receipts (Commas + Decimals)
const formatMoneyReceipt = (amount) => {
  return Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatAmount = (amount) => {
  if (amount === null || amount === undefined) return null;
  return Number(amount).toLocaleString("en-NG", { minimumFractionDigits: 2 });
};

// ------------------ Postgres Pool ------------------
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 25060,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    const client = await pool.connect();
    console.log('Database pool connected successfully!');
    client.release();
  } catch (err) { console.error('Warning: Failed to connect to DB on startup:', err.message); }
})();
pool.on('error', (err) => console.error('Unexpected error on idle client:', err));

// ------------------ Health endpoints ------------------
app.get('/', (req, res) => res.status(200).send('OK'));                  
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/api', (req, res) => res.send('Welcome to the ERP Backend API!'));

app.get('/api/test-db', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() AS current_time');
    client.release();
    return res.json({ message: 'Database Connected Successfully!', currentTime: result.rows[0].current_time });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to connect to database via route', details: error.message });
  }
});

// ------------------ AUTHENTICATION & CONFIG ------------------

// --- UPDATED LOGIN ROUTE (Debug Enabled) ---
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userRes = await pool.query(`
      SELECT u.*, l.name as location_name, l.is_hq 
      FROM users u 
      LEFT JOIN locations l ON u.location_id = l.id 
      WHERE u.username = $1`, [username]);
    
    const user = userRes.rows[0];
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // DEBUG: Print what the database actually found
    console.log(`[Login Success] User: ${user.username} | DB Location ID: ${user.location_id}`);

    if (user.role === 'medical_staff' && !user.is_verified) {
      return res.status(403).json({ message: 'Account pending verification' });
    }

    // Generate Token (Now includes username)
    const token = jwt.sign({ 
      id: user.id, 
      username: user.username, // Added this
      role: user.role, 
      location_id: user.location_id, 
      is_hq: user.is_hq,
      permissions: {
        can_add_patients: user.perm_add_patients,
        can_edit_patients: user.perm_edit_patients,
        can_delete_patients: user.perm_delete_patients,
        can_view_financials: user.perm_view_financials,
        can_manage_payments: user.perm_manage_payments,
        can_upload_results: user.perm_upload_results,
        can_download_results: user.perm_download_results,
        can_delete_results: user.perm_delete_results
      } 
    }, JWT_SECRET, { expiresIn: '12h' });

    res.json({ token, user });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/register', async (req, res) => {
  const { username, password, email, phone_number, full_name } = req.body;
  if (!username || !password || !email || !full_name) return res.status(400).json({ message: 'All required fields must be provided.' });
  
  try {
    const existingUser = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existingUser.rows.length > 0) return res.status(409).json({ message: 'Username or Email already exists.' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      `INSERT INTO users (username, password_hash, email, phone_number, full_name, role)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, username, email, full_name, role, is_verified`,
      [username, passwordHash, email, phone_number, full_name, 'medical_staff']
    );

    return res.status(201).json({ message: 'Medical staff registered successfully. Awaiting admin verification.', user: newUser.rows[0] });
  } catch (error) { return res.status(500).json({ message: 'Server error during registration.', error: error.message }); }
});

// --- CONFIG ROUTES ---
app.get('/api/locations', auth, async (req, res) => {
  const result = await pool.query('SELECT * FROM locations ORDER BY is_hq DESC, name ASC');
  res.json(result.rows);
});

app.get('/api/modalities', auth, async (req, res) => {
  const result = await pool.query('SELECT * FROM modality_types ORDER BY modality_name ASC');
  res.json(result.rows);
});

// ✅ UPDATED: Staff List now includes Location Name directly
app.get('/api/staff-list', auth, async (req, res) => {
  const r = await pool.query(`
    SELECT u.*, l.name as location_name 
    FROM users u 
    LEFT JOIN locations l ON u.location_id = l.id 
    WHERE u.role != 'admin' 
    ORDER BY u.full_name ASC
  `);
  res.json(r.rows);
});

// --- ADMIN MANAGEMENT ROUTES ---

// 1. Update Staff Role & Location (Corrected)
app.patch('/api/admin/medical-staff/:id/details', auth, authorizeRoles('admin'), async (req, res) => {
  const { role, location_id } = req.body;
  try {
    await pool.query(
      `UPDATE users SET role = $1, location_id = $2, updated_at = NOW() WHERE id = $3`,
      [role, location_id || null, req.params.id]
    );
    res.json({ message: "Staff details updated successfully." });
  } catch (e) { 
    console.error("Update details error:", e);
    res.status(500).json({ message: e.message }); 
  }
});

// ✅ NEW: Add Location
app.post('/api/locations', auth, authorizeRoles('admin'), async (req, res) => {
  const { name, address, location_code, is_hq } = req.body;
  if (!name || !location_code) return res.status(400).json({ message: "Name and Code are required." });
  
  try {
    const r = await pool.query(
      'INSERT INTO locations (name, address, location_code, is_hq) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, address, location_code, is_hq || false]
    );
    res.status(201).json({ message: "Location added", location: r.rows[0] });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ✅ NEW: Add Modality
app.post('/api/modalities', auth, authorizeRoles('admin'), async (req, res) => {
  const { modality_name } = req.body;
  if (!modality_name) return res.status(400).json({ message: "Modality Name is required." });

  try {
    const r = await pool.query(
      'INSERT INTO modality_types (modality_name) VALUES ($1) RETURNING *',
      [modality_name]
    );
    res.status(201).json({ message: "Modality added", modality: r.rows[0] });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
// ------------------ ADMIN USER MANAGEMENT ------------------

app.get('/api/admin/medical-staff', auth, authorizeRoles('admin'), async (req, res) => {
   try {
       const staffUsers = await pool.query(`
        SELECT 
          id, username, email, full_name, role, is_verified, location_id, created_at, updated_at,
          perm_add_patients, perm_edit_patients, perm_delete_patients, 
          perm_view_financials, perm_manage_payments, perm_upload_results, 
          perm_download_results, perm_delete_results
        FROM users 
        WHERE role != 'admin' 
        ORDER BY created_at DESC
      `);
       res.status(200).json(staffUsers.rows);
   } catch (error) { res.status(500).json({ message: 'Server error fetching medical staff users.', error: error.message }); }
});

app.patch('/api/admin/verify-medical-staff/:id', auth, authorizeRoles('admin'), async (req, res) => {
  const userId = req.params.id;
  const { suspend } = req.body;
  try {
    const newIsVerified = !suspend;
    const updatedUser = await pool.query(
      'UPDATE users SET is_verified = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, email, full_name, role, is_verified',
      [newIsVerified, userId]
    );
    return res.status(200).json({ message: `Medical staff updated.`, user: updatedUser.rows[0] });
  } catch (error) { return res.status(500).json({ message: 'Server error.', error: error.message }); }
});

// ✅ ADDED: Update Staff Details (Role & Location) - Fixes "No Connection" Error
app.patch('/api/admin/medical-staff/:id/details', auth, authorizeRoles('admin'), async (req, res) => {
  const { role, location_id } = req.body;
  try {
    // Dynamic update
    const fields = [];
    const values = [];
    let idx = 1;

    if (role) { fields.push(`role = $${idx++}`); values.push(role); }
    if (location_id) { fields.push(`location_id = $${idx++}`); values.push(location_id); }

    if (fields.length === 0) return res.status(400).json({ message: "No changes provided." });

    values.push(req.params.id);
    const query = `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id, username, role, location_id`;
    
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ message: "User not found." });
    
    res.json({ message: "Staff details updated.", user: result.rows[0] });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ✅ ADDED: Suspend/Activate Medical Staff Account (Your requested code)
app.patch('/api/admin/medical-staff/:id/status', auth, authorizeRoles('admin'), async (req, res) => {
    const userId = req.params.id;
    const { suspend } = req.body;

    if (typeof suspend !== 'boolean') {
        return res.status(400).json({ message: 'Invalid status provided. Expected boolean for "suspend".' });
    }

    try {
        const targetUserResult = await pool.query('SELECT id, username, role, is_verified FROM users WHERE id = $1', [userId]);
        const targetUser = targetUserResult.rows[0];

        if (!targetUser) return res.status(404).json({ message: 'User not found.' });
        if (targetUser.role === 'admin') return res.status(403).json({ message: 'Cannot suspend/activate another admin account.' });
        if (targetUser.id === req.user.id) return res.status(403).json({ message: 'Cannot suspend/activate your own account.' });

        const newIsVerified = !suspend;

        const updatedUser = await pool.query(
            'UPDATE users SET is_verified = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, email, full_name, role, is_verified',
            [newIsVerified, userId]
        );

        res.status(200).json({
            message: `Medical staff ${updatedUser.rows[0].username} successfully ${newIsVerified ? 'activated' : 'suspended'}.`,
            user: updatedUser.rows[0]
        });

    } catch (error) { res.status(500).json({ message: 'Server error updating user status.', error: error.message }); }
});

// ✅ UPDATE STAFF PERMISSIONS (Granular RBAC)
app.patch('/api/admin/medical-staff/:id/permissions', auth, authorizeRoles('admin'), async (req, res) => {
  const userId = req.params.id;
  const { 
    perm_add_patients, perm_edit_patients, perm_delete_patients, 
    perm_view_financials, perm_manage_payments, 
    perm_upload_results, perm_download_results, perm_delete_results 
  } = req.body;

  try {
    const updatedUser = await pool.query(`
      UPDATE users 
      SET 
        perm_add_patients = $1, 
        perm_edit_patients = $2, 
        perm_delete_patients = $3, 
        perm_view_financials = $4, 
        perm_manage_payments = $5, 
        perm_upload_results = $6, 
        perm_download_results = $7, 
        perm_delete_results = $8,
        updated_at = NOW()
      WHERE id = $9 
      RETURNING id, username, role
    `, [
      perm_add_patients, perm_edit_patients, perm_delete_patients, 
      perm_view_financials, perm_manage_payments, 
      perm_upload_results, perm_download_results, perm_delete_results, 
      userId
    ]);

    if (updatedUser.rows.length === 0) return res.status(404).json({ message: "User not found." });

    res.status(200).json({ message: "Permissions updated successfully", user: updatedUser.rows[0] });
  } catch (error) { 
    console.error("Permission Update Error:", error);
    res.status(500).json({ message: 'Server error updating permissions.', error: error.message }); 
  }
});

// ✅ ADDED: Admin Staff Activity Analytics (Corrected table name 'mri_patients' -> 'patients')
app.get('/api/admin/analytics/staff-activity', auth, authorizeRoles('admin'), async (req, res) => {
    try {
        const staffActivity = await pool.query(`
            SELECT
                u.id, u.username, u.full_name, u.email, u.is_verified, u.created_at AS user_created_at,
                COUNT(DISTINCT mp.id) AS patients_logged_count,
                COUNT(DISTINCT uq.id) AS queries_submitted_count,
                MAX(mp.created_at) AS last_patient_logged_at,
                MAX(uq.created_at) AS last_query_submitted_at
            FROM users u
            LEFT JOIN patients mp ON u.id = mp.recorded_by_staff_id -- Corrected table name here
            LEFT JOIN user_queries uq ON u.id = uq.sender_id
            WHERE u.role != 'admin'
            GROUP BY u.id, u.username, u.full_name, u.email, u.is_verified, u.created_at
            ORDER BY u.created_at ASC
        `);
        res.status(200).json(staffActivity.rows);
    } catch (error) { res.status(500).json({ message: 'Server error fetching staff activity analytics.', error: error.message }); }
});

// Change Role
app.patch('/api/admin/medical-staff/:id/role', auth, authorizeRoles('admin'), async (req, res) => {
   const userId = req.params.id;
   const { role } = req.body;
   if (!role) return res.status(400).json({ message: 'Role is required.' });
   try {
       const updatedUser = await pool.query('UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, role', [role, userId]);
       res.status(200).json({ message: `Role updated to ${role}.`, user: updatedUser.rows[0] });
   } catch (error) { res.status(500).json({ message: 'Server error updating user role.', error: error.message }); }
});

// Delete User
app.delete('/api/admin/medical-staff/:id', auth, authorizeRoles('admin'), async (req, res) => {
   const userId = req.params.id;
   try {
       await pool.query('DELETE FROM users WHERE id = $1', [userId]);
       res.status(200).json({ message: `Medical staff user successfully deleted.` });
   } catch (error) {
       if (error.code === '23503') return res.status(409).json({ message: 'Cannot delete user: has records.' });
       res.status(500).json({ message: 'Server error deleting user.', error: error.message });
   }
});

// ------------------ PATIENT MANAGEMENT ------------------

// ✅ CREATE PATIENT (Transaction Safe)
// ✅ UPDATE: Added 'financial_admin' and 'hq_financial_admin' to the allowed list
app.post('/api/patients', auth, authorizeRoles('admin', 'medical_staff', 'doctor', 'financial_admin', 'hq_financial_admin'), async (req, res) => {
  
  // 🛡️ THE GRANULAR PERMISSION LOCK
  // Defaults to blocking 'doctor' unless the Admin explicitly checked the box for them
  const canAdd = req.user.permissions?.can_add_patients ?? (req.user.role !== 'doctor');
  
  if (!canAdd && req.user.role !== 'admin') {
    return res.status(403).json({ message: "Access Denied: You do not have permission to register new patients." });
  }

  // Inside your app.post('/api/patients', ...) route handler:
  const { patient_name, location_id, modality_id, examinations, total_amount, ...rest } = req.body;

  // No need for integer regex parsing anymore! Use rest.age directly.
  const patientAge = rest.age || '0 years';

  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const examCode = await generateExamCode(location_id, modality_id);
    const receiptNum = `REC-${Date.now().toString(36).toUpperCase()}`;
    // Ensure total is a valid number
    const cleanTotal = examinations.reduce((sum, e) => sum + sanitizeCurrency(e.amount), 0);
    const examNames = examinations.map(e => e.name).join(', ');

    // ✅ FIXED QUERY: Formatted for safety
    const queryText = `
      INSERT INTO patients (
        exam_code, patient_name, location_id, modality_id, receipt_number, 
        total_amount, payment_status, recorded_by_staff_id, gender, age, 
        weight_kg, contact_email, contact_phone_number, referral_hospital, 
        referring_doctor, radiographer_name, radiologist_name, remarks, 
        payment_type, examination_test_name
      )
      VALUES (
        $1, $2, $3, $4, $5, 
        $6, 'Not Paid', $7, $8, $9, 
        $10, $11, $12, $13, 
        $14, $15, $16, $17, 
        $18, $19
      ) 
      RETURNING id
    `;

    const queryValues = [
      examCode,                     // $1
      patient_name,                 // $2
      location_id,                  // $3
      modality_id,                  // $4
      receiptNum,                   // $5
      cleanTotal,                   // $6
      req.user.id,                  // $7 (recorded_by)
      rest.gender,                  // $8
      patientAge,                     // $9
      rest.weight_kg,               // $10
      rest.contact_email,           // $11
      rest.contact_phone_number,    // $12
      rest.referral_hospital,       // $13
      rest.referring_doctor,        // $14
      rest.radiographer_name,       // $15
      rest.radiologist_name,        // $16
      rest.remarks,                 // $17
      rest.payment_type,            // $18
      examNames                     // $19
    ];

    const pat = await client.query(queryText, queryValues);

    // Save individual examination items
    for (const ex of examinations) {
      await client.query(
        'INSERT INTO patient_examinations (patient_id, exam_name, exam_amount) VALUES ($1,$2,$3)', 
        [pat.rows[0].id, ex.name, sanitizeCurrency(ex.amount)]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: "Saved", id: pat.rows[0].id });

  } catch (e) { 
    await client.query('ROLLBACK'); 
    console.error("Save Patient Error:", e); // Log specific error
    res.status(500).json({ message: e.message }); 
  } finally { 
    client.release(); 
  }
});

// ✅ LIST PATIENTS (Pagination + Security)
// --- UPDATED: GET PATIENTS ROUTE ---
app.get('/api/patients', auth, async (req, res) => {
  try {
    const { page=1, limit=10, search, searchField, gender, recordedBy, startDate, endDate, includeExams, location_id, modality_id } = req.query;
    const offset = (page - 1) * limit;

    // Start with Base Query
    let query = `
      SELECT p.*, l.name as branch_name, m.modality_name, u.full_name AS recorded_by_staff_name
      FROM patients p
      LEFT JOIN locations l ON p.location_id = l.id 
      LEFT JOIN modality_types m ON p.modality_id = m.id 
      LEFT JOIN users u ON p.recorded_by_staff_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    // --- SECURITY FILTER IMPLEMENTATION ---
    const isHQ = req.user.is_hq || req.user.role === 'admin' || req.user.role.includes('hq');
    
    if (!isHQ) {
      // NON-ADMIN: Must have location_id
      if (!req.user.location_id) {
         return res.json({ patients: [], totalPages: 0, totalRecords: 0, currentPage: 1 });
      }
      query += ` AND p.location_id = $${idx++}`;
      params.push(req.user.location_id);
    } 
    else if (location_id && location_id !== 'All' && location_id !== 'all') {
      // ADMIN: Filtering by specific location
      query += ` AND p.location_id = $${idx++}`;
      params.push(location_id);
    }

    // --- STANDARD FILTERS ---
    if (modality_id && modality_id !== 'All') { 
      query += ` AND p.modality_id = $${idx++}`; 
      params.push(modality_id); 
    }
    
    if (search) {
      const term = `%${search}%`;
      if (searchField === 'exam_code') { 
        query += ` AND (p.exam_code ILIKE $${idx} OR p.mri_code ILIKE $${idx})`; 
        params.push(term); 
        idx++;
      } else { 
        query += ` AND p.patient_name ILIKE $${idx++}`; 
        params.push(term); 
      }
    }
    
    if (gender && gender !== 'All') { 
      query += ` AND p.gender = $${idx++}`; 
      params.push(gender); 
    }

    // ✅ NEW: ADDED DATE FILTERS HERE
    if (startDate) {
      query += ` AND p.created_at >= $${idx++}`;
      params.push(`${startDate} 00:00:00`); 
    }
    
    if (endDate) {
      query += ` AND p.created_at <= $${idx++}`;
      params.push(`${endDate} 23:59:59`); 
    }

    // Execute Count (Gets the total number of records for pagination)
    // Note: We create a duplicate query string to count before adding LIMIT/OFFSET
    let countQuery = `SELECT COUNT(*) FROM (${query}) t`;
    const countRes = await pool.query(countQuery, params);
    const totalRecords = parseInt(countRes.rows[0].count);

    // Execute Data Fetch
    query += ` ORDER BY p.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const patients = result.rows;

    res.json({ patients, totalPages: Math.ceil(totalRecords/limit), totalRecords, currentPage: parseInt(page) });

  } catch (e) { 
    console.error("Patient Fetch Error:", e);
    res.status(500).json({ message: e.message }); 
  }
});

app.get("/api/patients/:id", auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, l.name as branch_name, m.modality_name, 
      COALESCE(json_agg(json_build_object('id', e.id, 'name', e.exam_name, 'amount', e.exam_amount)) FILTER (WHERE e.id IS NOT NULL), '[]') as examinations
      FROM patients p 
      LEFT JOIN locations l ON p.location_id = l.id 
      LEFT JOIN modality_types m ON p.modality_id = m.id 
      LEFT JOIN patient_examinations e ON p.id = e.patient_id 
      WHERE p.id = $1 GROUP BY p.id, l.name, m.modality_name`, [req.params.id]);
    
    if(!result.rows[0]) return res.status(404).json({message:"Not found"});
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/patients/:id", auth, async (req, res) => {
  // 🛡️ THE GRANULAR PERMISSION LOCK: Blocks Doctors from editing by default
  const canEdit = req.user.permissions?.can_edit_patients ?? (req.user.role !== 'doctor');
  
  if (!canEdit && req.user.role !== 'admin') {
    return res.status(403).json({ message: "Access Denied: You do not have permission to edit patient records." });
  }
  const { id } = req.params;
  const { patient_name, gender, contact_email, contact_phone_number, age, weight_kg, referral_hospital, referring_doctor, radiographer_name, radiologist_name, remarks, payment_type, examinations } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE patients SET patient_name=$1, gender=$2, contact_email=$3, contact_phone_number=$4, age=$5, weight_kg=$6, referral_hospital=$7, referring_doctor=$8, radiographer_name=$9, radiologist_name=$10, remarks=$11, payment_type=$12, updated_at=NOW() WHERE id=$13`,
      [patient_name, gender, contact_email, contact_phone_number, age, weight_kg, referral_hospital, referring_doctor, radiographer_name, radiologist_name, remarks, payment_type, id]
    );

    if (Array.isArray(examinations)) {
      await client.query("DELETE FROM patient_examinations WHERE patient_id = $1", [id]);
      let total = 0;
      for (const e of examinations) {
        const amt = sanitizeCurrency(e.amount);
        total += amt;
        await client.query("INSERT INTO patient_examinations (patient_id, exam_name, exam_amount) VALUES ($1,$2,$3)", [id, e.name, amt]);
      }
      await client.query("UPDATE patients SET total_amount=$1 WHERE id=$2", [total, id]);
    }
    await client.query("COMMIT");
    res.json({ message: "Updated" });
  } catch (e) { await client.query("ROLLBACK"); res.status(500).json({ message: e.message }); }
  finally { client.release(); }
});

app.patch('/api/patients/:patientId/approve-payment', auth, authorizeRoles('admin', 'medical_staff', 'hq_financial_admin', 'financial_admin'), async (req, res) => {
  try {
    await pool.query(`UPDATE patients SET payment_status=$1, approved_by_user_id=$2, approved_at=NOW() WHERE id=$3`, [req.body.status, req.user.id, req.params.patientId]);
    res.json({ message: "Status Updated" });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete('/api/patients/:patientId', auth, authorizeRoles('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM patients WHERE id = $1', [req.params.patientId]);
    res.json({ message: "Deleted" });
  } catch (e) { 
    if (e.code === '23503') return res.status(409).json({ message: 'Cannot delete: Related records exist.' });
    res.status(500).json({ message: e.message });
  }
});

// ------------------ RESULTS & S3 ------------------

// --- UPGRADED S3 UPLOAD (Clinical Workflow) ---
// --- UPGRADED S3 UPLOAD (Smart Status Tracking) ---
app.post("/api/patients/:id/results/upload", auth, upload.single("resultFile"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const patientId = req.params.id;
    const scanTitle = req.body.scan_title || "General Result"; 
    
    let fileBuffer = req.file ? req.file.buffer : null;
    let fileName = req.file ? req.file.originalname : `result_${patientId}.pdf`;

    if (!fileBuffer) return res.status(400).json({ message: "No file uploaded." });

    // 1. Check if this patient already has files (to know if it's an update)
    const existingFiles = await client.query('SELECT COUNT(*) FROM patient_results_files WHERE patient_id = $1', [patientId]);
    const isReupload = parseInt(existingFiles.rows[0].count) > 0;
    const newReportStatus = isReupload ? 'Updated' : 'Ready';

    // 2. Upload to DO Spaces / S3
    const key = `results/${patientId}_${uuidv4()}.pdf`;
    await s3Client.send(new PutObjectCommand({ 
      Bucket: process.env.DO_SPACES_BUCKET, 
      Key: key, 
      Body: fileBuffer, 
      ContentType: "application/pdf", 
      ACL: "private" 
    }));
    
    // 3. Save to database
    await client.query(
      `INSERT INTO patient_results_files (patient_id, uploaded_by_user_id, file_name, file_path, result_status, scan_title) 
       VALUES ($1, $2, $3, $4, 'Pending', $5)`, 
      [patientId, req.user.id, fileName, key, scanTitle]
    );

    // 4. ✅ Smartly change patient's overall status to Ready OR Updated!
    await client.query(`UPDATE patients SET report_status = $1 WHERE id = $2`, [newReportStatus, patientId]);

    await client.query('COMMIT');
    res.json({ message: "Success" });
  } catch (e) { 
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message }); 
  } finally {
    client.release();
  }
});

app.get("/api/patients/:id/results", auth, async (req, res) => {
  const r = await pool.query("SELECT * FROM patient_results_files WHERE patient_id=$1 ORDER BY created_at DESC", [req.params.id]);
  res.json(r.rows);
});

// ✅ ADDED: Missing Results Summary Route (Fixes the 404 Crash)
app.get('/api/analytics/results-summary', auth, async (req, res) => {
  try {
    const total = await pool.query('SELECT COUNT(*) FROM patient_results_files');
    const pending = await pool.query("SELECT COUNT(*) FROM patient_results_files WHERE result_status = 'Pending' OR result_status = 'pending_review'");
    const issued = await pool.query("SELECT COUNT(*) FROM patient_results_files WHERE result_status = 'Issued' OR result_status = 'issued'");

    res.json({
      total_results: parseInt(total.rows[0].count),
      pending_results: parseInt(pending.rows[0].count),
      issued_results: parseInt(issued.rows[0].count)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- DELETE RESULT FROM DB AND DO SPACES ---
// --- SMART DELETE RESULT (Reverts status if empty) ---
app.delete('/api/patients/results/:fileId', auth, async (req, res) => {
  try {
    // 1. Find the file AND the patient ID before we delete it
    const fileRes = await pool.query('SELECT patient_id, file_path FROM patient_results_files WHERE file_id = $1', [req.params.fileId]);
    
    if (fileRes.rows.length === 0) return res.status(404).json({ message: "File not found" });
    
    const { patient_id, file_path } = fileRes.rows[0];

    // 2. Delete from DigitalOcean Spaces & Database
    await s3Client.send(new DeleteObjectCommand({ Bucket: process.env.DO_SPACES_BUCKET, Key: file_path }));
    await pool.query('DELETE FROM patient_results_files WHERE file_id = $1', [req.params.fileId]);
    
    // 3. ✅ Check if that was the last file. If yes, revert status to "In Progress"
    const remainingFiles = await pool.query('SELECT COUNT(*) FROM patient_results_files WHERE patient_id = $1', [patient_id]);
    if (parseInt(remainingFiles.rows[0].count) === 0) {
      await pool.query("UPDATE patients SET report_status = 'In Progress' WHERE id = $1", [patient_id]);
    }

    res.json({ message: "Result deleted successfully." });
  } catch (e) {
    console.error("Delete Result Error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/patients/results/:fileId/download", auth, async (req, res) => {
  try {
    const canDownload = req.user.permissions?.can_download_results ?? true; 
    
    if (!canDownload && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Access Denied: You lack permission." });
    }

    // ✅ FIX: Join the patients table to check the payment status!
    const r = await pool.query(`
      SELECT f.file_path, p.payment_status 
      FROM patient_results_files f
      JOIN patients p ON f.patient_id = p.id
      WHERE f.file_id = $1
    `, [req.params.fileId]);
    
    if (!r.rows[0]) {
      return res.status(404).json({ message: "File Not Found in Database" });
    }

    // ✅ THE BUSINESS RULE: Block download if not Approved (Paid)
    // We allow Admins to bypass this rule just in case of an emergency
    if (r.rows[0].payment_status !== 'Approved' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: "Download Blocked: Payment has not been approved for this patient." 
      });
    }
    
    // Generate the secure link
    const url = await getSignedUrl(
      s3Client, 
      new GetObjectCommand({ Bucket: process.env.DO_SPACES_BUCKET, Key: r.rows[0].file_path }), 
      { expiresIn: 300 }
    );
    
    res.json({ downloadUrl: url });
  } catch (e) {
    console.error("Download Error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/patients/results/:fileId/status', auth, async (req, res) => {
  await pool.query('UPDATE patient_results_files SET result_status=$1 WHERE file_id=$2', [req.body.status, req.params.fileId]);
  res.json({message: "Updated"});
});

app.patch('/api/patients/results/:fileId/issue', auth, async (req, res) => {
  const { recipient_name } = req.body;
  await pool.query('UPDATE patient_results_files SET result_status=\'issued\', issued_to_recipient_name=$1 WHERE file_id=$2', [recipient_name, req.params.fileId]);
  res.json({message: "Issued"});
});

// ✅ DETAILED RECEIPT GENERATION (Fixed Commas & Date)
app.get("/api/patients/:id/receipt", auth, async (req, res) => {
  try {
    const patientId = req.params.id;

    // 1. Fetch Data
    const p = await pool.query(`
      SELECT p.*, l.name as branch_name, l.address as branch_address 
      FROM patients p 
      LEFT JOIN locations l ON p.location_id = l.id 
      WHERE p.id=$1`, [patientId]);
    
    const ex = await pool.query("SELECT * FROM patient_examinations WHERE patient_id=$1", [patientId]);
    
    if(!p.rows.length) return res.status(404).json({message:"Not Found"});
    const patient = p.rows[0];

    // 2. Setup PDF for 80mm Thermal Roll (Width: 226.77 points, Height: 600 points)
    const doc = new PDFDocument({ 
      size: [226.77, 600], 
      margin: 10 
    });
    
    let buffers = [];
    doc.on("data", b => buffers.push(b));
    doc.on("end", async () => {
      const pdf = Buffer.concat(buffers);
      res.set({ 'Content-Type': 'application/pdf' });
      res.send(pdf);
    });

    // Robust Local Currency Formatter (Forces Commas)
    const formatMoney = (amount) => {
        if (amount === null || amount === undefined) return "0.00";
        return Number(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    };

    // --- DYNAMIC HEADER & LOGOS ---
    let mainTitle = "MEDICAL IMAGING CENTER";
    let subTitle = "Diagnostic Department";
    let addressLine = "Address not provided";
    let logoName = "logo-right.png"; // Default fallback

    // Branch Logic Routing 
    if (patient.branch_name) {
      if (patient.branch_name.toLowerCase().includes('lautech')) {
        mainTitle = "LAUTECH TEACHING HOSPITAL";
        subTitle = "Medical Imaging Department";
        addressLine = patient.branch_address || "Ladoke Akintola University of Technology, Ogbomoso";
        logoName = "lautechlogo.png"; // Just the filename
      } 
      else if (patient.branch_name.toLowerCase().includes('port harcourt') || patient.branch_name.toLowerCase().includes('ph')) {
        mainTitle = "UNIVERSITY OF PORT HARCOURT TEACHING HOSPITAL"; 
        subTitle = "Medical Imaging Department"; 
        addressLine = patient.branch_address || "Port Harcourt, Rivers State";
        logoName = "upthlogo.png"; // Just the filename
      } 
      else {
        mainTitle = patient.branch_name.toUpperCase();
        addressLine = patient.branch_address || "";
      }
    }

    // --- Draw the Logo (Centered for 80mm paper) ---
    // ✅ FIX: Uses __dirname to step out of 'src' and into 'public' reliably
    const logoPath = path.join(__dirname, '../public', logoName);
    
    try { 
      // Center a 40px wide image on a 226.77px canvas
      doc.image(logoPath, 63, 10, { width: 100 }); 
      doc.moveDown(5);
    } catch (e) { 
      console.warn("Logo missing:", logoPath);
      doc.moveDown(1); 
    }

    // --- Hospital Info Text ---
    doc.fontSize(10).font("Helvetica-Bold").text(mainTitle, { align: "center" });
    doc.fontSize(8).font("Helvetica").text(subTitle, { align: "center" });
    doc.text(addressLine, { align: "center" });
    doc.moveDown(0.5);

    // Thermal Divider Function
    const drawDivider = () => {
      doc.fontSize(8).font("Helvetica").text("--------------------------------------------------", { align: "center" });
    };

    drawDivider();
    doc.fontSize(10).font("Helvetica-Bold").text("PAYMENT RECEIPT", { align: "center" });
    drawDivider();

    // --- Patient Details ---
    doc.fontSize(8).font("Helvetica");
    
    // Narrow layout formatting (Left label, Right value)
    let currentY = doc.y;
    doc.font("Helvetica-Bold").text("Date:", 10, currentY);
    doc.font("Helvetica").text(patient.created_at ? new Date(patient.created_at).toLocaleDateString('en-GB') : "N/A", 50, currentY);
    
    currentY = doc.y + 2;
    doc.font("Helvetica-Bold").text("Receipt:", 10, currentY);
    doc.font("Helvetica").text(patient.receipt_number || "PENDING", 50, currentY);

    currentY = doc.y + 2;
    doc.font("Helvetica-Bold").text("Patient:", 10, currentY);
    doc.font("Helvetica").text(patient.patient_name, 50, currentY);

    currentY = doc.y + 2;
    doc.font("Helvetica-Bold").text("Age/Sex:", 10, currentY);
    doc.font("Helvetica").text(`${patient.age || 'N/A'} / ${patient.gender}`, 55, currentY);

    currentY = doc.y + 2;
    doc.font("Helvetica-Bold").text("Code:", 10, currentY);
    doc.font("Helvetica").text(patient.exam_code, 40, currentY);

    doc.moveDown(0.5);
    drawDivider();

    // --- Items List (No Tables) ---
    doc.font("Helvetica-Bold");
    doc.text("Description", 10, doc.y, { continued: true });
    doc.text("Amount (NGN)", { align: "right" });
    doc.moveDown(0.2);

    doc.font("Helvetica");
    ex.rows.forEach(item => {
      let y = doc.y;
      // Item name on the left (wraps if too long)
      doc.text(item.name || item.exam_name, 10, y, { width: 130, align: "left" });
      // Amount on the right, aligned to the same Y coordinate
      doc.text(formatMoney(item.amount || item.exam_amount), 140, y, { width: 76, align: "right" });
      doc.moveDown(0.2);
    });

    drawDivider();

    // --- Totals ---
    doc.font("Helvetica-Bold").fontSize(9);
    let totalY = doc.y;
    doc.text("TOTAL PAID:", 10, totalY);
    doc.text(`NGN ${formatMoney(patient.total_amount)}`, 100, totalY, { width: 116, align: "right" });

    doc.moveDown(0.5);
    doc.fontSize(8).font("Helvetica");
    let modeY = doc.y;
    doc.text("Payment Mode:", 10, modeY);
    doc.text(patient.payment_type || "N/A", 100, modeY, { width: 116, align: "right" });

    drawDivider();

    // --- Footer ---
    doc.moveDown(0.5);
    doc.fontSize(8).font("Helvetica-Oblique").text("Thank you for choosing our services.", { align: "center" });
    doc.font("Helvetica").text("System Generated Receipt", { align: "center" });
    
    // Safety margin to prevent the printer blade from cutting the text
    doc.moveDown(2);
    
    doc.end();

  } catch (e) {
    console.error("Receipt Error:", e);
    res.status(500).json({ message: e.message });
  }
});

// ------------------ ANALYTICS (Charts & Dashboard) ------------------

// --- HELPER: ROBUST LOCATION FILTER ---
const buildLocFilter = (user, queryLoc) => {
  const isHQ = user.is_hq || user.role === 'admin' || user.role.includes('hq');
  
  // 1. LOGGING FOR DEBUGGING
  console.log(`[Auth Debug] User: ${user.username} | Role: ${user.role} | LocID: ${user.location_id} | IsHQ: ${isHQ}`);

  // 2. STANDARD STAFF LOGIC
  if (!isHQ) {
    // Safety: If user has no location assigned, return "Empty Result" (WHERE 1=0)
    if (!user.location_id) {
      console.warn(`[Access Denied] User ${user.username} has NO location assigned.`);
      return { sql: 'WHERE 1=0', params: [] }; 
    }
    // Strict: Only show their specific location
    return { sql: 'WHERE location_id = $1', params: [user.location_id] };
  }

  // 3. ADMIN/HQ LOGIC
  // If Admin selects a specific location filter
  if (queryLoc && queryLoc !== 'all' && queryLoc !== 'All') {
    return { sql: 'WHERE location_id = $1', params: [queryLoc] };
  }
  
  // Admin viewing everything
  return { sql: '', params: [] };
};

// ✅ FIX: Dashboard Revenue Rounding
app.get('/api/analytics/summary', auth, async (req, res) => {
  try {
    const f = buildLocFilter(req.user, req.query.location_id);
    const [tp, tr, pr] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM patients ${f.sql}`, f.params),
      pool.query(`SELECT SUM(total_amount) FROM patients ${f.sql}`, f.params),
      pool.query(`SELECT COUNT(*) FROM patient_results_files WHERE result_status = 'Pending'`)
    ]);
    res.json({
      total_patients: parseInt(tp.rows[0].count),
      // ✅ FIX: Math.round() for whole numbers (No Kobo)
      total_revenue: Math.round(Number(tr.rows[0].sum || 0)),
      pending_reviews: parseInt(pr.rows[0].count)
    });
  } catch (e) { res.status(500).json({error:e.message}); }
});

app.get('/api/analytics/revenue-trend', auth, async (req, res) => {
  try {
    const f = buildLocFilter(req.user, req.query.location_id);
    const dateClause = f.sql ? `${f.sql} AND created_at > NOW() - INTERVAL '7 days'` : `WHERE created_at > NOW() - INTERVAL '7 days'`;
    const r = await pool.query(`SELECT TO_CHAR(created_at, 'Dy') as name, SUM(total_amount) as value FROM patients ${dateClause} GROUP BY 1, DATE(created_at) ORDER BY DATE(created_at)`, f.params);
    res.json(r.rows);
  } catch (e) { res.json([]); }
});

app.get('/api/analytics/modality-stats', auth, async (req, res) => {
  try {
    const f = buildLocFilter(req.user, req.query.location_id);
    const sql = f.sql.replace('location_id', 'p.location_id'); 
    const r = await pool.query(`SELECT m.modality_name as name, COUNT(p.id) as value FROM patients p JOIN modality_types m ON p.modality_id = m.id ${sql} GROUP BY 1`, f.params);
    res.json(r.rows);
  } catch (e) { res.json([]); }
});

app.get('/api/analytics/branch-performance', auth, async (req, res) => {
  try {
    const r = await pool.query(`SELECT l.name, SUM(p.total_amount) as revenue, COUNT(p.id) as patients FROM locations l LEFT JOIN patients p ON l.id = p.location_id GROUP BY l.name`);
    res.json(r.rows);
  } catch (e) { res.json([]); }
});

app.get('/api/analytics/recent-results', auth, async (req, res) => {
  const r = await pool.query(`SELECT p.patient_name, p.exam_code, p.created_at, f.result_status, u.full_name as uploaded_by_name FROM patient_results_files f JOIN patients p ON f.patient_id = p.id LEFT JOIN users u ON f.uploaded_by_user_id = u.id ORDER BY f.created_at DESC LIMIT 5`);
  res.json(r.rows);
});

// (Restored Legacy Analytics Endpoints)
app.get('/api/analytics/total-patients', auth, async (req, res) => { /* Logic in summary */ });
app.get('/api/analytics/patients-by-gender', auth, async (req, res) => {
  const r = await pool.query('SELECT gender, COUNT(*) FROM patients GROUP BY 1');
  res.json(r.rows);
});
app.get('/api/analytics/recent-patients', auth, async (req, res) => {
  const r = await pool.query('SELECT * FROM patients ORDER BY created_at DESC LIMIT 5');
  res.json(r.rows);
});

// ------------------ EVENTS / QUERIES / NOTIFICATIONS ------------------
app.get('/api/events/my', auth, async (req, res) => {
  const query = req.user.role === 'admin' ? 'SELECT * FROM calendar_events' : 'SELECT * FROM calendar_events WHERE user_id = $1';
  const params = req.user.role === 'admin' ? [] : [req.user.id];
  const r = await pool.query(query, params);
  res.json(r.rows);
});

app.post('/api/events', auth, async (req, res) => {
  const { title, start_time, end_time } = req.body;
  await pool.query('INSERT INTO calendar_events (title, start_time, end_time, user_id) VALUES ($1,$2,$3,$4)', [title, start_time, end_time, req.user.id]);
  res.json({message:"Saved"});
});

app.put('/api/events/:id', auth, async (req, res) => {
    const { title, description } = req.body;
    await pool.query('UPDATE calendar_events SET title=$1, description=$2 WHERE id=$3', [title, description, req.params.id]);
    res.json({message:"Updated"});
});

app.delete('/api/events/:id', auth, async (req, res) => {
    await pool.query('DELETE FROM calendar_events WHERE id=$1', [req.params.id]);
    res.json({message:"Deleted"});
});

app.post('/api/queries', auth, async (req, res) => {
  const r = await pool.query('INSERT INTO user_queries (sender_id, subject, message, status) VALUES ($1,$2,$3,\'open\') RETURNING *', [req.user.id, req.body.subject, req.body.message]);
  res.json({message:"Sent", query: r.rows[0]});
});

app.get('/api/queries/my', auth, async (req, res) => {
  const r = await pool.query('SELECT * FROM user_queries WHERE sender_id=$1 ORDER BY created_at DESC', [req.user.id]);
  res.json(r.rows);
});

app.get('/api/admin/queries', auth, authorizeRoles('admin'), async (req, res) => {
  const r = await pool.query('SELECT uq.*, u.username FROM user_queries uq JOIN users u ON uq.sender_id=u.id');
  res.json(r.rows);
});

app.patch('/api/admin/queries/:id', auth, authorizeRoles('admin'), async (req, res) => {
  await pool.query('UPDATE user_queries SET status=$1, admin_response=$2 WHERE id=$3', [req.body.status, req.body.admin_response, req.params.id]);
  res.json({message:"Responded"});
});

app.post('/api/notifications', auth, authorizeRoles('admin'), async (req, res) => {
  const { userId, type, message } = req.body;
  await pool.query('INSERT INTO notifications (user_id, type, message) VALUES ($1,$2,$3)', [userId, type, message]);
  res.json({message:"Sent"});
});

app.get('/api/notifications/my', auth, async (req, res) => {
  const r = await pool.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
  res.json(r.rows);
});

app.patch('/api/notifications/:id/read', auth, async (req, res) => {
  await pool.query('UPDATE notifications SET is_read=TRUE WHERE id=$1', [req.params.id]);
  res.json({message:"Read"});
});

app.patch('/api/notifications/mark-all-read', auth, async (req, res) => {
  await pool.query('UPDATE notifications SET is_read=TRUE WHERE user_id=$1', [req.user.id]);
  res.json({message:"All Read"});
});

// ------------------ EXPORT & HOUSEKEEPING ------------------
app.get("/api/patients/export/excel", auth, async (req, res) => {
  try {
    // ✅ 1. ADDED: startDate, endDate, and gender are now extracted from req.query
    const { search, searchField, location_id, modality_id, startDate, endDate, gender } = req.query;

    let queryText = `
      SELECT 
        p.*, 
        l.name as branch_name, 
        m.modality_name, 
        u.full_name AS recorded_by_staff_name
      FROM patients p
      LEFT JOIN locations l ON p.location_id = l.id 
      LEFT JOIN modality_types m ON p.modality_id = m.id 
      LEFT JOIN users u ON p.recorded_by_staff_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    // Security: Ensure branch staff only export their own branch's data
    const isHQ = req.user.is_hq || req.user.role === 'admin' || req.user.role.includes('hq');
    
    if (!isHQ) {
      if (!req.user.location_id) return res.status(403).send("No location assigned");
      queryText += ` AND p.location_id = $${idx++}`;
      params.push(req.user.location_id);
    } else if (location_id && location_id !== 'All' && location_id !== 'all') {
      queryText += ` AND p.location_id = $${idx++}`;
      params.push(location_id);
    }

    // Apply Modality Filter
    if (modality_id && modality_id !== 'All') { 
      queryText += ` AND p.modality_id = $${idx++}`; 
      params.push(modality_id); 
    }

    // ✅ 2. ADDED: Apply Date Filters to the SQL Query
    if (startDate) {
      queryText += ` AND p.created_at >= $${idx++}`;
      params.push(`${startDate} 00:00:00`); 
    }
    if (endDate) {
      queryText += ` AND p.created_at <= $${idx++}`;
      params.push(`${endDate} 23:59:59`);
    }

    // ✅ 3. ADDED: Apply Gender Filter to the SQL Query
    if (gender && gender !== 'All') {
      queryText += ` AND p.gender = $${idx++}`;
      params.push(gender);
    }
    
    // Apply Search Filter
    if (search) {
      const term = `%${search}%`;
      if (searchField === 'exam_code') { 
        queryText += ` AND (p.exam_code ILIKE $${idx} OR p.mri_code ILIKE $${idx})`; 
        params.push(term); 
        idx++;
      } else { 
        queryText += ` AND p.patient_name ILIKE $${idx++}`; 
        params.push(term); 
      }
    }

    queryText += ` ORDER BY p.created_at DESC`;
    const r = await pool.query(queryText, params);

    // Build the Excel File
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Patients Report");

    // Define all the columns you want
    ws.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Time', key: 'time', width: 12 },
      { header: 'Patient Name', key: 'patient_name', width: 25 },
      { header: 'Age', key: 'age', width: 8 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Phone Number', key: 'phone', width: 15 },
      { header: 'Branch / Lab', key: 'branch', width: 20 },
      { header: 'Modality', key: 'modality', width: 15 },
      { header: 'Exam/MRI Code', key: 'exam_code', width: 18 },
      { header: 'Tests Performed', key: 'tests', width: 35 },
      { header: 'Total Bill (₦)', key: 'amount', width: 15 },
      { header: 'Payment Status', key: 'payment_status', width: 15 },
      { header: 'Result Status', key: 'result_status', width: 15 },
      { header: 'Referring Doctor', key: 'referring_doctor', width: 20 },
      { header: 'Hospital', key: 'hospital', width: 20 },
      { header: 'Recorded By', key: 'staff', width: 20 }
    ];

    // Style the header row to look professional
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Map the database rows to the Excel columns
    const rowsToAdd = r.rows.map(p => ({
      date: new Date(p.created_at).toLocaleDateString(),
      time: new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      patient_name: p.patient_name,
      age: p.age,
      gender: p.gender,
      phone: p.contact_phone_number || 'N/A',
      branch: p.branch_name || 'Unassigned',
      modality: p.modality_name || 'N/A',
      exam_code: p.mri_code || p.exam_code || 'N/A',
      tests: p.examination_test_name || 'N/A',
      amount: Number(p.total_amount || 0),
      payment_status: p.payment_status || 'Not Paid',
      result_status: p.result_status || 'Pending',
      referring_doctor: p.referring_doctor || 'N/A',
      hospital: p.referral_hospital || 'N/A',
      staff: p.recorded_by_staff_name || 'Unknown'
    }));

    ws.addRows(rowsToAdd);

    // Send it back to the frontend
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    await wb.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Excel Export Error:", error);
    res.status(500).json({ message: "Failed to generate Excel file" });
  }
});


// ==========================================
// 📦 STORE INVENTORY MODULE ROUTES
// ==========================================

// 1. GET: Fetch all inventory items (Filtered by location)
  app.get('/api/inventory', auth, authorizeRoles('admin', 'inventory_manager', 'hq_financial_admin'), async (req, res) => {
    try {
      let query = `
        SELECT i.*, l.name as branch_name 
        FROM inventory_items i 
        LEFT JOIN locations l ON i.location_id = l.id
      `;
      let values = [];
      
      if (req.user.role !== 'admin' && !req.user.is_hq) {
        query += ` WHERE i.location_id = $1`;
        values.push(req.user.location_id);
      }
      
      query += ` ORDER BY i.item_name ASC`;
      
      const result = await pool.query(query, values);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

// 2. POST: Add a new item to the store
  app.post('/api/inventory', auth, authorizeRoles('admin', 'inventory_manager'), async (req, res) => {
    const { item_name, category, sku, unit_of_measurement, reorder_level, location_id, unit_price } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO inventory_items (item_name, category, sku, unit_of_measurement, reorder_level, location_id, quantity_in_stock, unit_price)
        VALUES ($1, $2, $3, $4, $5, $6, 0, $7) RETURNING *`,
        [item_name, category, sku, unit_of_measurement, reorder_level || 5, location_id || req.user.location_id, unit_price || 0]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // 3. POST: Process a Transaction (Restock or Dispense)
  app.post('/api/inventory/:id/transaction', auth, authorizeRoles('admin', 'inventory_manager'), async (req, res) => {
    const itemId = req.params.id;
    const { action_type, quantity, notes } = req.body; 
    
    try {
      await pool.query('BEGIN'); 

      const itemRes = await pool.query('SELECT quantity_in_stock FROM inventory_items WHERE id = $1 FOR UPDATE', [itemId]);
      if (itemRes.rows.length === 0) throw new Error('Item not found');
      
      let currentStock = parseFloat(itemRes.rows[0].quantity_in_stock);
      const qty = parseFloat(quantity);
      let newStock = currentStock;

      if (action_type === 'RESTOCK') {
        newStock = currentStock + qty;
      } else if (action_type === 'DISPENSE') {
        if (currentStock < qty) throw new Error('Insufficient stock. Cannot dispense more than available.');
        newStock = currentStock - qty;
      } else {
        throw new Error('Invalid action_type');
      }

      await pool.query(
        'UPDATE inventory_items SET quantity_in_stock = $1, last_restocked = CURRENT_TIMESTAMP WHERE id = $2',
        [newStock, itemId]
      );

      await pool.query(
        `INSERT INTO inventory_logs (item_id, user_id, action_type, quantity_changed, balance_after, notes)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [itemId, req.user.id, action_type, qty, newStock, notes]
      );

      await pool.query('COMMIT'); 
      res.json({ message: 'Transaction successful', new_stock: newStock });
    } catch (err) {
      await pool.query('ROLLBACK'); 
      res.status(400).json({ message: err.message });
    }
  });

  // 4. GET: Fetch Audit Logs for an item
  app.get('/api/inventory/:id/logs', auth, authorizeRoles('admin', 'inventory_manager', 'hq_financial_admin'), async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT l.*, u.username as performed_by 
        FROM inventory_logs l 
        LEFT JOIN users u ON l.user_id = u.id 
        WHERE l.item_id = $1 
        ORDER BY l.created_at DESC
      `, [req.params.id]);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // 5. DELETE: Remove an inventory item safely (thanks to ON DELETE CASCADE we set up earlier!)
  app.delete('/api/inventory/:id', auth, authorizeRoles('admin', 'inventory_manager'), async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM inventory_items WHERE id = $1 RETURNING *', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json({ message: "Item deleted successfully" });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete item", error: e.message });
    }
  });

// Custom middleware to intercept res.json
app.use((req, res, next) => {
  const oldJson = res.json;
  res.json = function (data) { return oldJson.call(this, formatNumbersInResponse(data)); };
  next();
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error", error: err.message });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`🚀 ERP Master Backend v9.0 LIVE on ${PORT}`));

export { app, server, pool, io };