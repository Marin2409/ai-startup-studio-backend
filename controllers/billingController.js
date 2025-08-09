import jwt from 'jsonwebtoken';
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
        const validPlans = ['free', 'pro', 'enterprise'];
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
            'pro': 29,
            'enterprise': 99
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
                    add_ons = ${JSON.stringify(addOns || [])},
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
                    ${JSON.stringify(addOns || [])}, ${startDate}, 
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

        // Get user with billing information - ADDED phone to SELECT
        const userResult = await sql`
            SELECT 
                u.id, u.first_name, u.last_name, u.email, u.phone, u.company, u.created_at,
                b.id as billing_id, b.selected_plan, b.billing_cycle, b.plan_price, 
                b.add_ons, b.status as billing_status, b.payment_status,
                b.subscription_start_date, b.subscription_end_date, b.next_billing_date,
                b.discount_code, b.discount_percentage
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

        // Structure the response - ADDED phone to response
        const response = {
            success: true,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone: user.phone, // ← This will be null for existing users, which is fine
                company: user.company,
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
                    discount_code: user.discount_code,
                    discount_percentage: parseFloat(user.discount_percentage || 0)
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


// =============================================
// DELETE REQUESTS
// =============================================


// =============================================
// EXPORT FUNCTIONS
// =============================================
export { pricingOnboarding, getUserWithBilling };