import React, { useState } from 'react';
import { Zap, Mail, Lock, ArrowLeft, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';

interface ForgotPasswordViewProps {
  onBack: () => void;
  onPasswordReset: (token: string) => void;
}

type Step = 'email' | 'token' | 'reset' | 'success';

const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({ onBack, onPasswordReset }) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [devToken, setDevToken] = useState('');

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setIsLoading(true);
    try {
      const { authApi } = await import('../services/api');
      const result = await authApi.forgotPassword(email);
      
      if (result.resetToken) {
        setDevToken(result.resetToken);
      }
      setStep('token');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!resetToken.trim()) {
      setError('Reset token is required');
      return;
    }

    setStep('reset');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const { authApi } = await import('../services/api');
      const result = await authApi.resetPassword(resetToken, newPassword);
      
      localStorage.setItem('authToken', result.token);
      setStep('success');
      
      setTimeout(() => {
        onPasswordReset(result.token);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const renderEmailStep = () => (
    <form onSubmit={handleRequestReset} className="space-y-5 md:space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      <p className="text-sm text-gray-500">
        Enter your email address and we'll send you instructions to reset your password.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            placeholder="name@company.com"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-emerald-900 hover:bg-emerald-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/20 transition-transform transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Sending...
          </>
        ) : (
          'Send Reset Instructions'
        )}
      </button>
    </form>
  );

  const renderTokenStep = () => (
    <form onSubmit={handleVerifyToken} className="space-y-5 md:space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm border border-emerald-100">
        <p className="font-medium mb-1">Check your email!</p>
        <p>We've sent a password reset link to <strong>{email}</strong></p>
      </div>

      {devToken && (
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-xl text-sm border border-yellow-100">
          <p className="font-medium mb-1">Development Mode</p>
          <p className="break-all text-xs">Token: <code className="bg-yellow-100 px-1 rounded">{devToken}</code></p>
          <button
            type="button"
            onClick={() => setResetToken(devToken)}
            className="mt-2 text-yellow-800 underline text-xs"
          >
            Use this token
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Reset Token</label>
        <input
          type="text"
          value={resetToken}
          onChange={(e) => setResetToken(e.target.value)}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          placeholder="Paste your reset token here"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-emerald-900 hover:bg-emerald-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/20 transition-transform transform active:scale-[0.98]"
      >
        Continue
      </button>

      <button
        type="button"
        onClick={() => setStep('email')}
        className="w-full text-gray-500 hover:text-gray-700 text-sm"
      >
        Didn't receive email? Try again
      </button>
    </form>
  );

  const renderResetStep = () => (
    <form onSubmit={handleResetPassword} className="space-y-5 md:space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      <p className="text-sm text-gray-500">
        Create a new password for your account.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            placeholder="Min. 6 characters"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            placeholder="Confirm your password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-emerald-900 hover:bg-emerald-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/20 transition-transform transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Resetting...
          </>
        ) : (
          'Reset Password'
        )}
      </button>
    </form>
  );

  const renderSuccessStep = () => (
    <div className="text-center py-6">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={32} className="text-emerald-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Password Reset!</h2>
      <p className="text-gray-500">Your password has been successfully reset. Redirecting you to dashboard...</p>
    </div>
  );

  const getTitle = () => {
    switch (step) {
      case 'email': return 'Forgot Password';
      case 'token': return 'Check Your Email';
      case 'reset': return 'Create New Password';
      case 'success': return 'Success!';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-6 md:p-12 max-w-md w-full border border-gray-100">
        <div className="text-center mb-8 md:mb-10">
          <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-600/20">
            <Zap size={24} className="text-white" fill="white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{getTitle()}</h1>
        </div>

        {step === 'email' && renderEmailStep()}
        {step === 'token' && renderTokenStep()}
        {step === 'reset' && renderResetStep()}
        {step === 'success' && renderSuccessStep()}

        {step !== 'success' && (
          <button
            onClick={onBack}
            className="mt-8 flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 text-sm mx-auto"
          >
            <ArrowLeft size={16} />
            Back to login
          </button>
        )}
      </div>
      <p className="mt-8 text-xs text-gray-400 text-center">© 2023 Donezo WA Blast Inc. All rights reserved.</p>
    </div>
  );
};

export default ForgotPasswordView;
