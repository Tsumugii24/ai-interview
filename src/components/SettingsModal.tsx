import { useState, useEffect, useRef } from 'react';
import { X, Mic, Volume2, Settings2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    llmModel,
    audioModel,
    microphoneId,
    speakerId,
    systemInstruction,
    setLlmModel,
    setAudioModel,
    setMicrophoneId,
    setSpeakerId,
    setSystemInstruction,
  } = useSettingsStore();

  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
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
      getDevices();
      // Initialize audio element
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

  // Update sinkId when speaker changes
  useEffect(() => {
    if (audioRef.current && speakerId && speakerId !== 'default') {
      if (typeof (audioRef.current as any).setSinkId === 'function') {
        (audioRef.current as any).setSinkId(speakerId).catch(console.error);
      }
    }
  }, [speakerId]);

  const toggleAudioTest = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

  const stopAudioTest = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };

  const getDevices = async () => {
    try {
      // Request permission first to get labels
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionError(null);

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput');

      setMicrophones(audioInputs);
      setSpeakers(audioOutputs);

      if (audioInputs.length > 0 && microphoneId === 'default') {
        setMicrophoneId(audioInputs[0].deviceId);
      }
      if (audioOutputs.length > 0 && speakerId === 'default') {
        setSpeakerId(audioOutputs[0].deviceId);
      }
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
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setMicVolume(Math.min(100, (average / 128) * 100)); // Normalize to 0-100

        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
      setMicTestActive(true);
    } catch (err) {
      console.error('Error starting mic test:', err);
      setPermissionError('Could not start microphone test.');
    }
  };

  const stopMicTest = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setMicTestActive(false);
    setMicVolume(0);
  };

  const toggleMicTest = () => {
    if (micTestActive) {
      stopMicTest();
    } else {
      startMicTest();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2 text-zinc-900">
            <Settings2 size={20} className="text-indigo-600" />
            <h2 className="text-lg font-semibold">Configuration Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {permissionError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle size={20} className="mt-0.5 shrink-0" />
              <p className="text-sm">{permissionError}</p>
            </div>
          )}

          {/* AI Models Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">AI Models</h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Text/Reasoning Model</label>
                <select
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="gemini-3-flash-preview">Gemini 3 Flash (Default)</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Advanced)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Live Audio Model</label>
                <select
                  value={audioModel}
                  onChange={(e) => setAudioModel(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="gemini-2.5-flash-native-audio-preview-12-2025">Gemini 2.5 Flash Native Audio</option>
                </select>
              </div>
            </div>
          </section>

          {/* Hardware Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">Hardware</h3>

            <div className="space-y-6">
              {/* Microphone */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                  <Mic size={16} /> Microphone
                </label>
                <div className="flex gap-3">
                  <select
                    value={microphoneId}
                    onChange={(e) => {
                      setMicrophoneId(e.target.value);
                      if (micTestActive) {
                        stopMicTest();
                        setTimeout(startMicTest, 100);
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {microphones.length === 0 && <option value="default">Default Microphone</option>}
                    {microphones.map(mic => (
                      <option key={mic.deviceId} value={mic.deviceId}>
                        {mic.label || `Microphone ${mic.deviceId.slice(0, 5)}...`}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={toggleMicTest}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${micTestActive
                        ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                        : 'bg-zinc-100 text-zinc-700 border border-zinc-200 hover:bg-zinc-200'
                      }`}
                  >
                    {micTestActive ? 'Stop Test' : 'Test Mic'}
                  </button>
                </div>

                {/* Volume Meter */}
                {micTestActive && (
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-75"
                      style={{ width: `${micVolume}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Speaker */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                  <Volume2 size={16} /> Speaker
                </label>
                <div className="flex gap-3">
                  <select
                    value={speakerId}
                    onChange={(e) => setSpeakerId(e.target.value)}
                    className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {speakers.length === 0 && <option value="default">Default Speaker</option>}
                    {speakers.map(speaker => (
                      <option key={speaker.deviceId} value={speaker.deviceId}>
                        {speaker.label || `Speaker ${speaker.deviceId.slice(0, 5)}...`}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={toggleAudioTest}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isPlaying
                          ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100'
                          : 'bg-zinc-100 text-zinc-700 border border-zinc-200 hover:bg-zinc-200'
                        }`}
                    >
                      {isPlaying ? 'Pause' : 'Play Test'}
                    </button>
                    <button
                      onClick={stopAudioTest}
                      disabled={!isPlaying && audioRef.current?.currentTime === 0}
                      className="px-4 py-2 bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Stop
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Persona Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">Interviewer Persona</h3>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">System Instruction</label>
              <textarea
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                placeholder="Define the AI's role, tone, and behavior..."
              />
              <p className="text-xs text-zinc-500">
                This instruction tells the AI how to behave during the interview. You can customize it for different roles (e.g., Product Manager, Frontend Engineer).
              </p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <CheckCircle2 size={18} />
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}
