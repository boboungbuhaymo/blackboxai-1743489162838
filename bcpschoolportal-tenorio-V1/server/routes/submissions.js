const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure file storage for submissions
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../public/uploads/submissions'));
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

// Submit an assignment (Student only)
router.post('/', 
    authenticateToken, 
    upload.single('file'), 
    async (req, res) => {
        try {
            const { assignment_id } = req.body;
            const file_path = req.file ? `/uploads/submissions/${req.file.filename}` : null;
            const connection = await db.getConnection();
            
            try {
                const [result] = await connection.query(
                    `INSERT INTO submissions (assignment_id, student_id, file_path) 
                    VALUES (?, ?, ?)`,
                    [assignment_id, req.user.id, file_path]
                );
                
                res.status(201).json({ 
                    id: result.insertId,
                    assignment_id,
                    student_id: req.user.id,
                    file_path
                });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Failed to submit assignment' });
            } finally {
                connection.release();
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// Get all submissions for a specific assignment
router.get('/:assignment_id', authenticateToken, async (req, res) => {
    try {
        const { assignment_id } = req.params;
        const connection = await db.getConnection();
        
        try {
            const [submissions] = await connection.query(
                'SELECT * FROM submissions WHERE assignment_id = ?',
                [assignment_id]
            );
            res.json(submissions);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve submissions' });
    }
});

// Get a specific submission
router.get('/submission/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await db.getConnection();
        
        try {
            const [submissions] = await connection.query(
                'SELECT * FROM submissions WHERE id = ?',
                [id]
            );
            
            if (!submissions.length) {
                return res.status(404).json({ error: 'Submission not found' });
            }
            
            res.json(submissions[0]);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve submission' });
    }
});

// Update a submission (Student only)
router.put('/:id', 
    authenticateToken, 
    upload.single('file'), 
    async (req, res) => {
        try {
            const { id } = req.params;
            const file_path = req.file ? `/uploads/submissions/${req.file.filename}` : null;
            const connection = await db.getConnection();
            
            try {
                const [result] = await connection.query(
                    `UPDATE submissions SET file_path = ? WHERE id = ? AND student_id = ?`,
                    [file_path, id, req.user.id]
                );
                
                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: 'Submission not found or not owned by student' });
                }
                
                res.json({ message: 'Submission updated successfully' });
            } finally {
                connection.release();
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to update submission' });
        }
    }
);

// Delete a submission (Student only)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await db.getConnection();
        
        try {
            const [result] = await connection.query(
                'DELETE FROM submissions WHERE id = ? AND student_id = ?',
                [id, req.user.id]
            );
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Submission not found or not owned by student' });
            }
            
            res.json({ message: 'Submission deleted successfully' });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete submission' });
    }
});

module.exports = router;