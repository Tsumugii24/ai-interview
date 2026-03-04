import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mic, Play, Settings, UserCheck } from 'lucide-react';
import SettingsModal from '../components/SettingsModal';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-zinc-200 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Mic size={18} />
            </div>
            <span className="font-semibold text-lg tracking-tight">InterviewAI</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600">
            <a href="#features" className="hover:text-zinc-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-zinc-900 transition-colors">How it works</a>
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                Powered by Gemini 2.5 Live
              </div>
              <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight text-zinc-900 leading-[1.1] mb-6">
                Master your next interview with <span className="text-indigo-600">real-time AI</span>.
              </h1>
              <p className="text-lg text-zinc-600 mb-10 leading-relaxed">
                Practice with a conversational AI interviewer that listens, responds, and adapts to your answers in real-time. Get instant feedback and build confidence.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => navigate('/simulation')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition-all active:scale-95 shadow-sm"
                >
                  <Play size={18} />
                  Start Mock Interview
                </button>
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white border border-zinc-200 text-zinc-900 font-medium hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
                >
                  <Settings size={18} />
                  Configure Settings
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
              <div className="aspect-square rounded-3xl bg-gradient-to-tr from-indigo-100 to-zinc-100 border border-zinc-200/50 shadow-2xl overflow-hidden relative flex items-center justify-center">
                 <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/workspace/1000/1000')] opacity-20 mix-blend-overlay bg-cover bg-center"></div>
                 
                 {/* Floating UI Elements to simulate the product */}
                 <div className="relative z-10 w-full max-w-sm bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <UserCheck size={24} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-zinc-900">AI Interviewer</h3>
                        <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Listening...
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="bg-zinc-100 rounded-2xl rounded-tl-none p-4 text-sm text-zinc-700">
                        "Tell me about a time you had to overcome a significant technical challenge."
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-none p-4 text-sm max-w-[85%]">
                          <div className="flex gap-1 items-center h-4">
                            <div className="w-1 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1 h-4 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1 h-3 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            <div className="w-1 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '450ms' }}></div>
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

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
}
