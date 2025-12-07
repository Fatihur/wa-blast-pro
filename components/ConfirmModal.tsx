import React from 'react';
import { AlertTriangle, Trash2, X, StopCircle, Info } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <Trash2 size={32} />;
      case 'warning':
        return <StopCircle size={32} />;
      case 'info':
        return <Info size={32} />;
      default:
        return <AlertTriangle size={32} />;
    }
  };

  const getColors = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          confirmBg: 'bg-red-600 hover:bg-red-700',
          confirmShadow: 'shadow-red-600/20'
        };
      case 'warning':
        return {
          iconBg: 'bg-orange-100',
          iconColor: 'text-orange-600',
          confirmBg: 'bg-orange-600 hover:bg-orange-700',
          confirmShadow: 'shadow-orange-600/20'
        };
      case 'info':
        return {
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          confirmBg: 'bg-blue-600 hover:bg-blue-700',
          confirmShadow: 'shadow-blue-600/20'
        };
      default:
        return {
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          confirmBg: 'bg-red-600 hover:bg-red-700',
          confirmShadow: 'shadow-red-600/20'
        };
    }
  };

  const colors = getColors();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md relative z-10 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
        <div className={`w-14 h-14 ${colors.iconBg} rounded-full flex items-center justify-center mx-auto mb-6 ${colors.iconColor}`}>
          {getIcon()}
        </div>
        <h3 className="text-xl font-bold text-center text-gray-900 mb-2">{title}</h3>
        <p className="text-center text-gray-500 mb-8">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-3 ${colors.confirmBg} text-white font-bold rounded-xl shadow-lg ${colors.confirmShadow} transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ConfirmModal;
