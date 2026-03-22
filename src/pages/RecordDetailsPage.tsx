import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, BarChart3, Bot, Calendar, Clock, FileText, Loader2, Sparkles, Tag, Trophy, User, Wallet } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import type { EvaluationDimensionScores, InterviewRecord, RecordTranscriptEntry, ReportStatus } from '../types/records';
import { formatLongDateTime, formatTranscriptOffset, getDisplayDuration, getTranscriptEntries, withAlpha } from '../utils/recordUtils';
import { AI_REPORT_TOKEN_COST } from '../constants/billing';

const POLL_MS = 3000;
const RADAR_SIZE = 320;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 108;
const RADAR_STEPS = [20, 40, 60, 80, 100];
const CATEGORIES: { key: keyof EvaluationDimensionScores; label: string; short: string; color: string }[] = [
  { key: 'technicalKnowledge', label: 'Technical Knowledge', short: 'Technical', color: '#6366F1' },
  { key: 'communication', label: 'Communication', short: 'Communication', color: '#06B6D4' },
  { key: 'problemSolving', label: 'Problem Solving', short: 'Problem Solving', color: '#10B981' },
  { key: 'confidence', label: 'Confidence', short: 'Confidence', color: '#F59E0B' },
  { key: 'clarity', label: 'Clarity', short: 'Clarity', color: '#EC4899' },
];

const clampPercent = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const isPending = (status?: ReportStatus | null) => status === 'pending' || status === 'processing';

const reportLabel = (status?: ReportStatus | null) => {
  if (status === 'not_requested') return 'AI report not generated';
  if (status === 'processing') return 'AI report generating';
  if (status === 'pending') return 'AI report queued';
  if (status === 'completed') return 'AI report ready';
  if (status === 'failed') return 'AI report unavailable';
  return 'AI report';
};

const scoreTone = (score?: number | null) => {
  if (typeof score !== 'number') return { text: 'text-zinc-500 dark:text-zinc-400', stroke: '#A1A1AA' };
  if (score >= 85) return { text: 'text-emerald-600 dark:text-emerald-400', stroke: '#10B981' };
  if (score >= 70) return { text: 'text-indigo-600 dark:text-indigo-400', stroke: '#6366F1' };
  return { text: 'text-amber-600 dark:text-amber-400', stroke: '#F59E0B' };
};

const statusChip = (value?: string | null) => {
  const normalized = value?.toLowerCase();
  if (normalized === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20';
  if (normalized === 'partial' || normalized === 'incomplete') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20';
  return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
};

const reportChip = (status?: ReportStatus | null) => {
  if (status === 'not_requested') return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
  if (status === 'completed') return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20';
  if (isPending(status)) return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20';
  if (status === 'failed') return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20';
  return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
};

const polar = (index: number, distance: number) => {
  const angle = (-Math.PI / 2) + (index * 2 * Math.PI / CATEGORIES.length);
  return { x: RADAR_CENTER + Math.cos(angle) * distance, y: RADAR_CENTER + Math.sin(angle) * distance };
};

const polygon = (distance: number) =>
  CATEGORIES.map((_, index) => {
    const point = polar(index, distance);
    return `${point.x},${point.y}`;
  }).join(' ');

const scorePolygon = (scores: EvaluationDimensionScores) =>
  CATEGORIES.map((category, index) => {
    const point = polar(index, (clampPercent(scores[category.key]) / 100) * RADAR_RADIUS);
    return `${point.x},${point.y}`;
  }).join(' ');

function StatCard({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/85">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
        <span className="text-indigo-500 dark:text-indigo-400">{icon}</span>
        {label}
      </div>
      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</div> : null}
    </div>
  );
}

