# Google OAuth Setup Guide

## Prerequisites
1. A Google Cloud Platform account
2. A project created in Google Cloud Console

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click **Create Credentials** → **OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Add authorized redirect URIs:
   - Development: `http://localhost:4000/api/auth/google/callback`
   - Production: `https://your-domain.com/api/auth/google/callback`
6. Save and copy the **Client ID** and **Client Secret**

## Step 2: Configure Environment Variables

Add these to your `leadsync-backend/.env` file:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

## Step 3: Run Database Migration

```bash
cd startup/leadsync-backend
npx prisma migrate dev --name add-google-oauth-fields
```

If you see drift warnings and are in development:
```bash
npx prisma migrate reset
```

## Step 4: Restart the Server

```bash
npm run dev
```

## Step 5: Verify Installation

1. Visit `http://localhost:5173`
2. Click **"Continue with Google"** on the signup page
3. You should be redirected to Google's consent screen
4. After consent, you'll be redirected back to the app as a new user

## Account Linking Behavior

| Scenario | Behavior |
|----------|----------|
| New Google user | Creates new company + owner account |
| Google user signing in again | Logs in to existing account |
| Email user links Google | `authProvider` upgrades from `EMAIL` → `BOTH` |
| Google-only user tries manual login | Returns error: "Please use Google sign-in" |
| BOTH user can use either method | Login works with password OR Google |

## Security Notes

- `googleId` is stored as a unique identifier
- `authProvider` tracks the signup method: `EMAIL`, `GOOGLE`, or `BOTH`
- Password reset emails still work for EMAIL/BOTH users
- Google-only users (no passwordHash) cannot use the manual login form
- JWT tokens include `authProvider` claim for frontend awareness

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `GOOGLE_CLIENT_ID not configured` warning | Add env vars and restart |
| `redirect_uri_mismatch` error | Check callback URL in Google Console matches exactly |
| `passport.authenticate is not a function` | Ensure `app.ts` calls `initializeGoogleStrategy()` before routes |
| Token not persisting after callback | Check that `/api/auth/me` returns 200 with valid token |