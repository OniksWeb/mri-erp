// backend/controllers/inventoryController.js
import pool from '../config/db.js';

// Get all inventory items
export const getInventory = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM inventory_items ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching inventory:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// Create a new inventory item
export const createItem = async (req, res) => {
    try {
        const { 
            item_name, 
            category, 
            sku, 
            quantity_in_stock, 
            reorder_level, 
            unit_of_measurement, 
            unit_price, 
            location_id 
        } = req.body;
        
        const query = `
            INSERT INTO inventory_items 
            (item_name, category, sku, quantity_in_stock, reorder_level, unit_of_measurement, unit_price, location_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            RETURNING *;
        `;
        
        const values = [
            item_name, 
            category, 
            sku || null, 
            quantity_in_stock || 0, 
            reorder_level || 0, 
            unit_of_measurement || 'pcs', 
            unit_price || 0, 
            location_id || 1
        ];

        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating inventory item:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// Delete an inventory item
export const deleteItem = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM inventory_items WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({ message: 'Item deleted successfully', item: result.rows[0] });
    } catch (err) {
        console.error('Error deleting inventory item:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// Record stock movement / transaction
export const recordTransaction = async (req, res) => {
    const client = await pool.connect();
    try {
        const { item_id, quantity_change, transaction_type, notes } = req.body;
        
        await client.query('BEGIN');

        // Update current stock safely using a transaction
        const updateStockQuery = `
            UPDATE inventory_items 
            SET quantity_in_stock = quantity_in_stock + $1, updated_at = NOW()
            WHERE id = $2
            RETURNING *;
        `;
        const updateRes = await client.query(updateStockQuery, [quantity_change, item_id]);

        if (updateRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        // Log transaction history
        await client.query(`
            INSERT INTO inventory_logs (item_id, quantity_change, transaction_type, notes, created_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [item_id, quantity_change, transaction_type || 'ADJUSTMENT', notes || '']);

        await client.query('COMMIT');
        res.json({ message: 'Transaction recorded successfully', item: updateRes.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error recording transaction:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};