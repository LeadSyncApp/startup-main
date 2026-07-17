import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "../../lib/prisma";
import { signToken } from "../../utils/jwt";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || "http://localhost:4000/api/auth/google/callback";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn("⚠️ Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
}

export function initializeGoogleStrategy() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return;

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
        passReqToCallback: true, // needed to read state param
      },
      async (req: any, accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value?.toLowerCase();
          const firstName = profile.name?.givenName || profile.displayName?.split(" ")[0] || "User";
          const lastName = profile.name?.familyName || profile.displayName?.split(" ").slice(1).join(" ") || "";

          if (!email) {
            return done(new Error("No email provided by Google"), false);
          }

          // Determine mode from state parameter
          const stateParam = req.query?.state || "";
          const isSignInMode = stateParam.includes("mode=signin");

          // 1. Try to find user by googleId
          let user = await prisma.user.findFirst({
            where: { googleId },
            include: { company: true },
          });

          if (user) {
            // SIGN IN MODE: existing Google user → log them in
            if (isSignInMode) {
              return done(null, { user, isNew: false } as any);
            }
            // SIGN UP MODE: account already exists → notify user
            return done(null, { error: "ACCOUNT_EXISTS", message: "This Google account is already registered. Please sign in instead." } as any);
          }

          // 2. Try to find user by email (account linking scenario)
          user = await prisma.user.findFirst({
            where: { email },
            include: { company: true },
          });

          if (user) {
            // SIGN IN MODE: existing email user → link Google and log in
            if (isSignInMode) {
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  googleId,
                  authProvider: user.authProvider === "EMAIL" ? "BOTH" : user.authProvider,
                },
              });
              const updated = await prisma.user.findFirst({
                where: { id: user.id },
                include: { company: true },
              });
              return done(null, { user: updated, isNew: false, linked: true } as any);
            }
            // SIGN UP MODE: account with this email already exists → notify user
            return done(null, { error: "ACCOUNT_EXISTS", message: "This Google account is already registered. Please sign in instead." } as any);
          }

          // 3. SIGN IN MODE: user not found → reject (no auto-creation)
          if (isSignInMode) {
            return done(null, { error: "NO_ACCOUNT", message: "No account found with this Google email. Please sign up first." } as any);
          }

          // 4. SIGN UP MODE (default): Completely new user → create company + owner account
          const sanitizedName = `${firstName}${lastName ? " " + lastName : ""}`.replace(/[^a-zA-Z]/g, "").substring(0, 8).toUpperCase() || "USER";
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          const companyCode = `${sanitizedName}${randomSuffix}`;

          const result = await prisma.$transaction(async (tx) => {
            const company = await tx.company.create({
              data: {
                name: `${firstName}${lastName ? " " + lastName : ""}'s Workspace`,
                companyCode,
                currencyCode: "INR",
                currencySymbol: "₹",
                timezone: "Asia/Kolkata",
                scale: "HOME_GROWN",
                users: {
                  create: {
                    firstName,
                    lastName,
                    email,
                    role: "OWNER",
                    googleId,
                    authProvider: "GOOGLE",
                    passwordHash: null,
                    isActive: true,
                    phoneNumber: null,
                    residingAddress: null,
                  },
                },
              },
              include: {
                users: true,
              },
            });

            await tx.botConfiguration.create({
              data: {
                companyId: company.id,
                botPolicies: "NOT_CONFIGURED",
                botCommands: [],
              },
            });

            return company;
          });

          const newUser = result.users[0];

          // Return isNew: true so frontend knows to run wizard steps 2 & 3
          return done(null, { user: { ...newUser, company: result }, isNew: true } as any);
        } catch (error) {
          console.error("Google OAuth strategy error:", error);
          return done(error as Error, false);
        }
      }
    )
  );

  passport.serializeUser((data: any, done) => {
    done(null, JSON.stringify(data));
  });

  passport.deserializeUser((data: string, done) => {
    try {
      done(null, JSON.parse(data));
    } catch {
      done(new Error("Deserialization failed"), null);
    }
  });
}

export { passport };