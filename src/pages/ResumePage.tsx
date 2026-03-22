import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Upload, FileText, PlusCircle, MinusCircle, Save, X as XIcon, User, GraduationCap, Briefcase, FolderOpen, Languages, Link as LinkIcon, AlertTriangle, CheckCircle2, BookOpen, Pencil, Loader2 } from 'lucide-react';
import { useUserStore } from '../store/userStore';

interface Education {
  school: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  major: string;
  degree: string;
}

interface Experience {
  company: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  position: string;
  description: string;
}

interface Project {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  role: string;
  description: string;
  link: string;
}

interface Language {
  language: string;
  proficiency: string;
}

interface Research {
  title: string;
  authors: string;
  venue: string;
  status: string;
  date: string;
  abstract: string;
  doi: string;
}

interface ResumeData {
  name: string;
  gender: string;
  birthday: string;
  city: string;
  phone: string;
  email: string;
  graduationDate: string;
  aboutMe: string;
  education: Education[];
  experience: Experience[];
  projects: Project[];
  research: Research[];
  languages: Language[];
  portfolioLinks: string;
  githubUrl: string;
}

const SECTIONS = [
  { id: 'basic', label: 'Basic Info', icon: <User size={14} /> },
  { id: 'about', label: 'About Me', icon: <FileText size={14} /> },
  { id: 'education', label: 'Education', icon: <GraduationCap size={14} /> },
  { id: 'experience', label: 'Experience', icon: <Briefcase size={14} /> },
  { id: 'projects', label: 'Projects', icon: <FolderOpen size={14} /> },
  { id: 'research', label: 'Research', icon: <BookOpen size={14} /> },
  { id: 'languages', label: 'Languages', icon: <Languages size={14} /> },
  { id: 'portfolio', label: 'Portfolio', icon: <LinkIcon size={14} /> },
];

const emptyEducation = (): Education => ({ school: '', startDate: '', endDate: '', isCurrent: false, major: '', degree: 'Bachelor' });
const emptyExperience = (): Experience => ({ company: '', startDate: '', endDate: '', isCurrent: false, position: '', description: '' });
const emptyProject = (): Project => ({ name: '', startDate: '', endDate: '', isCurrent: false, role: '', description: '', link: '' });
const emptyLanguage = (): Language => ({ language: 'English', proficiency: 'Fluent' });
const emptyResearch = (): Research => ({ title: '', authors: '', venue: '', status: 'Published', date: '', abstract: '', doi: '' });

const defaultResume: ResumeData = {
  name: '', gender: 'Male', birthday: '', city: '', phone: '', email: '', graduationDate: '',
  aboutMe: '', education: [], experience: [], projects: [], research: [], languages: [],
  portfolioLinks: '', githubUrl: '',
};

