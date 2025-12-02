const express = require('express');
const router = express.Router();
const SystemConfigController = require('../controllers/systemConfigController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', authenticateToken, requireRole('admin'), SystemConfigController.getConfig);
router.put('/', authenticateToken, requireRole('admin'), SystemConfigController.updateConfig);

module.exports = router;

