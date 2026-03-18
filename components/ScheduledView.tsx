import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Search, Plus, Trash2, Edit2, Play, Pause, X, Loader2, CheckCircle, AlertCircle, Send, Users, ChevronDown, StopCircle } from 'lucide-react';
import { blastApi, contactsApi, settingsApi, normalizeSettings } from '../services/api';
import { Contact, Group } from '../types';
import ConfirmModal from './ConfirmModal';
import { socketService } from '../services/socket';

interface ScheduledJob {
  id: string;
  message_type: 'TEXT' | 'IMAGE' | 'DOCUMENT';
  content: string;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused' | 'pending';
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  scheduled_at: string;
  created_at: string;
}

interface JobProgress {
  jobId: string;
  total: number;
  sent: number;
  failed: number;
  current: number;
}

const ScheduledView: React.FC = () => {
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [jobProgress, setJobProgress] = useState<Map<string, JobProgress>>(new Map());
  const [defaultDelayMs, setDefaultDelayMs] = useState(3000);

  // Create form state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [formData, setFormData] = useState({
    message: '',
    scheduledDate: '',
    scheduledTime: '',
    audienceType: 'all' as 'all' | 'specific',
    selectedGroupIds: new Set<string>(),
    selectedContactIds: new Set<string>()
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    confirmText: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'danger',
    confirmText: 'Confirm',
    onConfirm: () => {}
  });

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  // Socket.io connection for real-time updates
  useEffect(() => {
    socketService.connect();

    const handleConnect = () => {
      console.log('[ScheduledView] Socket connected');
    };

    // Job started
    const handleJobStarted = (job: any) => {
      console.log('[ScheduledView] Job started:', job.id);
      setScheduledJobs(prev => prev.map(j => 
        j.id === job.id ? { ...j, status: 'running' } : j
      ));
    };

    // Progress update
    const handleProgress = (data: { jobId: string; progress: JobProgress; lastResult: any }) => {
      setJobProgress(prev => {
        const newMap = new Map(prev);
        newMap.set(data.jobId, {
          jobId: data.jobId,
          ...data.progress
        });
        return newMap;
      });

      // Update sent/failed counts in job list
      setScheduledJobs(prev => prev.map(j => 
        j.id === data.jobId ? { 
          ...j, 
          sent_count: data.progress.sent, 
          failed_count: data.progress.failed 
        } : j
      ));
    };

    // Job completed
    const handleJobCompleted = (job: any) => {
      console.log('[ScheduledView] Job completed:', job.id);
      setScheduledJobs(prev => prev.map(j => 
        j.id === job.id ? { 
          ...j, 
          status: 'completed',
          sent_count: job.progress?.sent || j.sent_count,
          failed_count: job.progress?.failed || j.failed_count
        } : j
      ));
      setJobProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(job.id);
        return newMap;
      });
    };

    // Job paused
    const handleJobPaused = (job: any) => {
      console.log('[ScheduledView] Job paused:', job.id);
      setScheduledJobs(prev => prev.map(j => 
        j.id === job.id ? { ...j, status: 'paused' } : j
      ));
    };

    // Job failed
    const handleJobFailed = (data: { job: any; error: string }) => {
      console.log('[ScheduledView] Job failed:', data.job.id, data.error);
      setScheduledJobs(prev => prev.map(j => 
        j.id === data.job.id ? { ...j, status: 'failed' } : j
      ));
    };

    // Job cancelled
    const handleJobCancelled = (job: any) => {
      console.log('[ScheduledView] Job cancelled:', job.id);
      setScheduledJobs(prev => prev.map(j => 
        j.id === job.id ? { ...j, status: 'cancelled' } : j
      ));
    };

    socketService.on('connected', handleConnect);
    socketService.on('blast_job_started', handleJobStarted);
    socketService.on('blast_progress', handleProgress);
    socketService.on('blast_job_completed', handleJobCompleted);
    socketService.on('blast_job_paused', handleJobPaused);
    socketService.on('blast_job_failed', handleJobFailed);
    socketService.on('blast_job_cancelled', handleJobCancelled);

    return () => {
      socketService.off('connected', handleConnect);
      socketService.off('blast_job_started', handleJobStarted);
      socketService.off('blast_progress', handleProgress);
      socketService.off('blast_job_completed', handleJobCompleted);
      socketService.off('blast_job_paused', handleJobPaused);
      socketService.off('blast_job_failed', handleJobFailed);
      socketService.off('blast_job_cancelled', handleJobCancelled);
    };
  }, []);

  useEffect(() => {
    loadScheduledJobs();
    loadContactsAndGroups();
  }, []);

  const loadScheduledJobs = async () => {
    setIsLoading(true);
    try {
      const result = await blastApi.getScheduled();
      if (result.success) {
        setScheduledJobs(result.jobs);
      }
    } catch (err) {
      console.error('Failed to load scheduled jobs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadContactsAndGroups = async () => {
    try {
      const [contactsRes, groupsRes, settingsRes] = await Promise.all([
        contactsApi.getAll(),
        contactsApi.getGroups(),
        settingsApi.getAll()
      ]);
      if (contactsRes.success) setContacts(contactsRes.contacts);
      if (groupsRes.success) setGroups(groupsRes.groups);
      if (settingsRes.success) setDefaultDelayMs(normalizeSettings(settingsRes.settings).defaultDelayMs);
    } catch (err) {
      console.error('Failed to load contacts/groups:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Clock size={12} /> Scheduled
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Loader2 size={12} className="animate-spin" /> Running
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            <CheckCircle size={12} /> Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertCircle size={12} /> Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <X size={12} /> Cancelled
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
            <Pause size={12} /> Paused
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <Clock size={12} /> Pending
          </span>
        );
      default:
        return null;
    }
  };

  const getRecipientCount = () => {
    if (formData.audienceType === 'all') return contacts.length;
    
    const uniqueIds = new Set<string>();
    formData.selectedGroupIds.forEach(groupId => {
      const group = groups.find(g => g.id === groupId);
      if (group) group.contactIds.forEach(id => uniqueIds.add(id));
    });
    formData.selectedContactIds.forEach(id => uniqueIds.add(id));
    return uniqueIds.size;
  };

  const getRecipients = (): Array<{ phone: string; name: string }> => {
    const recipientMap = new Map<string, { phone: string; name: string }>();
    
    if (formData.audienceType === 'all') {
      contacts.forEach(c => recipientMap.set(c.phone, { phone: c.phone, name: c.name }));
    } else {
      formData.selectedGroupIds.forEach(groupId => {
        const group = groups.find(g => g.id === groupId);
        if (group) {
          group.contactIds.forEach(contactId => {
            const contact = contacts.find(c => c.id === contactId);
            if (contact) recipientMap.set(contact.phone, { phone: contact.phone, name: contact.name });
          });
        }
      });
      formData.selectedContactIds.forEach(contactId => {
        const contact = contacts.find(c => c.id === contactId);
        if (contact) recipientMap.set(contact.phone, { phone: contact.phone, name: contact.name });
      });
    }
    
    return Array.from(recipientMap.values());
  };

  const handleCreateScheduled = async () => {
    if (!formData.message.trim()) {
      setFormError('Message is required');
      return;
    }
    if (!formData.scheduledDate || !formData.scheduledTime) {
      setFormError('Schedule date and time are required');
      return;
    }

    const scheduledAt = new Date(`${formData.scheduledDate}T${formData.scheduledTime}`);
    if (scheduledAt <= new Date()) {
      setFormError('Scheduled time must be in the future');
      return;
    }

    const recipients = getRecipients();
    if (recipients.length === 0) {
      setFormError('No recipients selected');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = new FormData();
      payload.append('type', 'TEXT');
      payload.append('content', formData.message);
      payload.append('recipients', JSON.stringify(recipients));
      payload.append('scheduledAt', scheduledAt.toISOString());
      payload.append('delayMs', String(defaultDelayMs));

      const result = await blastApi.createScheduled(payload);
      
      if (result.success) {
        setShowCreateModal(false);
        setFormData({
          message: '',
          scheduledDate: '',
          scheduledTime: '',
          audienceType: 'all',
          selectedGroupIds: new Set(),
          selectedContactIds: new Set()
        });
        loadScheduledJobs();
      } else {
        throw new Error(result.error || 'Failed to create scheduled blast');
      }
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelScheduled = (jobId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancel Scheduled Blast?',
      message: 'This will cancel the scheduled blast. It will not be sent at the scheduled time.',
      variant: 'warning',
      confirmText: 'Cancel Blast',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await blastApi.cancelScheduled(jobId);
          loadScheduledJobs();
        } catch (err) {
          console.error('Failed to cancel:', err);
        }
      }
    });
  };

  const handlePauseJob = async (jobId: string) => {
    try {
      await blastApi.pause(jobId);
    } catch (err) {
      console.error('Failed to pause:', err);
    }
  };

  const handleResumeJob = async (jobId: string) => {
    try {
      await blastApi.resume(jobId);
    } catch (err) {
      console.error('Failed to resume:', err);
    }
  };

  const handleCancelRunningJob = (jobId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Stop Running Blast?',
      message: 'This will stop the blast immediately. Messages already sent cannot be undone.',
      variant: 'danger',
      confirmText: 'Stop Blast',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await blastApi.cancel(jobId);
        } catch (err) {
          console.error('Failed to cancel:', err);
        }
      }
    });
  };

  const handleDeleteJob = (jobId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Blast?',
      message: 'This will permanently delete this blast record. This action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await blastApi.deleteJob(jobId);
          setScheduledJobs(prev => prev.filter(j => j.id !== jobId));
        } catch (err) {
          console.error('Failed to delete:', err);
        }
      }
    });
  };

  const filteredJobs = scheduledJobs.filter(job =>
    job.content?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const upcomingJobs = filteredJobs.filter(j => j.status === 'scheduled');
  const runningJobs = filteredJobs.filter(j => j.status === 'running' || j.status === 'paused' || j.status === 'pending');
  const pastJobs = filteredJobs.filter(j => ['completed', 'failed', 'cancelled'].includes(j.status));

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Blast Terjadwal</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">Atur campaign yang akan dikirim nanti dan pantau progress-nya dari satu halaman.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-600/20 transition-colors"
        >
          <Plus size={18} />
          Jadwalkan blast
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="text-2xl font-bold text-yellow-600">{runningJobs.length}</div>
            <div className="text-sm text-gray-500">Berjalan</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{upcomingJobs.length}</div>
            <div className="text-sm text-gray-500">Akan datang</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-emerald-600">
            {scheduledJobs.filter(j => j.status === 'completed').length}
          </div>
            <div className="text-sm text-gray-500">Selesai</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">
            {scheduledJobs.reduce((acc, j) => acc + j.total_recipients, 0).toLocaleString()}
          </div>
            <div className="text-sm text-gray-500">Total penerima</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-red-600">
            {scheduledJobs.filter(j => j.status === 'failed' || j.status === 'cancelled').length}
          </div>
            <div className="text-sm text-gray-500">Gagal / batal</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-4 md:p-5 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Cari blast terjadwal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-emerald-600" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Calendar size={32} />
            </div>
            <p className="font-medium">Belum ada blast terjadwal</p>
            <p className="text-sm">Buat jadwal blast pertamamu</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {/* Running Section */}
            {runningJobs.length > 0 && (
              <div className="p-4 md:p-6">
                <h3 className="text-sm font-bold text-yellow-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Sedang berjalan
                </h3>
                <div className="space-y-3">
                  {runningJobs.map(job => {
                    const progress = jobProgress.get(job.id);
                    const progressPercent = job.total_recipients > 0 
                      ? Math.round((job.sent_count + job.failed_count) / job.total_recipients * 100) 
                      : 0;
                    
                    return (
                      <div key={job.id} className="p-4 bg-yellow-50 border border-yellow-200 rounded-2xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                          <div className="flex flex-wrap items-center gap-3">
                            {getStatusBadge(job.status)}
                            <span className="text-sm text-gray-600 font-medium">
                              {job.sent_count}/{job.total_recipients} terkirim
                              {job.failed_count > 0 && <span className="text-red-500 ml-1">({job.failed_count} gagal)</span>}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {job.status === 'running' && (
                              <button
                                onClick={() => handlePauseJob(job.id)}
                                className="p-2 text-yellow-600 hover:bg-yellow-100 rounded-lg transition-colors"
                                title="Pause"
                              >
                                <Pause size={18} />
                              </button>
                            )}
                            {job.status === 'paused' && (
                              <button
                                onClick={() => handleResumeJob(job.id)}
                                className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                title="Resume"
                              >
                                <Play size={18} />
                              </button>
                            )}
                            <button
                              onClick={() => handleCancelRunningJob(job.id)}
                              className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                              title="Cancel"
                            >
                              <StopCircle size={18} />
                            </button>
                          </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="mb-3">
                          <div className="h-2 bg-yellow-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-yellow-500 rounded-full transition-all duration-300"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                           <div className="flex justify-between mt-1 text-xs text-gray-500 gap-2">
                             <span>{progressPercent}% selesai</span>
                             <span>{job.total_recipients - job.sent_count - job.failed_count} tersisa</span>
                           </div>
                        </div>
                        
                        <p className="text-gray-700 line-clamp-1 text-sm">{job.content}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upcoming Section */}
            {upcomingJobs.length > 0 && (
              <div className="p-4 md:p-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Akan datang</h3>
                <div className="space-y-3">
                  {upcomingJobs.map(job => (
                    <div key={job.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl group">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          {getStatusBadge(job.status)}
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <Users size={14} />
                            {job.total_recipients} penerima
                          </span>
                        </div>
                        <p className="text-gray-800 font-medium line-clamp-1 mb-1">{job.content}</p>
                        <p className="text-sm text-blue-600 flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(job.scheduled_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 md:ml-4 self-end md:self-auto">
                        <button
                          onClick={() => handleCancelScheduled(job.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Cancel"
                        >
                          <X size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past Section */}
            {pastJobs.length > 0 && (
              <div className="p-4 md:p-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Riwayat terjadwal</h3>
                <div className="space-y-3">
                  {pastJobs.map(job => (
                    <div key={job.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          {getStatusBadge(job.status)}
                          <span className="text-sm text-gray-500">
                            {job.sent_count}/{job.total_recipients} terkirim
                          </span>
                        </div>
                        <p className="text-gray-700 line-clamp-1 mb-1">{job.content}</p>
                        <p className="text-sm text-gray-400 flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(job.scheduled_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors md:ml-4 self-end md:self-auto"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="bg-white rounded-3xl w-full max-w-lg relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto animate-[scaleIn_0.2s_ease-out]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Jadwalkan blast baru</h3>
                <p className="text-sm text-gray-500">Tentukan waktu kirim untuk campaign ini</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {formError}
                </div>
              )}

              {/* Message */}
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pesan *</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none h-32"
                  placeholder="Tulis pesan kamu di sini... gunakan {name} untuk personalisasi"
                />
              </div>

              {/* Schedule Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal *</label>
                  <input
                    type="date"
                    min={today}
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Waktu *</label>
                  <input
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Audience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Audiens</label>
                <div className="space-y-2">
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${formData.audienceType === 'all' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="audience"
                      checked={formData.audienceType === 'all'}
                      onChange={() => setFormData(prev => ({ ...prev, audienceType: 'all' }))}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <div className="ml-3">
                      <span className="font-medium text-gray-800">Semua kontak</span>
                      <span className="text-sm text-gray-500 ml-2">({contacts.length} kontak)</span>
                    </div>
                  </label>
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${formData.audienceType === 'specific' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="audience"
                      checked={formData.audienceType === 'specific'}
                      onChange={() => setFormData(prev => ({ ...prev, audienceType: 'specific' }))}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <div className="ml-3">
                      <span className="font-medium text-gray-800">Grup / kontak tertentu</span>
                    </div>
                  </label>
                </div>

                {formData.audienceType === 'specific' && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-xl max-h-40 overflow-y-auto">
                    <p className="text-xs font-medium text-gray-500 mb-2">Pilih grup:</p>
                    {groups.map(group => (
                      <label key={group.id} className="flex items-center gap-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.selectedGroupIds.has(group.id)}
                          onChange={(e) => {
                            const newSet = new Set(formData.selectedGroupIds);
                            if (e.target.checked) newSet.add(group.id);
                            else newSet.delete(group.id);
                            setFormData(prev => ({ ...prev, selectedGroupIds: newSet }));
                          }}
                          className="w-4 h-4 rounded text-emerald-600"
                        />
                        <span className="text-sm text-gray-700">{group.name}</span>
                        <span className="text-xs text-gray-400">({group.contactIds.length})</span>
                      </label>
                    ))}
                    <p className="text-xs font-medium text-gray-500 mt-4 mb-2">Pilih kontak:</p>
                    {contacts.map(contact => (
                      <label key={contact.id} className="flex items-center gap-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.selectedContactIds.has(contact.id)}
                          onChange={(e) => {
                            const newSet = new Set(formData.selectedContactIds);
                            if (e.target.checked) newSet.add(contact.id);
                            else newSet.delete(contact.id);
                            setFormData(prev => ({ ...prev, selectedContactIds: newSet }));
                          }}
                          className="w-4 h-4 rounded text-emerald-600"
                        />
                        <span className="text-sm text-gray-700">{contact.name}</span>
                        <span className="text-xs text-gray-400">{contact.phone}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-emerald-700">Penerima:</span>
                  <span className="font-bold text-emerald-800">{getRecipientCount()} kontak</span>
                </div>
              </div>
            </div>

              <div className="p-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                  Batal
              </button>
              <button
                onClick={handleCreateScheduled}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Calendar size={18} />}
                  Jadwalkan blast
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ScheduledView;
