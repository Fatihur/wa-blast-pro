import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, RefreshCw, CheckCircle, Loader2, XCircle, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { whatsappApi } from '../services/api';

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'AUTHENTICATED' | 'READY' | 'AUTH_FAILURE';

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
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await whatsappApi.getStatus();
      setStatus(data.status as ConnectionStatus);
      setQrCode(data.qrCode);
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
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await whatsappApi.connect();
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
      setClientInfo(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStatusBadge = () => {
    const badges: Record<ConnectionStatus, { color: string; text: string; icon: React.ReactNode }> = {
      DISCONNECTED: { color: 'bg-gray-100 text-gray-600', text: 'Disconnected', icon: <WifiOff size={14} /> },
      CONNECTING: { color: 'bg-yellow-100 text-yellow-700', text: 'Connecting...', icon: <Loader2 size={14} className="animate-spin" /> },
      QR_READY: { color: 'bg-blue-100 text-blue-700', text: 'Scan QR Code', icon: <Smartphone size={14} /> },
      AUTHENTICATED: { color: 'bg-emerald-100 text-emerald-700', text: 'Authenticated', icon: <CheckCircle size={14} /> },
      READY: { color: 'bg-emerald-100 text-emerald-700', text: 'Connected', icon: <Wifi size={14} /> },
      AUTH_FAILURE: { color: 'bg-red-100 text-red-700', text: 'Auth Failed', icon: <XCircle size={14} /> },
    };

    const badge = badges[status];
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${badge.color}`}>
        {badge.icon}
        {badge.text}
      </span>
    );
  };

  const renderQRSection = () => {
    if (!serverOnline) {
      return (
        <div className="w-56 h-56 md:w-64 md:h-64 bg-red-50 rounded-xl flex flex-col items-center justify-center text-red-500 p-4">
          <AlertCircle size={48} className="mb-4" />
          <span className="font-bold text-center">Server Offline</span>
          <span className="text-sm text-red-400 mt-2 text-center">Start the backend server first</span>
          <code className="text-xs mt-3 bg-red-100 px-2 py-1 rounded">cd server && npm run dev</code>
        </div>
      );
    }

    if (status === 'READY') {
      return (
        <div className="w-56 h-56 md:w-64 md:h-64 bg-emerald-50 rounded-xl flex flex-col items-center justify-center text-emerald-600 p-4">
          <CheckCircle size={64} className="mb-4" />
          <span className="font-bold text-lg">Device Connected</span>
          {clientInfo?.pushname && (
            <span className="text-sm text-emerald-500 mt-1">{clientInfo.pushname}</span>
          )}
          {clientInfo?.wid?.user && (
            <span className="text-xs text-emerald-400 mt-1">+{clientInfo.wid.user}</span>
          )}
        </div>
      );
    }

    if (status === 'CONNECTING' || status === 'AUTHENTICATED') {
      return (
        <div className="w-56 h-56 md:w-64 md:h-64 bg-gray-50 rounded-xl flex flex-col items-center justify-center text-gray-400">
          <Loader2 size={48} className="animate-spin mb-4 text-emerald-600" />
          <span className="font-medium">
            {status === 'AUTHENTICATED' ? 'Initializing...' : 'Starting WhatsApp...'}
          </span>
          <span className="text-xs text-gray-400 mt-2">This may take a moment</span>
        </div>
      );
    }

    if (status === 'QR_READY' && qrCode) {
      return (
        <div className="w-56 h-56 md:w-64 md:h-64 bg-white rounded-xl overflow-hidden flex items-center justify-center p-2">
          <img src={qrCode} alt="QR Code" className="w-full h-full object-contain" />
        </div>
      );
    }

    if (status === 'AUTH_FAILURE') {
      return (
        <div className="w-56 h-56 md:w-64 md:h-64 bg-red-50 rounded-xl flex flex-col items-center justify-center text-red-500 p-4">
          <XCircle size={48} className="mb-4" />
          <span className="font-bold">Authentication Failed</span>
          <span className="text-sm text-red-400 mt-2 text-center">Please try connecting again</span>
        </div>
      );
    }

    return (
      <div 
        className="w-56 h-56 md:w-64 md:h-64 bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-200 transition-colors"
        onClick={handleConnect}
      >
        <Smartphone size={48} className="mb-4" />
        <span className="font-medium">Click to Connect</span>
        <span className="text-xs mt-2">Generate QR Code</span>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col min-h-[80vh] items-center justify-center">
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Connect Device</h1>
        <p className="text-sm md:text-base text-gray-500">Link your WhatsApp account to start sending blasts.</p>
        <div className="mt-4 flex items-center justify-center gap-3">
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

      <div className="bg-white p-6 md:p-12 rounded-3xl shadow-xl border border-gray-100 max-w-4xl w-full flex flex-col md:flex-row gap-8 md:gap-12 items-center">
        
        {/* Instructions */}
        <div className="flex-1 space-y-4 md:space-y-6 w-full">
          <h3 className="text-xl font-bold text-gray-800">How to connect:</h3>
          <ol className="space-y-3 md:space-y-4 list-decimal list-inside text-gray-600 text-sm md:text-base">
            <li className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
              Click <span className="font-medium text-gray-900">"Connect"</span> to generate QR code
            </li>
            <li className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <span className="font-medium text-gray-900">Open WhatsApp</span> on your phone
            </li>
            <li className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
              Go to <span className="font-medium text-gray-900">Settings → Linked Devices</span>
            </li>
            <li className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
              Tap <span className="font-medium text-gray-900">Link a Device</span> and scan the QR
            </li>
          </ol>
        </div>

        {/* QR Section */}
        <div className="flex-1 flex flex-col items-center justify-center relative w-full">
          <div className="relative bg-white p-4 rounded-2xl shadow-inner border border-gray-200">
            {renderQRSection()}
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            {status === 'DISCONNECTED' && serverOnline && (
              <button 
                onClick={handleConnect}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Smartphone size={18} />}
                Connect WhatsApp
              </button>
            )}
            
            {(status === 'READY' || status === 'QR_READY' || status === 'AUTH_FAILURE') && (
              <button 
                onClick={handleDisconnect}
                disabled={isLoading}
                className="text-red-500 font-medium text-sm hover:bg-red-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {status === 'READY' ? 'Disconnect Device' : 'Cancel'}
              </button>
            )}

            {status === 'QR_READY' && (
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Waiting for scan...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionView;
