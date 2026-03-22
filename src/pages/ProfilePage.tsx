import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { motion } from 'motion/react';
import { ArrowLeft, Mail, Phone, Lock, Save, Loader2, ShieldCheck } from 'lucide-react';

export default function ProfilePage() {
  const navigate = useNavigate();
  const token = useUserStore((state) => state.token);
  const user = useUserStore((state) => state.user);
  const updateProfileStore = useUserStore((state) => state.updateProfile);

  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });

  if (!user || !token) {
    if (typeof window !== 'undefined') navigate('/login');
    return null;
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg({ text: '', type: '' });

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');
      
      updateProfileStore(email, phone);
      setProfileMsg({ text: 'Contact details saved securely.', type: 'success' });
      setTimeout(() => setProfileMsg({ text: '', type: '' }), 4000);
    } catch (err: any) {
      setProfileMsg({ text: err.message, type: 'error' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMsg({ text: '', type: '' });

    try {
      const res = await fetch('/api/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMsg({ text: 'Password encrypted and updated.', type: 'success' });
      setTimeout(() => setPasswordMsg({ text: '', type: '' }), 4000);
    } catch (err: any) {
      setPasswordMsg({ text: err.message, type: 'error' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white selection:bg-indigo-500/30 font-sans relative">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-900/40 via-zinc-900 to-zinc-950 pointer-events-none z-0"></div>

      <div className="max-w-4xl mx-auto px-6 py-12 relative z-10">
        
        {/* Header */}
        <button onClick={() => navigate(-1)} className="group flex items-center text-sm font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 hover:text-zinc-900 dark:text-white transition-colors mb-8">
          <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mr-3 group-hover:bg-zinc-100 dark:bg-zinc-800 transition-colors">
            <ArrowLeft size={16} />
          </div>
          Dashboard
        </button>

        {/* Profile Hero */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-12"
        >
          <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-500 flex items-center justify-center text-5xl font-bold shadow-2xl relative border-4 border-zinc-900">
            {user.username.charAt(0).toUpperCase()}
            <div className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-500 rounded-full border-4 border-zinc-900 flex items-center justify-center">
              <ShieldCheck size={14} className="text-zinc-900 dark:text-white" />
            </div>
          </div>
          <div className="text-center md:text-left pt-2">
            <h1 className="text-4xl font-bold tracking-tight mb-2">{user.username}</h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm">
              <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full border border-zinc-300 dark:border-zinc-700 font-medium">
                ID: {String(user.id).padStart(6, '0')}
              </span>
              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-300 rounded-full border border-indigo-500/20 font-medium tracking-wide">
                {user.plan || 'Free'} Plan
              </span>
            </div>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Binding Form */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xl"
          >
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              Contact Details
            </h2>
            
            {profileMsg.text && (
              <div className={`px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2 ${profileMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                <div className={`w-2 h-2 rounded-full ${profileMsg.type === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                {profileMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 ml-1">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-zinc-500 dark:text-zinc-400 group-focus-within:text-indigo-400 transition-colors" />
                  </div>
                  <input
                    type="email"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 pl-11 text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 ml-1">Phone Number</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-zinc-500 dark:text-zinc-400 group-focus-within:text-indigo-400 transition-colors" />
                  </div>
                  <input
                    type="tel"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 pl-11 text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all"
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={profileLoading}
                className="w-full mt-2 py-3 bg-zinc-100 hover:bg-white text-zinc-900 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {profileLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {profileLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </motion.div>

          {/* Password Modification Form */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xl relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[60px] pointer-events-none"></div>

            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              Security
            </h2>
            
            {passwordMsg.text && (
              <div className={`px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2 ${passwordMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                <div className={`w-2 h-2 rounded-full ${passwordMsg.type === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                {passwordMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-5 relative z-10">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 ml-1">Current Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-zinc-500 dark:text-zinc-400 group-focus-within:text-emerald-400 transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 pl-11 text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-all"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 ml-1">New Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-zinc-500 dark:text-zinc-400 group-focus-within:text-emerald-400 transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 pl-11 text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-all"
                    placeholder="Minimal 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full mt-2 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {passwordLoading ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                {passwordLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
