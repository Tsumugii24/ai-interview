import type { InterviewRecord, RecordTag, RecordTranscriptEntry } from '../types/records';

export const DEFAULT_TAG_COLORS = [
  '#6366F1',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#06B6D4',
  '#8B5CF6',
  '#EF4444',
];

export const DEFAULT_TAG_COLOR = DEFAULT_TAG_COLORS[0];

export const normalizeHexColor = (color?: string | null) => {
  if (!color) return DEFAULT_TAG_COLOR;
  const trimmed = color.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed : DEFAULT_TAG_COLOR;
};

export const withAlpha = (color: string, alphaHex: string) =>
  `${normalizeHexColor(color)}${alphaHex}`;

export const formatElapsedDuration = (
  elapsedSeconds?: number | null,
  fallback?: string | null
) => {
  if (typeof elapsedSeconds === 'number' && Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0) {
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = Math.floor(elapsedSeconds % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return fallback || '0h 0m 0s';
};

export const getPreciseElapsedSeconds = (
  value: Pick<InterviewRecord, 'elapsedSeconds' | 'startedAt' | 'endedAt'>
) => {
  if (
    typeof value.elapsedSeconds === 'number'
    && Number.isFinite(value.elapsedSeconds)
    && value.elapsedSeconds >= 0
  ) {
    return Math.round(value.elapsedSeconds);
  }

  if (!value.startedAt || !value.endedAt) {
    return null;
  }

  const startedAt = new Date(value.startedAt);
  const endedAt = new Date(value.endedAt);
  const startedMs = startedAt.getTime();
  const endedMs = endedAt.getTime();

  if (!Number.isFinite(startedMs) || !Number.isFinite(endedMs) || endedMs < startedMs) {
    return null;
  }

  return Math.round((endedMs - startedMs) / 1000);
};

export const formatTimestampToSecond = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const formatLongDateTime = (value?: string | null) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatTranscriptOffset = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;

  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`;
  }

  return `${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`;
};

export const normalizeTags = (tags: unknown): RecordTag[] => {
  if (!Array.isArray(tags)) return [];

  return tags
    .map((tag, index) => {
      if (typeof tag === 'string') {
        return {
          label: tag,
          color: DEFAULT_TAG_COLORS[index % DEFAULT_TAG_COLORS.length],
        };
      }

      if (tag && typeof tag === 'object') {
        const candidate = tag as Partial<RecordTag>;
        if (!candidate.label || typeof candidate.label !== 'string') return null;
        return {
          label: candidate.label.trim(),
          color: normalizeHexColor(candidate.color),
        };
      }

      return null;
    })
    .filter((tag): tag is RecordTag => Boolean(tag?.label));
};

export const getDisplayDuration = (
  record: Pick<InterviewRecord, 'elapsedSeconds' | 'startedAt' | 'endedAt'>
) => {
  const elapsedSeconds = getPreciseElapsedSeconds(record);
  return elapsedSeconds == null ? 'N/A' : formatElapsedDuration(elapsedSeconds);
};

export const getTranscriptEntries = (
  record: Pick<InterviewRecord, 'transcriptEntries' | 'transcript'>
): RecordTranscriptEntry[] => {
  if (record.transcriptEntries.length > 0) {
    return record.transcriptEntries;
  }

  return record.transcript
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line): RecordTranscriptEntry | null => {
      const userMatch = line.match(/^(?:you|candidate)\s*:\s*(.+)$/i);
      if (userMatch) {
        return { role: 'user', text: userMatch[1].trim() };
      }

      const aiMatch = line.match(/^(?:ai interviewer|interviewer|ai)\s*:\s*(.+)$/i);
      if (aiMatch) {
        return { role: 'ai', text: aiMatch[1].trim() };
      }

      return { role: 'ai', text: line };
    })
    .filter((entry): entry is RecordTranscriptEntry => Boolean(entry?.text));
};
