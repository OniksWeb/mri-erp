// backend/controllers/storeController.js
import pool from '../config/db.js'; // or your pool configuration path

// 1. Get all physical store items with stock telemetry
export const getStoreItems = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM store_items ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching store items:', err);
    res.status(500).json({ message: 'Server error fetching store items' });
  }
};

// 2. Add a new store item
export const addStoreItem = async (req, res) => {
  try {
    const { item_name, category, serial_number, total_units, min_level } = req.body;
    const query = `
      INSERT INTO store_items (item_name, category, serial_number, total_units, available_units, min_level)
      VALUES ($1, $2, $3, $4, $4, COALESCE($5, 5))
      RETURNING *;
    `;
    const values = [item_name, category, serial_number, total_units, min_level];
    const result = await pool.query(query, values);
    res.status(201).json({ message: 'Store equipment added successfully', item: result.rows[0] });
  } catch (err) {
    console.error('Error adding store item:', err);
    res.status(500).json({ message: 'Server error adding store item' });
  }
};

// 3. Update store item details (Edit capability)
export const updateStoreItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { item_name, category, serial_number, total_units, min_level } = req.body;

    const query = `
      UPDATE store_items 
      SET item_name = COALESCE($1, item_name),
          category = COALESCE($2, category),
          serial_number = COALESCE($3, serial_number),
          total_units = COALESCE($4, total_units),
          min_level = COALESCE($5, min_level)
      WHERE id = $6
      RETURNING *;
    `;
    const values = [item_name, category, serial_number, total_units, min_level, id];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Store item not found' });
    }

    res.json({ message: 'Item updated successfully', item: result.rows[0] });
  } catch (err) {
    console.error('Error updating store item:', err);
    res.status(500).json({ message: 'Server error updating store item' });
  }
};

// 4. Delete store item
export const deleteStoreItem = async (req, res) => {
  try {
    const { id } = req.params;
    const checkResult = await pool.query('SELECT * FROM store_items WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Store equipment not found' });
    }

    await pool.query('DELETE FROM store_items WHERE id = $1', [id]);
    res.json({ message: 'Store equipment deleted successfully' });
  } catch (err) {
    console.error('Error deleting store item:', err);
    res.status(500).json({ message: 'Server error while deleting store item' });
  }
};

// 5. Checkout / Rent Store Item with Full Custody Logging
export const checkoutStoreItem = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { store_item_id, borrower_name, borrower_id_or_staff, customer_or_department, checkout_condition, notes } = req.body;
    const userId = req.user?.id;

    // Check availability
    const itemRes = await client.query('SELECT * FROM store_items WHERE id = $1', [store_item_id]);
    if (itemRes.rows.length === 0) {
      throw new Error('Store item not found');
    }
    const item = itemRes.rows[0];
    if (item.available_units <= 0) {
      throw new Error('No available units left for checkout');
    }

    // Decrement available units
    await client.query('UPDATE store_items SET available_units = available_units - 1 WHERE id = $1', [store_item_id]);

    // Insert into custody logs
    const logQuery = `
      INSERT INTO store_custody_logs 
      (store_item_id, borrower_name, borrower_id_or_staff, customer_or_department, status, checkout_condition, checked_out_by, notes)
      VALUES ($1, $2, $3, $4, 'CHECKED_OUT', $5, $6, $7)
      RETURNING *;
    `;
    const logValues = [store_item_id, borrower_name, borrower_id_or_staff, customer_or_department, checkout_condition, userId, notes];
    const logResult = await client.query(logQuery, logValues);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Checkout recorded successfully', log: logResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Checkout error:', err);
    res.status(400).json({ message: err.message || 'Checkout process failed' });
  } finally {
    client.release();
  }
};

// 6. Process Return with Condition Review
export const returnStoreItem = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { log_id, return_condition } = req.body;
    const userId = req.user?.id;

    const logRes = await client.query('SELECT * FROM store_custody_logs WHERE id = $1', [log_id]);
    if (logRes.rows.length === 0) {
      throw new Error('Custody log entry not found');
    }
    const log = logRes.rows[0];
    if (log.status === 'RETURNED') {
      throw new Error('Item has already been returned');
    }

    // Update log status and return timestamp
    await client.query(`
      UPDATE store_custody_logs 
      SET status = 'RETURNED', return_condition = $1, returned_to = $2, returned_at = CURRENT_TIMESTAMP 
      WHERE id = $3
    `, [return_condition, userId, log_id]);

    // Increment available units back
    await client.query('UPDATE store_items SET available_units = available_units + 1 WHERE id = $1', [log.store_item_id]);

    await client.query('COMMIT');
    res.json({ message: 'Return processed successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Return error:', err);
    res.status(400).json({ message: err.message || 'Return process failed' });
  } finally {
    client.release();
  }
};

// 7. Get Comprehensive Custody Logs
export const getStoreLogs = async (req, res) => {
  try {
    const query = `
      SELECT l.*, i.item_name, i.serial_number, i.category 
      FROM store_custody_logs l
      JOIN store_items i ON l.store_item_id = i.id
      ORDER BY l.checked_out_at DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching store logs:', err);
    res.status(500).json({ message: 'Server error fetching store logs' });
  }
};