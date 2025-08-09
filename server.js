/**
 *------------------------------------------------------------------
 * server.js is the MAIN FILE that:
 * 1. Loads environment variables from .env
 * 2. Sets up Express app and middleware
 * 3. Connects to database using configs/db.js
 * 4. Starts the server on specified port
 * 5. Imports and uses route files
 * 6. Imports and uses JSON Web Token (JWT) files 
 *------------------------------------------------------------------
 */

// Importing required modules
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import sql from './configs/db.js';
import userRoutes from './routes/userRoutes.js';
import protectedRoutes from './routes/protectedRoutes.js';


// Constants
const app = express(); 
const PORT = process.env.PORT || 3000;
const allowedOrigins = ['http://localhost:5173'];

// Middleware Configuration
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json()); 

// Database connection test function
const testDatabaseConnection = async () => {
  try {
    console.log('🔍 Testing Neon database connection...');
    const result = await sql`SELECT NOW() as current_time, version() as db_version`;
    console.log('✅ Database connection successful!');
    console.log('🕐 Database time:', result[0].current_time);
    console.log('📦 Database version:', result[0].db_version.split(' ')[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('🔧 Check your DATABASE_URL environment variable');
    return false;
  }
};

// Root route
app.get('/', async (req, res) => {
  try {
    const result = await sql`SELECT version()`;
    const { version } = result[0];
    res.json({ 
      message: 'AI Startup Studio API is working!',
      database: 'Connected to Neon',
      version: version.split(' ')[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'API is running but database connection failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check route
app.get('/health', async (req, res) => {
  try {
    const result = await sql`SELECT 
      NOW() as current_time,
      version() as db_version,
      current_database() as database_name`;
    
    res.json({
      status: 'healthy',
      database: 'connected',
      info: {
        time: result[0].current_time,
        version: result[0].db_version.split(' ')[0],
        database: result[0].database_name
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// JSON Web Token (JWT) routes 
console.log('JWT_SECRET:', process.env.JWT_SECRET);

// Mount user routes
app.use('/api/user', userRoutes);

// Mount protected routes
app.use('/api', protectedRoutes);

// Initialize server
const startServer = async () => {
  console.log('🚀 Starting AI Startup Studio API...');
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required for Neon database');
    console.error('🔧 Please set DATABASE_URL in your .env file');
    process.exit(1);
  }
  
  // Test database connection
  const dbConnected = await testDatabaseConnection();
  
  if (!dbConnected) {
    console.error('❌ Starting server anyway, but database is not accessible');
  }
  
  // Start server
  app.listen(PORT, () => {
    console.log(`✅ Server is running on PORT: ${PORT}`);
    console.log(`🔗 Test connection: http://localhost:${PORT}/`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  });
};

// Start the application
startServer();