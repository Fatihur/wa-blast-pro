import React, { useState, useEffect } from 'react';
import { History, Search, Calendar, CheckCircle, XCircle, Clock, Loader2, Send, Trash2, Eye, X, ChevronDown, Filter } from 'lucide-react';
import { blastApi } from '../services/api';

interface BlastJob {
  id: string;
  message_type: 'TEXT' | 'IMAGE' | 'DOCUMENT';
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

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const result = await blastApi.getHistory(100);
      if (result.success) {
        setJobs(result.jobs);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoading(false);
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
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            <CheckCircle size={12} /> Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle size={12} /> Failed
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Loader2 size={12} className="animate-spin" /> Running
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock size={12} /> Paused
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <Clock size={12} /> Pending
          </span>
        );
    }
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'IMAGE':
        return '🖼️';
      case 'DOCUMENT':
        return '📄';
      default:
        return '💬';
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.content?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         job.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this blast history?')) return;
    
    try {
      await blastApi.deleteJob(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      if (selectedJob?.id === jobId) setSelectedJob(null);
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Blast History</h1>
        <p className="text-sm md:text-base text-gray-500 mt-1">View and manage your past broadcast campaigns.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{jobs.length}</div>
          <div className="text-sm text-gray-500">Total Campaigns</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-emerald-600">
            {jobs.filter(j => j.status === 'completed').length}
          </div>
          <div className="text-sm text-gray-500">Completed</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-blue-600">
            {jobs.reduce((acc, j) => acc + j.sent_count, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">Messages Sent</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-red-600">
            {jobs.reduce((acc, j) => acc + j.failed_count, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">Failed</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by message content or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="running">Running</option>
                <option value="paused">Paused</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <button
              onClick={loadHistory}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-emerald-600" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <History size={32} />
            </div>
            <p className="font-medium">No blast history found</p>
            <p className="text-sm">Your broadcast campaigns will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {filteredJobs.map((job) => {
                  const successRate = job.total_recipients > 0 
                    ? Math.round((job.sent_count / job.total_recipients) * 100) 
                    : 0;
                  
                  return (
                    <tr key={job.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar size={14} className="text-gray-400" />
                          <span className="text-sm">{formatDate(job.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-800 text-sm line-clamp-2 max-w-xs">
                          {job.content || <span className="text-gray-400 italic">No text content</span>}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg" title={job.message_type}>
                          {getMessageTypeIcon(job.message_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <span className="font-medium text-gray-900">{job.total_recipients}</span>
                          <span className="text-gray-400 ml-1">contacts</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(job.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[80px]">
                            <div 
                              className={`h-full rounded-full ${successRate >= 80 ? 'bg-emerald-500' : successRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${successRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700">{successRate}%</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {job.sent_count} sent, {job.failed_count} failed
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setSelectedJob(job)}
                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(job.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedJob(null)} />
          <div className="bg-white rounded-3xl w-full max-w-lg relative z-10 shadow-2xl animate-[scaleIn_0.2s_ease-out] max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl">
              <h3 className="text-xl font-bold text-gray-900">Blast Details</h3>
              <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status</label>
                <div className="mt-1">{getStatusBadge(selectedJob.status)}</div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Created At</label>
                <p className="text-gray-800 mt-1">{formatDate(selectedJob.created_at)}</p>
              </div>
              
              {selectedJob.completed_at && (
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Completed At</label>
                  <p className="text-gray-800 mt-1">{formatDate(selectedJob.completed_at)}</p>
                </div>
              )}
              
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Message Type</label>
                <p className="text-gray-800 mt-1 flex items-center gap-2">
                  <span className="text-lg">{getMessageTypeIcon(selectedJob.message_type)}</span>
                  {selectedJob.message_type}
                </p>
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Message Content</label>
                <div className="mt-2 p-4 bg-gray-50 rounded-xl text-gray-800 whitespace-pre-wrap text-sm">
                  {selectedJob.content || <span className="text-gray-400 italic">No text content</span>}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-2xl font-bold text-gray-900">{selectedJob.total_recipients}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-xl">
                  <div className="text-2xl font-bold text-emerald-600">{selectedJob.sent_count}</div>
                  <div className="text-xs text-emerald-600">Sent</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-xl">
                  <div className="text-2xl font-bold text-red-600">{selectedJob.failed_count}</div>
                  <div className="text-xs text-red-600">Failed</div>
                </div>
              </div>
              
              <div className="text-xs text-gray-400 pt-2">
                Job ID: {selectedJob.id}
              </div>
            </div>
          </div>
        </div>
      )}

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
