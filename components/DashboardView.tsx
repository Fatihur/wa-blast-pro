import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUpRight, MoreHorizontal, Play, Clock, CheckCircle, XCircle, Loader2, Database, Wifi, WifiOff, RefreshCw, Zap, Smartphone, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { authApi, blastApi, contactsApi, DashboardStats, BlastJob, whatsappApi } from '../services/api';
import { socketService } from '../services/socket';
import { ViewState } from '../types';

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'AUTHENTICATED' | 'READY' | 'AUTH_FAILURE';

interface ClientInfo {
  wid?: {
    user: string;
    _serialized: string;
  };
  pushname?: string;
  platform?: string;
}

const defaultStats: DashboardStats = {
  totalSent: 0,
  delivered: 0,
  pending: 0,
  failed: 0
};

interface DashboardViewProps {
  onChangeView: (view: ViewState) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ onChangeView }) => {
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [recentJobs, setRecentJobs] = useState<BlastJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [totalContacts, setTotalContacts] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [userName, setUserName] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [serverOnline, setServerOnline] = useState(false);
  const [chartData, setChartData] = useState([
    { name: 'Mon', sent: 0 },
    { name: 'Tue', sent: 0 },
    { name: 'Wed', sent: 0 },
    { name: 'Thu', sent: 0 },
    { name: 'Fri', sent: 0 },
    { name: 'Sat', sent: 0 },
    { name: 'Sun', sent: 0 },
  ]);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      const [statsRes, historyRes, contactsRes, authRes, whatsappStatus] = await Promise.all([
        blastApi.getDashboardStats(),
        blastApi.getHistory(10),
        contactsApi.getAll(),
        authApi.getMe(),
        whatsappApi.getStatus(),
      ]);
      
      if (statsRes.success) {
        setStats(statsRes.stats);
      }
      
      if (contactsRes.success) {
        setTotalContacts(contactsRes.contacts.length);
      }

      if (authRes.success) {
        setUserName(authRes.user.name || 'there');
      }

      setConnectionStatus(whatsappStatus.status as ConnectionStatus);
      setClientInfo(whatsappStatus.clientInfo ?? null);
      setServerOnline(true);
      
      if (historyRes.success) {
        setRecentJobs(historyRes.jobs);
        
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weekData = days.map(day => ({ name: day, sent: 0 }));
        
        historyRes.jobs.forEach(job => {
          if (job.created_at) {
            const dayIndex = new Date(job.created_at).getDay();
            weekData[dayIndex].sent += job.sent_count || 0;
          }
        });
        
        setChartData([...weekData.slice(1), weekData[0]]);
      }
      
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setServerOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Socket connection and realtime events
  useEffect(() => {
    socketService.connect();

    const handleConnected = () => {
      setSocketConnected(true);
      setSocketError(null);
    };

    const handleDisconnected = (reason?: string) => {
      setSocketConnected(false);
      if (reason && reason !== 'io client disconnect') {
        setSocketError(`Socket terputus: ${reason}`);
      }
    };

    const handleConnectionError = (message: string) => {
      setSocketConnected(false);
      setSocketError(message);
    };

    const handleWhatsAppStatus = (data: { status: ConnectionStatus; clientInfo?: ClientInfo | null }) => {
      setConnectionStatus(data.status);
      setClientInfo(data.clientInfo ?? null);
      setServerOnline(true);
      setLastUpdate(new Date());
    };

    const handleWhatsAppReady = (data: { clientInfo?: ClientInfo | null }) => {
      setConnectionStatus('READY');
      setClientInfo(data.clientInfo ?? null);
      setServerOnline(true);
      setLastUpdate(new Date());
    };

    const handleWhatsAppDisconnected = () => {
      setConnectionStatus('DISCONNECTED');
      setClientInfo(null);
      setLastUpdate(new Date());
    };

    const handleWhatsAppAuthFailure = () => {
      setConnectionStatus('AUTH_FAILURE');
      setLastUpdate(new Date());
    };

    const handleBlastProgress = (data: any) => {
      setRecentJobs(prev => prev.map(job => 
        job.id === data.jobId 
          ? { ...job, sent_count: data.progress.sent, failed_count: data.progress.failed, status: 'running' as const }
          : job
      ));
      
      // Update stats in realtime
      setStats(prev => ({
        ...prev,
        totalSent: prev.totalSent + 1,
        delivered: data.lastResult?.success ? prev.delivered + 1 : prev.delivered,
        failed: data.lastResult?.success ? prev.failed : prev.failed + 1,
      }));
      
      setLastUpdate(new Date());
    };

    const handleJobStarted = (job: any) => {
      setRecentJobs(prev => {
        const exists = prev.find(j => j.id === job.id);
        if (exists) {
          return prev.map(j => j.id === job.id ? { ...j, status: 'running' as const } : j);
        }
        return [job, ...prev].slice(0, 10);
      });
      setStats(prev => ({ ...prev, pending: prev.pending + (job.progress?.total || 0) }));
      setLastUpdate(new Date());
    };

    const handleJobCompleted = (job: any) => {
      setRecentJobs(prev => prev.map(j => 
        j.id === job.id ? { ...j, status: 'completed' as const, sent_count: job.progress?.sent || j.sent_count } : j
      ));
      loadDashboardData(); // Refresh stats
    };

    const handleJobFailed = (data: any) => {
      setRecentJobs(prev => prev.map(j => 
        j.id === data.job?.id ? { ...j, status: 'failed' as const } : j
      ));
      setLastUpdate(new Date());
    };

    const handleJobCreated = (job: any) => {
      setRecentJobs(prev => [job, ...prev].slice(0, 10));
      setLastUpdate(new Date());
    };

    socketService.on('connected', handleConnected);
    socketService.on('disconnected', handleDisconnected);
    socketService.on('connection_error', handleConnectionError);
    socketService.on('whatsapp_status', handleWhatsAppStatus);
    socketService.on('whatsapp_ready', handleWhatsAppReady);
    socketService.on('whatsapp_disconnected', handleWhatsAppDisconnected);
    socketService.on('whatsapp_auth_failure', handleWhatsAppAuthFailure);
    socketService.on('blast_progress', handleBlastProgress);
    socketService.on('blast_job_started', handleJobStarted);
    socketService.on('blast_job_completed', handleJobCompleted);
    socketService.on('blast_job_failed', handleJobFailed);
    socketService.on('blast_job_created', handleJobCreated);

    return () => {
      socketService.off('connected', handleConnected);
      socketService.off('disconnected', handleDisconnected);
      socketService.off('connection_error', handleConnectionError);
      socketService.off('whatsapp_status', handleWhatsAppStatus);
      socketService.off('whatsapp_ready', handleWhatsAppReady);
      socketService.off('whatsapp_disconnected', handleWhatsAppDisconnected);
      socketService.off('whatsapp_auth_failure', handleWhatsAppAuthFailure);
      socketService.off('blast_progress', handleBlastProgress);
      socketService.off('blast_job_started', handleJobStarted);
      socketService.off('blast_job_completed', handleJobCompleted);
      socketService.off('blast_job_failed', handleJobFailed);
      socketService.off('blast_job_created', handleJobCreated);
    };
  }, [loadDashboardData]);

  // Auto refresh every 30s as fallback
  useEffect(() => {
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  const successRate = stats.totalSent > 0 
    ? ((stats.delivered / stats.totalSent) * 100).toFixed(1) 
    : '0';

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Selamat pagi' : currentHour < 18 ? 'Selamat siang' : 'Selamat malam';

  const connectionMeta: Record<ConnectionStatus, { label: string; tone: string; detail: string; icon: React.ReactNode }> = {
    DISCONNECTED: {
      label: 'Belum terhubung',
      tone: 'bg-gray-100 text-gray-700 border-gray-200',
      detail: 'Hubungkan WhatsApp untuk mulai mengirim blast dan menerima update realtime.',
      icon: <WifiOff size={16} />,
    },
    CONNECTING: {
      label: 'Sedang menghubungkan',
      tone: 'bg-amber-50 text-amber-700 border-amber-200',
      detail: 'Server sedang menyiapkan sesi WhatsApp kamu.',
      icon: <Loader2 size={16} className="animate-spin" />,
    },
    QR_READY: {
      label: 'Menunggu scan QR / pairing',
      tone: 'bg-sky-50 text-sky-700 border-sky-200',
      detail: 'Buka menu koneksi untuk scan QR code atau masukkan pairing code.',
      icon: <Smartphone size={16} />,
    },
    AUTHENTICATED: {
      label: 'Autentikasi berhasil',
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      detail: 'Sesi sudah valid dan sedang menyelesaikan sinkronisasi perangkat.',
      icon: <CheckCircle size={16} />,
    },
    READY: {
      label: 'Terhubung',
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      detail: clientInfo?.wid?.user
        ? `Perangkat aktif di nomor +${clientInfo.wid.user}. Siap kirim pesan.`
        : 'Perangkat WhatsApp aktif dan siap digunakan.',
      icon: <Wifi size={16} />,
    },
    AUTH_FAILURE: {
      label: 'Autentikasi gagal',
      tone: 'bg-red-50 text-red-700 border-red-200',
      detail: 'Sesi perlu dihubungkan ulang dari halaman koneksi.',
      icon: <AlertCircle size={16} />,
    },
  };

  const activeConnection = connectionMeta[connectionStatus];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 pb-28 md:pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Ringkasan</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">Pantau performa blast, kesiapan perangkat, dan aktivitas terbaru dalam satu tempat.</p>
        </div>
        
        {/* Realtime Status Indicator */}
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            socketConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {socketConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Zap size={14} />
                 Realtime aktif
              </>
            ) : (
              <>
                <WifiOff size={14} />
                 Realtime offline
              </>
            )}
          </div>
          
          <button 
            onClick={loadDashboardData}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
            title="Refresh data"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          
          <div className="text-xs text-gray-400">
            Diperbarui: {formatTime(lastUpdate)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4 md:gap-6">
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#052e2b_0%,#0f766e_48%,#99f6e4_130%)] p-6 md:p-8 text-white shadow-xl">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute bottom-0 right-10 h-28 w-28 rounded-full bg-emerald-200/20 blur-2xl"></div>
          <div className="relative max-w-2xl space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-emerald-100/80">Welcome</p>
            <div>
              <h2 className="text-2xl md:text-4xl font-bold leading-tight">{greeting}, {userName || 'teman'}.</h2>
              <p className="mt-2 text-sm md:text-base text-emerald-50/90">
                Pantau performa blast, cek kesiapan perangkat, dan lanjutkan campaign tanpa pindah halaman.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2 text-sm">
              <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="text-emerald-100/75">Kontak aktif</div>
                <div className="mt-1 text-xl font-semibold">{totalContacts.toLocaleString()}</div>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="text-emerald-100/75">Campaign berjalan</div>
                <div className="mt-1 text-xl font-semibold">{recentJobs.filter(j => j.status === 'running').length}</div>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="text-emerald-100/75">Pesan terkirim</div>
                <div className="mt-1 text-xl font-semibold">{stats.totalSent.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Status koneksi</p>
              <h3 className="mt-1 text-xl font-bold text-gray-900">WhatsApp Device</h3>
            </div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${activeConnection.tone}`}>
              {activeConnection.icon}
              {activeConnection.label}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <p className="text-sm leading-6 text-gray-600">{activeConnection.detail}</p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">Server</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                  {serverOnline ? <Wifi size={15} className="text-emerald-600" /> : <WifiOff size={15} className="text-red-500" />}
                  {serverOnline ? 'Online' : 'Offline'}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">Socket realtime</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                  {socketConnected ? <Zap size={15} className="text-emerald-600" /> : <WifiOff size={15} className="text-gray-400" />}
                  {socketConnected ? 'Terhubung' : 'Terputus'}
                </p>
                {socketError && (
                  <p className="mt-2 text-xs leading-5 text-red-500">{socketError}</p>
                )}
              </div>
            </div>

            {(clientInfo?.pushname || clientInfo?.wid?.user || clientInfo?.platform) && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-950">
                {clientInfo?.pushname && <p><span className="font-semibold">Device:</span> {clientInfo.pushname}</p>}
                {clientInfo?.wid?.user && <p><span className="font-semibold">Nomor:</span> +{clientInfo.wid.user}</p>}
                {clientInfo?.platform && <p><span className="font-semibold">Platform:</span> {clientInfo.platform}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Total Sent */}
        <div className="bg-emerald-900 text-white rounded-3xl p-5 md:p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform">
             <div className="absolute top-0 right-0 p-5 md:p-6">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}
                </div>
             </div>
             <h3 className="text-emerald-200 font-medium mb-1 text-sm md:text-base">Total Sent</h3>
             <div className="text-3xl md:text-4xl font-bold mb-4 tabular-nums">{stats.totalSent.toLocaleString()}</div>
             <div className="inline-flex items-center gap-1 bg-emerald-800/50 px-2 py-1 rounded-lg text-xs text-emerald-300">
                <Database size={12} />
                All time
             </div>
        </div>

        {/* Delivered */}
        <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all relative">
             <div className="absolute top-0 right-0 p-5 md:p-6">
                <div className="w-8 h-8 border border-gray-200 rounded-full flex items-center justify-center">
                    <CheckCircle size={16} className="text-emerald-500" />
                </div>
             </div>
             <h3 className="text-gray-500 font-medium mb-1 text-sm md:text-base">Delivered</h3>
             <div className="text-3xl md:text-4xl font-bold text-gray-800 mb-4 tabular-nums">{stats.delivered.toLocaleString()}</div>
             <div className="inline-flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg text-xs text-emerald-600">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                {successRate}% Success
             </div>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all relative">
             <div className="absolute top-0 right-0 p-5 md:p-6">
                <div className="w-8 h-8 border border-gray-200 rounded-full flex items-center justify-center">
                    <Clock size={16} className={`text-yellow-500 ${stats.pending > 0 ? 'animate-pulse' : ''}`} />
                </div>
             </div>
             <h3 className="text-gray-500 font-medium mb-1 text-sm md:text-base">In Queue</h3>
             <div className="text-3xl md:text-4xl font-bold text-gray-800 mb-4 tabular-nums">{stats.pending.toLocaleString()}</div>
             <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${stats.pending > 0 ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}>
                {stats.pending > 0 ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Processing...
                  </>
                ) : 'No pending'}
             </div>
        </div>

         {/* Failed */}
         <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all relative">
             <div className="absolute top-0 right-0 p-5 md:p-6">
                <div className="w-8 h-8 border border-gray-200 rounded-full flex items-center justify-center">
                    <XCircle size={16} className="text-red-400" />
                </div>
             </div>
             <h3 className="text-gray-500 font-medium mb-1 text-sm md:text-base">Failed</h3>
             <div className="text-3xl md:text-4xl font-bold text-gray-800 mb-4 tabular-nums">{stats.failed.toLocaleString()}</div>
             <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${stats.failed > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                {stats.failed > 0 ? 'Check logs' : 'No failures'}
             </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-4 border border-indigo-100">
          <p className="text-indigo-600 text-xs font-medium mb-1">Total Contacts</p>
          <p className="text-2xl font-bold text-indigo-900 tabular-nums">{totalContacts.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl p-4 border border-purple-100">
          <p className="text-purple-600 text-xs font-medium mb-1">Active Campaigns</p>
          <p className="text-2xl font-bold text-purple-900 tabular-nums">{recentJobs.filter(j => j.status === 'running').length}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl p-4 border border-amber-100">
          <p className="text-amber-600 text-xs font-medium mb-1">Today's Messages</p>
          <p className="text-2xl font-bold text-amber-900 tabular-nums">
            {recentJobs
              .filter(j => j.created_at && new Date(j.created_at).toDateString() === new Date().toDateString())
              .reduce((acc, j) => acc + (j.sent_count || 0), 0)
              .toLocaleString()}
          </p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-4 border border-emerald-100">
          <p className="text-emerald-600 text-xs font-medium mb-1">Success Rate</p>
          <p className="text-2xl font-bold text-emerald-900">{successRate}%</p>
        </div>
      </div>

      {/* Analytics & Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Chart */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-gray-800">Weekly Activity</h3>
                  <button className="text-gray-400 hover:text-gray-600">
                      <MoreHorizontal size={20} />
                  </button>
              </div>
              <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                          <Tooltip 
                            cursor={{fill: '#f3f4f6'}}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                          />
                          <Bar dataKey="sent" radius={[8, 8, 8, 8]} barSize={40}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.sent > 0 ? '#064e3b' : '#ecfdf5'} />
                            ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Live Activity Feed */}
          <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm flex flex-col">
             <div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-bold text-gray-800">Aktivitas Langsung</h3>
               {socketConnected && (
                 <span className="flex items-center gap-1 text-xs text-emerald-600">
                   <span className="relative flex h-2 w-2">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                   </span>
                    Live
                 </span>
               )}
             </div>
             
             <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px]">
               {recentJobs.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-gray-400">
                   <Clock size={32} className="mb-2 opacity-50" />
                    <p className="text-sm">Belum ada aktivitas terbaru</p>
                 </div>
               ) : (
                 recentJobs.slice(0, 5).map((job, index) => {
                   const statusColors = {
                     running: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                     completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                     failed: 'bg-red-100 text-red-700 border-red-200',
                     paused: 'bg-orange-100 text-orange-700 border-orange-200',
                     pending: 'bg-gray-100 text-gray-600 border-gray-200',
                   };
                   
                   return (
                     <div 
                       key={job.id} 
                       className={`p-3 rounded-xl border ${statusColors[job.status]} transition-all ${job.status === 'running' ? 'animate-pulse' : ''}`}
                     >
                       <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">Blast {job.message_type}</span>
                          <span className="text-xs capitalize">{job.status}</span>
                       </div>
                       <div className="flex items-center justify-between text-xs opacity-75">
                          <span>{job.sent_count || 0} / {job.total_recipients} terkirim</span>
                         <span>{job.created_at ? new Date(job.created_at).toLocaleTimeString() : ''}</span>
                       </div>
                       {job.status === 'running' && (
                         <div className="mt-2 w-full bg-white/50 rounded-full h-1.5">
                           <div 
                             className="bg-current h-1.5 rounded-full transition-all duration-300"
                             style={{ width: `${((job.sent_count || 0) / job.total_recipients) * 100}%` }}
                           />
                         </div>
                       )}
                     </div>
                   );
                 })
               )}
             </div>
          </div>
      </div>

      {/* Recent Blasts Table */}
      <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800">Campaign Terbaru</h3>
            <button
              onClick={() => onChangeView('history')}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              Buka riwayat
            </button>
        </div>
        <div className="overflow-x-auto -mx-5 md:mx-0">
            <table className="w-full min-w-[600px] md:min-w-0">
                <thead>
                    <tr className="text-left text-gray-400 text-sm">
                        <th className="pb-4 pl-6 md:pl-2 font-medium">Campaign</th>
                        <th className="pb-4 font-medium">Status</th>
                        <th className="pb-4 font-medium">Progress</th>
                        <th className="pb-4 pr-6 font-medium">Date</th>
                    </tr>
                </thead>
                <tbody className="text-gray-600">
                    {recentJobs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-400">
                          {isLoading ? (
                              <div className="flex items-center justify-center gap-2">
                                <Loader2 size={16} className="animate-spin" />
                               Memuat...
                             </div>
                           ) : 'Belum ada campaign. Mulai blast pertama kamu.'}
                        </td>
                      </tr>
                    ) : (
                      recentJobs.map((job, index) => {
                        const initials = job.message_type === 'TEXT' ? 'TX' : job.message_type === 'IMAGE' ? 'IM' : 'DC';
                        const bgColor = job.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 
                                       job.status === 'running' ? 'bg-yellow-100 text-yellow-600' : 
                                       job.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600';
                        
                        const statusBadge = {
                          completed: { bg: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={12} />, text: 'Selesai' },
                          running: { bg: 'bg-yellow-100 text-yellow-700', icon: <Loader2 size={12} className="animate-spin" />, text: 'Mengirim' },
                          paused: { bg: 'bg-orange-100 text-orange-700', icon: <Clock size={12} />, text: 'Dijeda' },
                          failed: { bg: 'bg-red-100 text-red-700', icon: <XCircle size={12} />, text: 'Gagal' },
                          pending: { bg: 'bg-gray-100 text-gray-600', icon: <Clock size={12} />, text: 'Menunggu' },
                        }[job.status] || { bg: 'bg-gray-100 text-gray-600', icon: null, text: job.status };

                        const progress = job.total_recipients > 0 
                          ? Math.round(((job.sent_count || 0) / job.total_recipients) * 100) 
                          : 0;

                        return (
                          <tr key={job.id} className={`${index < recentJobs.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50 transition-colors`}>
                            <td className="py-4 pl-6 md:pl-2 flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center font-bold shrink-0`}>{initials}</div>
                              <div>
                                <p className="font-semibold text-gray-800">{job.message_type} Blast</p>
                                <p className="text-xs text-gray-400 truncate max-w-[150px]">{job.content?.substring(0, 30) || 'No content'}...</p>
                              </div>
                            </td>
                            <td className="py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.bg}`}>
                                {statusBadge.icon} {statusBadge.text}
                              </span>
                            </td>
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-24 bg-gray-100 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full transition-all duration-300 ${job.status === 'completed' ? 'bg-emerald-500' : job.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`}
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 tabular-nums">
                                  {job.sent_count || 0}/{job.total_recipients}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 pr-6 text-sm">
                              {job.created_at ? new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
