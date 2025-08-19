import sql from '../configs/db.js';

// =============================================
// POST REQUESTS
// =============================================

// Create a new project
// Route POST: /api/user/create-project
// http://localhost:3000/api/user/create-project
const createProject = async (req, res) => {
    try {
        const { userId } = req.user; // From auth middleware
        const { 
            project_name, 
            industry, 
            team_size, 
            primary_objective, 
            timeline, 
            budget_range, 
            technical_level, 
            need_cofounder, 
            preferred_tech_stack, 
            project_description,
            ai_prompt
        } = req.body;

        console.log('Creating project for user:', userId);
        console.log('Project data:', req.body);

        // Input validation
        if (!project_name || !industry || !team_size || !primary_objective || 
            !timeline || !budget_range || !technical_level || !preferred_tech_stack) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided'
            });
        }

        // Validate field values against database constraints
        const validIndustries = ['saas', 'ecommerce', 'fintech', 'healthtech', 'edtech', 'marketplace', 'social', 'enterprise', 'gaming', 'other'];
        const validTeamSizes = ['solo', '2-5', '6-10', '11-25', '25+'];
        const validObjectives = ['mvp', 'funding', 'scale', 'cofounder', 'validate'];
        const validTimelines = ['1-3', '3-6', '6-12', '12+'];
        const validBudgets = ['0-5k', '5k-15k', '15k-50k', '50k+'];
        const validTechLevels = ['non-technical', 'some', 'technical', 'expert'];
        const validTechStacks = ['react-node', 'python-django', 'mobile-first', 'wordpress', 'custom'];

        if (!validIndustries.includes(industry)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid industry selected'
            });
        }

        if (!validTeamSizes.includes(team_size)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid team size selected'
            });
        }

        if (!validObjectives.includes(primary_objective)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid primary objective selected'
            });
        }

        if (!validTimelines.includes(timeline)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid timeline selected'
            });
        }

        if (!validBudgets.includes(budget_range)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid budget range selected'
            });
        }

        if (!validTechLevels.includes(technical_level)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid technical level selected'
            });
        }

        if (!validTechStacks.includes(preferred_tech_stack)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tech stack selected'
            });
        }

        // Validate project name length
        if (project_name.trim().length < 1) {
            return res.status(400).json({
                success: false,
                message: 'Project name cannot be empty'
            });
        }

        // Check if user exists and get their current plan
        const userResult = await sql`
            SELECT 
                u.id,
                b.selected_plan
            FROM users u
            LEFT JOIN billing b ON u.id = b.user_id
            WHERE u.id = ${userId}
        `;

        if (userResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = userResult[0];
        
        // Determine base documents based on user's plan
        const planDocuments = {
            'free': 6,
            'builder': 16,
            'enterprise': 32
        };
        
        const userPlan = user.selected_plan || 'free';
        const baseDocuments = planDocuments[userPlan] || 6;

        // Create the project
        const result = await sql`
            INSERT INTO projects (
                user_id, project_name, industry, team_size, primary_objective,
                timeline, budget_range, technical_level, need_cofounder,
                preferred_tech_stack, project_description, ai_prompt, status, onboarding_completed, base_documents
            ) VALUES (
                ${userId}, ${project_name.trim()}, ${industry}, ${team_size}, ${primary_objective},
                ${timeline}, ${budget_range}, ${technical_level}, ${need_cofounder || false},
                ${preferred_tech_stack}, ${project_description ? project_description.trim() : null}, 
                ${ai_prompt ? ai_prompt.trim() : null}, 'active', true, ${baseDocuments}
            )
            RETURNING id, project_name, industry, team_size, primary_objective, timeline, 
                     budget_range, technical_level, need_cofounder, preferred_tech_stack, 
                     project_description, ai_prompt, status, created_at
        `;

        const newProject = result[0];

        console.log('Project created successfully:', newProject.id);

        // Return success response
        res.status(201).json({
            success: true,
            message: 'Project created successfully',
            project: {
                id: newProject.id,
                name: newProject.project_name,
                industry: newProject.industry,
                teamSize: newProject.team_size,
                objective: newProject.primary_objective,
                timeline: newProject.timeline,
                budget: newProject.budget_range,
                technicalLevel: newProject.technical_level,
                needCofounder: newProject.need_cofounder,
                techStack: newProject.preferred_tech_stack,
                description: newProject.project_description,
                aiPrompt: newProject.ai_prompt,
                status: newProject.status,
                createdAt: newProject.created_at
            }
        });

    } catch (error) {
        console.error('Create project error:', error);

        // Handle specific database errors
        if (error.message?.includes('duplicate key') || error.code === '23505') { 
            return res.status(400).json({ 
                success: false, 
                message: 'A project with this name already exists' 
            });
        }
        
        if (error.code === '23514') { 
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid input data format' 
            });
        }

        if (error.code === '23503') { 
            return res.status(400).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Handle database connection errors
        if (error.message?.includes('connect') || error.message?.includes('timeout')) {
            return res.status(503).json({ 
                success: false, 
                message: 'Database connection error. Please try again.' 
            });
        }

        // Handle other errors
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create project' 
        });
    }
}

