import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from '../configs/db.js';

// Register a new user
// Route POST: /api/users/register
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

// Complete onboarding
// Route POST: /api/user/complete-onboarding
// const completeOnboarding = async (req, res) => {
//     try {
        
//     } catch (error) {
        
//     }
// };

// =============================================
// GET ALL USERS - For testing/admin purposes
// =============================================
// const getUsers = async (req, res) => {
//     try {
//         const users = await sql`SELECT id, first_name, last_name, email, created_at FROM users`;
//         res.status(200).json({ success: true, users });
//     } catch (error) {
//         console.error('Get users error:', error);
//         res.status(500).json({ 
//         success: false, 
//         message: 'Failed to fetch users' 
//         });
//     }
// };

// =============================================
// GET SINGLE USER BY ID - For testing/admin purposes
// =============================================
// const getUserById = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const user = await sql`SELECT id, first_name, last_name, email, created_at FROM users WHERE id = ${id}`;
//         res.status(200).json({ success: true, user });
//     } catch (error) {
//         console.error('Get user by id error:', error);
//         res.status(500).json({ 
//             success: false, 
//             message: 'Failed to fetch user' 
//         });
//     }
// };

export { registerUser, loginUser };
// export { registerUser, loginUser, getUsers, getUserById };
