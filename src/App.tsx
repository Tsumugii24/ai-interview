/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useThemeStore } from './store/themeStore';
import ThemeToggle from './components/ThemeToggle';
import LandingPage from './pages/LandingPage';
import SimulationPage from './pages/SimulationPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PricingPage from './pages/PricingPage';
import ProfilePage from './pages/ProfilePage';
import ContactSalesPage from './pages/ContactSalesPage';
import ResumePage from './pages/ResumePage';
import RecordsPage from './pages/RecordsPage';
import RecordDetailsPage from './pages/RecordDetailsPage';

export default function App() {
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // Listen to system theme changes specifically when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(mediaQuery.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <BrowserRouter>
      <div className="bg-white dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-zinc-50 transition-colors duration-300">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/simulation" element={<SimulationPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/contact-sales" element={<ContactSalesPage />} />
          <Route path="/resume" element={<ResumePage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/records/:id" element={<RecordDetailsPage />} />
        </Routes>
        
        {/* Global Floating Theme Toggle */}
        <div className="fixed bottom-6 right-6 z-[100]">
          <ThemeToggle />
        </div>
      </div>
    </BrowserRouter>
  );
}
