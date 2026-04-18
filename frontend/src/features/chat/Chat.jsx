import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import { getImageUrl } from '../../utils/config';
import socketService from '../../services/socket';
import Peer from 'peerjs';
import EmojiPicker from 'emoji-picker-react';

const AudioMessage = ({ src, isOwn }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef(null);

    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        setCurrentTime(audioRef.current.currentTime);
    };

    const handleLoadedMetadata = () => {
        setDuration(audioRef.current.duration);
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
    };

    const formatTime = (time) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`flex items-center gap-3 p-2 rounded-2xl min-w-[200px] ${isOwn ? 'bg-blue-600 text-white' : 'bg-white/10 text-white border border-white/10'}`}>
            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                className="hidden"
            />
            <button
                onClick={togglePlay}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-blue-600 hover:bg-blue-500'}`}
            >
                <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-sm`}></i>
            </button>
            <div className="flex-1 flex flex-col gap-1">
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-white transition-all duration-100"
                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] opacity-70">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    );
};

const ImageGrid = ({ images, onImageClick, isOwn }) => {
    const count = images.length;

    if (count === 1) {
        const msg = images[0];
        return (
            <img
                crossOrigin="anonymous"
                src={getImageUrl(msg.text)}
                alt="Attachment"
                className="max-w-full max-h-[500px] object-contain rounded-xl border border-white/10 cursor-pointer hover:scale-[1.01] transition-transform shadow-lg"
                onClick={() => onImageClick(msg.id)}
            />
        );
    }

    const gridClass = count === 2 
        ? 'grid-cols-2' 
        : count === 3 
            ? 'grid-cols-2' // 1 large + 2 small or similar
            : 'grid-cols-2';

    return (
        <div className={`grid ${gridClass} gap-1 rounded-xl overflow-hidden border border-white/10 shadow-lg max-w-[400px]`}>
            {images.slice(0, 4).map((msg, index) => {
                const isLast = index === 3 && count > 4;
                return (
                    <div 
                        key={msg.id} 
                        className={`relative aspect-square cursor-pointer hover:opacity-90 transition-opacity ${count === 3 && index === 0 ? 'col-span-2 aspect-[2/1]' : ''}`}
                        onClick={() => onImageClick(msg.id)}
                    >
                        <img
                            crossOrigin="anonymous"
                            src={getImageUrl(msg.text)}
                            alt="Attachment"
                            className="w-full h-full object-cover"
                        />
                        {isLast && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
                                <span className="text-white text-xl font-bold">+{count - 4}</span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const groupMessages = (messages) => {
    if (!messages || messages.length === 0) return [];
    
    const grouped = [];
    let currentGroup = null;

    messages.forEach((msg) => {
        const isImage = msg.type === 'image';
        
        const canGroup = currentGroup && 
                        currentGroup.senderId === msg.senderId && 
                        currentGroup.type === 'image_group' && 
                        isImage &&
                        !msg.repliedTo &&
                        (new Date(msg.createdAt) - new Date(currentGroup.lastCreatedAt)) < 60000;

        if (canGroup) {
            currentGroup.images.push(msg);
            currentGroup.lastId = msg.id;
            currentGroup.lastCreatedAt = msg.createdAt;
        } else {
            if (isImage) {
                currentGroup = {
                    ...msg,
                    type: 'image_group',
                    images: [msg],
                    originalType: 'image',
                    lastCreatedAt: msg.createdAt
                };
                grouped.push(currentGroup);
            } else {
                currentGroup = null;
                grouped.push(msg);
            }
        }
    });

    return grouped;
};

const Chat = () => {
    const { user: currentUser } = useSelector(state => state.auth);
    const [conversations, setConversations] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [typingStatus, setTypingStatus] = useState({});

    // New State for User Selection
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [allUsers, setAllUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [modalSearchQuery, setModalSearchQuery] = useState('');
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const onEmojiClick = (emojiObject) => {
        setNewMessage(prev => prev + emojiObject.emoji);
    };

    // Image Editor & Gallery State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingImage, setEditingImage] = useState(null); // { url, file }
    const [editorCaption, setEditorCaption] = useState('');
    const [editorMode, setEditorMode] = useState('none'); // 'draw', 'text', 'crop'
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);

    // Reply State
    const [replyingTo, setReplyingTo] = useState(null);

    // Voice Message State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordingStartX, setRecordingStartX] = useState(0);
    const [recordingOffset, setRecordingOffset] = useState(0);
    const [isRecordingCancelled, setIsRecordingCancelled] = useState(false);
    const isRecordingCancelledRef = useRef(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingIntervalRef = useRef(null);

    const [activeReactionMenu, setActiveReactionMenu] = useState(null); // messageId
    const reactionsList = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

    // Typing State
    const [typingUsers, setTypingUsers] = useState({}); // { conversationId: [userIds] }
    const typingTimeoutRef = useRef(null);

    const [cropStart, setCropStart] = useState(null);
    const [cropEnd, setCropEnd] = useState(null);
    const [pencilColor, setPencilColor] = useState('#ef4444'); // Default red-500

    // Call States
    const [peer, setPeer] = useState(null);
    const [myPeerId, setMyPeerId] = useState(null);
    const [activeCall, setActiveCall] = useState(null); // { peerCall, type, otherUser, direction: 'in' | 'out' }
    const [incomingCall, setIncomingCall] = useState(null); // { callerId, callerName, type, peerId }
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [callDuration, setCallDuration] = useState(0);

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    // Refs for socket listeners to avoid stale closures
    const localStreamRef = useRef(null);
    const peerRef = useRef(null);
    const activeCallRef = useRef(null);
    const myPeerIdRef = useRef(null);
    const selectedIdRef = useRef(null);
    const callDurationRef = useRef(0);

    useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
    useEffect(() => { peerRef.current = peer; }, [peer]);
    useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
    useEffect(() => { myPeerIdRef.current = myPeerId; }, [myPeerId]);
    useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
    useEffect(() => { callDurationRef.current = callDuration; }, [callDuration]);

    // Forwarding State
    const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
    const [forwardingMsg, setForwardingMsg] = useState(null);
    const [targetForwardId, setTargetForwardId] = useState(null); // Selected recipient convId
    const [isForwardingEdit, setIsForwardingEdit] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const attachmentMenuRef = useRef(null);
    const canvasRef = useRef(null);
    const editHistoryRef = useRef([]);

    // Group Creation State
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [newGroupName, setNewGroupName] = useState('');

    // --- Call Logic & Management ---
    // Initialize PeerJS
    useEffect(() => {
        if (!currentUser?.id) return;

        // Actually, let's use the default PeerJS public server for easier setup
        const publicPeer = new Peer({
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                ]
            }
        });

        publicPeer.on('open', (id) => {
            console.log('My Peer ID is: ' + id);
            setMyPeerId(id);
        });

        publicPeer.on('call', (call) => {
            // This is for incoming WebRTC calls once accepted
            // We handle the accepting logic separately via Socket.io first
        });

        setPeer(publicPeer);

        socketService.on('call:incoming', (data) => {
            console.log('Incoming call notification received:', data);
            setIncomingCall(data);
        });

        socketService.on('call:answered', (data) => {
            console.log('Call answered notification received:', data);
            if (data.accepted) {
                handleEstablishCall(data.peerId);
            } else {
                alert('Anruf abgelehnt');
                stopMediaTracks();
                setActiveCall(null);
            }
        });

        socketService.on('call:finished', () => {
            handleCallEndedLocally();
        });

        return () => {
            publicPeer.destroy();
            socketService.off('call:incoming');
            socketService.off('call:answered');
            socketService.off('call:finished');
        };
    }, [currentUser]);

    const stopMediaTracks = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
    };

    const handleEstablishCall = (remotePeerId) => {
        // Use REFS inside this function because it might be called from an old listener closure
        if (!localStreamRef.current || !peerRef.current || !activeCallRef.current) {
            console.warn('Cannot establish call: missing localStream, peer, or activeCall state', {
                hasStream: !!localStreamRef.current,
                hasPeer: !!peerRef.current,
                hasCall: !!activeCallRef.current
            });
            return;
        }

        console.log('Establishing connection to remote peer:', remotePeerId);
        const call = peerRef.current.call(remotePeerId, localStreamRef.current);
        
        call.on('stream', (userRemoteStream) => {
            console.log('Caller side: Received remote stream');
            setRemoteStream(userRemoteStream);
        });

        call.on('error', (err) => {
            console.error('PeerJS call error:', err);
            handleCallEndedLocally();
        });

        setActiveCall(prev => ({ ...prev, peerCall: call, status: 'active' }));
    };

    // Handle PeerJS events for answering
    useEffect(() => {
        if (!peer || !localStream || !incomingCall) return;

        const handleCall = (call) => {
            console.log('Answering incoming PeerJS call');
            call.answer(localStream);
            call.on('stream', (userRemoteStream) => {
                console.log('Receiver side: Received remote stream');
                setRemoteStream(userRemoteStream);
            });
            setActiveCall(prev => ({ ...prev, peerCall: call, status: 'active' }));
        };

        peer.on('call', handleCall);
        return () => peer.off('call', handleCall);
    }, [peer, localStream, incomingCall]);

    const initiateCall = async (type) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: type === 'video',
                audio: true
            });
            setLocalStream(stream);

            const otherParticipant = activeConversation.participants.find(p => p.userId !== currentUser.id);
            if (!otherParticipant) return;

            socketService.emit('call:request', {
                targetUserId: otherParticipant.userId,
                peerId: myPeerId,
                type,
                callerName: currentUser.username // Explicitly send name
            });

            setActiveCall({
                type,
                otherUser: otherParticipant.user,
                direction: 'out',
                status: 'calling'
            });
        } catch (err) {
            console.error('Failed to get media stream:', err);
            alert('Kamera или Mikrofon Zugriff verweigert');
        }
    };

    const answerCall = async () => {
        if (!incomingCall) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: incomingCall.type === 'video',
                audio: true
            });
            setLocalStream(stream);

            socketService.emit('call:response', {
                targetUserId: incomingCall.callerId,
                accepted: true,
                peerId: myPeerId
            });

            setActiveCall({
                type: incomingCall.type,
                otherUser: { id: incomingCall.callerId, username: incomingCall.callerName },
                direction: 'in',
                status: 'active'
            });
            setIncomingCall(null);
        } catch (err) {
            console.error('Failed to answer call:', err);
        }
    };

    const declineCall = () => {
        if (!incomingCall) return;
        socketService.emit('call:response', {
            targetUserId: incomingCall.callerId,
            accepted: false
        });
        setIncomingCall(null);
    };

    const endCall = () => {
        const otherParticipant = activeConversation?.participants.find(p => p.userId !== currentUser.id);
        const targetId = activeCall?.otherUser?.id || incomingCall?.callerId || otherParticipant?.userId;

        if (targetId) {
            socketService.emit('call:end', { targetUserId: targetId });
        }
        handleCallEndedLocally();
    };

    const handleCallEndedLocally = () => {
        const callData = activeCallRef.current;
        const convId = selectedIdRef.current;
        const duration = callDurationRef.current;

        if (callData?.peerCall) callData.peerCall.close();
        
        // Log call to chat history (only for the initiator/caller to avoid duplicates)
        if (callData && callData.direction === 'out' && convId) {
            const mins = Math.floor(duration / 60);
            const secs = duration % 60;
            if (callData.status === 'active') {
                const durStr = `${mins}:${secs.toString().padStart(2, '0')}`;
                api.post(`/chat/conversations/${convId}/messages`, {
                    text: `📞 ${callData.type === 'video' ? 'Videoanruf' : 'Audioanruf'} beendet (${durStr})`
                }).catch(err => console.error('Failed to log call end:', err));
            } else if (callData.status === 'calling') {
                api.post(`/chat/conversations/${convId}/messages`, {
                    text: `📴 Verpasster ${callData.type === 'video' ? 'Videoanruf' : 'Audioanruf'}`
                }).catch(err => console.error('Failed to log missed call:', err));
            }
        }

        stopMediaTracks();
        setRemoteStream(null);
        setActiveCall(null);
        setIncomingCall(null);
        setCallDuration(0);
    };

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(!isVideoOff);
        }
    };

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, activeCall?.type]); // Re-run if type changes to ensure ref is attached

    // Call Duration Timer
    useEffect(() => {
        let timer = null;
        if (activeCall?.status === 'active') {
            timer = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } else {
            setCallDuration(0);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [activeCall?.status]);
    // ---------------------------------

    // Message Selection Mode
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState([]);

    // 1. Initial Load of Conversations
    useEffect(() => {
        if (!currentUser) return;
        fetchConversations();

        // Socket Listeners
        socketService.connect();

        socketService.on('new_message', (data) => {
            const { conversationId, message } = data;

            // If it's the currently open chat, add to messages
            if (conversationId === selectedId) {
                setMessages(prev => {
                    // 1. Prevent exact ID duplicates
                    if (prev.some(m => String(m.id) === String(message.id))) return prev;

                    // 2. Prevent optimistic UI duplicates (same text/sender/type recently)
                    const optimisticIndex = prev.findIndex(m =>
                        (isNaN(Number(m.id)) || String(m.id).length > 12) &&
                        m.senderId === message.senderId &&
                        m.text === message.text &&
                        m.type === message.type
                    );

                    if (optimisticIndex !== -1) {
                        const updated = [...prev];
                        updated[optimisticIndex] = message;
                        return updated;
                    }

                    return [...prev, message];
                });
                markAsRead(conversationId);
            }
-
-            // Update the conversation list (last message & order)
            setConversations(prev => {
                const index = prev.findIndex(c => c.id === conversationId);
                if (index === -1) {
                    // If not in list, we might need to re-fetch or just wait for next load
                    // For now, let's just trigger a re-fetch of the whole list to be safe and get full data
                    fetchConversations();
                    return prev;
                }

                const updated = [...prev];
                const conv = { ...updated[index] };
                conv.lastMessage = message.text;
                conv.time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                conv.updatedAt = message.createdAt; // Ensure sort remains correct on refresh

                // Increment unread if not selected
                if (conversationId !== selectedId) {
                    conv.unread = (conv.unread || 0) + 1;
                }

                // Move to top
                updated.splice(index, 1);
                updated.unshift(conv);
                return updated;
            });
        });

        socketService.on('user_online', ({ userId }) => {
            setConversations(prev => prev.map(c =>
                c.participants?.some(p => p.userId === userId) ? { ...c, online: true } : c
            ));
        });

        socketService.on('user_offline', ({ userId }) => {
            setConversations(prev => prev.map(c =>
                c.participants?.some(p => p.userId === userId) ? { ...c, online: false } : c
            ));
        });

        socketService.on('user_typing', ({ conversationId, userId, isTyping }) => {
            if (conversationId === selectedId) {
                setTypingStatus(prev => ({ ...prev, [userId]: isTyping }));
            }
        });

        socketService.on('messages_read', ({ conversationId, readerId }) => {
            if (conversationId === selectedId && readerId !== currentUser.id) {
                setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
            }
            // Also update the conversation in the sidebar list to clear its unread badge if we are the ones who read it
            if (readerId === currentUser.id) {
                setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0, unread: 0 } : c));
            }
        });

        socketService.on('message_deleted', (payload) => {
            // Use String comparison to avoid type mismatch (id vs "id")
            const deletedId = String(payload.messageId);

            // Update messages if this conversation is active
            if (String(payload.conversationId) === String(selectedId)) {
                setMessages(prev => prev.filter(m => String(m.id) !== deletedId));
            }

            // Update conversation list (sidebar)
            setConversations(prev => prev.map(conv => {
                if (String(conv.id) === String(payload.conversationId)) {
                    // Check if the deleted message was the last one
                    if (conv.messages?.[0] && String(conv.messages[0].id) === deletedId) {
                        return {
                            ...conv,
                            messages: [{ ...conv.messages[0], text: 'Nachricht gelöscht', type: 'text' }],
                            lastMessage: 'Nachricht gelöscht'
                        };
                    }
                }
                return conv;
            }));
        });

        socketService.on('messages_bulk_deleted', (payload) => {
            const deletedIds = payload.messageIds.map(String);
            if (String(payload.conversationId) === String(selectedId)) {
                setMessages(prev => prev.filter(m => !deletedIds.includes(String(m.id))));
            }
            fetchConversations(); // Simpler to refetch for bulk deletions to ensure consistency
        });

        return () => {
            socketService.off('new_message');
            socketService.off('user_online');
            socketService.off('user_offline');
            socketService.off('messages_read');
            socketService.off('message_deleted');
        };
    }, [selectedId]);

    // 2. Fetch Messages when Chat selected
    useEffect(() => {
        if (selectedId) {
            fetchMessages(selectedId);
            socketService.emit('join_conversation', selectedId);
            markAsRead(selectedId);

            socketService.on('messages_read', ({ conversationId, readerId }) => {
                if (conversationId === selectedId && readerId !== currentUser.id) {
                    setMessages(prev => prev.map(m =>
                        m.senderId === currentUser.id ? { ...m, isRead: true } : m
                    ));
                }
            });

            socketService.on('new_conversation', ({ conversation }) => {
                setConversations(prev => {
                    const exists = prev.find(c => c.id === conversation.id);
                    if (exists) return prev;
                    return [conversation, ...prev];
                });
            });

            return () => {
                socketService.emit('leave_conversation', selectedId);
                socketService.off('new_message');
                socketService.off('message_deleted');
                socketService.off('message_reaction_updated');
                socketService.off('user_typing');
                socketService.off('messages_read');
                socketService.off('new_conversation');
            };
        }
    }, [selectedId]);

    // Close attachment menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target)) {
                setShowAttachmentMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchConversations = async () => {
        if (!currentUser) return;
        try {
            const res = await api.get('/chat/conversations');
            const rawConvs = res.data.data.conversations || [];

            // 1. Sort by MOST recent activity (either conversation update OR latest message)
            const sortedRaw = [...rawConvs].sort((a, b) => {
                const latestA = Math.max(
                    new Date(a.updatedAt || 0).getTime(),
                    a.messages?.[0] ? new Date(a.messages[0].createdAt).getTime() : 0
                );
                const latestB = Math.max(
                    new Date(b.updatedAt || 0).getTime(),
                    b.messages?.[0] ? new Date(b.messages[0].createdAt).getTime() : 0
                );
                return latestB - latestA;
            });

            const data = sortedRaw.map(c => ({
                ...c,
                // Flatten name and dynamic data for the UI
                name: c.isGroup ? c.name : c.participants.find(p => p.userId !== currentUser.id)?.user?.name || 'Unbekannt',
                avatar: c.isGroup
                    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || 'G')}&background=random&color=fff`
                    : c.participants.find(p => p.userId !== currentUser.id)?.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.participants.find(p => p.userId !== currentUser.id)?.user?.name || 'U')}&background=random&color=fff`,
                lastMessage: c.messages?.[0]?.text || 'Keine Nachrichten',
                time: c.messages?.[0] ? new Date(c.messages[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                online: c.isOnline,
                lastSeenAt: c.isGroup ? null : c.participants.find(p => p.userId !== currentUser.id)?.user?.last_seen_at,
                unread: c.unreadCount || 0
            }));
            setConversations(data);
        } catch (err) {
            console.error('Error fetching conversations:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMessages = async (id) => {
        try {
            const res = await api.get(`/chat/conversations/${id}/messages`);
            setMessages(res.data.data.messages);
        } catch (err) {
            console.error('Error fetching messages:', err);
        }
    };

    const markAsRead = async (id) => {
        try {
            await api.patch(`/chat/conversations/${id}/read`);
            setConversations(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));
        } catch (err) { /* ignore */ }
    };

    const handleDeleteMessage = async (messageId) => {
        if (!confirm('Möchten Sie diese Nachricht wirklich löschen?')) return;
        try {
            await api.delete(`/chat/messages/${messageId}`);
            setMessages(prev => prev.filter(m => m.id !== messageId));
        } catch (err) {
            console.error('Failed to delete message:', err);
        }
    };

    const toggleMessageSelection = (messageId) => {
        setSelectedMessageIds(prev =>
            prev.includes(messageId)
                ? prev.filter(id => id !== messageId)
                : [...prev, messageId]
        );
    };

    const allSelectedAreOwn = selectedMessageIds.length > 0 && selectedMessageIds.every(id => {
        const msg = messages.find(m => m.id === id);
        return msg?.senderId === currentUser?.id;
    });

    const handleBulkDelete = async () => {
        if (selectedMessageIds.length === 0 || !allSelectedAreOwn) return;
        if (!confirm(`${selectedMessageIds.length} Nachrichten wirklich löschen?`)) return;

        try {
            await api.post('/chat/messages/bulk-delete', { messageIds: selectedMessageIds });
            setMessages(prev => prev.filter(m => !selectedMessageIds.includes(m.id)));
            setSelectedMessageIds([]);
            setIsSelectionMode(false);
        } catch (err) {
            console.error('Bulk delete failed:', err);
            alert('Fehler beim Löschen');
        }
    };

    const handleBulkForward = () => {
        if (selectedMessageIds.length === 0) return;
        fetchUsers();
        setIsForwardModalOpen(true);
    };

    // Voice Recording Logic
    const startRecording = async (e) => {
        try {
            const startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            setRecordingStartX(startX);
            setRecordingOffset(0);
            setIsRecordingCancelled(false);
            isRecordingCancelledRef.current = false;

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                if (isRecordingCancelledRef.current) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const file = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });

                const formData = new FormData();
                formData.append('files', file);

                try {
                    const currentReplyToId = replyingTo?.id;
                    setReplyingTo(null);
                    if (currentReplyToId) formData.append('replyToId', currentReplyToId);

                    const res = await api.post(`/chat/conversations/${selectedId}/upload`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    if (res.data?.success && res.data?.data?.messages) {
                        setMessages(prev => {
                            const newIds = res.data.data.messages.map(m => m.id);
                            const filtered = prev.filter(m => !newIds.includes(m.id));
                            return [...filtered, ...res.data.data.messages];
                        });
                    }
                } catch (err) {
                    console.error('Failed to upload voice message:', err);
                }

                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Microphone access denied:', err);
            alert('Mikrofon-Zugriff verweigert');
        }
    };

    const handleRecordingMove = (e) => {
        if (!isRecording) return;
        const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        const diff = currentX - recordingStartX;

        // Only track leftward movement
        if (diff < 0) {
            const offset = Math.abs(diff);
            setRecordingOffset(offset);

            const cancelled = offset > 100;
            if (cancelled !== isRecordingCancelledRef.current) {
                setIsRecordingCancelled(cancelled);
                isRecordingCancelledRef.current = cancelled;
            }
        }
    };

    const stopRecording = (cancelSilently = false) => {
        if (mediaRecorderRef.current && isRecording) {
            if (cancelSilently) {
                isRecordingCancelledRef.current = true;
                setIsRecordingCancelled(true);
            }

            const shouldCancel = isRecordingCancelledRef.current;
            if (shouldCancel) {
                audioChunksRef.current = [];
            }
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            // We set these back after a short delay or in next tick, but technically the ref will handle it
            clearInterval(recordingIntervalRef.current);
        }
    };

    const formatRecordingTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleToggleReaction = async (messageId, emoji) => {
        setActiveReactionMenu(null);

        // Optimistic UI
        setMessages(prev => prev.map(m => {
            if (String(m.id) === String(messageId)) {
                let reactions = m.reactions || {};
                if (typeof reactions === 'string') reactions = JSON.parse(reactions);
                else reactions = { ...reactions };

                if (reactions[currentUser.id] === emoji) {
                    delete reactions[currentUser.id];
                } else {
                    reactions[currentUser.id] = emoji;
                }
                return { ...m, reactions };
            }
            return m;
        }));

        try {
            await api.post(`/chat/messages/${messageId}/react`, { emoji });
        } catch (err) {
            console.error('Failed to toggle reaction:', err);
        }
    };

    const handleDownload = async (url, filename) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || 'download.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Download failed:', err);
            alert('Fehler beim Herunterladen');
        }
    };

    const fetchUsers = async () => {
        if (!currentUser) return;
        setIsLoadingUsers(true);
        try {
            const res = await api.get('/users');
            setAllUsers(res.data.data.users.filter(u => u.id !== currentUser?.id));
        } catch (error) {
            console.error('Error fetching users for chat:', error);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const handleStartChat = async () => {
        if (selectedUserIds.length === 0) return;

        try {
            let response;
            if (selectedUserIds.length === 1) {
                // Direct Chat
                response = await api.post('/chat/conversations/direct', {
                    targetUserId: selectedUserIds[0]
                });
            } else {
                // Group Chat
                if (!newGroupName.trim()) {
                    alert('Bitte einen Gruppennamen eingeben');
                    return;
                }
                response = await api.post('/chat/conversations/group', {
                    name: newGroupName.trim(),
                    userIds: selectedUserIds
                });
            }

            const conversation = response.data.data.conversation;
            setConversations(prev => {
                const exists = prev.find(c => c.id === conversation.id);
                if (exists) return prev;
                return [conversation, ...prev];
            });
            setSelectedId(conversation.id);
            setIsUserModalOpen(false);
            setSelectedUserIds([]);
            setNewGroupName('');
        } catch (error) {
            console.error('Error starting conversation:', error);
            alert('Fehler beim Erstellen der Unterhaltung');
        }
    };

    const formatLastSeen = (lastSeenAt, isOnline) => {
        if (isOnline) return 'Online';
        if (!lastSeenAt) return 'Zuletzt gesehen: Unbekannt';

        const lastSeen = new Date(lastSeenAt);
        const now = new Date();
        const diffInSeconds = Math.floor((now - lastSeen) / 1000);

        if (diffInSeconds < 60) return 'Gerade eben online';
        if (diffInSeconds < 3600) return `Zuletzt online: vor ${Math.floor(diffInSeconds / 60)} Min.`;
        if (diffInSeconds < 86400) return `Zuletzt online: vor ${Math.floor(diffInSeconds / 3600)} Std.`;

        return `Zuletzt online: ${lastSeen.toLocaleDateString([], { day: '2-digit', month: '2-digit' })}`;
    };

    const handleUserToggle = (userId) => {
        setSelectedUserIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleInputChange = (e) => {
        setNewMessage(e.target.value);

        // Handle typing indicator
        if (selectedId) {
            if (!typingTimeoutRef.current) {
                socketService.emit('typing', { conversationId: selectedId, isTyping: true });
            } else {
                clearTimeout(typingTimeoutRef.current);
            }

            typingTimeoutRef.current = setTimeout(() => {
                socketService.emit('typing', { conversationId: selectedId, isTyping: false });
                typingTimeoutRef.current = null;
            }, 3000);
        }
    };

    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        setShowEmojiPicker(false);
        if (!newMessage.trim() || !selectedId) return;

        const text = newMessage.trim();
        setNewMessage('');

        // Stop typing indicator on send
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            socketService.emit('typing', { conversationId: selectedId, isTyping: false });
        }

        // Optimistic UI
        const tempId = Date.now().toString();
        const optimisticMsg = {
            id: tempId,
            conversationId: selectedId,
            senderId: currentUser.id,
            text,
            type: 'text',
            createdAt: new Date().toISOString(),
            sender: { id: currentUser.id, username: currentUser.username },
            repliedTo: replyingTo ? { ...replyingTo } : null
        };

        setMessages(prev => [...prev, optimisticMsg]);
        const currentReplyTo = replyingTo;
        setReplyingTo(null);

        try {
            await api.post(`/chat/conversations/${selectedId}/messages`, {
                text,
                replyToId: currentReplyTo?.id
            });
        } catch (error) {
            console.error('Error sending message:', error);
            // Optional: Revert optimistic update
        }
    };

    const handleOpenUserModal = () => {
        setIsUserModalOpen(true);
        fetchUsers();
    };

    const handleFileUpload = async (e, mode) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length === 0 || !selectedId) return;

        // If it's a single image, open the editor
        if (mode === 'image' && selectedFiles.length === 1) {
            const file = selectedFiles[0];
            const url = URL.createObjectURL(file);
            setEditingImage({ url, file });
            setIsEditorOpen(true);
            setEditorCaption('');
            setShowAttachmentMenu(false);
            return;
        }

        setIsUploading(true);
        setShowAttachmentMenu(false);
        const currentReplyToId = replyingTo?.id;
        setReplyingTo(null);

        // Upload files sequentially for better reliability and granular error handling
        for (const file of selectedFiles) {
            const formData = new FormData();
            formData.append('files', file);
            if (currentReplyToId) formData.append('replyToId', currentReplyToId);

            try {
                const res = await api.post(`/chat/conversations/${selectedId}/upload`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (res.data?.success && res.data?.data?.messages) {
                    setMessages(prev => {
                        const newIds = res.data.data.messages.map(m => m.id);
                        const filtered = prev.filter(m => !newIds.includes(m.id));
                        return [...filtered, ...res.data.data.messages];
                    });
                }
            } catch (err) {
                console.error(`Failed to upload file: ${file.name}`, err);
                alert(`Fehler beim Hochladen von: ${file.name}`);
            }
        }

        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (imageInputRef.current) imageInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const handleSendEditedImage = async () => {
        if (!canvasRef.current || !selectedId) return;

        setIsUploading(true);
        setIsEditorOpen(false);

        try {
            const targetId = targetForwardId || selectedId;
            const blob = await new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/jpeg', 0.9));
            const file = new File([blob], 'edited_image.jpg', { type: 'image/jpeg' });

            const formData = new FormData();
            formData.append('files', file);
            if (editorCaption) formData.append('caption', editorCaption);

            const res = await api.post(`/chat/conversations/${targetId}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data?.success && res.data?.data?.messages && targetId === selectedId) {
                setMessages(prev => {
                    const newIds = res.data.data.messages.map(m => m.id);
                    const filtered = prev.filter(m => !newIds.includes(m.id));
                    return [...filtered, ...res.data.data.messages];
                });
            }

            if (targetForwardId) {
                setSelectedId(targetForwardId);
                fetchConversations();
            }
        } catch (err) {
            console.error('Failed to send edited image:', err);
            alert('Fehler beim Senden des Bildes');
        } finally {
            setIsUploading(false);
            setEditingImage(null);
            setEditorCaption('');
            setTargetForwardId(null);
            setIsForwardingEdit(false);
            // Clear inputs
            if (imageInputRef.current) imageInputRef.current.value = '';
            if (cameraInputRef.current) cameraInputRef.current.value = '';
        }
    };

    const handleForwardClick = (msg) => {
        setForwardingMsg(msg);
        fetchUsers();
        setIsForwardModalOpen(true);
    };

    const handleForwardRecipientSelect = async (user) => {
        try {
            const res = await api.post('/chat/conversations/direct', { targetUserId: user.id });
            const conv = res.data.data.conversation;

            let msgsToForward = [];
            if (isSelectionMode) {
                msgsToForward = messages.filter(m => selectedMessageIds.includes(m.id));
            } else if (Array.isArray(forwardingMsg)) {
                msgsToForward = forwardingMsg;
            } else {
                msgsToForward = [forwardingMsg];
            }

            // If it's a single image, offer editing
            const isSingleImage = !isSelectionMode && !Array.isArray(forwardingMsg) && forwardingMsg?.type === 'image';
            
            if (isSingleImage && window.confirm('Möchten Sie dieses Bild vor dem Senden bearbeiten?')) {
                setTargetForwardId(conv.id);
                setIsForwardModalOpen(false);
                const url = getImageUrl(forwardingMsg.text);
                const response = await fetch(url);
                const blob = await response.blob();
                const file = new File([blob], 'forwarded_image.jpg', { type: 'image/jpeg' });
                setEditingImage({ url: URL.createObjectURL(blob), file });
                setEditorCaption(forwardingMsg.caption || '');
                setIsEditorOpen(true);
                setIsForwardingEdit(true);
                setIsGalleryOpen(false);
                return;
            }

            setIsForwardModalOpen(false);
            setIsUploading(true);

            for (const msg of msgsToForward) {
                if (msg.type === 'text') {
                    await api.post(`/chat/conversations/${conv.id}/messages`, { text: msg.text });
                } else {
                    try {
                        const url = getImageUrl(msg.text);
                        const response = await fetch(url);
                        const blob = await response.blob();
                        const fileName = msg.text.split('/').pop() || 'file';
                        const file = new File([blob], fileName, { type: blob.type });

                        const formData = new FormData();
                        formData.append('files', file);
                        if (msg.caption) formData.append('caption', msg.caption);

                        await api.post(`/chat/conversations/${conv.id}/upload`, formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                    } catch (fileErr) {
                        console.error('Failed to forward media:', fileErr);
                    }
                }
            }

            setIsUploading(false);
            setIsGalleryOpen(false);
            setIsSelectionMode(false);
            setSelectedMessageIds([]);
            setForwardingMsg(null);
            setSelectedId(conv.id);
            fetchConversations();
        } catch (err) {
            console.error('Forwarding failed:', err);
            alert('Fehler beim Weiterleiten');
            setIsUploading(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const activeConversation = conversations.find(c => c.id === selectedId);
    const displayMessages = useMemo(() => groupMessages(messages), [messages]);

    const filteredConversations = conversations.filter(c =>
        (c.name || '').toLowerCase().includes((searchQuery || '').toLowerCase())
    );

    const filteredUsers = allUsers.filter(u =>
        (u.name || '').toLowerCase().includes((modalSearchQuery || '').toLowerCase()) ||
        (u.role?.name && u.role.name.toLowerCase().includes((modalSearchQuery || '').toLowerCase()))
    );

    return (
        <div className="h-[calc(100vh-120px)] flex bg-[#1a1c23]/40 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl animate-[fadeIn_0.4s_ease-out]">
            {/* Conversations Sidebar */}
            <div className="w-full md:w-80 lg:w-96 border-r border-white/10 flex flex-col bg-white/5 relative">
                <div className="p-6 border-b border-white/10">
                    <h2 className="text-xl font-bold text-white mb-4">Nachrichten</h2>
                    <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                        <input
                            type="text"
                            placeholder="Chat suchen..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/20 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-light"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {isLoading ? (
                        <div className="p-8 text-center"><i className="fa-solid fa-circle-notch fa-spin text-blue-500"></i></div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            {searchQuery ? 'Keine Chats gefunden' : 'Keine Chats vorhanden'}
                        </div>
                    ) : (
                        filteredConversations.map((chat) => (
                            <div
                                key={chat.id}
                                onClick={() => setSelectedId(chat.id)}
                                className={`p-4 flex items-center gap-4 cursor-pointer transition-all border-b border-white/5 hover:bg-white/5 ${selectedId === chat.id ? 'bg-blue-600/20 border-r-4 border-r-blue-500' : ''}`}
                            >
                                <div className="relative shrink-0">
                                    <img src={chat.avatar} alt={chat.name} className="w-12 h-12 rounded-2xl border border-white/10 object-cover shadow-lg" />
                                    {chat.online && (
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#1e2235] rounded-full"></div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="text-sm font-semibold text-white truncate">{chat.name}</h3>
                                        <span className="text-[10px] text-gray-500 font-medium">{chat.time}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs text-gray-400 truncate pr-2 font-light">{chat.lastMessage}</p>
                                        {chat.unread > 0 && (
                                            <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[1.25rem] text-center shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                                                {chat.unread}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                        ))}
                </div>

                <button
                    onClick={handleOpenUserModal}
                    className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-20 border border-white/10"
                >
                    <i className="fa-solid fa-plus text-xl"></i>
                </button>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col relative overflow-hidden bg-gradient-to-br from-white/5 to-transparent">
                {activeConversation ? (
                    <>
                        <div className="p-4 bg-white/5 backdrop-blur-md border-b border-white/10 flex items-center justify-between z-10">
                            <div className="flex items-center gap-4">
                                <button className="md:hidden text-gray-400 hover:text-white mr-2">
                                    <i className="fa-solid fa-chevron-left"></i>
                                </button>
                                <img src={activeConversation.avatar} alt={activeConversation.name} className="w-10 h-10 rounded-xl border border-white/10 object-cover" />
                                <div className="flex flex-col">
                                    <h3 className="text-sm font-bold text-white">{activeConversation.name}</h3>
                                    {typingUsers[selectedId] && typingUsers[selectedId].length > 0 ? (
                                        <p className="text-[10px] text-blue-400 animate-pulse font-medium">
                                            Schreibt...
                                        </p>
                                    ) : (
                                        <p className="text-[10px] text-gray-500 font-medium">
                                            {formatLastSeen(activeConversation.lastSeenAt, activeConversation.online)}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {isSelectionMode ? (
                                    <>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mr-2">
                                            {selectedMessageIds.length} ausgewählt
                                        </div>
                                        {selectedMessageIds.length > 0 && (
                                            <>
                                                <button
                                                    onClick={handleBulkForward}
                                                    className="bg-blue-600/20 hover:bg-blue-600 text-blue-500 hover:text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border border-blue-500/20"
                                                >
                                                    Weiterleiten
                                                </button>
                                                {allSelectedAreOwn && (
                                                    <button
                                                        onClick={handleBulkDelete}
                                                        className="bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border border-red-500/20"
                                                    >
                                                        Löschen
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        <button
                                            onClick={() => {
                                                setIsSelectionMode(false);
                                                setSelectedMessageIds([]);
                                            }}
                                            className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border border-white/10"
                                        >
                                            Abbrechen
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => initiateCall('audio')}
                                            className="w-10 h-10 rounded-xl bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white transition-all flex items-center justify-center border border-green-500/20 shadow-lg shadow-green-500/10"
                                            title="Audio Anruf"
                                        >
                                            <i className="fa-solid fa-phone"></i>
                                        </button>
                                        <button
                                            onClick={() => initiateCall('video')}
                                            className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-500 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center border border-blue-500/20 shadow-lg shadow-blue-500/10"
                                            title="Video Anruf"
                                        >
                                            <i className="fa-solid fa-video"></i>
                                        </button>
                                        <button
                                            onClick={() => setIsSelectionMode(true)}
                                            className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border border-white/10"
                                        >
                                            Wählen
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {displayMessages.map((msg) => {
                                const isOwn = msg.senderId === currentUser?.id;
                                const isImageGroup = msg.type === 'image_group';
                                const isVideo = msg.type === 'video';
                                const isFile = msg.type === 'file';

                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex items-center gap-4 ${isOwn ? 'flex-row-reverse' : 'flex-row'} animate-[fadeInUp_0.3s_ease-out]`}
                                    >
                                            {isSelectionMode && (
                                                <div
                                                    onClick={() => toggleMessageSelection(msg.id)}
                                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${selectedMessageIds.includes(msg.id)
                                                            ? 'bg-blue-600 border-blue-600 animate-[bounce_0.2s]'
                                                            : 'border-white/20 hover:border-white/40'
                                                        }`}
                                                >
                                                    {selectedMessageIds.includes(msg.id) && <i className="fa-solid fa-check text-[8px] text-white"></i>}
                                                </div>
                                            )}

                                            <div
                                                className={`max-w-[75%] lg:max-w-[60%] flex flex-col min-w-0 ${isOwn ? 'items-end' : 'items-start'} ${isSelectionMode ? 'cursor-pointer' : ''
                                                    }`}
                                                onClick={() => isSelectionMode && toggleMessageSelection(msg.id)}
                                            >
                                                <div className="flex flex-col gap-1 w-full">
                                                    {msg.repliedTo && (
                                                        <div className={`text-[10px] flex items-center gap-2 mb-1 px-2 py-1 rounded-lg border-l-4 ${isOwn ? 'bg-white/5 border-white/30 text-white/50 self-end' : 'bg-blue-600/10 border-blue-600/50 text-blue-400 self-start'
                                                            }`}>
                                                            <i className="fa-solid fa-quote-left text-[8px]"></i>
                                                            <span className="truncate max-w-[150px]">
                                                                {msg.repliedTo.sender?.username}: {msg.repliedTo.type === 'text' ? msg.repliedTo.text : `[${msg.repliedTo.type}]`}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {isImageGroup ? (
                                                        <div className="flex flex-col gap-2 group/msg relative min-w-0 overflow-hidden rounded-xl">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                {isOwn && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteMessage(msg.id);
                                                                        }}
                                                                        className="opacity-0 group-hover/msg:opacity-100 p-2 text-white/30 hover:text-red-500 transition-colors order-first"
                                                                        title="Löschen"
                                                                    >
                                                                        <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => setReplyingTo(msg)}
                                                                    className={`opacity-0 group-hover/msg:opacity-100 p-2 text-white/30 hover:text-blue-400 transition-colors ${isOwn ? 'order-first' : ''}`}
                                                                    title="Antworten"
                                                                >
                                                                    <i className="fa-solid fa-reply text-[10px]"></i>
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setActiveReactionMenu(activeReactionMenu === msg.id ? null : msg.id);
                                                                    }}
                                                                    className={`opacity-0 group-hover/msg:opacity-100 p-2 text-white/30 hover:text-yellow-400 transition-colors ${isOwn ? 'order-first' : ''}`}
                                                                    title="Reagieren"
                                                                >
                                                                    <i className="fa-regular fa-face-smile text-[10px]"></i>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleForwardClick(msg.images)}
                                                                    className={`opacity-0 group-hover/msg:opacity-100 p-2 text-white/30 hover:text-green-400 transition-colors ${isOwn ? 'order-first' : ''}`}
                                                                    title="Weiterleiten"
                                                                >
                                                                    <i className="fa-solid fa-share text-[10px]"></i>
                                                                </button>
                                                                
                                                                <ImageGrid 
                                                                    images={msg.images} 
                                                                    isOwn={isOwn}
                                                                    onImageClick={(clickedId) => {
                                                                        const imageMessages = messages.filter(m => m.type === 'image');
                                                                        const index = imageMessages.findIndex(m => m.id === clickedId);
                                                                        setGalleryIndex(index >= 0 ? index : 0);
                                                                        setIsGalleryOpen(true);
                                                                    }}
                                                                />
                                                            </div>
                                                            {msg.caption && (
                                                                <div className={`px-4 py-2 rounded-2xl text-sm shadow-xl ${isOwn
                                                                        ? 'bg-blue-600/90 text-white rounded-tr-none border border-white/10 self-end'
                                                                        : 'bg-white/10 backdrop-blur-md text-white rounded-tl-none border border-white/5 self-start'
                                                                    }`}>
                                                                    {msg.caption}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : isVideo ? (
                                                    <div className="flex flex-col gap-2 group/msg relative min-w-0 overflow-hidden rounded-2xl">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            {isOwn && (
                                                                <button
                                                                    onClick={() => handleDeleteMessage(msg.id)}
                                                                    className="opacity-0 group-hover/msg:opacity-100 p-2 text-white/30 hover:text-red-500 transition-colors order-first"
                                                                    title="Löschen"
                                                                >
                                                                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => setReplyingTo(msg)}
                                                                className={`opacity-0 group-hover/msg:opacity-100 p-2 text-white/30 hover:text-blue-400 transition-colors ${isOwn ? 'order-first' : ''}`}
                                                                title="Antworten"
                                                            >
                                                                <i className="fa-solid fa-reply text-[10px]"></i>
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setActiveReactionMenu(activeReactionMenu === msg.id ? null : msg.id);
                                                                }}
                                                                className={`opacity-0 group-hover/msg:opacity-100 p-2 text-white/30 hover:text-yellow-400 transition-colors ${isOwn ? 'order-first' : ''}`}
                                                                title="Reagieren"
                                                            >
                                                                <i className="fa-regular fa-face-smile text-[10px]"></i>
                                                            </button>
                                                            <video
                                                                src={getImageUrl(msg.text)}
                                                                controls
                                                                className="max-w-full rounded-2xl border border-white/10 shadow-2xl"
                                                            />
                                                        </div>
                                                        {msg.caption && (
                                                            <div className={`px-4 py-2 rounded-2xl text-sm shadow-xl ${isOwn
                                                                    ? 'bg-blue-600/90 text-white rounded-tr-none border border-white/10 self-end'
                                                                    : 'bg-white/10 backdrop-blur-md text-white rounded-tl-none border border-white/5 self-start'
                                                                }`}>
                                                                {msg.caption}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : msg.type === 'voice' ? (
                                                    <div className="group/msg relative flex items-center gap-2 min-w-0">
                                                        {isOwn && (
                                                            <button
                                                                onClick={() => handleDeleteMessage(msg.id)}
                                                                className="opacity-0 group-hover/msg:opacity-100 p-2 text-white/30 hover:text-red-500 transition-colors order-first"
                                                                title="Löschen"
                                                            >
                                                                <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setReplyingTo(msg)}
                                                            className={`opacity-0 group-hover/msg:opacity-100 p-2 text-white/30 hover:text-blue-400 transition-colors ${isOwn ? 'order-first' : ''}`}
                                                            title="Antworten"
                                                        >
                                                            <i className="fa-solid fa-reply text-[10px]"></i>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setActiveReactionMenu(activeReactionMenu === msg.id ? null : msg.id);
                                                            }}
                                                            className={`opacity-0 group-hover/msg:opacity-100 p-2 text-white/30 hover:text-yellow-400 transition-colors ${isOwn ? 'order-first' : ''}`}
                                                            title="Reagieren"
                                                        >
                                                            <i className="fa-regular fa-face-smile text-[10px]"></i>
                                                        </button>
                                                        <AudioMessage src={getImageUrl(msg.text)} isOwn={isOwn} />
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 group/msg-outer">
                                                        {isOwn && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteMessage(msg.id);
                                                                }}
                                                                className="opacity-0 group-hover/msg-outer:opacity-100 p-1.5 text-white/30 hover:text-red-500 transition-colors"
                                                                title="Löschen"
                                                            >
                                                                <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setReplyingTo(msg);
                                                            }}
                                                            className={`opacity-0 group-hover/msg-outer:opacity-100 p-1.5 text-white/30 hover:text-blue-400 transition-colors ${isOwn ? 'order-first' : ''}`}
                                                            title="Antworten"
                                                        >
                                                            <i className="fa-solid fa-reply text-[10px]"></i>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setActiveReactionMenu(activeReactionMenu === msg.id ? null : msg.id);
                                                            }}
                                                            className={`opacity-0 group-hover/msg-outer:opacity-100 p-1.5 text-white/30 hover:text-yellow-400 transition-colors ${isOwn ? 'order-first' : ''}`}
                                                            title="Reagieren"
                                                        >
                                                            <i className="fa-regular fa-face-smile text-[10px]"></i>
                                                        </button>
                                                        <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-xl min-w-0 overflow-hidden ${isOwn
                                                                ? 'bg-blue-600/90 text-white rounded-tr-none border border-white/10'
                                                                : 'bg-white/10 backdrop-blur-md text-white rounded-tl-none border border-white/5'
                                                            }`}>
                                                            {isFile ? (
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                                                        <i className="fa-solid fa-file-lines text-blue-400"></i>
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="font-medium truncate">{msg.caption || msg.text.split('/').pop()}</p>
                                                                        <button
                                                                            onClick={() => handleDownload(getImageUrl(msg.text), msg.caption || msg.text.split('/').pop())}
                                                                            className="text-[10px] text-blue-400 hover:underline"
                                                                        >
                                                                            Herunterladen
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                msg.text
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Reaction Menu Popover */}
                                                {activeReactionMenu === msg.id && (
                                                    <div className={`absolute z-30 bottom-full mb-2 bg-white/10 backdrop-blur-3xl p-1.5 rounded-full border border-white/10 flex gap-1 shadow-2xl animate-[fadeIn_0.2s_ease-out] ${isOwn ? 'right-0' : 'left-0'}`}>
                                                        {reactionsList.map(emoji => (
                                                            <button
                                                                key={emoji}
                                                                onClick={() => handleToggleReaction(msg.id, emoji)}
                                                                className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-all text-lg hover:scale-125"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Rendered Reactions */}
                                                {msg.reactions && (
                                                    <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                                        {(() => {
                                                            let reactions = msg.reactions;
                                                            try {
                                                                if (typeof reactions === 'string') reactions = JSON.parse(reactions);
                                                            } catch (e) { reactions = {}; }

                                                            if (!reactions || Array.isArray(reactions) || typeof reactions !== 'object') return null;

                                                            return Object.entries(
                                                                Object.entries(reactions).reduce((acc, [uid, emoji]) => {
                                                                    acc[emoji] = (acc[emoji] || 0) + 1;
                                                                    return acc;
                                                                }, {})
                                                            ).map(([emoji, count]) => {
                                                                const hasReacted = reactions[currentUser.id] === emoji;
                                                                return (
                                                                    <button
                                                                        key={emoji}
                                                                        onClick={() => handleToggleReaction(msg.id, emoji)}
                                                                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] backdrop-blur-md transition-all ${hasReacted
                                                                                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
                                                                                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                                                                            }`}
                                                                    >
                                                                        <span>{emoji}</span>
                                                                        {count > 1 && <span className="font-bold">{count}</span>}
                                                                    </button>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1.5 px-1">
                                                <span className="text-[10px] text-gray-500 font-medium">
                                                    {new Date(msg.createdAt).toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' })}, {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {isOwn && (
                                                    <div className="flex items-center ml-1">
                                                        {msg.isRead ? (
                                                            <i className="fa-solid fa-check-double text-[10px] text-blue-400"></i>
                                                        ) : (
                                                            <i className="fa-solid fa-check text-[10px] text-gray-500"></i>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className={`p-6 bg-white/5 backdrop-blur-xl border-t border-white/10 relative ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                            {/* Reply Preview */}
                            {replyingTo && (
                                <div className="absolute top-[-70px] left-4 right-4 bg-white/10 backdrop-blur-2xl p-3 rounded-2xl border border-white/10 flex items-center gap-3 animate-[fadeInDown_0.2s_ease-out]">
                                    <div className="w-1 h-full bg-blue-500 rounded-full" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] text-blue-400 font-bold mb-0.5">{replyingTo.sender?.username}</p>
                                        <p className="text-xs text-white/60 truncate">
                                            {replyingTo.type === 'text' ? replyingTo.text : `[${replyingTo.type}]`}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setReplyingTo(null)}
                                        className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                                    >
                                        <i className="fa-solid fa-xmark text-xs"></i>
                                    </button>
                                </div>
                            )}

                            <div className="flex items-center gap-4">
                                <div className="relative" ref={attachmentMenuRef}>
                                    <button
                                        type="button"
                                        onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                                        className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${showAttachmentMenu ? 'bg-blue-600 text-white rotate-45' : 'bg-gray-800 text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        <i className="fa-solid fa-plus text-lg"></i>
                                    </button>

                                    {showAttachmentMenu && (
                                        <div className="absolute bottom-16 left-0 w-56 bg-[#1a1c23]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 shadow-2xl animate-[slideUp_0.2s_ease-out] z-[60]">
                                            <button
                                                onClick={() => imageInputRef.current?.click()}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-all text-sm"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-500">
                                                    <i className="fa-solid fa-image"></i>
                                                </div>
                                                Galerie
                                            </button>
                                            <button
                                                onClick={() => cameraInputRef.current?.click()}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-all text-sm"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-500">
                                                    <i className="fa-solid fa-camera"></i>
                                                </div>
                                                Kamera
                                            </button>
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-all text-sm"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-500">
                                                    <i className="fa-solid fa-file-pdf"></i>
                                                </div>
                                                Dokument
                                            </button>
                                        </div>
                                    )}

                                    {/* Hidden Inputs */}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        multiple
                                        className="hidden"
                                        onChange={(e) => handleFileUpload(e, 'file')}
                                    />
                                    <input
                                        type="file"
                                        ref={imageInputRef}
                                        accept="image/*,video/*"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => handleFileUpload(e, 'image')}
                                    />
                                    <input
                                        type="file"
                                        ref={cameraInputRef}
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        onChange={(e) => handleFileUpload(e, 'image')}
                                    />
                                </div>

                                <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-4 relative">
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className="w-12 h-12 rounded-2xl bg-white/5 text-yellow-400 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all border border-white/5"
                                            title="Emoji"
                                        >
                                            <i className="fa-regular fa-face-smile text-lg"></i>
                                        </button>
                                        
                                        {showEmojiPicker && (
                                            <div className="absolute bottom-16 left-0 z-[100] shadow-2xl rounded-2xl overflow-hidden border border-white/10 animate-[slideUp_0.2s_ease-out]">
                                                <EmojiPicker
                                                    onEmojiClick={onEmojiClick}
                                                    theme="dark"
                                                    previewConfig={{ showPreview: false }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={handleInputChange}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(e)}
                                        placeholder="Nachricht schreiben..."
                                        className="flex-1 bg-black/30 border border-white/10 rounded-2xl py-3 px-6 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-light"
                                    />
                                    <button
                                        onClick={() => handleSendMessage()}
                                        disabled={!newMessage.trim() && !isUploading}
                                        className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:scale-100"
                                    >
                                        <i className="fa-solid fa-paper-plane text-lg"></i>
                                    </button>

                                    {/* Voice Toggle Button */}
                                    {!newMessage.trim() && (
                                        <button
                                            onMouseDown={startRecording}
                                            onMouseUp={() => stopRecording()}
                                            onMouseMove={handleRecordingMove}
                                            onTouchStart={startRecording}
                                            onTouchEnd={() => stopRecording()}
                                            onTouchMove={handleRecordingMove}
                                            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90 ${isRecording
                                                    ? 'bg-red-600 text-white animate-pulse'
                                                    : 'bg-white/10 text-white hover:bg-white/20'
                                                }`}
                                            title="Halten zum Aufnehmen, Wischen zum Abbrechen"
                                        >
                                            <i className={`fa-solid ${isRecording ? 'fa-microphone-lines' : 'fa-microphone'} text-lg`}></i>
                                        </button>
                                    )}
                                </form>
                            </div>

                            {/* Recording Overlay Info */}
                            {isRecording && (
                                <div
                                    className={`absolute top-[-70px] left-1/2 bg-red-600/90 backdrop-blur-xl px-10 py-3 rounded-full flex items-center gap-6 text-white shadow-2xl border border-white/20 transition-all duration-75 z-50 ${isRecordingCancelled ? 'scale-110 bg-red-500 shadow-red-500/50' : ''
                                        }`}
                                    style={{
                                        transform: `translateX(calc(-50% - ${recordingOffset}px))`,
                                        opacity: isRecordingCancelled ? 0.3 : 1
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2.5 h-2.5 rounded-full ${isRecordingCancelled ? 'bg-gray-400' : 'bg-white animate-ping'}`} />
                                        <span className="font-mono text-lg font-bold tracking-widest">{formatRecordingTime(recordingTime)}</span>
                                    </div>

                                    <div className={`flex items-center gap-2 text-xs font-medium transition-opacity ${recordingOffset > 20 ? 'opacity-100' : 'opacity-40'}`}>
                                        <i className="fa-solid fa-chevron-left animate-pulse"></i>
                                        <span>{isRecordingCancelled ? 'Loslassen zum Löschen' : 'Wischen zum Abbrechen'}</span>
                                    </div>

                                    <button
                                        type="button"
                                        onMouseUp={(e) => { e.stopPropagation(); stopRecording(true); }}
                                        onTouchEnd={(e) => { e.stopPropagation(); stopRecording(true); }}
                                        className="ml-2 p-2 hover:bg-white/20 rounded-full transition-colors bg-white/5"
                                    >
                                        <i className="fa-solid fa-trash-can text-sm"></i>
                                    </button>
                                </div>
                            )}

                            {isUploading && (
                                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/20">
                                    <div className="h-full bg-blue-500 animate-[loading_1.5s_infinite]"></div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
                        <i className="fa-regular fa-comments text-4xl text-blue-400 mb-6"></i>
                        <h3 className="text-xl font-bold text-white mb-2">Deine Nachrichten</h3>
                        <p className="text-sm text-gray-400 max-w-xs font-light">Wähle eine Unterhaltung aus oder starte einen neuen Chat.</p>
                    </div>
                )}
            </div>

            {/* User Selection Modal */}
            {isUserModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsUserModalOpen(false)}></div>
                    <div className="w-full max-w-md bg-[#1a1c23]/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl animate-[slideUp_0.3s_ease-out] overflow-hidden relative z-10">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h2 className="text-xl font-bold text-white">Neuer Chat</h2>
                            <button onClick={() => setIsUserModalOpen(false)} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div className="p-6 pb-0 space-y-4">
                            {selectedUserIds.length > 1 && (
                                <div className="animate-[fadeIn_0.3s_ease-out]">
                                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 block">Gruppenname</label>
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        placeholder="Name der Gruppe..."
                                        className="w-full bg-black/30 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-light"
                                    />
                                </div>
                            )}
                            <div className="relative">
                                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                <input
                                    type="text"
                                    value={modalSearchQuery}
                                    onChange={(e) => setModalSearchQuery(e.target.value)}
                                    placeholder="Benutzer suchen..."
                                    className="w-full bg-black/30 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-light"
                                />
                            </div>
                        </div>

                        <div className="p-6 h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {isLoadingUsers ? (
                                <div className="h-full flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-blue-500"></i></div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-40"><p className="text-sm">Keine Benutzer gefunden</p></div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredUsers.map(u => {
                                        const isSelected = selectedUserIds.includes(u.id);
                                        return (
                                            <div
                                                key={u.id}
                                                onClick={() => handleUserToggle(u.id)}
                                                className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border ${isSelected ? 'bg-blue-600/10 border-blue-500/30' : 'hover:bg-white/5 border-transparent hover:border-white/10'
                                                    }`}
                                            >
                                                <div className="relative">
                                                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random&color=fff`} className="w-10 h-10 rounded-xl object-cover" alt={u.name} />
                                                    {isSelected && (
                                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center border-2 border-[#1a1c23]">
                                                            <i className="fa-solid fa-check text-[8px] text-white"></i>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-bold text-white truncate">{u.name}</h4>
                                                    <p className="text-[10px] text-gray-500 font-medium">{u.role?.name || 'Benutzer'}</p>
                                                </div>
                                                <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-white/10'
                                                    }`}>
                                                    {isSelected && <i className="fa-solid fa-check text-[8px] text-white"></i>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-white/10 bg-white/5">
                            <button
                                onClick={handleStartChat}
                                disabled={selectedUserIds.length === 0 || (selectedUserIds.length > 1 && !newGroupName.trim())}
                                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 disabled:opacity-50 disabled:scale-100 active:scale-95 transition-all shadow-xl shadow-blue-500/20"
                            >
                                {selectedUserIds.length > 1 ? 'Gruppe erstellen' : 'Chat starten'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Editor Modal */}
            {isEditorOpen && editingImage && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <div className="w-full max-w-4xl flex flex-col h-[90vh]">
                        <div className="flex items-center justify-between p-4 border-b border-white/10 text-white">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setIsEditorOpen(false)} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center">
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                                <h2 className="text-lg font-bold">Bild bearbeiten</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setEditorMode(editorMode === 'draw' ? 'none' : 'draw')}
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${editorMode === 'draw' ? 'bg-blue-600' : 'bg-white/5'}`}
                                    title="Zeichnen"
                                >
                                    <i className="fa-solid fa-pencil"></i>
                                </button>
                                <button
                                    onClick={() => setEditorMode(editorMode === 'crop' ? 'none' : 'crop')}
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${editorMode === 'crop' ? 'bg-blue-600' : 'bg-white/5'}`}
                                    title="Zuschneiden"
                                >
                                    <i className="fa-solid fa-crop-simple"></i>
                                </button>
                                {editorMode === 'crop' && cropStart && cropEnd && (
                                    <button
                                        onClick={() => {
                                            const canvas = canvasRef.current;
                                            const ctx = canvas.getContext('2d');
                                            const width = Math.abs(cropEnd.x - cropStart.x);
                                            const height = Math.abs(cropEnd.y - cropStart.y);
                                            const x = Math.min(cropStart.x, cropEnd.x);
                                            const y = Math.min(cropStart.y, cropEnd.y);

                                            const tempCanvas = document.createElement('canvas');
                                            tempCanvas.width = width;
                                            tempCanvas.height = height;
                                            tempCanvas.getContext('2d').drawImage(canvas, x, y, width, height, 0, 0, width, height);

                                            canvas.width = width;
                                            canvas.height = height;
                                            ctx.drawImage(tempCanvas, 0, 0);
                                            setCropStart(null);
                                            setCropEnd(null);
                                            setEditorMode('none');
                                        }}
                                        className="px-3 h-10 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                                    >
                                        Anwenden
                                    </button>
                                )}
                                <div className="flex items-center gap-1.5 ml-2 border-l border-white/10 pl-4">
                                    {['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#ffffff'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setPencilColor(color)}
                                            className={`w-6 h-6 rounded-full border-2 transition-all ${pencilColor === color ? 'border-white scale-125' : 'border-transparent'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 relative bg-black/20 overflow-hidden flex items-center justify-center p-4">
                            <canvas
                                ref={canvasRef}
                                className={`max-w-full max-h-full object-contain ${editorMode === 'draw' ? 'cursor-crosshair' : ''}`}
                                onMouseDown={(e) => {
                                    const canvas = canvasRef.current;
                                    const rect = canvas.getBoundingClientRect();
                                    const scaleX = canvas.width / rect.width;
                                    const scaleY = canvas.height / rect.height;
                                    const x = (e.clientX - rect.left) * scaleX;
                                    const y = (e.clientY - rect.top) * scaleY;

                                    if (editorMode === 'draw') {
                                        const ctx = canvas.getContext('2d');
                                        ctx.beginPath();
                                        ctx.moveTo(x, y);
                                        canvas.isDrawing = true;
                                    } else if (editorMode === 'crop') {
                                        setCropStart({ x, y });
                                        setCropEnd({ x, y });
                                        canvas.isCropping = true;
                                    }
                                }}
                                onMouseMove={(e) => {
                                    const canvas = canvasRef.current;
                                    const rect = canvas.getBoundingClientRect();
                                    const scaleX = canvas.width / rect.width;
                                    const scaleY = canvas.height / rect.height;
                                    const x = (e.clientX - rect.left) * scaleX;
                                    const y = (e.clientY - rect.top) * scaleY;

                                    if (editorMode === 'draw' && canvas.isDrawing) {
                                        const ctx = canvas.getContext('2d');
                                        ctx.lineTo(x, y);
                                        ctx.strokeStyle = pencilColor;
                                        ctx.lineWidth = 5;
                                        ctx.lineCap = 'round';
                                        ctx.stroke();
                                    } else if (editorMode === 'crop' && canvas.isCropping) {
                                        setCropEnd({ x, y });
                                    }
                                }}
                                onMouseUp={() => {
                                    const canvas = canvasRef.current;
                                    canvas.isDrawing = false;
                                    canvas.isCropping = false;
                                }}
                            />
                            {editorMode === 'crop' && cropStart && cropEnd && (
                                <div
                                    className="absolute border-2 border-white border-dashed bg-white/10 pointer-events-none"
                                    style={{
                                        left: `calc(50% + ${(Math.min(cropStart.x, cropEnd.x) - canvasRef.current.width / 2) * (canvasRef.current.getBoundingClientRect().width / canvasRef.current.width)}px)`,
                                        top: `calc(50% + ${(Math.min(cropStart.y, cropEnd.y) - canvasRef.current.height / 2) * (canvasRef.current.getBoundingClientRect().height / canvasRef.current.height)}px)`,
                                        width: `${Math.abs(cropEnd.x - cropStart.x) * (canvasRef.current.getBoundingClientRect().width / canvasRef.current.width)}px`,
                                        height: `${Math.abs(cropEnd.y - cropStart.y) * (canvasRef.current.getBoundingClientRect().height / canvasRef.current.height)}px`
                                    }}
                                />
                            )}
                        </div>

                        <div className="p-6 bg-[#1a1c23] border-t border-white/10 space-y-4">
                            <input
                                type="text"
                                value={editorCaption}
                                onChange={(e) => setEditorCaption(e.target.value)}
                                placeholder="Eine Bildunterschrift hinzufügen..."
                                className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                            />
                            <div className="flex justify-end gap-4">
                                <button onClick={() => setIsEditorOpen(false)} className="px-6 py-3 rounded-2xl bg-white/5 text-white hover:bg-white/10 transition-all">Abbrechen</button>
                                <button onClick={handleSendEditedImage} className="px-8 py-3 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all flex items-center gap-2">
                                    Senden <i className="fa-solid fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Gallery Modal */}
            {isGalleryOpen && (
                <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex items-center justify-between p-4 text-white z-10">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setIsGalleryOpen(false)} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                            <div>
                                <h3 className="font-bold">Galerie</h3>
                                <p className="text-xs text-gray-400">{galleryIndex + 1} von {messages.filter(m => m.type === 'image').length}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    const current = messages.filter(m => m.type === 'image')[galleryIndex];
                                    handleDownload(getImageUrl(current.text), `chat_image_${current.id}.jpg`);
                                }}
                                className="w-11 h-11 bg-white/10 text-white rounded-xl flex items-center justify-center hover:bg-white/20 transition-all"
                                title="Herunterladen"
                            >
                                <i className="fa-solid fa-download"></i>
                            </button>
                            <button
                                onClick={() => handleForwardClick(messages.filter(m => m.type === 'image')[galleryIndex])}
                                className="px-5 h-11 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                            >
                                <i className="fa-solid fa-share"></i> Weiterleiten
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 relative flex items-center justify-center p-4 group">
                        {messages.filter(m => m.type === 'image').length > 1 && (
                            <>
                                <button
                                    onClick={() => setGalleryIndex(prev => Math.max(0, prev - 1))}
                                    className="absolute left-6 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 z-10 disabled:opacity-20"
                                    disabled={galleryIndex === 0}
                                >
                                    <i className="fa-solid fa-chevron-left"></i>
                                </button>
                                <button
                                    onClick={() => setGalleryIndex(prev => Math.min(messages.filter(m => m.type === 'image').length - 1, prev + 1))}
                                    className="absolute right-6 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 z-10 disabled:opacity-20"
                                    disabled={galleryIndex === messages.filter(m => m.type === 'image').length - 1}
                                >
                                    <i className="fa-solid fa-chevron-right"></i>
                                </button>
                            </>
                        )}

                        {(() => {
                            const imageMessages = messages.filter(m => m.type === 'image');
                            const currentMsg = imageMessages[galleryIndex];
                            return (
                                <div className="flex flex-col items-center max-w-full max-h-full">
                                    <img
                                        src={getImageUrl(currentMsg.text)}
                                        alt="Gallery"
                                        className="max-w-full max-h-[70vh] object-contain shadow-2xl rounded-sm"
                                    />
                                    {currentMsg.caption && (
                                        <div className="mt-8 bg-black/40 backdrop-blur-md p-4 px-8 rounded-2xl border border-white/5 text-white max-w-2xl text-center">
                                            {currentMsg.caption}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Logic to load image into canvas when editor opens */}
            {isEditorOpen && editingImage && (
                <img
                    src={editingImage.url}
                    className="hidden"
                    onLoad={(e) => {
                        const img = e.target;
                        const canvas = canvasRef.current;
                        if (!canvas) return;
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                    }}
                />
            )}

            {/* Forward Selection Modal */}
            {isForwardModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsForwardModalOpen(false)}></div>
                    <div className="w-full max-w-md bg-[#1a1c23]/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl animate-[slideUp_0.3s_ease-out] overflow-hidden relative z-10">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h2 className="text-xl font-bold text-white">Weiterleiten an...</h2>
                            <button onClick={() => setIsForwardModalOpen(false)} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div className="p-6 pb-0">
                            <div className="relative">
                                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                <input
                                    type="text"
                                    value={modalSearchQuery}
                                    onChange={(e) => setModalSearchQuery(e.target.value)}
                                    placeholder="Benutzer suchen..."
                                    className="w-full bg-black/30 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-light"
                                />
                            </div>
                        </div>

                        <div className="p-6 h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {isLoadingUsers ? (
                                <div className="h-full flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-blue-500"></i></div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-40"><p className="text-sm">Keine Benutzer gefunden</p></div>
                            ) : (
                                <div className="space-y-4">
                                    {filteredUsers.map(u => (
                                        <div
                                            key={u.id}
                                            onClick={() => handleForwardRecipientSelect(u)}
                                            className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 cursor-pointer transition-all border border-transparent hover:border-white/10"
                                        >
                                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random&color=fff`} className="w-12 h-12 rounded-xl object-cover" alt={u.name} />
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-white truncate">{u.name}</h4>
                                                <p className="text-[10px] text-gray-500 font-medium">{u.role?.name || 'Benutzer'}</p>
                                            </div>
                                            <i className="fa-solid fa-paper-plane text-gray-600"></i>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Active Call Overlay */}
            {activeCall && (
                <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center">
                    <div className="absolute top-8 left-8 flex items-center gap-4 z-20">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(activeCall.otherUser?.username)}&background=random&color=fff`} className="w-16 h-16 rounded-2xl border-2 border-white/20 shadow-2xl" />
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">{activeCall.otherUser?.username}</h2>
                            <p className={`text-blue-400 font-medium ${activeCall.status === 'calling' ? 'animate-pulse' : ''}`}>
                                {activeCall.status === 'calling' ? 'Wählt...' : 'Im Gespräch'}
                            </p>
                        </div>
                    </div>

                    {/* Video Elements */}
                    <div className="relative w-full h-full flex items-center justify-center p-8">
                        {/* Always render remote video to ensure stream plays, hide if audio only */}
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            onClick={(e) => {
                                // Fallback click to play if browser blocks autoplay
                                e.target.play().catch(console.error);
                            }}
                            className={`${activeCall.type === 'video' ? 'w-full h-full object-cover rounded-3xl' : 'hidden'}`}
                        />

                        {activeCall.type === 'video' ? (
                            <div className="absolute bottom-32 right-12 w-48 aspect-video rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-10 transition-transform hover:scale-105 active:scale-95 cursor-grab">
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                />
                                {isVideoOff && (
                                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                                        <i className="fa-solid fa-video-slash text-white/40 text-2xl"></i>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-8">
                                <div className="relative">
                                    {activeCall.status === 'calling' && (
                                        <div className="absolute inset-[-20px] bg-blue-500/20 rounded-full animate-ping"></div>
                                    )}
                                    <img 
                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(activeCall.otherUser?.username)}&background=random&color=fff&size=256`} 
                                        className="w-48 h-48 rounded-full border-4 border-white/10 shadow-2xl relative z-10" 
                                    />
                                </div>
                                <div className="flex items-center gap-4 px-6 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                                    <div className={`w-2 h-2 bg-green-500 rounded-full ${activeCall.status === 'calling' ? 'animate-pulse' : ''}`}></div>
                                    <span className="text-white/60 font-mono text-xl tabular-nums">
                                        {Math.floor(callDuration / 60).toString().padStart(2, '0')}:{(callDuration % 60).toString().padStart(2, '0')}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Call Controls */}
                    <div className="absolute bottom-12 left-0 right-0 flex items-center justify-center gap-6 z-20">
                        <button
                            onClick={toggleMute}
                            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all border ${isMuted ? 'bg-red-600/20 text-red-500 border-red-500/50' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                        >
                            <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-xl`}></i>
                        </button>
                        
                        {activeCall.type === 'video' && (
                            <button
                                onClick={toggleVideo}
                                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all border ${isVideoOff ? 'bg-red-600/20 text-red-500 border-red-500/50' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                            >
                                <i className={`fa-solid ${isVideoOff ? 'fa-video-slash' : 'fa-video'} text-xl`}></i>
                            </button>
                        )}

                        <button
                            onClick={endCall}
                            className="w-20 h-20 rounded-3xl bg-red-600 text-white shadow-2xl shadow-red-600/40 flex items-center justify-center hover:scale-110 active:scale-90 transition-all"
                        >
                            <i className="fa-solid fa-phone-slash text-2xl rotate-[135deg]"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* Incoming Call Modal */}
            {incomingCall && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
                    <div className="w-full max-w-sm bg-[#1a1c23]/90 border border-white/10 rounded-[3rem] p-10 flex flex-col items-center text-center shadow-2xl animate-[fadeInDown_0.3s_ease-out] relative z-10">
                        <div className="relative mb-8">
                            <div className="absolute inset-[-15px] bg-blue-500/20 rounded-full animate-ping"></div>
                            <img 
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(incomingCall.callerName)}&background=random&color=fff&size=128`} 
                                className="w-24 h-24 rounded-[2rem] border-2 border-white/20 shadow-2xl relative z-10" 
                            />
                        </div>
                        
                        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">{incomingCall.callerName}</h2>
                        <p className="text-blue-400 font-medium mb-12 flex items-center gap-2">
                           <i className={`fa-solid ${incomingCall.type === 'video' ? 'fa-video' : 'fa-phone'} text-xs`}></i>
                           Eingehender {incomingCall.type === 'video' ? 'Video' : 'Audio'} Anruf
                        </p>

                        <div className="flex items-center gap-6 w-full">
                            <button
                                onClick={declineCall}
                                className="flex-1 h-16 rounded-2xl bg-red-600/20 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all group"
                            >
                                <i className="fa-solid fa-xmark text-xl"></i>
                            </button>
                            <button
                                onClick={answerCall}
                                className="flex-[2] h-16 rounded-2xl bg-green-600 text-white shadow-2xl shadow-green-600/40 flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all text-lg font-bold"
                            >
                                <i className="fa-solid fa-phone animate-bounce"></i>
                                Annehmen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default Chat;
