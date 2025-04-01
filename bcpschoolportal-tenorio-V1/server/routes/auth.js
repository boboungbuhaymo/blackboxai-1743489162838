const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../db');
const { authenticateToken } = require('../middleware/auth');

// User registration
router.post('/register', async (req, res) => {
    try {
        const { username, password, email, role } = req.body;
        
        // Validate role
        if (!['admin', 'teacher', 'student'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role specified' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into database
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
        res.status(500).json({ error: 'Registration failed' });
    }
});

// User login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const connection = await db.getConnection();
        
        try {
            const [users] = await connection.query(
                'SELECT * FROM users WHERE username = ?',
                [username]
            );
            
            if (!users.length) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const user = users[0];
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Create JWT token
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.json({ 
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    email: user.email
                }
            });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Password reset request
router.post('/request-password-reset', (req, res) => {
    // Implementation would go here
    res.json({ message: 'Password reset link sent to email' });
});

// Verify token and reset password
router.post('/reset-password', (req, res) => {
    // Implementation would go here
    res.json({ message: 'Password reset successful' });
});

module.exports = router;