import { create } from 'zustand';

interface SettingsState {
  llmModel: string;
  audioModel: string;
  microphoneId: string;
  speakerId: string;
  systemInstruction: string;
  setLlmModel: (model: string) => void;
  setAudioModel: (model: string) => void;
  setMicrophoneId: (id: string) => void;
  setSpeakerId: (id: string) => void;
  setSystemInstruction: (instruction: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  llmModel: 'gemini-3-flash-preview',
  audioModel: 'gemini-2.5-flash-native-audio-preview-12-2025',
  microphoneId: 'default',
  speakerId: 'default',
  systemInstruction: "You are a professional technical interviewer for a software engineering role. Ask one question at a time, listen to the user's response, and provide constructive feedback before moving to the next question. Start by welcoming the candidate.",
  setLlmModel: (model) => set({ llmModel: model }),
  setAudioModel: (model) => set({ audioModel: model }),
  setMicrophoneId: (id) => set({ microphoneId: id }),
  setSpeakerId: (id) => set({ speakerId: id }),
  setSystemInstruction: (instruction) => set({ systemInstruction: instruction }),
}));
