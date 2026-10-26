import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import PublicNavbar from '../components/PublicNavbar';
import {
  Lock,
  Mail,
  Building,
  User,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  KeyRound,
  RotateCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mode: 'login' | 'signup' | 'verify_otp'
  const [mode, setMode] = useState(location.state?.mode || 'login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [otp, setOtp] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Sync mode if passed from route state
  useEffect(() => {
    if (location.state?.mode) {
      setMode(location.state.mode);
    }
  }, [location.state]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Destination after successful authentication
  const destination = location.state?.from?.pathname || '/dashboard';

  // Demo user quick-fill helper
  const fillDemoCredentials = (role) => {
    setError(null);
    setSuccessMessage(null);
    if (role === 'admin') {
      setEmail('admin@waymark.com');
      setPassword('Password123!');
    } else if (role === 'pm') {
      setEmail('pm@waymark.com');
      setPassword('Password123!');
    } else if (role === 'employee') {
      setEmail('employee@waymark.com');
      setPassword('Password123!');
    }
  };

  // 1. Handle Unified Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    try {
      setLoading(true);
      const res = await authApi.login({ email, password });
      login(res);
      navigate(destination, { replace: true });
    } catch (err) {
      const msg = err.message || 'Login failed';
      if (msg.toLowerCase().includes('not verified') || msg.toLowerCase().includes('otp')) {
        setMode('verify_otp');
        setError('Your administrator account is pending verification. Enter the 6-digit OTP code.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Workspace Creation (Admin Sign-up)
  const handleSignup = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    try {
      setLoading(true);
      const res = await authApi.signupWorkspace({
        organizationName,
        name,
        email,
        password,
      });

      setSuccessMessage(res.message || 'Verification code sent to your email.');
      setMode('verify_otp');
      setResendCooldown(60);
    } catch (err) {
      setError(err.message || 'Workspace creation failed.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle OTP Verification
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (otp.trim().length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    try {
      setLoading(true);
      const res = await authApi.verifyOtp({ email, otp: otp.trim() });

      // If backend returns token directly upon verification, log in immediately
      if (res.accessToken) {
        login(res);
        navigate(destination, { replace: true });
      } else {
        setSuccessMessage('Account verified successfully! Please sign in with your credentials.');
        setMode('login');
        setOtp('');
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Resending OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !email) return;
    setError(null);
    setSuccessMessage(null);

    try {
      setLoading(true);
      const res = await authApi.resendOtp(email);
      setSuccessMessage(res.message || 'A fresh verification code has been dispatched.');
      setResendCooldown(60);
    } catch (err) {
      setError(err.message || 'Could not resend OTP code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-space relative overflow-hidden bg-slate-900 text-slate-900 select-none">
      {/* Background Ambience & Video Texture */}
      <div className="dashboard-video-container pointer-events-none opacity-40">
        <video autoPlay loop muted playsInline className="dashboard-bg-video">
          <source src="/Landspace.mp4" type="video/mp4" />
          <source src="/Landscape.mp4" type="video/mp4" />
        </video>
      </div>

      <div className="absolute inset-0 bg-gradient-to-br from-sky-400/20 via-slate-900/60 to-slate-950 pointer-events-none z-0" />

      {/* Top Navbar */}
      <div className="relative z-10 w-full">
        <PublicNavbar />
      </div>

      {/* Main Authentication Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-[460px] bg-white/90 backdrop-blur-2xl border-2 border-slate-900 rounded-[28px] p-6 sm:p-8 shadow-[8px_8px_0px_0px_#0f172a] transition-all duration-300">
          
          {/* Header Brand */}
          <div className="flex flex-col items-center text-center pb-5 border-b-2 border-slate-900/10 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-sky-400 border-2 border-slate-900 flex items-center justify-center shadow-[3px_3px_0px_0px_#0f172a] mb-3">
              <img src="/favicon.png" alt="WAYMARK" className="w-7 h-7 object-contain" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              WAYMARK
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 mt-1">
              {mode === 'login' && 'Sign in to access your tenant workspace'}
              {mode === 'signup' && 'Create a new multi-tenant organization workspace'}
              {mode === 'verify_otp' && '6-Digit Email Verification'}
            </p>
          </div>

          {/* Interactive Tab Switcher (Visible when not in OTP view) */}
          {mode !== 'verify_otp' && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 border-2 border-slate-900 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                  mode === 'login'
                    ? 'bg-sky-400 text-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a]'
                    : 'text-slate-600 hover:text-slate-900 border-2 border-transparent'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                  mode === 'signup'
                    ? 'bg-sky-400 text-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a]'
                    : 'text-slate-600 hover:text-slate-900 border-2 border-transparent'
                }`}
              >
                New Workspace
              </button>
            </div>
          )}

          {/* Error Alert Callout */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border-2 border-rose-500 rounded-2xl mb-5 text-rose-900 text-xs sm:text-sm font-semibold shadow-[3px_3px_0px_0px_#f43f5e]">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Success / Info Callout */}
          {successMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border-2 border-emerald-600 rounded-2xl mb-5 text-emerald-900 text-xs sm:text-sm font-semibold shadow-[3px_3px_0px_0px_#059669]">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">{successMessage}</div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODE 1: UNIFIED SIGN IN                                   */}
          {/* ========================================================= */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@waymark.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-900 rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-slate-900 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-11 py-2.5 bg-white border-2 border-slate-900 rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-slate-900 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-sky-400 hover:bg-sky-300 text-slate-900 font-extrabold text-sm sm:text-base border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0px_0px_#0f172a] hover:shadow-[2px_2px_0px_0px_#0f172a] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Quick Fill Demo Logins */}
              <div className="pt-4 mt-4 border-t-2 border-slate-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                  <span>Instant Demo Credentials</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => fillDemoCredentials('admin')}
                    className="py-1.5 px-2 bg-slate-50 hover:bg-sky-100 text-slate-800 border-2 border-slate-900 rounded-xl text-xs font-bold shadow-[2px_2px_0px_0px_#0f172a] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                  >
                    👑 Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemoCredentials('pm')}
                    className="py-1.5 px-2 bg-slate-50 hover:bg-sky-100 text-slate-800 border-2 border-slate-900 rounded-xl text-xs font-bold shadow-[2px_2px_0px_0px_#0f172a] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                  >
                    💼 Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemoCredentials('employee')}
                    className="py-1.5 px-2 bg-slate-50 hover:bg-sky-100 text-slate-800 border-2 border-slate-900 rounded-xl text-xs font-bold shadow-[2px_2px_0px_0px_#0f172a] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                  >
                    ⚡ Engineer
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* MODE 2: WORKSPACE ONBOARDING (SIGN UP)                   */}
          {/* ========================================================= */}
          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Organization / Workspace Name
                </label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="e.g. Acme Tech Labs"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-900 rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-slate-900 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Administrator Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-900 rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-slate-900 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Admin Work Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@acme.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-900 rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-slate-900 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Admin Password (min. 8 characters)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full pl-10 pr-11 py-2.5 bg-white border-2 border-slate-900 rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-slate-900 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 py-3 px-4 bg-sky-400 hover:bg-sky-300 text-slate-900 font-extrabold text-sm sm:text-base border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0px_0px_#0f172a] hover:shadow-[2px_2px_0px_0px_#0f172a] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span>Creating Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Create Workspace & Send OTP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* MODE 3: 6-DIGIT OTP VERIFICATION                         */}
          {/* ========================================================= */}
          {mode === 'verify_otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3 bg-sky-50 border-2 border-sky-400 rounded-2xl text-xs font-semibold text-sky-950 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0" />
                <span>
                  A 6-digit activation code was sent to <strong className="underline">{email}</strong>.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 text-center">
                  Enter 6-Digit Verification Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full py-3 px-4 bg-white border-2 border-slate-900 rounded-2xl text-center text-2xl font-mono font-extrabold tracking-[10px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-slate-900 shadow-[inset_2px_2px_0px_0px_rgba(0,0,0,0.05)] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-sky-400 hover:bg-sky-300 text-slate-900 font-extrabold text-sm sm:text-base border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0px_0px_#0f172a] hover:shadow-[2px_2px_0px_0px_#0f172a] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Verify OTP & Activate Workspace</span>
                  </>
                )}
              </button>

              {/* Resend and Navigation Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t-2 border-slate-200">
                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleResendOtp}
                  className="text-xs font-bold text-sky-700 hover:text-sky-900 hover:underline flex items-center gap-1 disabled:opacity-50 disabled:no-underline cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : 'Resend OTP Code'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* Footer note */}
          <div className="mt-6 pt-4 border-t border-slate-200/80 text-center">
            <p className="text-[11px] text-slate-500 font-medium">
              WAYMARK Multi-Tenant Protected • AES-256 JWT Encryption • Strict RBAC
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