export default function ResumePage() {
  const navigate = useNavigate();
  const token = useUserStore(s => s.token);

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [resumeData, setResumeData] = useState<ResumeData>(defaultResume);
  const [formData, setFormData] = useState<ResumeData>(defaultResume);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeSection, setActiveSection] = useState('basic');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Load resume from API
  useEffect(() => {
    if (!token) { setIsLoading(false); return; }
    fetch('/api/resume', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(res => {
        if (res.data) {
          const merged = { ...defaultResume, ...res.data };
          setResumeData(merged);
          setFormData(merged);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  const enterEdit = () => {
    setFormData({ ...resumeData });
    setValidationErrors([]);
    setMode('edit');
  };

  const cancelEdit = () => {
    setFormData({ ...resumeData });
    setValidationErrors([]);
    setMode('view');
  };

  // Convenience setters for form fields
  const set = <K extends keyof ResumeData>(key: K, value: ResumeData[K]) => setFormData(prev => ({ ...prev, [key]: value }));

  const handleFileUpload = (file: File) => {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) setUploadedFile(file);
  };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const inputBase = "w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500";
  const inputOk = inputBase + " border-zinc-200 dark:border-zinc-700 focus:ring-indigo-500/30 focus:border-indigo-500";
  const inputErr = inputBase + " border-red-400 dark:border-red-500 focus:ring-red-500/30 focus:border-red-500 bg-red-50/50 dark:bg-red-500/5";
  const fieldCls = (id: string) => validationErrors.includes(id) ? inputErr : inputOk;

  const handleSave = async () => {
    const errors: string[] = [];
    if (!formData.name.trim()) errors.push('basic-name');
    if (!formData.birthday) errors.push('basic-birthday');
    if (!formData.city.trim()) errors.push('basic-city');
    if (!formData.phone.trim()) errors.push('basic-phone');
    if (!formData.email.trim()) errors.push('basic-email');
    if (!formData.graduationDate) errors.push('basic-graduation');

    formData.education.forEach((edu, i) => {
      if (!edu.school.trim()) errors.push(`edu-${i}-school`);
      if (!edu.startDate) errors.push(`edu-${i}-start`);
      if (!edu.isCurrent && !edu.endDate) errors.push(`edu-${i}-end`);
      if (!edu.major.trim()) errors.push(`edu-${i}-major`);
    });
    formData.experience.forEach((exp, i) => {
      if (!exp.company.trim()) errors.push(`exp-${i}-company`);
      if (!exp.startDate) errors.push(`exp-${i}-start`);
      if (!exp.isCurrent && !exp.endDate) errors.push(`exp-${i}-end`);
      if (!exp.position.trim()) errors.push(`exp-${i}-position`);
      if (!exp.description.trim()) errors.push(`exp-${i}-description`);
    });
    formData.projects.forEach((proj, i) => {
      if (!proj.name.trim()) errors.push(`proj-${i}-name`);
      if (!proj.startDate) errors.push(`proj-${i}-start`);
      if (!proj.isCurrent && !proj.endDate) errors.push(`proj-${i}-end`);
      if (!proj.role.trim()) errors.push(`proj-${i}-role`);
      if (!proj.description.trim()) errors.push(`proj-${i}-description`);
    });
    formData.research.forEach((res, i) => {
      if (!res.title.trim()) errors.push(`res-${i}-title`);
      if (!res.authors.trim()) errors.push(`res-${i}-authors`);
      if (!res.venue.trim()) errors.push(`res-${i}-venue`);
      if (!res.date) errors.push(`res-${i}-date`);
    });

    setValidationErrors(errors);
    if (errors.length > 0) {
      setToast({ message: `Please fill in all required fields (${errors.length} missing).`, type: 'error' });
      setTimeout(() => { const el = document.getElementById(errors[0]); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); } }, 100);
      return;
    }

    setIsSaving(true);
    try {
      const resp = await fetch('/api/resume', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: formData }),
      });
      if (!resp.ok) throw new Error();
      setResumeData({ ...formData });
      setMode('view');
      setToast({ message: 'Resume saved successfully!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save resume. Please try again.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const hasData = resumeData.name.trim().length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  // ────────── VIEW MODE ──────────
  if (mode === 'view') {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300">
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors group">
                <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
              </button>
              <h1 className="text-xl font-bold tracking-tight">My Resume</h1>
            </div>
            <button onClick={enterEdit} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all shadow-sm hover:-translate-y-0.5">
              <Pencil size={15} />
              Edit Resume
            </button>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-6 py-10">
          {!hasData ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24">
              <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-zinc-200 dark:border-zinc-700">
                <FileText size={36} className="text-zinc-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3">No resume yet</h2>
              <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-md mx-auto">Create your resume to get a more personalized and effective mock interview experience.</p>
              <button onClick={enterEdit} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all shadow-md hover:-translate-y-0.5">
                <Pencil size={16} className="inline mr-2 -mt-0.5" />
                Create Resume
              </button>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
              {/* Basic Info Card */}
              <ViewSection title="Basic Information">
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                  <ViewField label="Full Name" value={resumeData.name} />
                  <ViewField label="Gender" value={resumeData.gender} />
                  <ViewField label="Birthday" value={resumeData.birthday} />
                  <ViewField label="City" value={resumeData.city} />
                  <ViewField label="Phone" value={resumeData.phone} />
                  <ViewField label="Email" value={resumeData.email} />
                  <ViewField label="Graduation" value={resumeData.graduationDate} />
                </div>
              </ViewSection>

              {resumeData.aboutMe && (
                <ViewSection title="About Me">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{resumeData.aboutMe}</p>
                </ViewSection>
              )}

              {resumeData.education.length > 0 && (
                <ViewSection title="Education">
                  <div className="space-y-4">
                    {resumeData.education.map((edu, i) => (
                      <div key={i} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                        <div className="font-semibold text-sm">{edu.school}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{edu.major} · {edu.degree} · {edu.startDate} – {edu.isCurrent ? 'Present' : edu.endDate}</div>
                      </div>
                    ))}
                  </div>
                </ViewSection>
              )}

              {resumeData.experience.length > 0 && (
                <ViewSection title="Work Experience">
                  <div className="space-y-4">
                    {resumeData.experience.map((exp, i) => (
                      <div key={i} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                        <div className="font-semibold text-sm">{exp.company} – {exp.position}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate}</div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2 whitespace-pre-wrap">{exp.description}</p>
                      </div>
                    ))}
                  </div>
                </ViewSection>
              )}

              {resumeData.projects.length > 0 && (
                <ViewSection title="Project Experience">
                  <div className="space-y-4">
                    {resumeData.projects.map((proj, i) => (
                      <div key={i} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                        <div className="font-semibold text-sm">{proj.name} <span className="text-zinc-500 font-normal">· {proj.role}</span></div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{proj.startDate} – {proj.isCurrent ? 'Present' : proj.endDate}</div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2 whitespace-pre-wrap">{proj.description}</p>
                        {proj.link && <a href={proj.link} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block">{proj.link}</a>}
                      </div>
                    ))}
                  </div>
                </ViewSection>
              )}

              {resumeData.research.length > 0 && (
                <ViewSection title="Research Experience">
                  <div className="space-y-4">
                    {resumeData.research.map((res, i) => (
                      <div key={i} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                        <div className="font-semibold text-sm">{res.title}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{res.authors}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{res.venue} · <span className="font-medium">{res.status}</span> · {res.date}</div>
                        {res.abstract && <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2 whitespace-pre-wrap">{res.abstract}</p>}
                        {res.doi && <a href={res.doi} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block">{res.doi}</a>}
                      </div>
                    ))}
                  </div>
                </ViewSection>
              )}

              {resumeData.languages.length > 0 && (
                <ViewSection title="Language Skills">
                  <div className="flex flex-wrap gap-3">
                    {resumeData.languages.map((lang, i) => (
                      <span key={i} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-sm font-medium border border-zinc-200 dark:border-zinc-700">
                        {lang.language} · <span className="text-zinc-500 dark:text-zinc-400">{lang.proficiency}</span>
                      </span>
                    ))}
                  </div>
                </ViewSection>
              )}

              {(resumeData.portfolioLinks || resumeData.githubUrl) && (
                <ViewSection title="Portfolio & Links">
                  {resumeData.githubUrl && <ViewField label="GitHub" value={resumeData.githubUrl} isLink />}
                  {resumeData.portfolioLinks && (
                    <div className="mt-3">
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Links</span>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap mt-1">{resumeData.portfolioLinks}</p>
                    </div>
                  )}
                </ViewSection>
              )}
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  // ────────── EDIT MODE ──────────
  const d = formData; // shorthand
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={cancelEdit} className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors group">
              <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <h1 className="text-xl font-bold tracking-tight">Edit Resume</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={cancelEdit} className="px-5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
              Cancel
            </button>
            <button onClick={handleSave} disabled={isSaving} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all shadow-sm hover:-translate-y-0.5 disabled:opacity-60">
              {isSaving ? <Loader2 size={16} className="inline animate-spin mr-1.5 -mt-0.5" /> : <Save size={16} className="inline mr-1.5 -mt-0.5" />}
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 flex gap-8">
        <main className="flex-1 space-y-10">

          {/* Resume Upload */}
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <SectionHeading title="Resume Upload" />
            <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={() => setIsDragging(false)}
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${isDragging
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                : 'border-zinc-300 dark:border-zinc-700 hover:border-indigo-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                }`}>
              {uploadedFile ? (
                <div className="space-y-3">
                  <div className="w-14 h-14 bg-red-50 dark:bg-red-500/10 rounded-xl flex items-center justify-center mx-auto border border-red-200 dark:border-red-500/20">
                    <FileText size={28} className="text-red-500" />
                  </div>
                  <p className="font-semibold text-sm">{uploadedFile.name}</p>
                  <div className="flex items-center justify-center gap-4 text-sm">
                    <label className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium">
                      Re-upload
                      <input type="file" accept=".pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />
                    </label>
                    <span className="text-zinc-300 dark:text-zinc-600">|</span>
                    <button onClick={() => setUploadedFile(null)} className="text-red-500 hover:underline font-medium">Delete</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center mx-auto border border-zinc-200 dark:border-zinc-700">
                    <Upload size={28} className="text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">Drag & drop your resume here, or</p>
                    <label className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer text-sm font-semibold">
                      browse to upload
                      <input type="file" accept=".pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />
                    </label>
                  </div>
                  <p className="text-xs text-zinc-400">Supports PDF format only</p>
                </div>
              )}
            </div>
          </motion.section>

          {/* Basic Information */}
          <motion.section id="section-basic" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <SectionHeading title="Basic Information" />
            <div className="space-y-5">
              <FormRow label="Full Name" required>
                <input id="basic-name" type="text" value={d.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" className={fieldCls('basic-name')} />
              </FormRow>
              <FormRow label="Gender" required>
                <select value={d.gender} onChange={e => set('gender', e.target.value)} className={inputOk + ' appearance-none'}>
                  <option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option>
                </select>
              </FormRow>
              <FormRow label="Birthday" required>
                <input id="basic-birthday" type="date" value={d.birthday} onChange={e => set('birthday', e.target.value)} className={fieldCls('basic-birthday')} />
              </FormRow>
              <FormRow label="City" required>
                <input id="basic-city" type="text" value={d.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Shanghai" className={fieldCls('basic-city')} />
              </FormRow>
              <FormRow label="Phone" required>
                <input id="basic-phone" type="tel" value={d.phone} onChange={e => set('phone', e.target.value)} placeholder="Your phone number" className={fieldCls('basic-phone')} />
              </FormRow>
              <FormRow label="Email" required>
                <input id="basic-email" type="email" value={d.email} onChange={e => set('email', e.target.value)} placeholder="name@example.com" className={fieldCls('basic-email')} />
              </FormRow>
              <FormRow label="Graduation" required>
                <input id="basic-graduation" type="month" value={d.graduationDate} onChange={e => set('graduationDate', e.target.value)} className={fieldCls('basic-graduation')} />
              </FormRow>
            </div>
          </motion.section>

          {/* About Me */}
          <motion.section id="section-about" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <SectionHeading title="About Me" />
            <FormRow label="Bio">
              <textarea value={d.aboutMe} onChange={e => set('aboutMe', e.target.value)} rows={4} placeholder="Tell us about yourself..." className={inputOk + " resize-none"} />
            </FormRow>
          </motion.section>

          {/* Education */}
          <EditableList
            sectionId="education" title="Education" items={d.education} delay={0.15}
            onAdd={() => set('education', [...d.education, emptyEducation()])}
            onRemove={i => set('education', d.education.filter((_, j) => j !== i))}
            emptyLabel="No education entries yet."
            addLabel="Add Education"
            renderItem={(edu, idx) => (
              <>
                <FormRow label="School" required>
                  <input id={`edu-${idx}-school`} type="text" value={edu.school} onChange={e => { const n = [...d.education]; n[idx].school = e.target.value; set('education', n); }} placeholder="University name" className={fieldCls(`edu-${idx}-school`)} />
                </FormRow>
                <FormRow label="Duration" required>
                  <div className="flex items-center gap-2 w-full">
                    <input id={`edu-${idx}-start`} type="month" value={edu.startDate} onChange={e => { const n = [...d.education]; n[idx].startDate = e.target.value; set('education', n); }} className={fieldCls(`edu-${idx}-start`) + " flex-1"} />
                    <span className="text-zinc-400 text-sm shrink-0">to</span>
                    <input id={`edu-${idx}-end`} type="month" value={edu.endDate} disabled={edu.isCurrent} onChange={e => { const n = [...d.education]; n[idx].endDate = e.target.value; set('education', n); }} className={fieldCls(`edu-${idx}-end`) + " flex-1" + (edu.isCurrent ? " opacity-40" : "")} />
                    <label className="flex items-center gap-1.5 text-xs text-zinc-500 shrink-0 cursor-pointer select-none">
                      <input type="checkbox" checked={edu.isCurrent} onChange={e => { const n = [...d.education]; n[idx].isCurrent = e.target.checked; set('education', n); }} className="rounded accent-indigo-600" />
                      Present
                    </label>
                  </div>
                </FormRow>
                <FormRow label="Major" required>
                  <input id={`edu-${idx}-major`} type="text" value={edu.major} onChange={e => { const n = [...d.education]; n[idx].major = e.target.value; set('education', n); }} placeholder="e.g. Computer Science" className={fieldCls(`edu-${idx}-major`)} />
                </FormRow>
                <FormRow label="Degree" required>
                  <select value={edu.degree} onChange={e => { const n = [...d.education]; n[idx].degree = e.target.value; set('education', n); }} className={inputOk + ' appearance-none'}>
                    <option>Bachelor</option><option>Master</option><option>PhD</option><option>Associate</option><option>Other</option>
                  </select>
                </FormRow>
              </>
            )}
          />

          {/* Work Experience */}
          <EditableList
            sectionId="experience" title="Work Experience" items={d.experience} delay={0.2}
            onAdd={() => set('experience', [...d.experience, emptyExperience()])}
            onRemove={i => set('experience', d.experience.filter((_, j) => j !== i))}
            emptyLabel="No work experience entries yet." addLabel="Add Experience"
            renderItem={(exp, idx) => (
              <>
                <FormRow label="Company" required><input id={`exp-${idx}-company`} type="text" value={exp.company} onChange={e => { const n = [...d.experience]; n[idx].company = e.target.value; set('experience', n); }} placeholder="Company name" className={fieldCls(`exp-${idx}-company`)} /></FormRow>
                <FormRow label="Duration" required>
                  <div className="flex items-center gap-2 w-full">
                    <input id={`exp-${idx}-start`} type="month" value={exp.startDate} onChange={e => { const n = [...d.experience]; n[idx].startDate = e.target.value; set('experience', n); }} className={fieldCls(`exp-${idx}-start`) + " flex-1"} />
                    <span className="text-zinc-400 text-sm shrink-0">to</span>
                    <input id={`exp-${idx}-end`} type="month" value={exp.endDate} disabled={exp.isCurrent} onChange={e => { const n = [...d.experience]; n[idx].endDate = e.target.value; set('experience', n); }} className={fieldCls(`exp-${idx}-end`) + " flex-1" + (exp.isCurrent ? " opacity-40" : "")} />
                    <label className="flex items-center gap-1.5 text-xs text-zinc-500 shrink-0 cursor-pointer select-none"><input type="checkbox" checked={exp.isCurrent} onChange={e => { const n = [...d.experience]; n[idx].isCurrent = e.target.checked; set('experience', n); }} className="rounded accent-indigo-600" />Present</label>
                  </div>
                </FormRow>
                <FormRow label="Position" required><input id={`exp-${idx}-position`} type="text" value={exp.position} onChange={e => { const n = [...d.experience]; n[idx].position = e.target.value; set('experience', n); }} placeholder="Job title" className={fieldCls(`exp-${idx}-position`)} /></FormRow>
                <FormRow label="Description" required><textarea id={`exp-${idx}-description`} value={exp.description} onChange={e => { const n = [...d.experience]; n[idx].description = e.target.value; set('experience', n); }} rows={4} placeholder="Describe your responsibilities..." className={fieldCls(`exp-${idx}-description`) + " resize-none"} /></FormRow>
              </>
            )}
          />

          {/* Projects */}
          <EditableList
            sectionId="projects" title="Project Experience" items={d.projects} delay={0.25}
            onAdd={() => set('projects', [...d.projects, emptyProject()])}
            onRemove={i => set('projects', d.projects.filter((_, j) => j !== i))}
            emptyLabel="No project entries yet." addLabel="Add Project"
            renderItem={(proj, idx) => (
              <>
                <FormRow label="Project" required><input id={`proj-${idx}-name`} type="text" value={proj.name} onChange={e => { const n = [...d.projects]; n[idx].name = e.target.value; set('projects', n); }} placeholder="Project name" className={fieldCls(`proj-${idx}-name`)} /></FormRow>
                <FormRow label="Duration" required>
                  <div className="flex items-center gap-2 w-full">
                    <input id={`proj-${idx}-start`} type="month" value={proj.startDate} onChange={e => { const n = [...d.projects]; n[idx].startDate = e.target.value; set('projects', n); }} className={fieldCls(`proj-${idx}-start`) + " flex-1"} />
                    <span className="text-zinc-400 text-sm shrink-0">to</span>
                    <input id={`proj-${idx}-end`} type="month" value={proj.endDate} disabled={proj.isCurrent} onChange={e => { const n = [...d.projects]; n[idx].endDate = e.target.value; set('projects', n); }} className={fieldCls(`proj-${idx}-end`) + " flex-1" + (proj.isCurrent ? " opacity-40" : "")} />
                    <label className="flex items-center gap-1.5 text-xs text-zinc-500 shrink-0 cursor-pointer select-none"><input type="checkbox" checked={proj.isCurrent} onChange={e => { const n = [...d.projects]; n[idx].isCurrent = e.target.checked; set('projects', n); }} className="rounded accent-indigo-600" />Present</label>
                  </div>
                </FormRow>
                <FormRow label="Role" required><input id={`proj-${idx}-role`} type="text" value={proj.role} onChange={e => { const n = [...d.projects]; n[idx].role = e.target.value; set('projects', n); }} placeholder="e.g. Team Lead" className={fieldCls(`proj-${idx}-role`)} /></FormRow>
                <FormRow label="Description" required><textarea id={`proj-${idx}-description`} value={proj.description} onChange={e => { const n = [...d.projects]; n[idx].description = e.target.value; set('projects', n); }} rows={4} placeholder="Describe the project..." className={fieldCls(`proj-${idx}-description`) + " resize-none"} /></FormRow>
                <FormRow label="Link"><input type="url" value={proj.link} onChange={e => { const n = [...d.projects]; n[idx].link = e.target.value; set('projects', n); }} placeholder="https://github.com/..." className={inputOk} /></FormRow>
              </>
            )}
          />

          {/* Research */}
          <EditableList
            sectionId="research" title="Research Experience" items={d.research} delay={0.28}
            onAdd={() => set('research', [...d.research, emptyResearch()])}
            onRemove={i => set('research', d.research.filter((_, j) => j !== i))}
            emptyLabel="No research entries yet." addLabel="Add Research"
            renderItem={(res, idx) => (
              <>
                <FormRow label="Paper Title" required><input id={`res-${idx}-title`} type="text" value={res.title} onChange={e => { const n = [...d.research]; n[idx].title = e.target.value; set('research', n); }} placeholder="e.g. Attention Is All You Need" className={fieldCls(`res-${idx}-title`)} /></FormRow>
                <FormRow label="Authors" required><input id={`res-${idx}-authors`} type="text" value={res.authors} onChange={e => { const n = [...d.research]; n[idx].authors = e.target.value; set('research', n); }} placeholder="Comma-separated" className={fieldCls(`res-${idx}-authors`)} /></FormRow>
                <FormRow label="Venue" required><input id={`res-${idx}-venue`} type="text" value={res.venue} onChange={e => { const n = [...d.research]; n[idx].venue = e.target.value; set('research', n); }} placeholder="e.g. NeurIPS 2024" className={fieldCls(`res-${idx}-venue`)} /></FormRow>
                <FormRow label="Status" required>
                  <select value={res.status} onChange={e => { const n = [...d.research]; n[idx].status = e.target.value; set('research', n); }} className={inputOk + ' appearance-none'}>
                    <option>Published</option><option>Accepted</option><option>Under Review</option><option>Submitted</option><option>Preprint</option><option>In Preparation</option>
                  </select>
                </FormRow>
                <FormRow label="Date" required><input id={`res-${idx}-date`} type="month" value={res.date} onChange={e => { const n = [...d.research]; n[idx].date = e.target.value; set('research', n); }} className={fieldCls(`res-${idx}-date`)} /></FormRow>
                <FormRow label="Abstract"><textarea value={res.abstract} onChange={e => { const n = [...d.research]; n[idx].abstract = e.target.value; set('research', n); }} rows={3} placeholder="Brief summary..." className={inputOk + " resize-none"} /></FormRow>
                <FormRow label="DOI / Link"><input type="url" value={res.doi} onChange={e => { const n = [...d.research]; n[idx].doi = e.target.value; set('research', n); }} placeholder="https://doi.org/..." className={inputOk} /></FormRow>
              </>
            )}
          />

          {/* Languages */}
          <EditableList
            sectionId="languages" title="Language Skills" items={d.languages} delay={0.3}
            onAdd={() => set('languages', [...d.languages, emptyLanguage()])}
            onRemove={i => set('languages', d.languages.filter((_, j) => j !== i))}
            emptyLabel="No language entries yet." addLabel="Add Language"
            renderItem={(lang, idx) => (
              <>
                <FormRow label="Language" required>
                  <select value={lang.language} onChange={e => { const n = [...d.languages]; n[idx].language = e.target.value; set('languages', n); }} className={inputOk + ' appearance-none'}>
                    <option>English</option><option>Chinese</option><option>Japanese</option><option>Korean</option><option>Spanish</option><option>French</option><option>German</option><option>Other</option>
                  </select>
                </FormRow>
                <FormRow label="Proficiency" required>
                  <select value={lang.proficiency} onChange={e => { const n = [...d.languages]; n[idx].proficiency = e.target.value; set('languages', n); }} className={inputOk + ' appearance-none'}>
                    <option>Native</option><option>Fluent</option><option>Advanced</option><option>Intermediate</option><option>Basic</option>
                  </select>
                </FormRow>
              </>
            )}
          />

          {/* Portfolio */}
          <motion.section id="section-portfolio" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <SectionHeading title="Portfolio & Links" />
            <div className="space-y-5">
              <FormRow label="Links"><textarea value={d.portfolioLinks} onChange={e => set('portfolioLinks', e.target.value)} rows={3} placeholder="Portfolio links, one per line..." className={inputOk + " resize-none"} /></FormRow>
              <FormRow label="GitHub"><input type="url" value={d.githubUrl} onChange={e => set('githubUrl', e.target.value)} placeholder="https://github.com/yourname" className={inputOk} /></FormRow>
            </div>
          </motion.section>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-6 pb-10 border-t border-zinc-200 dark:border-zinc-800">
            <p className="text-xs text-zinc-400">By saving your resume, you agree to our <button className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Privacy Policy</button>.</p>
            <div className="flex gap-3">
              <button onClick={cancelEdit} className="px-6 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">Cancel</button>
              <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all shadow-sm hover:-translate-y-0.5 disabled:opacity-60">
                {isSaving ? 'Saving...' : 'Save Resume'}
              </button>
            </div>
          </div>
        </main>

        {/* Sidebar */}
        <aside className="hidden lg:block w-36 shrink-0">
          <nav className="sticky top-24 space-y-0.5">
            {SECTIONS.map(sec => (
              <button key={sec.id} onClick={() => scrollToSection(sec.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${activeSection === sec.id
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-r-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}>
                {sec.icon}
                {sec.label}
              </button>
            ))}
          </nav>
        </aside>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-md text-sm font-medium ${toast.type === 'error'
              ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400'
              : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
              }`}>
            {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            {toast.message}
            <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100 transition-opacity"><XIcon size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Sub-components ── */

function ViewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 bg-indigo-600 dark:bg-indigo-500 rounded-full" />
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ViewField({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div className="py-1">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{label}</span>
      {isLink 
        ? <a href={value} target="_blank" rel="noreferrer" className="block text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-0.5">{value}</a>
        : <p className="text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">{value || '—'}</p>
      }
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <div className="w-1 h-6 bg-indigo-600 dark:bg-indigo-500 rounded-full" />
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
    </div>
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <div className="text-center py-8 text-sm text-zinc-400 dark:text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl mb-2">
      {label}
    </div>
  );
}

function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-5">
      <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 w-24 shrink-0 text-right pt-3 select-none">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div className="flex justify-center mt-4">
      <button onClick={onClick} className="flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-5 py-2.5 rounded-xl transition-all border border-indigo-100 dark:border-indigo-500/20">
        <PlusCircle size={16} />{label}
      </button>
    </div>
  );
}

type ListItem = Education | Experience | Project | Research | Language;

function EditableList({ sectionId, title, items, delay, onAdd, onRemove, emptyLabel, addLabel, renderItem }: {
  sectionId: string; title: string; items: ListItem[]; delay: number;
  onAdd: () => void; onRemove: (i: number) => void;
  emptyLabel: string; addLabel: string;
  renderItem: (item: any, index: number) => React.ReactNode;
}) {
  return (
    <motion.section id={`section-${sectionId}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <SectionHeading title={title} />
      {items.length === 0 ? (
        <EmptySection label={emptyLabel} />
      ) : (
        <div className="space-y-6">
          {items.map((item, idx) => (
            <div key={idx} className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-lg">{String(idx + 1).padStart(2, '0')}</span>
                <button onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-500 transition-colors"><MinusCircle size={22} /></button>
              </div>
              {renderItem(item, idx)}
            </div>
          ))}
        </div>
      )}
      <AddButton onClick={onAdd} label={addLabel} />
    </motion.section>
  );
}