// =============================================
// GET REQUESTS
// =============================================

// Get user's projects
// Route GET: /api/user/projects
// http://localhost:3000/api/user/projects
const getUserProjects = async (req, res) => {
    try {
        const { userId } = req.user; // From auth middleware

        console.log('Fetching projects for user:', userId);

        // Get user's projects from database
        const projects = await sql`
            SELECT 
                id, project_name, industry, team_size, primary_objective,
                timeline, budget_range, technical_level, need_cofounder,
                preferred_tech_stack, status, project_description, ai_prompt,
                created_at, updated_at
            FROM projects 
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
        `;

        console.log('Found projects:', projects.length);

        // Format projects for frontend
        const formattedProjects = projects.map(project => ({
            id: project.id,
            name: project.project_name,
            type: project.industry.charAt(0).toUpperCase() + project.industry.slice(1), // Capitalize first letter
            description: project.project_description || `${project.primary_objective} project with ${project.team_size} team size`,
            region: 'Local Development', // You can customize this based on your needs
            status: project.status,
            lastUpdated: getTimeAgo(project.updated_at),
            // Additional project details
            teamSize: project.team_size,
            objective: project.primary_objective,
            timeline: project.timeline,
            budgetRange: project.budget_range,
            technicalLevel: project.technical_level,
            needCofounder: project.need_cofounder,
            techStack: project.preferred_tech_stack,
            aiPrompt: project.ai_prompt,
            createdAt: project.created_at
        }));

        res.status(200).json({
            success: true,
            projects: formattedProjects
        });

    } catch (error) {
        console.error('Get user projects error:', error);

        // Handle database connection errors
        if (error.message?.includes('connect') || error.message?.includes('timeout')) {
            return res.status(503).json({ 
                success: false, 
                message: 'Database connection error. Please try again.' 
            });
        }

        // Handle other errors
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch projects' 
        });
    }
};

// Get single project by ID
// Route GET: /api/user/projects/:projectId
// http://localhost:3000/api/user/projects/:projectId
const getProjectById = async (req, res) => {
    try {
        const { userId } = req.user; // From auth middleware
        const { projectId } = req.params;

        console.log('Fetching project:', projectId, 'for user:', userId);

        // Input validation
        if (!projectId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Project ID is required' 
            });
        }

        // Get specific project from database with document info and user's subscription
        const projects = await sql`
            SELECT 
                p.id, p.project_name, p.industry, p.team_size, p.primary_objective,
                p.timeline, p.budget_range, p.technical_level, p.need_cofounder,
                p.preferred_tech_stack, p.status, p.project_description, p.ai_prompt,
                p.created_at, p.updated_at, p.base_documents, p.used_documents,
                b.selected_plan as subscription, b.document_credits, b.document_purchase_history
            FROM projects p
            LEFT JOIN billing b ON p.user_id = b.user_id
            WHERE p.id = ${projectId} AND p.user_id = ${userId}
        `;

        if (projects.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Project not found or you do not have access to this project'
            });
        }

        const project = projects[0];
        console.log('Found project:', project.project_name);

        // Format project for frontend
        const formattedProject = {
            id: project.id,
            name: project.project_name,
            type: project.industry.charAt(0).toUpperCase() + project.industry.slice(1),
            description: project.project_description || `${project.primary_objective} project with ${project.team_size} team size`,
            lastUpdated: getTimeAgo(project.updated_at),
            // Additional project details
            industry: project.industry,
            teamSize: project.team_size,
            objective: project.primary_objective,
            timeline: project.timeline,
            budgetRange: project.budget_range,
            technicalLevel: project.technical_level,
            needCofounder: project.need_cofounder,
            techStack: project.preferred_tech_stack,
            aiPrompt: project.ai_prompt,
            createdAt: project.created_at,
            updatedAt: project.updated_at,
            // Document tracking - NEW SCHEMA
            baseDocuments: project.base_documents,
            usedDocuments: project.used_documents,
            // Document credits are now account-wide in billing table
            documentCredits: project.document_credits || 0,
            documentPurchaseHistory: project.document_purchase_history || [],
            subscription: project.subscription || 'free'
        };

        res.status(200).json({
            success: true,
            project: formattedProject
        });

    } catch (error) {
        console.error('Get project by ID error:', error);

        // Handle database connection errors
        if (error.message?.includes('connect') || error.message?.includes('timeout')) {
            return res.status(503).json({ 
                success: false, 
                message: 'Database connection error. Please try again.' 
            });
        }

        // Handle other errors
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch project' 
        });
    }
};

