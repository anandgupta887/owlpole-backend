# Owlpole Backend (TypeScript)

Modern, type-safe Node.js backend for the Owlpole digital twin platform.

## Tech Stack

- **TypeScript** - Type safety and better developer experience
- **Express** - Web framework
- **MongoDB + Mongoose** - Database and ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing

## Project Structure

```
backend/
├── config/           # Configuration files (database, etc.)
├── models/           # Mongoose models with TypeScript interfaces
├── controllers/      # Request handlers
├── routes/           # API route definitions
├── middleware/       # Custom middleware (auth, error handling)
├── services/         # External API integrations (Gemini, HeyGen)
├── utils/            # Helper functions
├── uploads/          # Temporary file storage
├── server.ts         # Main entry point
├── tsconfig.json     # TypeScript configuration
└── package.json      # Dependencies and scripts
```

## Setup

1. Install dependencies:

```bash
yarn install
```

2. Configure environment variables in `.env`:

```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/owlpole
JWT_SECRET=your_secret_here
JWT_EXPIRE=7d
GEMINI_API_KEY=your_gemini_key
```

3. Run in development mode:

```bash
yarn dev
```

4. Build for production:

```bash
yarn build
yarn start
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Twins

- `GET /api/twins` - Get all user's twins (protected)
- `POST /api/twins` - Create new twin (protected)
- `GET /api/twins/:id` - Get single twin (protected)
- `PUT /api/twins/:id` - Update twin (protected)
- `DELETE /api/twins/:id` - Delete twin (protected)

## Features

- ✅ Full TypeScript support with strict type checking
- ✅ Clean architecture with separation of concerns
- ✅ JWT-based authentication
- ✅ Role-based access control (CREATOR, CALLER, ADMIN)
- ✅ MongoDB integration with Mongoose ODM
- ✅ Global error handling
- ✅ Security headers with Helmet
- ✅ CORS enabled
- ✅ Request logging with Morgan
