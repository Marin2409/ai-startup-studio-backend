import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from '../configs/db.js';

// =============================================
// POST REQUESTS
// =============================================

// Register a new user
// Route POST: /api/users/register
// http://localhost:3000/api/users/register
const registerUser = async (req, res) => {
    try {
        const { first_name, last_name, email, company, password_hash } = req.body;

        // Input validation
        if (!first_name || !last_name || !email || !password_hash) {
            return res.status(400).json({ 
                success: false, 
                message: 'First name, last name, email, and password are required' 
            });
        }

        // Email format validation
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide a valid email address' 
            });
        }

        // Password validation
        if (password_hash.length < 8) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password must be at least 8 characters long' 
            });
        }

        // Validate JWT_SECRET exists
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET environment variable is required');
            return res.status(500).json({ 
                success: false, 
                message: 'Server configuration error' 
            });
        }

        // Check if email already exists
        const existingUser = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
        if (existingUser.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email already registered' 
            });
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password_hash, saltRounds);

        // Clean input data
        const cleanFirstName = first_name.trim();
        const cleanLastName = last_name.trim();
        const cleanEmail = email.toLowerCase().trim();

        // Insert new user using Neon template literal syntax
        const result = await sql`
            INSERT INTO users (first_name, last_name, email, company, password_hash)
            VALUES (${cleanFirstName}, ${cleanLastName}, ${cleanEmail}, ${company}, ${hashedPassword})
            RETURNING id, first_name, last_name, email, company, created_at
        `;
        
        const newUser = result[0];

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: newUser.id,
                email: newUser.email 
            }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' } 
        );

        // Return success response
        res.status(201).json({ 
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                id: newUser.id,
                first_name: newUser.first_name,
                last_name: newUser.last_name,
                email: newUser.email,
                company: newUser.company,
                created_at: newUser.created_at
            }
        });
        
    } catch (error) {
        console.error('Register error:', error);

        // Handle specific database errors
        if (error.message?.includes('duplicate key') || error.code === '23505') { 
            return res.status(400).json({ 
                success: false, 
                message: 'Email already registered' 
            });
        }
        
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

// Login a user
// Route POST: /api/users/login
// http://localhost:3000/api/users/login
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Input validation
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email and password are required' 
            });
        }

        // Validate JWT_SECRET exists
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET environment variable is required');
            return res.status(500).json({ 
                success: false, 
                message: 'Server configuration error' 
            });
        }

        // Find user by email
        const users = await sql`
            SELECT id, first_name, last_name, email, password_hash, created_at 
            FROM users 
            WHERE email = ${email.toLowerCase()}
        `;

        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        const user = users[0];

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id,
                email: user.email 
            }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' } 
        );

        // Return success response
        res.status(200).json({ 
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                created_at: user.created_at
            }
        });
        
        
    } catch (error) {
        console.error('Login error:', error);

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

// Update user profile
// Route PUT: /api/user/profile
// http://localhost:3000/api/user/profile
const updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.userId; // From JWT token in auth middleware
        const { first_name, last_name, email, phone, company, address, city, state } = req.body;

        // Input validation
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not authenticated' 
            });
        }

        // Validate email format if provided
        if (email) {
            const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Please provide a valid email address' 
                });
            }
        }

        // Validate phone format if provided
        if (phone && phone.trim() !== '') {
            const phoneRegex = /^\+?[\d\s\-\(\)\.]+$/;
            if (!phoneRegex.test(phone)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Please provide a valid phone number' 
                });
            }
        }

        // Validate names if provided
        if (first_name && first_name.trim().length < 1) {
            return res.status(400).json({ 
                success: false, 
                message: 'First name cannot be empty' 
            });
        }

        if (last_name && last_name.trim().length < 1) {
            return res.status(400).json({ 
                success: false, 
                message: 'Last name cannot be empty' 
            });
        }

        // Validate optional fields lengths
        if (company !== undefined && company !== null && company.trim().length > 150) {
            return res.status(400).json({
                success: false,
                message: 'Company must be at most 150 characters'
            })
        }
        if (address !== undefined && address !== null && address.trim().length > 200) {
            return res.status(400).json({
                success: false,
                message: 'Address must be at most 200 characters'
            })
        }
        if (city !== undefined && city !== null && city.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: 'City must be at most 100 characters'
            })
        }
        if (state !== undefined && state !== null && state.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: 'State must be at most 100 characters'
            })
        }

        // Check if email already exists (if updating email)
        if (email) {
            const existingUser = await sql`
                SELECT id FROM users 
                WHERE email = ${email.toLowerCase()} AND id != ${userId}
            `;
            if (existingUser.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Email already in use by another account' 
                });
            }
        }

        // If no fields provided
        if (
            first_name === undefined &&
            last_name === undefined &&
            email === undefined &&
            phone === undefined &&
            company === undefined &&
            address === undefined &&
            city === undefined &&
            state === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: 'No fields provided to update'
            });
        }

        // Prepare values (allow explicit null for phone when clearing)
        const newFirstName = first_name !== undefined ? first_name.trim() : null;
        const newLastName = last_name !== undefined ? last_name.trim() : null;
        const newEmail = email !== undefined ? email.toLowerCase().trim() : null;
        const newPhone = phone !== undefined ? (phone.trim() || null) : null;
        const newCompany = company !== undefined ? (company?.trim() || null) : null;
        const newAddress = address !== undefined ? (address?.trim() || null) : null;
        const newCity = city !== undefined ? (city?.trim() || null) : null;
        const newState = state !== undefined ? (state?.trim() || null) : null;

        // Update user in database using CASE to conditionally set each field
        const result = await sql`
            UPDATE users
            SET 
                first_name = CASE WHEN ${first_name !== undefined} THEN ${newFirstName} ELSE first_name END,
                last_name  = CASE WHEN ${last_name !== undefined}  THEN ${newLastName}  ELSE last_name  END,
                email      = CASE WHEN ${email !== undefined}      THEN ${newEmail}     ELSE email      END,
                phone      = CASE WHEN ${phone !== undefined}      THEN ${newPhone}     ELSE phone      END,
                company    = CASE WHEN ${company !== undefined}    THEN ${newCompany}   ELSE company    END,
                address    = CASE WHEN ${address !== undefined}    THEN ${newAddress}   ELSE address    END,
                city       = CASE WHEN ${city !== undefined}       THEN ${newCity}      ELSE city       END,
                state      = CASE WHEN ${state !== undefined}      THEN ${newState}     ELSE state      END,
                updated_at = NOW()
            WHERE id = ${userId}
            RETURNING id, first_name, last_name, email, phone, company, address, city, state, created_at, updated_at
        `;

        if (result.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        const updatedUser = result[0];

        // Return success response
        res.status(200).json({ 
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                first_name: updatedUser.first_name,
                last_name: updatedUser.last_name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                company: updatedUser.company,
                address: updatedUser.address,
                city: updatedUser.city,
                state: updatedUser.state,
                created_at: updatedUser.created_at,
                updated_at: updatedUser.updated_at
            }
        });
        
    } catch (error) {
        console.error('Update profile error:', error);

        // Handle specific database errors
        if (error.message?.includes('duplicate key') || error.code === '23505') { 
            return res.status(400).json({ 
                success: false, 
                message: 'Email already in use by another account' 
            });
        }
        
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

// =============================================
// DELETE REQUESTS
// =============================================

// Delete current user and all related data
// Route DELETE: /api/user/profile
// http://localhost:3000/api/user/profile
const deleteCurrentUser = async (req, res) => {
    const { userId } = req.user || {}
    if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' })
    }

    try {
        // Use an explicit transaction to ensure all-or-nothing deletion
        await sql`BEGIN`;

        // Ensure user exists
        const found = await sql`SELECT id FROM users WHERE id = ${userId}`;
        if (found.length === 0) {
            await sql`ROLLBACK`;
            return res.status(404).json({ success: false, message: 'User not found' })
        }

        // Delete related data (explicitly, in case FK cascades are not configured)
        await sql`DELETE FROM billing WHERE user_id = ${userId}`;
        await sql`DELETE FROM projects WHERE user_id = ${userId}`;

        // Finally delete the user
        const deleted = await sql`DELETE FROM users WHERE id = ${userId} RETURNING id`;
        if (deleted.length === 0) {
            await sql`ROLLBACK`;
            return res.status(500).json({ success: false, message: 'Failed to delete user' })
        }

        await sql`COMMIT`;

        return res.status(200).json({
            success: true,
            message: 'Account and related data deleted successfully'
        })
    } catch (error) {
        console.error('Delete user error:', error);
        try { await sql`ROLLBACK`; } catch (e) {}

        // Handle database connection errors
        if (error.message?.includes('connect') || error.message?.includes('timeout')) {
            return res.status(503).json({ 
                success: false, 
                message: 'Database connection error. Please try again.' 
            });
        }

        return res.status(500).json({ success: false, message: 'Internal server error' })
    }
}

// =============================================
// EXPORT FUNCTIONS
// =============================================
export { registerUser, loginUser, updateUserProfile, deleteCurrentUser };
