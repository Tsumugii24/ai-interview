import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Info,
  Palette,
  Play,
  Search,
  Square,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useUserStore } from '../store/userStore';
import type { InterviewRecord, RecordTag } from '../types/records';
import {
  DEFAULT_TAG_COLOR,
  formatLongDateTime,
  getDisplayDuration,
  normalizeHexColor,
  withAlpha,
} from '../utils/recordUtils';

type UpdateRecordPayload = {
  name?: string;
  tags?: RecordTag[];
};

type PendingDeleteState = {
  ids: number[];
  description: string;
};

const PAGE_SIZE = 5;

export default function RecordsPage() {
  const navigate = useNavigate();
  const token = useUserStore(state => state.token);

  const [records, setRecords] = useState<InterviewRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isManageModeOpen, setIsManageModeOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);

  const [editingRecord, setEditingRecord] = useState<InterviewRecord | null>(null);
  const [editName, setEditName] = useState('');

  const [taggingRecord, setTaggingRecord] = useState<InterviewRecord | null>(null);
  const [newTag, setNewTag] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLOR);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    void fetchRecords(true);
  }, [token, navigate]);

  useEffect(() => {
    setSelectedRecordIds(prev => prev.filter(id => records.some(record => record.id === id)));
  }, [records]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTag]);

  useEffect(() => {
    if (!isManageModeOpen) {
      setSelectedRecordIds([]);
    }
  }, [isManageModeOpen]);

  const fetchRecords = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await fetch('/api/records', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.data) setRecords(json.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateRecord = async (id: number, payload: UpdateRecordPayload) => {
    try {
      await fetch(`/api/records/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      await fetchRecords();
    } catch (error) {
      console.error(error);
    }
  };

  const deleteRecords = async (ids: number[]) => {
    if (!token || !ids.length) return;

    setIsDeleting(true);
    try {
      let response: Response;
      if (ids.length === 1) {
        response = await fetch(`/api/records/${ids[0]}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        response = await fetch('/api/records/batch-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ids }),
        });
      }

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Unable to delete records.');
      }

      setPendingDelete(null);
      setSelectedRecordIds(prev => prev.filter(id => !ids.includes(id)));
      await fetchRecords();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Unable to delete records.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRename = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingRecord || !editName.trim()) return;
    void updateRecord(editingRecord.id, { name: editName.trim(), tags: editingRecord.tags });
    setEditingRecord(null);
  };

  const handleAddTag = (event: React.FormEvent) => {
    event.preventDefault();
    if (!taggingRecord || !newTag.trim()) return;

    const label = newTag.trim();
    const color = normalizeHexColor(newTagColor);
    const nextTags = taggingRecord.tags.some(tag => tag.label === label)
      ? taggingRecord.tags.map(tag => tag.label === label ? { ...tag, color } : tag)
      : [...taggingRecord.tags, { label, color }];

    void updateRecord(taggingRecord.id, { name: taggingRecord.name, tags: nextTags });
    setNewTag('');
    setNewTagColor(DEFAULT_TAG_COLOR);
    setTaggingRecord(null);
  };

  const handleRemoveTag = (record: InterviewRecord, label: string) => {
    void updateRecord(record.id, {
      name: record.name,
      tags: record.tags.filter(tag => tag.label !== label),
    });
  };

  const allTags = useMemo(() => {
    const tagMap = new Map<string, RecordTag>();
    for (const record of records) {
      for (const tag of record.tags) {
        if (!tagMap.has(tag.label)) tagMap.set(tag.label, tag);
      }
    }
    return Array.from(tagMap.values());
  }, [records]);

  const filteredRecords = useMemo(() => records.filter(record => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query
      || record.name.toLowerCase().includes(query)
      || (record.role && record.role.toLowerCase().includes(query))
      || record.tags.some(tag => tag.label.toLowerCase().includes(query));
    const matchesTag = activeTag ? record.tags.some(tag => tag.label === activeTag) : true;
    return matchesSearch && matchesTag;
  }), [records, searchQuery, activeTag]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const currentPageIds = paginatedRecords.map(record => record.id);
  const areAllCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedRecordIds.includes(id));
  const pageStart = filteredRecords.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = filteredRecords.length === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, filteredRecords.length);

  useEffect(() => {
    setCurrentPage(prev => Math.min(prev, totalPages));
  }, [totalPages]);

  const toggleRecordSelection = (recordId: number) => {
    setSelectedRecordIds(prev => prev.includes(recordId) ? prev.filter(id => id !== recordId) : [...prev, recordId]);
  };

  const toggleCurrentPageSelection = () => {
    setSelectedRecordIds(prev => (
      areAllCurrentPageSelected
        ? prev.filter(id => !currentPageIds.includes(id))
        : Array.from(new Set([...prev, ...currentPageIds]))
    ));
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300 pb-20">
      <header className="sticky top-0 w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors group">
              <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Archive size={18} className="text-indigo-600 dark:text-indigo-400" />
              Saved Records
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-10 flex gap-8">
        <aside className="w-64 shrink-0 hidden md:block">
          <div className="sticky top-28 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">Collections</h3>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => setActiveTag(null)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                    activeTag === null
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  <Archive size={16} /> All Records
                </button>
              </li>
              {allTags.map(tag => (
                <li key={tag.label}>
                  <button
                    onClick={() => setActiveTag(tag.label)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all text-left group ${
                      activeTag === tag.label
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="truncate">{tag.label}</span>
                    </div>
                    <span className="text-xs font-semibold bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-500 dark:text-zinc-400 group-hover:bg-zinc-300 dark:group-hover:bg-zinc-700">
                      {records.filter(record => record.tags.some(recordTag => recordTag.label === tag.label)).length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="flex-1 space-y-6">
          <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-xl shadow-sm">
            <div className="pl-3 text-zinc-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Search by record name, role, or tag..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full bg-transparent border-none outline-none text-sm py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
            {searchQuery ? (
              <button onClick={() => setSearchQuery('')} className="p-2 text-zinc-400 hover:text-zinc-600">
                <X size={16} />
              </button>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              {filteredRecords.length} matching records
              {filteredRecords.length > 0 ? ` | Showing ${pageStart}-${pageEnd}` : ''}
            </div>
            <button
              onClick={() => setIsManageModeOpen(prev => !prev)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                isManageModeOpen
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : 'border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <CheckSquare size={16} />
              {isManageModeOpen ? 'Done Managing' : 'Manage'}
            </button>
          </div>

          <AnimatePresence>
            {isManageModeOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Record Management</div>
                  <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    {selectedRecordIds.length > 0 ? `${selectedRecordIds.length} selected on all pages` : 'Select records to delete them in bulk'}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={toggleCurrentPageSelection} disabled={!paginatedRecords.length} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {areAllCurrentPageSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    {areAllCurrentPageSelected ? 'Clear Page' : 'Select Page'}
                  </button>
                  <button onClick={() => setSelectedRecordIds([])} disabled={!selectedRecordIds.length} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    <X size={16} />
                    Clear Selection
                  </button>
                  <button
                    onClick={() => {
                      if (!selectedRecordIds.length) return;
                      setPendingDelete({
                        ids: selectedRecordIds,
                        description: `${selectedRecordIds.length} selected record${selectedRecordIds.length === 1 ? '' : 's'}`,
                      });
                    }}
                    disabled={!selectedRecordIds.length || isDeleting}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 size={16} />
                    Delete Selected
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="space-y-4">
            {isLoading ? (
              <div className="py-20 flex justify-center text-zinc-400">Loading records...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-12 text-center shadow-sm">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Archive size={24} className="text-zinc-400" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">No records found</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                  {searchQuery ? "We couldn't find any exact matches for your search." : "You haven't saved any interview records yet."}
                </p>
              </div>
            ) : (
              <>
                {paginatedRecords.map(record => {
                  const isSelected = selectedRecordIds.includes(record.id);
                  return (
                    <div key={record.id} className={`bg-white dark:bg-zinc-900 border p-5 rounded-2xl shadow-sm flex flex-col md:flex-row gap-5 items-start transition-shadow hover:shadow-md ${isSelected ? 'border-indigo-300 dark:border-indigo-500/30 ring-2 ring-indigo-500/10' : 'border-zinc-200 dark:border-zinc-800'}`}>
                      {isManageModeOpen ? (
                        <button onClick={() => toggleRecordSelection(record.id)} className={`mt-1 rounded-lg p-1 transition-colors ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`} title={isSelected ? 'Deselect record' : 'Select record'}>
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      ) : null}
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-100 to-emerald-50 dark:from-indigo-900/40 dark:to-emerald-900/20 flex flex-col items-center justify-center shrink-0 border border-indigo-200/50 dark:border-indigo-500/20">
                        <span className="text-xl font-black text-indigo-700 dark:text-indigo-400">{record.score != null ? record.score : record.aiReportStatus === 'not_requested' ? 'AI' : '...'}</span>
                        <span className="text-[10px] font-bold text-indigo-500/80 uppercase">{record.score != null ? 'Score' : record.aiReportStatus === 'not_requested' ? 'Manual' : 'AI'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate" title={record.name}>{record.name}</h3>
                          <button onClick={() => { setEditingRecord(record); setEditName(record.name); }} className="text-zinc-400 hover:text-indigo-600 transition-colors">
                            <Edit2 size={14} />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">
                          <span className="flex items-center gap-1.5"><Clock size={13} /> {formatLongDateTime(record.createdAt)}</span>
                          <span className="flex items-center gap-1.5"><Play size={13} /> {getDisplayDuration(record)}</span>
                          {record.role ? <span className="flex items-center gap-1.5"><Info size={13} /> {record.role}</span> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {record.tags.map(tag => (
                            <div key={`${record.id}-${tag.label}`} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border group" style={{ backgroundColor: withAlpha(tag.color, '14'), borderColor: withAlpha(tag.color, '3D'), color: tag.color }}>
                              {tag.label}
                              <button onClick={() => handleRemoveTag(record, tag.label)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          <button onClick={() => { setTaggingRecord(record); setNewTag(''); setNewTagColor(DEFAULT_TAG_COLOR); }} className="px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-200 dark:border-indigo-500/30 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors flex items-center gap-1">
                            <Tag size={12} /> Add Tag
                          </button>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center md:self-center w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800">
                        <div className="flex w-full md:w-auto gap-2">
                          {isManageModeOpen ? (
                            <button
                              onClick={() => {
                                setPendingDelete({
                                  ids: [record.id],
                                  description: `"${record.name}"`,
                                });
                              }}
                              disabled={isDeleting}
                              className="w-full md:w-auto px-4 py-2.5 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-300 text-sm font-semibold rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all disabled:opacity-50"
                            >
                              Delete
                            </button>
                          ) : null}
                          <button onClick={() => navigate(`/records/${record.id}`)} className="w-full md:w-auto px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-sm font-semibold rounded-xl shadow-sm transition-all focus:ring-4 focus:ring-zinc-500/20">
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">Showing {pageStart}-{pageEnd} of {filteredRecords.length} records</div>
                  {totalPages > 1 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        <ChevronLeft size={16} />
                        Prev
                      </button>
                      {Array.from({ length: totalPages }, (_, index) => index + 1).map(pageNumber => (
                        <button key={pageNumber} onClick={() => setCurrentPage(pageNumber)} className={`min-w-10 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${pageNumber === currentPage ? 'bg-indigo-600 text-white' : 'border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                          {pageNumber}
                        </button>
                      ))}
                      <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {editingRecord ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center"><Edit2 size={18} /></div>
                <h2 className="text-lg font-bold">Rename Record</h2>
              </div>
              <form onSubmit={handleRename}>
                <input autoFocus type="text" value={editName} onChange={event => setEditName(event.target.value)} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm mb-6 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all" />
                <div className="flex gap-3">
                  <button type="button" onClick={() => setEditingRecord(null)} className="flex-1 py-2.5 rounded-xl font-medium text-sm border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-colors">Rename</button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {taggingRecord ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center"><Palette size={18} /></div>
                <h2 className="text-lg font-bold">Add Or Update Tag</h2>
              </div>
              <form onSubmit={handleAddTag} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Tag Label</label>
                  <input autoFocus type="text" placeholder="e.g. Behavior, Technical..." value={newTag} onChange={event => setNewTag(event.target.value)} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Tag Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={newTagColor} onChange={event => setNewTagColor(event.target.value)} className="w-12 h-12 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent cursor-pointer" />
                    <div className="flex-1 rounded-xl border px-4 py-3 text-sm font-medium" style={{ backgroundColor: withAlpha(newTagColor, '14'), borderColor: withAlpha(newTagColor, '3D'), color: normalizeHexColor(newTagColor) }}>
                      {newTag.trim() || 'Tag Preview'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setTaggingRecord(null)} className="flex-1 py-2.5 rounded-xl font-medium text-sm border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-colors">Save Tag</button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDelete ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 flex items-center justify-center">
                  <Trash2 size={18} />
                </div>
                <h2 className="text-lg font-bold">Confirm Deletion</h2>
              </div>

              <div className="space-y-3 mb-6">
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-7">
                  You are about to permanently delete <span className="font-semibold text-zinc-900 dark:text-white">{pendingDelete.description}</span>.
                </p>
                <div className="rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-50/70 dark:bg-rose-500/10 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-500 dark:text-rose-300 mb-1">
                    Selected Items To Remove
                  </div>
                  <div className="text-2xl font-black text-rose-600 dark:text-rose-300">
                    {pendingDelete.ids.length}
                  </div>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 rounded-xl font-medium text-sm border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void deleteRecords(pendingDelete.ids)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 rounded-xl font-medium text-sm text-white bg-rose-600 hover:bg-rose-500 shadow-sm transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
