# LeadSync CRM - Installation & Setup Guide

Welcome to LeadSync CRM! This guide will walk you through setting up the project on your local system.

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (v20.16.0 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** - [Download here](https://git-scm.com/)
- **PostgreSQL** (v12 or higher) - [Download here](https://www.postgresql.org/download/) OR use a cloud database like Supabase
- **Code Editor** (VS Code recommended) - [Download here](https://code.visualstudio.com/)

## 🚀 Quick Start (5 Minutes)

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/leadsync.git
cd leadsync
```

### Step 2: Install Dependencies

```bash
# Install backend dependencies
cd leadsync-backend
npm install

# Install frontend dependencies (in a new terminal)
cd ../leadsync-frontend
npm install
```

### Step 3: Configure Environment Variables

#### Backend Setup

```bash
cd leadsync-backend
cp .env.example .env
```

Edit `.env` and configure the following:

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/leadsync"
DIRECT_URL="postgresql://user:password@localhost:5432/leadsync"

# JWT Secret (generate a random string)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Frontend URL
FRONTEND_URL="http://localhost:5173"

# CORS Origins
CORS_ORIGIN="http://localhost:5173,http://localhost:3000"

# AI Provider API Keys (at least one required)
GROQ_API_KEY="your-groq-api-key"
# OR
GEMINI_API_KEY="your-google-gemini-api-key"

# Optional: Telegram Integration
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
TELEGRAM_POLLING=true

# Optional: Email Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

**Where to get API Keys:**
- **Groq**: https://console.groq.com/ (Free tier available)
- **Google Gemini**: https://makersuite.google.com/app/apikey (Free tier available)
- **Telegram Bot**: https://t.me/BotFather

#### Frontend Setup (Optional)

```bash
cd ../leadsync-frontend
cp .env.example .env
```

Most frontend features work without additional configuration, but you can customize:

```env
VITE_API_URL="http://localhost:4000"
```

### Step 4: Setup Database

```bash
cd leadsync-backend

# Run Prisma migrations
npm run migrate

# (Optional) Seed the database with sample data
npm run seed
```

### Step 5: Start the Development Servers

**Terminal 1 - Backend Server:**
```bash
cd leadsync-backend
npm run dev
```
Backend will run on `http://localhost:4000`

**Terminal 2 - Frontend Application:**
```bash
cd leadsync-frontend
npm run dev
```
Frontend will run on `http://localhost:5173`

### Step 6: Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

---

## 📝 Detailed Setup Instructions

### Setting Up PostgreSQL Database

#### Option A: Local PostgreSQL Installation

1. **Create a database:**
   ```bash
   psql -U postgres
   postgres=# CREATE DATABASE leadsync;
   postgres=# \q
   ```

2. **Update `.env` with your connection string:**
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/leadsync"
   DIRECT_URL="postgresql://postgres:password@localhost:5432/leadsync"
   ```

#### Option B: Supabase (Cloud Database - Recommended)

1. Go to https://supabase.com and create an account
2. Create a new project
3. Copy the connection string from Settings → Database
4. Update `.env`:
   ```env
   DATABASE_URL="postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=require&connection_limit=3"
   DIRECT_URL="postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=require"
   ```

### Project Structure

```
leadsync/
├── leadsync-backend/          # Node.js + Express API
│   ├── src/
│   │   ├── routes/            # API endpoints
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Auth, validation, etc.
│   │   ├── adapters/          # Channel integrations (Telegram, Instagram)
│   │   ├── bot/               # Bot logic
│   │   ├── lib/               # Utilities (database, socket, API)
│   │   └── app.ts             # Express app configuration
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── migrations/        # Database version control
│   └── package.json
│
├── leadsync-frontend/         # React + Vite UI
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page components
│   │   ├── context/           # React Context state management
│   │   ├── lib/               # Utilities and helpers
│   │   ├── types/             # TypeScript type definitions
│   │   └── App.tsx            # Main app component
│   ├── public/                # Static assets
│   └── package.json
│
└── prisma/                    # Shared database schema
```

### Available Commands

#### Backend Commands

```bash
npm run dev              # Start development server with hot reload
npm run build            # Compile TypeScript to JavaScript
npm run start            # Run production build
npm run migrate          # Run Prisma migrations
npm run seed             # Seed database with initial data
npm run repo:map         # Generate repository documentation
```

#### Frontend Commands

```bash
npm run dev              # Start Vite development server
npm run build            # Build for production
npm run preview          # Preview production build locally
npm run lint             # Check code quality
npm run repo:map         # Generate repository documentation
```

---

## 🔧 Environment Variables Reference

### Backend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `DIRECT_URL` | ✅ | Direct PostgreSQL connection (for migrations) |
| `JWT_SECRET` | ✅ | Secret key for JWT tokens |
| `FRONTEND_URL` | ✅ | Frontend application URL |
| `CORS_ORIGIN` | ✅ | Comma-separated allowed CORS origins |
| `GROQ_API_KEY` | ⚠️ | Groq API key (at least one AI provider needed) |
| `GEMINI_API_KEY` | ⚠️ | Google Gemini API key (alternative to Groq) |
| `TELEGRAM_BOT_TOKEN` | ❌ | Telegram bot token (for Telegram integration) |
| `TELEGRAM_POLLING` | ❌ | Enable Telegram polling (default: false) |
| `SMTP_HOST` | ❌ | SMTP server for emails |
| `SMTP_PORT` | ❌ | SMTP port (usually 587) |
| `SMTP_USER` | ❌ | SMTP username |
| `SMTP_PASS` | ❌ | SMTP password |

---

## 🐛 Troubleshooting

### "Cannot find module 'prisma'"
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

### Port Already in Use

If port 4000 (backend) or 5173 (frontend) is already in use:

**Backend:**
```bash
# Set a different port
export PORT=5000  # On Windows: set PORT=5000
npm run dev
```

**Frontend:**
```bash
npm run dev -- --port 3000
```

### Database Connection Error

1. Verify PostgreSQL is running
2. Check `DATABASE_URL` in `.env`
3. Ensure database exists:
   ```bash
   psql -U postgres -c "CREATE DATABASE leadsync;"
   ```

### Prisma Migration Failed

```bash
# Reset database (⚠️ WARNING: This deletes all data)
npx prisma migrate reset

# Or push schema without losing data
npx prisma db push
```

### Dependencies Installation Fails

```bash
# Clear npm cache
npm cache clean --force

# Try installing again
npm install

# If still failing, use yarn or pnpm
npm install -g yarn
yarn install
```

---

## 📚 Technology Stack

### Backend
- **Runtime:** Node.js (v20.16.0+)
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Authentication:** JWT (jsonwebtoken)
- **Real-time:** Socket.io
- **AI Integration:** Groq, Google Gemini
- **Communication:** Telegram Bot API, Instagram API

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React Context API
- **Routing:** React Router v6
- **HTTP Client:** Axios
- **Real-time:** Socket.io Client
- **UI Components:** Headless UI, Lucide Icons
- **Charts:** Recharts
- **Notifications:** React Hot Toast

---

## 🚢 Production Deployment

### Build for Production

```bash
# Backend
cd leadsync-backend
npm run build

# Frontend
cd leadsync-frontend
npm run build
```

### Environment Variables for Production

Always use strong, unique values in production:

```env
# Update these for production
JWT_SECRET="generate-a-strong-random-string"
DATABASE_URL="your-production-database-url"
FRONTEND_URL="https://your-production-domain.com"
CORS_ORIGIN="https://your-production-domain.com"
```

### Deploy to Popular Platforms

**Backend:**
- Railway: https://railway.app
- Heroku: https://heroku.com
- Render: https://render.com

**Frontend:**
- Vercel: https://vercel.com
- Netlify: https://netlify.com

---

## 📞 Support & Documentation

- **API Documentation:** Available at `/api/docs` (if Swagger is configured)
- **GitHub Issues:** Report bugs on GitHub
- **Discussions:** Ask questions in GitHub Discussions

---

## 📄 License

This project is proprietary. See LICENSE file for details.

---

## ✅ Quick Verification Checklist

- [ ] Node.js v20.16.0+ installed
- [ ] PostgreSQL/Supabase database created
- [ ] `.env` files configured with all required variables
- [ ] Dependencies installed (`npm install`)
- [ ] Database migrations ran (`npm run migrate`)
- [ ] Backend server running on port 4000
- [ ] Frontend server running on port 5173
- [ ] Can login to the application
- [ ] Can create/view companies and conversations

---

Happy coding! 🚀
