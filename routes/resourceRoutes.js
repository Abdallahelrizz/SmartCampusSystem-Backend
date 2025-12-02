const express = require('express');
const router = express.Router();
const ResourceController = require('../controllers/resourceController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.post('/', authenticateToken, requireRole('admin'), ResourceController.createResource);
router.get('/', authenticateToken, requireRole('admin'), ResourceController.getAllResources);
router.put('/:resourceId', authenticateToken, requireRole('admin'), ResourceController.updateResource);
router.delete('/:resourceId', authenticateToken, requireRole('admin'), ResourceController.deleteResource);

module.exports = router;

