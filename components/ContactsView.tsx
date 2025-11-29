import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Contact, Group } from '../types';
import { Search, Plus, Filter, MoreVertical, Trash2, Upload, Users, FolderOpen, Check, X, Tag, UserPlus, AlertTriangle, RefreshCw, Loader2, Smartphone, Database, FileText } from 'lucide-react';
import { contactsApi, whatsappApi } from '../services/api';

const ContactsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'contacts' | 'groups'>('contacts');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [waConnected, setWaConnected] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  
  // Modal states
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showImportCSVModal, setShowImportCSVModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form states
  const [newContact, setNewContact] = useState({ name: '', phone: '', tags: '', groupId: '' });
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  const [csvData, setCsvData] = useState<Array<{ name: string; phone: string; tags: string[] }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load contacts and groups from database
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [contactsRes, groupsRes] = await Promise.all([
        contactsApi.getAll(),
        contactsApi.getGroups()
      ]);
      
      if (contactsRes.success) {
        setContacts(contactsRes.contacts);
      }
      if (groupsRes.success) {
        setGroups(groupsRes.groups);
      }
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setSyncMessage(`Failed to load data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check WhatsApp connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const status = await whatsappApi.getStatus();
        setWaConnected(status.status === 'READY');
      } catch {
        setWaConnected(false);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  // Sync contacts from WhatsApp to database
  const handleSyncContacts = async () => {
    if (!waConnected) {
      setSyncMessage('WhatsApp not connected');
      return;
    }

    setIsSyncing(true);
    setSyncMessage(null);

    try {
      // Get contacts from WhatsApp
      const waResult = await contactsApi.getFromWhatsApp();
      if (waResult.success && waResult.contacts) {
        const waContacts = waResult.contacts
          .filter(c => !c.isGroup && c.phone)
          .map(c => ({
            name: c.name || c.pushname || c.phone,
            phone: c.phone.startsWith('+') ? c.phone : `+${c.phone}`,
            tags: ['WhatsApp']
          }));
        
        if (waContacts.length > 0) {
          // Import to database
          const importResult = await contactsApi.importMany(waContacts);
          if (importResult.success) {
            setSyncMessage(`Imported ${importResult.imported} contacts from WhatsApp`);
            // Reload contacts from database
            await loadData();
          }
        } else {
          setSyncMessage('No contacts found in WhatsApp');
        }
      }
    } catch (err: any) {
      setSyncMessage(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };
  const [searchTerm, setSearchTerm] = useState('');
  
  // Bulk Action State
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Filter logic based on active tab
  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset selection when switching tabs
  useEffect(() => {
    setSelectedItems(new Set());
  }, [activeTab]);

  // Selection Handlers
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItems(newSet);
  };

  const toggleAll = () => {
    const currentItems = activeTab === 'contacts' ? filteredContacts : filteredGroups;
    if (selectedItems.size === currentItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(currentItems.map(item => item.id)));
    }
  };

  // Bulk Actions
  const handleBulkDelete = async () => {
    const ids: string[] = Array.from(selectedItems);
    try {
      if (activeTab === 'contacts') {
        await contactsApi.deleteMany(ids);
        setContacts(prev => prev.filter(c => !selectedItems.has(c.id)));
      } else {
        // Delete groups one by one (no bulk delete endpoint for groups)
        await Promise.all(ids.map((id: string) => contactsApi.deleteGroup(id)));
        setGroups(prev => prev.filter(g => !selectedItems.has(g.id)));
      }
      setSyncMessage(`Deleted ${ids.length} items`);
    } catch (err: any) {
      setSyncMessage(`Delete failed: ${err.message}`);
    }
    setSelectedItems(new Set());
    setShowDeleteModal(false);
    setTimeout(() => setSyncMessage(null), 3000);
  };

  const handleBulkTag = () => {
      if (activeTab !== 'contacts') return;
      const newTag = "Bulk Tag";
      setContacts(prev => prev.map(c => {
          if (selectedItems.has(c.id) && !c.tags.includes(newTag)) {
              return { ...c, tags: [...c.tags, newTag] };
          }
          return c;
      }));
      setSelectedItems(new Set());
      alert(`Added "${newTag}" to ${selectedItems.size} contacts.`);
  };

  const handleBulkAddToGroup = () => {
      if (activeTab !== 'contacts') return;
      // Simulating adding to first group
      const targetGroup = groups[0];
      if (!targetGroup) return;
      
      setGroups(prev => prev.map(g => {
          if (g.id === targetGroup.id) {
              const newIds = Array.from(selectedItems).filter(id => !g.contactIds.includes(id));
              return { ...g, contactIds: [...g.contactIds, ...newIds] };
          }
          return g;
      }));
      setSelectedItems(new Set());
      alert(`Added contacts to group "${targetGroup.name}".`);
  };

  // Add Contact Handler
  const handleAddContact = async () => {
    if (!newContact.name || !newContact.phone) {
      setSyncMessage('Name and phone are required');
      setTimeout(() => setSyncMessage(null), 3000);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const tags = newContact.tags ? newContact.tags.split(',').map(t => t.trim()).filter(t => t) : [];
      const result = await contactsApi.create({
        name: newContact.name,
        phone: newContact.phone.startsWith('+') ? newContact.phone : `+${newContact.phone}`,
        tags
      });
      
      if (result.success && result.contact) {
        // If a group is selected, add the contact to that group
        if (newContact.groupId) {
          await contactsApi.addContactsToGroup(newContact.groupId, [result.contact.id]);
        }
        
        setSyncMessage('Contact added successfully');
        setNewContact({ name: '', phone: '', tags: '', groupId: '' });
        setShowAddContactModal(false);
        await loadData();
      }
    } catch (err: any) {
      setSyncMessage(`Failed to add contact: ${err.message}`);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  // CSV Import Handler
  const handleCSVFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header row if exists
      const startIdx = lines[0]?.toLowerCase().includes('name') ? 1 : 0;
      
      const parsedData = lines.slice(startIdx).map(line => {
        const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
        return {
          name: parts[0] || '',
          phone: parts[1] || '',
          tags: parts[2] ? parts[2].split(';').map(t => t.trim()) : []
        };
      }).filter(c => c.name && c.phone);
      
      setCsvData(parsedData);
    };
    reader.readAsText(file);
  };

  const handleImportCSV = async () => {
    if (csvData.length === 0) {
      setSyncMessage('No valid data to import');
      setTimeout(() => setSyncMessage(null), 3000);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const contactsToImport = csvData.map(c => ({
        name: c.name,
        phone: c.phone.startsWith('+') ? c.phone : `+${c.phone}`,
        tags: c.tags
      }));
      
      const result = await contactsApi.importMany(contactsToImport);
      if (result.success) {
        setSyncMessage(`Imported ${result.imported} contacts`);
        setCsvData([]);
        setShowImportCSVModal(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await loadData();
      }
    } catch (err: any) {
      setSyncMessage(`Import failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  // Create Group Handler
  const handleCreateGroup = async () => {
    if (!newGroup.name) {
      setSyncMessage('Group name is required');
      setTimeout(() => setSyncMessage(null), 3000);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const result = await contactsApi.createGroup({
        name: newGroup.name,
        description: newGroup.description
      });
      
      if (result.success) {
        setSyncMessage('Group created successfully');
        setNewGroup({ name: '', description: '' });
        setShowCreateGroupModal(false);
        await loadData();
      }
    } catch (err: any) {
      setSyncMessage(`Failed to create group: ${err.message}`);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const isAllSelected = activeTab === 'contacts' 
    ? filteredContacts.length > 0 && selectedItems.size === filteredContacts.length
    : filteredGroups.length > 0 && selectedItems.size === filteredGroups.length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full flex flex-col relative">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">Manage your audience and groups.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
            {activeTab === 'contacts' ? (
                <>
                    <button 
                        onClick={handleSyncContacts}
                        disabled={isSyncing || !waConnected}
                        className={`flex-1 md:flex-none justify-center border px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors ${
                            waConnected 
                                ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50' 
                                : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                        title={waConnected ? 'Sync contacts from WhatsApp' : 'Connect WhatsApp first'}
                    >
                        {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                        {isSyncing ? 'Syncing...' : 'Sync WA'}
                    </button>
                    <button 
                        onClick={() => setShowImportCSVModal(true)}
                        className="flex-1 md:flex-none justify-center bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors">
                        <Upload size={18} />
                        Import CSV
                    </button>
                    <button 
                        onClick={() => setShowAddContactModal(true)}
                        className="flex-1 md:flex-none justify-center bg-emerald-900 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 hover:bg-emerald-800 shadow-lg shadow-emerald-900/20 transition-colors">
                        <Plus size={18} />
                        Add Contact
                    </button>
                </>
            ) : (
                <button 
                    onClick={() => setShowCreateGroupModal(true)}
                    className="flex-1 md:flex-none justify-center bg-emerald-900 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 hover:bg-emerald-800 shadow-lg shadow-emerald-900/20 transition-colors">
                    <Plus size={18} />
                    Create Group
                </button>
            )}
        </div>
      </div>

      {/* Sync Message */}
      {syncMessage && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
          syncMessage.includes('failed') || syncMessage.includes('not connected')
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {syncMessage.includes('failed') || syncMessage.includes('not connected') 
            ? <AlertTriangle size={16} /> 
            : <Check size={16} />
          }
          {syncMessage}
        </div>
      )}

      {/* Main Content Card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex-1 flex flex-col overflow-hidden relative z-0">
         
         {/* Tabs & Toolbar */}
         <div className="border-b border-gray-100">
             {/* Tabs */}
             <div className="flex items-center gap-8 px-6 pt-6">
                 <button 
                    onClick={() => setActiveTab('contacts')}
                    className={`pb-4 font-medium text-sm md:text-base border-b-2 transition-colors ${activeTab === 'contacts' ? 'text-emerald-600 border-emerald-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
                 >
                    All Contacts ({contacts.length})
                 </button>
                 <button 
                    onClick={() => setActiveTab('groups')}
                    className={`pb-4 font-medium text-sm md:text-base border-b-2 transition-colors ${activeTab === 'groups' ? 'text-emerald-600 border-emerald-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
                 >
                    Groups ({groups.length})
                 </button>
             </div>

             {/* Search Bar */}
             <div className="p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 bg-gray-50/50">
                 <div className="relative w-full md:w-96">
                     <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                     <input 
                        type="text" 
                        placeholder={activeTab === 'contacts' ? "Search by name or phone..." : "Search group name..."}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                     />
                 </div>
                 <div className="flex items-center gap-2 w-full md:w-auto">
                     <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
                         <Filter size={18} />
                         <span>Filter</span>
                     </button>
                 </div>
             </div>
         </div>

         {/* List Content */}
         <div className="flex-1 overflow-y-auto p-2 pb-24"> {/* Added pb-24 for bottom bar space */}
             {activeTab === 'contacts' ? (
                 <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                        <thead className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 text-left font-semibold rounded-l-xl w-16">
                                    <div className="flex items-center">
                                        <input 
                                            type="checkbox" 
                                            checked={isAllSelected}
                                            onChange={toggleAll}
                                            className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        />
                                    </div>
                                </th>
                                <th className="px-2 py-4 text-left font-semibold">Name</th>
                                <th className="px-6 py-4 text-left font-semibold">Phone</th>
                                <th className="px-6 py-4 text-left font-semibold">Tags</th>
                                <th className="px-6 py-4 text-right font-semibold rounded-r-xl">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredContacts.map((contact) => {
                                const isSelected = selectedItems.has(contact.id);
                                return (
                                    <tr key={contact.id} className={`transition-colors group ${isSelected ? 'bg-emerald-50/50' : 'hover:bg-gray-50/80'}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected}
                                                    onChange={() => toggleSelection(contact.id)}
                                                    className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-2 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                                                    {contact.name.charAt(0)}
                                                </div>
                                                <span className="font-medium text-gray-900">{contact.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 font-mono text-sm">
                                            {contact.phone}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                {contact.tags.map(tag => (
                                                    <span key={tag} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                                                        tag === 'VIP' ? 'bg-purple-100 text-purple-700' :
                                                        tag === 'Lead' ? 'bg-blue-100 text-blue-700' :
                                                        tag === 'Inactive' ? 'bg-gray-100 text-gray-500' :
                                                        'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                                    <MoreVertical size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filteredContacts.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <Users size={32} />
                            </div>
                            <p>No contacts found.</p>
                        </div>
                    )}
                 </div>
             ) : (
                 // Groups View
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    {/* Select All for Groups (Optional helper) */}
                    {filteredGroups.length > 0 && (
                         <div className="col-span-full flex items-center gap-2 mb-2 px-1">
                            <input 
                                type="checkbox" 
                                id="selectAllGroups"
                                checked={isAllSelected}
                                onChange={toggleAll}
                                className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <label htmlFor="selectAllGroups" className="text-sm font-medium text-gray-600 cursor-pointer">Select All Groups</label>
                         </div>
                    )}

                    {filteredGroups.map((group) => {
                         const isSelected = selectedItems.has(group.id);
                         return (
                            <div 
                                key={group.id} 
                                onClick={(e) => {
                                    // Prevent triggering if clicking buttons inside
                                    if ((e.target as HTMLElement).closest('button')) return;
                                    toggleSelection(group.id);
                                }}
                                className={`relative border rounded-2xl p-5 transition-all cursor-pointer flex flex-col group ${
                                    isSelected ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/30' : 'border-gray-200 hover:shadow-md bg-white'
                                }`}
                            >
                                <div className="absolute top-5 left-5">
                                     <input 
                                        type="checkbox" 
                                        checked={isSelected}
                                        onChange={() => toggleSelection(group.id)}
                                        className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                </div>
                                <div className="flex justify-end items-start mb-4 h-8">
                                    <button className="p-2 text-gray-300 hover:text-gray-600 rounded-lg transition-colors">
                                        <MoreVertical size={18} />
                                    </button>
                                </div>
                                
                                <div className="pl-8"> {/* Indent content slightly for checkbox visual balance if needed, but mostly fine */}
                                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-3">
                                        <FolderOpen size={24} />
                                    </div>
                                    <h3 className="font-bold text-gray-800 text-lg mb-1">{group.name}</h3>
                                    <p className="text-gray-500 text-sm mb-6">{group.contactIds.length} Members</p>
                                </div>
                                
                                <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100">
                                    <div className="flex -space-x-2 overflow-hidden">
                                        {group.contactIds.slice(0, 3).map((id, i) => (
                                            <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                                                U{i+1}
                                            </div>
                                        ))}
                                    </div>
                                    <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline">
                                        View Details
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    
                    {filteredGroups.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center h-64 text-gray-400">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <FolderOpen size={32} />
                            </div>
                            <p>No groups found.</p>
                        </div>
                    )}
                 </div>
             )}
         </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedItems.size > 0 && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-20 animate-[slideUp_0.2s_ease-out]">
            <div className="flex items-center gap-3 border-r border-gray-700 pr-6">
                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-xs font-bold">
                    {selectedItems.size}
                </div>
                <span className="font-medium text-sm">Selected</span>
            </div>
            
            <div className="flex items-center gap-2">
                {activeTab === 'contacts' && (
                    <>
                        <button 
                            onClick={handleBulkAddToGroup}
                            className="p-2 hover:bg-gray-800 rounded-xl transition-colors text-gray-300 hover:text-white flex flex-col items-center gap-1"
                            title="Add to Group"
                        >
                            <UserPlus size={20} />
                        </button>
                        <button 
                            onClick={handleBulkTag}
                            className="p-2 hover:bg-gray-800 rounded-xl transition-colors text-gray-300 hover:text-white flex flex-col items-center gap-1"
                            title="Assign Tag"
                        >
                            <Tag size={20} />
                        </button>
                        <div className="w-px h-6 bg-gray-700 mx-2"></div>
                    </>
                )}
                <button 
                    onClick={() => setShowDeleteModal(true)}
                    className="p-2 hover:bg-red-900/50 rounded-xl transition-colors text-red-400 hover:text-red-300 flex flex-col items-center gap-1"
                    title="Delete"
                >
                    <Trash2 size={20} />
                </button>
            </div>

            <button 
                onClick={() => setSelectedItems(new Set())}
                className="ml-2 p-1 hover:bg-gray-800 rounded-full text-gray-500 hover:text-white transition-colors"
            >
                <X size={16} />
            </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}></div>
            <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md relative z-10 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Delete {selectedItems.size} Items?</h3>
                <p className="text-center text-gray-500 mb-8">
                    Are you sure you want to delete the selected {activeTab === 'contacts' ? 'contacts' : 'groups'}? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowDeleteModal(false)}
                        className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleBulkDelete}
                        className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddContactModal(false)}></div>
            <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md relative z-10 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Add New Contact</h3>
                    <button onClick={() => setShowAddContactModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                        <input
                            type="text"
                            value={newContact.name}
                            onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="Contact name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                        <input
                            type="text"
                            value={newContact.phone}
                            onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="+6281234567890"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                        <input
                            type="text"
                            value={newContact.tags}
                            onChange={(e) => setNewContact(prev => ({ ...prev, tags: e.target.value }))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="VIP, Customer"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Add to Group</label>
                        <select
                            value={newContact.groupId}
                            onChange={(e) => setNewContact(prev => ({ ...prev, groupId: e.target.value }))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                        >
                            <option value="">-- No Group --</option>
                            {groups.map(group => (
                                <option key={group.id} value={group.id}>
                                    {group.name} ({group.contactIds.length} members)
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button 
                        onClick={() => setShowAddContactModal(false)}
                        className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleAddContact}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                        Add Contact
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportCSVModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowImportCSVModal(false)}></div>
            <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg relative z-10 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Import Contacts from CSV</h3>
                    <button onClick={() => { setShowImportCSVModal(false); setCsvData([]); }} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleCSVFileSelect}
                            className="hidden"
                            id="csv-upload"
                        />
                        <label htmlFor="csv-upload" className="cursor-pointer">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                                <FileText size={24} />
                            </div>
                            <p className="text-gray-700 font-medium">Click to upload CSV file</p>
                            <p className="text-gray-400 text-sm mt-1">Format: name, phone, tags (semicolon separated)</p>
                        </label>
                    </div>

                    {csvData.length > 0 && (
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="font-medium text-gray-700 mb-2">Preview ({csvData.length} contacts)</p>
                            <div className="max-h-48 overflow-y-auto space-y-2">
                                {csvData.slice(0, 5).map((c, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm bg-white p-2 rounded-lg">
                                        <span className="font-medium">{c.name}</span>
                                        <span className="text-gray-500">{c.phone}</span>
                                    </div>
                                ))}
                                {csvData.length > 5 && (
                                    <p className="text-gray-400 text-sm text-center">...and {csvData.length - 5} more</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 mt-6">
                    <button 
                        onClick={() => { setShowImportCSVModal(false); setCsvData([]); }}
                        className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleImportCSV}
                        disabled={isSubmitting || csvData.length === 0}
                        className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                        Import {csvData.length > 0 ? `(${csvData.length})` : ''}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateGroupModal(false)}></div>
            <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md relative z-10 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Create New Group</h3>
                    <button onClick={() => setShowCreateGroupModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Group Name *</label>
                        <input
                            type="text"
                            value={newGroup.name}
                            onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="Enter group name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            value={newGroup.description}
                            onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                            rows={3}
                            placeholder="Group description (optional)"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button 
                        onClick={() => setShowCreateGroupModal(false)}
                        className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleCreateGroup}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                        Create Group
                    </button>
                </div>
            </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
            from { transform: translate(-50%, 100%); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes scaleIn {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ContactsView;