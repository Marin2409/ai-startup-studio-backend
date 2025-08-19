import sql from '../configs/db.js';

// =============================================
// POST REQUESTS
// =============================================

// Pricing Onboarding
// Route POST: /api/user/pricing-onboarding
// http://localhost:3000/api/user/pricing-onboarding
const pricingOnboarding = async (req, res) => {
    try {
        const { userId } = req.user; // From auth middleware
        const { selectedPlan, billingCycle, addOns } = req.body;
        
        console.log('Pricing onboarding request:', { userId, selectedPlan, billingCycle, addOns });

        // Input validation
        if (!selectedPlan || !billingCycle) {
            return res.status(400).json({
                success: false,
                message: 'Plan and billing cycle are required'
            });
        }

        // Validate plan and billing cycle
        const validPlans = ['free', 'builder', 'enterprise'];
        const validCycles = ['monthly', 'annual'];

        if (!validPlans.includes(selectedPlan)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid plan selected'
            });
        }

        if (!validCycles.includes(billingCycle)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid billing cycle selected'
            });
        }

        // Plan pricing logic
        const planPrices = {
            'free': 0,
            'builder': 5,
            'enterprise': 15
        };

        const basePrice = planPrices[selectedPlan];
        const finalPrice = billingCycle === 'annual' ? Math.round(basePrice * 0.8) : basePrice;

        // Calculate subscription dates
        const startDate = new Date();
        let endDate = null;
        let nextBillingDate = null;
        
        if (selectedPlan !== 'free') {
            endDate = new Date();
            nextBillingDate = new Date();
            
            if (billingCycle === 'monthly') {
                endDate.setMonth(endDate.getMonth() + 1);
                nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
            } else if (billingCycle === 'annual') {
                endDate.setFullYear(endDate.getFullYear() + 1);
                nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
            }
        }

        // Check if user exists
        console.log('Checking if user exists:', userId);
        const existingUser = await sql`
            SELECT id, first_name, last_name, email FROM users WHERE id = ${userId}
        `;

        if (existingUser.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = existingUser[0];

        // Check if user already has a billing record
        const existingBilling = await sql`
            SELECT id FROM billing WHERE user_id = ${userId}
        `;

        let billingResult;

        if (existingBilling.length > 0) {
            // Update existing billing record
            billingResult = await sql`
                UPDATE billing 
                SET 
                    selected_plan = ${selectedPlan},
                    billing_cycle = ${billingCycle},
                    plan_price = ${finalPrice},
                    add_ons = ${JSON.stringify(addOns || [])}::jsonb,
                    subscription_start_date = ${startDate},
                    subscription_end_date = ${endDate},
                    next_billing_date = ${nextBillingDate},
                    status = 'active',
                    payment_status = ${selectedPlan === 'free' ? 'active' : 'pending'},
                    updated_at = NOW()
                WHERE user_id = ${userId}
                RETURNING id, selected_plan, billing_cycle, plan_price, add_ons, status, payment_status
            `;
        } else {
            // Create new billing record
            billingResult = await sql`
                INSERT INTO billing (
                    user_id, selected_plan, billing_cycle, plan_price, add_ons,
                    subscription_start_date, subscription_end_date, next_billing_date,
                    status, payment_status
                ) VALUES (
                    ${userId}, ${selectedPlan}, ${billingCycle}, ${finalPrice}, 
                    ${JSON.stringify(addOns || [])}::jsonb, ${startDate}, 
                    ${endDate}, 
                    ${nextBillingDate}, 'active', 
                    ${selectedPlan === 'free' ? 'active' : 'pending'}
                )
                RETURNING id, selected_plan, billing_cycle, plan_price, add_ons, status, payment_status
            `;
        }

        const billing = billingResult[0];
        console.log('Billing operation completed:', billing);

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Pricing onboarding completed successfully',
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email
            },
            billing: {
                id: billing.id,
                selected_plan: billing.selected_plan,
                billing_cycle: billing.billing_cycle,
                plan_price: parseFloat(billing.plan_price),
                add_ons: billing.add_ons,
                status: billing.status,
                payment_status: billing.payment_status
            }
        });

    } catch (error) {
        console.error('Pricing onboarding error:', error);

        // Handle specific database errors
        if (error.message?.includes('duplicate key') || error.code === '23505') { 
            return res.status(400).json({ 
                success: false, 
                message: 'Billing record already exists for this user' 
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
            message: 'Internal server error' 
        });
    }
};

