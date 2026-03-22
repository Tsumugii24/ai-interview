import React from 'react';
import { Moon, Sun, Laptop } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';

export default function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="flex bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
      <button 
        onClick={() => setTheme('light')} 
        title="Light Mode"
        className={`p-1.5 flex items-center justify-center rounded-lg transition-all duration-200 ${theme === 'light' ? 'bg-white shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-indigo-600 dark:bg-zinc-700 dark:text-indigo-400 scale-100' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 scale-95 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/30'}`}
      >
        <Sun size={16} />
      </button>
      <button 
        onClick={() => setTheme('system')} 
        title="System Default"
        className={`p-1.5 flex items-center justify-center rounded-lg transition-all duration-200 ${theme === 'system' ? 'bg-white shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-indigo-600 dark:bg-zinc-700 dark:text-indigo-400 scale-100' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 scale-95 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/30'}`}
      >
        <Laptop size={16} />
      </button>
      <button 
        onClick={() => setTheme('dark')} 
        title="Dark Mode"
        className={`p-1.5 flex items-center justify-center rounded-lg transition-all duration-200 ${theme === 'dark' ? 'bg-white shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-indigo-600 dark:bg-zinc-700 dark:text-indigo-400 scale-100' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 scale-95 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/30'}`}
      >
        <Moon size={16} />
      </button>
    </div>
  );
}
