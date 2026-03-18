import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Smartphone, RefreshCw, CheckCircle, Loader2, XCircle, Wifi, WifiOff, AlertCircle, KeyRound, QrCode } from 'lucide-react';
import { whatsappApi } from '../services/api';
import { socketService } from '../services/socket';

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'AUTHENTICATED' | 'READY' | 'AUTH_FAILURE';
type ConnectionMode = 'qr' | 'pairing';

interface ClientInfo {
  wid?: {
    user: string;
    _serialized: string;
  };
  pushname?: string;
  platform?: string;
}

const ConnectionView: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('qr');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await whatsappApi.getStatus();
      setStatus(data.status as ConnectionStatus);
      setQrCode(data.qrCode);
      setPairingCode(data.pairingCode);
      setClientInfo(data.clientInfo);
      setServerOnline(true);
      setError(null);
    } catch (err: any) {
      setServerOnline(false);
      if (err.message !== 'Failed to fetch') {
        setError(err.message);
      }
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    socketService.connect();

    const handleStatus = (data: { status: ConnectionStatus; qrCode?: string | null; pairingCode?: string | null; clientInfo?: ClientInfo | null }) => {
      setStatus(data.status);
      setQrCode(data.qrCode ?? null);
      setPairingCode(data.pairingCode ?? null);
      setClientInfo(data.clientInfo ?? null);
      setServerOnline(true);
    };

    const handleQr = (data: { qrCode: string }) => {
      setStatus('QR_READY');
      setQrCode(data.qrCode);
      setPairingCode(null);
      setConnectionMode('qr');
      setServerOnline(true);
    };

    const handlePairingCode = (data: { pairingCode: string }) => {
      setStatus('QR_READY');
      setPairingCode(data.pairingCode);
      setQrCode(null);
      setConnectionMode('pairing');
      setServerOnline(true);
    };

    const handleReady = (data: { clientInfo: ClientInfo }) => {
      setStatus('READY');
      setClientInfo(data.clientInfo);
      setQrCode(null);
      setPairingCode(null);
      setServerOnline(true);
    };

    const handleAuthFailure = (data: { message: string }) => {
      setStatus('AUTH_FAILURE');
      setError(data.message);
    };

    const handleDisconnected = () => {
      setStatus('DISCONNECTED');
      setClientInfo(null);
      setQrCode(null);
      setPairingCode(null);
    };

    socketService.on('whatsapp_status', handleStatus);
    socketService.on('whatsapp_qr', handleQr);
    socketService.on('whatsapp_pairing_code', handlePairingCode);
    socketService.on('whatsapp_ready', handleReady);
    socketService.on('whatsapp_auth_failure', handleAuthFailure);
    socketService.on('whatsapp_disconnected', handleDisconnected);

    return () => {
      socketService.off('whatsapp_status', handleStatus);
      socketService.off('whatsapp_qr', handleQr);
      socketService.off('whatsapp_pairing_code', handlePairingCode);
      socketService.off('whatsapp_ready', handleReady);
      socketService.off('whatsapp_auth_failure', handleAuthFailure);
      socketService.off('whatsapp_disconnected', handleDisconnected);
    };
  }, [fetchStatus]);

  const handleConnectQr = async () => {
    setIsLoading(true);
    setError(null);
    setConnectionMode('qr');
    try {
      await whatsappApi.connect();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectPairing = async () => {
    setIsLoading(true);
    setError(null);
    setConnectionMode('pairing');

    if (!phoneNumber.trim()) {
      setError('Phone number is required for pairing code');
      setIsLoading(false);
      return;
    }

    try {
      const result = await whatsappApi.connectWithPairing(phoneNumber);
      setPairingCode(result.pairingCode);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await whatsappApi.disconnect();
      setQrCode(null);
      setPairingCode(null);
      setClientInfo(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStatusBadge = () => {
    const badges: Record<ConnectionStatus, { color: string; text: string; icon: React.ReactNode }> = {
      DISCONNECTED: { color: 'bg-gray-100 text-gray-600', text: 'Belum terhubung', icon: <WifiOff size={14} /> },
      CONNECTING: { color: 'bg-yellow-100 text-yellow-700', text: 'Sedang menghubungkan...', icon: <Loader2 size={14} className="animate-spin" /> },
      QR_READY: { color: 'bg-blue-100 text-blue-700', text: connectionMode === 'pairing' ? 'Kode pairing siap' : 'QR siap dipindai', icon: <Smartphone size={14} /> },
      AUTHENTICATED: { color: 'bg-emerald-100 text-emerald-700', text: 'Terautentikasi', icon: <CheckCircle size={14} /> },
      READY: { color: 'bg-emerald-100 text-emerald-700', text: 'Terhubung', icon: <Wifi size={14} /> },
      AUTH_FAILURE: { color: 'bg-red-100 text-red-700', text: 'Autentikasi gagal', icon: <XCircle size={14} /> },
    };

    const badge = badges[status];
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${badge.color}`}>
        {badge.icon}
        {badge.text}
      </span>
    );
  };

  const isBusy = status === 'CONNECTING' || status === 'AUTHENTICATED';
  const canDisconnect = status === 'READY' || status === 'QR_READY' || status === 'AUTH_FAILURE' || status === 'AUTHENTICATED';

  const currentPanel = useMemo(() => {
    if (!serverOnline) {
      return (
        <div className="w-64 h-64 bg-red-50 rounded-xl flex flex-col items-center justify-center text-red-500 p-4">
          <AlertCircle size={48} className="mb-4" />
          <span className="font-bold text-center">Server belum tersedia</span>
          <span className="text-sm text-red-400 mt-2 text-center">Pastikan layanan backend aktif, lalu muat ulang halaman ini.</span>
        </div>
      );
    }

    if (status === 'READY') {
      return (
        <div className="w-64 h-64 bg-emerald-50 rounded-xl flex flex-col items-center justify-center text-emerald-600 p-4">
          <CheckCircle size={64} className="mb-4" />
          <span className="font-bold text-lg">Device Connected</span>
          {clientInfo?.pushname && <span className="text-sm text-emerald-500 mt-1">{clientInfo.pushname}</span>}
          {clientInfo?.wid?.user && <span className="text-xs text-emerald-400 mt-1">+{clientInfo.wid.user}</span>}
        </div>
      );
    }

    if (connectionMode === 'pairing' && pairingCode) {
      return (
        <div className="w-64 h-64 bg-white rounded-xl flex flex-col items-center justify-center p-6 border border-gray-100">
          <KeyRound size={42} className="mb-4 text-emerald-600" />
          <span className="text-sm text-gray-500 mb-2">Masukkan kode pairing ini di ponsel kamu</span>
          <div className="text-3xl font-bold tracking-[0.3em] text-gray-900 bg-gray-50 px-5 py-4 rounded-2xl">
            {pairingCode}
          </div>
          <span className="text-xs text-gray-400 mt-4 text-center">WhatsApp -&gt; Perangkat tertaut -&gt; Hubungkan dengan nomor telepon</span>
        </div>
      );
    }

    if (isBusy) {
      return (
        <div className="w-64 h-64 bg-gray-50 rounded-xl flex flex-col items-center justify-center text-gray-400">
          <Loader2 size={48} className="animate-spin mb-4 text-emerald-600" />
          <span className="font-medium">{status === 'AUTHENTICATED' ? 'Initializing...' : 'Starting WhatsApp...'}</span>
          <span className="text-xs text-gray-400 mt-2">This may take a moment</span>
        </div>
      );
    }

    if (status === 'QR_READY' && qrCode) {
      return (
        <div className="w-64 h-64 bg-white rounded-xl overflow-hidden flex items-center justify-center p-2">
          <img src={qrCode} alt="QR Code" className="w-full h-full object-contain" />
        </div>
      );
    }

    if (status === 'AUTH_FAILURE') {
      return (
        <div className="w-64 h-64 bg-red-50 rounded-xl flex flex-col items-center justify-center text-red-500 p-4">
          <XCircle size={48} className="mb-4" />
          <span className="font-bold">Authentication Failed</span>
          <span className="text-sm text-red-400 mt-2 text-center">Please try connecting again</span>
        </div>
      );
    }

    return (
      <div className="w-64 h-64 bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400">
        {connectionMode === 'pairing' ? (
          <>
            <KeyRound size={48} className="mb-4" />
          <span className="font-medium">Buat kode pairing</span>
          <span className="text-xs mt-2">Gunakan nomor yang terhubung ke WhatsApp</span>
          </>
        ) : (
          <>
            <QrCode size={48} className="mb-4" />
             <span className="font-medium">Buat QR code</span>
             <span className="text-xs mt-2">Pindai lewat aplikasi WhatsApp</span>
          </>
        )}
      </div>
    );
  }, [clientInfo, connectionMode, isBusy, pairingCode, qrCode, serverOnline, status]);

  const isConnected = status === 'READY';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col min-h-[80vh] items-center justify-center pb-28 md:pb-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Hubungkan Perangkat</h1>
        <p className="text-sm md:text-base text-gray-500">Sambungkan akun WhatsApp lewat QR code atau pairing code tanpa keluar dari aplikasi.</p>
        <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
          {renderStatusBadge()}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${serverOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {serverOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            Server {serverOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl max-w-xl w-full">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span className="font-medium">Error:</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="bg-white p-6 md:p-12 rounded-3xl shadow-xl border border-gray-100 max-w-5xl w-full flex flex-col md:flex-row gap-8 md:gap-12 items-start">
        {isConnected ? (
          <>
            <div className="flex-1 space-y-5 w-full">
                <h3 className="text-xl font-bold text-gray-800">Status Koneksi</h3>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
                <div>
                    <p className="text-sm text-emerald-700">Status</p>
                    <p className="text-lg font-bold text-emerald-900">Terhubung</p>
                </div>
                {clientInfo?.pushname && (
                  <div>
                     <p className="text-sm text-emerald-700">Nama perangkat</p>
                    <p className="font-medium text-emerald-900">{clientInfo.pushname}</p>
                  </div>
                )}
                {clientInfo?.wid?.user && (
                  <div>
                     <p className="text-sm text-emerald-700">Nomor WhatsApp</p>
                    <p className="font-medium text-emerald-900">+{clientInfo.wid.user}</p>
                  </div>
                )}
                {clientInfo?.platform && (
                  <div>
                     <p className="text-sm text-emerald-700">Platform</p>
                    <p className="font-medium text-emerald-900">{clientInfo.platform}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative w-full">
              <div className="relative bg-white p-4 rounded-2xl shadow-inner border border-gray-200">
                {currentPanel}
              </div>

              <div className="mt-6 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={isLoading}
                  className="text-red-500 font-medium text-sm hover:bg-red-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Putuskan perangkat
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 space-y-5 w-full">
              <div className="inline-flex bg-gray-100 rounded-2xl p-1">
                <button
                  type="button"
                  onClick={() => setConnectionMode('qr')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${connectionMode === 'qr' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}
                >
                  QR Code
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionMode('pairing')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${connectionMode === 'pairing' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}
                >
                  Pairing Code
                </button>
              </div>

              {connectionMode === 'pairing' ? (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-gray-800">Hubungkan dengan pairing code</h3>
                  <p className="text-sm text-gray-500">Masukkan nomor WhatsApp kamu, lalu ketik kode yang muncul di ponsel.</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nomor WhatsApp</label>
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(event) => setPhoneNumber(event.target.value)}
                      placeholder="e.g. 081234567890 or 6281234567890"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <p className="text-xs text-gray-400 mt-2">Gunakan nomor yang terhubung ke WhatsApp. Kode negara 62 akan disesuaikan otomatis.</p>
                  </div>
                  <ol className="space-y-3 list-decimal list-inside text-gray-600 text-sm">
                    <li>Klik <span className="font-medium text-gray-900">Buat kode pairing</span></li>
                    <li>Buka WhatsApp di ponsel</li>
                    <li>Buka <span className="font-medium text-gray-900">Setelan -&gt; Perangkat tertaut</span></li>
                    <li>Pilih <span className="font-medium text-gray-900">Hubungkan dengan nomor telepon</span></li>
                    <li>Masukkan kode yang tampil di layar ini</li>
                  </ol>
                  <button
                    type="button"
                    onClick={handleConnectPairing}
                    disabled={isLoading || !serverOnline}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
                    Buat kode pairing
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-gray-800">Hubungkan dengan QR code</h3>
                  <ol className="space-y-3 list-decimal list-inside text-gray-600 text-sm md:text-base">
                    <li>Klik <span className="font-medium text-gray-900">Buat QR code</span></li>
                    <li>Buka WhatsApp di ponsel</li>
                    <li>Buka <span className="font-medium text-gray-900">Setelan -&gt; Perangkat tertaut</span></li>
                    <li>Tekan <span className="font-medium text-gray-900">Tautkan perangkat</span> lalu pindai QR</li>
                  </ol>
                  <button
                    type="button"
                    onClick={handleConnectQr}
                    disabled={isLoading || !serverOnline}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <QrCode size={18} />}
                    Buat QR code
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative w-full">
              <div className="relative bg-white p-4 rounded-2xl shadow-inner border border-gray-200">
                {currentPanel}
              </div>

              <div className="mt-6 flex flex-col items-center gap-3">
                {canDisconnect && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isLoading}
                    className="text-red-500 font-medium text-sm hover:bg-red-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    {status === 'READY' ? 'Putuskan perangkat' : 'Batalkan'}
                  </button>
                )}

                {(status === 'QR_READY' || pairingCode) && status !== 'READY' && (
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Menunggu konfirmasi...
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ConnectionView;