// =============================================
// GET REQUESTS
// =============================================

// Get user with billing information 
// Route GET: /api/user/profile
// http://localhost:3000/api/user/profile
const getUserWithBilling = async (req, res) => {
    try {
        const { userId } = req.user; // From auth middleware

        // Get user with billing information - ADDED phone, address, city, state to SELECT
        const userResult = await sql`
            SELECT 
                u.id, u.first_name, u.last_name, u.email, u.phone, u.company, u.address, u.city, u.state, u.created_at,
                b.id as billing_id, b.selected_plan, b.billing_cycle, b.plan_price, 
                b.add_ons, b.status as billing_status, b.payment_status,
                b.subscription_start_date, b.subscription_end_date, b.next_billing_date,
                b.image_credits, b.total_image_purchases, b.image_purchase_history,
                b.document_credits, b.total_document_purchases, b.document_purchase_history
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

        // Structure the response - ADDED phone, address, city, state to response
        const response = {
            success: true,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone: user.phone,
                company: user.company,
                address: user.address,
                city: user.city,
                state: user.state,
                created_at: user.created_at,
                billing: user.billing_id ? {
                    id: user.billing_id,
                    selected_plan: user.selected_plan,
                    billing_cycle: user.billing_cycle,
                    plan_price: parseFloat(user.plan_price || 0),
                    add_ons: user.add_ons,
                    status: user.billing_status,
                    payment_status: user.payment_status,
                    subscription_start_date: user.subscription_start_date,
                    subscription_end_date: user.subscription_end_date,
                    next_billing_date: user.next_billing_date,
                    image_credits: user.image_credits || 0,
                    total_image_purchases: user.total_image_purchases || 0,
                    image_purchase_history: user.image_purchase_history || [],
                    document_credits: user.document_credits || 0,
                    total_document_purchases: user.total_document_purchases || 0,
                    document_purchase_history: user.document_purchase_history || []
                } : null
            }
        };

        res.status(200).json(response);

    } catch (error) {
        console.error('Get user with billing error:', error);

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
// PUT REQUESTS
// =============================================

// Update User Plan
// Route PUT: /api/user/plan
// http://localhost:3000/api/user/plan
const updateUserPlan = async (req, res) => {
    try {
        const { userId } = req.user; // From auth middleware
        const { selectedPlan, billingCycle } = req.body;
        
        console.log('Update plan request:', { userId, selectedPlan, billingCycle });

        // Input validation
        if (!selectedPlan || !billingCycle) {
            return res.status(400).json({
                success: false,
                message: 'Plan and billing cycle are required'
            });
        }

        // Validate plan and billing cycle
        const validPlans = ['free', 'builder', 'enterprise'];
        const validCycles = ['monthly', 'annual'];

        // Validate plan
        if (!validPlans.includes(selectedPlan)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid plan selected'
            });
        }

        // Validate billing cycle
        if (!validCycles.includes(billingCycle)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid billing cycle selected'
            });
        }

        // Plan pricing logic
        const planPrices = {
            'free': 0,
            'builder': 5,
            'enterprise': 15
        };

        const basePrice = planPrices[selectedPlan];
        const finalPrice = billingCycle === 'annual' ? Math.round(basePrice * 0.8) : basePrice;

        // Calculate subscription dates
        const startDate = new Date();
        let endDate = null;
        let nextBillingDate = null;
        
        if (selectedPlan !== 'free') {
            endDate = new Date();
            nextBillingDate = new Date();
            
            if (billingCycle === 'monthly') {
                endDate.setMonth(endDate.getMonth() + 1);
                nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
            } else if (billingCycle === 'annual') {
                endDate.setFullYear(endDate.getFullYear() + 1);
                nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
            }
        }

        // Check if user exists and get current billing info
        const userResult = await sql`
            SELECT 
                u.id, u.first_name, u.last_name, u.email,
                b.id as billing_id, b.selected_plan, b.add_ons
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
        
        if (!user.billing_id) {
            return res.status(400).json({
                success: false,
                message: 'No billing record found. Please complete onboarding first.'
            });
        }

        // Handle add-ons based on plan upgrade/downgrade
        let currentAddOns = user.add_ons || [];
        
        // If upgrading to Builder from Free, include coder_package in add-ons
        if (selectedPlan === 'builder' && user.selected_plan === 'free') {
            // Builder includes tech stack documents (coder package functionality)
            // Remove coder_package from add-ons if it exists since it's now included
            currentAddOns = currentAddOns.filter(addon => addon !== 'coder_package');
        }
        
        // If upgrading to Enterprise, clear all add-ons since everything is included
        if (selectedPlan === 'enterprise') {
            currentAddOns = [];
        }
        
        // If downgrading from Builder to Free, user keeps their purchased add-ons
        // If downgrading from Enterprise, they lose everything and need to repurchase

        // Update billing record
        const updateResult = await sql`
            UPDATE billing 
            SET 
                selected_plan = ${selectedPlan},
                billing_cycle = ${billingCycle},
                plan_price = ${finalPrice},
                add_ons = ${JSON.stringify(currentAddOns)}::jsonb,
                subscription_start_date = ${startDate},
                subscription_end_date = ${endDate},
                next_billing_date = ${nextBillingDate},
                status = 'active',
                payment_status = ${selectedPlan === 'free' ? 'active' : 'pending'},
                updated_at = NOW()
            WHERE user_id = ${userId}
            RETURNING id, selected_plan, billing_cycle, plan_price, add_ons, status, payment_status, updated_at
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
            message: `Plan updated to ${selectedPlan} successfully`,
            billing: {
                id: updatedBilling.id,
                selected_plan: updatedBilling.selected_plan,
                billing_cycle: updatedBilling.billing_cycle,
                plan_price: parseFloat(updatedBilling.plan_price),
                add_ons: updatedBilling.add_ons,
                status: updatedBilling.status,
                payment_status: updatedBilling.payment_status,
                updated_at: updatedBilling.updated_at
            }
        });

    } catch (error) {
        console.error('Update plan error:', error);

        // Handle specific database errors
        if (error.code === '23514') { 
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid input data format' 
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

// Cancel Subscription (Downgrade to Free)
// Route PUT: /api/user/cancel-subscription
// http://localhost:3000/api/user/cancel-subscription
const cancelSubscription = async (req, res) => {
    try {
        const { userId } = req.user; // From auth middleware
        
        console.log('Cancel subscription request:', { userId });

        // Check if user exists and get current billing info
        const userResult = await sql`
            SELECT 
                u.id, u.first_name, u.last_name, u.email,
                b.id as billing_id, b.selected_plan, b.add_ons
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
        
        if (!user.billing_id) {
            return res.status(400).json({
                success: false,
                message: 'No billing record found. Please complete onboarding first.'
            });
        }

        // Check if user is already on free plan
        if (user.selected_plan === 'free') {
            return res.status(400).json({
                success: false,
                message: 'You are already on the free plan'
            });
        }

        // Handle add-ons based on current plan downgrade
        let updatedAddOns = user.add_ons || [];
        
        // If downgrading from Builder to Free, user keeps their purchased add-ons
        if (user.selected_plan === 'builder') {
            // Keep all existing add-ons
            // Builder users may have purchased database_package which they keep
        }
        
        // If downgrading from Enterprise, they lose everything and need to repurchase
        if (user.selected_plan === 'enterprise') {
            updatedAddOns = [];
        }

        // Update billing record to free plan
        const updateResult = await sql`
            UPDATE billing 
            SET 
                selected_plan = 'free',
                billing_cycle = 'monthly',
                plan_price = 0,
                add_ons = ${JSON.stringify(updatedAddOns)}::jsonb,
                subscription_start_date = NOW(),
                subscription_end_date = NULL,
                next_billing_date = NULL,
                status = 'active',
                payment_status = 'active',
                updated_at = NOW()
            WHERE user_id = ${userId}
            RETURNING id, selected_plan, billing_cycle, plan_price, add_ons, status, payment_status, updated_at
        `;

        if (updateResult.length === 0) {
            return res.status(500).json({
                success: false,
                message: 'Failed to cancel subscription'
            });
        }

        const updatedBilling = updateResult[0];

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Subscription canceled successfully. You have been downgraded to the free plan.',
            billing: {
                id: updatedBilling.id,
                selected_plan: updatedBilling.selected_plan,
                billing_cycle: updatedBilling.billing_cycle,
                plan_price: parseFloat(updatedBilling.plan_price),
                add_ons: updatedBilling.add_ons,
                status: updatedBilling.status,
                payment_status: updatedBilling.payment_status,
                updated_at: updatedBilling.updated_at
            }
        });

    } catch (error) {
        console.error('Cancel subscription error:', error);

        // Handle specific database errors
        if (error.code === '23514') { 
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid data format' 
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

// Purchase Add-on Package
// Route POST: /api/user/purchase-addon
// http://localhost:3000/api/user/purchase-addon
const purchaseAddonPackage = async (req, res) => {
    try {
        const { userId } = req.user; // From auth middleware
        const { packageType } = req.body;
        
        console.log('Purchase addon request:', { userId, packageType });

        // Input validation
        if (!packageType) {
            return res.status(400).json({
                success: false,
                message: 'Package type is required'
            });
        }

        // Validate package type
        const validPackages = ['coder_package', 'database_package'];
        if (!validPackages.includes(packageType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid package type'
            });
        }

        // Check if user exists and get current billing info
        const userResult = await sql`
            SELECT 
                u.id, u.first_name, u.last_name, u.email,
                b.id as billing_id, b.selected_plan, b.add_ons
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
        
        if (!user.billing_id) {
            return res.status(400).json({
                success: false,
                message: 'No billing record found. Please complete onboarding first.'
            });
        }

        // Parse current add-on packages (now guaranteed to be valid JSONB array)
        const currentAddOns = user.add_ons || [];

        // Check if package is already purchased
        if (currentAddOns.includes(packageType)) {
            return res.status(400).json({
                success: false,
                message: 'Package already purchased'
            });
        }

        // Check plan restrictions
        if (user.selected_plan === 'enterprise') {
            return res.status(400).json({
                success: false,
                message: 'Enterprise plan already includes all packages'
            });
        }

        if (user.selected_plan === 'builder' && packageType === 'coder_package') {
            return res.status(400).json({
                success: false,
                message: 'Builder plan already includes tech stack documents'
            });
        }

        // Add the new package
        currentAddOns.push(packageType);

        // Update billing record (use JSONB array directly)
        const updateResult = await sql`
            UPDATE billing 
            SET 
                add_ons = ${JSON.stringify(currentAddOns)}::jsonb,
                updated_at = NOW()
            WHERE user_id = ${userId}
            RETURNING id, selected_plan, add_ons, updated_at
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
            message: `${packageType === 'coder_package' ? 'Coder Package' : 'Database Package'} purchased successfully`,
            billing: {
                id: updatedBilling.id,
                selected_plan: updatedBilling.selected_plan,
                add_ons: updatedBilling.add_ons,
                updated_at: updatedBilling.updated_at
            }
        });

    } catch (error) {
        console.error('Purchase addon package error:', error);

        // Handle specific database errors
        if (error.code === '23514') { 
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid package data format' 
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

// Purchase Image Pack (Account-wide)
// Route POST: /api/user/purchase-images
// http://localhost:3000/api/user/purchase-images
const purchaseImagePack = async (req, res) => {
    try {
        const { userId } = req.user; // From auth middleware
        const { quantity = 10 } = req.body;
        
        console.log('Purchase image pack request:', { userId, quantity });

        // Input validation
        if (!quantity || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid quantity is required'
            });
        }

        // Validate quantity (10 images per pack)
        if (quantity !== 10) {
            return res.status(400).json({
                success: false,
                message: 'Image packs contain 10 images each'
            });
        }

        // Check if user exists and get current billing info
        const userResult = await sql`
            SELECT 
                u.id, u.first_name, u.last_name, u.email,
                b.id as billing_id, b.selected_plan, b.image_credits, b.total_image_purchases, b.image_purchase_history
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
        
        if (!user.billing_id) {
            return res.status(400).json({
                success: false,
                message: 'No billing record found. Please complete onboarding first.'
            });
        }

        // Calculate new values
        const currentCredits = user.image_credits || 0;
        const newCredits = currentCredits + quantity;
        const newTotalPurchases = (user.total_image_purchases || 0) + 1;

        // Create purchase record
        const purchaseRecord = {
            id: `img_${Date.now()}`,
            quantity: quantity,
            price: 5.00,
            purchase_date: new Date().toISOString(),
            package_type: 'image_pack'
        };

        // Parse existing purchase history and add new record
        const currentHistory = user.image_purchase_history || [];
        const updatedHistory = [...currentHistory, purchaseRecord];

        // Update billing record
        const updateResult = await sql`
            UPDATE billing 
            SET 
                image_credits = ${newCredits},
                total_image_purchases = ${newTotalPurchases},
                image_purchase_history = ${JSON.stringify(updatedHistory)}::jsonb,
                last_image_purchase = NOW(),
                updated_at = NOW()
            WHERE user_id = ${userId}
            RETURNING id, image_credits, total_image_purchases, updated_at
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
            message: `Successfully purchased ${quantity} image credits`,
            purchase: {
                quantity: quantity,
                price: 5.00,
                new_credits: updatedBilling.image_credits,
                total_purchases: updatedBilling.total_image_purchases,
                purchase_id: purchaseRecord.id
            }
        });

    } catch (error) {
        console.error('Purchase image pack error:', error);

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

// Purchase Document Credits (Account-wide)
// Route POST: /api/user/purchase-documents
// http://localhost:3000/api/user/purchase-documents
const purchaseDocumentPack = async (req, res) => {
    try {
        const { userId } = req.user; // From auth middleware
        const { quantity = 5 } = req.body;
        
        console.log('Purchase document pack request:', { userId, quantity });

        // Input validation
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

        // Check if user exists and get current billing info
        const userResult = await sql`
            SELECT 
                u.id, u.first_name, u.last_name, u.email,
                b.id as billing_id, b.selected_plan, b.document_credits, b.total_document_purchases, b.document_purchase_history
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
        
        if (!user.billing_id) {
            return res.status(400).json({
                success: false,
                message: 'No billing record found. Please complete onboarding first.'
            });
        }

        // Check if user is on Enterprise plan (unlimited documents)
        if (user.selected_plan === 'enterprise') {
            return res.status(400).json({
                success: false,
                message: 'Enterprise plan includes unlimited documents'
            });
        }

        // Calculate new values
        const currentCredits = user.document_credits || 0;
        const newCredits = currentCredits + quantity;
        const newTotalPurchases = (user.total_document_purchases || 0) + 1;

        // Create purchase record
        const purchaseRecord = {
            id: `doc_${Date.now()}`,
            quantity: quantity,
            price: 8.00,
            purchase_date: new Date().toISOString(),
            package_type: 'document_pack'
        };

        // Parse existing purchase history and add new record
        const currentHistory = user.document_purchase_history || [];
        const updatedHistory = [...currentHistory, purchaseRecord];

        // Update billing record
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
            message: `Successfully purchased ${quantity} document credits`,
            purchase: {
                quantity: quantity,
                price: 8.00,
                new_credits: updatedBilling.document_credits,
                total_purchases: updatedBilling.total_document_purchases,
                purchase_id: purchaseRecord.id
            }
        });

    } catch (error) {
        console.error('Purchase document pack error:', error);

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


// =============================================
// EXPORT FUNCTIONS
// =============================================
export { pricingOnboarding, getUserWithBilling, updateUserPlan, cancelSubscription, purchaseAddonPackage, purchaseImagePack, purchaseDocumentPack };