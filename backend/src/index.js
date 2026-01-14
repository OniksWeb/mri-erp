// backend/src/index.js
// ------------------ Environment ------------------
import 'dotenv/config'; // automatically loads .env

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
  console.error('CRITICAL WARNING: JWT_SECRET is NOT set. Please set JWT_SECRET in your environment variables.');
} 
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change';

// --- Initialize Express App and HTTP Server ---
const app = express();
const server = http.createServer(app);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Configure CORS properly ---
const allowedOrigins = [
  "http://localhost:3000", // React dev
  "https://g2g-mri-erp-bfw57.ondigitalocean.app", // HTTP
  "https://g2g-mri-erp-bfw57.ondigitalocean.app", // HTTPS
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

// At the top of index.js
const connectedUsers = new Map();

// ------------------ Socket.IO ------------------
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : '*',
    methods: ['GET','POST']
  }
});
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  socket.on('disconnect', () => console.log('Socket disconnected:', socket.id));
});


// When a user connects
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("register", (userId) => {
    connectedUsers.set(userId, socket.id);
    console.log(`User ${userId} registered with socket ${socket.id}`);
  });

  socket.on("disconnect", () => {
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
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
    console.log('✅ Uploads directories ensured:', UPLOADS_BASE_DIR, UPLOADS_RESULTS_DIR);
  } catch (err) {
    console.error('❌ Failed to ensure uploads directories:', err);
  }
})();

app.use('/uploads', express.static(UPLOADS_BASE_DIR));

// ------------------ Helpers ------------------
function generateMriCode() {
  const randomNumbers = String(Math.floor(1000 + Math.random() * 9000)).padStart(4, '0');
  return `G2G-MRI-${randomNumbers}`;
}
function generateReceiptNumber() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `REC-${timestamp}-${random}`.toUpperCase();
}

// ✅ NEW HELPER: Safely parses currency to avoid 119,999.99 error
function sanitizeCurrency(value) {
  if (!value) return 0;
  // Remove commas, convert to float
  const floatVal = parseFloat(value.toString().replace(/,/g, ''));
  // Round to 2 decimals using epsilon to fix floating point math
  return Math.round((floatVal + Number.EPSILON) * 100) / 100;
}

// Utility to format amounts with commas
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
  ssl: {
    rejectUnauthorized: false, // DO requires SSL for public DB connections
  },
});

// test DB connection
(async () => {
  try {
    const client = await pool.connect();
    console.log('Database pool connected successfully!');
    client.release();
  } catch (err) {
    console.error('Warning: Failed to connect to DB on startup:', err.message);
  }
})();
pool.on('error', (err) => console.error('Unexpected error on idle client:', err));

// ------------------ Health endpoints ------------------
app.get('/', (req, res) => res.status(200).send('OK'));                  
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

// ------------------ API Routes ------------------

app.get('/api', (req, res) => res.send('Welcome to the ERP Backend API!'));

app.get('/api/test-db', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() AS current_time');
    client.release();
    return res.json({ message: 'Database Connected Successfully!', currentTime: result.rows[0].current_time });
  } catch (error) {
    console.error('/api/test-db error:', error);
    return res.status(500).json({ error: 'Failed to connect to database via route', details: error.message });
  }
});

// ---------- Registration ----------
app.post('/api/register', async (req, res) => {
  const { username, password, email, phone_number, full_name } = req.body;
  if (!username || !password || !email || !full_name) {
    return res.status(400).json({ message: 'All required fields must be provided.' });
  }
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

    return res.status(201).json({
      message: 'Medical staff registered successfully. Awaiting admin verification.',
      user: newUser.rows[0]
    });
  } catch (error) {
    console.error('/api/register error:', error);
    return res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
});

// ---------- Login ----------
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = userResult.rows[0];
    if (!user) return res.status(401).json({ message: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

    if (user.role === 'medical_staff' && !user.is_verified) {
      return res.status(403).json({ message: 'Account not yet verified by an administrator.' });
    }

    // ✅ CHANGED: Set expiresIn to '5m' (5 minutes) per your request
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        can_download: user.can_download 
      },
      JWT_SECRET,
      { expiresIn: '5m' } 
    );

    return res.status(200).json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_verified: user.is_verified,
        can_download: user.can_download 
      }
    });
  } catch (error) {
    console.error('/api/login error:', error);
    return res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
});


