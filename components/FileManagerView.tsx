
import React, { useState, useRef } from 'react';
import { Contact } from '../types';
import { FolderOpen, UploadCloud, FileText, Image as ImageIcon, Trash2, Search, CheckCircle, AlertCircle, Send, Sparkles, Filter, Bold, Italic, Strikethrough, Code, X } from 'lucide-react';

// Reusing mock contacts for matching simulation
const MOCK_CONTACTS: Contact[] = [
  { id: '1', name: 'Alexandra Deff', phone: '+6281234567890', tags: ['Customer'] },
  { id: '2', name: 'Edwin Adenike', phone: '+6281987654321', tags: ['Lead'] },
  { id: '3', name: 'Isaac Oluwatemilorun', phone: '+6281345678901', tags: ['Customer'] },
  { id: '4', name: 'David Oshodi', phone: '+6285678901234', tags: ['Inactive'] },
  { id: '5', name: 'Totok Michael', phone: '+6281211223344', tags: ['VIP'] },
];

interface StoredFile {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'image' | 'doc';
  date: string;
}

const MOCK_FILES: StoredFile[] = [
    { id: 'f1', name: 'Invoice_Alexandra_Deff.pdf', size: '1.2 MB', type: 'pdf', date: '2023-10-25' },
    { id: 'f2', name: 'Proposal - Edwin Adenike.docx', size: '450 KB', type: 'doc', date: '2023-10-26' },
    { id: 'f3', name: 'Welcome_Kit.pdf', size: '2.5 MB', type: 'pdf', date: '2023-10-20' },
    { id: 'f4', name: 'Promo_Banner.jpg', size: '1.8 MB', type: 'image', date: '2023-10-22' },
    { id: 'f5', name: 'Report_Totok_Michael_Oct.pdf', size: '890 KB', type: 'pdf', date: '2023-10-27' },
];

