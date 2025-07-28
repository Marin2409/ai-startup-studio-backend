import express from 'express';
import { registerUser, loginUser } from '../controllers/userController.js';

// Create a router
const router = express.Router();

// Register a new user
// Route POST: /api/user/register
// http://localhost:3000/api/user/register
router.post('/register', registerUser);

// Login a user
// Route POST: /api/user/login
// http://localhost:3000/api/user/login
router.post('/login', loginUser);

// Complete onboarding
// Route POST: /api/user/complete-onboarding
// http://localhost:3000/api/user/complete-onboarding
// router.post('/complete-onboarding', completeOnboarding);

// GET /api/users - Get all users (for development/testing)
// http://localhost:3000/api/user/users
// router.get('/get-all-users', getUsers);

// GET /api/users/:id - Get user by ID (for development/testing)
// http://localhost:3000/api/user/1
// router.get('/:id', getUserById);

export default router;