// =============================================
// PUT REQUESTS
// =============================================

// Update project settings
// Route PUT: /api/user/projects/:projectId
// http://localhost:3000/api/user/projects/:projectId
const updateProject = async (req, res) => {
    try {
        const { userId } = req.user; // From auth middleware
        const { projectId } = req.params;
        const { project_name, project_description } = req.body;

        console.log('Updating project:', projectId, 'for user:', userId);

        // Input validation
        if (!projectId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Project ID is required' 
            });
        }

        if (!project_name || !project_description) {
            return res.status(400).json({ 
                success: false, 
                message: 'Project name and description are required' 
            });
        }

        // Validate project name length
        if (project_name.length < 2 || project_name.length > 100) {
            return res.status(400).json({ 
                success: false, 
                message: 'Project name must be between 2 and 100 characters' 
            });
        }

        // Validate project description length
        if (project_description.length > 500) {
            return res.status(400).json({ 
                success: false, 
                message: 'Project description must be less than 500 characters' 
            });
        }

        // Check if project exists and belongs to user
        const existingProject = await sql`
            SELECT id FROM projects 
            WHERE id = ${projectId} AND user_id = ${userId}
        `;

        if (existingProject.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Project not found or you do not have access to this project'
            });
        }

        // Update project in database
        const updatedProject = await sql`
            UPDATE projects 
            SET 
                project_name = ${project_name},
                project_description = ${project_description},
                updated_at = NOW()
            WHERE id = ${projectId} AND user_id = ${userId}
            RETURNING id, project_name, project_description, updated_at
        `;

        if (updatedProject.length === 0) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update project'
            });
        }

        console.log('Project updated successfully:', updatedProject[0].project_name);

        res.status(200).json({
            success: true,
            message: 'Project updated successfully',
            project: {
                id: updatedProject[0].id,
                name: updatedProject[0].project_name,
                description: updatedProject[0].project_description,
                updatedAt: updatedProject[0].updated_at
            }
        });

    } catch (error) {
        console.error('Update project error:', error);

        // Handle database connection errors
        if (error.message?.includes('connect') || error.message?.includes('timeout')) {
            return res.status(503).json({ 
                success: false, 
                message: 'Database connection error. Please try again.' 
            });
        }

        // Handle other errors
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update project' 
        });
    }
};

