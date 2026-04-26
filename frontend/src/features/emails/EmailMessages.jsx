import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import socketService from '../../services/socket';
import ClientDetailsModal from '../customers/ClientDetailsModal';
import MediaViewer from '../../components/common/MediaViewer';
import { getImageUrl } from '../../utils/config';

const EmailMessages = () => {
    const [messages, setMessages] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('inbox');
    const [previousView, setPreviousView] = useState('inbox');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [attachments, setAttachments] = useState([]);
    const [sending, setSending] = useState(false);
    const [composeData, setComposeData] = useState({ to: '', subject: '', text: '' });
    const fileInputRef = useRef(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const accountFilter = searchParams.get('account');

    const [emailAccounts, setEmailAccounts] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState(null);
    const [selectedClientEmail, setSelectedClientEmail] = useState(null);

    // Gallery State
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryItems, setGalleryItems] = useState([]);
    const [galleryIndex, setGalleryIndex] = useState(0);

    const openGallery = (items, index) => {
        setGalleryItems(items);
        setGalleryIndex(index);
        setIsGalleryOpen(true);
    };

    useEffect(() => {
        fetchData();

        const handleNewEmail = () => {
            console.log('New email received, refreshing messages...');
            fetchData();
        };

        socketService.on('new_email', handleNewEmail);
        return () => socketService.off('new_email', handleNewEmail);
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [msgRes, accRes] = await Promise.all([
                api.get('/emails/messages'),
                api.get('/emails')
            ]);
            setMessages(msgRes.data.data.messages);
            setAccounts(accRes.data.data.accounts);
        } catch (err) {
            console.error('Error fetching emails:', err);
            toast.error('Fehler beim Laden der Nachrichten.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        setAttachments(prev => [...prev, ...files]);
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSend = async (e) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData();
        
        formData.append('from', form.from.value);
        formData.append('to', form.to.value);
        formData.append('subject', form.subject.value);
        formData.append('text', form.text.value);
        
        attachments.forEach(file => {
            formData.append('attachments', file);
        });

        try {
            setSending(true);
            await api.post('/emails/send', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            toast.success('E-Mail erfolgreich gesendet!');
            setView('inbox');
            setAttachments([]);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Fehler beim Senden');
        } finally {
            setSending(false);
        }
    };

    const handleRead = async (msg) => {
        setPreviousView(view);
        setSelectedMessage(msg);
        setView('read');
        if (!msg.is_read) {
            try {
                await api.patch(`/emails/messages/${msg.id}/read`);
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
            } catch (err) {
                console.error('Error marking as read:', err);
            }
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('E-Mail wirklich löschen?')) return;
        try {
            await api.delete(`/emails/messages/${id}`);
            setMessages(prev => prev.filter(m => m.id !== id));
            if (selectedMessage?.id === id) setView('inbox');
            toast.success('E-Mail gelöscht.');
        } catch (err) {
            toast.error('Fehler beim Löschen.');
        }
    };

    const handleReply = (msg) => {
        // Find if we have a draft or just switch to compose with preset values
        // For simplicity, we'll just set the view and potentially pre-fill
        // We'd need state for the compose form for this
        setComposeData({
            to: msg.sender,
            subject: `Re: ${msg.subject}`,
            text: `\n\n--- Am ${new Date(msg.received_at).toLocaleString()} schrieb ${msg.sender} ---\n\n${msg.body_plain}`
        });
        setView('compose');
    };

    const filteredMessages = messages.filter(msg => {
        // 1. Tab match (Inbox vs Sent)
        const matchesTab = view === 'inbox' ? (msg.direction === 'inbound' || !msg.direction) : 
                           view === 'sent' ? (msg.direction === 'outbound') : true;
        
        if (!matchesTab) return false;

        // 2. Account filter match
        if (accountFilter) {
            const query = accountFilter.toLowerCase();
            const matchesAccount = (msg.sender?.toLowerCase().includes(query) || msg.recipient?.toLowerCase().includes(query));
            if (!matchesAccount) return false;
        }

        // 3. Search query match
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                msg.sender?.toLowerCase().includes(query) ||
                msg.recipient?.toLowerCase().includes(query) ||
                msg.subject?.toLowerCase().includes(query) ||
                msg.body_plain?.toLowerCase().includes(query)
            );
        }
        return true;
    });

    const renderInbox = () => (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 px-2">
                <div className="flex-1 w-full sm:max-w-md relative">
                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                    <input 
                        type="text"
                        placeholder={accountFilter ? `Suchen in ${accountFilter}...` : "Suchen nach Name, Email oder Betreff..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl glass-input text-sm"
                    />
                </div>
                <div className="flex items-center gap-4 shrink-0 self-end sm:self-auto">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        {filteredMessages.length} Nachrichten
                    </p>
                    <button 
                        onClick={fetchData} 
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5"
                    >
                        <i className={`fa-solid fa-arrows-rotate ${loading ? 'animate-spin' : ''}`}></i>
                    </button>
                </div>
            </div>
            {loading ? (
                <div className="text-center py-20 opacity-50"><i className="fa-solid fa-circle-notch animate-spin text-2xl mb-4"></i><p>Lade Nachrichten...</p></div>
            ) : filteredMessages.length === 0 ? (
                <div className="text-center py-20 text-gray-500 italic">Keine Nachrichten gefunden.</div>
            ) : filteredMessages.map(msg => (
                <div 
                    key={msg.id} 
                    onClick={() => handleRead(msg)}
                    className={`glass-card p-4 rounded-2xl border transition-all cursor-pointer group flex items-center gap-4 ${msg.is_read ? 'bg-white/5 border-white/10 opacity-70' : 'bg-blue-500/10 border-blue-500/30'}`}
                >
                    <div className="relative">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${msg.is_read ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-blue-500/20 border-blue-400/30 text-blue-400 font-bold'}`}>
                            <i className={`fa-solid ${msg.is_read ? 'fa-envelope-open' : 'fa-envelope'} text-lg`}></i>
                        </div>
                        {!msg.is_read && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#121212] animate-pulse"></span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                            <h4 className={`font-bold truncate ${msg.is_read ? 'text-gray-300' : 'text-white'}`}>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedClientId(msg.client_id);
                                        setSelectedClientEmail(msg.direction === 'outbound' ? (msg.recipient_email || msg.recipient) : (msg.sender_email || msg.sender));
                                    }}
                                    className="hover:text-blue-400 border-b border-white/10 hover:border-blue-400 transition-all"
                                >
                                    {msg.direction === 'outbound' 
                                        ? `An: ${msg.recipient_name || msg.recipient_email || msg.recipient}` 
                                        : (msg.sender_name || msg.sender_email || msg.sender)}
                                </button>
                            </h4>
                            <span className="text-[10px] text-gray-500 shrink-0 uppercase tracking-widest">{new Date(msg.received_at).toLocaleDateString()}</span>
                        </div>
                        <p className={`text-sm truncate mb-1 ${msg.is_read ? 'text-gray-500' : 'text-gray-200 font-bold'}`}>{msg.subject}</p>
                        <p className="text-xs text-gray-500 truncate">{msg.body_plain?.substring(0, 100)}...</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-white/10 text-gray-400 uppercase tracking-tighter">
                            {msg.direction === 'outbound' ? 'Gesendet' : 'Posteingang'}
                        </span>
                        <i className="fa-solid fa-chevron-right text-gray-600 group-hover:text-blue-400 transition-colors"></i>
                    </div>
                </div>
            ))}
        </div>
    );

    const renderRead = () => (
        <div className="glass-card rounded-2xl border border-white/10 bg-white/5 overflow-hidden animate-[fadeIn_0.3s_ease-out]">
            <div className="p-4 md:p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <button onClick={() => { setView(previousView); setSelectedMessage(null); }} className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                    <i className="fa-solid fa-arrow-left"></i> Zurück
                </button>
                <div className="flex gap-2">
                    <button onClick={() => handleDelete(selectedMessage.id)} className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-red-400 transition-colors" title="Löschen"><i className="fa-solid fa-trash-can"></i></button>
                    <button onClick={() => handleReply(selectedMessage)} className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-blue-400 transition-colors" title="Antworten"><i className="fa-solid fa-reply"></i></button>
                </div>
            </div>
            <div className="p-3 sm:p-5 md:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 md:mb-8">
                    <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 text-lg md:text-xl font-bold">
                        {selectedMessage.sender[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 w-full">
                        <h3 className="text-lg md:text-xl font-bold text-white mb-1 break-words">{selectedMessage.subject}</h3>
                        <p className="text-xs md:text-sm text-gray-400 flex flex-wrap gap-x-2 gap-y-1">
                            <span>Von: <span 
                                    onClick={() => {
                                        setSelectedClientId(selectedMessage.client_id);
                                        setSelectedClientEmail(selectedMessage.sender_email || selectedMessage.sender);
                                    }}
                                    className="text-blue-400 cursor-pointer hover:underline break-all"
                                 >
                                    {selectedMessage.sender_name || selectedMessage.sender_email || selectedMessage.sender}
                                 </span></span>
                            {selectedMessage.recipient && (
                                <span>• An: <span 
                                    onClick={() => {
                                        setSelectedClientId(selectedMessage.client_id);
                                        setSelectedClientEmail(selectedMessage.recipient_email || selectedMessage.recipient);
                                    }}
                                    className="text-blue-400 cursor-pointer hover:underline break-all"
                                >
                                    {selectedMessage.recipient_name || selectedMessage.recipient_email || selectedMessage.recipient}
                                </span></span>
                            )}
                            <span className="shrink-0 block mt-1 w-full sm:w-auto sm:mt-0 sm:inline">• {new Date(selectedMessage.received_at).toLocaleString()}</span>
                        </p>
                    </div>
                </div>
                {selectedMessage.body_html ? (
                    <div className="w-full mt-4 md:mt-8 mb-6 md:mb-8 rounded-xl overflow-x-auto overflow-y-hidden bg-white p-2 sm:p-4 md:p-6 border border-gray-200">
                        <div 
                            key={selectedMessage.id}
                            className="email-html-content text-black max-w-full"
                            style={{ 
                                color: '#000', 
                                backgroundColor: '#fff',
                                fontFamily: 'sans-serif'
                            }}
                            dangerouslySetInnerHTML={{ __html: selectedMessage.body_html }} 
                        />
                    </div>
                ) : (
                    <div className="text-gray-300 space-y-4 leading-relaxed whitespace-pre-wrap border-t border-white/10 pt-8 mb-8">
                        {selectedMessage.body_plain || 'Kein Textinhalt verfügbar.'}
                    </div>
                )}

                {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                    <div className="border-t border-white/10 pt-6">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Anhänge ({selectedMessage.attachments.length})</h4>
                        <div className="flex flex-wrap gap-3">
                            {selectedMessage.attachments.map((file, i) => {
                                const isMedia = file.content_type?.startsWith('image/') || 
                                               file.content_type?.startsWith('video/') ||
                                               file.file_name?.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm|mov)$/i);
                                
                                return (
                                    <div 
                                        key={i} 
                                        onClick={() => isMedia ? openGallery(selectedMessage.attachments, i) : window.open(getImageUrl(file.file_url), '_blank')}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/50 transition-colors cursor-pointer group"
                                    >
                                        <i className={`fa-solid ${file.content_type?.startsWith('image/') ? 'fa-image' : file.content_type?.startsWith('video/') ? 'fa-video' : 'fa-file-lines'} text-blue-400`}></i>
                                        <div>
                                            <p className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">{file.file_name}</p>
                                            <p className="text-[10px] text-gray-500">
                                                {file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : '0.0 KB'}
                                            </p>
                                        </div>
                                        <i className="fa-solid fa-download text-gray-600 hover:text-white transition-colors ml-2"></i>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderCompose = () => (
        <div className="glass-card rounded-2xl border border-white/10 bg-white/5 overflow-hidden animate-[fadeIn_0.3s_ease-out]">
            <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <h3 className="font-bold">Neue Nachricht verfassen</h3>
                <button onClick={() => setView('inbox')} className="text-gray-400 hover:text-white transition-colors"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <form onSubmit={handleSend} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm text-gray-400 mb-2 font-semibold">Von</label>
                        <select 
                            name="from"
                            defaultValue={accountFilter || accounts[0]?.email}
                            className="w-full glass-input rounded-xl px-4 py-3 text-white font-semibold"
                        >
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.email} className="bg-gray-900">
                                    {acc.display_name ? `${acc.display_name} <${acc.email}>` : acc.email}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Empfänger</label>
                        <input 
                            name="to" 
                            type="email" 
                            required 
                            className="w-full glass-input rounded-xl px-4 py-3 text-white" 
                            placeholder="kunde@beispiel.de" 
                            value={composeData.to}
                            onChange={(e) => setComposeData({...composeData, to: e.target.value})}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Betreff</label>
                    <input 
                        name="subject" 
                        type="text" 
                        required 
                        className="w-full glass-input rounded-xl px-4 py-3 text-white" 
                        placeholder="Thema Ihrer Nachricht" 
                        value={composeData.subject}
                        onChange={(e) => setComposeData({...composeData, subject: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Inhalt</label>
                    <textarea 
                        name="text" 
                        required 
                        className="w-full glass-input rounded-xl px-4 py-4 text-white min-h-[200px]" 
                        placeholder="Schreiben Sie Ihre Nachricht hier..."
                        value={composeData.text}
                        onChange={(e) => setComposeData({...composeData, text: e.target.value})}
                    ></textarea>
                </div>

                {/* Attachments Section */}
                <div className="border-t border-white/10 pt-6">
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Anhänge ({attachments.length})</label>
                        <button 
                            type="button"
                            onClick={() => fileInputRef.current.click()}
                            className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2"
                        >
                            <i className="fa-solid fa-paperclip"></i> Datei hinzufügen
                        </button>
                    </div>
                    
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        multiple 
                        className="hidden" 
                    />

                    {attachments.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {attachments.map((file, i) => (
                                <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10 group">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <i className="fa-solid fa-file text-gray-500"></i>
                                        <span className="text-xs text-gray-300 truncate">{file.name}</span>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => removeAttachment(i)}
                                        className="text-gray-600 hover:text-red-400 transition-colors"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={() => { setView('inbox'); setAttachments([]); }} className="px-6 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-bold transition-colors">Abbrechen</button>
                    <button 
                        type="submit" 
                        disabled={sending}
                        className={`px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 ${sending ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {sending ? (
                            <><i className="fa-solid fa-circle-notch animate-spin"></i> Sendet...</>
                        ) : (
                            <><i className="fa-solid fa-paper-plane"></i> Senden</>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );

    const renderHeader = () => {
        const currentAccount = accounts.find(acc => acc.email === accountFilter);
        return (
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 md:mb-10 p-2 md:p-0">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-white mb-2 tracking-tight flex flex-wrap items-baseline gap-2">
                        Nachrichten Zentrale
                        {currentAccount && (
                             <span className="text-blue-500 text-lg md:text-xl font-medium border-l border-white/20 pl-4 animate-[fadeIn_0.3s_ease-out]">
                                {currentAccount.display_name || currentAccount.email}
                             </span>
                        )}
                    </h1>
                    <p className="text-gray-500 max-w-lg text-sm md:text-base">Verwalten Sie Ihre Kommunikation über Ihre Domain-E-Mails.</p>
                </div>
                <button onClick={() => setView('compose')} className="w-full md:w-auto px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 group shrink-0">
                    <i className="fa-solid fa-paper-plane group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"></i> Verfassen
                </button>
            </div>
        );
    };

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards] p-2 sm:p-4 md:p-6 max-w-6xl mx-auto">
            {renderHeader()}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar Navigation */}
                <div className={`lg:col-span-3 space-y-2 ${((view === 'read' && selectedMessage) || view === 'compose') ? 'hidden lg:block' : ''}`}>
                    {[
                        { id: 'inbox', label: 'Posteingang', icon: 'fa-inbox', count: true },
                        { id: 'sent', label: 'Gesendet', icon: 'fa-paper-plane' }
                    ].map(item => {
                        const count = messages.filter(m => 
                            (item.id === 'inbox' ? (m.direction === 'inbound' || !m.direction) : (m.direction === 'outbound')) && 
                            !m.is_read && 
                            (!accountFilter || (item.id === 'inbox' ? m.recipient_email : m.sender_email) === accountFilter)
                        ).length;

                        return (
                            <button
                                key={item.id}
                                onClick={() => { setView(item.id); setSelectedMessage(null); }}
                                className={`w-full px-4 py-3 rounded-2xl flex items-center justify-between transition-all group ${view === item.id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <i className={`fa-solid ${item.icon} text-sm`}></i>
                                    <span className="text-sm font-bold tracking-tight">{item.label}</span>
                                </div>
                                {item.count && count > 0 && (
                                    <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold ${view === item.id ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-500'}`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="lg:col-span-9">
                    {view === 'read' && selectedMessage ? renderRead() :
                     view === 'compose' ? renderCompose() :
                     renderInbox()}
                </div>
            </div>

            {/* Client Details Modal */}
            {selectedClientId || selectedClientEmail ? (
                <ClientDetailsModal
                    clientId={selectedClientId}
                    email={selectedClientEmail}
                    onClose={() => {
                        setSelectedClientId(null);
                        setSelectedClientEmail(null);
                    }}
                />
            ) : null}

            <style dangerouslySetInnerHTML={{ __html: `
                .glass-card { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(10px); }
                .glass-input { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); outline: none; transition: all 0.3s ease; }
                .glass-input:focus { border-color: rgba(59, 130, 246, 0.5); background: rgba(255, 255, 255, 0.08); box-shadow: 0 0 15px rgba(59, 130, 246, 0.1); }
                
                /* Standardize email links to look like Gmail */
                .email-html-content a { color: #2563eb !important; text-decoration: underline !important; cursor: pointer !important; }
                .email-html-content a:hover { color: #1d4ed8 !important; text-decoration: none !important; }
            `}} />
            {/* Media Gallery Viewer */}
            <MediaViewer 
                isOpen={isGalleryOpen}
                onClose={() => setIsGalleryOpen(false)}
                items={galleryItems}
                initialIndex={galleryIndex}
            />
        </div>
    );
};

export default EmailMessages;
