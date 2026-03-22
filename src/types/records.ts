export type RecordTag = {
  label: string;
  color: string;
};

export type RecordSpeakerRole = 'user' | 'ai';

export type RecordTranscriptEntry = {
  role: RecordSpeakerRole;
  text: string;
  time?: number;
};

export type EvaluationDimensionScores = {
  technicalKnowledge: number;
  communication: number;
  problemSolving: number;
  confidence: number;
  clarity: number;
};

export type EvaluationRoundBreakdown = {
  title: string;
  score: number;
  feedback: string;
};

export type EvaluationReport = {
  summary: string;
  strengths: string[];
  improvementAreas: string[];
  actionItems: string[];
  categoryScores: EvaluationDimensionScores;
  roundBreakdown: EvaluationRoundBreakdown[];
  notableMoments: string[];
};

export type ReportStatus = 'not_requested' | 'pending' | 'processing' | 'completed' | 'failed';

export type InterviewRecord = {
  id: number;
  name: string;
  role: string | null;
  duration: string | null;
  elapsedSeconds: number | null;
  score: number | null;
  status: string;
  transcript: string;
  transcriptEntries: RecordTranscriptEntry[];
  tags: RecordTag[];
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  aiReportStatus: ReportStatus;
  aiReport: EvaluationReport | null;
  aiReportGeneratedAt: string | null;
};
