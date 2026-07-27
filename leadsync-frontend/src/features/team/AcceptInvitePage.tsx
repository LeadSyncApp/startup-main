import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Store, Users, CheckCircle2, Loader2, Phone, MapPin, Lock, User, ArrowRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { apiClient } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { getRoleLabel, getRoleIcon, Role } from "../../lib/permissions";

interface InviteData {
  email: string;
  role: Role;
  staffId: string | null;
  company: {
    id: string;
    name: string;
    companyCode: string;
  };
}

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [isValidating, setIsValidating] = useState(true);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [residingAddress, setResidingAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"validating" | "form" | "success">("validating");

  useEffect(() => {
    if (!token) {
      setError("No invitation token found. Please check your invite link.");
      setIsValidating(false);
      return;
    }

    const validateToken = async () => {
      try {
        const res = await apiClient.post("/team/invitations/validate", { token });
        if (res.data?.valid) {
          setInvite(res.data.invitation);
          setStep("form");
        } else {
          setError("Invalid or expired invitation.");
        }
      } catch (err: any) {
        const message = err?.response?.data?.message || "Failed to validate invitation";
        setError(message);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim()) {
      toast.error("First name is required");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (!/^\d{10}$/.test(phoneNumber)) {
      toast.error("Valid 10-digit phone number is required");
      return;
    }
    if (!residingAddress.trim()) {
      toast.error("Address is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post("/team/invitations/accept", {
        token,
        firstName,
        lastName,
        password,
        phoneNumber,
        residingAddress,
      });

      // Store the token and user data for auto-login
      const { token: jwtToken, user, company } = res.data;

      localStorage.setItem("token", jwtToken);
      localStorage.setItem("access_token", jwtToken);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("company", JSON.stringify(company));

      setStep("success");
      toast.success(res.data.message);

      // Redirect to workspace after a brief delay
      setTimeout(() => {
        window.location.href = "/";
      }, 2500);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to accept invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
           style={{ backgroundColor: 'var(--app-bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--brand-saffron)' }} />
          <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>
            Validating your invitation...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
           style={{ backgroundColor: 'var(--app-bg)' }}>
        <Card className="max-w-md w-full p-10 text-center space-y-6">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto"
               style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <Store className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
            Invitation Issue
          </h1>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {error}
          </p>
          <div className="pt-4 space-y-3">
            <p className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
              Please ask your team admin to send you a new invitation link.
            </p>
            <Button
              variant="primary"
              onClick={() => navigate("/login")}
              className="w-full py-3.5 text-xs font-black uppercase tracking-widest rounded-xl"
            >
              Go to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
           style={{ backgroundColor: 'var(--app-bg)' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="p-10 text-center space-y-6">
            <div className="h-20 w-20 rounded-[2rem] flex items-center justify-center mx-auto"
                 style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
              <CheckCircle2 className="h-10 w-10" style={{ color: 'var(--success-green)' }} />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                Welcome Aboard! 🎉
              </h1>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                You're now part of <strong style={{ color: 'var(--brand-saffron)' }}>{invite?.company.name}</strong>
              </p>
            </div>
            <div className="flex justify-center gap-4 py-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl border"
                   style={{ borderColor: 'var(--app-border)' }}>
                <Users className="h-4 w-4" style={{ color: 'var(--brand-saffron)' }} />
                <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                  {invite && getRoleIcon(invite.role)} {invite && getRoleLabel(invite.role)}
                </span>
              </div>
            </div>
            <p className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
              Redirecting you to the workspace...
            </p>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ backgroundColor: 'var(--app-bg)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <Card className="overflow-hidden">
          {/* Header */}
          <div className="p-8 sm:p-10 text-center border-b" style={{ borderColor: 'var(--app-border)' }}>
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                 style={{ backgroundColor: 'rgba(212, 168, 67, 0.1)', color: 'var(--brand-saffron)' }}>
              <Store className="h-8 w-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
              Join {invite?.company.name}
            </h1>
            <p className="text-sm font-medium mt-2" style={{ color: 'var(--text-secondary)' }}>
              You've been invited as {invite && getRoleIcon(invite.role)} {invite && getRoleLabel(invite.role)}
            </p>
            {invite?.staffId && (
              <span className="inline-block mt-2 px-3 py-1 rounded-lg text-[10px] font-mono font-black"
                    style={{ backgroundColor: 'var(--app-bg-soft)', color: 'var(--app-text-muted)' }}>
                Staff ID: {invite.staffId}
              </span>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleAccept} className="p-8 sm:p-10 space-y-6">
            {/* Name Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: 'var(--app-text-muted)' }}>
                  <User className="h-3 w-3 inline mr-1" /> First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder=""
                  required
                  className="w-full text-sm font-bold rounded-xl px-4 py-3.5 outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    border: '2px solid var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: 'var(--app-text-muted)' }}>
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder=""
                  className="w-full text-sm font-bold rounded-xl px-4 py-3.5 outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    border: '2px solid var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
              </div>
            </div>

            {/* Password Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: 'var(--app-text-muted)' }}>
                  <Lock className="h-3 w-3 inline mr-1" /> Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  className="w-full text-sm font-bold rounded-xl px-4 py-3.5 outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    border: '2px solid var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: 'var(--app-text-muted)' }}>
                  <Lock className="h-3 w-3 inline mr-1" /> Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  required
                  minLength={6}
                  className="w-full text-sm font-bold rounded-xl px-4 py-3.5 outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    border: '2px solid var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: 'var(--app-text-muted)' }}>
                <Phone className="h-3 w-3 inline mr-1" /> Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                required
                maxLength={10}
                className="w-full text-sm font-bold rounded-xl px-4 py-3.5 outline-none transition-all"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  border: '2px solid var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: 'var(--app-text-muted)' }}>
                <MapPin className="h-3 w-3 inline mr-1" /> Residing Address
              </label>
              <textarea
                value={residingAddress}
                onChange={(e) => setResidingAddress(e.target.value)}
                placeholder="Shop no. 12, Main Bazaar, Delhi - 110001"
                required
                rows={2}
                className="w-full text-sm font-bold rounded-xl px-4 py-3.5 outline-none transition-all resize-none"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  border: '2px solid var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full py-4.5 text-xs font-black uppercase tracking-[0.15em] rounded-xl"
              style={{ boxShadow: '0 8px 24px rgba(212, 168, 67, 0.25)' }}
            >
              {isSubmitting ? (
                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Setting up your account...</>
              ) : (
                <><ArrowRight className="h-5 w-5 mr-2" /> Accept & Join Team</>
              )}
            </Button>

            <p className="text-[10px] text-center font-bold" style={{ color: 'var(--app-text-muted)' }}>
              By accepting, you agree to join as a team member of {invite?.company.name}.
            </p>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}