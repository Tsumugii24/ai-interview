import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight, Loader2, Cpu, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const setToken = useUserStore((state) => state.setToken);
  const setUser = useUserStore((state) => state.setUser);
  
  const message = location.state?.message;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setToken(data.token);
      setUser({ id: data.id, username: data.username, balance: data.balance, email: data.email, phone: data.phone, plan: data.plan, nextRefresh: data.nextRefresh });
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans selection:bg-indigo-500/30 relative">
      <div className="absolute top-4 left-4 z-20">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 text-sm font-medium transition-all shadow-md hover:bg-white dark:hover:bg-zinc-800"
        >
          <ArrowLeft size={16} />
          Return
        </button>
      </div>

      {/* Left Panel - Visual */}
      <div className="hidden lg:flex w-1/2 relative bg-white dark:bg-zinc-900 overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-zinc-900 to-emerald-600/20 z-0"></div>
        <div className="absolute w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] -top-40 -left-40 mix-blend-screen pointer-events-none"></div>
        <div className="absolute w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] bottom-0 right-0 mix-blend-screen pointer-events-none"></div>
        
        <div className="relative z-10 max-w-lg p-12 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="w-16 h-16 bg-white/5 backdrop-blur-xl rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-2xl">
              <Cpu className="text-indigo-400 w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight mb-6 bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-transparent">
              Welcome Back to InterviewAI
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed">
              Continue your journey to master your interview skills with real-time AI feedback and personalized simulation scenarios.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="mb-10 lg:hidden flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <Cpu className="text-indigo-400 w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">InterviewAI</span>
          </div>

          <h2 className="text-3xl font-semibold tracking-tight mb-2">Log in</h2>
          <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 mb-8">Enter your credentials to access your account.</p>
          
          {message && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
              {message}
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400 shrink-0"></div>
              {error}
            </motion.div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 ml-1">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-zinc-500 dark:text-zinc-400 group-focus-within:text-indigo-400 transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  className="w-full bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 pl-11 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all hover:bg-zinc-100 dark:bg-zinc-800/50"
                  placeholder="name@example.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</label>
                <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Forgot password?</a>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-zinc-500 dark:text-zinc-400 group-focus-within:text-indigo-400 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  className="w-full bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 pl-11 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all hover:bg-zinc-100 dark:bg-zinc-800/50"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative group overflow-hidden rounded-xl mt-6 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-600 transition-all duration-300 group-hover:scale-[1.02]"></div>
              <div className="relative px-4 py-3.5 flex items-center justify-center font-medium">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </div>
            </button>
          </form>
          
          <div className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Create one now
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
