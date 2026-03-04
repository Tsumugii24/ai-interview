import { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, PhoneOff, User, Bot, Loader2, VideoOff, Video, MessageSquare, Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettingsStore } from '../store/settingsStore';
import { useInterviewStore } from '../store/interviewStore';
import StageProgressBar from '../components/StageProgressBar';

// Import stage prompts as raw text
import stage1Prompt from '../prompts/stage1-greeting.md?raw';
import stage2Prompt from '../prompts/stage2-introduction.md?raw';
import stage3Prompt from '../prompts/stage3-qa.md?raw';
import stage4Prompt from '../prompts/stage4-wrapup.md?raw';

const stagePrompts: Record<number, string> = {
  1: stage1Prompt,
  2: stage2Prompt,
  3: stage3Prompt,
  4: stage4Prompt,
};

// Tool declaration for stage advancement
const advanceStageTool = {
  functionDeclarations: [{
    name: 'advance_stage',
    description: 'Call this function when the current interview stage is complete and it is time to move to the next stage. The AI interviewer should call this when all objectives of the current stage have been fulfilled.',
  }],
};

export default function SimulationPage() {
  const navigate = useNavigate();
  const { audioModel, microphoneId, speakerId } = useSettingsStore();
  const { currentStage, isInterviewComplete, advanceStage, resetInterview } = useInterviewStore();

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [transcript, setTranscript] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [userVolume, setUserVolume] = useState(0);
  const [aiVolume, setAiVolume] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userSubtitle, setUserSubtitle] = useState('');
  const [aiSubtitle, setAiSubtitle] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const aiRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef(0);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const userVideoRef = useRef<HTMLVideoElement>(null);
  const userAnalyserRef = useRef<AnalyserNode | null>(null);
  const aiAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const userSubtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiSubtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Accumulate conversation history for context across stages
  const conversationHistoryRef = useRef<string>('');

  useEffect(() => {
    aiRef.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Request camera access for the user panel
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
        }
      })
      .catch(err => console.warn('Camera access denied or not available:', err));

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      clearInterval(timer);
      disconnectSession();
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

  const buildSystemInstruction = (stage: number): string => {
    const stagePrompt = stagePrompts[stage] || '';
    let instruction = stagePrompt;

    // Add conversation context for stages 2+
    if (stage > 1 && conversationHistoryRef.current) {
      instruction += `\n\n## Previous Conversation Context\nHere is a summary of the conversation so far. Use this to maintain continuity:\n\n${conversationHistoryRef.current}`;
    }

    return instruction;
  };

  const connectToStage = async (stage: number) => {
    if (!aiRef.current) return;

    try {
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

      const systemInstruction = buildSystemInstruction(stage);

      // Determine tools: stages 1-3 get the advance_stage tool, stage 4 doesn't
      const tools = stage < 4 ? [advanceStageTool] : undefined;

      const sessionPromise = aiRef.current.live.connect({
        model: audioModel,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          tools: tools,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            setIsTransitioning(false);
          },
          onmessage: (message: LiveServerMessage) => {
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

            // Capture text from model for transcript
            const modelText = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (modelText) {
              setTranscript(prev => [...prev, { role: 'ai', text: modelText }]);
              // Accumulate conversation history
              conversationHistoryRef.current += `\nInterviewer: ${modelText}`;
            }

            // Real-time subtitles from transcription
            const inputText = (message.serverContent as any)?.inputTranscription?.text;
            if (inputText) {
              setUserSubtitle(inputText);
              if (userSubtitleTimerRef.current) clearTimeout(userSubtitleTimerRef.current);
              userSubtitleTimerRef.current = setTimeout(() => setUserSubtitle(''), 5000);
              // Accumulate user speech in history
              conversationHistoryRef.current += `\nCandidate: ${inputText}`;
            }

            const outputText = (message.serverContent as any)?.outputTranscription?.text;
            if (outputText) {
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
                    // Respond to the function call
                    sessionPromise.then((session: any) => {
                      session.sendToolResponse({
                        functionResponses: [{
                          id: fc.id,
                          response: { result: { success: true } },
                        }],
                      });
                    }).catch(() => { });

                    // Trigger stage transition after a brief delay
                    setTimeout(() => {
                      handleStageTransition();
                    }, 2000);
                  }
                }
              }
            }
          },
          onclose: () => {
            // Only fully disconnect if not transitioning
            if (!isTransitioning) {
              setIsConnected(false);
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
          }
        }
      });

      sessionRef.current = sessionPromise;

      processorRef.current.onaudioprocess = (e) => {
        if (isMuted || !audioContextRef.current) return;

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
          session.sendRealtimeInput({
            media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }).catch(() => { });
      };

      sourceNodeRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

    } catch (err) {
      console.error("Connection failed:", err);
      setIsConnecting(false);
      setIsTransitioning(false);
    }
  };

  const connect = async () => {
    if (!aiRef.current || isConnected || isConnecting) return;
    setIsConnecting(true);
    resetInterview();
    conversationHistoryRef.current = '';
    await connectToStage(1);
  };

  const handleStageTransition = async () => {
    setIsTransitioning(true);

    // Close current session
    disconnectSession();

    // Advance stage in store
    advanceStage();

    // Get the new stage (currentStage hasn't updated yet from the store perspective in this closure)
    const { currentStage: newStage } = useInterviewStore.getState();

    if (newStage > 4 || useInterviewStore.getState().isInterviewComplete) {
      setIsTransitioning(false);
      setIsConnected(false);
      return;
    }

    // Brief delay for UX before reconnecting
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reconnect with new stage prompt
    await connectToStage(newStage);
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
    setIsTransitioning(false);
    setUserVolume(0);
    setAiVolume(0);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    const newState = !isVideoOff;
    setIsVideoOff(newState);
    if (userVideoRef.current?.srcObject) {
      const stream = userVideoRef.current.srcObject as MediaStream;
      stream.getVideoTracks().forEach(track => {
        track.enabled = !newState;
      });
    }
  };

  const sendMessage = (e?: FormEvent) => {
    e?.preventDefault();
    if (!chatMessage.trim() || !sessionRef.current) return;

    setTranscript(prev => [...prev, { role: 'user', text: chatMessage }]);
    conversationHistoryRef.current += `\nCandidate: ${chatMessage}`;

    sessionRef.current.then((session: any) => {
      try {
        session.sendRealtimeInput({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text: chatMessage }] }],
            turnComplete: true
          }
        });
      } catch (err) {
        console.error("Failed to send text:", err);
      }
    }).catch(() => { });

    setChatMessage('');
  };

  const userScale = !isMuted && userVolume > 5 ? 1 + (userVolume / 255) * 0.3 : 1;
  const aiScale = isConnected && aiVolume > 5 ? 1 + (aiVolume / 255) * 0.3 : 1;

  return (
    <div className="min-h-screen bg-[#202124] text-white font-sans flex flex-col overflow-hidden">

      {/* Stage Progress Bar - Top */}
      {(isConnected || isTransitioning || isInterviewComplete) && (
        <div className="pt-4 pb-2 shrink-0 z-10">
          <StageProgressBar />
          {isTransitioning && (
            <div className="text-center mt-2">
              <span className="text-xs text-indigo-300 flex items-center justify-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                Transitioning to next stage...
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative p-4 gap-4">

        {/* Video Grid Area */}
        <div className="flex-1 transition-all duration-300 flex items-center justify-center">
          <div className="w-full max-w-6xl max-h-full grid md:grid-cols-2 gap-4 h-full">

            {/* User Panel */}
            <div className="relative rounded-xl bg-[#3c4043] overflow-hidden flex items-center justify-center shadow-lg h-full min-h-[300px]">
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
                  className={`w-24 h-24 md:w-32 md:h-32 rounded-full border-4 flex items-center justify-center transition-colors duration-300 ${isVideoOff ? 'bg-[#202124]' : 'bg-black/40 backdrop-blur-sm'} ${isMuted ? 'border-red-500/50' : 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]'
                    }`}
                >
                  {isMuted ? <MicOff size={40} className="text-red-400" /> : <User size={40} className="text-gray-300" />}
                </motion.div>
              </div>

              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2">
                You {isMuted && <MicOff size={14} className="text-red-400" />}
              </div>

              {/* User Subtitle */}
              <AnimatePresence>
                {userSubtitle && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-14 left-1/2 -translate-x-1/2 max-w-[90%] bg-black/70 backdrop-blur-md px-4 py-2 rounded-lg text-sm text-white text-center leading-relaxed"
                  >
                    {userSubtitle}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* AI Panel */}
            <div className="relative rounded-xl bg-[#3c4043] overflow-hidden flex items-center justify-center shadow-lg h-full min-h-[300px]">
              {/* AI Background Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20"></div>

              {/* AI Visualizer */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div
                  animate={{ scale: aiScale }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`w-24 h-24 md:w-32 md:h-32 rounded-full border-4 flex items-center justify-center bg-[#202124] ${isConnected ? 'border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.4)]' : 'border-gray-600'
                    }`}
                >
                  <Bot size={48} className={isConnected ? "text-emerald-400" : "text-gray-500"} />
                </motion.div>
              </div>

              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2">
                AI Interviewer
                {isConnected && aiVolume > 5 && (
                  <span className="flex gap-0.5 items-center h-3">
                    <span className="w-1 bg-emerald-400 rounded-full animate-pulse h-full"></span>
                    <span className="w-1 bg-emerald-400 rounded-full animate-pulse h-2/3" style={{ animationDelay: '100ms' }}></span>
                    <span className="w-1 bg-emerald-400 rounded-full animate-pulse h-full" style={{ animationDelay: '200ms' }}></span>
                  </span>
                )}
              </div>

              {/* AI Subtitle */}
              <AnimatePresence>
                {aiSubtitle && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-14 left-1/2 -translate-x-1/2 max-w-[90%] bg-black/70 backdrop-blur-md px-4 py-2 rounded-lg text-sm text-emerald-100 text-center leading-relaxed"
                  >
                    {aiSubtitle}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>

        {/* Chat Sidebar - Full Height */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-white text-gray-900 flex flex-col h-full rounded-xl overflow-hidden shadow-2xl z-10 shrink-0"
            >
              <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
                <h3 className="font-semibold text-lg">In-call messages</h3>
                <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                <div className="text-xs text-center text-gray-500 bg-gray-100 py-2 rounded-lg mb-4">
                  Messages can be seen by the AI Interviewer.
                </div>
                {transcript.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-700">{msg.role === 'user' ? 'You' : 'AI Interviewer'}</span>
                    </div>
                    <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                      }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 bg-white border-t border-gray-200 shrink-0">
                <form onSubmit={sendMessage} className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all">
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
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Control Bar */}
      <footer className="h-20 bg-[#202124] flex items-center justify-between px-6 shrink-0 z-20">
        <div className="w-1/3 flex items-center gap-4 text-sm font-medium text-gray-300">
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | Interview Simulation
        </div>

        <div className="w-1/3 flex items-center justify-center gap-3">
          {!isConnected && !isTransitioning ? (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all disabled:opacity-50"
            >
              {isConnecting ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
              {isConnecting ? 'Joining...' : 'Join'}
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-[#ea4335] text-white' : 'bg-[#3c4043] text-white hover:bg-[#4a4d51]'}`}
                title={isMuted ? "Turn on microphone" : "Turn off microphone"}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              <button
                onClick={toggleVideo}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-[#ea4335] text-white' : 'bg-[#3c4043] text-white hover:bg-[#4a4d51]'}`}
                title={isVideoOff ? "Turn on camera" : "Turn off camera"}
              >
                {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>

              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isChatOpen ? 'bg-blue-100 text-blue-600' : 'bg-[#3c4043] text-white hover:bg-[#4a4d51]'}`}
                title="Chat with everyone"
              >
                <MessageSquare size={20} />
              </button>

              <button
                onClick={disconnect}
                className="w-16 h-12 rounded-full flex items-center justify-center bg-[#ea4335] hover:bg-[#d93025] text-white transition-all px-4 ml-2"
                title="Leave call"
              >
                <PhoneOff size={22} />
              </button>
            </>
          )}
        </div>

        <div className="w-1/3 flex items-center justify-end gap-3">
          {/* Empty space to balance the footer */}
        </div>
      </footer>
    </div>
  );
}
