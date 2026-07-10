const mongoose = require('mongoose');

const PLACEHOLDER_URL = 'mongodb+srv://username:password@cluster.mongodb.net/taajanews';

// ponytail: falls back to an in-memory MongoDB (mongodb-memory-server) when no
// real MONGODB_URL is configured, so `npm run dev` works with zero DB setup.
// Data resets every restart. Never triggers in production. Swap for a real
// MONGODB_URL in backend/.env once you need data to persist.
const useMemoryServer = () =>
  process.env.NODE_ENV !== 'production' &&
  (!process.env.MONGODB_URL || process.env.MONGODB_URL === PLACEHOLDER_URL);

const connectDB = async () => {
  try {
    let mongoUrl = process.env.MONGODB_URL;
    let isMemoryServer = false;

    if (useMemoryServer()) {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mem = await MongoMemoryServer.create();
      mongoUrl = mem.getUri();
      isMemoryServer = true;
      console.log('⚠️  MONGODB_URL not configured — using an in-memory MongoDB (data resets on restart)');
    }

    const conn = await mongoose.connect(mongoUrl, {
      // MongoDB driver options
    });

    console.log(`📦 MongoDB Connected: ${conn.connection.host}`);

    if (isMemoryServer) {
      const { seedDatabase } = require('../scripts/seed');
      await seedDatabase();
    }

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
