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
            project_description 
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

        // Check if user exists
        const existingUser = await sql`
            SELECT id FROM users WHERE id = ${userId}
        `;

        if (existingUser.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Create the project
        const result = await sql`
            INSERT INTO projects (
                user_id, project_name, industry, team_size, primary_objective,
                timeline, budget_range, technical_level, need_cofounder,
                preferred_tech_stack, project_description, status, onboarding_completed
            ) VALUES (
                ${userId}, ${project_name.trim()}, ${industry}, ${team_size}, ${primary_objective},
                ${timeline}, ${budget_range}, ${technical_level}, ${need_cofounder || false},
                ${preferred_tech_stack}, ${project_description ? project_description.trim() : null}, 
                'active', true
            )
            RETURNING id, project_name, industry, team_size, primary_objective, timeline, 
                     budget_range, technical_level, need_cofounder, preferred_tech_stack, 
                     project_description, status, created_at
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
                preferred_tech_stack, status, project_description,
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

        // Get specific project from database
        const projects = await sql`
            SELECT 
                id, project_name, industry, team_size, primary_objective,
                timeline, budget_range, technical_level, need_cofounder,
                preferred_tech_stack, status, project_description,
                created_at, updated_at
            FROM projects 
            WHERE id = ${projectId} AND user_id = ${userId}
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
            region: 'Local Development', // You can customize this based on your needs
            status: project.status,
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
            createdAt: project.created_at,
            updatedAt: project.updated_at,
            // Mock data for UI display (will be replaced with real data later)
            progress: 65, // This could be calculated based on project milestones
            fundingAmount: '$0' // This could come from a funding table later
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
export { createProject, getUserProjects, getProjectById, updateProject, deleteProject, getTimeAgo };