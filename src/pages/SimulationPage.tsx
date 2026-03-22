import { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, PhoneOff, User, Bot, Loader2, VideoOff, Video, MessageSquare, Send, X, ArrowLeft, ChevronLeft, ChevronRight, Globe, ShieldAlert, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettingsStore } from '../store/settingsStore';
import { useInterviewStore } from '../store/interviewStore';
import { useUserStore } from '../store/userStore';
import StageProgressBar from '../components/StageProgressBar';
import SettingsModal from '../components/SettingsModal';
import interviewMasterPrompt from '../prompts/interview-master.md?raw';
import { formatElapsedDuration, formatTimestampToSecond } from '../utils/recordUtils';
import { SIMULATION_SESSION_TOKEN_COST } from '../constants/billing';
import {
  buildStageMonitorPrompt,
  hasStageCue,
  parseStageMonitorResult,
  type StageMonitorInput,
} from '../utils/stageMonitor';

type SpeakerRole = 'user' | 'ai';

type TranscriptEntry = {
  role: SpeakerRole;
  text: string;
  time?: number;
};

type SubtitleStreamState = {
  buffer: string;
  committedSentenceCount: number;
  lastEventText: string;
};

const MAX_VISIBLE_SUBTITLE_LINES = 2;
const USER_SUBTITLE_SETTLE_MS = 2400;
const AI_SUBTITLE_SETTLE_MS = 2200;
const STAGE_MONITOR_DEBOUNCE_MS = 1500;
const STAGE_MONITOR_CUE_DEBOUNCE_MS = 200;
const STAGE_MONITOR_INTERVAL_MS = 30000;
const STAGE_MONITOR_INTERVAL_COOLDOWN_MS = 15000;
const CHAT_SIDEBAR_WIDTH = 360;
const CHAT_TOGGLE_WIDTH = 44;
const CHAT_LAYOUT_GAP = 20;

const createSubtitleStreamState = (): SubtitleStreamState => ({
  buffer: '',
  committedSentenceCount: 0,
  lastEventText: '',
});

const normalizeSubtitleText = (text: string) =>
  text.replace(/\s+/g, ' ').trim();

