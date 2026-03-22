import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Volume2, Settings2, AlertCircle, Video as VideoIcon, Captions, Cpu } from 'lucide-react';
import { useSettingsStore, type TransitionMonitoringMode } from '../store/settingsStore';

type TabId = 'audio' | 'video' | 'general' | 'subtitles';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabId;
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'audio', label: 'Audio', icon: <Mic size={18} /> },
  { id: 'video', label: 'Video', icon: <VideoIcon size={18} /> },
  { id: 'general', label: 'General', icon: <Cpu size={18} /> },
  { id: 'subtitles', label: 'Subtitles', icon: <Captions size={18} /> },
];

export default function SettingsModal({ isOpen, onClose, initialTab = 'audio' }: SettingsModalProps) {
  const {
    llmModel,
    audioModel,
    microphoneId,
    speakerId,
    systemInstruction,
    transitionMonitoringMode,
    setLlmModel,
    setAudioModel,
    setMicrophoneId,
    setSpeakerId,
    setSystemInstruction,
    setTransitionMonitoringMode,
  } = useSettingsStore();

  const transitionModeOptions: {
    value: TransitionMonitoringMode;
    label: string;
    description: string;
  }[] = [
    {
      value: 'active',
      label: 'Active transition signals',
      description: 'Default. Advance stages from finalized turn signals without interval polling.',
    },
    {
      value: 'hybrid',
      label: 'Hybrid mode',
      description: 'Use active transition signals with interval polling as a fallback.',
    },
    {
      value: 'passive',
      label: 'Passive interval-based listening',
      description: 'Only check for stage transitions on the interval timer.',
    },
  ];

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [micTestActive, setMicTestActive] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      getDevices();
      if (!audioRef.current) {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg');
        audio.loop = true;
        audio.onplay = () => setIsPlaying(true);
        audio.onpause = () => setIsPlaying(false);
        audioRef.current = audio;
      }
    } else {
      stopMicTest();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
    return () => {
      stopMicTest();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (audioRef.current && speakerId && speakerId !== 'default') {
      if (typeof (audioRef.current as any).setSinkId === 'function') {
        (audioRef.current as any).setSinkId(speakerId).catch(console.error);
      }
    }
  }, [speakerId]);

  const toggleAudioTest = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(console.error);
  };

  const getDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionError(null);
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMicrophones(devices.filter(d => d.kind === 'audioinput'));
      setSpeakers(devices.filter(d => d.kind === 'audiooutput'));
      setCameras(devices.filter(d => d.kind === 'videoinput'));

      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
      if (audioInputs.length > 0 && microphoneId === 'default') setMicrophoneId(audioInputs[0].deviceId);
      if (audioOutputs.length > 0 && speakerId === 'default') setSpeakerId(audioOutputs[0].deviceId);
    } catch (err) {
      console.error('Error getting devices:', err);
      setPermissionError('Microphone access denied. Please allow microphone access in your browser settings.');
    }
  };

  const startMicTest = async () => {
    if (micTestActive) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: microphoneId ? { exact: microphoneId } : undefined }
      });
      mediaStreamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        setMicVolume(Math.min(100, (sum / bufferLength / 128) * 100));
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
      setMicTestActive(true);
    } catch (err) {
      setPermissionError('Could not start microphone test.');
    }
  };

  const stopMicTest = () => {
    if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    setMicTestActive(false);
    setMicVolume(0);
  };

  const toggleMicTest = () => { micTestActive ? stopMicTest() : startMicTest(); };

  if (!isOpen) return null;

  const renderAudioTab = () => (
    <div className="space-y-8">
      {permissionError && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <p className="text-sm">{permissionError}</p>
        </div>
      )}

      {/* Microphone */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Microphone</label>
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Mic size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <select
              value={microphoneId}
              onChange={(e) => {
                setMicrophoneId(e.target.value);
                if (micTestActive) { stopMicTest(); setTimeout(startMicTest, 100); }
              }}
              className="w-full pl-9 pr-3 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 appearance-none transition-colors"
            >
              {microphones.length === 0 && <option value="default">Default Microphone</option>}
              {microphones.map(mic => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label || `Microphone ${mic.deviceId.slice(0, 5)}...`}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={toggleMicTest}
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all border ${micTestActive
              ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30 hover:bg-red-100'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            title={micTestActive ? 'Stop test' : 'Test microphone'}
          >
            <div className="flex gap-[2px] items-end h-4">
              <div className={`w-[3px] rounded-full transition-all ${micTestActive ? 'bg-red-500 animate-pulse' : 'bg-zinc-400'}`} style={{ height: micTestActive ? `${Math.max(4, micVolume * 0.16)}px` : '4px' }} />
              <div className={`w-[3px] rounded-full transition-all ${micTestActive ? 'bg-red-500 animate-pulse' : 'bg-zinc-400'}`} style={{ height: micTestActive ? `${Math.max(6, micVolume * 0.14)}px` : '8px', animationDelay: '50ms' }} />
              <div className={`w-[3px] rounded-full transition-all ${micTestActive ? 'bg-red-500 animate-pulse' : 'bg-zinc-400'}`} style={{ height: micTestActive ? `${Math.max(4, micVolume * 0.16)}px` : '4px', animationDelay: '100ms' }} />
            </div>
          </button>
        </div>

        {/* Volume Meter */}
        {micTestActive && (
          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-75" style={{ width: `${micVolume}%` }} />
          </div>
        )}
      </div>

      {/* Speaker */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Speaker</label>
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Volume2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <select
              value={speakerId}
              onChange={(e) => setSpeakerId(e.target.value)}
              className="w-full pl-9 pr-3 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 appearance-none transition-colors"
            >
              {speakers.length === 0 && <option value="default">Default Speaker</option>}
              {speakers.map(speaker => (
                <option key={speaker.deviceId} value={speaker.deviceId}>
                  {speaker.label || `Speaker ${speaker.deviceId.slice(0, 5)}...`}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={toggleAudioTest}
            className="shrink-0 px-4 py-2.5 text-sm font-medium rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            {isPlaying ? 'Stop' : 'Test'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderVideoTab = () => (
    <div className="space-y-8">
      {/* Camera */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Camera</label>
        <div className="relative">
          <VideoIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <select className="w-full pl-9 pr-3 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 appearance-none transition-colors">
            {cameras.length === 0 && <option>No camera detected</option>}
            {cameras.map(cam => (
              <option key={cam.deviceId} value={cam.deviceId}>
                {cam.label || `Camera ${cam.deviceId.slice(0, 5)}...`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-4">
        <p className="text-sm text-indigo-700 dark:text-indigo-400">
          Camera access is only requested when you manually enable video during the interview session. Your privacy is respected.
        </p>
      </div>
    </div>
  );

  const renderGeneralTab = () => (
    <div className="space-y-8">
      {/* AI Models */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Reasoning Model</label>
        <select
          value={llmModel}
          onChange={(e) => setLlmModel(e.target.value)}
          className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 appearance-none transition-colors"
        >
          <option value="gemini-3-flash-preview">Gemini 3 Flash (Default)</option>
          <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Advanced)</option>
        </select>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Live Audio Model</label>
        <select
          value={audioModel}
          onChange={(e) => setAudioModel(e.target.value)}
          className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 appearance-none transition-colors"
        >
          <option value="gemini-2.5-flash-native-audio-preview-12-2025">Gemini 2.5 Flash Native Audio</option>
        </select>
      </div>

      {/* Persona */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Interviewer Persona</label>
        <textarea
          value={systemInstruction}
          onChange={(e) => setSystemInstruction(e.target.value)}
          rows={4}
          className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 resize-none transition-colors"
          placeholder="Define the AI's role, tone, and behavior..."
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Customize the AI's behavior for different roles (e.g., Product Manager, Frontend Engineer, Data Scientist).
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Stage Transition Detection</label>
        <div className="space-y-3">
          {transitionModeOptions.map((option) => {
            const isSelected = transitionMonitoringMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTransitionMonitoringMode(option.value)}
                className={`w-full text-left rounded-xl border px-4 py-4 transition-colors ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                    : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${
                    isSelected
                      ? 'border-indigo-600 dark:border-indigo-400'
                      : 'border-zinc-300 dark:border-zinc-600'
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />}
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${
                      isSelected
                        ? 'text-indigo-700 dark:text-indigo-300'
                        : 'text-zinc-900 dark:text-zinc-100'
                    }`}>
                      {option.label}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {option.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderSubtitlesTab = () => (
    <div className="space-y-8">
      <div className="space-y-3">
        <label className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Subtitle Language</label>
        <select className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 appearance-none transition-colors">
          <option>English</option>
          <option>Chinese (Simplified)</option>
          <option>Japanese</option>
          <option>Korean</option>
          <option>Spanish</option>
          <option>French</option>
          <option>German</option>
        </select>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-5 h-5 rounded-full border-2 border-zinc-300 dark:border-zinc-600 flex items-center justify-center">
          </div>
          <span className="text-sm text-zinc-700 dark:text-zinc-300">No subtitles</span>
        </div>
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-5 h-5 rounded-full border-2 border-indigo-600 dark:border-indigo-400 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400"></div>
          </div>
          <div>
            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Real-time subtitles</span>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Show live transcription of the interview conversation.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'audio': return renderAudioTab();
      case 'video': return renderVideoTab();
      case 'general': return renderGeneralTab();
      case 'subtitles': return renderSubtitlesTab();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-[720px] max-h-[85vh] overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body: Tabs + Content */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left Sidebar Tabs */}
          <nav className="w-48 shrink-0 border-r border-zinc-100 dark:border-zinc-800 py-2 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-900/50">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-medium transition-all text-left ${activeTab === tab.id
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-r-[3px] border-indigo-600 dark:border-indigo-400'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
              >
                <span className={activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500'}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
