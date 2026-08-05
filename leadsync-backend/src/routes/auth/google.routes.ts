import { Router } from "express";
import { passport } from "../../services/auth/google.strategy";
import { prisma } from "../../lib/prisma";
import { signToken } from "../../utils/jwt";

const router = Router();

function getGoogleAuthUrl(mode: "signin" | "signup") {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const redirectUri = (process.env.GOOGLE_CALLBACK_URL || "http://localhost:4000/api/auth/google/callback").trim();
  const state = `mode=${mode}`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "profile email",
    state,
    prompt: "select_account",
    access_type: "offline",
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  console.log("[Google OAuth] Redirect URL:", url);
  return url;
}

/**
 * GET /api/auth/google/signup
 * Initiates Google OAuth flow for SIGN UP (creates new account if none exists)
 */
router.get("/google/signup", (req, res) => {
  res.redirect(getGoogleAuthUrl("signup"));
});

/**
 * GET /api/auth/google/signin
 * Initiates Google OAuth flow for SIGN IN (only allows existing accounts)
 */
router.get("/google/signin", (req, res) => {
  res.redirect(getGoogleAuthUrl("signin"));
});

/**
 * GET /api/auth/google/callback
 * Handles OAuth callback from Google
 */
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=google_auth_failed` }),
  (req: any, res) => {
    try {
      const { user, isNew, linked, error, message } = req.auth || req.user || {};

      // Handle error cases (e.g., signin with no account, signup with existing account)
      if (error) {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        // ACCOUNT_EXISTS: send to signup page so user sees the message and can switch to sign in
        if (error === "ACCOUNT_EXISTS") {
          return res.redirect(`${frontendUrl}/onboarding?error=${error}&message=${encodeURIComponent(message || "")}`);
        }
        return res.redirect(`${frontendUrl}/login?error=${error}&message=${encodeURIComponent(message || "")}`);
      }

      if (!user || !user.id) {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        return res.redirect(`${frontendUrl}/login?error=no_user`);
      }

      const token = signToken({
        userId: user.id,
        companyId: user.companyId,
        role: user.role,
      });

      // Redirect to frontend with token in URL fragment
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      let redirectPath = "/auth-callback";
      if (isNew) {
        redirectPath += "?welcome=true";
      } else if (linked) {
        redirectPath += "?linked=true";
      }

      res.redirect(`${frontendUrl}${redirectPath}#token=${token}`);
    } catch (error) {
      console.error("Google callback error:", error);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      res.redirect(`${frontendUrl}/login?error=callback_failed`);
    }
  }
);

export default router;