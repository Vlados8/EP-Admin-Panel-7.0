import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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
    const [composeData, setComposeData] = useState({ to: '', subject: '', text: '', html: '' });
    const fileInputRef = useRef(null);
    const editorRef = useRef(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const accountFilter = searchParams.get('account');

    const [emailAccounts, setEmailAccounts] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState(null);
    const [selectedClientEmail, setSelectedClientEmail] = useState(null);

    // Custom select dropdown state hooks
    const [isSenderSelectOpen, setIsSenderSelectOpen] = useState(false);
    const [selectedSender, setSelectedSender] = useState('');

    useEffect(() => {
        if (!selectedSender && accounts.length > 0) {
            setSelectedSender(accountFilter || accounts[0]?.email);
        }
    }, [accounts, accountFilter]);

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
        if (view === 'compose' && editorRef.current) {
            const currentHTML = editorRef.current.innerHTML;
            const targetHTML = composeData.html || composeData.text?.replace(/\n/g, '<br>') || '';
            if (currentHTML !== targetHTML) {
                editorRef.current.innerHTML = targetHTML;
            }
        }
    }, [view, composeData.html, composeData.text]);

    const execCommand = (command, value = null) => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            setComposeData(prev => ({
                ...prev,
                html: editorRef.current.innerHTML,
                text: editorRef.current.innerText
            }));
        }
    };

    const insertHTML = (html) => {
        if (editorRef.current) {
            editorRef.current.focus();
            document.execCommand('insertHTML', false, html);
            setComposeData(prev => ({
                ...prev,
                html: editorRef.current.innerHTML,
                text: editorRef.current.innerText
            }));
        }
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

    useEffect(() => {
        const toParam = searchParams.get('to');
        if (toParam) {
            setComposeData(prev => ({
                ...prev,
                to: decodeURIComponent(toParam)
            }));
            setView('compose');
            
            // Clean 'to' param so it doesn't trigger again on component re-render or internal navigation
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('to');
            setSearchParams(newParams, { replace: true });
        }
    }, [searchParams, setSearchParams]);

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

    const handleFormKeyDown = (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.target.hasAttribute('contenteditable')) {
            e.preventDefault();
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData();
        
        formData.append('from', form.from.value);
        formData.append('to', form.to.value);
        formData.append('subject', form.subject.value);
        
        const htmlContent = editorRef.current ? editorRef.current.innerHTML : '';
        const plainTextContent = editorRef.current ? (editorRef.current.innerText || htmlContent.replace(/<[^>]*>/g, '')) : '';
        
        formData.append('text', plainTextContent);
        formData.append('html', htmlContent);
        
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
            setComposeData({ to: '', subject: '', text: '', html: '' });
            if (editorRef.current) {
                editorRef.current.innerHTML = '';
            }
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
        const replyHtml = `<br><br><div style="border-left: 2px solid #ddd; padding-left: 10px; margin-left: 5px; color: #666;">Am ${new Date(msg.received_at).toLocaleString()} schrieb ${msg.sender}:<br><br>${msg.body_html || msg.body_plain?.replace(/\n/g, '<br>') || ''}</div>`;
        setComposeData({
            to: msg.sender,
            subject: `Re: ${msg.subject}`,
            text: `\n\n--- Am ${new Date(msg.received_at).toLocaleString()} schrieb ${msg.sender} ---\n\n${msg.body_plain}`,
            html: replyHtml
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
                                               file.file_name?.match(/\.(jpg|jpeg|png|gif|webp|svg|heic|heif|tiff|bmp|jfif|avif|ico|dng|mp4|webm|mov|avi|mkv|wmv|flv|m4v|3gp)$/i);
                                
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
                <button onClick={() => { setView('inbox'); setComposeData({ to: '', subject: '', text: '', html: '' }); }} className="text-gray-400 hover:text-white transition-colors"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <form onSubmit={handleSend} onKeyDown={handleFormKeyDown} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm text-gray-400 mb-2 font-semibold">Von</label>
                        <div className="relative">
                            <input type="hidden" name="from" value={selectedSender || accountFilter || accounts[0]?.email || ''} />
                            <button
                                type="button"
                                onClick={() => setIsSenderSelectOpen(!isSenderSelectOpen)}
                                className="w-full glass-input rounded-xl px-4 py-3 text-white font-semibold text-left flex items-center justify-between"
                            >
                                <span className="truncate">
                                    {(() => {
                                        const currentVal = selectedSender || accountFilter || accounts[0]?.email;
                                        const acc = accounts.find(a => String(a.email) === String(currentVal));
                                        return acc ? (acc.display_name ? `${acc.display_name} <${acc.email}>` : acc.email) : 'Absender wählen...';
                                    })()}
                                </span>
                                <i className={`fa-solid fa-chevron-down text-gray-400 text-xs transition-transform duration-200 ${isSenderSelectOpen ? 'rotate-180' : ''}`}></i>
                            </button>
                            {isSenderSelectOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsSenderSelectOpen(false)} />
                                    <div className="absolute left-0 right-0 mt-1 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar text-left font-normal">
                                        {accounts.map(acc => (
                                            <button
                                                key={acc.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedSender(acc.email);
                                                    setIsSenderSelectOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors truncate ${String(selectedSender || accountFilter || accounts[0]?.email) === String(acc.email) ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                            >
                                                {acc.display_name ? `${acc.display_name} <${acc.email}>` : acc.email}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
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
                    <div className="flex flex-col border border-white/10 rounded-2xl overflow-hidden glass-input focus-within:border-blue-500/50 focus-within:shadow-[0_0_15px_rgba(59,130,246,0.1)] transition-all">
                        {/* Toolbar */}
                        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 bg-white/5 border-b border-white/10">
                            <button
                                type="button"
                                onClick={() => execCommand('bold')}
                                className="w-8 h-8 rounded-lg hover:bg-white/10 text-white font-bold flex items-center justify-center transition-colors text-sm"
                                title="Fett (Strg+B)"
                            >
                                <i className="fa-solid fa-bold"></i>
                            </button>
                            <button
                                type="button"
                                onClick={() => execCommand('italic')}
                                className="w-8 h-8 rounded-lg hover:bg-white/10 text-white italic flex items-center justify-center transition-colors text-sm"
                                title="Kursiv (Strg+I)"
                            >
                                <i className="fa-solid fa-italic"></i>
                            </button>
                            <button
                                type="button"
                                onClick={() => execCommand('underline')}
                                className="w-8 h-8 rounded-lg hover:bg-white/10 text-white underline flex items-center justify-center transition-colors text-sm"
                                title="Unterstrichen (Strg+U)"
                            >
                                <i className="fa-solid fa-underline"></i>
                            </button>
                            <button
                                type="button"
                                onClick={() => execCommand('strikeThrough')}
                                className="w-8 h-8 rounded-lg hover:bg-white/10 text-white line-through flex items-center justify-center transition-colors text-sm"
                                title="Durchgestrichen"
                            >
                                <i className="fa-solid fa-strikethrough"></i>
                            </button>
                            
                            <div className="w-[1px] h-5 bg-white/10 mx-1"></div>
                            
                            <button
                                type="button"
                                onClick={() => execCommand('insertUnorderedList')}
                                className="w-8 h-8 rounded-lg hover:bg-white/10 text-white flex items-center justify-center transition-colors text-sm"
                                title="Aufzählung"
                            >
                                <i className="fa-solid fa-list-ul"></i>
                            </button>
                            <button
                                type="button"
                                onClick={() => execCommand('insertOrderedList')}
                                className="w-8 h-8 rounded-lg hover:bg-white/10 text-white flex items-center justify-center transition-colors text-sm"
                                title="Nummerierte Liste"
                            >
                                <i className="fa-solid fa-list-ol"></i>
                            </button>
                            
                            <div className="w-[1px] h-5 bg-white/10 mx-1"></div>
                            
                            <button
                                type="button"
                                onClick={() => {
                                    const url = prompt('Link-URL eingeben (z. B. https://example.com):');
                                    if (url) execCommand('createLink', url);
                                }}
                                className="w-8 h-8 rounded-lg hover:bg-white/10 text-blue-400 flex items-center justify-center transition-colors text-sm"
                                title="Link einfügen"
                            >
                                <i className="fa-solid fa-link"></i>
                            </button>
                            <button
                                type="button"
                                onClick={() => execCommand('unlink')}
                                className="w-8 h-8 rounded-lg hover:bg-white/10 text-gray-400 flex items-center justify-center transition-colors text-sm"
                                title="Link entfernen"
                            >
                                <i className="fa-solid fa-link-slash"></i>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const btnText = prompt('Button-Text eingeben (z. B. "Jetzt ansehen"):', 'Hier klicken');
                                    if (btnText) {
                                        const btnUrl = prompt('Link-URL eingeben (z. B. https://example.com):', 'https://');
                                        if (btnUrl) {
                                            const btnHtml = `<a href="${btnUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-family: Helvetica, Arial, sans-serif; margin: 10px 0; font-size: 14px; text-align: center;">${btnText}</a>`;
                                            insertHTML(btnHtml);
                                        }
                                    }
                                }}
                                className="w-8 h-8 rounded-lg hover:bg-white/10 text-blue-400 flex items-center justify-center transition-colors text-sm"
                                title="Button-Link einfügen (Call-to-Action)"
                            >
                                <i className="fa-solid fa-square-plus"></i>
                            </button>
                            
                            <div className="w-[1px] h-5 bg-white/10 mx-1"></div>
                            
                            <button
                                type="button"
                                onClick={() => execCommand('removeFormat')}
                                className="w-8 h-8 rounded-lg hover:bg-white/10 text-red-400 flex items-center justify-center transition-colors text-sm ml-auto"
                                title="Formatierung löschen"
                            >
                                <i className="fa-solid fa-eraser"></i>
                            </button>
                        </div>
                        {/* ContentEditable Editor Area */}
                        <div
                            ref={editorRef}
                            contentEditable
                            onInput={() => {
                                if (editorRef.current) {
                                    setComposeData(prev => ({
                                        ...prev,
                                        html: editorRef.current.innerHTML,
                                        text: editorRef.current.innerText
                                    }));
                                }
                            }}
                            className="w-full min-h-[250px] max-h-[500px] overflow-y-auto px-6 py-5 text-white focus:outline-none leading-relaxed text-sm bg-transparent custom-rich-editor"
                            placeholder="Schreiben Sie Ihre Nachricht hier..."
                            style={{ outline: 'none' }}
                        />
                    </div>
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-[fadeIn_0.3s_ease-out]">
                            {attachments.map((file, i) => {
                                const isImage = file.type?.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
                                const previewUrl = isImage ? URL.createObjectURL(file) : null;
                                const sizeString = file.size ? `${(file.size / 1024).toFixed(1)} KB` : '0.0 KB';

                                return (
                                    <div 
                                        key={i} 
                                        className="relative group glass-card rounded-2xl border border-white/10 bg-white/5 p-3 flex flex-col items-center justify-between text-center overflow-hidden transition-all hover:scale-[1.03] hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] animate-[modalIn_0.2s_ease-out]"
                                    >
                                        <button 
                                            type="button"
                                            onClick={() => removeAttachment(i)}
                                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-gray-400 hover:text-red-400 hover:border-red-500/50 transition-all z-10"
                                            title="Anhang entfernen"
                                        >
                                            <i className="fa-solid fa-xmark text-[10px]"></i>
                                        </button>

                                        {isImage ? (
                                            <div className="w-full aspect-video rounded-lg overflow-hidden bg-black/40 mb-3 relative flex items-center justify-center border border-white/5">
                                                <img 
                                                    src={previewUrl} 
                                                    alt={file.name} 
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-full aspect-video rounded-lg bg-white/5 border border-white/5 mb-3 flex flex-col items-center justify-center text-blue-400 gap-1">
                                                <i className={`fa-solid ${
                                                    file.name.endsWith('.pdf') ? 'fa-file-pdf text-red-400' :
                                                    file.name.match(/\.(zip|rar|tar|gz|7z)$/i) ? 'fa-file-zipper text-yellow-400' :
                                                    file.name.match(/\.(xlsx|xls|csv)$/i) ? 'fa-file-excel text-emerald-400' :
                                                    file.name.match(/\.(docx|doc)$/i) ? 'fa-file-word text-blue-400' :
                                                    'fa-file-lines text-blue-400'
                                                } text-3xl`}></i>
                                                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                                                    {file.name.split('.').pop()}
                                                </span>
                                            </div>
                                        )}

                                        <div className="w-full px-1 min-w-0">
                                            <p className="text-xs font-bold text-white truncate mb-0.5" title={file.name}>
                                                {file.name}
                                            </p>
                                            <p className="text-[10px] text-gray-500">{sizeString}</p>
                                        </div>

                                        {/* Premium Loading/Upload Progress Bar (Mocked to be complete) */}
                                        <div className="w-full mt-3 h-1 bg-white/10 rounded-full overflow-hidden p-[1px]">
                                            <div className="h-full bg-blue-500 rounded-full w-full"></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={() => { setView('inbox'); setAttachments([]); setComposeData({ to: '', subject: '', text: '', html: '' }); }} className="px-6 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-bold transition-colors">Abbrechen</button>
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
                <button onClick={() => { setComposeData({ to: '', subject: '', text: '', html: '' }); setAttachments([]); setView('compose'); }} className="w-full md:w-auto px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 group shrink-0">
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
                                onClick={() => { 
                                    setView(item.id); 
                                    setSelectedMessage(null); 
                                    setComposeData({ to: '', subject: '', text: '', html: '' }); 
                                    setAttachments([]); 
                                }}
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

                    {/* Bulk email link removed from menu as per privacy requirements */}
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

                /* Custom Rich Text Editor Styles */
                .custom-rich-editor[contenteditable]:empty::before {
                    content: 'Schreiben Sie Ihre Nachricht hier...';
                    color: rgba(255, 255, 255, 0.25);
                    cursor: text;
                }
                .custom-rich-editor ul { list-style-type: disc !important; padding-left: 20px !important; margin-top: 5px !important; margin-bottom: 5px !important; }
                .custom-rich-editor ol { list-style-type: decimal !important; padding-left: 20px !important; margin-top: 5px !important; margin-bottom: 5px !important; }
                .custom-rich-editor a { color: #3b82f6 !important; text-decoration: underline !important; }
                .custom-rich-editor a:hover { color: #60a5fa !important; }
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
