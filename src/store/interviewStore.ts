import { create } from 'zustand';

export interface StageInfo {
    id: number;
    label: string;
    shortLabel: string;
    completed: boolean;
}

interface InterviewState {
    currentStage: number;
    stages: StageInfo[];
    isInterviewComplete: boolean;
    advanceStage: () => void;
    resetInterview: () => void;
}

const defaultStages: StageInfo[] = [
    { id: 1, label: 'Greeting & Setup', shortLabel: 'Setup', completed: false },
    { id: 2, label: 'Self Introduction', shortLabel: 'Intro', completed: false },
    { id: 3, label: 'Q&A Session', shortLabel: 'Q&A', completed: false },
    { id: 4, label: 'Wrap-up & Feedback', shortLabel: 'Feedback', completed: false },
];

export const useInterviewStore = create<InterviewState>((set, get) => ({
    currentStage: 1,
    stages: defaultStages.map(s => ({ ...s })),
    isInterviewComplete: false,

    advanceStage: () => {
        const { currentStage, stages } = get();
        if (currentStage >= 4) {
            // Mark last stage as complete
            set({
                stages: stages.map(s => ({ ...s, completed: true })),
                isInterviewComplete: true,
            });
            return;
        }

        const nextStage = currentStage + 1;
        set({
            currentStage: nextStage,
            stages: stages.map(s =>
                s.id <= currentStage ? { ...s, completed: true } : s
            ),
        });
    },

    resetInterview: () => {
        set({
            currentStage: 1,
            stages: defaultStages.map(s => ({ ...s })),
            isInterviewComplete: false,
        });
    },
}));
