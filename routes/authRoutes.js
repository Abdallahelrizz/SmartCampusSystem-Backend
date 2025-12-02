const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.get('/profile', authenticateToken, AuthController.getProfile);
router.put('/profile', authenticateToken, AuthController.updateProfile);

// Password reset (simplified for prototype)
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const User = require('../models/User');
        const EmailService = require('../utils/emailService');
        const user = await User.findByEmail(email);
        
        if (user) {
            // Generate reset token (simplified)
            const resetToken = require('crypto').randomBytes(32).toString('hex');
            // In production, store this token with expiration
            await EmailService.sendPasswordReset(email, resetToken);
            res.json({ message: 'Password reset email sent (simulated)' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

