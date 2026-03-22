import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mic, Play, ChevronRight, UserCheck } from 'lucide-react';
import { useUserStore } from '../store/userStore';

export default function LandingPage() {
  const navigate = useNavigate();
  const user = useUserStore(state => state.user);

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Mic size={18} />
            </div>
            <span className="font-semibold text-lg tracking-tight">InterviewAI</span>
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <button onClick={() => navigate('/login')} className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
              Log in
            </button>
            <button
              onClick={() => navigate('/register')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1 group"
            >
              Sign up
              <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 text-sm font-medium mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                Powered by Latest AI Technology
              </div>
              <h1 className="text-5xl sm:text-7xl font-semibold tracking-tight text-zinc-900 dark:text-white leading-[1.1] mb-6">
                Master your next interview with <span className="text-indigo-600 dark:text-indigo-500">real-time AI</span>
              </h1>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-10 leading-relaxed max-w-lg">
                Practice with a conversational AI interviewer that listens, responds, and adapts to your answers in real-time. Get instant feedback and land your dream job.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all active:scale-95 shadow-xl shadow-zinc-900/10 dark:shadow-white/10"
                >
                  <Play size={18} className="fill-current" />
                  Try Now For Free
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95 shadow-sm"
                >
                  Create an Account
                </button>
              </div>
            </motion.div>

            {/* Hero Visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative"
            >
              <div className="aspect-square rounded-3xl bg-gradient-to-tr from-indigo-100 to-zinc-100 dark:from-indigo-900/30 dark:to-zinc-800/30 border border-zinc-200 dark:border-zinc-800/50 shadow-2xl overflow-hidden relative flex items-center justify-center">
                <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/interview-ai/1000/1000')] opacity-10 dark:opacity-20 mix-blend-overlay bg-cover bg-center"></div>

                {/* Floating UI Elements to simulate the product */}
                <div className="relative z-10 w-full max-w-sm bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 dark:border-zinc-700/50 p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <UserCheck size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-white">AI Interviewer</h3>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Listening...
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl rounded-tl-sm p-4 text-sm text-zinc-800 dark:text-zinc-200 shadow-sm">
                      "Tell me about a time you had to overcome a significant technical challenge."
                    </div>
                    <div className="flex justify-end pt-2">
                      <div className="bg-indigo-600 dark:bg-indigo-500 text-white rounded-2xl rounded-tr-sm p-4 text-sm max-w-[85%] shadow-md">
                        <div className="flex gap-1.5 items-center h-4 px-1">
                          <div className="w-1.5 h-2 bg-white/90 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1.5 h-4 bg-white/90 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1.5 h-3 bg-white/90 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          <div className="w-1.5 h-2 bg-white/90 rounded-full animate-bounce" style={{ animationDelay: '450ms' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
