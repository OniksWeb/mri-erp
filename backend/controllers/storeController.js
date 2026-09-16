// backend/controllers/storeController.js
import pool from '../config/db.js';

// Get all store items and equipment
export const getStoreItems = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM store_items ORDER BY created_at DESC');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching store items:', err);
        res.status(500).json({ message: 'Server error while fetching store items' });
    }
};

// Add this inside storeController.js
export const deleteStoreItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if item exists
    const checkResult = await pool.query('SELECT * FROM store_items WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Store equipment not found' });
    }

    // Execute deletion
    await pool.query('DELETE FROM store_items WHERE id = $1', [id]);
    
    res.status(200).json({ message: 'Store equipment deleted successfully' });
  } catch (err) {
    console.error('Error deleting store item:', err);
    res.status(500).json({ message: 'Server error while deleting store item' });
  }
};

// Add a new physical tool or equipment to the store
export const addStoreItem = async (req, res) => {
    const { item_name, category, serial_number, total_units } = req.body;
    try {
        const newItem = await pool.query(
            `INSERT INTO store_items (item_name, category, serial_number, total_units, available_units) 
             VALUES ($1, $2, $3, $4, $4) RETURNING *`,
            [item_name, category, serial_number, total_units || 1]
        );
        res.status(201).json({ message: 'Store item added successfully', item: newItem.rows[0] });
    } catch (err) {
        console.error('Error adding store item:', err);
        res.status(500).json({ message: 'Failed to add store item' });
    }
};

// Checkout/Rent out equipment with a detailed initial condition review
export const checkoutStoreItem = async (req, res) => {
    const { store_item_id, borrower_name, borrower_id_or_staff, checkout_condition, notes } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check availability
        const itemCheck = await client.query('SELECT * FROM store_items WHERE id = $1', [store_item_id]);
        if (itemCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Store item not found' });
        }

        const item = itemCheck.rows[0];
        if (item.available_units <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Item out of stock / All units currently checked out' });
        }

        // Decrement available units
        await client.query(
            'UPDATE store_items SET available_units = available_units - 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [store_item_id]
        );

        // Create custody log record
        const logResult = await client.query(
            `INSERT INTO store_logs (store_item_id, borrower_name, borrower_id_or_staff, transaction_type, checkout_condition, status, notes)
             VALUES ($1, $2, $3, 'CHECKOUT', $4, 'CHECKED_OUT', $5) RETURNING *`,
            [store_item_id, borrower_name, borrower_id_or_staff, checkout_condition, notes]
        );

        await client.query('COMMIT');
        res.status(201).json({ message: 'Item checked out successfully', log: logResult.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during checkout transaction:', err);
        res.status(500).json({ message: 'Failed to process checkout' });
    } finally {
        client.release();
    }
};

// Return equipment with a detailed review of its condition upon return
export const returnStoreItem = async (req, res) => {
    const { log_id, return_condition, notes } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find the active log entry
        const logCheck = await client.query('SELECT * FROM store_logs WHERE id = $1 AND status = $2', [log_id, 'CHECKED_OUT']);
        if (logCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Active checkout log not found for this item' });
        }

        const log = logCheck.rows[0];

        // Update log to returned status and record return review
        await client.query(
            `UPDATE store_logs SET status = 'RETURNED', return_condition = $1, returned_at = CURRENT_TIMESTAMP, notes = COALESCE($2, notes)
             WHERE id = $3`,
            [return_condition, notes, log_id]
        );

        // Increment available units back in store items
        await client.query(
            'UPDATE store_items SET available_units = available_units + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [log.store_item_id]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: 'Item returned and condition logged successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during return transaction:', err);
        res.status(500).json({ message: 'Failed to process return' });
    } finally {
        client.release();
    }
};

// Get all store audit/custody logs
export const getStoreLogs = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT store_logs.*, store_items.item_name, store_items.serial_number, store_items.category 
            FROM store_logs 
            JOIN store_items ON store_logs.store_item_id = store_items.id 
            ORDER BY store_logs.checked_out_at DESC
        `);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching store logs:', err);
        res.status(500).json({ message: 'Server error while fetching logs' });
    }
};