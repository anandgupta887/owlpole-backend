import express, { Application } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import connectDB from './config/database';
import errorHandler from './middleware/errorHandler';
import authRoutes from './routes/auth';
import twinRoutes from './routes/twins';
import paymentRoutes from './routes/payment';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app: Application = express();

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Set security headers
app.use(helmet());

// Enable CORS
app.use(cors());

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static folder (uploads is in backend root, we're in backend/src)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Mount routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Owlpole API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/twins', twinRoutes);
app.use('/api/payment', paymentRoutes);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.log(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});
