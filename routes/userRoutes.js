import express from 'express';
import { registerUser, loginUser, updateUserProfile, deleteCurrentUser } from '../controllers/userController.js';
import { createProject, getUserProjects, getProjectById, updateProject, deleteProject, purchaseProjectDocuments } from '../controllers/projectController.js';
import { pricingOnboarding, getUserWithBilling, updateUserPlan, cancelSubscription, purchaseAddonPackage, purchaseImagePack } from '../controllers/billingController.js';
import { authenticateToken } from '../middlewares/auth.js';

// Create a router
const router = express.Router();    

// =============================================
// POST REQUESTS
// =============================================

// Register a new user
// Route POST: /api/user/register
// http://localhost:3000/api/user/register
router.post('/register', registerUser);

// Login a user
// Route POST: /api/user/login
// http://localhost:3000/api/user/login
router.post('/login', loginUser);

// Pricing Onboarding
// Route POST: /api/user/pricing-onboarding
// http://localhost:3000/api/user/pricing-onboarding
router.post('/pricing-onboarding', authenticateToken, pricingOnboarding);

// Create a new project
// Route POST: /api/user/create-project
// http://localhost:3000/api/user/create-project
router.post('/create-project', authenticateToken, createProject);

// Purchase add-on package
// Route POST: /api/user/purchase-addon
// http://localhost:3000/api/user/purchase-addon
router.post('/purchase-addon', authenticateToken, purchaseAddonPackage);

// Purchase image pack (account-wide)
// Route POST: /api/user/purchase-images
// http://localhost:3000/api/user/purchase-images
router.post('/purchase-images', authenticateToken, purchaseImagePack);

// Purchase documents for specific project
// Route POST: /api/projects/:projectId/purchase-documents
// http://localhost:3000/api/projects/:projectId/purchase-documents
router.post('/projects/:projectId/purchase-documents', authenticateToken, purchaseProjectDocuments);

// =============================================
// GET REQUESTS
// =============================================

// Get user's projects
// Route GET: /api/user/projects
// http://localhost:3000/api/user/projects
router.get('/projects', authenticateToken, getUserProjects);

// Get single project by ID
// Route GET: /api/user/projects/:projectId
// http://localhost:3000/api/user/projects/:projectId
router.get('/projects/:projectId', authenticateToken, getProjectById);

// Get user profile with billing information 
// Route GET: /api/user/profile
// http://localhost:3000/api/user/profile
router.get('/profile', authenticateToken, getUserWithBilling);

// =============================================
// PUT REQUESTS
// =============================================

// Update user profile
// Route PUT: /api/user/profile
// http://localhost:3000/api/user/profile
router.put('/profile', authenticateToken, updateUserProfile);

// Update user plan
// Route PUT: /api/user/plan
// http://localhost:3000/api/user/plan
router.put('/plan', authenticateToken, updateUserPlan);

// Cancel subscription (downgrade to free)
// Route PUT: /api/user/cancel-subscription
// http://localhost:3000/api/user/cancel-subscription
router.put('/cancel-subscription', authenticateToken, cancelSubscription);

// Update project settings
// Route PUT: /api/user/projects/:projectId
// http://localhost:3000/api/user/projects/:projectId
router.put('/projects/:projectId', authenticateToken, updateProject);

// =============================================
// DELETE REQUESTS
// =============================================

// Delete project
// Route DELETE: /api/user/projects/:projectId
// http://localhost:3000/api/user/projects/:projectId
router.delete('/projects/:projectId', authenticateToken, deleteProject);

// Delete current user account and related data
// Route DELETE: /api/user/profile
// http://localhost:3000/api/user/profile
router.delete('/profile', authenticateToken, deleteCurrentUser);

export default router;