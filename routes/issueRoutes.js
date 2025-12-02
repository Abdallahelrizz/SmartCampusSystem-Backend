const express = require('express');
const router = express.Router();
const IssueController = require('../controllers/issueController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// File filter to only accept images
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({ 
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
};

router.post('/', authenticateToken, upload.single('file'), handleUploadError, IssueController.createIssue);
router.get('/my-issues', authenticateToken, IssueController.getMyIssues);
router.get('/all', authenticateToken, requireRole('admin', 'maintenance'), IssueController.getAllIssues);
router.get('/:issueId', authenticateToken, IssueController.getIssueById);
router.get('/:issueId/activities', authenticateToken, IssueController.getIssueActivities);
router.post('/:issueId/activity', authenticateToken, requireRole('maintenance', 'admin'), IssueController.addIssueActivity);
router.put('/:issueId/status', authenticateToken, requireRole('maintenance', 'admin'), IssueController.updateIssueStatus);
router.delete('/:issueId', authenticateToken, IssueController.cancelIssue);

module.exports = router;

