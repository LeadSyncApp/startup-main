# LeadSync CRM - Setup Guide

## Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL** database
3. **Git**

## Quick Setup

### 1. Database Setup

Install PostgreSQL and create a database:
```sql
CREATE DATABASE leadsync_db;
```

### 2. Backend Setup

```bash
cd leadsync-backend
```

Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

Update `.env` with your credentials:
- `DATABASE_URL`: Your PostgreSQL connection string
- `JWT_SECRET`: Generate a secure random string
- Add API keys for external services (optional for basic functionality)

Install dependencies and setup database:
```bash
npm install
npm run migrate  # Push database schema
npm run seed     # Seed initial data (optional)
```

### 3. Frontend Setup

```bash
cd ..  # Back to root directory
```

The `.env` file is already configured for local development.

Install dependencies:
```bash
npm install
```

### 4. Running the Application

**Start Backend:**
```bash
cd leadsync-backend
npm run dev
```

**Start Frontend** (in separate terminal):
```bash
cd ..
npm run dev
```

## Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:4000
- **API Documentation**: http://localhost:4000/api-docs (if available)

## Default Login

After seeding the database, you can use:
- Email: admin@example.com
- Password: admin123

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check DATABASE_URL format: `postgresql://username:password@localhost:5432/leadsync_db`
- Verify database exists and user has permissions

### Port Conflicts
- Frontend defaults to 5173 (Vite)
- Backend defaults to 4000
- Change PORT in backend `.env` if needed

### Permission Issues
On Windows, if you get permission errors during npm install:
```powershell
npm cache clean --force
Remove-Item -Recurse -Force node_modules
npm install
```

## Development Commands

**Frontend:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

**Backend:**
- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript
- `npm run start` - Start production server
- `npm run migrate` - Push database schema changes
- `npm run seed` - Seed database with initial data

## Architecture

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Express + TypeScript + Prisma
- **Database**: PostgreSQL
- **Real-time**: Socket.io

## Features

- Multi-channel lead management (Website, Telegram, Instagram, WhatsApp)
- AI-powered conversation handling
- Order management and tracking
- User role-based access control
- Real-time notifications
- Revenue analytics and reporting
