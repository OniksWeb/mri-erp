// backend/controllers/inventoryController.js
const pool = require('../config/db'); // adjust based on your db connection

const getInventory = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM inventory');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createItem = async (req, res) => {
    // implementation
};

const deleteItem = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM inventory WHERE id = $1', [id]);
        res.json({ message: 'Item deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const recordTransaction = async (req, res) => {
    // implementation
};

module.exports = { getInventory, createItem, deleteItem, recordTransaction };