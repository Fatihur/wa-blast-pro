
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { generateBlastMessage } from '../services/geminiService';
import { Send, Paperclip, Image as ImageIcon, FileText, Sparkles, X, Users, Search, Check, ChevronRight, Edit2, User, Type, UploadCloud, Trash2, Loader2, ChevronDown, Bold, Italic, Strikethrough, Code, Pause, Play, AlertCircle, CheckCircle, XCircle, BarChart3, MapPin, Plus, Minus, UsersRound } from 'lucide-react';
import { MessageType, Group, Contact } from '../types';
import { blastApi, contactsApi, whatsappApi, settingsApi, normalizeSettings } from '../services/api';

interface BlastJob {
  id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  progress: {
    total: number;
    sent: number;
    failed: number;
    current: number;
  };
}

const BlastView: React.FC = () => {
  // Contacts and Groups from database
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  // Message State
  const [message, setMessage] = useState('');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('Ramah');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [messageType, setMessageType] = useState<MessageType>(MessageType.TEXT);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Audience State
  const [audienceType, setAudienceType] = useState<'all' | 'specific'>('all');
  const [isAudienceModalOpen, setIsAudienceModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'groups' | 'contacts'>('groups');
  
  // Selected IDs
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  
  // Temp IDs for Modal
  const [tempSelectedGroupIds, setTempSelectedGroupIds] = useState<Set<string>>(new Set());
  const [tempSelectedContactIds, setTempSelectedContactIds] = useState<Set<string>>(new Set());
  
  const [audienceSearchTerm, setAudienceSearchTerm] = useState('');

  // Blast Job State
  const [currentJob, setCurrentJob] = useState<BlastJob | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [blastError, setBlastError] = useState<string | null>(null);
  const [waConnected, setWaConnected] = useState(false);
  const [waStatus, setWaStatus] = useState('DISCONNECTED');
  const [defaultDelayMs, setDefaultDelayMs] = useState(3000);

  // Poll State
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  // Location State
  const [locationLat, setLocationLat] = useState('');
  const [locationLng, setLocationLng] = useState('');
  const [locationDesc, setLocationDesc] = useState('');

  // Load contacts and groups from database
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingData(true);
      try {
        const [contactsRes, groupsRes, settingsRes] = await Promise.all([
          contactsApi.getAll(),
          contactsApi.getGroups(),
          settingsApi.getAll()
        ]);
        
        if (contactsRes.success) {
          setContacts(contactsRes.contacts);
        }
        if (groupsRes.success) {
          setGroups(groupsRes.groups);
        }
        if (settingsRes.success) {
          setDefaultDelayMs(normalizeSettings(settingsRes.settings).defaultDelayMs);
        }
      } catch (err) {
        console.error('Failed to load contacts/groups:', err);
      } finally {
        setIsLoadingData(false);
      }
    };
    loadData();
  }, []);

  // Check WhatsApp connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const status = await whatsappApi.getStatus();
        setWaStatus(status.status);
        setWaConnected(status.status === 'READY');
      } catch {
        setWaConnected(false);
        setWaStatus('DISCONNECTED');
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll option handlers
  const addPollOption = () => {
    if (pollOptions.length < 12) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  // Poll job status when running
  useEffect(() => {
    if (!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed') return;
    
    const pollJob = async () => {
      try {
        const result = await blastApi.getJob(currentJob.id);
        if (result.success && result.job) {
          setCurrentJob({
            id: result.job.id,
            status: result.job.status,
            progress: result.job.progress
          });
        }
      } catch (err) {
        console.error('Error polling job:', err);
      }
    };

    const interval = setInterval(pollJob, 1000);
    return () => clearInterval(interval);
  }, [currentJob?.id, currentJob?.status]);

  const totalContacts = contacts.length;
  
  // Calculate specific recipients count (unique contacts)
  const getUniqueRecipientCount = useCallback((): number => {
    if (audienceType === 'all') return totalContacts;
    
    const uniqueContactIds = new Set<string>();
    
    // Add contacts from selected groups
    selectedGroupIds.forEach(groupId => {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        group.contactIds.forEach(contactId => {
          // Only count if contact exists in our contacts list
          if (contacts.find(c => c.id === contactId)) {
            uniqueContactIds.add(contactId);
          }
        });
      }
    });
    
    // Add individually selected contacts
    selectedContactIds.forEach(contactId => {
      if (contacts.find(c => c.id === contactId)) {
        uniqueContactIds.add(contactId);
      }
    });
    
    return uniqueContactIds.size;
  }, [audienceType, selectedGroupIds, selectedContactIds, groups, contacts, totalContacts]);
  
  const targetCount = getUniqueRecipientCount();

  const filteredGroups = groups.filter(g => 
      g.name.toLowerCase().includes(audienceSearchTerm.toLowerCase())
  );

  const filteredContacts = contacts.filter(c => 
      c.name.toLowerCase().includes(audienceSearchTerm.toLowerCase()) ||
      c.phone.includes(audienceSearchTerm)
  );

  // Handlers
  const handleGenerate = async () => {
    if (!topic) return;
    setIsGenerating(true);
    try {
      const generated = await generateBlastMessage(topic, tone);
      setMessage(generated);
    } catch (e) {
        console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMessageTypeChange = (type: MessageType) => {
      setMessageType(type);
      if (type === MessageType.TEXT) {
          setSelectedFile(null);
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setSelectedFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const insertText = (textToInsert: string, wrap: boolean = false) => {
      if (!textAreaRef.current) return;
      
      const start = textAreaRef.current.selectionStart;
      const end = textAreaRef.current.selectionEnd;
      const currentText = message;
      
      let newText = '';
      let newCursorPos = 0;

      if (wrap) {
          // Wrap selected text (e.g., *selected*)
          const selectedText = currentText.substring(start, end);
          const before = currentText.substring(0, start);
          const after = currentText.substring(end);
          
          // If nothing selected, just insert placeholder like **
          if (start === end) {
            newText = before + textToInsert + textToInsert + after;
            newCursorPos = start + textToInsert.length;
          } else {
            newText = before + textToInsert + selectedText + textToInsert + after;
            newCursorPos = end + (textToInsert.length * 2);
          }
      } else {
          // Insert variable at cursor
          const before = currentText.substring(0, start);
          const after = currentText.substring(end);
          newText = before + textToInsert + after;
          newCursorPos = start + textToInsert.length;
      }

      setMessage(newText);
      
      // Need to defer focus and selection setting slightly for React to render
      setTimeout(() => {
          if (textAreaRef.current) {
              textAreaRef.current.focus();
              textAreaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
      }, 0);
  };

  const openAudienceModal = () => {
      setTempSelectedGroupIds(new Set(selectedGroupIds));
      setTempSelectedContactIds(new Set(selectedContactIds));
      setIsAudienceModalOpen(true);
      setAudienceType('specific');
  };

  const toggleSelection = (id: string, type: 'group' | 'contact') => {
      if (type === 'group') {
          const newSet = new Set(tempSelectedGroupIds);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          setTempSelectedGroupIds(newSet);
      } else {
          const newSet = new Set(tempSelectedContactIds);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          setTempSelectedContactIds(newSet);
      }
  };

  const toggleAllInModal = () => {
      if (modalTab === 'groups') {
          const allVisibleIds = filteredGroups.map(g => g.id);
          const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => tempSelectedGroupIds.has(id));
          
          const newSet = new Set(tempSelectedGroupIds);
          if (allSelected) {
              allVisibleIds.forEach(id => newSet.delete(id));
          } else {
              allVisibleIds.forEach(id => newSet.add(id));
          }
          setTempSelectedGroupIds(newSet);
      } else {
          const allVisibleIds = filteredContacts.map(c => c.id);
          const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => tempSelectedContactIds.has(id));
          
          const newSet = new Set(tempSelectedContactIds);
          if (allSelected) {
              allVisibleIds.forEach(id => newSet.delete(id));
          } else {
              allVisibleIds.forEach(id => newSet.add(id));
          }
          setTempSelectedContactIds(newSet);
      }
  };

  const isAllVisibleSelected = modalTab === 'groups' 
      ? filteredGroups.length > 0 && filteredGroups.every(g => tempSelectedGroupIds.has(g.id))
      : filteredContacts.length > 0 && filteredContacts.every(c => tempSelectedContactIds.has(c.id));


  const confirmAudienceSelection = () => {
      setSelectedGroupIds(tempSelectedGroupIds);
      setSelectedContactIds(tempSelectedContactIds);
      setIsAudienceModalOpen(false);
      // If nothing selected, revert to 'all' to avoid empty state
      if (tempSelectedGroupIds.size === 0 && tempSelectedContactIds.size === 0) {
          setAudienceType('all');
      }
  };

  // Get recipients list based on selection
  const getRecipients = (): Array<{ phone: string; name: string }> => {
    const recipientMap = new Map<string, { phone: string; name: string }>();
    
    if (audienceType === 'all') {
      contacts.forEach(c => recipientMap.set(c.phone, { phone: c.phone, name: c.name }));
    } else {
      // Add contacts from selected groups
      selectedGroupIds.forEach(groupId => {
        const group = groups.find(g => g.id === groupId);
        if (group) {
          group.contactIds.forEach(contactId => {
            const contact = contacts.find(c => c.id === contactId);
            if (contact) recipientMap.set(contact.phone, { phone: contact.phone, name: contact.name });
          });
        }
      });
      // Add individually selected contacts
      selectedContactIds.forEach(contactId => {
        const contact = contacts.find(c => c.id === contactId);
        if (contact) recipientMap.set(contact.phone, { phone: contact.phone, name: contact.name });
      });
    }
    
    return Array.from(recipientMap.values());
  };

  // Send blast handler
  const handleSendBlast = async () => {
    // Validation based on message type
    if (messageType === MessageType.TEXT && !message.trim()) {
      setBlastError('Please enter a message');
      return;
    }
    if (messageType === MessageType.POLL) {
      if (!pollQuestion.trim()) {
        setBlastError('Please enter a poll question');
        return;
      }
      const validOptions = pollOptions.filter(o => o.trim());
      if (validOptions.length < 2) {
        setBlastError('Please enter at least 2 poll options');
        return;
      }
    }
    if (messageType === MessageType.LOCATION) {
      if (!locationLat || !locationLng) {
        setBlastError('Please enter latitude and longitude');
        return;
      }
    }

    if (!waConnected) {
      setBlastError('WhatsApp is not connected. Please connect first.');
      return;
    }

    const recipients = getRecipients();
    if (recipients.length === 0) {
      setBlastError('No recipients selected');
      return;
    }

    setIsSending(true);
    setBlastError(null);

    try {
      const formData = new FormData();
      formData.append('type', messageType);
      formData.append('content', message);
      formData.append('recipients', JSON.stringify(recipients));
      formData.append('delayMs', String(defaultDelayMs));

      if (selectedFile) {
        formData.append('media', selectedFile);
      }

      // Add poll data
      if (messageType === MessageType.POLL) {
        const pollDataObj = {
          question: pollQuestion,
          options: pollOptions.filter(o => o.trim())
        };
        formData.append('pollData', JSON.stringify(pollDataObj));
      }

      // Add location data
      if (messageType === MessageType.LOCATION) {
        const locationDataObj = {
          latitude: parseFloat(locationLat),
          longitude: parseFloat(locationLng),
          description: locationDesc
        };
        formData.append('locationData', JSON.stringify(locationDataObj));
      }

      const result = await blastApi.create(formData);
      
      if (result.success && result.job) {
        setCurrentJob({
          id: result.job.id,
          status: result.job.status,
          progress: result.job.progress
        });

        // Start the job
        await blastApi.start(result.job.id);
      } else {
        throw new Error(result.error || 'Failed to create blast job');
      }
    } catch (err: any) {
      setBlastError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handlePauseBlast = async () => {
    if (!currentJob) return;
    try {
      await blastApi.pause(currentJob.id);
    } catch (err: any) {
      setBlastError(err.message);
    }
  };

  const handleResumeBlast = async () => {
    if (!currentJob) return;
    try {
      await blastApi.resume(currentJob.id);
    } catch (err: any) {
      setBlastError(err.message);
    }
  };

  const handleCancelBlast = async () => {
    if (!currentJob) return;
    try {
      await blastApi.cancel(currentJob.id);
      setCurrentJob(null);
    } catch (err: any) {
      setBlastError(err.message);
    }
  };

  const resetBlast = () => {
    setCurrentJob(null);
    setBlastError(null);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-28 md:pb-24 relative">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Blast Baru</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">Susun pesan, pilih audiens, lalu kirim campaign massal dengan alur yang lebih ringkas.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            
            {/* Configuration Column */}
            <div className="lg:col-span-2 space-y-6">
                <div className="lg:hidden bg-white border border-gray-100 rounded-3xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Ringkasan cepat</p>
                            <h3 className="mt-1 text-lg font-bold text-gray-900">Siap kirim ke {targetCount} penerima</h3>
                        </div>
                        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${waConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {waConnected ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                            {waConnected ? 'WA aktif' : 'WA belum siap'}
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-gray-50 px-4 py-3">
                            <p className="text-xs text-gray-400">Tipe pesan</p>
                            <p className="mt-1 font-semibold text-gray-900">{messageType}</p>
                        </div>
                        <div className="rounded-2xl bg-gray-50 px-4 py-3">
                            <p className="text-xs text-gray-400">Jeda default</p>
                            <p className="mt-1 font-semibold text-gray-900">{Math.round(defaultDelayMs / 1000)} detik</p>
                        </div>
                    </div>
                </div>
                
                {/* Audience Selection */}
                <div className="bg-white p-5 md:p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">1. Pilih Audiens</h3>
                    <div className="space-y-3">
                        {/* Option: All Contacts */}
                        <label className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${audienceType === 'all' ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <input 
                                type="radio" 
                                name="audience" 
                                className="w-5 h-5 text-emerald-600 focus:ring-emerald-500" 
                                checked={audienceType === 'all'}
                                onChange={() => setAudienceType('all')}
                            />
                            <div className="ml-3 min-w-0">
                                <span className="block font-medium text-gray-800">Semua kontak</span>
                                <span className="block text-sm text-gray-500">
                                    {isLoadingData ? 'Memuat...' : `Kirim ke seluruh database (${totalContacts} kontak)`}
                                </span>
                            </div>
                        </label>

                        {/* Option: Specific Audience */}
                        <div 
                            className={`flex flex-col p-3 border rounded-xl cursor-pointer transition-all ${audienceType === 'specific' ? 'border-emerald-500 bg-white ring-1 ring-emerald-500' : 'border-gray-200 hover:bg-gray-50'}`}
                            onClick={() => {
                                if (audienceType !== 'specific') openAudienceModal();
                            }}
                        >
                            <div className="flex items-start w-full gap-3">
                                <input 
                                    type="radio" 
                                    name="audience" 
                                    className="w-5 h-5 text-emerald-600 focus:ring-emerald-500" 
                                    checked={audienceType === 'specific'}
                                    onChange={() => {}} // Handled by parent div
                                />
                                <div className="flex-1 min-w-0">
                                    <span className="block font-medium text-gray-800">Audiens tertentu</span>
                                    <span className="block text-sm text-gray-500">Pilih grup atau kontak tertentu</span>
                                </div>
                                {audienceType === 'specific' && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openAudienceModal();
                                        }}
                                        className="shrink-0 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors"
                                    >
                                        <Edit2 size={12} /> Ubah
                                    </button>
                                )}
                            </div>
                            
                            {/* Selected Preview */}
                            {audienceType === 'specific' && (selectedGroupIds.size > 0 || selectedContactIds.size > 0) && (
                                <div className="mt-3 ml-8 flex flex-wrap gap-2 items-center">
                                    {selectedGroupIds.size > 0 && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-indigo-100 text-indigo-700 text-xs font-medium">
                                            {selectedGroupIds.size} grup
                                        </span>
                                    )}
                                    {selectedContactIds.size > 0 && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 text-xs font-medium">
                                            {selectedContactIds.size} kontak
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-500">
                                        = {targetCount} penerima unik
                                    </span>
                                </div>
                            )}
                             {audienceType === 'specific' && selectedGroupIds.size === 0 && selectedContactIds.size === 0 && (
                                <div className="mt-2 ml-8 text-xs text-red-500">
                                     * Belum ada audiens dipilih. Klik area ini untuk memilih grup atau kontak.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Message Composition */}
                <div className="bg-white p-5 md:p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                        <h3 className="text-lg font-bold text-gray-800">2. Susun Pesan</h3>
                        
                        {/* Message Type Selector */}
                        <div className="flex overflow-x-auto no-scrollbar p-1 bg-gray-100 rounded-xl self-start gap-1 max-w-full">
                            <button 
                                onClick={() => handleMessageTypeChange(MessageType.TEXT)}
                                className={`shrink-0 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all ${messageType === MessageType.TEXT ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Type size={14} /> Teks
                            </button>
                            <button 
                                onClick={() => handleMessageTypeChange(MessageType.IMAGE)}
                                className={`shrink-0 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all ${messageType === MessageType.IMAGE ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <ImageIcon size={14} /> Gambar
                            </button>
                            <button 
                                onClick={() => handleMessageTypeChange(MessageType.DOCUMENT)}
                                className={`shrink-0 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all ${messageType === MessageType.DOCUMENT ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <FileText size={14} /> Dokumen
                            </button>
                            <button 
                                onClick={() => handleMessageTypeChange(MessageType.POLL)}
                                className={`shrink-0 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all ${messageType === MessageType.POLL ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <BarChart3 size={14} /> Polling
                            </button>
                            <button 
                                onClick={() => handleMessageTypeChange(MessageType.LOCATION)}
                                className={`shrink-0 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all ${messageType === MessageType.LOCATION ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <MapPin size={14} /> Lokasi
                            </button>
                        </div>
                    </div>

                    {/* Upload Area for Image/Doc */}
                    {messageType !== MessageType.TEXT && (
                        <div className="mb-4">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept={messageType === MessageType.IMAGE ? "image/*" : ".pdf,.doc,.docx,.xls,.xlsx,.txt"}
                                onChange={handleFileChange} 
                            />
                            
                            {!selectedFile ? (
                                 <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${messageType === MessageType.IMAGE ? 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60' : 'border-blue-200 bg-blue-50/30 hover:bg-blue-50/60'}`}
                                 >
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${messageType === MessageType.IMAGE ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                        <UploadCloud size={24} />
                                    </div>
                                     <p className="font-medium text-gray-700 text-center">
                                         Klik untuk upload {messageType === MessageType.IMAGE ? 'gambar' : 'dokumen'}
                                     </p>
                                     <p className="text-xs text-gray-400 mt-1">
                                         {messageType === MessageType.IMAGE ? 'JPG, PNG hingga 5MB' : 'PDF, DOC, XLS hingga 10MB'}
                                     </p>
                                 </div>
                            ) : (
                                <div className="p-4 border border-gray-200 rounded-2xl flex items-center justify-between bg-gray-50">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${messageType === MessageType.IMAGE ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {messageType === MessageType.IMAGE ? <ImageIcon size={24} /> : <FileText size={24} />}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">{selectedFile.name}</p>
                                            <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={clearFile} 
                                        className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Poll Input */}
                    {messageType === MessageType.POLL && (
                        <div className="mb-4 p-4 border border-purple-200 rounded-2xl bg-purple-50/30">
                                <h4 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
                                    <BarChart3 size={18} /> Buat polling
                                </h4>
                            <div className="space-y-3">
                                <div>
                                     <label className="block text-sm font-medium text-gray-700 mb-1">Pertanyaan</label>
                                    <input
                                        type="text"
                                        value={pollQuestion}
                                        onChange={(e) => setPollQuestion(e.target.value)}
                                         placeholder="Apa pilihan favorit kamu...?"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                    />
                                </div>
                                <div>
                                     <label className="block text-sm font-medium text-gray-700 mb-1">Opsi (min 2, maks 12)</label>
                                    <div className="space-y-2">
                                        {pollOptions.map((option, index) => (
                                            <div key={index} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={option}
                                                    onChange={(e) => updatePollOption(index, e.target.value)}
                                                    placeholder={`Opsi ${index + 1}`}
                                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                                />
                                                {pollOptions.length > 2 && (
                                                    <button
                                                        onClick={() => removePollOption(index)}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                                    >
                                                        <Minus size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {pollOptions.length < 12 && (
                                        <button
                                            onClick={addPollOption}
                                            className="mt-2 px-4 py-2 text-purple-600 hover:bg-purple-100 rounded-xl text-sm font-medium flex items-center gap-1"
                                         >
                                            <Plus size={16} /> Tambah opsi
                                         </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Location Input */}
                    {messageType === MessageType.LOCATION && (
                        <div className="mb-4 p-4 border border-orange-200 rounded-2xl bg-orange-50/30">
                                <h4 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                                    <MapPin size={18} /> Kirim lokasi
                                </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                                    <input
                                        type="text"
                                        value={locationLat}
                                        onChange={(e) => setLocationLat(e.target.value)}
                                        placeholder="-6.2088"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                                    <input
                                        type="text"
                                        value={locationLng}
                                        onChange={(e) => setLocationLng(e.target.value)}
                                        placeholder="106.8456"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                                <div className="col-span-2">
                                     <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi (opsional)</label>
                                    <input
                                        type="text"
                                        value={locationDesc}
                                        onChange={(e) => setLocationDesc(e.target.value)}
                                        placeholder="Lokasi kantor / titik temu"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                 Tips: ambil koordinat dari Google Maps dengan klik kanan pada titik lokasi
                            </p>
                        </div>
                    )}

                    {/* AI Helper Redesigned - Hide for Poll/Location */}
                    {(messageType === MessageType.TEXT || messageType === MessageType.IMAGE || messageType === MessageType.DOCUMENT) && (
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-white border border-indigo-100 p-5 mb-6">
                       {/* Decorative background blob */}
                       <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-100 rounded-full blur-2xl opacity-50 pointer-events-none"></div>

                       {/* Header */}
                       <div className="relative z-10 flex justify-between items-start mb-4">
                           <div>
                               <h4 className="text-indigo-900 font-bold flex items-center gap-2">
                                   <Sparkles size={18} className="text-indigo-600" />
                                   Asisten Penulis AI
                               </h4>
                               <p className="text-xs text-indigo-600/70 mt-1 font-medium">Masukkan topik dan biarkan AI membuatkan pesan yang humanis untuk Anda.</p>
                           </div>
                       </div>

                       {/* Controls */}
                            <div className="relative z-10 flex flex-col md:flex-row gap-3">
                           <div className="flex-1">
                               <input
                                   type="text"
                                   className="w-full h-11 px-4 rounded-xl border-0 ring-1 ring-indigo-200 focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm placeholder:text-indigo-300/70 text-sm transition-all"
                                   placeholder="cth: Promo diskon 50% untuk pelanggan setia"
                                   value={topic}
                                   onChange={(e) => setTopic(e.target.value)}
                               />
                           </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <div className="relative min-w-[120px]">
                                   <select
                                       className="w-full h-11 pl-4 pr-8 rounded-xl border-0 ring-1 ring-indigo-200 focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm appearance-none cursor-pointer text-sm font-medium text-indigo-900 transition-all"
                                       value={tone}
                                       onChange={(e) => setTone(e.target.value)}
                                   >
                                       <option>Ramah</option>
                                       <option>Profesional</option>
                                       <option>Santai</option>
                                       <option>Mendesak</option>
                                       <option>Persuasif</option>
                                       <option>Informatif</option>
                                   </select>
                                   <ChevronDown size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-indigo-400 pointer-events-none" />
                               </div>

                               <button
                                   onClick={handleGenerate}
                                   disabled={isGenerating || !topic}
                                   className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none whitespace-nowrap"
                               >
                                   {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                   <span>{isGenerating ? 'Menulis...' : 'Buat Pesan'}</span>
                               </button>
                           </div>
                       </div>
                    </div>
                    )}

                    {/* Toolbar for Variables and Formatting - Hide for Poll/Location */}
                    {(messageType === MessageType.TEXT || messageType === MessageType.IMAGE || messageType === MessageType.DOCUMENT) && (
                    <>
                    <div className="flex flex-wrap items-center gap-2 mb-2 p-2 bg-gray-50 rounded-xl border border-gray-100">
                        {/* Variables */}
                        <div className="flex items-center gap-2 border-r border-gray-200 pr-2 mr-1">
                            <span className="text-xs font-bold text-gray-400 uppercase px-1">Variabel</span>
                            <button 
                                onClick={() => insertText('{name}')}
                                className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:text-emerald-600 hover:border-emerald-300 transition-colors shadow-sm"
                            >
                                {'{name}'}
                            </button>
                            <button 
                                onClick={() => insertText('{phone}')}
                                className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:text-emerald-600 hover:border-emerald-300 transition-colors shadow-sm"
                            >
                                {'{phone}'}
                            </button>
                        </div>

                        {/* Formatting */}
                        <div className="flex items-center gap-1">
                             <button onClick={() => insertText('*', true)} title="Bold" className="p-1.5 hover:bg-gray-200 rounded text-gray-600 transition-colors">
                                <Bold size={14} />
                             </button>
                             <button onClick={() => insertText('_', true)} title="Italic" className="p-1.5 hover:bg-gray-200 rounded text-gray-600 transition-colors">
                                <Italic size={14} />
                             </button>
                             <button onClick={() => insertText('~', true)} title="Strikethrough" className="p-1.5 hover:bg-gray-200 rounded text-gray-600 transition-colors">
                                <Strikethrough size={14} />
                             </button>
                             <button onClick={() => insertText('```', true)} title="Monospace" className="p-1.5 hover:bg-gray-200 rounded text-gray-600 transition-colors">
                                <Code size={14} />
                             </button>
                        </div>
                    </div>

                    {/* Text Area */}
                    <div className="relative">
                        <textarea
                            ref={textAreaRef}
                             className="w-full h-44 md:h-48 p-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none text-base text-gray-700 font-sans"
                             placeholder={messageType === MessageType.TEXT ? "Tulis pesan di sini atau gunakan AI untuk membuat draft..." : "Tambahkan caption (opsional)..."}
                             value={message}
                             onChange={(e) => setMessage(e.target.value)}
                        ></textarea>
                        <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                            {message.length} karakter
                        </div>
                    </div>
                    </>
                    )}

                </div>
            </div>

            {/* Preview & Action Column */}
            <div className="space-y-6 lg:sticky lg:top-24 self-start">
                  <div className="bg-white p-5 md:p-6 rounded-3xl border border-gray-100 shadow-sm h-full flex flex-col">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <h3 className="text-lg font-bold text-gray-800">Preview</h3>
                      <span className="text-xs text-gray-400">Estimasi {Math.ceil(targetCount * (defaultDelayMs / 1000) / 60)} menit</span>
                    </div>
                    
                    {/* WhatsApp Phone Mockup */}
                    <div className="flex-1 bg-gray-100 rounded-2xl border-4 border-gray-800 p-2 relative overflow-hidden min-h-[400px]">
                        <div className="w-full h-full bg-[#efe7dd] rounded-xl relative overflow-y-auto no-scrollbar flex flex-col">
                            <div className="bg-[#008069] p-3 flex items-center gap-2 text-white sticky top-0 z-10 shadow-md">
                                <div className="w-8 h-8 rounded-full bg-white/20"></div>
                                <div className="text-sm font-medium">My Business</div>
                            </div>
                            <div className="p-3 flex flex-col gap-2 mt-auto">
                                <div className="self-end bg-[#d9fdd3] p-3 rounded-lg rounded-tr-none shadow-sm max-w-[90%]">
                                    {selectedFile && messageType === MessageType.IMAGE && (
                                        <div className="mb-2 rounded-lg overflow-hidden bg-gray-200 h-32 w-full flex items-center justify-center text-gray-400 relative">
                                            {/* In real app, use URL.createObjectURL(selectedFile) */}
                                            <ImageIcon size={24} />
                                            <span className="text-[10px] absolute bottom-1">Image Preview</span>
                                        </div>
                                    )}
                                    {selectedFile && messageType === MessageType.DOCUMENT && (
                                        <div className="mb-2 p-3 bg-white/50 rounded-lg flex items-center gap-3 border border-gray-200">
                                            <div className="p-2 bg-red-100 rounded text-red-600">
                                                <FileText size={20} />
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-xs font-medium truncate">{selectedFile.name}</p>
                                                <p className="text-[10px] text-gray-500">PDF • 1 Page</p>
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                                        {message || <span className="text-gray-400 italic">Isi pesan akan muncul di sini...</span>}
                                    </p>
                                    <p className="text-[10px] text-gray-500 text-right mt-1">14:30</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        {/* Connection Status */}
                        <div className={`flex items-center justify-center gap-2 text-sm py-2 px-3 rounded-lg ${waConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {waConnected ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                            {waConnected ? 'WhatsApp terhubung' : 'WhatsApp belum terhubung'}
                        </div>

                        {/* Error Message */}
                        {blastError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                                <XCircle size={16} />
                                {blastError}
                            </div>
                        )}

                        {!waConnected && waStatus === 'AUTHENTICATED' && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm flex items-center gap-2">
                                <Loader2 size={16} className="animate-spin" />
                                WhatsApp sudah login, tetapi sesi belum sepenuhnya siap untuk kirim pesan. Tunggu sebentar.
                            </div>
                        )}

                        {/* Progress Bar (when job is running) */}
                        {currentJob && (
                            <div className="bg-gray-50 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">
                                        {currentJob.status === 'running' ? 'Mengirim...' : 
                                         currentJob.status === 'paused' ? 'Dijeda' :
                                         currentJob.status === 'completed' ? 'Selesai!' : 'Gagal'}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        {currentJob.progress.sent + currentJob.progress.failed} / {currentJob.progress.total}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                    <div 
                                        className={`h-2 rounded-full transition-all ${currentJob.status === 'completed' ? 'bg-emerald-500' : currentJob.status === 'failed' ? 'bg-red-500' : 'bg-emerald-600'}`}
                                        style={{ width: `${((currentJob.progress.sent + currentJob.progress.failed) / currentJob.progress.total) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span className="text-emerald-600">{currentJob.progress.sent} terkirim</span>
                                    {currentJob.progress.failed > 0 && (
                                        <span className="text-red-600">{currentJob.progress.failed} gagal</span>
                                    )}
                                </div>
                                
                                {/* Control Buttons */}
                                <div className="flex flex-col sm:flex-row gap-2 mt-3">
                                    {currentJob.status === 'running' && (
                                        <button 
                                            onClick={handlePauseBlast}
                                            className="flex-1 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg font-medium flex items-center justify-center gap-2"
                                        >
                                            <Pause size={16} /> Jeda
                                        </button>
                                    )}
                                    {currentJob.status === 'paused' && (
                                        <button 
                                            onClick={handleResumeBlast}
                                            className="flex-1 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg font-medium flex items-center justify-center gap-2"
                                        >
                                            <Play size={16} /> Lanjutkan
                                        </button>
                                    )}
                                    {(currentJob.status === 'running' || currentJob.status === 'paused') && (
                                        <button 
                                            onClick={handleCancelBlast}
                                            className="flex-1 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium flex items-center justify-center gap-2"
                                        >
                                            <XCircle size={16} /> Batalkan
                                        </button>
                                    )}
                                    {(currentJob.status === 'completed' || currentJob.status === 'failed') && (
                                        <button 
                                            onClick={resetBlast}
                                            className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
                                        >
                                            Blast baru
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Send Button */}
                        {!currentJob && (
                            <>
                                <button 
                                    onClick={handleSendBlast}
                                    disabled={isSending || !waConnected || targetCount === 0}
                                    className="w-full bg-emerald-900 hover:bg-emerald-800 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                    {isSending ? 'Membuat job...' : `Kirim blast (${targetCount})`}
                                </button>
                                <p className="text-center text-xs text-gray-400">Estimasi selesai: {Math.ceil(targetCount * (defaultDelayMs / 1000) / 60)} menit dengan jeda {Math.round(defaultDelayMs / 1000)} detik per pesan.</p>
                            </>
                        )}
                    </div>
                 </div>
            </div>
        </div>

        {/* Audience Selection Modal */}
        {isAudienceModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div 
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
                    onClick={() => {
                        setIsAudienceModalOpen(false);
                        if (selectedGroupIds.size === 0 && selectedContactIds.size === 0) setAudienceType('all');
                    }}
                ></div>
                <div className="bg-white rounded-3xl w-full max-w-xl relative z-10 shadow-2xl flex flex-col max-h-[90vh] md:max-h-[85vh] animate-[scaleIn_0.2s_ease-out]">
                    {/* Modal Header - Fixed */}
                    <div className="p-5 md:p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-gray-900">Pilih Audiens</h3>
                            <p className="text-sm text-gray-500">Tentukan siapa yang menerima pesan ini.</p>
                        </div>
                        <button 
                            onClick={() => {
                                setIsAudienceModalOpen(false);
                                if (selectedGroupIds.size === 0 && selectedContactIds.size === 0) setAudienceType('all');
                            }}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
                        {/* Tabs */}
                        <div className="flex border-b border-gray-100 px-6 sticky top-0 bg-white z-10 pt-2">
                             <button 
                                onClick={() => setModalTab('groups')}
                                className={`pb-3 pt-2 px-4 font-medium text-sm border-b-2 transition-colors ${modalTab === 'groups' ? 'text-emerald-600 border-emerald-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
                             >
                                Grup ({groups.length}) {tempSelectedGroupIds.size > 0 && <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">{tempSelectedGroupIds.size}</span>}
                             </button>
                             <button 
                                onClick={() => setModalTab('contacts')}
                                className={`pb-3 pt-2 px-4 font-medium text-sm border-b-2 transition-colors ${modalTab === 'contacts' ? 'text-emerald-600 border-emerald-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
                             >
                                Kontak ({contacts.length}) {tempSelectedContactIds.size > 0 && <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">{tempSelectedContactIds.size}</span>}
                             </button>
                        </div>

                        {/* Search */}
                        <div className="p-4 bg-gray-50 sticky top-[45px] z-10 border-b border-gray-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder={modalTab === 'groups' ? "Cari grup..." : "Cari kontak..."}
                                    value={audienceSearchTerm}
                                    onChange={(e) => setAudienceSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Select All Row */}
                        <div className="px-6 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer select-none w-full hover:text-gray-900 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={isAllVisibleSelected}
                                    onChange={toggleAllInModal}
                                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                Pilih semua {modalTab === 'groups' ? 'grup' : 'kontak'}
                            </label>
                        </div>

                        {/* List Content */}
                        <div className="p-2">
                            {modalTab === 'groups' ? (
                                <>
                                    {filteredGroups.map(group => {
                                        const isSelected = tempSelectedGroupIds.has(group.id);
                                        return (
                                            <div 
                                                key={group.id}
                                                onClick={() => toggleSelection(group.id, 'group')}
                                                className={`flex items-center justify-between p-3 mb-1 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-gray-50 border border-transparent'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isSelected ? 'bg-emerald-200 text-emerald-800' : 'bg-indigo-100 text-indigo-500'}`}>
                                                        <Users size={18} />
                                                    </div>
                                                    <div>
                                                        <h4 className={`font-semibold ${isSelected ? 'text-emerald-900' : 'text-gray-800'}`}>{group.name}</h4>
                                                        <p className={`text-xs ${isSelected ? 'text-emerald-600' : 'text-gray-500'}`}>{group.contactIds.length} anggota</p>
                                                    </div>
                                                </div>
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 bg-white'}`}>
                                                    {isSelected && <Check size={14} className="text-white" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {filteredGroups.length === 0 && (
                                        <div className="text-center py-10 text-gray-400">
                                            <Users size={32} className="mx-auto mb-2 opacity-50" />
                                            {isLoadingData ? (
                                              <p>Memuat grup...</p>
                                            ) : groups.length === 0 ? (
                                              <p>Belum ada grup di database. Buat grup terlebih dahulu.</p>
                                            ) : (
                                              <p>Tidak ada grup yang cocok dengan pencarianmu.</p>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {filteredContacts.map(contact => {
                                        const isSelected = tempSelectedContactIds.has(contact.id);
                                        return (
                                            <div 
                                                key={contact.id}
                                                onClick={() => toggleSelection(contact.id, 'contact')}
                                                className={`flex items-center justify-between p-3 mb-1 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-gray-50 border border-transparent'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isSelected ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                                                        <User size={18} />
                                                    </div>
                                                    <div>
                                                        <h4 className={`font-semibold ${isSelected ? 'text-emerald-900' : 'text-gray-800'}`}>{contact.name}</h4>
                                                        <p className={`text-xs ${isSelected ? 'text-emerald-600' : 'text-gray-500'}`}>{contact.phone}</p>
                                                    </div>
                                                </div>
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 bg-white'}`}>
                                                    {isSelected && <Check size={14} className="text-white" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {filteredContacts.length === 0 && (
                                        <div className="text-center py-10 text-gray-400">
                                            <User size={32} className="mx-auto mb-2 opacity-50" />
                                            {isLoadingData ? (
                                              <p>Memuat kontak...</p>
                                            ) : contacts.length === 0 ? (
                                              <p>Belum ada kontak di database. Tambahkan kontak terlebih dahulu.</p>
                                            ) : (
                                              <p>Tidak ada kontak yang cocok dengan pencarianmu.</p>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Footer - Fixed */}
                    <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50 rounded-b-3xl shrink-0">
                        <div className="flex flex-col gap-4">
                            {/* Mobile Summary Row */}
                            <div className="flex items-center justify-between md:hidden text-sm">
                                <span className="text-gray-500">Dipilih:</span>
                                <span className="font-bold text-gray-900">{tempSelectedGroupIds.size} grup, {tempSelectedContactIds.size} kontak</span>
                            </div>

                            <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-3">
                                {/* Desktop Summary */}
                                <div className="hidden md:block text-sm text-gray-600">
                                    Dipilih: <span className="font-bold text-gray-900">{tempSelectedGroupIds.size} grup, {tempSelectedContactIds.size} kontak</span>
                                </div>
                                
                                {/* Buttons */}
                                <div className="flex gap-3 w-full md:w-auto">
                                     <button 
                                        onClick={() => {
                                            setIsAudienceModalOpen(false);
                                            if (selectedGroupIds.size === 0 && selectedContactIds.size === 0) setAudienceType('all');
                                        }}
                                        className="flex-1 md:flex-none px-5 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button 
                                        onClick={confirmAudienceSelection}
                                        className="flex-1 md:flex-none px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-colors"
                                    >
                                        Simpan pilihan
                                    </button>
                                </div>
                            </div>
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

export default BlastView;
