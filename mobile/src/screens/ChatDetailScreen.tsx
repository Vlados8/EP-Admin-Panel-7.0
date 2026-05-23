import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Image, SafeAreaView, Alert, PanResponder, Animated, Modal, Linking, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Send, ArrowLeft, Image as ImageIcon, Mic, X, Square, File as FileIcon, Copy, CheckSquare, Share2, ChevronDown, Edit2, Phone, Video, Mail } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AudioPlayer from '../components/AudioPlayer';
import { apiClient, serverDomain } from '../api/client';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socket';

const SwipeableMessage = ({ children, onSwipeReply }: { children: React.ReactNode, onSwipeReply: () => void }) => {
    const pan = useRef(new Animated.ValueXY()).current;
    
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
                return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onPanResponderTerminationRequest: () => false,
            onPanResponderMove: (evt, gestureState) => {
                if (Math.abs(gestureState.dx) < 60) {
                    pan.setValue({ x: gestureState.dx, y: 0 });
                }
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (Math.abs(gestureState.dx) > 30) {
                    onSwipeReply();
                }
                Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
            },
            onPanResponderTerminate: () => {
                Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
            }
        })
    ).current;

    return (
        <Animated.View style={{ width: '100%', transform: [{ translateX: pan.x }] }} {...panResponder.panHandlers}>
            {children}
        </Animated.View>
    );
};