const joinSubtitleFragments = (base: string, addition: string) => {
  if (!base) return addition;
  if (!addition) return base;
  if (/^[,.;:!?)}\]'"%\u3001\u3002\uFF0C\uFF1B\uFF1A\uFF01\uFF1F]/.test(addition)) {
    return `${base}${addition}`;
  }
  if (/[('"\[\u201C]$/.test(base)) {
    return `${base}${addition}`;
  }
  return `${base} ${addition}`;
};

const getSharedPrefixLength = (left: string, right: string) => {
  const maxLength = Math.min(left.length, right.length);
  let length = 0;

  while (length < maxLength && left[length] === right[length]) {
    length += 1;
  }

  return length;
};

const getOverlapLength = (left: string, right: string) => {
  const maxLength = Math.min(left.length, right.length);

  for (let length = maxLength; length > 0; length -= 1) {
    if (left.slice(-length) === right.slice(0, length)) {
      return length;
    }
  }

  return 0;
};

const mergeStreamingCaptionText = (
  currentBuffer: string,
  incomingText: string,
  lastEventText: string
) => {
  const current = normalizeSubtitleText(currentBuffer);
  const incoming = normalizeSubtitleText(incomingText);
  const previousEvent = normalizeSubtitleText(lastEventText);

  if (!incoming) return current;
  if (!current) return incoming;
  if (incoming === current || incoming === previousEvent || current.endsWith(incoming)) {
    return current;
  }
  if (incoming.startsWith(current) || incoming.endsWith(current)) {
    return incoming;
  }
  if (previousEvent && incoming.startsWith(previousEvent) && current.endsWith(previousEvent)) {
    return normalizeSubtitleText(`${current}${incoming.slice(previousEvent.length)}`);
  }

  const sharedPrefixLength = getSharedPrefixLength(current.toLowerCase(), incoming.toLowerCase());
  if (sharedPrefixLength >= 4 && sharedPrefixLength >= Math.floor(Math.min(current.length, incoming.length) * 0.6)) {
    return incoming;
  }

  const overlapLength = getOverlapLength(current.toLowerCase(), incoming.toLowerCase());
  if (overlapLength > 0) {
    return normalizeSubtitleText(`${current}${incoming.slice(overlapLength)}`);
  }

  return joinSubtitleFragments(current, incoming);
};

const extractSentenceUnits = (text: string) => {
  const sentences: string[] = [];
  let remainder = normalizeSubtitleText(text);

  while (remainder) {
    const match = remainder.match(/^([\s\S]+?[.!?\u3002\uFF01\uFF1F]+(?:["')\]]+)?)(\s+[\s\S]*|$)/);
    if (!match) break;

    const sentence = normalizeSubtitleText(match[1]);
    if (!sentence) break;

    sentences.push(sentence);
    remainder = normalizeSubtitleText(match[2] ?? '');
  }

  return { sentences, remainder };
};

const getVisibleSubtitleLines = (buffer: string) => {
  const { sentences, remainder } = extractSentenceUnits(buffer);
  const lines = remainder
    ? [...sentences.slice(-(MAX_VISIBLE_SUBTITLE_LINES - 1)), remainder]
    : sentences.slice(-MAX_VISIBLE_SUBTITLE_LINES);

  return lines.filter(Boolean);
};

export default function SimulationPage() {
  const navigate = useNavigate();
  const user = useUserStore(state => state.user);
  const {
    llmModel,
    audioModel,
    microphoneId,
    speakerId,
    systemInstruction,
    transitionMonitoringMode,
  } = useSettingsStore();
  const {
    currentStage,
    isInterviewComplete,
    advanceStage,
    completeInterview,
    resetInterview,
  } = useInterviewStore();

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isEvaluatingStage, setIsEvaluatingStage] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [userVolume, setUserVolume] = useState(0);
  const [aiVolume, setAiVolume] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userSubtitleLines, setUserSubtitleLines] = useState<string[]>([]);
  const [aiSubtitleLines, setAiSubtitleLines] = useState<string[]>([]);
  const [, setUserSubtitle] = useState('');
  const [, setAiSubtitle] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [regionBlocked, setRegionBlocked] = useState(false);
  const [regionCheckDone, setRegionCheckDone] = useState(false);

  // Leave & Save Record Modals state
  const [isJoinBillingOpen, setIsJoinBillingOpen] = useState(false);
  const [isConfirmEndOpen, setIsConfirmEndOpen] = useState(false);
  const [isCompletionOpen, setIsCompletionOpen] = useState(false);
  const [isSaveRecordOpen, setIsSaveRecordOpen] = useState(false);
  const [recordName, setRecordName] = useState('');
  const [isSavingRecord, setIsSavingRecord] = useState(false);

  const aiRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<any>(null);
  const sessionOpenRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef(0);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  const userVideoRef = useRef<HTMLVideoElement>(null);
  const userAnalyserRef = useRef<AnalyserNode | null>(null);
  const aiAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const userSubtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiSubtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monitorDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monitorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const monitorInFlightRef = useRef(false);
  const monitorQueuedRef = useRef(false);
  const monitorDirtyRef = useRef(false);
  const lastMonitorCompletedAtRef = useRef(0);
  const activeSessionIdRef = useRef(0);
  const sessionSequenceRef = useRef(0);
  const userSubtitleStreamRef = useRef<SubtitleStreamState>(createSubtitleStreamState());
  const aiSubtitleStreamRef = useRef<SubtitleStreamState>(createSubtitleStreamState());
  const aiTranscriptDraftRef = useRef('');
  const lastUserTextRef = useRef('');
  const aiSubtitleBufferRef = useRef('');
  const stageAdvanceRequestedRef = useRef(false);
  const latestFinalizedUserUtteranceRef = useRef('');
  const latestFinalizedAiUtteranceRef = useRef('');
  const currentStageRef = useRef(currentStage);
  const isInterviewCompleteRef = useRef(isInterviewComplete);
  const isConnectedRef = useRef(isConnected);
  const completionHandledRef = useRef(false);
  const interviewStartedAtRef = useRef<Date | null>(null);
  const interviewEndedAtRef = useRef<Date | null>(null);
  // Ref to track mute state reliably inside closures (avoids stale closure)
  const isMutedRef = useRef(false);
  const isTransitioningRef = useRef(false);

  // Accumulate conversation history for transcript export
  const conversationHistoryRef = useRef<string>('');

  useEffect(() => {
    aiRef.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Request microphone access by default, not camera
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: { deviceId: microphoneId && microphoneId !== 'default' ? { exact: microphoneId } : undefined } })
        .then(stream => {
          mediaStreamRef.current = stream;
        })
        .catch(err => console.warn('Microphone access denied:', err));
    } else {
      console.warn('MediaDevices API not available.');
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Pre-check IP region
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        const blockedCountries = ['CN', 'IR', 'KP', 'CU', 'SY', 'RU'];
        if (data?.country_code && blockedCountries.includes(data.country_code)) {
          setRegionBlocked(true);
        }
      })
      .catch(() => { /* If geo-IP fails, let them try anyway */ })
      .finally(() => setRegionCheckDone(true));

    return () => {
      clearInterval(timer);
      clearStageMonitorTimers();
      disconnectSession();
      resetInterviewLifecycleState();
      if (userSubtitleTimerRef.current) clearTimeout(userSubtitleTimerRef.current);
      if (aiSubtitleTimerRef.current) clearTimeout(aiSubtitleTimerRef.current);
      if (userVideoRef.current?.srcObject) {
        (userVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, isChatOpen]);

  useEffect(() => {
    currentStageRef.current = currentStage;
  }, [currentStage]);

  useEffect(() => {
    isInterviewCompleteRef.current = isInterviewComplete;
  }, [isInterviewComplete]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const usesActiveTransitionSignals = transitionMonitoringMode !== 'passive';
  const usesIntervalMonitoring = transitionMonitoringMode !== 'active';

  useEffect(() => {
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }

    if (!isConnected || !usesIntervalMonitoring) return;

    monitorIntervalRef.current = setInterval(() => {
      if (!monitorDirtyRef.current || monitorInFlightRef.current) return;
      if (Date.now() - lastMonitorCompletedAtRef.current < STAGE_MONITOR_INTERVAL_COOLDOWN_MS) return;
      scheduleStageMonitorEvaluation('interval', 0);
    }, STAGE_MONITOR_INTERVAL_MS);

    return () => {
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
        monitorIntervalRef.current = null;
      }
    };
  }, [isConnected, usesIntervalMonitoring]);

  useEffect(() => {
    const shouldWarnOnUnload =
      isConnected ||
      isConnecting ||
      isConfirmEndOpen ||
      isCompletionOpen ||
      isSaveRecordOpen ||
      transcript.length > 0;

    if (!shouldWarnOnUnload) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isConnected, isConnecting, isConfirmEndOpen, isCompletionOpen, isSaveRecordOpen, transcript.length]);

  useEffect(() => {
    if (!isInterviewComplete || completionHandledRef.current) return;

    completionHandledRef.current = true;
    disconnect();
    setIsConfirmEndOpen(false);
    setRecordName(buildDefaultRecordName());
    setIsCompletionOpen(true);
  }, [isInterviewComplete]);

  // Keep visualizers running independently of connection state for local mic feedback
  useEffect(() => {
    if (!audioContextRef.current) return;

    const updateVolumes = () => {
      // User Volume (Local)
      if (userAnalyserRef.current && !isMuted) {
        const dataArray = new Uint8Array(userAnalyserRef.current.frequencyBinCount);
        userAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        setUserVolume(sum / dataArray.length);
      } else {
        setUserVolume(0);
      }

      // AI Volume (Remote)
      if (aiAnalyserRef.current && isConnected) {
        const dataArray = new Uint8Array(aiAnalyserRef.current.frequencyBinCount);
        aiAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        setAiVolume(sum / dataArray.length);
      } else {
        setAiVolume(0);
      }

      animationFrameRef.current = requestAnimationFrame(updateVolumes);
    };

    updateVolumes();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isMuted, isConnected]);

  const buildSystemInstruction = (): string => {
    const trimmedInstruction = systemInstruction.trim();
    return trimmedInstruction
      ? `${trimmedInstruction}\n\n${interviewMasterPrompt}`
      : interviewMasterPrompt;
  };

  const resetInterviewLifecycleState = () => {
    resetInterview();
    completionHandledRef.current = false;
    stageAdvanceRequestedRef.current = false;
    currentStageRef.current = 1;
    isInterviewCompleteRef.current = false;
    interviewStartedAtRef.current = null;
    interviewEndedAtRef.current = null;
    transcriptRef.current = [];
    conversationHistoryRef.current = '';
    latestFinalizedUserUtteranceRef.current = '';
    latestFinalizedAiUtteranceRef.current = '';
    userSubtitleStreamRef.current = createSubtitleStreamState();
    aiSubtitleStreamRef.current = createSubtitleStreamState();
    aiTranscriptDraftRef.current = '';
    lastUserTextRef.current = '';
    aiSubtitleBufferRef.current = '';
    monitorDirtyRef.current = false;
    monitorQueuedRef.current = false;
    monitorInFlightRef.current = false;
    lastMonitorCompletedAtRef.current = 0;
    clearStageMonitorTimers();
  };

  const appendTranscriptEntries = (role: SpeakerRole, texts: string[]) => {
    const entries = texts
      .map(text => normalizeSubtitleText(text))
      .filter(Boolean);

    if (!entries.length) return [];

    const now = Date.now();
    const nextEntries = entries.map((text, index) => ({ role, text, time: now + index }));
    transcriptRef.current = [...transcriptRef.current, ...nextEntries];
    setTranscript(prev => [...prev, ...nextEntries]);

    const speakerLabel = role === 'user' ? 'Candidate' : 'Interviewer';
    conversationHistoryRef.current += entries.map(text => `\n${speakerLabel}: ${text}`).join('');

    monitorDirtyRef.current = true;
    if (usesActiveTransitionSignals && hasStageCue(entries)) {
      scheduleStageMonitorEvaluation('phrase-cue', STAGE_MONITOR_CUE_DEBOUNCE_MS);
    }

    return entries;
  };

  const getSubtitleStreamRef = (role: SpeakerRole) =>
    role === 'user' ? userSubtitleStreamRef : aiSubtitleStreamRef;

  const setSubtitleLines = (role: SpeakerRole, lines: string[]) => {
    if (role === 'user') {
      setUserSubtitleLines(lines);
      return;
    }

    setAiSubtitleLines(lines);
  };

  const clearSubtitleTimer = (role: SpeakerRole) => {
    const timerRef = role === 'user' ? userSubtitleTimerRef : aiSubtitleTimerRef;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetSubtitleStream = (role: SpeakerRole, clearDisplay = true) => {
    clearSubtitleTimer(role);
    getSubtitleStreamRef(role).current = createSubtitleStreamState();
    if (clearDisplay) {
      setSubtitleLines(role, []);
    }
  };

  const flushSubtitleStream = (
    role: SpeakerRole,
    commitRemainder = false,
    preserveDisplay = true
  ) => {
    const streamRef = getSubtitleStreamRef(role);
    const buffer = streamRef.current.buffer;

    if (!buffer) {
      if (!preserveDisplay) {
        setSubtitleLines(role, []);
      }
      streamRef.current = createSubtitleStreamState();
      return '';
    }

    const { sentences, remainder } = extractSentenceUnits(buffer);
    const newCompletedSentences = sentences.slice(streamRef.current.committedSentenceCount);

    appendTranscriptEntries(role, newCompletedSentences);
    if (commitRemainder && remainder) {
      appendTranscriptEntries(role, [remainder]);
    }

    if (preserveDisplay) {
      setSubtitleLines(role, getVisibleSubtitleLines(buffer));
    } else {
      setSubtitleLines(role, []);
    }

    streamRef.current = createSubtitleStreamState();
    return normalizeSubtitleText(buffer);
  };

  const ingestSubtitleText = (role: SpeakerRole, incomingText: string) => {
    replaceDisplayedSubtitleSpeaker(role);

    const streamRef = getSubtitleStreamRef(role);
    const mergedBuffer = mergeStreamingCaptionText(
      streamRef.current.buffer,
      incomingText,
      streamRef.current.lastEventText
    );
    const { sentences } = extractSentenceUnits(mergedBuffer);
    const newCompletedSentences = sentences.slice(streamRef.current.committedSentenceCount);

    streamRef.current = {
      buffer: mergedBuffer,
      committedSentenceCount: sentences.length,
      lastEventText: incomingText,
    };

    appendTranscriptEntries(role, newCompletedSentences);
    setSubtitleLines(role, getVisibleSubtitleLines(mergedBuffer));
  };

  const clearStageMonitorTimers = () => {
    if (monitorDebounceTimerRef.current) {
      clearTimeout(monitorDebounceTimerRef.current);
      monitorDebounceTimerRef.current = null;
    }

    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }
  };

  const buildStageMonitorInput = (): StageMonitorInput => ({
    currentStage: currentStageRef.current,
    transcript: transcriptRef.current,
    latestUserUtterance: latestFinalizedUserUtteranceRef.current,
    latestAiUtterance: latestFinalizedAiUtteranceRef.current,
    isInterviewComplete: isInterviewCompleteRef.current,
  });

  const runStageMonitorEvaluation = async (reason: string) => {
    if (!aiRef.current || !isConnectedRef.current || isInterviewCompleteRef.current) return;
    if (!transcriptRef.current.length) return;

    if (monitorInFlightRef.current) {
      monitorQueuedRef.current = true;
      return;
    }

    const input = buildStageMonitorInput();
    monitorInFlightRef.current = true;
    setIsEvaluatingStage(true);

    try {
      const response = await aiRef.current.models.generateContent({
        model: llmModel,
        contents: buildStageMonitorPrompt(input),
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const monitorResult = parseStageMonitorResult(response.text ?? '', input);
      const stageBeforeUpdate = currentStageRef.current;

      if (
        monitorResult.shouldAdvance &&
        monitorResult.nextStage > stageBeforeUpdate &&
        stageBeforeUpdate < 4
      ) {
        advanceStage();
      } else if (
        stageBeforeUpdate === 4 &&
        monitorResult.isInterviewComplete &&
        !isInterviewCompleteRef.current
      ) {
        completeInterview();
      }

      lastMonitorCompletedAtRef.current = Date.now();
      monitorDirtyRef.current = false;
      console.debug('Stage monitor:', reason, monitorResult.reason, monitorResult);
    } catch (error) {
      monitorDirtyRef.current = true;
      console.error('Stage monitor error:', error);
    } finally {
      monitorInFlightRef.current = false;
      setIsEvaluatingStage(false);

      if (monitorQueuedRef.current && isConnectedRef.current && !isInterviewCompleteRef.current) {
        monitorQueuedRef.current = false;
        void runStageMonitorEvaluation('queued');
      }
    }
  };

  const scheduleStageMonitorEvaluation = (reason: string, delayMs = STAGE_MONITOR_DEBOUNCE_MS) => {
    if (!isConnectedRef.current || isInterviewCompleteRef.current) return;

    monitorDirtyRef.current = true;

    if (monitorDebounceTimerRef.current) {
      clearTimeout(monitorDebounceTimerRef.current);
    }

    monitorDebounceTimerRef.current = setTimeout(() => {
      monitorDebounceTimerRef.current = null;
      void runStageMonitorEvaluation(reason);
    }, delayMs);
  };

  const noteFinalizedUtterance = (role: SpeakerRole, text: string) => {
    const normalizedText = normalizeSubtitleText(text);
    if (!normalizedText) return;

    if (role === 'user') {
      latestFinalizedUserUtteranceRef.current = normalizedText;
    } else {
      latestFinalizedAiUtteranceRef.current = normalizedText;
    }

    if (usesActiveTransitionSignals) {
      scheduleStageMonitorEvaluation(`${role}-turn-finalized`);
    }
  };

  const scheduleSubtitleDecay = (role: SpeakerRole, settleMs: number, _holdMs: number) => {
    clearSubtitleTimer(role);

    const timerRef = role === 'user' ? userSubtitleTimerRef : aiSubtitleTimerRef;
    timerRef.current = setTimeout(() => {
      const finalizedText = flushSubtitleStream(role, true, true);
      noteFinalizedUtterance(role, finalizedText);
      timerRef.current = null;
    }, settleMs);
  };

  const resetSubtitleState = () => {
    resetSubtitleStream('user');
    resetSubtitleStream('ai');
  };

  const setTransitioningState = (value: boolean) => {
    isTransitioningRef.current = value;
    setIsTransitioning(value);
  };

  const resetStageTransitionState = () => {
    stageAdvanceRequestedRef.current = false;
    setTransitioningState(false);
  };

  const queueStageTransition = (_extraDelayMs = 0) => {
    stageAdvanceRequestedRef.current = false;
  };

  const requestStageAdvance = () => {
    stageAdvanceRequestedRef.current = false;
  };

  const handleStageTransition = async () => {
    stageAdvanceRequestedRef.current = false;
  };

  const replaceDisplayedSubtitleSpeaker = (role: SpeakerRole) => {
    const otherRole: SpeakerRole = role === 'user' ? 'ai' : 'user';
    clearSubtitleTimer(otherRole);
    setSubtitleLines(otherRole, []);
  };

  const connectSession = async () => {
    if (!aiRef.current) return;

    try {
      const sessionId = sessionSequenceRef.current + 1;
      sessionSequenceRef.current = sessionId;
      activeSessionIdRef.current = sessionId;
      sessionOpenRef.current = false;

      // Initialize AudioContext if not already created
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (speakerId && speakerId !== 'default' && typeof (audioContextRef.current.destination as any).setSinkId === 'function') {
        try {
          await (audioContextRef.current.destination as any).setSinkId(speakerId);
        } catch (e) {
          console.warn('Could not set audio output device', e);
        }
      }

      nextPlayTimeRef.current = audioContextRef.current.currentTime;

      // Ensure we get the microphone stream
      if (!mediaStreamRef.current) {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('MediaDevices API not available. Please use HTTPS or localhost to access microphone.');
        }
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: microphoneId && microphoneId !== 'default' ? { exact: microphoneId } : undefined }
        });
      }

      // Create source node (reuse media stream but create new source)
      sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);

      // Setup User Visualizer
      if (!userAnalyserRef.current) {
        userAnalyserRef.current = audioContextRef.current.createAnalyser();
        userAnalyserRef.current.fftSize = 256;
      }
      sourceNodeRef.current.connect(userAnalyserRef.current);

      // Setup AI Visualizer
      if (!aiAnalyserRef.current) {
        aiAnalyserRef.current = audioContextRef.current.createAnalyser();
        aiAnalyserRef.current.fftSize = 256;
        aiAnalyserRef.current.connect(audioContextRef.current.destination);
      }

      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      const liveSystemInstruction = buildSystemInstruction();

      const sessionPromise = aiRef.current.live.connect({
        model: audioModel,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: {
            parts: [{ text: liveSystemInstruction }]
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            if (activeSessionIdRef.current !== sessionId) return;
            sessionOpenRef.current = true;
            isConnectedRef.current = true;
            setIsConnected(true);
            setIsConnecting(false);
          },
          onmessage: (message: LiveServerMessage) => {
            if (activeSessionIdRef.current !== sessionId) return;
            // Handle audio playback
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                const base64Audio = part?.inlineData?.data;
                if (base64Audio && audioContextRef.current) {
                  playAudio(base64Audio);
                }
              }
            }

            if (message.serverContent?.interrupted) {
              nextPlayTimeRef.current = audioContextRef.current?.currentTime || 0;
            }

            // Capture text from model for transcript incrementally
            const modelText = parts
              ?.map(part => part?.text)
              .filter((text): text is string => Boolean(text))
              .join(' ');
            if (modelText) {
              ingestSubtitleText('ai', modelText);
              scheduleSubtitleDecay('ai', AI_SUBTITLE_SETTLE_MS, 1800);
            }

            if (false && modelText) {
              ingestSubtitleText('ai', modelText);
              // Subtitle buffer grows independently — never trimmed by sentence extraction
              scheduleSubtitleDecay('ai', 2200, 1800);

              // Extract completed sentences for the transcript chatbox only
              let match;
              while ((match = aiTranscriptDraftRef.current.match(/^([\s\S]+?[.?!。？！])(\s+.*|$)/)) !== null) {
                const fullSentence = match[1].trim();
                const remainder = match[2] || '';

                if (fullSentence) {
                  setTranscript(prev => [...prev, { role: 'ai', text: fullSentence }]);
                  conversationHistoryRef.current += `\nInterviewer: ${fullSentence}`;
                }
                aiTranscriptDraftRef.current = remainder;
              }

              // Reset the clear timer on each new token
              if (aiSubtitleTimerRef.current) clearTimeout(aiSubtitleTimerRef.current);
              aiSubtitleTimerRef.current = setTimeout(() => {
                if (aiTranscriptDraftRef.current.trim()) {
                  const text = aiTranscriptDraftRef.current.trim();
                  setTranscript(prev => [...prev, { role: 'ai', text }]);
                  conversationHistoryRef.current += `\nInterviewer: ${text}`;
                  aiTranscriptDraftRef.current = '';
                }
                aiSubtitleBufferRef.current = '';
                setAiSubtitle('');
              }, 4000);
            }

            if (message.serverContent?.turnComplete) {
              const finalizedAiText = flushSubtitleStream('ai', true, true);
              clearSubtitleTimer('ai');
              aiSubtitleTimerRef.current = null;
              noteFinalizedUtterance('ai', finalizedAiText);

              if (stageAdvanceRequestedRef.current) {
                queueStageTransition(250);
              }
            }

            if (false && message.serverContent?.turnComplete) {
              if (aiTranscriptDraftRef.current.trim()) {
                const text = aiTranscriptDraftRef.current.trim();
                setTranscript(prev => [...prev, { role: 'ai', text }]);
                conversationHistoryRef.current += `\nInterviewer: ${text}`;
                aiTranscriptDraftRef.current = '';
              }
              if (aiSubtitleTimerRef.current) clearTimeout(aiSubtitleTimerRef.current);
              aiSubtitleTimerRef.current = setTimeout(() => {
                aiSubtitleBufferRef.current = '';
                setAiSubtitle('');
              }, 3000);
            }

            // Real-time subtitles from user transcription
            const inputText = (message.serverContent as any)?.inputTranscription?.text;
            if (inputText) {
              ingestSubtitleText('user', inputText);
              scheduleSubtitleDecay('user', USER_SUBTITLE_SETTLE_MS, 2000);
            }

            if (false && inputText) {
              setUserSubtitle(inputText);

              // Only update transcript if text genuinely grew to avoid spamming bubbles
              if (!lastUserTextRef.current || inputText.length > lastUserTextRef.current.length) {
                // To prevent thousands of bubbles for one sentence, we replace the last user message if it's recent
                setTranscript(prev => {
                  const newArr = [...prev];
                  const last = newArr[newArr.length - 1];
                  if (last && last.role === 'user' && Date.now() - (last as any).time < 5000) {
                    last.text = inputText;
                    return newArr;
                  }
                  return [...newArr, { role: 'user', text: inputText, time: Date.now() } as any];
                });
              }
              lastUserTextRef.current = inputText;

              if (userSubtitleTimerRef.current) clearTimeout(userSubtitleTimerRef.current);
              userSubtitleTimerRef.current = setTimeout(() => {
                setUserSubtitle('');
                lastUserTextRef.current = '';
              }, 5000);
            }

            const outputText = (message.serverContent as any)?.outputTranscription?.text;
            if (outputText && !modelText) {
              ingestSubtitleText('ai', outputText);
              scheduleSubtitleDecay('ai', AI_SUBTITLE_SETTLE_MS, 1800);
            }

            if (false && outputText && !modelText) {
              setAiSubtitle(outputText);
              if (aiSubtitleTimerRef.current) clearTimeout(aiSubtitleTimerRef.current);
              aiSubtitleTimerRef.current = setTimeout(() => setAiSubtitle(''), 5000);
            }

            // Handle function calls (stage advancement)
            if (message.toolCall) {
              const functionCalls = message.toolCall.functionCalls;
              if (functionCalls) {
                for (const fc of functionCalls) {
                  if (fc.name === 'advance_stage') {
                    requestStageAdvance();
                    if (!isTransitioningRef.current) {
                      setTimeout(() => {
                        if (!isTransitioningRef.current) {
                          void handleStageTransition();
                        }
                      }, 0);
                    }
                  }
                }
              }
            }
          },
          onclose: (e: CloseEvent) => {
            if (activeSessionIdRef.current !== sessionId) return;
            sessionOpenRef.current = false;
            isConnectedRef.current = false;
            console.warn('Session closed. Code:', e?.code, 'Reason:', e?.reason, 'WasClean:', e?.wasClean);
            // Detect region-blocked close
            if (e?.reason?.includes('User location is not supported')) {
              setRegionBlocked(true);
              setIsConnected(false);
              setIsConnecting(false);
              return;
            }
            setIsConnected(false);
            setIsConnecting(false);
          },
          onerror: (e: ErrorEvent) => {
            if (activeSessionIdRef.current !== sessionId) return;
            sessionOpenRef.current = false;
            console.error('Session error:', e?.message || e);
          }
        }
      });

      sessionRef.current = sessionPromise;

      processorRef.current.onaudioprocess = (e) => {
        if (
          isMutedRef.current ||
          !audioContextRef.current ||
          activeSessionIdRef.current !== sessionId ||
          !sessionOpenRef.current
        ) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const nativeSampleRate = audioContextRef.current.sampleRate;
        const targetSampleRate = 16000;

        // Downsample from native rate (e.g. 48000) to 16000 Hz
        const ratio = nativeSampleRate / targetSampleRate;
        const outputLength = Math.floor(inputData.length / ratio);
        const pcmData = new Int16Array(outputLength);

        for (let i = 0; i < outputLength; i++) {
          // Linear interpolation for smooth downsampling
          const srcIndex = i * ratio;
          const srcIndexFloor = Math.floor(srcIndex);
          const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
          const frac = srcIndex - srcIndexFloor;
          const sample = inputData[srcIndexFloor] * (1 - frac) + inputData[srcIndexCeil] * frac;

          const s = Math.max(-1, Math.min(1, sample));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const buffer = new ArrayBuffer(pcmData.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcmData.length; i++) {
          view.setInt16(i * 2, pcmData[i], true);
        }

        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        sessionPromise.then((session: any) => {
          if (
            activeSessionIdRef.current !== sessionId ||
            !sessionOpenRef.current
          ) {
            return;
          }

          try {
            session.sendRealtimeInput({
              media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
            });
          } catch (sendErr) {
            // Silently ignore - WebSocket may have closed
          }
        }).catch(() => { });
      };

      sourceNodeRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

    } catch (err) {
      console.error("Connection failed:", err);
      setIsConnecting(false);
      sessionOpenRef.current = false;
    }
  };

  const connect = async () => {
    if (!aiRef.current || isConnected || isConnecting) return;
    setIsJoinBillingOpen(false);
    setIsConnecting(true);

    try {
      const token = useUserStore.getState().token;
      if (!token) {
        navigate('/login');
        setIsConnecting(false);
        return;
      }

      const response = await fetch('/api/interviews/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        setIsConnecting(false);
        const message = data?.error || 'Unable to start the interview session.';
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

      useUserStore.getState().updateBalance(data.balance);
    } catch (error) {
      console.error('Failed to charge interview session:', error);
      setIsConnecting(false);
      alert('Unable to start the interview session right now.');
      return;
    }

    resetInterviewLifecycleState();
    interviewStartedAtRef.current = new Date();
    setIsEvaluatingStage(false);
    setIsConfirmEndOpen(false);
    setIsCompletionOpen(false);
    setIsSaveRecordOpen(false);
    completionHandledRef.current = false;
    setTranscript([]);
    resetSubtitleState();
    await connectSession();
  };

  const openJoinBillingModal = () => {
    if (!aiRef.current || isConnected || isConnecting) return;
    setIsJoinBillingOpen(true);
  };

  const handleConfirmJoinBilling = () => {
    void connect();
  };

  const playAudio = (base64Data: string) => {
    if (!audioContextRef.current || !aiAnalyserRef.current) return;

    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcmData = new Int16Array(bytes.buffer);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768.0;
      }

      const buffer = audioContextRef.current.createBuffer(1, floatData.length, 24000);
      buffer.getChannelData(0).set(floatData);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(aiAnalyserRef.current);

      const currentTime = audioContextRef.current.currentTime;
      if (nextPlayTimeRef.current < currentTime) {
        nextPlayTimeRef.current = currentTime;
      }

      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += buffer.duration;
    } catch (err) {
      console.error('Error playing audio:', err);
    }
  };

  const disconnectSession = () => {
    clearStageMonitorTimers();
    sessionOpenRef.current = false;
    isConnectedRef.current = false;
    monitorQueuedRef.current = false;
    monitorInFlightRef.current = false;
    monitorDirtyRef.current = false;
    activeSessionIdRef.current = 0;
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => {
        try { session.close(); } catch (e) { }
      }).catch(() => { });
      sessionRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
  };

  const disconnect = () => {
    if (interviewStartedAtRef.current && !interviewEndedAtRef.current) {
      interviewEndedAtRef.current = new Date();
    }
    flushSubtitleStream('user', true, false);
    flushSubtitleStream('ai', true, false);
    disconnectSession();

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      userAnalyserRef.current = null;
      aiAnalyserRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setIsEvaluatingStage(false);
    setUserVolume(0);
    setAiVolume(0);
    resetSubtitleState();
  };

  const buildDefaultRecordName = () => {
    return formatTimestampToSecond(interviewStartedAtRef.current || new Date());
  };

  const openSaveProgressFlow = () => {
    setRecordName(buildDefaultRecordName());
    setIsSaveRecordOpen(true);
  };

  const handleAttemptLeave = () => {
    if (isConnected || isConnecting) {
      setIsConfirmEndOpen(true);
    } else if (isCompletionOpen || isSaveRecordOpen) {
      return;
    } else if (transcriptRef.current.length > 0) {
      openSaveProgressFlow();
    } else {
      navigate('/dashboard');
    }
  };

  const handleConfirmEnd = () => {
    disconnect();
    setIsConfirmEndOpen(false);
    openSaveProgressFlow();
  };

  const handleCompletionAcknowledged = () => {
    setIsCompletionOpen(false);
    openSaveProgressFlow();
  };

  const handleSaveRecord = async () => {
    setIsSavingRecord(true);
    try {
      const token = useUserStore.getState().token;
      if (!token) throw new Error("No token");

      const roleMatch = useSettingsStore.getState().systemInstruction?.match(/applying for\s+([^.]+)/i);
      const startedAt = interviewStartedAtRef.current || new Date();
      const endedAt = interviewEndedAtRef.current || new Date();
      const elapsedSeconds = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
      await fetch('/api/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: recordName || buildDefaultRecordName(),
          role: roleMatch ? roleMatch[1] : 'General',
          duration: formatElapsedDuration(elapsedSeconds),
          elapsedSeconds,
          score: null,     // Can be calculated/prompted via AI later
          status: isInterviewComplete ? 'Completed' : 'Incomplete',
          transcript: conversationHistoryRef.current,
          transcriptEntries: transcriptRef.current,
          tags: [],
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
        })
      });
      resetInterviewLifecycleState();
      navigate('/records');
    } catch (err) {
      console.error(err);
      resetInterviewLifecycleState();
      navigate('/dashboard');
    } finally {
      setIsSavingRecord(false);
    }
  };

  const handleSkipSave = () => {
    setIsCompletionOpen(false);
    setIsSaveRecordOpen(false);
    resetInterviewLifecycleState();
    navigate('/dashboard');
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    isMutedRef.current = newMuted;
    // Actually disable/enable the microphone tracks to stop audio capture
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMuted;
      });
    }
  };

  const toggleVideo = async () => {
    const newState = !isVideoOff;
    setIsVideoOff(newState);

    if (!newState) {
      // Turn video ON
      if (!userVideoRef.current?.srcObject) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.warn('Camera access denied:', err);
          setIsVideoOff(true); // Revert
        }
      } else {
        const stream = userVideoRef.current.srcObject as MediaStream;
        stream.getVideoTracks().forEach(track => {
          track.enabled = true;
        });
      }
    } else {
      // Turn video OFF
      if (userVideoRef.current?.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream;
        stream.getVideoTracks().forEach(track => {
          track.enabled = false;
        });
      }
    }
  };

  const sendMessage = (e?: FormEvent) => {
    e?.preventDefault();
    if (!chatMessage.trim() || !sessionRef.current) return;

    const submittedMessage = chatMessage.trim();
    appendTranscriptEntries('user', [submittedMessage]);
    noteFinalizedUtterance('user', submittedMessage);

    sessionRef.current.then((session: any) => {
      if (!sessionOpenRef.current) return;
      try {
        session.sendRealtimeInput({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text: submittedMessage }] }],
            turnComplete: true
          }
        });
      } catch (err) {
        console.error("Failed to send text:", err);
      }
    }).catch(() => { });

    setChatMessage('');
  };

  const toggleChatPanel = () => {
    setIsChatOpen(previous => !previous);
  };

  const contentRightInset = isChatOpen
    ? CHAT_SIDEBAR_WIDTH + CHAT_TOGGLE_WIDTH + CHAT_LAYOUT_GAP
    : CHAT_TOGGLE_WIDTH + CHAT_LAYOUT_GAP;
  const chatToggleRightInset = isChatOpen ? CHAT_SIDEBAR_WIDTH : 0;

  const userScale = !isMuted && userVolume > 5 ? 1 + (userVolume / 255) * 0.3 : 1;
  const aiScale = isConnected && aiVolume > 5 ? 1 + (aiVolume / 255) * 0.3 : 1;

  // --- Region Blocked Fallback Screen ---
  if (regionBlocked) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#202124] text-zinc-900 dark:text-zinc-100 font-sans flex flex-col items-center justify-center relative transition-colors duration-300 p-6">
        {/* Top Left Exit Button */}
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-[#3c4043]/80 backdrop-blur-sm border border-zinc-200 dark:border-gray-600/50 hover:bg-zinc-100 dark:hover:bg-[#4a4d51] text-zinc-900 dark:text-white text-sm font-medium transition-all shadow-md group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Return to Home
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-lg w-full text-center"
        >
          <div className="w-24 h-24 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-200 dark:border-red-500/20 shadow-lg">
            <ShieldAlert size={48} className="text-red-500 dark:text-red-400" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Region Not Supported
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-lg leading-relaxed mb-4">
            We're sorry, but the AI Interview Simulation service is currently
            <strong className="text-zinc-900 dark:text-zinc-200"> not available in your region</strong>.
          </p>
          <p className="text-zinc-500 dark:text-zinc-500 text-sm leading-relaxed mb-10">
            This is due to API provider restrictions on real-time AI services for certain geographic locations.
            We are actively working to expand coverage.
          </p>

          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mb-10 text-left shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Globe size={20} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <h3 className="font-semibold text-sm">Why is this happening?</h3>
            </div>
            <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              <li className="flex items-start gap-2"><span className="text-red-500 mt-1">•</span> The underlying AI model restricts WebSocket real-time streaming in certain countries.</li>
              <li className="flex items-start gap-2"><span className="text-red-500 mt-1">•</span> Using a VPN or proxy to a supported region may resolve this issue.</li>
              <li className="flex items-start gap-2"><span className="text-red-500 mt-1">•</span> We plan to support more regions in the near future.</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all shadow-md hover:-translate-y-0.5"
            >
              Return to Home
            </button>
            <button
              onClick={() => { setRegionBlocked(false); }}
              className="px-6 py-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-medium transition-all hover:-translate-y-0.5 shadow-sm"
            >
              Try Again Anyway
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#202124] text-zinc-900 dark:text-zinc-100 font-sans flex flex-col overflow-hidden relative transition-colors duration-300">

      {/* Top Left Exit Button */}
      <div className="absolute top-4 left-4 z-50">
        <button
          onClick={handleAttemptLeave}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-[#3c4043]/80 backdrop-blur-sm border border-zinc-200 dark:border-gray-600/50 hover:bg-zinc-100 dark:hover:bg-[#4a4d51] text-zinc-900 dark:text-white text-sm font-medium transition-all shadow-md group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Dashboard
        </button>
      </div>

      {/* Top Right Settings Button */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-white/80 dark:bg-[#3c4043]/80 backdrop-blur-sm border border-zinc-200 dark:border-gray-600/50 hover:bg-zinc-100 dark:hover:bg-[#4a4d51] text-zinc-600 dark:text-zinc-300 shadow-md group"
          title="Settings"
        >
          <Settings size={18} className="group-hover:rotate-45 transition-transform duration-300" />
        </button>
      </div>

      <div
        className="flex-1 flex flex-col min-h-0 transition-[margin] duration-300 ease-in-out"
        style={{ marginRight: `${contentRightInset}px` }}
      >
        {/* Stage Progress Bar - Top */}
        {(isConnected || isInterviewComplete) && (
          <div className="pt-4 pb-2 shrink-0 z-10">
            <StageProgressBar />
            {isEvaluatingStage && (
              <div className="text-center mt-2">
                <span className="text-xs text-indigo-300 flex items-center justify-center gap-2">
                  <Loader2 size={12} className="animate-spin" />
                  Updating interview stage...
                </span>
              </div>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 flex overflow-hidden relative p-4 gap-4 min-h-0">

          {/* Video Grid Area */}
          <div className="flex-1 transition-all duration-300 flex items-center justify-center min-h-0">
            <div className="w-full max-w-6xl max-h-full grid md:grid-cols-2 gap-4 h-full min-h-0">

              {/* User Panel */}
              <div className="relative rounded-xl bg-zinc-200 dark:bg-[#3c4043] overflow-hidden flex items-center justify-center shadow-lg h-full min-h-[300px]">
                <video
                  ref={userVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
                />

                {/* User Visualizer Overlay */}
                <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-colors duration-300 ${!isVideoOff ? 'bg-black/20' : ''}`}>
                  <motion.div
                    animate={{ scale: userScale }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className={`w-24 h-24 md:w-32 md:h-32 rounded-full border-4 flex items-center justify-center transition-colors duration-300 ${isVideoOff ? 'bg-zinc-100 dark:bg-[#202124]' : 'bg-black/40 backdrop-blur-sm'} ${isMuted ? 'border-red-500/50' : 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]'
                      }`}
                  >
                    {isMuted ? <MicOff size={40} className="text-red-500" /> : <User size={40} className="text-zinc-500 dark:text-gray-300" />}
                  </motion.div>
                </div>

                <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-black/60 shadow-sm text-zinc-900 dark:text-white backdrop-blur-md px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 shrink-0 z-20">
                  You {isMuted && <MicOff size={14} className="text-red-500" />}
                </div>

                {/* User Subtitle (Inside Panel) - stable presence, fade via CSS */}
                <div
                  className="absolute bottom-16 left-4 right-4 z-40 transition-all duration-300 ease-out"
                  style={{ opacity: userSubtitleLines.length ? 1 : 0, transform: userSubtitleLines.length ? 'translateY(0)' : 'translateY(8px)', pointerEvents: userSubtitleLines.length ? 'auto' : 'none' }}
                >
                  <div className="bg-[#202124]/90 backdrop-blur-xl border border-white/10 px-5 py-4 rounded-2xl shadow-2xl flex items-start gap-3 w-full max-w-[34rem]">
                    <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={14} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-white/50 mb-1 tracking-wide uppercase">You</div>
                      <div className="space-y-1 text-left">
                        {userSubtitleLines.map((line, index) => (
                          <div
                            key={`user-subtitle-${index}-${line}`}
                            className={`text-[14px] leading-relaxed ${index === userSubtitleLines.length - 1 ? 'text-white' : 'text-white/70'}`}
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Panel */}
              <div className="relative rounded-xl bg-indigo-50/50 dark:bg-[#3c4043] overflow-hidden flex items-center justify-center shadow-lg h-full min-h-[300px]">
                {/* AI Background Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-blue-900/20 dark:to-purple-900/20"></div>

                {/* AI Visualizer */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <motion.div
                    animate={{ scale: aiScale }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className={`w-24 h-24 md:w-32 md:h-32 rounded-full border-4 flex items-center justify-center bg-white dark:bg-[#202124] ${isConnected ? 'border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 'border-zinc-200 dark:border-gray-600'
                      }`}
                  >
                    <Bot size={48} className={isConnected ? "text-emerald-500 dark:text-emerald-400" : "text-zinc-400 dark:text-gray-500"} />
                  </motion.div>
                </div>

                <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-black/60 shadow-sm text-zinc-900 dark:text-white backdrop-blur-md px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 shrink-0 z-20">
                  AI Interviewer
                  {isConnected && aiVolume > 5 && (
                    <span className="flex gap-0.5 items-center h-3">
                      <span className="w-1 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse h-full"></span>
                      <span className="w-1 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse h-2/3" style={{ animationDelay: '100ms' }}></span>
                      <span className="w-1 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse h-full" style={{ animationDelay: '200ms' }}></span>
                    </span>
                  )}
                </div>

                {/* AI Subtitle (Inside Panel) - stable presence, fade via CSS */}
                <div
                  className="absolute bottom-16 left-4 right-4 z-40 transition-all duration-300 ease-out"
                  style={{ opacity: aiSubtitleLines.length ? 1 : 0, transform: aiSubtitleLines.length ? 'translateY(0)' : 'translateY(8px)', pointerEvents: aiSubtitleLines.length ? 'auto' : 'none' }}
                >
                  <div className="bg-[#202124]/90 backdrop-blur-xl border border-white/10 px-5 py-4 rounded-2xl shadow-2xl flex items-start gap-3 w-full max-w-[34rem]">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={14} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-white/50 mb-1 tracking-wide uppercase">AI Interviewer</div>
                      <div className="space-y-1 text-left">
                        {aiSubtitleLines.map((line, index) => (
                          <div
                            key={`ai-subtitle-${index}-${line}`}
                            className={`text-[14px] leading-relaxed ${index === aiSubtitleLines.length - 1 ? 'text-emerald-50' : 'text-emerald-100/70'}`}
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </main>

        {/* Bottom Control Bar */}
        <footer className="h-20 bg-white dark:bg-[#202124] border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between px-6 shrink-0 z-20">
          <div className="w-1/3 flex items-center gap-4 text-sm font-medium text-zinc-500 dark:text-gray-400">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | Interview Simulation
          </div>

          <div className="w-1/3 flex items-center justify-center gap-3">
            {!isConnected ? (
              <button
                onClick={openJoinBillingModal}
                disabled={isConnecting}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all disabled:opacity-50 shadow-md"
              >
                {isConnecting ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
                {isConnecting ? 'Joining...' : 'Join'}
              </button>
            ) : (
              <>
                <button
                  onClick={toggleMute}
                  className={`w-12 h-12 rounded-full flex flex-col items-center justify-center transition-all shadow-sm border border-transparent ${isMuted ? 'bg-[#ea4335] text-white hover:bg-[#d93025]' : 'bg-zinc-100 dark:bg-[#3c4043] border-zinc-200 dark:border-transparent text-zinc-700 dark:text-white hover:bg-zinc-200 dark:hover:bg-[#4a4d51]'}`}
                  title={isMuted ? "Turn on microphone" : "Turn off microphone"}
                >
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                <button
                  onClick={toggleVideo}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-sm border border-transparent ${isVideoOff ? 'bg-[#ea4335] text-white hover:bg-[#d93025]' : 'bg-zinc-100 dark:bg-[#3c4043] border-zinc-200 dark:border-transparent text-zinc-700 dark:text-white hover:bg-zinc-200 dark:hover:bg-[#4a4d51]'}`}
                  title={isVideoOff ? "Turn on camera" : "Turn off camera"}
                >
                  {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>

                <button
                  onClick={toggleChatPanel}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-sm border border-transparent ${isChatOpen ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'bg-zinc-100 dark:bg-[#3c4043] border-zinc-200 dark:border-transparent text-zinc-700 dark:text-white hover:bg-zinc-200 dark:hover:bg-[#4a4d51]'}`}
                  title="Chat with everyone"
                >
                  <MessageSquare size={20} />
                </button>

                <button
                  onClick={handleAttemptLeave}
                  className="w-16 h-12 rounded-full flex items-center justify-center bg-[#ea4335] hover:bg-[#d93025] text-white transition-all shadow-md px-4 ml-2"
                  title="Leave call"
                >
                  <PhoneOff size={22} />
                </button>
              </>
            )}
          </div>

          <div className="w-1/3 flex items-center justify-end gap-3">
            {/* Settings button was moved to top right to avoid Theme toggle overlap */}
          </div>
        </footer>
      </div>

      <button
        onClick={toggleChatPanel}
        className="fixed top-1/2 z-40 flex h-20 w-11 -translate-y-1/2 items-center justify-center rounded-l-2xl border border-r-0 border-zinc-200 bg-white/95 text-zinc-600 shadow-xl backdrop-blur-sm transition-all duration-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-[#202124]/95 dark:text-zinc-300 dark:hover:bg-[#2a2d31]"
        style={{ right: `${chatToggleRightInset}px` }}
        title={isChatOpen ? 'Collapse chat' : 'Expand chat'}
        aria-label={isChatOpen ? 'Collapse chat sidebar' : 'Expand chat sidebar'}
      >
        <div className="flex flex-col items-center gap-2">
          <MessageSquare size={18} />
          {isChatOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </div>
      </button>

      {/* Chat Sidebar - Fixed overlay sliding from right */}
      <div
        className="fixed top-0 right-0 h-full z-30 flex transition-transform duration-300 ease-in-out"
        style={{ transform: isChatOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div
          className="h-full bg-white dark:bg-[#202124] border-l border-zinc-200 dark:border-gray-800 text-zinc-900 dark:text-gray-100 flex flex-col shadow-2xl"
          style={{ width: `${CHAT_SIDEBAR_WIDTH}px` }}
        >
          {/* Header */}
          <div className="h-16 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 shrink-0">
            <h3 className="font-semibold text-lg text-zinc-900 dark:text-white">Messages</h3>
            <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 rounded-full text-zinc-500 dark:text-gray-400 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Messages - scrollable area with fixed bounds */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-[#202124]">
            <div className="text-xs text-center text-zinc-500 dark:text-gray-400 bg-zinc-100 dark:bg-zinc-800/50 py-2 rounded-lg mb-4">
              Messages can be seen by the AI Interviewer.
            </div>
            {transcript.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-medium text-zinc-500 dark:text-gray-400">{msg.role === 'user' ? 'You' : 'AI Interviewer'}</span>
                </div>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-800 border bg-none border-zinc-200 dark:border-none text-zinc-900 dark:text-zinc-100 rounded-tl-sm'
                  }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/30 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
            <form onSubmit={sendMessage} className="flex items-center gap-2 bg-white dark:bg-[#202124] border border-zinc-200 dark:border-zinc-800 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-indigo-500 transition-all shadow-sm">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Send a message"
                className="flex-1 bg-transparent outline-none text-sm py-1"
                disabled={!isConnected}
              />
              <button
                type="submit"
                disabled={!chatMessage.trim() || !isConnected}
                className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-full disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Join Billing Modal */}
      <AnimatePresence>
        {isJoinBillingOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mic size={24} />
              </div>
              <h2 className="text-xl font-bold mb-2 text-zinc-900 dark:text-white">Confirm Interview Start</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">
                Starting this interview will immediately consume <span className="font-semibold text-zinc-900 dark:text-white">{SIMULATION_SESSION_TOKEN_COST} tokens</span> from your account.
              </p>
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50/70 dark:bg-indigo-500/10 px-4 py-3 text-left mb-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-300 mb-1">
                  Billing Notice
                </div>
                <div className="text-sm text-zinc-700 dark:text-zinc-200 leading-6">
                  The token charge applies as soon as you enter the interview, even if you leave the session early.
                </div>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
                Current balance: <span className="font-semibold text-zinc-900 dark:text-white">{user?.balance ?? 'N/A'}</span>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setIsJoinBillingOpen(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  Cancel
                </button>
                <button onClick={handleConfirmJoinBilling} className="flex-1 py-3 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm">
                  Confirm & Join
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* End Interview Confirmation Modal */}
      <AnimatePresence>
        {isConfirmEndOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <PhoneOff size={24} />
              </div>
              <h2 className="text-xl font-bold mb-2 text-zinc-900 dark:text-white">End Interview?</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">Are you sure you want to end this interview session? Your progress in the current stage will be stopped.</p>

              <div className="flex gap-3">
                <button onClick={() => setIsConfirmEndOpen(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  Cancel
                </button>
                <button onClick={handleConfirmEnd} className="flex-1 py-3 rounded-xl font-semibold text-sm text-white bg-red-600 hover:bg-red-500 transition-colors shadow-sm">
                  Yes, End
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interview Completed Modal */}
      <AnimatePresence>
        {isCompletionOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot size={24} />
              </div>
              <h2 className="text-xl font-bold mb-2 text-zinc-900 dark:text-white">Congratulations</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
                The mock interview finished successfully. Review your save options before leaving this session.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsCompletionOpen(false)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Stay Here
                </button>
                <button
                  onClick={handleCompletionAcknowledged}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Save Record Modal */}
      <AnimatePresence>
        {isSaveRecordOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <User size={24} />
              </div>
              <h2 className="text-xl font-bold mb-2 text-zinc-900 dark:text-white">Save Interview Progress</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
                {isInterviewComplete
                  ? 'Do you want to save this completed interview record to your history for future review?'
                  : 'Do you want to save your current interview progress to your history before leaving?'}
              </p>

              <div className="mb-6 text-left">
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Record Name</label>
                <input
                  type="text"
                  value={recordName}
                  onChange={e => setRecordName(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                  placeholder="E.g. Senior Frontend Interview"
                />
              </div>

              <div className="flex gap-3">
                <button disabled={isSavingRecord} onClick={handleSkipSave} className="flex-1 py-3 rounded-xl font-semibold text-sm border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50">
                  Skip & Exit
                </button>
                <button disabled={isSavingRecord} onClick={handleSaveRecord} className="flex-1 py-3 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm disabled:opacity-50">
                  {isSavingRecord ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