// ---------- Admin verify/suspend medical staff ----------
app.patch('/api/admin/verify-medical-staff/:id', auth, authorizeRoles('admin'), async (req, res) => {
  const userId = req.params.id;
  const { suspend } = req.body;
  try {
    const userResult = await pool.query('SELECT id, username, role, is_verified FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ message: 'Medical staff user not found.' });
    if (user.role !== 'medical_staff') return res.status(400).json({ message: 'Cannot verify this user: not a medical staff.' });

    const newIsVerified = !suspend;
    const updatedUser = await pool.query(
      'UPDATE users SET is_verified = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, email, full_name, role, is_verified',
      [newIsVerified, userId]
    );

    return res.status(200).json({
      message: `Medical staff ${updatedUser.rows[0].username} updated.`,
      user: updatedUser.rows[0]
    });
  } catch (error) {
    console.error('/api/admin/verify-medical-staff error:', error);
    return res.status(500).json({ message: 'Server error during verification/suspension.', error: error.message });
  }
});

app.get('/api/staff-list', auth, authorizeRoles('admin', 'doctor', 'financial_admin'), async (req, res) => {
  try {
    const staffList = await pool.query(`
      SELECT id, full_name, username, email, role, is_verified, created_at
      FROM users
      WHERE role IN ('doctor', 'financial_admin', 'medical_staff')
      ORDER BY full_name ASC
    `);
    return res.status(200).json(staffList.rows);
  } catch (error) {
    console.error('/api/staff-list error:', error);
    return res.status(500).json({ message: 'Server error fetching staff list.', error: error.message });
  }
});

// ✅ Admin updates staff download permission
app.patch("/api/staff-list/:id/permission", auth, async (req, res) => {
  try {
    const { can_download } = req.body;
    const staffId = req.params.id;

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (typeof can_download !== "boolean") {
      return res.status(400).json({ message: "can_download must be true or false." });
    }

    const result = await pool.query(
      "UPDATE users SET can_download = $1 WHERE id = $2 RETURNING id, username, email, role, can_download",
      [can_download, staffId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Staff not found" });
    }

    res.json({
      success: true,
      message: "Permission updated",
      staff: result.rows[0]
    });
  } catch (error) {
    console.error("Permission update error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});


// ---------- Delete Result ----------
app.delete(
  '/api/results/:id',
  auth,
  authorizeRoles('admin', 'doctor', 'financial_admin'),
  async (req, res) => {
    const resultId = req.params.id;

    try {
      const result = await pool.query(
        'SELECT file_path FROM patient_results_files WHERE file_id = $1',
        [resultId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Result not found.' });
      }

      const filePath = result.rows[0].file_path;

      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: process.env.DO_SPACES_BUCKET,
          Key: filePath, 
        })
      );

      await pool.query(
        'DELETE FROM patient_results_files WHERE file_id = $1',
        [resultId]
      );

      res.status(200).json({ message: 'Result deleted successfully.' });
    } catch (err) {
      console.error('Delete result error:', err);
      res.status(500).json({
        message: 'Server error deleting result.',
        error: err.message,
      });
    }
  }
);


// ---------- Patient creation (FIXED Currency) ----------
app.post(
  '/api/patients',
  auth,
  authorizeRoles('medical_staff', 'admin'),
  async (req, res) => {
    const {
      patient_name, gender, contact_email, contact_phone_number,
      radiographer_name, radiologist_name, remarks,
      age, weight_kg, referral_hospital, referring_doctor,
      payment_type, examinations
    } = req.body;

    const recordedByStaffId = req.user?.id;

    if (!patient_name || !Array.isArray(examinations) || examinations.length === 0) {
      return res.status(400).json({ message: 'Patient name and at least one examination are required.' });
    }

    try {
      let serialNumber = `SN-${Date.now()}-${String(Math.floor(Math.random() * 10000)).padStart(4,'0')}`;
      let mriCode = generateMriCode();
      let uniqueCheck = await pool.query(
        'SELECT id FROM mri_patients WHERE mri_code = $1 OR serial_number = $2',
        [mriCode, serialNumber]
      );
      while (uniqueCheck.rows.length > 0) {
        mriCode = generateMriCode();
        serialNumber = `SN-${Date.now()}-${String(Math.floor(Math.random() * 10000)).padStart(4,'0')}`;
        uniqueCheck = await pool.query('SELECT id FROM mri_patients WHERE mri_code = $1 OR serial_number = $2', [mriCode, serialNumber]);
      }

      const receiptNumber = generateReceiptNumber();
      const numericAge = age != null ? parseInt(age) : null;
      const numericWeight = weight_kg != null ? parseFloat(weight_kg) : null;

      // ✅ FIX: Use sanitizeCurrency for summing
      const totalAmount = examinations.reduce((sum, exam) => {
        const amt = sanitizeCurrency(exam.amount);
        return sum + amt;
      }, 0);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const newPatientResult = await client.query(
          `INSERT INTO mri_patients (
            serial_number, patient_name, gender, contact_email, contact_phone_number,
            mri_code, recorded_by_staff_id, radiographer_name, radiologist_name, remarks,
            age, weight_kg, referral_hospital, referring_doctor,
            total_amount, receipt_number, payment_type, payment_status,
            examination_test_name, examination_breakdown_amount_naira
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
          RETURNING *`,
          [
            serialNumber, patient_name, gender, contact_email, contact_phone_number,
            mriCode, recordedByStaffId, radiographer_name, radiologist_name, remarks,
            numericAge, numericWeight, referral_hospital, referring_doctor,
            totalAmount, receiptNumber, payment_type, 'Not Paid',
            examinations.map(e => e.name).join(', '),
            totalAmount
          ]
        );

        const newPatient = newPatientResult.rows[0];

        // Insert examinations
        const examInserts = [];
        for (const exam of examinations) {
          // ✅ FIX: Use sanitizeCurrency for individual items
          const amount = sanitizeCurrency(exam.amount);
          const insert = await client.query(
            'INSERT INTO patient_examinations (patient_id, exam_name, exam_amount) VALUES ($1,$2,$3) RETURNING id, exam_name, exam_amount',
            [newPatient.id, exam.name, amount]
          );
          examInserts.push(insert.rows[0]);
        }

        await client.query('COMMIT');

        newPatient.examinations = examInserts.map(e => ({
          id: e.id,
          name: e.exam_name,
          amount: e.exam_amount
        }));

        res.status(201).json({
          message: 'Patient record logged successfully!',
          patient: newPatient
        });

      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('/api/patients POST error:', error);
      return res.status(500).json({
        message: 'Server error while logging patient record.',
        error: error.message
      });
    }
  }
);



// ---------- Patients list with filters ----------
app.get('/api/patients', auth, authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'), async (req, res) => {
  try {
    const { search, searchField, gender, recordedBy, startDate, endDate, includeExams } = req.query;

    let query = `
      SELECT mp.*, 
             u.full_name AS recorded_by_staff_name, 
             u.email AS recorded_by_staff_email
      FROM mri_patients mp
      LEFT JOIN users u ON mp.recorded_by_staff_id = u.id
      WHERE 1=1
    `;

    const queryParams = [];
    let idx = 1;

    // Filters
    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      if (searchField === 'patient_name') {
        query += ` AND mp.patient_name ILIKE $${idx++}`;
        queryParams.push(term);
      } else if (searchField === 'mri_code') {
        query += ` AND mp.mri_code ILIKE $${idx++}`;
        queryParams.push(term);
      } else {
        query += ` AND (mp.patient_name ILIKE $${idx} OR mp.mri_code ILIKE $${idx + 1})`;
        queryParams.push(term, term);
        idx += 2;
      }
    }

    if (gender && gender !== 'All') {
      query += ` AND mp.gender = $${idx++}`;
      queryParams.push(gender);
    }

    if (recordedBy) {
      query += ` AND mp.recorded_by_staff_id = $${idx++}`;
      queryParams.push(recordedBy);
    }

    if (startDate) {
      query += ` AND mp.mri_date_time >= $${idx++}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      query += ` AND mp.mri_date_time <= $${idx++}`;
      queryParams.push(`${endDate} 23:59:59`);
    }

    query += ` ORDER BY mp.mri_date_time DESC`;

    const result = await pool.query(query, queryParams);
    const patients = result.rows;

    // If includeExams=true, fetch exams per patient
    if (includeExams === 'true' && patients.length > 0) {
      const patientIds = patients.map(p => p.id);
      const examsResult = await pool.query(
        `SELECT * FROM patient_examinations WHERE patient_id = ANY($1)`,
        [patientIds]
      );

      const examsByPatient = {};
      examsResult.rows.forEach(e => {
        if (!examsByPatient[e.patient_id]) examsByPatient[e.patient_id] = [];
        examsByPatient[e.patient_id].push({
          id: e.id,
          name: e.exam_name,
          amount: Number(e.exam_amount),
        });
      });

      // Attach exams array to each patient
      patients.forEach(p => {
        p.exams = examsByPatient[p.id] || [];
      });
    }

    return res.status(200).json(patients);
  } catch (error) {
    console.error('/api/patients GET error:', error);
    return res.status(500).json({ message: 'Server error fetching patients.', error: error.message });
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

// Backend: summary of results
app.get(
  '/api/analytics/results-summary',
  auth,
  authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'),
  async (req, res) => {
    try {
      const totalResult = await pool.query(`SELECT COUNT(*) FROM patient_results_files`);
      const pendingResult = await pool.query(`SELECT COUNT(*) FROM patient_results_files WHERE result_status = 'Pending'`);
      const issuedResult = await pool.query(`SELECT COUNT(*) FROM patient_results_files WHERE result_status = 'Issued'`);

      res.status(200).json({
        total_results: parseInt(totalResult.rows[0].count, 10),
        pending_results: parseInt(pendingResult.rows[0].count, 10),
        issued_results: parseInt(issuedResult.rows[0].count, 10)
      });

    } catch (error) {
      console.error('Error fetching results summary:', error);
      res.status(500).json({ message: 'Server error fetching results summary.', error: error.message });
    }
  }
);



// ---------- Update Patient Record (FIXED Currency) ----------
app.patch(
  "/api/patients/:id",
  auth,
  authorizeRoles("medical_staff", "admin", "doctor", "financial_admin"),
  async (req, res) => {
    const { id } = req.params;
    const {
      patient_name, gender, contact_email, contact_phone_number, age, weight_kg,
      referral_hospital, referring_doctor, radiographer_name, radiologist_name,
      remarks, payment_type, payment_status, recorded_by_staff_name, recorded_by_staff_email,
      examinations 
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existingPatientResult = await client.query("SELECT * FROM mri_patients WHERE id = $1", [id]);
      if (existingPatientResult.rows.length === 0) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(404).json({ message: "Patient record not found." });
      }

      const updateFields = [];
      const queryParams = [];
      let paramIndex = 1;

      const fieldsToUpdate = {
        patient_name, gender, contact_email, contact_phone_number,
        age: age !== undefined ? parseInt(age) : undefined,
        weight_kg: weight_kg !== undefined ? parseFloat(weight_kg) : undefined,
        referral_hospital, referring_doctor, radiographer_name, radiologist_name,
        remarks, payment_type, payment_status,
        recorded_by_staff_name, recorded_by_staff_email
      };

      for (const [key, value] of Object.entries(fieldsToUpdate)) {
        if (value !== undefined) {
          updateFields.push(`${key} = $${paramIndex++}`);
          queryParams.push(value);
        }
      }

      // Handle examinations
      let totalAmount = 0;

      if (Array.isArray(examinations)) {
        const existingExamsResult = await client.query("SELECT id FROM patient_examinations WHERE patient_id = $1", [id]);
        const existingExamIds = new Set(existingExamsResult.rows.map(r => r.id));
        const updatedExamIds = new Set();

        for (const exam of examinations) {
          // ✅ FIX: Use sanitizeCurrency for updates too
          const amount = sanitizeCurrency(exam.amount);
          totalAmount += amount;

          if (exam.id && existingExamIds.has(exam.id)) {
            updatedExamIds.add(exam.id);
            await client.query(
              "UPDATE patient_examinations SET exam_name = $1, exam_amount = $2 WHERE id = $3 AND patient_id = $4",
              [exam.name, amount, exam.id, id]
            );
          } else {
            const insertResult = await client.query(
              "INSERT INTO patient_examinations (patient_id, exam_name, exam_amount) VALUES ($1,$2,$3) RETURNING id",
              [id, exam.name, amount]
            );
            updatedExamIds.add(insertResult.rows[0].id);
          }
        }

        for (const existingId of existingExamIds) {
          if (!updatedExamIds.has(existingId)) {
            await client.query("DELETE FROM patient_examinations WHERE id = $1 AND patient_id = $2", [existingId, id]);
          }
        }

        updateFields.push(`examination_test_name = $${paramIndex++}`);
        queryParams.push(examinations.map(e => e.name).join(", "));

        updateFields.push(`total_amount = $${paramIndex++}`);
        queryParams.push(totalAmount);

        updateFields.push(`examination_breakdown_amount_naira = $${paramIndex++}`);
        queryParams.push(totalAmount);
      }

      if (updateFields.length > 0) {
        queryParams.push(id);
        const updateQuery = `UPDATE mri_patients SET ${updateFields.join(", ")}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;
        await client.query(updateQuery, queryParams);
      }

      await client.query("COMMIT");

      // Return updated record
      const result = await pool.query(
        `SELECT p.id, p.serial_number, p.patient_name, p.gender, p.age, p.weight_kg,
          p.contact_email, p.contact_phone_number, p.referral_hospital, p.referring_doctor,
          p.radiographer_name, p.radiologist_name, p.remarks, p.mri_code, p.mri_date_time,
          p.receipt_number, p.payment_type, p.payment_status, p.total_amount,
          p.created_at, p.updated_at, p.examination_test_name, p.examination_breakdown_amount_naira,
          p.recorded_by_staff_name, p.recorded_by_staff_email,
          COALESCE(
            json_agg(
              json_build_object('id', e.id, 'name', e.exam_name, 'amount', e.exam_amount)
            ) FILTER (WHERE e.id IS NOT NULL), '[]'
          ) AS examinations
        FROM mri_patients p
        LEFT JOIN patient_examinations e ON p.id = e.patient_id
        WHERE p.id = $1 GROUP BY p.id`,
        [id]
      );

      const patient = result.rows[0];
      patient.total_amount = formatAmount(patient.total_amount);
      patient.examination_breakdown_amount_naira = formatAmount(patient.examination_breakdown_amount_naira);
      patient.examinations = patient.examinations.map(exam => ({ ...exam, amount: formatAmount(exam.amount) }));

      res.json(patient);

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error updating patient:", err);
      res.status(500).json({ message: "Failed to update patient details" });
    } finally {
      client.release();
    }
  }
);


app.patch(
  '/api/patients/:patientId/approve-payment',
  auth,
  authorizeRoles('admin', 'medical_staff', 'financial_admin'),
  async (req, res) => {
    const patientId = req.params.patientId;
    const { status } = req.body; 
    const approverId = req.user.id; 

    const validStatuses = ['Approved', 'Pending', 'Not Paid'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid payment status. Must be Approved, Pending, or Not Paid.' 
      });
    }

    try {
      const patient = await pool.query(
        'SELECT id, patient_name, payment_status FROM mri_patients WHERE id = $1',
        [patientId]
      );
      if (patient.rows.length === 0) {
        return res.status(404).json({ message: 'Patient record not found.' });
      }

      let updateFields = [`payment_status = $1`, `updated_at = CURRENT_TIMESTAMP`];
      let queryParams = [status];
      let paramIndex = 2;

      if (status === 'Approved') {
        updateFields.push(`approved_by_user_id = $${paramIndex++}`);
        queryParams.push(approverId);

        // Only if column exists
        updateFields.push(`approved_at = $${paramIndex++}`);
        queryParams.push(new Date());
      } else {
        updateFields.push(`approved_by_user_id = NULL`);
        updateFields.push(`approved_at = NULL`);
      }

      queryParams.push(patientId);

      const updatedPatientResult = await pool.query(
        `UPDATE mri_patients 
         SET ${updateFields.join(', ')} 
         WHERE id = $${paramIndex} 
         RETURNING *`,
        queryParams
      );

      res.status(200).json({
        message: `Payment status for patient "${updatedPatientResult.rows[0].patient_name}" updated to "${status}".`,
        patient: updatedPatientResult.rows[0]
      });
    } catch (error) {
      console.error('Error updating payment status:', error);
      res.status(500).json({ 
        message: 'Server error updating payment status.', 
        error: error.message 
      });
    }
  }
);

