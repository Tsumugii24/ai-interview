import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Building2, CheckCircle2, ChevronRight, Check } from 'lucide-react';

export default function ContactSalesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API form submission
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white selection:bg-indigo-500/30 font-sans relative flex items-center justify-center p-6 lg:p-12">
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-indigo-900/40 via-purple-900/10 to-transparent blur-[120px] rounded-full pointer-events-none mix-blend-screen"></div>

      <div className="max-w-6xl w-full grid lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-24 relative z-10">
        
        {/* Left Info Column */}
        <div className="flex flex-col justify-center">
          <button onClick={() => navigate(-1)} className="group w-max flex items-center text-sm font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 hover:text-zinc-900 dark:text-white transition-colors mb-12">
            <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mr-3 group-hover:bg-zinc-100 dark:bg-zinc-800 transition-colors">
              <ArrowLeft size={16} />
            </div>
            Back to Pricing
          </button>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
              Equip your entire team with <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Enterprise AI</span>
            </h1>
            <p className="text-lg text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 mb-10 leading-relaxed">
              We offer flexible custom pricing, dedicated support, API access, and tailored AI personas for large teams and commercial integration.
            </p>

            <div className="space-y-6">
              {[
                { title: 'Custom SSO Integration', desc: 'Securely authenticate your organization with Okta/SAML.' },
                { title: 'Unlimited Practice Quotas', desc: 'No more micro-management of individual tokens.' },
                { title: 'Advanced Team Analytics', desc: 'Detailed tracking of your team’s progress and feedback.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="mt-1 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                    <Check size={14} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-zinc-800 dark:text-zinc-200 font-semibold">{item.title}</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Form Column */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-zinc-900/50 backdrop-blur-3xl border border-zinc-200 dark:border-zinc-800/80 p-8 md:p-10 rounded-3xl shadow-2xl relative overflow-hidden"
        >
          {success ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20 px-4 animate-in fade-in zoom-in duration-500">
               <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                  <CheckCircle2 size={40} className="animate-[bounce_2s_ease-in-out_infinite]" />
               </div>
               <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">Request Received</h2>
               <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 mb-8 max-w-sm mx-auto">
                 Thank you for reaching out! Our enterprise team will review your requirements and get back to you within 24 hours.
               </p>
               <button 
                onClick={() => navigate('/pricing')}
                className="bg-white hover:bg-zinc-200 text-zinc-900 px-8 py-3 rounded-xl font-semibold transition-colors shadow-xl"
               >
                 Return to Plans
               </button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">Contact our Sales Team</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">Please fill out the form below and we'll be in touch shortly.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider ml-1">First Name</label>
                    <input required type="text" className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white transition-colors focus:outline-none" placeholder="John" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider ml-1">Last Name</label>
                    <input required type="text" className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white transition-colors focus:outline-none" placeholder="Doe" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider ml-1">Work Email</label>
                  <input required type="email" className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white transition-colors focus:outline-none" placeholder="john@company.com" />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider ml-1">Company Name</label>
                    <div className="relative flex items-center">
                      <Building2 size={18} className="absolute left-4 text-zinc-500 dark:text-zinc-400 pointer-events-none"/>
                      <input required type="text" className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl pl-11 pr-4 py-3.5 text-zinc-900 dark:text-white transition-colors focus:outline-none" placeholder="Company Inc." />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider ml-1">Team Size</label>
                    <select required className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white transition-colors focus:outline-none appearance-none">
                      <option value="" disabled selected className="text-zinc-500 dark:text-zinc-400">Select size...</option>
                      <option value="1-50">1-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-1000">201-1000 employees</option>
                      <option value="1000+">1000+ employees</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider ml-1">How can we help?</label>
                  <textarea required rows={3} className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white transition-colors focus:outline-none resize-none" placeholder="Tell us about your technical requirements and objectives..."></textarea>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-4 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] text-zinc-900 dark:text-white rounded-xl font-bold tracking-wide transition-all flex items-center justify-center gap-2 group disabled:opacity-75 disabled:cursor-wait hover:-translate-y-0.5"
                >
                  {loading ? (
                     <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>Submit Request <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                  )}
                </button>
                <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 mt-4">By submitting this form, you agree to our Privacy Policy.</p>
              </form>
            </>
          )}
        </motion.div>

      </div>
    </div>
  );
}