const FileManagerView: React.FC = () => {
  // File State
  const [files, setFiles] = useState<StoredFile[]>(MOCK_FILES);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Smart Match State
  const [isSmartMatchMode, setIsSmartMatchMode] = useState(false);
  const [caption, setCaption] = useState('');
  const captionRef = useRef<HTMLTextAreaElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const filesArray: File[] = Array.from(e.target.files);
          const newFiles: StoredFile[] = filesArray.map((file, i) => ({
              id: `new_${Date.now()}_${i}`,
              name: file.name,
              size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
              type: file.type.includes('image') ? 'image' : file.name.endsWith('pdf') ? 'pdf' : 'doc',
              date: new Date().toLocaleDateString()
          }));
          setFiles([...newFiles, ...files]);
      }
  };

  const handleDelete = (id: string) => {
      setFiles(files.filter(f => f.id !== id));
  };

  // Matching Logic
  const getMatchedFile = (contactName: string) => {
      // Normalize strings for better matching (lowercase, remove spaces/special chars)
      const normalizedContact = contactName.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      return files.find(file => {
          const normalizedFile = file.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalizedFile.includes(normalizedContact);
      });
  };

  const matchedContacts = MOCK_CONTACTS.map(contact => ({
      contact,
      file: getMatchedFile(contact.name)
  }));

  const readyToSendCount = matchedContacts.filter(m => m.file).length;

  // Text Insertion Logic (Same as BlastView)
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
            newCursorPos = end + (textToInsert.length * 2);
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

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
      
      {/* Header */}
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">File Manager</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">Upload files and match them to contacts.</p>
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
                {isSmartMatchMode ? 'Smart Match Active' : 'Start Smart Match'}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
          
          {/* Left Column: File Library (Takes full width if Smart Match is off, else 7 cols) */}
          <div className={`space-y-6 transition-all duration-300 ${isSmartMatchMode ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
              
              {/* Library Header & Search */}
              <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                   <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search filenames..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                         <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 md:flex-none bg-emerald-900 text-white px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-emerald-800 shadow-lg shadow-emerald-900/20 transition-all"
                        >
                            <UploadCloud size={18} />
                            <span>Upload</span>
                        </button>
                        <input 
                            type="file" 
                            multiple 
                            className="hidden" 
                            ref={fileInputRef} 
                            onChange={handleFileUpload}
                        />
                    </div>
              </div>

              {/* File Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())).map((file) => (
                    <div key={file.id} className="group bg-white border border-gray-200 hover:border-emerald-500 hover:shadow-md rounded-2xl p-4 transition-all relative">
                        <div className="flex items-start justify-between mb-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${file.type === 'pdf' ? 'bg-red-50 text-red-500' : file.type === 'doc' ? 'bg-blue-50 text-blue-500' : 'bg-purple-50 text-purple-500'}`}>
                                {file.type === 'image' ? <ImageIcon size={24} /> : <FileText size={24} />}
                            </div>
                            <button 
                                onClick={() => handleDelete(file.id)}
                                className="text-gray-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                        <h4 className="font-semibold text-gray-800 truncate mb-1" title={file.name}>{file.name}</h4>
                        <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
                            <span>{file.size}</span>
                            <span>{file.date}</span>
                        </div>
                    </div>
                ))}
                
                {/* Drop Zone */}
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-2xl p-4 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 hover:text-emerald-600 transition-all min-h-[140px]"
                >
                    <UploadCloud size={32} className="mb-2 opacity-50" />
                    <span className="font-medium text-sm">Drop files here</span>
                </div>
            </div>
          </div>

          {/* Right Column: Smart Match Campaign (Visible only when active) */}
          {isSmartMatchMode && (
             <div className="lg:col-span-5 space-y-6 animate-[slideInRight_0.3s_ease-out]">
                
               <div className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[650px] border border-gray-100 relative">
                    
                    {/* Header Section */}
                    <div className="bg-gradient-to-r from-emerald-800 to-teal-600 p-6 pb-0 text-white shrink-0 relative overflow-hidden">
                        {/* Decorative blur */}
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="flex items-start gap-4 mb-6 relative z-10">
                            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md shadow-sm">
                                <Sparkles size={24} className="text-yellow-300" fill="currentColor" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold leading-tight">Smart Campaign</h3>
                                <p className="text-sm text-emerald-100 opacity-90">Match files by name & send.</p>
                            </div>
                        </div>

                        {/* Stats Bar */}
                        <div className="flex items-center justify-between bg-black/20 rounded-t-xl p-4 backdrop-blur-sm">
                                <span className="text-xs font-bold uppercase tracking-widest opacity-80">Matched</span>
                                <span className="text-2xl font-bold">{readyToSendCount} / {matchedContacts.length}</span>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto bg-white relative">
                        <div className="divide-y divide-gray-50">
                            {matchedContacts.map(({ contact, file }) => (
                                <div key={contact.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="font-semibold text-gray-900 mb-1">{contact.name}</div>
                                        {file ? (
                                            <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 self-start inline-flex px-2 py-0.5 rounded text-xs font-medium truncate max-w-full">
                                                <FileText size={12} className="shrink-0" />
                                                <span className="truncate">{file.name}</span>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-gray-400 italic">No matching file found</div>
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
                        
                        {/* Caption Editor Section */}
                        <div className="p-6 bg-gray-50 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Message Caption</label>
                                <span className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-400">Optional</span>
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
                                    <button onClick={() => insertCaptionText('*', true)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"><Bold size={12}/></button>
                                    <button onClick={() => insertCaptionText('_', true)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"><Italic size={12}/></button>
                                    <button onClick={() => insertCaptionText('~', true)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"><Strikethrough size={12}/></button>
                                </div>
                                <textarea
                                    ref={captionRef}
                                    value={caption}
                                    onChange={(e) => setCaption(e.target.value)}
                                    placeholder="Add a caption for these files..."
                                    className="w-full h-20 p-3 text-sm focus:outline-none resize-none text-gray-700"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer Action */}
                    <div className="p-6 bg-white border-t border-gray-100 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
                        <button 
                            disabled={readyToSendCount === 0}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20 transition-all transform active:scale-[0.98]"
                        >
                            <Send size={20} />
                            Send to {readyToSendCount} Contacts
                        </button>
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