app.delete('/api/patients/:patientId', auth, authorizeRoles('admin'), async (req, res) => {
  const patientId = req.params.patientId;

  try {
    const existingPatient = await pool.query(
      'SELECT id, patient_name FROM mri_patients WHERE id = $1',
      [patientId]
    );
    if (existingPatient.rows.length === 0) {
      return res.status(404).json({ message: 'Patient record not found.' });
    }

    const deletedPatient = await pool.query(
      'DELETE FROM mri_patients WHERE id = $1 RETURNING id, patient_name',
      [patientId]
    );

    res.status(200).json({ 
      message: `Patient record "${deletedPatient.rows[0].patient_name}" (ID: ${deletedPatient.rows[0].id}) successfully deleted.` 
    });

  } catch (error) {
    console.error('Error deleting patient record:', error);
    if (error.code === '23503') {
      return res.status(409).json({ 
        message: 'Cannot delete patient: this patient has associated examination records. Either delete them first or enable ON DELETE CASCADE.' 
      });
    }
    res.status(500).json({ 
      message: 'Server error deleting patient record.', 
      error: error.message 
    });
  }
});


// Upload a patient result file (form upload or Puppeteer PDF)
app.post(
  "/api/patients/:patientId/results/upload",
  auth,
  authorizeRoles("admin", "medical_staff", "doctor"),
  upload.single("resultFile"),
  async (req, res) => {
    const patientId = req.params.patientId;
    const uploadedByUserId = req.user.id;
    const { remarks } = req.body;

    let fileBuffer;
    let originalName;
    let mimeType;

    try {
      // 1️⃣ If file uploaded via form
      if (req.file) {
        fileBuffer = req.file.buffer;
        originalName = req.file.originalname;
        mimeType = req.file.mimetype;
      } else {
        // 2️⃣ Generate PDF via Puppeteer (DigitalOcean-safe)
        const browser = await puppeteer.launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage", // prevents shared memory issues on small droplets
          ],
        });

        const page = await browser.newPage();
        await page.setContent(`<h1>Patient ID: ${patientId}</h1><p>Result report</p>`);
        fileBuffer = await page.pdf({
          format: "A4",
          printBackground: true, // include any CSS background
        });

        await browser.close();

        originalName = `result_${patientId}.pdf`;
        mimeType = "application/pdf";
      }

      // 3️⃣ Verify patient exists
      const patientExists = await pool.query(
        "SELECT id FROM mri_patients WHERE id = $1",
        [patientId]
      );
      if (!patientExists.rows.length) {
        return res.status(404).json({ message: "Patient not found." });
      }

      // 4️⃣ Create unique S3 key
      const ext = path.extname(originalName) || ".pdf";
      const key = `results/${patientId}_${uuidv4()}${ext}`;

      // 5️⃣ Upload to DigitalOcean Spaces
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.DO_SPACES_BUCKET,
          Key: key,
          Body: fileBuffer,
          ContentType: mimeType,
          ACL: "private", // keep private; use signed URLs for access
        })
      );

      // 6️⃣ Construct file URL (optional, mainly for reference)
      const fileUrl = `${process.env.DO_SPACES_ENDPOINT.replace(/\/+$/,"")}/${process.env.DO_SPACES_BUCKET}/${key}`;

      // 7️⃣ Save metadata in DB
      const newResult = await pool.query(
        `INSERT INTO patient_results_files
          (patient_id, uploaded_by_user_id, file_name, file_path, file_type, file_size_kb, file_url, result_status, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending_review',$8)
         RETURNING *`,
        [
          patientId,
          uploadedByUserId,
          originalName,
          key, // ✅ store S3 key for download
          mimeType,
          Math.round(fileBuffer.length / 1024),
          fileUrl,
          remarks || null,
        ]
      );

      // 8️⃣ Return success
      res.status(201).json({
        message: "Result uploaded successfully!",
        resultFile: newResult.rows[0],
      });

    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        message: "Error uploading result file.",
        error: error.message,
      });
    }
  }
);




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
app.get(
  "/api/patients/results/:fileId/download",
  auth,
  authorizeRoles("admin", "medical_staff", "doctor", "financial_admin"),
  async (req, res) => {
    try {
      // ✅ Block if user has no download permission
      if (!req.user.can_download) {
        return res.status(403).json({ message: "You do not have permission to download results." });
      }

      const fileId = req.params.fileId;
      const result = await pool.query(
        "SELECT file_path FROM patient_results_files WHERE file_id = $1",
        [fileId]
      );

      const file = result.rows[0];
      if (!file) return res.status(404).json({ message: "File not found." });

      // Use stored S3 key directly
      const key = file.file_path;

      const command = new GetObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: key,
      });

      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 min expiry
      res.json({ downloadUrl: signedUrl });
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ message: "Error generating download link.", error: error.message });
    }
  }
);






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


