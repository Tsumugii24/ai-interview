import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { useInterviewStore, StageInfo } from '../store/interviewStore';

export default function StageProgressBar() {
    const { currentStage, stages } = useInterviewStore();

    const getStageStatus = (stage: StageInfo): 'completed' | 'active' | 'upcoming' => {
        if (stage.completed) return 'completed';
        if (stage.id === currentStage) return 'active';
        return 'upcoming';
    };

    return (
        <div className="w-full max-w-3xl mx-auto px-4">
            <div className="flex items-center justify-between relative">
                {stages.map((stage, index) => {
                    const status = getStageStatus(stage);
                    const isLast = index === stages.length - 1;

                    return (
                        <div key={stage.id} className="flex items-center flex-1 last:flex-none">
                            {/* Dot + Label */}
                            <div className="flex flex-col items-center relative z-10">
                                <motion.div
                                    animate={{
                                        scale: status === 'active' ? 1.15 : 1,
                                    }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-500 ${status === 'completed'
                                            ? 'bg-indigo-500 border-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                                            : status === 'active'
                                                ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.3)]'
                                                : 'bg-[#2a2d31] border-[#4a4d51] text-gray-500'
                                        }`}
                                >
                                    {status === 'completed' ? (
                                        <Check size={16} strokeWidth={3} />
                                    ) : (
                                        stage.id
                                    )}
                                </motion.div>
                                <span
                                    className={`mt-2 text-[11px] font-medium whitespace-nowrap transition-colors duration-500 ${status === 'completed'
                                            ? 'text-indigo-400'
                                            : status === 'active'
                                                ? 'text-indigo-300'
                                                : 'text-gray-500'
                                        }`}
                                >
                                    {stage.shortLabel}
                                </span>
                            </div>

                            {/* Connector Line */}
                            {!isLast && (
                                <div className="flex-1 h-0.5 mx-2 relative -mt-5">
                                    <div className="absolute inset-0 bg-[#3c4043] rounded-full" />
                                    <motion.div
                                        initial={{ width: '0%' }}
                                        animate={{
                                            width: status === 'completed' ? '100%' : status === 'active' ? '50%' : '0%',
                                        }}
                                        transition={{ duration: 0.6, ease: 'easeInOut' }}
                                        className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
