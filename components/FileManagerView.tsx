import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { contactsApi, filesApi } from '../services/api';
import { Contact, StoredFile } from '../types';
import {
  AlertCircle,
  Bold,
  CheckCircle,
  FileText,
  Image as ImageIcon,
  Loader2,
  Search,
  Send,
  Sparkles,
  Strikethrough,
  Trash2,
  UploadCloud,
  Italic,
} from 'lucide-react';

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

const FileManagerView: React.FC = () => {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isSmartMatchMode, setIsSmartMatchMode] = useState(false);
  const [caption, setCaption] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [filesResult, contactsResult] = await Promise.all([filesApi.getAll(), contactsApi.getAll()]);
      setFiles(filesResult.files || []);
      setContacts(contactsResult.contacts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load file manager data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!feedback && !error) return;
    const timeout = setTimeout(() => {
      setFeedback(null);
      setError(null);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [feedback, error]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await filesApi.uploadMany(selectedFiles);
      setFiles(prev => [...result.files, ...prev]);
      setFeedback(`Uploaded ${result.uploaded} file${result.uploaded === 1 ? '' : 's'}`);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeletingId(id);
    setError(null);

    try {
      await filesApi.delete(id);
      setFiles(prev => prev.filter(file => file.id !== id));
      setFeedback('File deleted');
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    } finally {
      setIsDeletingId(null);
    }
  };

  const visibleFiles = useMemo(
    () => files.filter(file => file.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [files, searchTerm]
  );

  const getMatchedFile = useCallback(
    (contactName: string) => {
      const normalizedContact = contactName.toLowerCase().replace(/[^a-z0-9]/g, '');

      return files.find(file => {
        const normalizedFile = file.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalizedContact.length > 0 && normalizedFile.includes(normalizedContact);
      });
    },
    [files]
  );

  const matchedContacts = useMemo(
    () => contacts.map(contact => ({ contact, file: getMatchedFile(contact.name) })),
    [contacts, getMatchedFile]
  );

  const readyToSendCount = matchedContacts.filter(item => item.file).length;

  const insertCaptionText = (textToInsert: string, wrap: boolean = false) => {
    if (!captionRef.current) return;

    const start = captionRef.current.selectionStart;
    const end = captionRef.current.selectionEnd;
    const currentText = caption;

    let newText = '';
    let newCursorPos = 0;

    if (wrap) {
      const selectedText = currentText.substring(start, end);
      const before = currentText.substring(0, start);
      const after = currentText.substring(end);

      if (start === end) {
        newText = before + textToInsert + textToInsert + after;
        newCursorPos = start + textToInsert.length;
      } else {
        newText = before + textToInsert + selectedText + textToInsert + after;
        newCursorPos = end + textToInsert.length * 2;
      }
    } else {
      const before = currentText.substring(0, start);
      const after = currentText.substring(end);
      newText = before + textToInsert + after;
      newCursorPos = start + textToInsert.length;
    }

    setCaption(newText);

    setTimeout(() => {
      if (captionRef.current) {
        captionRef.current.focus();
        captionRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const renderFileIcon = (type: StoredFile['type']) => {
    if (type === 'image') {
      return <ImageIcon size={24} />;
    }

    return <FileText size={24} />;
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-28 md:pb-24">
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">File Manager</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">Kelola file upload nyata, cocokkan dengan kontak, dan siapkan caption untuk blast media.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsSmartMatchMode(!isSmartMatchMode)}
            className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm transform active:scale-95 ${
              isSmartMatchMode
                ? 'bg-emerald-600 text-white shadow-emerald-200 ring-2 ring-offset-2 ring-emerald-600'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Sparkles size={18} className={isSmartMatchMode ? 'text-yellow-300' : 'text-emerald-600'} fill={isSmartMatchMode ? 'currentColor' : 'none'} />
            {isSmartMatchMode ? 'Pencocokan aktif' : 'Mulai pencocokan'}
          </button>
        </div>
      </div>

      {(feedback || error) && (
        <div
          className={`mb-6 rounded-2xl px-4 py-3 text-sm flex items-center gap-2 ${
            error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
          }`}
        >
          {error ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          <span>{error || feedback}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        <div className="lg:col-span-12 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-sm text-emerald-800">
          Semua file di halaman ini tersimpan nyata per akun. Gunakan pencocokan untuk menyiapkan materi blast media dengan lebih cepat.
        </div>

        <div className={`space-y-6 transition-all duration-300 ${isSmartMatchMode ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Cari nama file..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex-1 md:flex-none bg-emerald-900 text-white px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-emerald-800 shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-70"
              >
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                <span>{isUploading ? 'Mengunggah...' : 'Upload file'}</span>
              </button>
              <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            </div>
          </div>

          {isLoading ? (
            <div className="bg-white border border-gray-100 rounded-3xl p-10 flex items-center justify-center gap-3 text-gray-500">
              <Loader2 size={20} className="animate-spin" />
              <span>Memuat file...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleFiles.map(file => (
                <div key={file.id} className="group bg-white border border-gray-200 hover:border-emerald-500 hover:shadow-md rounded-2xl p-4 transition-all relative">
                  <div className="flex items-start justify-between mb-3">
                    <a
                      href={`${API_BASE.replace(/\/api$/, '')}${file.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        file.type === 'pdf'
                          ? 'bg-red-50 text-red-500'
                          : file.type === 'doc'
                            ? 'bg-blue-50 text-blue-500'
                            : file.type === 'image'
                              ? 'bg-emerald-50 text-emerald-500'
                              : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {renderFileIcon(file.type)}
                    </a>
                    <button
                      onClick={() => handleDelete(file.id)}
                      disabled={isDeletingId === file.id}
                      className="text-gray-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60"
                    >
                      {isDeletingId === file.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                    </button>
                  </div>
                  <h4 className="font-semibold text-gray-800 truncate mb-1" title={file.name}>{file.name}</h4>
                  <div className="flex items-center justify-between text-xs text-gray-400 font-medium mb-3">
                    <span>{file.size}</span>
                    <span>{new Date(file.date).toLocaleDateString()}</span>
                  </div>
                  <a
                    href={`${API_BASE.replace(/\/api$/, '')}${file.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-700 font-medium hover:text-emerald-800"
                  >
                    Buka file
                  </a>
                </div>
              ))}

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-2xl p-4 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 hover:text-emerald-600 transition-all min-h-[140px]"
              >
                <UploadCloud size={32} className="mb-2 opacity-50" />
                <span className="font-medium text-sm">Klik untuk upload file tambahan</span>
              </div>
            </div>
          )}
        </div>

        {isSmartMatchMode && (
          <div className="lg:col-span-5 space-y-6 animate-[slideInRight_0.3s_ease-out]">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[650px] border border-gray-100 relative">
              <div className="bg-gradient-to-r from-emerald-800 to-teal-600 p-6 pb-0 text-white shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-start gap-4 mb-6 relative z-10">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md shadow-sm">
                    <Sparkles size={24} className="text-yellow-300" fill="currentColor" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold leading-tight">Pencocokan Otomatis</h3>
                    <p className="text-sm text-emerald-100 opacity-90">Cocokkan file berdasarkan nama kontak.</p>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-black/20 rounded-t-xl p-4 backdrop-blur-sm">
                  <span className="text-xs font-bold uppercase tracking-widest opacity-80">Cocok</span>
                  <span className="text-2xl font-bold">{readyToSendCount} / {matchedContacts.length}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-white relative">
                <div className="divide-y divide-gray-50">
                  {matchedContacts.map(({ contact, file }) => (
                    <div key={contact.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="font-semibold text-gray-900 mb-1">{contact.name}</div>
                        <div className="text-xs text-gray-400 mb-2">{contact.phone}</div>
                        {file ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 self-start inline-flex px-2 py-0.5 rounded text-xs font-medium truncate max-w-full">
                            <FileText size={12} className="shrink-0" />
                            <span className="truncate">{file.name}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 italic">Belum ada file yang cocok</div>
                        )}
                      </div>
                      <div className="shrink-0">
                        {file ? (
                          <CheckCircle size={24} className="text-emerald-500 drop-shadow-sm" fill="white" />
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-gray-200"></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Caption Pesan</label>
                      <span className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-400">Opsional</span>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 transition-shadow">
                    <div className="flex items-center gap-1 p-1.5 border-b border-gray-100 bg-gray-50/50">
                      <button onClick={() => insertCaptionText('{name}')} className="px-2 py-1 text-xs font-medium bg-white border border-gray-200 text-gray-600 rounded hover:text-emerald-600 transition-colors">
                        {'{name}'}
                      </button>
                      <button onClick={() => insertCaptionText('{phone}')} className="px-2 py-1 text-xs font-medium bg-white border border-gray-200 text-gray-600 rounded hover:text-emerald-600 transition-colors">
                        {'{phone}'}
                      </button>
                      <div className="w-px h-4 bg-gray-300 mx-1"></div>
                      <button onClick={() => insertCaptionText('*', true)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"><Bold size={12} /></button>
                      <button onClick={() => insertCaptionText('_', true)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"><Italic size={12} /></button>
                      <button onClick={() => insertCaptionText('~', true)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"><Strikethrough size={12} /></button>
                    </div>
                    <textarea
                      ref={captionRef}
                      value={caption}
                      onChange={e => setCaption(e.target.value)}
                      placeholder="Tulis caption untuk file yang cocok..."
                      className="w-full h-20 p-3 text-sm focus:outline-none resize-none text-gray-700"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white border-t border-gray-100 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
                <button type="button" disabled className="w-full bg-gray-300 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 cursor-not-allowed">
                  <Send size={20} />
                  Siap ditinjau untuk {readyToSendCount} kontak
                </button>
                <p className="mt-3 text-xs text-gray-400 text-center">Langkah berikutnya: pilih file yang cocok ini saat membuat blast media.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default FileManagerView;