import handlebars from "handlebars";

// Utility: Convert image file to base64 (for logos)
function imageToBase64(filePath) {
  const fileData = fs.readFileSync(filePath);
  const ext = path.extname(filePath).substring(1); // "png" or "jpg"
  return `data:image/${ext};base64,${fileData.toString("base64")}`;
}

// ---------- Get Single Patient Details (Fixed) ----------
app.get("/api/patients/:id", auth, authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        p.id,
        p.serial_number,
        p.patient_name,
        p.gender,
        p.age,
        p.weight_kg,
        p.contact_email,
        p.contact_phone_number,
        p.referral_hospital,
        p.referring_doctor,
        p.radiographer_name,
        p.radiologist_name,
        p.remarks,
        p.mri_code,
        p.mri_date_time,
        p.receipt_number,
        p.payment_type,
        p.payment_status,
        p.total_amount,
        p.created_at,
        p.updated_at,
        p.examination_test_name,
        p.examination_breakdown_amount_naira,
        p.recorded_by_staff_name,
        p.recorded_by_staff_email,
        COALESCE(
          json_agg(
            json_build_object(
              'id', e.id,
              'name', e.exam_name,
              'amount', e.exam_amount
            )
          ) FILTER (WHERE e.id IS NOT NULL),
          '[]'
        ) AS examinations
      FROM mri_patients p
      LEFT JOIN patient_examinations e 
        ON p.id = e.patient_id
      WHERE p.id = $1
      GROUP BY p.id;
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const patient = result.rows[0];

    // ✅ Helper to safely format currency strings
    const formatMoney = (val) => {
      if (!val) return "0.00";
      return Number(val).toLocaleString("en-NG", { minimumFractionDigits: 2 });
    };

    // Format amounts with commas before sending
    patient.total_amount = formatMoney(patient.total_amount);
    patient.examination_breakdown_amount_naira = formatMoney(patient.examination_breakdown_amount_naira);

    // Also format nested examinations
    if (patient.examinations && Array.isArray(patient.examinations)) {
      patient.examinations = patient.examinations.map(exam => ({
        ...exam,
        amount: formatMoney(exam.amount)
      }));
    }

    // ✅ CRASH FIX: This is the ONLY place res.json is called
    return res.json(patient);

  } catch (err) {
    console.error("Error fetching patient details:", err);
    // Only send error response if headers haven't been sent yet
    if (!res.headersSent) {
        return res.status(500).json({ message: "Failed to fetch patient details" });
    }
  }
});

