// backend/controllers/inventoryController.js
import pool from '../config/db.js';

// 1. Get all inventory items with current stock metrics
export const getInventoryItems = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory_items ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching inventory items:', err);
    res.status(500).json({ message: 'Server error fetching inventory items' });
  }
};

// 2. Add a new inventory item
export const addInventoryItem = async (req, res) => {
  try {
    const { item_name, category, sku, current_stock, min_level, unit_price } = req.body;
    const userId = req.user?.id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO inventory_items (item_name, category, sku, current_stock, min_level, unit_price)
        VALUES ($1, $2, $3, $4, COALESCE($5, 5), COALESCE($6, 0.00))
        RETURNING *;
      `;
      const itemRes = await client.query(insertQuery, [item_name, category, sku, current_stock, min_level, unit_price]);
      const newItem = itemRes.rows[0];

      // Log initial inbound movement
      await client.query(`
        INSERT INTO inventory_movements (item_id, movement_type, quantity_changed, previous_stock, new_stock, performed_by, notes)
        VALUES ($1, 'INBOUND_RECEIPT', $2, 0, $2, $3, 'Initial stock entry upon registration')
      `, [newItem.id, current_stock, userId]);

      await client.query('COMMIT');
      res.status(201).json({ message: 'Inventory item added successfully', item: newItem });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error adding inventory item:', err);
    res.status(500).json({ message: 'Server error adding inventory item' });
  }
};

// 3. Update inventory item details (Edit capability)
export const updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { item_name, category, sku, min_level, unit_price } = req.body;

    const query = `
      UPDATE inventory_items 
      SET item_name = COALESCE($1, item_name),
          category = COALESCE($2, category),
          sku = COALESCE($3, sku),
          min_level = COALESCE($4, min_level),
          unit_price = COALESCE($5, unit_price),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *;
    `;
    const result = await pool.query(query, [item_name, category, sku, min_level, unit_price, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    res.json({ message: 'Inventory item updated successfully', item: result.rows[0] });
  } catch (err) {
    console.error('Error updating inventory item:', err);
    res.status(500).json({ message: 'Server error updating inventory item' });
  }
};

// 4. Adjust Stock (Inbound Restock or Outbound Consumption) with Audit Logging
export const adjustInventoryStock = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { item_id, adjustment_type, quantity, reference_number, notes } = req.body; // adjustment_type: 'INBOUND_RECEIPT' or 'CONSUMPTION'
    const userId = req.user?.id;

    const itemRes = await client.query('SELECT * FROM inventory_items WHERE id = $1', [item_id]);
    if (itemRes.rows.length === 0) {
      throw new Error('Inventory item not found');
    }
    const item = itemRes.rows[0];
    const prevStock = item.current_stock;
    let newStock = prevStock;

    if (adjustment_type === 'INBOUND_RECEIPT') {
      newStock = prevStock + Number(quantity);
    } else if (adjustment_type === 'CONSUMPTION') {
      if (prevStock < Number(quantity)) {
        throw new Error('Insufficient stock for consumption amount');
      }
      newStock = prevStock - Number(quantity);
    } else {
      throw new Error('Invalid adjustment type specified');
    }

    // Update item stock level
    await client.query('UPDATE inventory_items SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStock, item_id]);

    // Record immutable movement log
    await client.query(`
      INSERT INTO inventory_movements 
      (item_id, movement_type, quantity_changed, previous_stock, new_stock, performed_by, reference_number, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [item_id, adjustment_type, quantity, prevStock, newStock, userId, reference_number, notes]);

    await client.query('COMMIT');
    res.json({ message: 'Stock adjusted and logged successfully', new_stock: newStock });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Stock adjustment error:', err);
    res.status(400).json({ message: err.message || 'Stock adjustment failed' });
  } finally {
    client.release();
  }
};

// 5. Delete Inventory Item
export const deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const checkResult = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    await pool.query('DELETE FROM inventory_items WHERE id = $1', [id]);
    res.json({ message: 'Inventory item deleted successfully' });
  } catch (err) {
    console.error('Error deleting inventory item:', err);
    res.status(500).json({ message: 'Server error while deleting inventory item' });
  }
};

// 6. Get Comprehensive Inventory Movement Audit Ledger
export const getInventoryMovements = async (req, res) => {
  try {
    const query = `
      SELECT m.*, i.item_name, i.sku, i.category, u.username as performed_by_name
      FROM inventory_movements m
      JOIN inventory_items i ON m.item_id = i.id
      LEFT JOIN users u ON m.performed_by = u.id
      ORDER BY m.created_at DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching inventory movements:', err);
    res.status(500).json({ message: 'Server error fetching inventory audit logs' });
  }
};