// Purchase Document Credits (Account-wide)
// Route POST: /api/projects/:projectId/purchase-documents
// http://localhost:3000/api/projects/:projectId/purchase-documents
const purchaseProjectDocuments = async (req, res) => {
    try {
        const { userId } = req.user; // From auth middleware
        const { projectId } = req.params;
        const { quantity = 5 } = req.body;
        
        console.log('Purchase document credits request:', { userId, projectId, quantity });

        // Input validation
        if (!projectId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Project ID is required' 
            });
        }

        if (!quantity || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid quantity is required'
            });
        }

        // Validate quantity (5 documents per pack)
        if (quantity !== 5) {
            return res.status(400).json({
                success: false,
                message: 'Document packs contain 5 documents each'
            });
        }

        // Check if project exists and get user's billing info
        const result = await sql`
            SELECT 
                p.id, p.project_name,
                b.id as billing_id, b.selected_plan, b.document_credits, b.total_document_purchases, b.document_purchase_history
            FROM projects p
            LEFT JOIN billing b ON p.user_id = b.user_id
            WHERE p.id = ${projectId} AND p.user_id = ${userId}
        `;

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Project not found or you do not have access to this project'
            });
        }

        const { project_name, billing_id, selected_plan, document_credits, total_document_purchases, document_purchase_history } = result[0];

        if (!billing_id) {
            return res.status(400).json({
                success: false,
                message: 'No billing record found. Please complete onboarding first.'
            });
        }

        // Check if user is on Enterprise plan (unlimited documents)
        if (selected_plan === 'enterprise') {
            return res.status(400).json({
                success: false,
                message: 'Enterprise plan includes unlimited documents'
            });
        }

        // Calculate new values
        const currentCredits = document_credits || 0;
        const newCredits = currentCredits + quantity;
        const newTotalPurchases = (total_document_purchases || 0) + 1;

        // Create purchase record
        const purchaseRecord = {
            id: `doc_${Date.now()}`,
            quantity: quantity,
            price: 8.00,
            purchase_date: new Date().toISOString(),
            package_type: 'document_pack',
            project_id: projectId,
            project_name: project_name
        };

        // Parse existing purchase history and add new record
        const currentHistory = document_purchase_history || [];
        const updatedHistory = [...currentHistory, purchaseRecord];

        // Update billing record with new document credits
        const updateResult = await sql`
            UPDATE billing 
            SET 
                document_credits = ${newCredits},
                total_document_purchases = ${newTotalPurchases},
                document_purchase_history = ${JSON.stringify(updatedHistory)}::jsonb,
                last_document_purchase = NOW(),
                updated_at = NOW()
            WHERE user_id = ${userId}
            RETURNING id, document_credits, total_document_purchases, updated_at
        `;

        if (updateResult.length === 0) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update billing record'
            });
        }

        const updatedBilling = updateResult[0];

        // Return success response
        res.status(200).json({
            success: true,
            message: `Successfully purchased ${quantity} document credits for your account!`,
            purchase: {
                quantity: quantity,
                price: 8.00,
                new_document_credits: updatedBilling.document_credits,
                total_purchases: updatedBilling.total_document_purchases,
                purchase_id: purchaseRecord.id,
                project_name: project_name
            }
        });

    } catch (error) {
        console.error('Purchase document credits error:', error);

        // Handle specific database errors
        if (error.code === '23514') { 
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid purchase data format' 
            });
        }

        // Handle database connection errors
        if (error.message?.includes('connect') || error.message?.includes('timeout')) {
            return res.status(503).json({ 
                success: false, 
                message: 'Database connection error. Please try again.' 
            });
        }

        // Handle other errors
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

// =============================================
// DELETE REQUESTS
// =============================================

// Delete project
// Route DELETE: /api/user/projects/:projectId
// http://localhost:3000/api/user/projects/:projectId
const deleteProject = async (req, res) => {
    try {
        const { userId } = req.user; // From auth middleware
        const { projectId } = req.params;

        console.log('Deleting project:', projectId, 'for user:', userId);

        // Input validation
        if (!projectId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Project ID is required' 
            });
        }

        // Check if project exists and belongs to user
        const existingProject = await sql`
            SELECT id, project_name FROM projects 
            WHERE id = ${projectId} AND user_id = ${userId}
        `;

        if (existingProject.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Project not found or you do not have access to this project'
            });
        }

        const projectName = existingProject[0].project_name;

        // Delete project from database
        const deletedProject = await sql`
            DELETE FROM projects 
            WHERE id = ${projectId} AND user_id = ${userId}
            RETURNING id
        `;

        if (deletedProject.length === 0) {
            return res.status(500).json({
                success: false,
                message: 'Failed to delete project'
            });
        }

        console.log('Project deleted successfully:', projectName);

        res.status(200).json({
            success: true,
            message: `Project "${projectName}" deleted successfully`
        });

    } catch (error) {
        console.error('Delete project error:', error);

        // Handle database connection errors
        if (error.message?.includes('connect') || error.message?.includes('timeout')) {
            return res.status(503).json({ 
                success: false, 
                message: 'Database connection error. Please try again.' 
            });
        }

        // Handle foreign key constraint errors (if we have related data in future)
        if (error.message?.includes('foreign key constraint')) {
            return res.status(409).json({ 
                success: false, 
                message: 'Cannot delete project due to related data. Please contact support.' 
            });
        }

        // Handle other errors
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete project' 
        });
    }
};

// =============================================
// HELPER FUNCTIONS
// =============================================

// Helper function to calculate time ago
const getTimeAgo = (date) => {
    const now = new Date();
    const projectDate = new Date(date);
    const diffInMs = now - projectDate;
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) {
        return 'Just now';
    } else if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInDays < 7) {
        return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else {
        return projectDate.toLocaleDateString();
    }
};

// =============================================
// EXPORT FUNCTIONS
// =============================================
export { createProject, getUserProjects, getProjectById, updateProject, deleteProject, purchaseProjectDocuments, getTimeAgo };