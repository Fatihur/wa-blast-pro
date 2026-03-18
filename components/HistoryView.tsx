import React, { useEffect, useState } from 'react';
import {
  History,
  Search,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  Eye,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MessageSquareText,
  Image as ImageIcon,
  FileText,
  BarChart3,
  MapPin,
} from 'lucide-react';
import { blastApi } from '../services/api';
import ConfirmModal from './ConfirmModal';

interface BlastJob {
  id: string;
  message_type: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'POLL' | 'LOCATION';
  content: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

const HistoryView: React.FC = () => {
  const [jobs, setJobs] = useState<BlastJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<BlastJob | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const result = await blastApi.getHistory(100);
      if (result.success) {
        setJobs(result.jobs);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><CheckCircle size={12} /> Completed</span>;
      case 'failed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle size={12} /> Failed</span>;
      case 'running':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Loader2 size={12} className="animate-spin" /> Running</span>;
      case 'paused':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock size={12} /> Paused</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"><Clock size={12} /> Pending</span>;
    }
  };

  const getMessageTypeIcon = (type: BlastJob['message_type']) => {
    switch (type) {
      case 'IMAGE':
        return <ImageIcon size={18} className="text-blue-500" />;
      case 'DOCUMENT':
        return <FileText size={18} className="text-red-500" />;
      case 'POLL':
        return <BarChart3 size={18} className="text-violet-500" />;
      case 'LOCATION':
        return <MapPin size={18} className="text-amber-500" />;
      default:
        return <MessageSquareText size={18} className="text-emerald-500" />;
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.content?.toLowerCase().includes(searchTerm.toLowerCase()) || job.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, '...', totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }
    return pages;
  };

