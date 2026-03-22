import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, Clock, CreditCard, FileText, Info, Loader2, LogOut, Mic, Play, Settings, XCircle } from 'lucide-react';
import SettingsModal from '../components/SettingsModal';
import { useUserStore } from '../store/userStore';
import type { InterviewRecord } from '../types/records';
import { formatLongDateTime, getDisplayDuration } from '../utils/recordUtils';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const user = useUserStore(state => state.user);
  const logout = useUserStore(state => state.logout);
  const [records, setRecords] = useState<InterviewRecord[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    const token = useUserStore.getState().token;
    fetch('/api/records', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(json => {
        if (json.data) setRecords(json.data);
      })
      .catch(err => console.error(err));
  }, [user, navigate]);

  if (!user) return null;

  const maxTokens = user.plan === 'Plus'
    ? 500
    : user.plan === 'Pro'
      ? 2000
      : user.plan === 'Enterprise'
        ? 'Unlimited'
        : 50;

  const recentRecords = records.slice(0, 5);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300 pb-20">
      <header className="fixed top-0 w-full bg-white dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Mic size={18} />
            </div>
            <span className="font-semibold text-lg tracking-tight">InterviewAI</span>
          </div>

          <nav className="flex items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-full p-1 border border-zinc-200 dark:border-zinc-800 hidden sm:flex">
                <span className="text-zinc-900 dark:text-white font-bold bg-white dark:bg-zinc-900 px-3 py-1 rounded-full shadow-sm text-[11px] uppercase tracking-wider flex items-center h-full">
                  {user.plan || 'Free'}
                </span>
                <div className="flex items-center px-3 justify-center text-sm gap-1.5">
                  <span className="text-zinc-800 dark:text-zinc-100 font-bold leading-tight">
                    {user.balance} <span className="text-zinc-500 dark:text-zinc-400 font-medium text-xs">Tokens</span>
                  </span>
                  <div className="relative group flex items-center">
                    <Info size={15} className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-300 cursor-help transition-colors" />
                    <div className="absolute top-full right-0 mt-2 w-52 bg-zinc-900 text-white rounded-xl p-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 pointer-events-none origin-top-right transform group-hover:scale-100 scale-95 border border-zinc-800">
                      <div className="text-[11px] mb-1 font-semibold text-emerald-400 uppercase tracking-wider">Monthly Quota</div>
                      <div className="text-sm font-medium mb-2 pb-2 border-b border-zinc-700">
                        {user.balance} / {maxTokens}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Next Refresh:</div>
                      <div className="text-sm font-medium text-zinc-100 mt-0.5">
                        {user.nextRefresh ? new Date(user.nextRefresh).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate('/pricing')}
                className="hidden sm:flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium transition-colors"
              >
                <CreditCard size={16} /> Upgrade
              </button>

              <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1 hidden sm:block" />

              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-1.5 rounded-lg transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-500 flex items-center justify-center text-white font-bold shadow-sm group-hover:shadow transition-all">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-zinc-700 dark:text-zinc-200 font-medium hidden sm:block">{user.username}</span>
              </button>

              <button
                onClick={() => { logout(); navigate('/'); }}
                className="hover:text-red-600 text-zinc-500 dark:text-zinc-400 transition-colors p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <LogOut size={16} />
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="pt-28 px-6 max-w-7xl mx-auto space-y-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back, {user.username}</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Track your progress and start your next AI interview session.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 dark:bg-indigo-500/10 rounded-full opacity-50 group-hover:scale-110 transition-transform blur-xl" />
            <div className="flex items-start justify-between mb-6 relative z-10">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Play fill="currentColor" size={20} />
              </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all border border-transparent hover:border-indigo-100 dark:hover:border-indigo-500/20 shadow-sm"
                title="Device Settings"
              >
                <Settings size={16} />
              </button>
            </div>
            <h3 className="text-lg font-bold mb-2 relative z-10">Start Interview</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 relative z-10">Jump into a new interview session and remember to check device settings before starting.</p>
            <button
              onClick={() => navigate('/simulation')}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 relative z-10"
            >
              Start New Interview
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6">
              <FileText size={22} />
            </div>
            <h3 className="text-lg font-bold mb-2">My Resume</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Keep your resume up to date to get personalized interview questions.</p>
            <button
              onClick={() => navigate('/resume')}
              className="w-full py-3 px-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm font-semibold transition-all hover:shadow-sm"
            >
              Edit Resume
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 mb-6">
              <Archive size={22} />
            </div>
            <h3 className="text-lg font-bold mb-2">Saved Records</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Review your past performance, analyze answers, and track progress.</p>
            <button
              onClick={() => navigate('/records')}
              className="w-full py-3 px-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm font-semibold transition-all hover:shadow-sm"
            >
              View Records
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold tracking-tight">Recent Interviews</h2>
            <button onClick={() => navigate('/records')} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">View All</button>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
            {recentRecords.length > 0 ? (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {recentRecords.map(interview => (
                  <div key={interview.id} className="p-5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0">
                        <Clock size={18} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{interview.name}</h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium flex-wrap">
                          <span>{formatLongDateTime(interview.startedAt || interview.createdAt)}</span>
                          <span>|</span>
                          <span>{getDisplayDuration(interview)}</span>
                          {interview.role ? (
                            <>
                              <span>|</span>
                              <span>{interview.role}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {interview.status === 'Completed' ? (
                        <div className="hidden sm:flex flex-col items-end">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">
                            {interview.score != null ? 'Score' : 'AI Report'}
                          </span>
                          {interview.score != null ? (
                            <span className={`text-sm font-bold ${interview.score >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                              {interview.score}/100
                            </span>
                          ) : interview.aiReportStatus === 'not_requested' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                              On demand
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
                              {interview.aiReportStatus === 'failed' ? null : <Loader2 size={12} className="animate-spin" />}
                              {interview.aiReportStatus === 'failed' ? 'Retry needed' : 'Generating'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-md">
                          <XCircle size={12} />
                          Incomplete
                        </div>
                      )}

                      <button
                        onClick={() => navigate(`/records/${interview.id}`)}
                        className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center text-zinc-500 dark:text-zinc-400">
                <p>No past interviews found.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
