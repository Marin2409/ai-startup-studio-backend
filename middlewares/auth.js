import jwt from 'jsonwebtoken';
import sql from '../configs/db.js';

const authenticateToken = async (req, res, next) => {
    try {
        // Validate JWT_SECRET exists
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET environment variable is required');
            return res.status(500).json({
                success: false,
                message: 'Server configuration error'
            });
        }

        // Get token from Authorization header
        const token = req.headers.authorization?.split(' ')[1];

        // Check if token exists
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token required. Please login.'
            });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Extract user info from token payload
        const { userId, email } = decoded;

        // Verify user still exists in database
        const users = await sql`
            SELECT id, first_name, last_name, email, created_at
            FROM users 
            WHERE id = ${userId}
        `;

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = users[0];

        // Store user info in request object for downstream middleware/routes
        req.user = {
            userId: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            createdAt: user.created_at
        };

        next();

    } catch (error) {
        console.error('Auth middleware error:', error);

        // Handle database connection errors
        if (error.message?.includes('connect') || error.message?.includes('timeout')) {
            return res.status(503).json({ 
                success: false, 
                message: 'Database connection error. Please try again.' 
            });
        }

        // Handle specific JWT errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({
                success: false,
                message: 'Invalid token format'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please login again.'
            });
        }
    
        // Generic error
        return res.status(500).json({
            success: false,
            message: 'Token verification failed'
        });
    }
};

export { authenticateToken };