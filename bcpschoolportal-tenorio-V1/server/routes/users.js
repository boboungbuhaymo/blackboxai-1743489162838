const express = require('express');
const router = express.Router();
const db = require('../../db');
const bcrypt = require('bcryptjs');
const { authenticateToken, checkRole } = require('../middleware/auth');

// Get all users (Admin only)
router.get('/', authenticateToken, checkRole(['admin']), async (req, res) => {
    try {
        const connection = await db.getConnection();
        try {
            const [users] = await connection.query(
                'SELECT id, username, email, role FROM users'
            );
            res.json(users);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve users' });
    }
});

// Create a new user (Admin only)
router.post('/', authenticateToken, checkRole(['admin']), async (req, res) => {
    try {
        const { username, password, email, role } = req.body;

        // Validate role
        if (!['admin', 'teacher', 'student'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role specified' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const connection = await db.getConnection();
        
        try {
            const [result] = await connection.query(
                'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
                [username, hashedPassword, email, role]
            );
            
            res.status(201).json({ 
                id: result.insertId,
                username,
                email,
                role
            });
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Username or email already exists' });
            }
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update user details (Admin only)
router.put('/:id', authenticateToken, checkRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, role } = req.body;
        const connection = await db.getConnection();
        
        try {
            const [result] = await connection.query(
                'UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?',
                [username, email, role, id]
            );
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            res.json({ message: 'User updated successfully' });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete a user (Admin only)
router.delete('/:id', authenticateToken, checkRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await db.getConnection();
        
        try {
            const [result] = await connection.query(
                'DELETE FROM users WHERE id = ?',
                [id]
            );
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            res.json({ message: 'User deleted successfully' });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = router;