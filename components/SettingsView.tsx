import React, { useState, useEffect } from 'react';
import { User, Lock, Zap, Shield, Save, Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Info, Key, Clock, Sparkles } from 'lucide-react';
import { authApi, settingsApi } from '../services/api';

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

interface BlastSettings {
  defaultDelay: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  maxDailyMessages: number;
}

interface ApiKeys {
  geminiApiKey: string;
}

const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'blast' | 'apikeys' | 'security'>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile state
  const [profile, setProfile] = useState<UserProfile>({ id: '', name: '', email: '' });
  
  // Blast settings state
  const [blastSettings, setBlastSettings] = useState<BlastSettings>({
    defaultDelay: 3,
    workingHoursStart: '08:00',
    workingHoursEnd: '20:00',
    maxDailyMessages: 1000
  });

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    geminiApiKey: ''
  });
  const [showApiKey, setShowApiKey] = useState(false);

  // Security state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    setIsLoading(true);
    try {
      // Load profile
      const profileResult = await authApi.getMe();
      if (profileResult.success && profileResult.user) {
        setProfile({
          id: profileResult.user.id,
          name: profileResult.user.name,
          email: profileResult.user.email
        });
      }

      // Load settings from backend
      const settingsResult = await settingsApi.getAll();
      if (settingsResult.success && settingsResult.settings) {
        const s = settingsResult.settings;
        
        // Blast settings
        setBlastSettings({
          defaultDelay: parseInt(s.defaultDelay) || 3,
          workingHoursStart: s.workingHoursStart || '08:00',
          workingHoursEnd: s.workingHoursEnd || '20:00',
          maxDailyMessages: parseInt(s.maxDailyMessages) || 1000
        });

        // API Keys
        setApiKeys({
          geminiApiKey: s.geminiApiKey || ''
        });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const result = await authApi.updateProfile({ name: profile.name });
      if (result.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      } else {
        throw new Error(result.error || 'Failed to update profile');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSaveBlastSettings = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await settingsApi.saveBulk({
        defaultDelay: blastSettings.defaultDelay.toString(),
        workingHoursStart: blastSettings.workingHoursStart,
        workingHoursEnd: blastSettings.workingHoursEnd,
        maxDailyMessages: blastSettings.maxDailyMessages.toString()
      });
      setMessage({ type: 'success', text: 'Blast settings saved!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSaveApiKeys = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await settingsApi.save('geminiApiKey', apiKeys.geminiApiKey);
      setMessage({ type: 'success', text: 'API Key saved successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match!' });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters!' });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const result = await authApi.changePassword(passwordData.currentPassword, passwordData.newPassword);
      if (result.success) {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        throw new Error(result.error || 'Failed to change password');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'blast', label: 'Blast Settings', icon: Zap },
    { id: 'apikeys', label: 'API Keys', icon: Key },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm md:text-base text-gray-500 mt-1">Manage your account and application preferences.</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 px-4 py-3 rounded-xl flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-emerald-600 border-emerald-600 bg-emerald-50/50'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6 md:p-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-emerald-600" />
            </div>
          ) : (
            <>
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Profile Information</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={profile.name}
                          onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          placeholder="Your name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input
                          type="email"
                          value={profile.email}
                          disabled
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      Save Changes
                    </button>
                  </div>
                </div>
              )}

              {/* Blast Settings Tab */}
              {activeTab === 'blast' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Blast Configuration</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Default Delay Between Messages (seconds)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={blastSettings.defaultDelay}
                          onChange={(e) => setBlastSettings(prev => ({ ...prev, defaultDelay: parseInt(e.target.value) || 3 }))}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">Recommended: 3-5 seconds to avoid being blocked</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Maximum Daily Messages
                        </label>
                        <input
                          type="number"
                          min="100"
                          max="10000"
                          value={blastSettings.maxDailyMessages}
                          onChange={(e) => setBlastSettings(prev => ({ ...prev, maxDailyMessages: parseInt(e.target.value) || 1000 }))}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">Limit to prevent account restrictions</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Clock size={14} className="inline mr-1" />
                            Working Hours Start
                          </label>
                          <input
                            type="time"
                            value={blastSettings.workingHoursStart}
                            onChange={(e) => setBlastSettings(prev => ({ ...prev, workingHoursStart: e.target.value }))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Clock size={14} className="inline mr-1" />
                            Working Hours End
                          </label>
                          <input
                            type="time"
                            value={blastSettings.workingHoursEnd}
                            onChange={(e) => setBlastSettings(prev => ({ ...prev, workingHoursEnd: e.target.value }))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">Messages will only be sent during these hours</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900">Best Practices</h4>
                        <ul className="text-sm text-blue-700 mt-1 space-y-1">
                          <li>• Use 3-5 second delays to appear more natural</li>
                          <li>• Limit daily messages to prevent account restrictions</li>
                          <li>• Send during business hours for better engagement</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <button
                      onClick={handleSaveBlastSettings}
                      disabled={isSaving}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      Save Settings
                    </button>
                  </div>
                </div>
              )}

              {/* API Keys Tab */}
              {activeTab === 'apikeys' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">API Keys Configuration</h3>
                    
                    {/* Gemini API Key */}
                    <div className="p-4 border border-gray-200 rounded-2xl space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                          <Sparkles size={20} className="text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">Google Gemini API</h4>
                          <p className="text-sm text-gray-500">Used for AI message generation</p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                        <div className="relative">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={apiKeys.geminiApiKey}
                            onChange={(e) => setApiKeys(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                            className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-sm"
                            placeholder="AIzaSy..."
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-600">
                          <strong>How to get API Key:</strong>
                        </p>
                        <ol className="text-xs text-gray-500 mt-1 space-y-1 list-decimal list-inside">
                          <li>Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a></li>
                          <li>Click "Create API Key"</li>
                          <li>Copy and paste the key above</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={20} className="text-yellow-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-900">Security Notice</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          Your API keys are stored securely and encrypted. Never share your API keys with anyone.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <button
                      onClick={handleSaveApiKeys}
                      disabled={isSaving}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      Save API Keys
                    </button>
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Change Password</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                        <div className="relative">
                          <input
                            type={showPasswords.current ? 'text' : 'password'}
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                            className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                        <div className="relative">
                          <input
                            type={showPasswords.new ? 'text' : 'password'}
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                            className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="Enter new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                        <div className="relative">
                          <input
                            type={showPasswords.confirm ? 'text' : 'password'}
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="Confirm new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <button
                      onClick={handleChangePassword}
                      disabled={isSaving || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                      Change Password
                    </button>
                  </div>

                  {/* About Section */}
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">About</h3>
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Application</span>
                        <span className="font-medium text-gray-900">WA Blast Pro</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Version</span>
                        <span className="font-medium text-gray-900">1.0.0</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Build</span>
                        <span className="font-medium text-gray-900">{new Date().getFullYear()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