// Export patients to Excel (Admin only)
app.get(
  "/api/patients/export/excel",
  auth,
  authorizeRoles("admin", "accounts"),
  async (req, res) => {
    try {
      const { search, searchField, gender, recordedBy, startDate, endDate } = req.query;

      let whereClauses = [];
      let params = [];
      let idx = 1;

      // Search filter
      if (search && search.trim() !== "") {
        const term = `%${search.trim()}%`;
        if (searchField === "patient_name") {
          whereClauses.push(`p.patient_name ILIKE $${idx++}`);
          params.push(term);
        } else if (searchField === "mri_code") {
          whereClauses.push(`p.mri_code ILIKE $${idx++}`);
          params.push(term);
        } else {
          whereClauses.push(`(p.patient_name ILIKE $${idx} OR p.mri_code ILIKE $${idx+1})`);
          params.push(term, term);
          idx += 2;
        }
      }

      if (gender && gender !== "All") {
        whereClauses.push(`p.gender = $${idx++}`);
        params.push(gender);
      }
      if (recordedBy) {
        whereClauses.push(`p.recorded_by_staff_id = $${idx++}`);
        params.push(recordedBy);
      }
      if (startDate) {
        whereClauses.push(`p.mri_date_time >= $${idx++}`);
        params.push(startDate);
      }
      if (endDate) {
        whereClauses.push(`p.mri_date_time <= $${idx++}`);
        params.push(`${endDate} 23:59:59`);
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

      // Fetch patients + exams
      const result = await pool.query(
        `
        SELECT p.*, u.full_name AS recorded_by_staff_name, u.email AS recorded_by_staff_email,
               e.exam_name, e.exam_amount
        FROM mri_patients p
        LEFT JOIN users u ON p.recorded_by_staff_id = u.id
        LEFT JOIN patient_examinations e ON p.id = e.patient_id
        ${whereSql}
        ORDER BY p.created_at DESC, p.id, e.exam_name;
        `,
        params
      );

      // Group by patient
      const patientsMap = {};
      result.rows.forEach((row) => {
        if (!patientsMap[row.id]) {
          patientsMap[row.id] = {
            ...row,
            exams: [],
          };
        }
        if (row.exam_name) {
          patientsMap[row.id].exams.push({
            name: row.exam_name,
            amount: Number(row.exam_amount || 0),
          });
        }
      });

      const patients = Object.values(patientsMap);

      // Prepare Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Patients");

      // Columns
      worksheet.columns = [
        { header: "ID", key: "id", width: 10 },
        { header: "Serial Number", key: "serial_number", width: 25 },
        { header: "Patient Name", key: "patient_name", width: 25 },
        { header: "Gender", key: "gender", width: 10 },
        { header: "Age", key: "age", width: 10 },
        { header: "Weight (kg)", key: "weight_kg", width: 12 },
        { header: "Contact Email", key: "contact_email", width: 25 },
        { header: "Contact Phone", key: "contact_phone_number", width: 20 },
        { header: "MRI Code", key: "mri_code", width: 20 },
        { header: "MRI Date Time", key: "mri_date_time", width: 25 },
        { header: "Recorded By Staff ID", key: "recorded_by_staff_id", width: 15 },
        { header: "Recorded By Staff Name", key: "recorded_by_staff_name", width: 25 },
        { header: "Recorded By Staff Email", key: "recorded_by_staff_email", width: 30 },
        { header: "Radiographer Name", key: "radiographer_name", width: 20 },
        { header: "Radiologist Name", key: "radiologist_name", width: 20 },
        { header: "Remarks", key: "remarks", width: 20 },
        { header: "Created At", key: "created_at", width: 20 },
        { header: "Updated At", key: "updated_at", width: 20 },
        { header: "Referral Hospital", key: "referral_hospital", width: 25 },
        { header: "Referring Doctor", key: "referring_doctor", width: 25 },
        { header: "Total Amount (DB)", key: "total_amount", width: 15 },
        { header: "Receipt Number", key: "receipt_number", width: 20 },
        { header: "Payment Type", key: "payment_type", width: 15 },
        { header: "Payment Status", key: "payment_status", width: 15 },
        { header: "Approved By User ID", key: "approved_by_user_id", width: 20 },
        { header: "Approved At", key: "approved_at", width: 20 },
        { header: "Examinations", key: "examinations", width: 50 },
        { header: "Total Exam Amount", key: "total_exam_amount", width: 20 },
      ];

      // Add rows
      patients.forEach((p) => {
        worksheet.addRow({
          ...p,
          examinations: p.exams.map(e => `${e.name} (₦${e.amount})`).join(", "),
          total_exam_amount: p.exams.reduce((sum, e) => sum + e.amount, 0),
        });
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", "attachment; filename=patients.xlsx");

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error("Excel export error:", err);
      res.status(500).json({ message: "Failed to export Excel" });
    }
  }
);




// Endpoint: Generate Receipt PDF

app.get("/api/patients/:id/receipt", auth, async (req, res) => {
  try {
    const patientId = req.params.id;
    const userId = req.user.id;

    // 1️⃣ Fetch patient
    const patientResult = await pool.query(
      "SELECT * FROM mri_patients WHERE id = $1",
      [patientId]
    );
    if (!patientResult.rows.length) {
      return res.status(404).json({ message: "Patient not found." });
    }
    const patient = patientResult.rows[0];

    // 2️⃣ Fetch examinations
    const examsResult = await pool.query(
      `SELECT 
          exam_name AS description,
          1 AS quantity,
          exam_amount AS unitPrice,
          exam_amount AS amount
        FROM patient_examinations
        WHERE patient_id = $1`,
      [patientId]
    );

    const items = examsResult.rows.map(i => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: parseFloat(i.unitPrice) || 0,
      amount: parseFloat(i.amount) || 0,
    }));

    const totalAmountKobo = items.reduce((sum, i) => {
      return sum + Math.round(i.amount * 100);
    }, 0);
    const totalAmount = totalAmountKobo / 100;

    // 3️⃣ Generate receipt number
    const receiptNumber = `REC-${Date.now()}`;

    // 4️⃣ Create PDF
    const doc = new PDFDocument({ margin: 50 });
    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", async () => {
      const pdfBuffer = Buffer.concat(buffers);

      // 5️⃣ Save PDF to DigitalOcean Spaces
      const key = `receipts/receipt_${patientId}_${Date.now()}.pdf`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.DO_SPACES_BUCKET,
          Key: key,
          Body: pdfBuffer,
          ContentType: "application/pdf",
          ACL: "private",
        })
      );
      const receiptUrl = `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_ENDPOINT.replace(/^https?:\/\//, "")}/${key}`;

      // 6️⃣ Update patient record
      await pool.query(
        `UPDATE mri_patients
            SET receipt_number = $1,
                payment_status = $2,
                payment_type = $3,
                receipt_url = $4,
                updated_at = NOW()
          WHERE id = $5`,
        [receiptNumber, "Paid", "Cash", receiptUrl, patientId]
      );

      // 7️⃣ Send PDF to client
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=${receiptNumber}.pdf`,
      });
      res.send(pdfBuffer);

      console.log(`✅ Receipt generated & saved: ${receiptUrl}`);
    });

    // 🖼️ Hospital logos (centered)
    const logoLeft = path.join(process.cwd(), "public/logo-left.png");
    const logoRight = path.join(process.cwd(), "public/logo-right.png");

    const logoWidth = 80;
    const logoSpacing = 20; // space between logos
    const totalWidth = (logoWidth * 2) + logoSpacing;
    const startX = (doc.page.width - totalWidth) / 2; // center both logos together
    const yPos = 30;

    // Left logo
    doc.image(logoLeft, startX, yPos, { width: logoWidth });

    // Right logo (beside it with spacing)
    doc.image(logoRight, startX + logoWidth + logoSpacing, yPos, { width: logoWidth });


    // Hospital info below logos
    doc.moveDown(5);
    doc.fontSize(18).text("LAUTECH UNIVERSITY TEACHING HOSPITAL", { align: "center", bold: true });
    doc.fontSize(10).text("Ladoke Akintola University of Technology, Ogbomoso, Oyo State, Nigeria", { align: "center" });
    doc.text("Email: info@advancedmricenter.com | Phone: +234 801 234 5678", { align: "center" });
    doc.moveDown(2);

    doc.fontSize(14).text("MRI SCAN RECEIPT", { align: "center", bold: true });
    doc.moveDown(2);

    // Receipt & patient info box
    doc.fontSize(12).font("Helvetica-Bold").text(`Receipt No: ${receiptNumber}`, { align: "left" });
    doc.font("Helvetica");
    doc.text(`Patient: ${patient.patient_name}`);
    doc.text(`Gender: ${patient.gender}`);
    doc.text(`Age: ${patient.age || "N/A"}`);
    doc.text(`Contact: ${patient.contact_email || "N/A"} / ${patient.contact_phone_number || "N/A"}`);
    doc.text(`MRI Code: ${patient.mri_code || "N/A"}`);
    doc.moveDown();

    // Table headers
    const tableTop = doc.y;
    const colX = { description: 50, qty: 300, unitPrice: 350, amount: 450 };
    doc.font("fonts/Roboto-Bold.ttf");
    doc.text("Description", colX.description, tableTop);
    doc.text("Qty", colX.qty, tableTop, { width: 40, align: "center" });
    doc.text("Amount", colX.amount, tableTop, { width: 80, align: "right" });
    doc.moveTo(50, tableTop + 15).lineTo(520, tableTop + 15).stroke();

    // Table rows
    doc.font("fonts/Roboto-Regular.ttf");
    let y = tableTop + 20;
    items.forEach(item => {
      doc.text(item.description, colX.description, y);
      doc.text(item.quantity.toString(), colX.qty, y, { width: 40, align: "center" });
      doc.text(`₦${item.amount.toLocaleString("en-NG")}`, colX.amount, y, { width: 80, align: "right" });
      y += 20;
    });

    // Total
    doc.moveTo(50, y).lineTo(520, y).stroke();
    y += 5;
    doc.font("fonts/Roboto-Bold.ttf")
       .text("Total", colX.unitPrice, y, { width: 80, align: "right" })
       .text(`₦${totalAmount.toLocaleString("en-NG")}`, colX.amount, y, { width: 80, align: "right" });

    // Footer
    doc.moveDown(4);
    doc.fontSize(10).text("Thank you for your payment.", { align: "center" });

    doc.end();

  } catch (err) {
    console.error("❌ Receipt generation failed:", err);
    res.status(500).json({ message: "Failed to generate receipt", error: err.message });
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

// Change Medical Staff Role
app.patch('/api/admin/medical-staff/:id/role', auth, authorizeRoles('admin'), async (req, res) => {
    const userId = req.params.id;
    const { role } = req.body;

    if (!role) {
        return res.status(400).json({ message: 'Role is required.' });
    }

    try {
        const targetUserResult = await pool.query(
            'SELECT id, username, role FROM users WHERE id = $1',
            [userId]
        );
        const targetUser = targetUserResult.rows[0];

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found.' });
        }
        if (targetUser.role === 'admin') {
            return res.status(403).json({ message: 'Cannot change role of another admin.' });
        }
        if (targetUser.id === req.user.id) {
            return res.status(403).json({ message: 'Cannot change your own role.' });
        }

        const updatedUser = await pool.query(
            'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, email, full_name, role',
            [role, userId]
        );

        res.status(200).json({
            message: `Medical staff ${updatedUser.rows[0].username} role updated to ${role}.`,
            user: updatedUser.rows[0]
        });

    } catch (error) {
        console.error('Error changing role:', error);
        res.status(500).json({ message: 'Server error updating user role.', error: error.message });
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
app.get('/api/queries/my', auth, authorizeRoles('medical_staff', 'admin', 'doctor', 'financial_admin'), async (req, res) => {
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

// Custom middleware to intercept res.json
app.use((req, res, next) => {
  const oldJson = res.json;
  res.json = function (data) {
    const formattedData = formatNumbersInResponse(data);
    return oldJson.call(this, formattedData);
  };
  next();
});

// ------------------ Generic error handler ------------------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && (err.stack || err.message || err));
  // If the error is a CORS block, send 403
  if (err && String(err).toLowerCase().includes('cors')) {
    return res.status(403).json({ message: 'CORS error', details: err.message || String(err) });
  }
  return res.status(500).json({ message: 'Internal server error', error: err && (err.message || String(err)) });
});

// ------------------ Start server ------------------
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080; // EB assigns PORT — default to 8080 locally
server.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});

// Export (optional, useful for tests)
export { app, server, pool, io };