function ScoreRing({ score }: { score: number | null }) {
  const numeric = clampPercent(score);
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - numeric / 100);
  const tone = scoreTone(score);

  return (
    <div className="relative mx-auto h-44 w-44">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={radius} fill="none" strokeWidth="12" className="text-zinc-200 dark:text-zinc-800" stroke="currentColor" />
        <circle cx="80" cy="80" r={radius} fill="none" stroke={tone.stroke} strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-5xl font-black tracking-tight ${tone.text}`}>{score == null ? '--' : score}</span>
        <span className="mt-1 text-xs font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">/ 100</span>
      </div>
    </div>
  );
}

function RadarCard({ scores }: { scores: EvaluationDimensionScores }) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Multi-Dimensional Performance</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Radar chart plus category bars for a faster read on the interview record.</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
          <BarChart3 size={20} />
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.05fr,0.95fr] xl:items-center">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="mx-auto h-[320px] w-[320px] min-w-[320px]">
            <defs>
              <linearGradient id="record-radar-fill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366F1" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.18" />
              </linearGradient>
            </defs>

            {RADAR_STEPS.map(step => (
              <polygon key={step} points={polygon((step / 100) * RADAR_RADIUS)} fill="none" stroke="currentColor" strokeWidth="1" className="text-zinc-200 dark:text-zinc-700" />
            ))}

            {CATEGORIES.map((category, index) => {
              const axis = polar(index, RADAR_RADIUS);
              const label = polar(index, RADAR_RADIUS + 28);
              return (
                <g key={category.key}>
                  <line x1={RADAR_CENTER} y1={RADAR_CENTER} x2={axis.x} y2={axis.y} stroke="currentColor" strokeWidth="1" className="text-zinc-200 dark:text-zinc-700" />
                  <circle cx={axis.x} cy={axis.y} r="4" fill={category.color} />
                  <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fill="currentColor" className="fill-zinc-600 text-[10px] font-semibold uppercase tracking-[0.16em] dark:fill-zinc-300">
                    {category.short}
                  </text>
                </g>
              );
            })}

            <polygon points={scorePolygon(scores)} fill="url(#record-radar-fill)" stroke="#6366F1" strokeWidth="3" />

            {CATEGORIES.map((category, index) => {
              const point = polar(index, (clampPercent(scores[category.key]) / 100) * RADAR_RADIUS);
              return <circle key={`${category.key}-point`} cx={point.x} cy={point.y} r="6" fill={category.color} stroke="#fff" strokeWidth="2" />;
            })}
          </svg>
        </div>

        <div className="space-y-4">
          {CATEGORIES.map(category => {
            const value = clampPercent(scores[category.key]);
            return (
              <div key={category.key} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
                <div className="mb-2 flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{category.label}</div>
                  <div className="text-sm font-bold" style={{ color: category.color }}>{value}</div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div className="h-full rounded-full" style={{ width: `${value}%`, background: `linear-gradient(90deg, ${withAlpha(category.color, 'CC')}, ${category.color})` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function InsightPanel({ title, icon, color, items }: { title: string; icon: ReactNode; color: string; items: string[] }) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-5 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl border"
          style={{ backgroundColor: withAlpha(color, '16'), borderColor: withAlpha(color, '30'), color }}
        >
          {icon}
        </div>
        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h2>
      </div>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm leading-7 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-300">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function RecordDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const token = useUserStore(state => state.token);
  const user = useUserStore(state => state.user);
  const updateBalance = useUserStore(state => state.updateBalance);
  const [record, setRecord] = useState<InterviewRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const loadRecord = async (showLoading = false) => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    if (!id) {
      setError('Record ID is missing.');
      setIsLoading(false);
      return;
    }
    if (showLoading) setIsLoading(true);

    try {
      const response = await fetch(`/api/records/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 401 || response.status === 403) {
        navigate('/login', { replace: true });
        return;
      }
      const json = await response.json();
      if (!response.ok || !json.data) {
        throw new Error(json.error || 'Unable to load interview record.');
      }
      setRecord(json.data);
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unable to load interview record.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    if (!record) return;

    setIsGeneratingReport(true);

    try {
      const response = await fetch(`/api/records/${record.id}/generate-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await response.json();
      if (!response.ok) {
        const message = json?.error || 'Unable to generate the AI evaluation report.';
        if (response.status === 402) {
          const shouldOpenPricing = window.confirm(`${message}\n\nOpen pricing so you can buy more tokens?`);
          if (shouldOpenPricing) {
            navigate('/pricing');
          }
        } else {
          alert(message);
        }
        return;
      }

      if (typeof json.balance === 'number') {
        updateBalance(json.balance);
      }

      setRecord(prev => prev ? {
        ...prev,
        aiReportStatus: json.aiReportStatus || 'pending',
        aiReport: null,
        aiReportGeneratedAt: null,
        score: null,
      } : prev);
      setIsGenerateModalOpen(false);
    } catch (requestError) {
      console.error(requestError);
      alert('Unable to generate the AI evaluation report right now.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  useEffect(() => {
    void loadRecord(true);
  }, [id, token]);

  useEffect(() => {
    if (!record || !isPending(record.aiReportStatus)) return undefined;
    const intervalId = window.setInterval(() => {
      void loadRecord();
    }, POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [id, record?.aiReportStatus, token]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Loader2 size={18} className="animate-spin" />
          Loading interview record...
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
        <div className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertCircle size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Record unavailable</h1>
          <p className="mt-3 text-sm leading-7 text-zinc-500 dark:text-zinc-400">{error || 'This interview record could not be loaded.'}</p>
          <button onClick={() => navigate('/records')} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
            <ArrowLeft size={16} />
            Back To Records
          </button>
        </div>
      </div>
    );
  }

  const transcriptEntries = getTranscriptEntries(record);
  const report = record.aiReport;
  const tone = scoreTone(record.score);
  const userTurns = transcriptEntries.filter(entry => entry.role === 'user').length;
  const aiTurns = transcriptEntries.filter(entry => entry.role === 'ai').length;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <button onClick={() => navigate('/records')} className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
            <ArrowLeft size={16} />
            Back To Records
          </button>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500">Interview Analytics</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <section className="relative overflow-hidden rounded-[32px] border border-zinc-200 bg-gradient-to-br from-white via-indigo-50/70 to-cyan-50/60 p-8 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:via-indigo-500/10 dark:to-cyan-500/10">
          <div className="relative grid gap-8 xl:grid-cols-[1.15fr,0.85fr]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusChip(record.status)}`}>{record.status}</span>
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${reportChip(record.aiReportStatus)}`}>{reportLabel(record.aiReportStatus)}</span>
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight text-zinc-950 dark:text-white">{record.name}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                {report?.summary || 'This saved interview contains the transcript, real duration, and the AI evaluation for the session.'}
              </p>

              <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={<Calendar size={14} />} label="Started" value={formatLongDateTime(record.startedAt || record.createdAt)} />
                <StatCard icon={<Clock size={14} />} label="Duration" value={getDisplayDuration(record)} hint={`${transcriptEntries.length} transcript turns`} />
                <StatCard icon={<User size={14} />} label="Role Focus" value={record.role || 'General interview'} hint={`${userTurns} candidate turns / ${aiTurns} interviewer turns`} />
                <StatCard icon={<Calendar size={14} />} label="Ended" value={formatLongDateTime(record.endedAt || record.createdAt)} />
              </div>

              {record.tags.length > 0 ? (
                <div className="mt-7 flex flex-wrap gap-2">
                  {record.tags.map(tag => (
                    <span
                      key={`${record.id}-${tag.label}`}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                      style={{ backgroundColor: withAlpha(tag.color, '16'), borderColor: withAlpha(tag.color, '36'), color: tag.color }}
                    >
                      <Tag size={12} />
                      {tag.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <aside className="rounded-[28px] border border-white/70 bg-white/75 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/85">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">Overall Score</div>
                  <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Generated from the transcript and saved interview record.</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-zinc-700 shadow-sm dark:bg-zinc-950 dark:text-zinc-200">
                  <Trophy size={20} />
                </div>
              </div>

              <ScoreRing score={record.score} />

              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3 text-center dark:border-zinc-800 dark:bg-zinc-950/70">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Candidate</div>
                  <div className="mt-2 text-xl font-black text-zinc-900 dark:text-zinc-100">{userTurns}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3 text-center dark:border-zinc-800 dark:bg-zinc-950/70">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Interviewer</div>
                  <div className="mt-2 text-xl font-black text-zinc-900 dark:text-zinc-100">{aiTurns}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3 text-center dark:border-zinc-800 dark:bg-zinc-950/70">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Report</div>
                  <div className={`mt-2 text-sm font-black uppercase tracking-[0.18em] ${tone.text}`}>{record.score == null ? reportLabel(record.aiReportStatus) : `${record.score}/100`}</div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {record.aiReportStatus === 'not_requested' || (record.aiReportStatus === 'failed' && !report) ? (
          <section className="grid gap-6 xl:grid-cols-[1fr,0.95fr]">
            <div className="rounded-3xl border border-indigo-200 bg-white p-8 shadow-sm dark:border-indigo-500/20 dark:bg-zinc-900">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {record.aiReportStatus === 'failed' ? 'AI evaluation report failed' : 'Generate the AI evaluation report when you need it'}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                    {record.aiReportStatus === 'failed'
                      ? 'The last report attempt did not complete successfully. You can retry when you are ready.'
                      : 'This record has been saved without spending extra tokens on analysis. Generate the report only when you want the full score, charts, and AI feedback.'}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={() => setIsGenerateModalOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
                    >
                      <Sparkles size={16} />
                      {record.aiReportStatus === 'failed' ? 'Retry AI Report' : 'Generate AI Report'}
                    </button>
                    <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                      <Wallet size={16} />
                      Costs {AI_REPORT_TOKEN_COST} tokens
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <Wallet size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Token confirmation</h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    The AI report is not automatic anymore. It starts only after you confirm the token spend.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Current balance</div>
                  <div className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-100">{user?.balance ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Generation cost</div>
                  <div className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400">{AI_REPORT_TOKEN_COST}</div>
                </div>
              </div>
            </div>
          </section>
        ) : isPending(record.aiReportStatus) ? (
          <section className="grid gap-6 xl:grid-cols-[1fr,0.95fr]">
            <div className="rounded-3xl border border-sky-200 bg-white p-8 shadow-sm dark:border-sky-500/20 dark:bg-zinc-900">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                  <Loader2 size={24} className="animate-spin" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">AI evaluation report is being generated...</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                    The transcript and timing data are already saved. This page will refresh automatically when the report and score are ready.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Report placeholders</h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">These panels populate automatically after the AI evaluation finishes.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {['Radar chart', 'Category scores', 'Round analysis', 'Actionable feedback'].map(item => (
                  <div key={item} className="rounded-2xl border border-dashed border-zinc-300 px-4 py-5 text-sm font-semibold text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : report ? (
          <>
            <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
              <RadarCard scores={report.categoryScores} />
              <div className="grid gap-6">
                <InsightPanel title="Top Strengths" icon={<Sparkles size={18} />} color="#10B981" items={report.strengths} />
                <InsightPanel title="Improvement Areas" icon={<AlertCircle size={18} />} color="#F59E0B" items={report.improvementAreas} />
                <InsightPanel title="Action Plan" icon={<Trophy size={18} />} color="#6366F1" items={report.actionItems} />
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
              <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Round-By-Round Evaluation</h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">AI review of the strongest and weakest moments in the interview flow.</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                    <BarChart3 size={20} />
                  </div>
                </div>

                <div className="space-y-4">
                  {report.roundBreakdown.map((round, index) => (
                    <article key={`${round.title}-${index}`} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">Round {index + 1}</div>
                          <div className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-100">{round.title}</div>
                        </div>
                        <div className={`text-2xl font-black ${scoreTone(round.score).text}`}>{round.score}</div>
                      </div>
                      <div className="mb-3 h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400" style={{ width: `${clampPercent(round.score)}%` }} />
                      </div>
                      <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">{round.feedback}</p>
                    </article>
                  ))}
                </div>
              </section>

              <InsightPanel title="Notable Moments" icon={<Sparkles size={18} />} color="#EC4899" items={report.notableMoments} />
            </section>
          </>
        ) : (
          <section className="rounded-3xl border border-rose-200 bg-white p-8 shadow-sm dark:border-rose-500/20 dark:bg-zinc-900">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                <AlertCircle size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">AI evaluation report unavailable</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  The interview record is saved, but the evaluation report could not be generated. You can still review the transcript below.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <FileText size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Full Conversation Transcript</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Every finalized line from your speech transcription and the interviewer audio.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-6">
            {transcriptEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 px-5 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                No transcript has been saved for this interview yet.
              </div>
            ) : (
              transcriptEntries.map((entry: RecordTranscriptEntry, index) => {
                const isUser = entry.role === 'user';
                const label = isUser ? 'Your transcript' : 'AI interviewer';
                const timeLabel = formatTranscriptOffset(entry.time);

                return (
                  <div key={`${entry.role}-${index}-${entry.text.slice(0, 24)}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <article className={`w-full max-w-3xl rounded-[28px] border px-5 py-4 shadow-sm ${isUser ? 'border-indigo-500/20 bg-indigo-600 text-white' : 'border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100'}`}>
                      <div className={`mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] ${isUser ? 'text-indigo-100/85' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        <span className="flex items-center gap-1.5">
                          {isUser ? <User size={14} /> : <Bot size={14} />}
                          {label}
                        </span>
                        <span className={isUser ? 'text-indigo-200/80' : 'text-zinc-400 dark:text-zinc-500'}>Turn {index + 1}</span>
                        {timeLabel ? <span className={isUser ? 'text-indigo-200/80' : 'text-zinc-400 dark:text-zinc-500'}>{timeLabel}</span> : null}
                      </div>
                      <p className={`text-sm leading-7 ${isUser ? 'text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>{entry.text}</p>
                    </article>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      {isGenerateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 px-4 backdrop-blur-sm dark:bg-black/60">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Generate AI Evaluation Report</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">This action spends tokens before report generation begins.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Current balance</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{user?.balance ?? 0} tokens</span>
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Report generation cost</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{AI_REPORT_TOKEN_COST} tokens</span>
                </div>
              </div>
            </div>

            <p className="mt-5 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Once confirmed, the report request starts immediately and the page will switch into a loading state until the score and charts are ready.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                disabled={isGeneratingReport}
                className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
                className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                {isGeneratingReport ? 'Generating...' : `Confirm & Spend ${AI_REPORT_TOKEN_COST}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
