import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Button from '../components/ui/Button';

type Mode = 'login' | 'forgot' | 'reset';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const resetToken = searchParams.get('token');
  const [mode, setMode] = useState<Mode>(resetToken ? 'reset' : 'login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [token, setToken] = useState(resetToken || '');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.post('/auth/login', { email, password });
      login(data.user, data.company, data.token);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.post('/auth/forgot-password', { email });
      if (data.resetToken) {
        console.log('Dev token:', data.resetToken);
        setToken(data.resetToken);
        setMode('reset');
      } else {
        alert('Reset link sent to your email');
        setMode('login');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send reset');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setMode('login');
      setToken('');
      setNewPassword('');
      alert('Password updated successfully');
    } catch (err: any) {
      setError(err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background-primary">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-accent/10 rounded-full filter blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-violet-500/10 rounded-full filter blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-mesh opacity-30" />
      </div>

      {/* Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-md relative z-10 px-4"
      >
        {/* Logo */}
        <motion.div
          className="flex items-center justify-center gap-3 mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow">
            <Sparkles className="w-6 h-6 text-text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gradient">LeadSync</h1>
            <p className="text-xs text-text-muted">CRM Platform</p>
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-background-secondary border border-border rounded-2xl p-8 shadow-card-elevated backdrop-blur-sm"
        >
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-text-primary">
              {mode === 'login' ? 'Welcome back' : mode === 'forgot' ? 'Reset Password' : 'New Password'}
            </h2>
            <p className="text-text-secondary mt-1">
              {mode === 'login' ? 'Sign in to your account' : 'Follow the steps below'}
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm"
            >
              {error}
            </motion.div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background-tertiary border border-border rounded-lg py-3 pl-10 pr-4 text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background-tertiary border border-border rounded-lg py-3 pl-10 pr-12 text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-border bg-background-tertiary text-accent focus:ring-accent" />
                  <span className="text-text-secondary">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-accent hover:text-accent-hover transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={loading}
                rightIcon={<ArrowRight size={16} />}
                className="w-full"
              >
                Sign in
              </Button>
            </form>
          )}

          {/* Forgot Form */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background-tertiary border border-border rounded-lg py-3 px-4 text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={loading}
                className="w-full"
              >
                Send Reset Link
              </Button>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-center text-text-secondary hover:text-text-primary transition-colors text-sm"
              >
                Back to login
              </button>
            </form>
          )}

          {/* Reset Form */}
          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-5">
              {!resetToken && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Reset Token</label>
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full bg-background-tertiary border border-border rounded-lg py-3 px-4 text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                    placeholder="Enter reset token"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-background-tertiary border border-border rounded-lg py-3 px-4 pr-12 text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                    placeholder="Enter new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={loading}
                className="w-full"
              >
                Update Password
              </Button>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-center text-text-secondary hover:text-text-primary transition-colors text-sm"
              >
                Back to login
              </button>
            </form>
          )}

          {mode === 'login' && (
            <p className="mt-6 text-center text-sm text-text-secondary">
              Don't have an account?{' '}
              <Link to="/signup" className="text-accent hover:text-accent-hover font-medium transition-colors">
                Sign up
              </Link>
            </p>
          )}
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-text-muted mt-6"
        >
          By signing in, you agree to our{' '}
          <a href="#" className="text-text-secondary hover:text-text-primary">Terms</a>
          {' '}and{' '}
          <a href="#" className="text-text-secondary hover:text-text-primary">Privacy Policy</a>
        </motion.p>
      </motion.div>
    </div>
  );
}
