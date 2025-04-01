const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken, checkRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure file storage for assignment attachments
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../public/uploads/assignments'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Create a new assignment (Teacher only)
router.post('/', 
    authenticateToken, 
    checkRole(['teacher']), 
    upload.single('attachment'), 
    async (req, res) => {
        try {
            const { title, description, subject, due_date } = req.body;
            const attachment = req.file ? `/uploads/assignments/${req.file.filename}` : null;
            const connection = await db.getConnection();
            
            try {
                const [result] = await connection.query(
                    `INSERT INTO assignments 
                    (title, description, subject, due_date, created_by, attachment) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [title, description, subject, due_date, req.user.id, attachment]
                );
                
                res.status(201).json({ 
                    id: result.insertId,
                    title,
                    subject,
                    due_date,
                    attachment
                });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Failed to create assignment' });
            } finally {
                connection.release();
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// Get all assignments
router.get('/', authenticateToken, async (req, res) => {
    try {
        let query = 'SELECT * FROM assignments';
        const params = [];
        
        if (req.user.role === 'teacher') {
            query += ' WHERE created_by = ?';
            params.push(req.user.id);
        }

        const connection = await db.getConnection();
        try {
            const [assignments] = await connection.query(query, params);
            res.json(assignments);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve assignments' });
    }
});

// Get a specific assignment
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await db.getConnection();
        
        try {
            const [assignments] = await connection.query(
                'SELECT * FROM assignments WHERE id = ?',
                [id]
            );
            
            if (!assignments.length) {
                return res.status(404).json({ error: 'Assignment not found' });
            }
            
            res.json(assignments[0]);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve assignment' });
    }
});

// Update an assignment (Teacher only)
router.put('/:id', 
    authenticateToken, 
    checkRole(['teacher']), 
    upload.single('attachment'),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { title, description, subject, due_date } = req.body;
            const attachment = req.file ? `/uploads/assignments/${req.file.filename}` : null;
            const connection = await db.getConnection();
            
            try {
                const [result] = await connection.query(
                    `UPDATE assignments SET 
                    title = ?, description = ?, subject = ?, due_date = ?, attachment = ?
                    WHERE id = ? AND created_by = ?`,
                    [title, description, subject, due_date, attachment, id, req.user.id]
                );
                
                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: 'Assignment not found or not owned by teacher' });
                }
                
                res.json({ message: 'Assignment updated successfully' });
            } finally {
                connection.release();
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to update assignment' });
        }
    }
);

// Delete an assignment (Teacher only)
router.delete('/:id', authenticateToken, checkRole(['teacher']), async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await db.getConnection();
        
        try {
            const [result] = await connection.query(
                'DELETE FROM assignments WHERE id = ? AND created_by = ?',
                [id, req.user.id]
            );
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Assignment not found or not owned by teacher' });
            }
            
            res.json({ message: 'Assignment deleted successfully' });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete assignment' });
    }
});

module.exports = router;