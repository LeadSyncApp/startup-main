# Railway Deployment Configuration

## Project Structure
- Backend: `startup/leadsync-backend/`
- Frontend: `startup/startup-frontend/`

## Railway Settings
- Root Directory: `/` (repository root)
- Build Command: `cd startup/leadsync-backend && npm run build`
- Start Command: `cd startup/leadsync-backend && npm start`
- Node Version: 18.x

## Environment Variables Required
```
NODE_ENV=production
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
```

## Deployment Notes
- Railway will use the root package.json start script
- Backend is the main deployment target
- Frontend should be deployed separately (Vercel/Netlify)
