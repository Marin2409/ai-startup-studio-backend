import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import sql from '../configs/db.js';

// Create a router
const protectedRouter = express.Router();

// =============================================
// APPLY AUTHENTICATION TO ALL ROUTES
// =============================================
protectedRouter.use(authenticateToken);

// =============================================
// PROTECTED ROUTES (All require valid JWT token)
// =============================================

// GET /api/profile - Get current user's profile
// http://localhost:3000/api/profile
protectedRouter.get('/profile', async (req, res) => {
    try {
        const user = await sql`SELECT id, first_name, last_name, email, created_at FROM users WHERE id = ${req.user.userId}`;
        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch profile' });
    }
});

export default protectedRouter;