  const handleDelete = (jobId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Blast History?',
      message: 'This will permanently delete this blast record from history. This action cannot be undone.',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await blastApi.deleteJob(jobId);
          setJobs(prev => prev.filter(job => job.id !== jobId));
          if (selectedJob?.id === jobId) setSelectedJob(null);
        } catch (error) {
          console.error('Failed to delete history item:', error);
        }
      },
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Riwayat Blast</h1>
        <p className="text-sm md:text-base text-gray-500 mt-1">Lihat performa campaign yang sudah terkirim dan kelola riwayatnya dengan lebih mudah.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"><div className="text-2xl font-bold text-gray-900">{jobs.length}</div><div className="text-sm text-gray-500">Total campaign</div></div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"><div className="text-2xl font-bold text-emerald-600">{jobs.filter(job => job.status === 'completed').length}</div><div className="text-sm text-gray-500">Selesai</div></div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"><div className="text-2xl font-bold text-blue-600">{jobs.reduce((acc, job) => acc + job.sent_count, 0).toLocaleString()}</div><div className="text-sm text-gray-500">Pesan terkirim</div></div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"><div className="text-2xl font-bold text-red-600">{jobs.reduce((acc, job) => acc + job.failed_count, 0).toLocaleString()}</div><div className="text-sm text-gray-500">Gagal</div></div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Cari isi pesan atau ID job..." value={searchTerm} onChange={event => setSearchTerm(event.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer">
                <option value="all">Semua status</option>
                <option value="completed">Selesai</option>
                <option value="running">Berjalan</option>
                <option value="paused">Dijeda</option>
                <option value="failed">Gagal</option>
                <option value="pending">Menunggu</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <button onClick={loadHistory} className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors">Muat ulang</button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-emerald-600" /></div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4"><History size={32} /></div>
            <p className="font-medium">Belum ada riwayat blast</p>
            <p className="text-sm">Campaign yang sudah berjalan akan muncul di sini</p>
          </div>
        ) : (
          <>
          <div className="md:hidden divide-y divide-gray-50">
            {paginatedJobs.map(job => {
              const successRate = job.total_recipients > 0 ? Math.round((job.sent_count / job.total_recipients) * 100) : 0;
              return (
                <div key={job.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <Calendar size={12} />
                        <span>{formatDate(job.created_at)}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">{job.content || 'Tanpa isi pesan'}</p>
                    </div>
                    <div className="shrink-0">{getStatusBadge(job.status)}</div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    {getMessageTypeIcon(job.message_type)}
                    <span>{job.message_type}</span>
                    <span className="text-gray-300">•</span>
                    <span>{job.total_recipients} kontak</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Keberhasilan</span>
                      <span>{successRate}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${successRate >= 80 ? 'bg-emerald-500' : successRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${successRate}%` }} />
                    </div>
                    <div className="mt-1 text-xs text-gray-400">{job.sent_count} terkirim, {job.failed_count} gagal</div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => setSelectedJob(job)} className="flex-1 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium">Detail</button>
                    <button onClick={() => handleDelete(job.id)} className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-medium">Hapus</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Date</th>
                  <th className="px-6 py-4 text-left font-semibold">Message</th>
                  <th className="px-6 py-4 text-left font-semibold">Type</th>
                  <th className="px-6 py-4 text-left font-semibold">Recipients</th>
                  <th className="px-6 py-4 text-left font-semibold">Status</th>
                  <th className="px-6 py-4 text-left font-semibold">Success Rate</th>
                  <th className="px-6 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedJobs.map(job => {
                  const successRate = job.total_recipients > 0 ? Math.round((job.sent_count / job.total_recipients) * 100) : 0;
                  return (
                    <tr key={job.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-6 py-4"><div className="flex items-center gap-2 text-gray-600"><Calendar size={14} className="text-gray-400" /><span className="text-sm">{formatDate(job.created_at)}</span></div></td>
                      <td className="px-6 py-4"><p className="text-gray-800 text-sm line-clamp-2 max-w-xs">{job.content || <span className="text-gray-400 italic">No text content</span>}</p></td>
                      <td className="px-6 py-4"><span className="inline-flex items-center justify-center" title={job.message_type}>{getMessageTypeIcon(job.message_type)}</span></td>
                      <td className="px-6 py-4"><div className="text-sm"><span className="font-medium text-gray-900">{job.total_recipients}</span><span className="text-gray-400 ml-1">contacts</span></div></td>
                      <td className="px-6 py-4">{getStatusBadge(job.status)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[80px]"><div className={`h-full rounded-full ${successRate >= 80 ? 'bg-emerald-500' : successRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${successRate}%` }} /></div>
                          <span className="text-sm font-medium text-gray-700">{successRate}%</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{job.sent_count} sent, {job.failed_count} failed</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setSelectedJob(job)} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="View Details"><Eye size={18} /></button>
                          <button onClick={() => handleDelete(job.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {!isLoading && filteredJobs.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500">Menampilkan <span className="font-medium text-gray-700">{startIndex + 1}</span> - <span className="font-medium text-gray-700">{Math.min(endIndex, filteredJobs.length)}</span> dari <span className="font-medium text-gray-700">{filteredJobs.length}</span> data</div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-4">
                <span className="text-sm text-gray-500">Per halaman:</span>
                <select value={itemsPerPage} onChange={event => { setItemsPerPage(Number(event.target.value)); setCurrentPage(1); }} className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <button onClick={() => goToPage(1)} disabled={currentPage === 1} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="Halaman pertama"><ChevronsLeft size={18} /></button>
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="Sebelumnya"><ChevronLeft size={18} /></button>
              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, index) => typeof page === 'number' ? (
                  <button key={index} onClick={() => goToPage(page)} className={`min-w-[36px] h-9 px-3 text-sm font-medium rounded-lg transition-colors ${currentPage === page ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{page}</button>
                ) : (
                  <span key={index} className="px-2 text-gray-400">...</span>
                ))}
              </div>
              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="Selanjutnya"><ChevronRight size={18} /></button>
              <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="Halaman terakhir"><ChevronsRight size={18} /></button>
            </div>
          </div>
        )}
      </div>

      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedJob(null)} />
          <div className="bg-white rounded-3xl w-full max-w-lg relative z-10 shadow-2xl animate-[scaleIn_0.2s_ease-out] max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl">
              <h3 className="text-xl font-bold text-gray-900">Blast Details</h3>
              <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status</label><div className="mt-1">{getStatusBadge(selectedJob.status)}</div></div>
              <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Created At</label><p className="text-gray-800 mt-1">{formatDate(selectedJob.created_at)}</p></div>
              {selectedJob.completed_at && <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Completed At</label><p className="text-gray-800 mt-1">{formatDate(selectedJob.completed_at)}</p></div>}
              <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Message Type</label><p className="text-gray-800 mt-1 flex items-center gap-2"><span className="inline-flex items-center justify-center">{getMessageTypeIcon(selectedJob.message_type)}</span>{selectedJob.message_type}</p></div>
              <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Message Content</label><div className="mt-2 p-4 bg-gray-50 rounded-xl text-gray-800 whitespace-pre-wrap text-sm">{selectedJob.content || <span className="text-gray-400 italic">No text content</span>}</div></div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                <div className="text-center p-3 bg-gray-50 rounded-xl"><div className="text-2xl font-bold text-gray-900">{selectedJob.total_recipients}</div><div className="text-xs text-gray-500">Total</div></div>
                <div className="text-center p-3 bg-emerald-50 rounded-xl"><div className="text-2xl font-bold text-emerald-600">{selectedJob.sent_count}</div><div className="text-xs text-emerald-600">Sent</div></div>
                <div className="text-center p-3 bg-red-50 rounded-xl"><div className="text-2xl font-bold text-red-600">{selectedJob.failed_count}</div><div className="text-xs text-red-600">Failed</div></div>
              </div>
              <div className="text-xs text-gray-400 pt-2">Job ID: {selectedJob.id}</div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} variant="danger" confirmText="Delete" onConfirm={confirmModal.onConfirm} onCancel={closeConfirmModal} />

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default HistoryView;