export default function ChatDetailScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const params = (route.params as any) || {};
    const { conversationId, name, avatar, isGroup, otherUser, isOnline, participants } = params;
    const { user } = useAuth();
    
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState<any[]>([]);
    const [isForwardModalVisible, setIsForwardModalVisible] = useState(false);
    const [allConversations, setAllConversations] = useState<any[]>([]);
    const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
    const [isGroupProfileModalVisible, setIsGroupProfileModalVisible] = useState(false);
    const [selectedParticipantUser, setSelectedParticipantUser] = useState<any>(null);

    const getInitials = (fullName: string) => {
        if (!fullName) return 'U';
        const parts = fullName.trim().split(' ');
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return parts[0][0].toUpperCase();
    };

    const getStatusText = () => {
        if (isGroup) return 'Gruppe';
        if (isOnline) return 'Online';
        if (otherUser?.last_seen_at) {
            const timeStr = new Date(otherUser.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `Zuletzt online: ${timeStr}`;
        }
        return 'Offline';
    };
    
    // We use refs for recording to avoid stale closures inside PanResponder
    const recordingRef = useRef<any>(null);
    const isPreparingRecordingRef = useRef(false);
    
    const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'locked' | 'cancelled'>('idle');
    const recordingStateRef = useRef(recordingState);
    
    const setRecState = (state: 'idle' | 'recording' | 'locked' | 'cancelled') => {
        recordingStateRef.current = state;
        setRecordingState(state);
    };

    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const [previewAsset, setPreviewAsset] = useState<{uri: string, mimeType: string, name?: string} | null>(null);
    const [previewCaption, setPreviewCaption] = useState('');
    
    const pan = useRef(new Animated.ValueXY()).current;

    const fetchMessages = async () => {
        try {
            const res = await apiClient.get(`/chat/conversations/${conversationId}/messages`);
            setMessages(res.data.data.messages);
        } catch (err) {
            console.error('Error fetching messages:', err);
        }
    };

    const leaveGroup = async () => {
        Alert.alert(
            'Gruppe verlassen',
            'Bist du sicher, dass du diese Gruppe verlassen möchtest? Du wirst keine weiteren Nachrichten erhalten.',
            [
                { text: 'Abbrechen', style: 'cancel' },
                { 
                    text: 'Verlassen', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiClient.delete(`/chat/conversations/${conversationId}/leave`);
                            setIsGroupProfileModalVisible(false);
                            navigation.goBack();
                        } catch (err) {
                            console.error('Error leaving group:', err);
                            Alert.alert('Fehler', 'Konnte die Gruppe nicht verlassen.');
                        }
                    }
                }
            ]
        );
    };

    const markAsRead = async () => {
        try {
            await apiClient.patch(`/chat/conversations/${conversationId}/read`);
        } catch (err) {
            // ignore
        }
    };

    useEffect(() => {
        fetchMessages();
        markAsRead();

        socketService.emit('join_conversation', conversationId);

        const handleNewMessage = (data: any) => {
            const { conversationId: msgConvId, message } = data;
            if (msgConvId === conversationId) {
                setMessages(prev => {
                    if (prev.some(m => String(m.id) === String(message.id))) return prev;
                    return [...prev, message];
                });
                markAsRead();
            }
        };

        const handleMessagesRead = ({ conversationId: msgConvId, readerId }: any) => {
            if (msgConvId === conversationId && readerId !== user?.id) {
                setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
            }
        };

        const handleTyping = ({ conversationId: msgConvId, userId, isTyping: typing }: any) => {
            if (msgConvId === conversationId && userId !== user?.id) {
                setIsTyping(typing);
            }
        };

        const handleMessageDeleted = ({ messageId }: any) => {
            setMessages(prev => prev.filter(m => String(m.id) !== String(messageId)));
        };

        socketService.on('new_message', handleNewMessage);
        socketService.on('messages_read', handleMessagesRead);
        socketService.on('user_typing', handleTyping);
        socketService.on('message_deleted', handleMessageDeleted);

        return () => {
            socketService.emit('leave_conversation', conversationId);
            socketService.off('new_message', handleNewMessage);
            socketService.off('messages_read', handleMessagesRead);
            socketService.off('user_typing', handleTyping);
            socketService.off('message_deleted', handleMessageDeleted);
        };
    }, [conversationId, user?.id]);

    const startRecording = async () => {
        if (isPreparingRecordingRef.current || recordingRef.current) return;
        isPreparingRecordingRef.current = true;
        
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Berechtigung fehlt', 'Bitte erlaube den Zugriff auf das Mikrofon.');
                isPreparingRecordingRef.current = false;
                setRecState('idle');
                return;
            }
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            if (recordingRef.current) {
                try { await recordingRef.current.stopAndUnloadAsync(); } catch (e) {}
                recordingRef.current = null;
            }

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            
            if (recordingStateRef.current !== 'recording') {
                await newRecording.stopAndUnloadAsync();
                isPreparingRecordingRef.current = false;
                return;
            }

            recordingRef.current = newRecording;
            setRecordingDuration(0);

            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Failed to start recording', err);
            setRecState('idle');
        } finally {
            isPreparingRecordingRef.current = false;
        }
    };

    const stopRecording = async (cancel: boolean = false) => {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

        try {
            const rec = recordingRef.current;
            if (rec) {
                await rec.stopAndUnloadAsync();
                const uri = rec.getURI();
                recordingRef.current = null;

                if (!cancel && uri) {
                    await uploadVoiceMessage(uri);
                }
            }
        } catch (err) {
            console.error('Failed to stop recording', err);
            recordingRef.current = null;
        }
        pan.setValue({ x: 0, y: 0 });
        setRecState('idle');
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                setRecState('recording');
                startRecording();
            },
            onPanResponderMove: (evt, gestureState) => {
                const state = recordingStateRef.current;
                if (state === 'locked' || state === 'cancelled') return;

                if (gestureState.dx < -150) {
                    setRecState('cancelled');
                    stopRecording(true);
                    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
                } else if (gestureState.dy < -100) {
                    setRecState('locked');
                    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
                } else {
                    let newX = gestureState.dx < 0 ? gestureState.dx : 0;
                    let newY = gestureState.dy < 0 ? gestureState.dy : 0;
                    pan.setValue({ x: newX, y: newY });
                }
            },
            onPanResponderRelease: () => {
                const state = recordingStateRef.current;
                Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
                if (state === 'recording') {
                    stopRecording(false);
                } else if (state === 'cancelled') {
                    setRecState('idle');
                }
            },
            onPanResponderTerminate: () => {
                const state = recordingStateRef.current;
                Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
                if (state === 'recording') {
                    setRecState('cancelled');
                    stopRecording(true);
                }
            }
        })
    ).current;

    const uploadVoiceMessage = async (uri: string) => {
        const currentReply = replyingTo;
        setReplyingTo(null);
        setShowScrollBottom(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            const formData = new FormData();
            formData.append('files', {
                uri,
                name: `voice_${Date.now()}.m4a`,
                type: 'audio/m4a'
            } as any);

            if (currentReply) {
                formData.append('replyToId', currentReply.id);
            }

            await apiClient.post(`/chat/conversations/${conversationId}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        } catch (err) {
            console.error('Upload voice error:', err);
            Alert.alert('Fehler', 'Sprachnachricht konnte nicht gesendet werden.');
            setReplyingTo(currentReply);
        }
    };

    const handleAttachmentMenu = () => {
        Alert.alert(
            'Anhang auswählen',
            '',
            [
                { text: 'Kamera', onPress: openCamera },
                { text: 'Galerie', onPress: pickImage },
                { text: 'Datei', onPress: pickDocument },
                { text: 'Abbrechen', style: 'cancel' }
            ]
        );
    };

    const openCamera = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Berechtigung fehlt', 'Bitte erlaube den Zugriff auf die Kamera.');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setPreviewAsset({ uri: result.assets[0].uri, mimeType: 'image/jpeg' });
                setPreviewCaption(inputText.trim());
            }
        } catch (error) {
            console.error('Error opening camera:', error);
        }
    };

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Berechtigung fehlt', 'Bitte erlaube den Zugriff auf die Galerie.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                let mime = 'image/jpeg';
                if (asset.type === 'video') mime = 'video/mp4';
                setPreviewAsset({ uri: asset.uri, mimeType: mime });
                setPreviewCaption(inputText.trim());
            }
        } catch (error) {
            console.error('Error picking image:', error);
        }
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setPreviewAsset({ uri: asset.uri, mimeType: asset.mimeType || 'application/octet-stream', name: asset.name });
                setPreviewCaption(inputText.trim());
            }
        } catch (error) {
            console.error('Error picking document:', error);
        }
    };

    const textInputRef = useRef<TextInput>(null);

    const uploadFile = async (uri: string, mimeType: string, customName?: string, caption?: string) => {
        const currentReply = replyingTo;
        const currentText = caption !== undefined ? caption : inputText.trim();
        setReplyingTo(null);
        setInputText('');
        textInputRef.current?.clear();
        setShowScrollBottom(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        
        try {
            const formData = new FormData();
            let defaultName = `file_${Date.now()}`;
            if (mimeType.startsWith('image/')) defaultName += '.jpg';
            else if (mimeType.startsWith('video/')) defaultName += '.mp4';
            else defaultName += '.bin';

            formData.append('files', {
                uri,
                name: customName || defaultName,
                type: mimeType
            } as any);

            if (currentReply) {
                formData.append('replyToId', currentReply.id);
            }
            if (currentText) {
                formData.append('caption', currentText);
            }

            await apiClient.post(`/chat/conversations/${conversationId}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        } catch (err) {
            console.error('Upload file error:', err);
            Alert.alert('Fehler', 'Datei konnte nicht gesendet werden.');
            setReplyingTo(currentReply);
            setInputText(currentText);
        }
    };

    const sendMessage = async () => {
        if (!inputText.trim()) return;
        
        const tempText = inputText;
        const currentReply = replyingTo;
        
        setInputText('');
        textInputRef.current?.clear();
        setReplyingTo(null);
        setShowScrollBottom(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            await apiClient.post(`/chat/conversations/${conversationId}/messages`, {
                text: tempText,
                type: 'text',
                replyToId: currentReply?.id || null
            });
        } catch (err) {
            console.error('Error sending message:', err);
            setInputText(tempText);
            setReplyingTo(currentReply);
            Alert.alert('Fehler', 'Nachricht konnte nicht gesendet werden.');
        }
    };

    const handleLongPress = (msg: any) => {
        if (isSelectionMode) return;
        
        const options: any[] = [
            { text: 'Antworten', onPress: () => setReplyingTo(msg) }
        ];

        if (msg.type === 'text' || !msg.type) {
            options.push({ 
                text: 'Kopieren', 
                onPress: () => Clipboard.setStringAsync(msg.text) 
            });
        }

        options.push({ 
            text: 'Weiterleiten', 
            onPress: () => {
                setIsSelectionMode(true);
                setSelectedMessages([msg]);
            }
        });

        if (msg.senderId === user?.id) {
            options.push({ 
                text: 'Löschen', 
                style: 'destructive' as const, 
                onPress: () => deleteMessage(msg.id) 
            });
        }

        options.push({ text: 'Abbrechen', style: 'cancel' });

        Alert.alert('Nachricht auswählen', '', options);
    };

    const toggleMessageSelection = (msg: any) => {
        setSelectedMessages(prev => {
            const isSelected = prev.find(m => m.id === msg.id);
            if (isSelected) {
                const next = prev.filter(m => m.id !== msg.id);
                if (next.length === 0) setIsSelectionMode(false);
                return next;
            } else {
                return [...prev, msg];
            }
        });
    };

    const openForwardModal = async () => {
        try {
            const res = await apiClient.get('/chat/conversations');
            const conversations = res.data?.data?.conversations || [];
            const formatted = conversations.map((c: any) => ({
                ...c,
                displayName: c.isGroup ? c.name : c.participants.find((p: any) => p.userId !== user?.id)?.user?.name || 'Unbekannt',
                displayAvatar: c.isGroup
                    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || 'G')}&background=random&color=fff`
                    : c.participants.find((p: any) => p.userId !== user?.id)?.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.participants.find((p: any) => p.userId !== user?.id)?.user?.name || 'U')}&background=random&color=fff`,
            }));
            setAllConversations(formatted);
            setIsForwardModalVisible(true);
        } catch (err) {
            console.error('Error fetching conversations for forward:', err);
        }
    };

    const handleForward = async (targetId: string) => {
        setIsForwardModalVisible(false);
        try {
            for (const msg of selectedMessages) {
                await apiClient.post(`/chat/conversations/${targetId}/messages`, {
                    text: msg.text,
                    type: msg.type,
                    caption: msg.caption,
                });
            }
            setIsSelectionMode(false);
            setSelectedMessages([]);
            Alert.alert('Erfolg', 'Nachrichten wurden weitergeleitet.');
        } catch (err) {
            console.error('Forward error:', err);
            Alert.alert('Fehler', 'Fehler beim Weiterleiten.');
        }
    };

    const deleteMessage = async (id: string) => {
        try {
            await apiClient.delete(`/chat/messages/${id}`);
            setMessages(prev => prev.filter(m => String(m.id) !== String(id)));
        } catch (err) {
            Alert.alert('Fehler', 'Nachricht konnte nicht gelöscht werden.');
        }
    };

    const getImageUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/')) return `${serverDomain}${url}`;
        return `${serverDomain}/${url}`;
    };

    const scrollToMessage = (messageId: string) => {
        const index = messages.findIndex(m => String(m.id) === String(messageId));
        if (index !== -1 && flatListRef.current) {
            flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
        }
    };

    const renderMessage = ({ item, index }: { item: any, index: number }) => {
        const isOwn = item.senderId === user?.id;
        const isImage = item.type === 'image';
        const isVoice = item.type === 'voice';
        const isFile = item.type === 'file';
        const isSelected = selectedMessages.some(m => m.id === item.id);
        
        const msgDate = new Date(item.createdAt).toLocaleDateString();
        const prevMsgDate = index > 0 ? new Date(messages[index - 1].createdAt).toLocaleDateString() : null;
        const showDate = msgDate !== prevMsgDate;

        return (
            <View>
                {showDate && (
                    <View className="items-center my-4">
                        <View className="bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded-full">
                            <Text className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                                {msgDate === new Date().toLocaleDateString() ? 'Heute' : 
                                msgDate === new Date(Date.now() - 86400000).toLocaleDateString() ? 'Gestern' : 
                                msgDate}
                            </Text>
                        </View>
                    </View>
                )}
                <View className="flex-row items-center">
                    {isSelectionMode && (
                        <TouchableOpacity 
                            onPress={() => toggleMessageSelection(item)}
                            className="mr-3 justify-center"
                        >
                            {isSelected ? (
                                <CheckSquare size={22} color="#3B82F6" />
                            ) : (
                                <Square size={22} color="#9CA3AF" />
                            )}
                        </TouchableOpacity>
                    )}
                    <View className="flex-1">
                        <SwipeableMessage onSwipeReply={() => setReplyingTo(item)}>
                            <TouchableOpacity 
                                onPress={() => {
                                    if (isSelectionMode) {
                                        toggleMessageSelection(item);
                                    } else if (isImage) {
                                        setSelectedImage(getImageUrl(item.text));
                                    } else if (isFile) {
                                        Linking.openURL(getImageUrl(item.text));
                                    }
                                }}
                                onLongPress={() => handleLongPress(item)}
                                delayLongPress={300}
                                className={`flex-row my-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
                            >
                                <View 
                                    className={`max-w-[80%] px-4 py-2 rounded-2xl ${isOwn ? 'bg-blue-500 rounded-tr-sm' : 'bg-gray-100 dark:bg-gray-800 rounded-tl-sm'} ${isSelected ? 'border-2 border-blue-400' : ''}`}
                                >
                                    {item.repliedTo && (
                                        <TouchableOpacity 
                                            activeOpacity={0.7}
                                            onPress={() => scrollToMessage(item.repliedTo.id)}
                                            className={`mb-2 pl-2 border-l-4 ${isOwn ? 'border-blue-300' : 'border-gray-300 dark:border-gray-600'} bg-black/5 dark:bg-white/5 rounded-r p-2`}
                                        >
                                            <Text className={`font-bold text-xs ${isOwn ? 'text-blue-100' : 'text-blue-500'}`}>
                                                {item.repliedTo.sender?.name || 'Benutzer'}
                                            </Text>
                                            <Text className={`text-xs ${isOwn ? 'text-blue-50' : 'text-gray-600 dark:text-gray-400'}`} numberOfLines={1}>
                                                {item.repliedTo.type === 'voice' ? '🎵 Sprachnachricht' : 
                                                item.repliedTo.type === 'image' ? '📷 Foto' : item.repliedTo.text}
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                    {isImage ? (
                                        <View>
                                            <Image 
                                                source={{ uri: getImageUrl(item.text) }} 
                                                className="w-48 h-48 rounded-xl bg-gray-200"
                                                resizeMode="cover"
                                            />
                                        </View>
                                    ) : isVoice ? (
                                        <AudioPlayer audioUri={getImageUrl(item.text)} isOwn={isOwn} />
                                    ) : isFile ? (
                                        <View className="flex-row items-center py-2 pr-2">
                                            <FileIcon size={24} color={isOwn ? 'white' : '#3B82F6'} />
                                            <Text className={`ml-2 underline ${isOwn ? 'text-white' : 'text-blue-500'}`} numberOfLines={1}>
                                                {item.caption || 'Datei öffnen'}
                                            </Text>
                                        </View>
                                    ) : (
                                        <Text className={`text-base ${isOwn ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                            {item.text}
                                        </Text>
                                    )}
                                    <View className="flex-row justify-end items-center mt-1">
                                        <Text className={`text-[10px] ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
                                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                        {isOwn && (
                                            <Text className={`text-[10px] ml-1 ${item.isRead ? 'text-blue-200' : 'text-blue-300'}`}>
                                                {item.isRead ? '✓✓' : '✓'}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </SwipeableMessage>
                    </View>
            </View>
        </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-[#0a0a0c]">
            <View className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800 mt-10">
                {isSelectionMode ? (
                    <View className="flex-row flex-1 items-center justify-between">
                        <View className="flex-row items-center">
                            <TouchableOpacity onPress={() => { setIsSelectionMode(false); setSelectedMessages([]); }} className="mr-3">
                                <X size={24} color="#6B7280" />
                            </TouchableOpacity>
                            <Text className="text-lg font-bold text-gray-900 dark:text-white">
                                {selectedMessages.length} ausgewählt
                            </Text>
                        </View>
                        <TouchableOpacity onPress={openForwardModal}>
                            <Share2 size={24} color="#3B82F6" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
                            <ArrowLeft size={24} color="#3B82F6" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            className="flex-row items-center flex-1"
                            onPress={() => {
                                if (isGroup) setIsGroupProfileModalVisible(true);
                                else setIsProfileModalVisible(true);
                            }}
                        >
                            <View className="w-10 h-10 rounded-full mr-3 bg-blue-500 items-center justify-center">
                                <Text className="text-white font-bold text-lg">{getInitials(name)}</Text>
                            </View>
                            <View className="flex-1 mr-2">
                                <Text className="text-lg font-bold text-gray-900 dark:text-white" numberOfLines={1}>{name}</Text>
                                {isTyping ? (
                                    <Text className="text-xs text-blue-500">schreibt...</Text>
                                ) : (
                                    <Text className="text-xs text-gray-500" numberOfLines={1}>{getStatusText()}</Text>
                                )}
                            </View>
                        </TouchableOpacity>

                        {!isGroup && (
                            <View className="flex-row items-center">
                                <TouchableOpacity onPress={() => {
                                    if (otherUser?.phone) {
                                        Linking.openURL(`tel:${otherUser.phone}`);
                                    } else {
                                        Alert.alert('Hinweis', 'Keine Telefonnummer hinterlegt.');
                                    }
                                }} className="p-2 mr-1">
                                    <Phone size={22} color="#3B82F6" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => Alert.alert('Videoanruf', 'Funktion in Entwicklung.')} className="p-2">
                                    <Video size={24} color="#3B82F6" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id.toString()}
                renderItem={renderMessage}
                contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: 'flex-end' }}
                onContentSizeChange={() => {
                    if (!showScrollBottom) flatListRef.current?.scrollToEnd({ animated: false });
                }}
                onLayout={() => {
                    if (!showScrollBottom) flatListRef.current?.scrollToEnd({ animated: false });
                }}
                onScroll={(e) => {
                    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
                    const isNearBottom = contentSize.height - layoutMeasurement.height - contentOffset.y < 150;
                    setShowScrollBottom(!isNearBottom);
                }}
                scrollEventThrottle={16}
            />

            {showScrollBottom && (
                <TouchableOpacity 
                    onPress={() => {
                        flatListRef.current?.scrollToEnd({ animated: true });
                        setShowScrollBottom(false);
                    }}
                    className={`absolute right-4 bg-blue-500 w-10 h-10 rounded-full items-center justify-center shadow-lg ${replyingTo ? 'bottom-48' : 'bottom-32'}`}
                    style={{ zIndex: 10 }}
                >
                    <ChevronDown size={24} color="white" />
                </TouchableOpacity>
            )}

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {replyingTo && (
                    <View className="flex-row items-center bg-gray-50 dark:bg-gray-900 px-4 py-2 border-t border-gray-200 dark:border-gray-800">
                        <View className="flex-1 border-l-4 border-blue-500 pl-3">
                            <Text className="font-bold text-xs text-blue-500">{replyingTo.sender?.name || 'Antwort an'}</Text>
                            <Text className="text-xs text-gray-600 dark:text-gray-400" numberOfLines={1}>
                                {replyingTo.type === 'voice' ? '🎵 Sprachnachricht' : replyingTo.type === 'image' ? '📷 Foto' : replyingTo.text}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => setReplyingTo(null)} className="p-2">
                            <X size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                )}

                <View className="flex-row items-center px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#0a0a0c]">
                    {recordingState === 'idle' && (
                        <TouchableOpacity onPress={handleAttachmentMenu} className="p-2 mr-2">
                            <ImageIcon size={24} color="#6B7280" />
                        </TouchableOpacity>
                    )}

                    {recordingState !== 'idle' ? (
                        <View className="flex-1 flex-row items-center justify-between bg-red-50 dark:bg-red-900/20 rounded-full px-4 py-2 mr-2">
                            <View className="flex-row items-center">
                                <View className={`w-2 h-2 rounded-full mr-2 ${recordingState === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
                                <Text className={recordingState === 'recording' ? 'text-red-500 font-medium' : 'text-gray-500 font-medium'}>
                                    {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                                </Text>
                            </View>
                            {recordingState === 'recording' ? (
                                <Text className="text-gray-400 text-xs text-right flex-1 ml-4" numberOfLines={1}>
                                    ← abbrechen | ↑ sperren
                                </Text>
                            ) : (
                                <TouchableOpacity onPress={() => stopRecording(true)}>
                                    <Text className="text-red-500 font-medium">Löschen</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        <TextInput
                            ref={textInputRef}
                            value={inputText}
                            onChangeText={(text) => {
                                setInputText(text);
                                socketService.emit('typing', { conversationId, isTyping: text.length > 0 });
                            }}
                            placeholder="Nachricht schreiben..."
                            placeholderTextColor="#9CA3AF"
                            className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2 text-gray-900 dark:text-white max-h-24"
                            multiline
                        />
                    )}

                    {inputText.trim() ? (
                        <TouchableOpacity onPress={sendMessage} className="ml-2 p-3 rounded-full bg-blue-500">
                            <Send size={20} color="white" />
                        </TouchableOpacity>
                    ) : recordingState === 'locked' ? (
                        <TouchableOpacity onPress={() => stopRecording(false)} className="ml-2 p-3 rounded-full bg-blue-500">
                            <Send size={20} color="white" />
                        </TouchableOpacity>
                    ) : (
                        <Animated.View style={{ transform: [{ translateX: pan.x }, { translateY: pan.y }] }}>
                            <View {...panResponder.panHandlers} className="ml-2 p-3 rounded-full bg-blue-500">
                                <Mic size={20} color="white" />
                            </View>
                        </Animated.View>
                    )}
                </View>
            </KeyboardAvoidingView>

            {/* Fullscreen Image Modal */}
            <Modal visible={!!selectedImage} transparent={true} animationType="fade">
                <View className="flex-1 bg-black justify-center items-center">
                    <TouchableOpacity 
                        className="absolute top-12 right-5 z-10 p-2 bg-black/50 rounded-full"
                        onPress={() => setSelectedImage(null)}
                    >
                        <X size={28} color="white" />
                    </TouchableOpacity>
                    {selectedImage && (
                        <Image 
                            source={{ uri: selectedImage }} 
                            className="w-full h-full"
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>

            {/* Forwarding Modal */}
            <Modal visible={isForwardModalVisible} transparent={true} animationType="slide">
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-white dark:bg-[#1a1a1c] h-[70%] rounded-t-3xl">
                        <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                            <Text className="text-xl font-bold text-gray-900 dark:text-white">Weiterleiten an...</Text>
                            <TouchableOpacity onPress={() => setIsForwardModalVisible(false)}>
                                <X size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={allConversations}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    className="flex-row items-center p-4 border-b border-gray-50 dark:border-gray-800/50"
                                    onPress={() => handleForward(item.id)}
                                >
                                    <Image source={{ uri: item.displayAvatar }} className="w-12 h-12 rounded-full" />
                                    <View className="ml-3 flex-1">
                                        <Text className="font-bold text-gray-900 dark:text-white">{item.displayName}</Text>
                                        <Text className="text-xs text-gray-500" numberOfLines={1}>
                                            {item.isGroup ? 'Gruppe' : 'Privater Chat'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        />
                    </View>
                </View>
            </Modal>
            {/* Preview Asset Modal */}
            <Modal visible={!!previewAsset} animationType="slide" transparent={false}>
                <SafeAreaView className="flex-1 bg-black">
                    <View className="flex-row justify-between items-center px-4 py-3">
                        <TouchableOpacity onPress={() => setPreviewAsset(null)}>
                            <X color="white" size={28} />
                        </TouchableOpacity>
                        {previewAsset?.mimeType.startsWith('image/') && (
                            <TouchableOpacity onPress={async () => {
                                try {
                                    const result = await ImagePicker.launchImageLibraryAsync({
                                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                        allowsEditing: true,
                                        quality: 0.8,
                                    });
                                    if (!result.canceled && result.assets && result.assets.length > 0) {
                                        setPreviewAsset({ ...previewAsset, uri: result.assets[0].uri });
                                    }
                                } catch (error) {
                                    console.error('Error re-opening gallery for edit:', error);
                                }
                            }}>
                                <Edit2 color="white" size={24} />
                            </TouchableOpacity>
                        )}
                    </View>
                    
                    <View className="flex-1 justify-center items-center">
                        {previewAsset?.mimeType.startsWith('image/') ? (
                            <Image source={{ uri: previewAsset.uri }} className="w-full h-full" resizeMode="contain" />
                        ) : (
                            <View className="items-center">
                                <FileIcon size={64} color="white" />
                                <Text className="text-white mt-4">{previewAsset?.name || 'Datei'}</Text>
                            </View>
                        )}
                    </View>

                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="p-4 bg-[#1a1a1c]">
                        <View className="flex-row items-center">
                            <TextInput
                                value={previewCaption}
                                onChangeText={setPreviewCaption}
                                placeholder="Bildunterschrift hinzufügen..."
                                placeholderTextColor="#9CA3AF"
                                className="flex-1 bg-white/10 rounded-full px-4 py-2 text-white max-h-24"
                                multiline
                            />
                            <TouchableOpacity 
                                onPress={async () => {
                                    const asset = previewAsset;
                                    const caption = previewCaption;
                                    if (!asset) return;
                                    setPreviewAsset(null);
                                    setPreviewCaption('');
                                    await uploadFile(asset.uri, asset.mimeType, asset.name, caption);
                                }}
                                className="ml-3 p-3 rounded-full bg-blue-500"
                            >
                                <Send size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>

            {/* Profile Modal */}
            <Modal visible={isProfileModalVisible} transparent={true} animationType="fade">
                <View className="flex-1 justify-end bg-black/60">
                    <TouchableOpacity className="flex-1" onPress={() => setIsProfileModalVisible(false)} />
                    <View className="bg-white dark:bg-[#1a1a1c] rounded-t-3xl p-6 items-center shadow-lg">
                        <TouchableOpacity 
                            className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-full"
                            onPress={() => {
                                setIsProfileModalVisible(false);
                                if (selectedParticipantUser) {
                                    setSelectedParticipantUser(null);
                                    setIsGroupProfileModalVisible(true);
                                }
                            }}
                        >
                            <X size={24} color="#9CA3AF" />
                        </TouchableOpacity>
                        
                        <View className="w-24 h-24 rounded-full mb-4 border-4 border-gray-100 dark:border-gray-800 bg-blue-500 items-center justify-center">
                            <Text className="text-white text-3xl font-bold">{getInitials((selectedParticipantUser || otherUser)?.name || name)}</Text>
                        </View>
                        
                        <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{(selectedParticipantUser || otherUser)?.name || name}</Text>
                        <Text className="text-sm text-blue-500 font-medium mb-6">{(selectedParticipantUser || otherUser)?.role?.name || 'Mitarbeiter'}</Text>
                        
                        <View className="w-full space-y-4">
                            <TouchableOpacity 
                                className="flex-row items-center bg-gray-50 dark:bg-[#252528] p-4 rounded-2xl"
                                onPress={() => {
                                    const userToCall = selectedParticipantUser || otherUser;
                                    if (userToCall?.phone) {
                                        Linking.openURL(`tel:${userToCall.phone}`);
                                    } else {
                                        Alert.alert('Hinweis', 'Keine Telefonnummer hinterlegt.');
                                    }
                                }}
                            >
                                <View className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 items-center justify-center mr-4">
                                    <Phone size={20} color="#3B82F6" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xs text-gray-500 dark:text-gray-400">Telefon</Text>
                                    <Text className="text-base text-gray-900 dark:text-white font-medium">{(selectedParticipantUser || otherUser)?.phone || 'Nicht hinterlegt'}</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                className="flex-row items-center bg-gray-50 dark:bg-[#252528] p-4 rounded-2xl"
                                onPress={() => {
                                    const userToEmail = selectedParticipantUser || otherUser;
                                    if (userToEmail?.email) {
                                        setIsProfileModalVisible(false);
                                        (navigation as any).navigate('Main', {
                                            screen: 'E-Mail',
                                            params: {
                                                initialRecipient: userToEmail.email
                                            }
                                        });
                                    } else {
                                        Alert.alert('Hinweis', 'Keine E-Mail hinterlegt.');
                                    }
                                }}
                            >
                                <View className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 items-center justify-center mr-4">
                                    <Mail size={20} color="#3B82F6" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xs text-gray-500 dark:text-gray-400">E-Mail</Text>
                                    <Text className="text-base text-gray-900 dark:text-white font-medium">{(selectedParticipantUser || otherUser)?.email || 'Nicht hinterlegt'}</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Group Profile Modal */}
            <Modal visible={isGroupProfileModalVisible} transparent={true} animationType="fade">
                <View className="flex-1 justify-end bg-black/60">
                    <TouchableOpacity className="flex-1" onPress={() => setIsGroupProfileModalVisible(false)} />
                    <View className="bg-white dark:bg-[#1a1a1c] rounded-t-3xl p-6 shadow-lg max-h-[80%]">
                        <TouchableOpacity 
                            className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-full z-10"
                            onPress={() => setIsGroupProfileModalVisible(false)}
                        >
                            <X size={24} color="#9CA3AF" />
                        </TouchableOpacity>
                        
                        <View className="items-center mb-6">
                            <View className="w-24 h-24 rounded-full mb-4 border-4 border-gray-100 dark:border-gray-800 bg-blue-500 items-center justify-center">
                                <Text className="text-white text-3xl font-bold">{getInitials(name)}</Text>
                            </View>
                            <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{name}</Text>
                            <Text className="text-sm text-gray-500">{participants?.length || 0} Mitglieder</Text>
                        </View>
                        
                        <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 ml-1 uppercase tracking-wider">Mitglieder</Text>
                        
                        <ScrollView className="mb-4">
                            {participants?.map((p: any) => {
                                const isMe = p.userId === user?.id;
                                return (
                                    <TouchableOpacity 
                                        key={p.userId}
                                        disabled={isMe}
                                        onPress={() => {
                                            setSelectedParticipantUser(p.user);
                                            setIsGroupProfileModalVisible(false);
                                            setTimeout(() => setIsProfileModalVisible(true), 300);
                                        }}
                                        className="flex-row items-center bg-gray-50 dark:bg-[#252528] p-3 rounded-xl mb-2"
                                    >
                                        <View className="w-10 h-10 rounded-full bg-blue-500 items-center justify-center mr-3">
                                            <Text className="text-white font-bold">{getInitials(p.user?.name || 'U')}</Text>
                                        </View>
                                        <View className="flex-1">
                                            <Text className="font-bold text-gray-900 dark:text-white">
                                                {p.user?.name || 'Benutzer'} {isMe ? '(Du)' : ''}
                                            </Text>
                                            <Text className="text-xs text-gray-500 dark:text-gray-400">{p.user?.role?.name || 'Mitarbeiter'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <TouchableOpacity 
                            onPress={leaveGroup}
                            className="bg-red-50 dark:bg-red-900/20 py-4 rounded-xl items-center border border-red-100 dark:border-red-900/30"
                        >
                            <Text className="text-red-500 font-bold">Gruppe verlassen</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
