export type StageMonitorSpeakerRole = 'user' | 'ai';

export type StageMonitorTranscriptEntry = {
  role: StageMonitorSpeakerRole;
  text: string;
  time?: number;
};

export type StageMonitorInput = {
  currentStage: number;
  transcript: StageMonitorTranscriptEntry[];
  latestUserUtterance: string;
  latestAiUtterance: string;
  isInterviewComplete: boolean;
};

export type StageMonitorResult = {
  shouldAdvance: boolean;
  nextStage: 1 | 2 | 3 | 4;
  isInterviewComplete: boolean;
  reason: string;
};

const STAGE_CUE_PATTERNS = [
  /\bnext stage\b/i,
  /\bmove (?:on|forward)\b/i,
  /\bmove to the next\b/i,
  /\blet'?s begin\b/i,
  /\blast question\b/i,
  /\bfinal question\b/i,
  /\bwrap (?:up|this up)\b/i,
  /\bbefore we finish\b/i,
  /\bconclude\b/i,
  /\bsummary feedback\b/i,
];

const clampStage = (value: number): 1 | 2 | 3 | 4 => {
  if (value <= 1) return 1;
  if (value >= 4) return 4;
  return value as 1 | 2 | 3 | 4;
};

const extractJsonObject = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('No JSON object found in stage monitor response.');
  }

  return match[0];
};

export const hasStageCue = (texts: string[]) =>
  texts.some(text => STAGE_CUE_PATTERNS.some(pattern => pattern.test(text)));

export const buildStageMonitorPrompt = (input: StageMonitorInput) => {
  const transcriptText = input.transcript.length
    ? input.transcript
      .map((entry, index) => `${index + 1}. ${entry.role === 'user' ? 'Candidate' : 'Interviewer'}: ${entry.text}`)
      .join('\n')
    : '(no finalized transcript yet)';

  return `You are a strict stage monitor for a live mock interview UI.

Decide whether the UI should advance exactly one stage, stay on the current stage, or mark the interview complete.

Return JSON only in this exact shape:
{"shouldAdvance":boolean,"nextStage":1|2|3|4,"isInterviewComplete":boolean,"reason":"short explanation"}

Rules:
- Never move backward.
- Advance at most one stage from the current stage.
- If the current stage is 4, do not advance further.
- Only set "isInterviewComplete" to true when the current stage is 4 and the wrap-up is clearly finished.
- Do not mark the interview complete just because the interviewer says they are about to wrap up.
- Ignore hidden/internal narration and judge the actual conversational content.
- If there is any ambiguity, stay on the current stage.

Stage readiness criteria:
- Stage 1 -> 2 only when interview preferences have been collected and clearly confirmed.
- Stage 2 -> 3 only when the candidate has finished their self-introduction and any brief follow-up has concluded.
- Stage 3 -> 4 only when the requested number of interview questions has actually been asked, answered, and evaluated.
- Stage 4 -> complete only when the interviewer has finished the final assessment, improvement advice, actionable next steps, and closing.

Current stage: ${input.currentStage}
Interview already complete: ${input.isInterviewComplete}
Latest finalized candidate utterance: ${input.latestUserUtterance || '(none)'}
Latest finalized interviewer utterance: ${input.latestAiUtterance || '(none)'}

Finalized transcript:
${transcriptText}`;
};

export const parseStageMonitorResult = (
  raw: string,
  input: StageMonitorInput
): StageMonitorResult => {
  const parsed = JSON.parse(extractJsonObject(raw)) as Partial<StageMonitorResult>;
  const currentStage = clampStage(input.currentStage);
  const requestedNextStage = clampStage(Number(parsed.nextStage ?? currentStage));
  const nextStage = clampStage(
    Math.max(currentStage, Math.min(requestedNextStage, currentStage + 1))
  );

  let shouldAdvance = Boolean(parsed.shouldAdvance) && nextStage > currentStage;
  let isInterviewComplete = Boolean(parsed.isInterviewComplete);

  if (currentStage < 4) {
    isInterviewComplete = false;
  }

  if (currentStage >= 4) {
    shouldAdvance = false;
  }

  return {
    shouldAdvance,
    nextStage: currentStage >= 4 ? 4 : nextStage,
    isInterviewComplete,
    reason: typeof parsed.reason === 'string' && parsed.reason.trim()
      ? parsed.reason.trim()
      : 'No reason provided by stage monitor.',
  };
};
