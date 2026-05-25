import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Image, SafeAreaView, Alert, PanResponder, Animated, Modal, Linking, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Send, ArrowLeft, Image as ImageIcon, Mic, X, Square, File as FileIcon, Copy, CheckSquare, Share2, ChevronDown, Edit2, Phone, Video, Mail, Check, FlipHorizontal } from 'lucide-react-native';
import ImageView from "react-native-image-viewing";
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AudioPlayer from '../components/AudioPlayer';
import { apiClient, serverDomain } from '../api/client';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socket';
import { GlassCard } from '../components/GlassCard';
import { BlurView } from 'expo-blur';

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
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    
    // Upload & Gallery states
    const [uploadStatuses, setUploadStatuses] = useState<{ [uri: string]: 'idle' | 'uploading' | 'success' | 'error' }>({});
    const [isUploading, setIsUploading] = useState(false);
    const [isGalleryVisible, setIsGalleryVisible] = useState(false);
    const [galleryImages, setGalleryImages] = useState<{ uri: string }[]>([]);
    const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);

    // Calling states
    const [token, setToken] = useState<string | null>(null);
    const [activeCall, setActiveCall] = useState<any>(null);
    const [incomingCall, setIncomingCall] = useState<any>(null);
    const [isCallModalVisible, setIsCallModalVisible] = useState(false);

    useEffect(() => {
        SecureStore.getItemAsync('token').then(t => setToken(t));
    }, []);

    // Image Editor state
    const [isEditingImage, setIsEditingImage] = useState(false);
    const [editingImageUri, setEditingImageUri] = useState('');
    const [editingAssetIndex, setEditingAssetIndex] = useState<number | null>(null);
    const [paths, setPaths] = useState<{ points: { x: number, y: number }[], color: string, width: number }[]>([]);
    const [currentPath, setCurrentPath] = useState<{ x: number, y: number }[]>([]);
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [drawColor, setDrawColor] = useState('#EF4444');
    const [drawWidth, setDrawWidth] = useState(5);
    const [imageLayout, setImageLayout] = useState({ width: 1, height: 1 });
    
    // WebView flattening state
    const [isFlattening, setIsFlattening] = useState(false);
    const [flattenPayload, setFlattenPayload] = useState<any>(null);
    const webViewRef = useRef<any>(null);

    const handleTouchStart = (evt: any) => {
        if (!isDrawingMode) return;
        // Suppress drawing if multiple fingers are touching (e.g. pinch-to-zoom is active)
        if (evt.nativeEvent.touches && evt.nativeEvent.touches.length > 1) {
            setCurrentPath([]);
            return;
        }
        const { locationX, locationY } = evt.nativeEvent;
        const normX = locationX / imageLayout.width;
        const normY = locationY / imageLayout.height;
        setCurrentPath([{ x: normX, y: normY }]);
    };

    const handleTouchMove = (evt: any) => {
        if (!isDrawingMode) return;
        // Suppress drawing if multiple fingers are touching (e.g. pinch-to-zoom is active)
        if (evt.nativeEvent.touches && evt.nativeEvent.touches.length > 1) {
            setCurrentPath([]);
            return;
        }
        const { locationX, locationY } = evt.nativeEvent;
        const normX = locationX / imageLayout.width;
        const normY = locationY / imageLayout.height;
        setCurrentPath(prev => [...prev, { x: normX, y: normY }]);
    };

    const handleTouchEnd = (evt: any) => {
        if (!isDrawingMode || currentPath.length === 0) return;
        // Suppress drawing commits if multi-touch was active
        if (evt.nativeEvent.touches && evt.nativeEvent.touches.length > 1) {
            setCurrentPath([]);
            return;
        }
        setPaths(prev => [...prev, { points: currentPath, color: drawColor, width: drawWidth }]);
        setCurrentPath([]);
    };

    const getPathString = (points: { x: number, y: number }[]) => {
        if (points.length === 0) return '';
        const w = imageLayout.width;
        const h = imageLayout.height;
        let d = `M ${points[0].x * w} ${points[0].y * h}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x * w} ${points[i].y * h}`;
        }
        return d;
    };

    const startEditingImage = async (uri: string, assetIndex: number | null) => {
        setIsUploading(true);
        try {
            let localUri = uri;
            if (uri.startsWith('http')) {
                const filename = `temp_edit_${Date.now()}.jpg`;
                const fileUri = `${FileSystem.cacheDirectory}${filename}`;
                const downloadRes = await FileSystem.downloadAsync(uri, fileUri);
                localUri = downloadRes.uri;
            }
            setEditingImageUri(localUri);
            setEditingAssetIndex(assetIndex);
            setPaths([]);
            setCurrentPath([]);
            setIsDrawingMode(false);
            setIsEditingImage(true);
        } catch (err) {
            console.error('Error downloading image for edit:', err);
            Alert.alert('Fehler', 'Das Bild konnte nicht für die Bearbeitung geladen werden.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRotate = async () => {
        try {
            const result = await ImageManipulator.manipulateAsync(
                editingImageUri,
                [{ rotate: 90 }],
                { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
            );
            setEditingImageUri(result.uri);
            setPaths([]);
            setCurrentPath([]);
        } catch (err) {
            console.error('Rotate error:', err);
        }
    };

    const handleFlip = async () => {
        try {
            const result = await ImageManipulator.manipulateAsync(
                editingImageUri,
                [{ flip: ImageManipulator.FlipType.Horizontal }],
                { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
            );
            setEditingImageUri(result.uri);
            setPaths([]);
            setCurrentPath([]);
        } catch (err) {
            console.error('Flip error:', err);
        }
    };

    const finalizeEdit = (uri: string) => {
        if (editingAssetIndex !== null) {
            setPreviewAssets(prev => prev.map((asset, i) => i === editingAssetIndex ? { ...asset, uri } : asset));
        } else {
            uploadFiles([{ uri, mimeType: 'image/jpeg' }]);
        }
        
        setIsEditingImage(false);
        setEditingImageUri('');
        setEditingAssetIndex(null);
        setPaths([]);
        setCurrentPath([]);
        setIsDrawingMode(false);
        setIsUploading(false);
    };

    const handleSaveEditedImage = async () => {
        setIsUploading(true);
        try {
            if (paths.length > 0) {
                const base64 = await FileSystem.readAsStringAsync(editingImageUri, { encoding: 'base64' });
                const base64Image = `data:image/jpeg;base64,${base64}`;
                
                setFlattenPayload({
                    base64Image,
                    paths,
                    layoutWidth: imageLayout.width,
                    layoutHeight: imageLayout.height
                });
                setIsFlattening(true);
            } else {
                finalizeEdit(editingImageUri);
            }
        } catch (err) {
            console.error('Error saving edited image:', err);
            Alert.alert('Fehler', 'Das Bild konnte nicht gespeichert werden.');
            setIsUploading(false);
        }
    };

    const handleWebViewMessage = async (event: any) => {
        const data = event.nativeEvent.data;
        setIsFlattening(false);
        setFlattenPayload(null);
        
        if (data.startsWith('data:image/jpeg;base64,')) {
            try {
                const base64Data = data.split(',')[1];
                const tempUri = `${FileSystem.cacheDirectory}edited_${Date.now()}.jpg`;
                await FileSystem.writeAsStringAsync(tempUri, base64Data, { encoding: 'base64' });
                
                finalizeEdit(tempUri);
            } catch (err) {
                console.error('Error writing edited file:', err);
                Alert.alert('Fehler', 'Das Bild konnte nicht gespeichert werden.');
                setIsUploading(false);
            }
        } else {
            console.error('WebView error:', data);
            Alert.alert('Fehler', 'Bildbearbeitung fehlgeschlagen.');
            setIsUploading(false);
        }
    };

    const openGallery = (images: any[], initialIndex: number) => {
        const formatted = images.map(img => ({ uri: getImageUrl(img.uri) }));
        setGalleryImages(formatted);
        setActiveGalleryIndex(initialIndex);
        setIsGalleryVisible(true);
    };

    const groupConsecutiveImages = (msgs: any[]) => {
        const grouped: any[] = [];
        let currentGroup: any = null;

        for (let i = 0; i < msgs.length; i++) {
            const msg = msgs[i];
            
            // Only group if it's an image and has no replyToId
            if (msg.type === 'image' && !msg.replyToId) {
                const msgTime = new Date(msg.createdAt).getTime();
                
                if (currentGroup && 
                    currentGroup.senderId === msg.senderId && 
                    (msgTime - new Date(currentGroup.createdAt).getTime()) <= 15000
                ) {
                    currentGroup.images.push({
                        id: msg.id,
                        uri: msg.text,
                        createdAt: msg.createdAt,
                        caption: msg.caption,
                        isRead: msg.isRead
                    });
                    currentGroup.id = msg.id;
                    currentGroup.createdAt = msg.createdAt;
                    currentGroup.isRead = msg.isRead;
                } else {
                    if (currentGroup) {
                        grouped.push(currentGroup);
                    }
                    currentGroup = {
                        id: msg.id,
                        type: 'image-group',
                        senderId: msg.senderId,
                        createdAt: msg.createdAt,
                        sender: msg.sender,
                        isRead: msg.isRead,
                        images: [{
                            id: msg.id,
                            uri: msg.text,
                            createdAt: msg.createdAt,
                            caption: msg.caption,
                            isRead: msg.isRead
                        }]
                    };
                }
            } else {
                if (currentGroup) {
                    grouped.push(currentGroup);
                    currentGroup = null;
                }
                grouped.push(msg);
            }
        }

        if (currentGroup) {
            grouped.push(currentGroup);
        }

        return grouped;
    };

    const groupedMessages = useMemo(() => groupConsecutiveImages(messages), [messages]);
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
    const [previewAssets, setPreviewAssets] = useState<{uri: string, mimeType: string, name?: string}[]>([]);
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

    const startOutboundCall = async (type: 'audio' | 'video') => {
        if (!otherUser?.id) return;
        
        // Request camera and microphone permissions natively
        const audioPermission = await Audio.requestPermissionsAsync();
        const cameraPermission = type === 'video' ? await ImagePicker.requestCameraPermissionsAsync() : { status: 'granted' };
        
        if (audioPermission.status !== 'granted' || cameraPermission.status !== 'granted') {
            Alert.alert('Berechtigung fehlt', 'Bitte erlaube den Zugriff auf Kamera und Mikrofon для звонков.');
            return;
        }

        const activeToken = await SecureStore.getItemAsync('token');
        if (!activeToken) return;

        setToken(activeToken);
        setActiveCall({
            type,
            direction: 'out',
            remoteUser: { id: otherUser.id, name, avatar }
        });
        setIsCallModalVisible(true);
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

        const handleIncomingCall = async (data: any) => {
            console.log('Incoming WebRTC call on mobile:', data);
            
            // Request camera/mic permissions natively before mounting Call WebView
            try {
                await Audio.requestPermissionsAsync();
                if (data.type === 'video') {
                    await ImagePicker.requestCameraPermissionsAsync();
                }
            } catch (err) {
                console.error('Failed to request native media permissions on incoming call:', err);
            }

            setIncomingCall(data);
            setActiveCall({
                type: data.type,
                direction: 'in',
                remoteUser: { id: data.callerId, name: data.callerName },
                remotePeerId: data.peerId
            });
            setIsCallModalVisible(true);
        };

        const handleCallFinished = () => {
            console.log('Call finished socket notification');
            setIsCallModalVisible(false);
            setActiveCall(null);
            setIncomingCall(null);
        };

        socketService.on('new_message', handleNewMessage);
        socketService.on('messages_read', handleMessagesRead);
        socketService.on('user_typing', handleTyping);
        socketService.on('message_deleted', handleMessageDeleted);
        socketService.on('call:incoming', handleIncomingCall);
        socketService.on('call:finished', handleCallFinished);

        return () => {
            socketService.emit('leave_conversation', conversationId);
            socketService.off('new_message', handleNewMessage);
            socketService.off('messages_read', handleMessagesRead);
            socketService.off('user_typing', handleTyping);
            socketService.off('message_deleted', handleMessageDeleted);
            socketService.off('call:incoming', handleIncomingCall);
            socketService.off('call:finished', handleCallFinished);
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
                const newAsset = {
                    uri: result.assets[0].uri,
                    mimeType: 'image/jpeg',
                    name: result.assets[0].fileName || undefined
                };
                setPreviewAssets(prev => [...prev, newAsset]);
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
                allowsMultipleSelection: true,
                quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const newAssets = result.assets.map(asset => ({
                    uri: asset.uri,
                    mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
                    name: asset.fileName || undefined
                }));
                setPreviewAssets(prev => [...prev, ...newAssets]);
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
                multiple: true,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const newAssets = result.assets.map(asset => ({
                    uri: asset.uri,
                    mimeType: asset.mimeType || 'application/octet-stream',
                    name: asset.name
                }));
                setPreviewAssets(prev => [...prev, ...newAssets]);
                setPreviewCaption(inputText.trim());
            }
        } catch (error) {
            console.error('Error picking document:', error);
        }
    };
    const removePreviewAsset = (index: number) => {
        setPreviewAssets(prev => prev.filter((_, i) => i !== index));
    };

    const textInputRef = useRef<TextInput>(null);

    const uploadFiles = async (assets: {uri: string, mimeType: string, name?: string}[], caption?: string) => {
        const currentReply = replyingTo;
        const currentText = caption !== undefined ? caption : inputText.trim();
        
        setIsUploading(true);
        setShowScrollBottom(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        
        // Initialize statuses to 'uploading'
        const initialStatuses: { [uri: string]: 'uploading' } = {};
        assets.forEach(asset => {
            initialStatuses[asset.uri] = 'uploading';
        });
        setUploadStatuses(initialStatuses);
        
        let hasError = false;
        
        // Upload each file individually to show real-time progress per asset
        for (let index = 0; index < assets.length; index++) {
            const asset = assets[index];
            
            // Skip already uploaded ones (e.g. if we retried)
            if (uploadStatuses[asset.uri] === 'success') {
                continue;
            }
            
            try {
                const formData = new FormData();
                let defaultName = `file_${Date.now()}_${index}`;
                if (asset.mimeType.startsWith('image/')) defaultName += '.jpg';
                else if (asset.mimeType.startsWith('video/')) defaultName += '.mp4';
                else defaultName += '.bin';

                formData.append('files', {
                    uri: asset.uri,
                    name: asset.name || defaultName,
                    type: asset.mimeType
                } as any);

                if (currentReply) {
                    formData.append('replyToId', currentReply.id);
                }
                
                // Attach user caption to the first uploaded file in this batch
                if (index === 0 && currentText) {
                    formData.append('caption', currentText);
                }

                await apiClient.post(`/chat/conversations/${conversationId}/upload`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                
                setUploadStatuses(prev => ({ ...prev, [asset.uri]: 'success' }));
            } catch (err) {
                console.error(`Upload error for asset ${asset.uri}:`, err);
                hasError = true;
                setUploadStatuses(prev => ({ ...prev, [asset.uri]: 'error' }));
            }
        }
        
        setIsUploading(false);
        
        if (!hasError) {
            // Success close-out
            setTimeout(() => {
                setPreviewAssets([]);
                setPreviewCaption('');
                setUploadStatuses({});
                setReplyingTo(null);
                setInputText('');
                textInputRef.current?.clear();
            }, 1000);
        } else {
            Alert.alert('Upload-Fehler', 'Einige Dateien konnten nicht hochgeladen werden. Tippe auf das Kreuz, um fehlerhafte Medien zu entfernen, oder klicke erneut auf Senden.');
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

        if (msg.type === 'image' || msg.type === 'image-group') {
            options.push({ 
                text: 'Bild bearbeiten & senden', 
                onPress: () => {
                    const imgUri = msg.type === 'image-group' ? msg.images[0].uri : msg.text;
                    startEditingImage(getImageUrl(imgUri), null);
                }
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
        const isImageGroup = item.type === 'image-group';
        const isImage = item.type === 'image';
        const isVoice = item.type === 'voice';
        const isFile = item.type === 'file';
        const isSelected = selectedMessages.some(m => m.id === item.id);
        
        const msgDate = new Date(item.createdAt).toLocaleDateString();
        const prevMsgDate = index > 0 ? new Date(groupedMessages[index - 1].createdAt).toLocaleDateString() : null;
        const showDate = msgDate !== prevMsgDate;

        return (
            <View>
                {showDate && (
                    <View className="items-center my-4">
                        <View className="bg-white/5 border border-white/5 px-3 py-1 rounded-full">
                            <Text className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
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
                                <CheckSquare size={20} color="#3B82F6" />
                            ) : (
                                <Square size={20} color="#6B7280" />
                            )}
                        </TouchableOpacity>
                    )}
                    <View className="flex-1">
                        <SwipeableMessage onSwipeReply={() => setReplyingTo(item)}>
                            <TouchableOpacity 
                                activeOpacity={0.9}
                                onPress={() => {
                                    if (isSelectionMode) {
                                        toggleMessageSelection(item);
                                    } else if (isImageGroup) {
                                        openGallery(item.images, 0);
                                    } else if (isImage) {
                                        openGallery([{ id: item.id, uri: item.text, createdAt: item.createdAt }], 0);
                                    } else if (isFile) {
                                        Linking.openURL(getImageUrl(item.text));
                                    }
                                }}
                                onLongPress={() => handleLongPress(item)}
                                delayLongPress={300}
                                className={`flex-row my-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
                            >
                                <View 
                                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${isOwn ? 'bg-[#3B82F6] rounded-tr-sm border border-[#3B82F6]/50 shadow-lg shadow-blue-500/20' : 'bg-white/5 border border-white/10 rounded-tl-sm'} ${isSelected ? 'border-2 border-blue-400' : ''}`}
                                >
                                    {item.repliedTo && (
                                        <TouchableOpacity 
                                            activeOpacity={0.7}
                                            onPress={() => scrollToMessage(item.repliedTo.id)}
                                            className={`mb-2 pl-2 border-l-4 ${isOwn ? 'border-blue-300' : 'border-gray-500'} bg-black/25 rounded-r p-2`}
                                        >
                                            <Text className={`font-black text-[10px] uppercase tracking-wider ${isOwn ? 'text-blue-100' : 'text-blue-400'}`}>
                                                {item.repliedTo.sender?.name || 'Benutzer'}
                                            </Text>
                                            <Text className={`text-xs mt-0.5 ${isOwn ? 'text-blue-50' : 'text-gray-400'}`} numberOfLines={1}>
                                                {item.repliedTo.type === 'voice' ? '🎵 Sprachnachricht' : 
                                                item.repliedTo.type === 'image' ? '📷 Foto' : item.repliedTo.text}
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                    {isImageGroup ? (
                                        <View>
                                            {item.images.length === 1 ? (
                                                <TouchableOpacity 
                                                    activeOpacity={0.9} 
                                                    onPress={() => openGallery(item.images, 0)}
                                                >
                                                    <Image 
                                                        source={{ uri: getImageUrl(item.images[0].uri) }} 
                                                        className="w-48 h-48 rounded-xl bg-gray-900 border border-white/5"
                                                        resizeMode="cover"
                                                    />
                                                </TouchableOpacity>
                                            ) : item.images.length === 2 ? (
                                                <View className="flex-row gap-2">
                                                    {item.images.map((img: any, idx: number) => (
                                                        <TouchableOpacity 
                                                            key={img.id}
                                                            activeOpacity={0.9} 
                                                            onPress={() => openGallery(item.images, idx)}
                                                        >
                                                            <Image 
                                                                source={{ uri: getImageUrl(img.uri) }} 
                                                                className="w-[110px] h-[110px] rounded-xl bg-gray-900 border border-white/5"
                                                                resizeMode="cover"
                                                            />
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            ) : item.images.length === 3 ? (
                                                <View className="flex-row gap-2">
                                                    <TouchableOpacity 
                                                        activeOpacity={0.9} 
                                                        onPress={() => openGallery(item.images, 0)}
                                                    >
                                                        <Image 
                                                            source={{ uri: getImageUrl(item.images[0].uri) }} 
                                                            className="w-[110px] h-[228px] rounded-xl bg-gray-900 border border-white/5"
                                                            resizeMode="cover"
                                                        />
                                                    </TouchableOpacity>
                                                    <View className="flex-col gap-2">
                                                        <TouchableOpacity 
                                                            activeOpacity={0.9} 
                                                            onPress={() => openGallery(item.images, 1)}
                                                        >
                                                            <Image 
                                                                source={{ uri: getImageUrl(item.images[1].uri) }} 
                                                                className="w-[110px] h-[110px] rounded-xl bg-gray-900 border border-white/5"
                                                                resizeMode="cover"
                                                            />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity 
                                                            activeOpacity={0.9} 
                                                            onPress={() => openGallery(item.images, 2)}
                                                        >
                                                            <Image 
                                                                source={{ uri: getImageUrl(item.images[2].uri) }} 
                                                                className="w-[110px] h-[110px] rounded-xl bg-gray-900 border border-white/5"
                                                                resizeMode="cover"
                                                            />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ) : (
                                                <View className="flex-row flex-wrap gap-2 w-[228px]">
                                                    {item.images.slice(0, 4).map((img: any, idx: number) => {
                                                        const isLast = idx === 3 && item.images.length > 4;
                                                        return (
                                                            <TouchableOpacity 
                                                                key={img.id} 
                                                                activeOpacity={0.9} 
                                                                onPress={() => openGallery(item.images, idx)}
                                                            >
                                                                <View className="w-[110px] h-[110px] rounded-xl overflow-hidden relative border border-white/5 bg-gray-900">
                                                                    <Image 
                                                                        source={{ uri: getImageUrl(img.uri) }} 
                                                                        className="w-full h-full" 
                                                                        resizeMode="cover" 
                                                                    />
                                                                    {isLast && (
                                                                        <View className="absolute inset-0 bg-black/60 items-center justify-center">
                                                                            <Text className="text-white font-black text-xl">+{item.images.length - 3}</Text>
                                                                        </View>
                                                                    )}
                                                                </View>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            )}
                                            {/* Render captions/texts if any */}
                                            {item.images.map((img: any) => img.caption).filter((c: any) => !!c).map((cap: string, i: number) => (
                                                <Text key={i} className={`text-sm mt-1.5 leading-relaxed ${isOwn ? 'text-white font-semibold' : 'text-gray-200'}`}>
                                                    {cap}
                                                </Text>
                                            ))}
                                        </View>
                                    ) : isImage ? (
                                        <View>
                                            <TouchableOpacity 
                                                activeOpacity={0.9} 
                                                onPress={() => openGallery([{ id: item.id, uri: item.text, createdAt: item.createdAt }], 0)}
                                            >
                                                <Image 
                                                    source={{ uri: getImageUrl(item.text) }} 
                                                    className="w-48 h-48 rounded-xl bg-gray-900 border border-white/5"
                                                    resizeMode="cover"
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    ) : isVoice ? (
                                        <AudioPlayer audioUri={getImageUrl(item.text)} isOwn={isOwn} />
                                    ) : isFile ? (
                                        <View className="flex-row items-center py-2 pr-2">
                                            <FileIcon size={20} color={isOwn ? 'white' : '#3B82F6'} />
                                            <Text className={`ml-2 text-sm font-semibold underline ${isOwn ? 'text-white' : 'text-blue-400'}`} numberOfLines={1}>
                                                {item.caption || 'Datei öffnen'}
                                            </Text>
                                        </View>
                                    ) : (
                                        <Text className={`text-sm leading-relaxed ${isOwn ? 'text-white font-semibold' : 'text-gray-200'}`}>
                                            {item.text}
                                        </Text>
                                    )}
                                    <View className="flex-row justify-end items-center mt-1.5">
                                        <Text className={`text-[9px] font-bold ${isOwn ? 'text-blue-100/70' : 'text-gray-500'}`}>
                                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                        {isOwn && (
                                            <Text className={`text-[9px] ml-1 font-bold ${item.isRead ? 'text-blue-200' : 'text-blue-300'}`}>
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
        <SafeAreaView className="flex-1 bg-[#0a0a0c]">
            {/* Header */}
            <View className="flex-row items-center px-4 py-3 border-b border-white/5 bg-white/5 mt-10">
                {isSelectionMode ? (
                    <View className="flex-row flex-1 items-center justify-between">
                        <View className="flex-row items-center">
                            <TouchableOpacity onPress={() => { setIsSelectionMode(false); setSelectedMessages([]); }} className="mr-3">
                                <X size={24} color="#6B7280" />
                            </TouchableOpacity>
                            <Text className="text-base font-black text-white uppercase tracking-wider">
                                {selectedMessages.length} Ausgewählt
                            </Text>
                        </View>
                        <TouchableOpacity onPress={openForwardModal}>
                            <Share2 size={22} color="#3B82F6" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
                            <ArrowLeft size={22} color="#3B82F6" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            className="flex-row items-center flex-1"
                            onPress={() => {
                                if (isGroup) setIsGroupProfileModalVisible(true);
                                else setIsProfileModalVisible(true);
                            }}
                        >
                            <View className="w-10 h-10 rounded-full mr-3 bg-brand-blue/20 border border-brand-blue/30 items-center justify-center">
                                <Text className="text-blue-400 font-black text-sm uppercase tracking-wider">{getInitials(name)}</Text>
                            </View>
                            <View className="flex-1 mr-2">
                                <Text className="text-base font-black text-white leading-snug" numberOfLines={1}>{name}</Text>
                                {isTyping ? (
                                    <Text className="text-xs text-blue-400 font-bold">schreibt...</Text>
                                ) : (
                                    <Text className="text-[10px] text-gray-500 font-bold uppercase mt-0.5" numberOfLines={1}>{getStatusText()}</Text>
                                )}
                            </View>
                        </TouchableOpacity>

                        {!isGroup && (
                            <View className="flex-row items-center">
                                <TouchableOpacity onPress={() => startOutboundCall('audio')} className="p-2 mr-1">
                                    <Phone size={20} color="#3B82F6" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => startOutboundCall('video')} className="p-2">
                                    <Video size={20} color="#3B82F6" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}
            </View>

            <FlatList
                ref={flatListRef}
                data={groupedMessages}
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
                    className={`absolute right-4 bg-brand-blue w-10 h-10 rounded-full items-center justify-center shadow-lg shadow-blue-500/40 ${replyingTo ? 'bottom-48' : 'bottom-32'}`}
                    style={{ zIndex: 10 }}
                >
                    <ChevronDown size={22} color="white" />
                </TouchableOpacity>
            )}

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {replyingTo && (
                    <View className="flex-row items-center bg-black/40 px-4 py-3 border-t border-white/5">
                        <View className="flex-1 border-l-4 border-brand-blue pl-3">
                            <Text className="font-black text-[10px] text-blue-400 uppercase tracking-wider">{replyingTo.sender?.name || 'Antwort an'}</Text>
                            <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
                                {replyingTo.type === 'voice' ? '🎵 Sprachnachricht' : replyingTo.type === 'image' ? '📷 Foto' : replyingTo.text}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => setReplyingTo(null)} className="p-2 bg-white/5 rounded-full border border-white/5">
                            <X size={16} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                )}

                <View className="flex-row items-center px-4 py-3 border-t border-white/5 bg-[#0a0a0c]">
                    {recordingState === 'idle' && (
                        <TouchableOpacity onPress={handleAttachmentMenu} className="p-2.5 mr-2 bg-white/5 border border-white/5 rounded-full">
                            <ImageIcon size={20} color="#6B7280" />
                        </TouchableOpacity>
                    )}

                    {recordingState !== 'idle' ? (
                        <View className="flex-1 flex-row items-center justify-between bg-red-500/10 border border-red-500/20 rounded-full px-4 py-2.5 mr-2">
                            <View className="flex-row items-center">
                                <View className={`w-2.5 h-2.5 rounded-full mr-2 ${recordingState === 'recording' ? 'bg-red-500' : 'bg-gray-500'}`} />
                                <Text className={recordingState === 'recording' ? 'text-red-500 font-extrabold' : 'text-gray-500 font-extrabold'}>
                                    {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                                </Text>
                            </View>
                            {recordingState === 'recording' ? (
                                <Text className="text-gray-400 text-[10px] font-black uppercase text-right flex-1 ml-4" numberOfLines={1}>
                                    ← abbrechen | ↑ sperren
                                </Text>
                            ) : (
                                <TouchableOpacity onPress={() => stopRecording(true)}>
                                    <Text className="text-red-500 font-black text-xs uppercase tracking-wider">Löschen</Text>
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
                            placeholderTextColor="#4B5563"
                            className="flex-1 bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-white text-sm max-h-24"
                            multiline
                        />
                    )}

                    {inputText.trim() ? (
                        <TouchableOpacity onPress={sendMessage} className="ml-2 p-3 rounded-full bg-brand-blue shadow-lg shadow-blue-500/30">
                            <Send size={18} color="white" />
                        </TouchableOpacity>
                    ) : recordingState === 'locked' ? (
                        <TouchableOpacity onPress={() => stopRecording(false)} className="ml-2 p-3 rounded-full bg-brand-blue shadow-lg shadow-blue-500/30">
                            <Send size={18} color="white" />
                        </TouchableOpacity>
                    ) : (
                        <Animated.View style={{ transform: [{ translateX: pan.x }, { translateY: pan.y }] }}>
                            <View {...panResponder.panHandlers} className="ml-2 p-3 rounded-full bg-brand-blue shadow-lg shadow-blue-500/30">
                                <Mic size={18} color="white" />
                            </View>
                        </Animated.View>
                    )}
                </View>
            </KeyboardAvoidingView>

            {/* Swipeable Screen Image Gallery */}
            <ImageView
                images={galleryImages}
                imageIndex={activeGalleryIndex}
                visible={isGalleryVisible}
                onRequestClose={() => setIsGalleryVisible(false)}
                HeaderComponent={({ imageIndex }) => (
                    <SafeAreaView className="flex-row justify-between items-center px-6 py-3 mt-10">
                        <TouchableOpacity onPress={() => setIsGalleryVisible(false)} className="p-2 bg-black/60 rounded-full border border-white/10">
                            <X color="white" size={20} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => {
                                const currentImg = galleryImages[imageIndex];
                                setIsGalleryVisible(false);
                                startEditingImage(currentImg.uri, null);
                            }}
                            className="p-2.5 bg-blue-500 rounded-full border border-blue-600 shadow-lg shadow-blue-500/50"
                        >
                            <Edit2 color="white" size={18} />
                        </TouchableOpacity>
                    </SafeAreaView>
                )}
            />

            {/* Forwarding Modal */}
            <Modal visible={isForwardModalVisible} transparent={true} animationType="slide">
                <BlurView intensity={80} tint="dark" className="flex-1 justify-end">
                    <TouchableOpacity className="flex-1" onPress={() => setIsForwardModalVisible(false)} />
                    <GlassCard className="bg-[#0a0a0c] h-[70%] rounded-t-[40px] border-t border-white/10 p-6">
                        <View className="w-full pb-6 items-center">
                            <View className="w-12 h-1.5 bg-white/10 rounded-full" />
                        </View>
                        <View className="flex-row items-center justify-between mb-6">
                            <Text className="text-xl font-bold text-white uppercase tracking-widest">Weiterleiten an...</Text>
                            <TouchableOpacity onPress={() => setIsForwardModalVisible(false)}>
                                <Text className="text-gray-500 font-bold uppercase text-xs tracking-widest">Schließen</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={allConversations}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    className="flex-row items-center p-4 border border-white/5 bg-white/5 rounded-2xl mb-3"
                                    onPress={() => handleForward(item.id)}
                                >
                                    <View className="w-12 h-12 rounded-full bg-brand-blue/20 border border-brand-blue/30 items-center justify-center mr-3">
                                        <Text className="text-blue-400 font-black text-base uppercase tracking-wider">{getInitials(item.displayName)}</Text>
                                    </View>
                                    <View className="flex-1 pr-3">
                                        <Text className="text-sm font-black text-white" numberOfLines={1}>{item.displayName}</Text>
                                        <Text className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
                                            {item.isGroup ? 'Gruppe' : 'Privater Chat'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        />
                    </GlassCard>
                </BlurView>
            </Modal>

            {/* Preview Assets Modal */}
            <Modal visible={previewAssets.length > 0 && !isEditingImage} animationType="slide" transparent={false}>
                <SafeAreaView className="flex-1 bg-[#0a0a0c]">
                    <View className="flex-row justify-between items-center px-4 py-3">
                        <TouchableOpacity 
                            disabled={isUploading}
                            onPress={() => { setPreviewAssets([]); setUploadStatuses({}); }} 
                            className={`p-2 bg-white/5 rounded-full border border-white/5 ${isUploading ? 'opacity-50' : ''}`}
                        >
                            <X color="white" size={20} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            disabled={isUploading}
                            className={`p-2 bg-white/5 rounded-full border border-white/5 ${isUploading ? 'opacity-50' : ''}`}
                            onPress={pickImage}
                        >
                            <Edit2 color="white" size={20} />
                        </TouchableOpacity>
                    </View>
                    
                    <View className="flex-1 justify-center items-center px-6">
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            className="flex-row"
                            contentContainerStyle={{ alignItems: 'center' }}
                        >
                            {previewAssets.map((asset, index) => {
                                const status = uploadStatuses[asset.uri] || 'idle';
                                return (
                                    <View key={index} className={`w-64 h-96 mx-3 rounded-3xl overflow-hidden bg-black/40 border relative justify-center items-center ${status === 'error' ? 'border-red-500/50 shadow-lg shadow-red-500/10' : status === 'success' ? 'border-green-500/50 shadow-lg shadow-green-500/10' : 'border-white/10'}`}>
                                        {asset.mimeType.startsWith('image/') ? (
                                            <>
                                                <Image source={{ uri: asset.uri }} className="w-full h-full" resizeMode="contain" />
                                                {status !== 'uploading' && status !== 'success' && (
                                                    <TouchableOpacity 
                                                        onPress={() => {
                                                            startEditingImage(asset.uri, index);
                                                        }}
                                                        className="absolute bottom-4 right-4 bg-blue-500/80 w-10 h-10 rounded-full items-center justify-center shadow-lg"
                                                    >
                                                        <Edit2 color="white" size={18} />
                                                    </TouchableOpacity>
                                                )}
                                            </>
                                        ) : (
                                            <View className="p-8 items-center justify-center">
                                                <FileIcon size={64} color="#3B82F6" className="mb-4" />
                                                <Text className="text-white font-black uppercase text-[10px] tracking-widest text-center px-2" numberOfLines={2}>
                                                    {asset.name || 'Datei'}
                                                </Text>
                                            </View>
                                        )}
                                        
                                        {/* Real-time uploading spinners & status indicators */}
                                        {status === 'uploading' && (
                                            <BlurView intensity={60} tint="dark" className="absolute inset-0 items-center justify-center">
                                                <ActivityIndicator size="large" color="#3B82F6" />
                                                <Text className="text-white text-[10px] font-black uppercase tracking-widest mt-3">Hochladen...</Text>
                                            </BlurView>
                                        )}

                                        {status === 'success' && (
                                            <BlurView intensity={70} tint="dark" className="absolute inset-0 items-center justify-center bg-green-500/10">
                                                <View className="w-12 h-12 rounded-full bg-green-500 items-center justify-center shadow-lg shadow-green-500/50">
                                                    <Check size={28} color="white" />
                                                </View>
                                                <Text className="text-green-400 text-[10px] font-black uppercase tracking-widest mt-3">Erfolgreich</Text>
                                            </BlurView>
                                        )}

                                        {status === 'error' && (
                                            <BlurView intensity={70} tint="dark" className="absolute inset-0 items-center justify-center bg-red-500/10">
                                                <View className="w-12 h-12 rounded-full bg-red-500 items-center justify-center shadow-lg shadow-red-500/50">
                                                    <X size={28} color="white" />
                                                </View>
                                                <Text className="text-red-400 text-[10px] font-black uppercase tracking-widest mt-3">Fehlgeschlagen</Text>
                                            </BlurView>
                                        )}

                                        {/* Delete Button (only visible if not uploading/succeeded) */}
                                        {status !== 'uploading' && status !== 'success' && (
                                            <TouchableOpacity 
                                                onPress={() => removePreviewAsset(index)}
                                                className="absolute top-4 right-4 bg-red-500/80 w-8 h-8 rounded-full items-center justify-center shadow-lg"
                                            >
                                                <X color="white" size={16} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="p-4 bg-[#0a0a0c] border-t border-white/5">
                        <View className="flex-row items-center">
                            <TextInput
                                value={previewCaption}
                                onChangeText={setPreviewCaption}
                                placeholder="Bildunterschrift hinzufügen..."
                                placeholderTextColor="#4B5563"
                                className={`flex-1 bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-white text-sm max-h-24 ${isUploading ? 'opacity-50' : ''}`}
                                multiline
                                editable={!isUploading}
                            />
                            <TouchableOpacity 
                                disabled={isUploading || previewAssets.length === 0}
                                onPress={async () => {
                                    const assets = [...previewAssets];
                                    const caption = previewCaption;
                                    if (assets.length === 0) return;
                                    await uploadFiles(assets, caption);
                                }}
                                className={`ml-3 p-3 rounded-full bg-brand-blue shadow-lg shadow-blue-500/30 ${isUploading ? 'opacity-50' : ''}`}
                            >
                                <Send size={18} color="white" />
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>

            {/* Profile Modal */}
            <Modal visible={isProfileModalVisible} transparent={true} animationType="fade">
                <BlurView intensity={90} tint="dark" className="flex-1 justify-end bg-black/60">
                    <TouchableOpacity className="flex-1" onPress={() => setIsProfileModalVisible(false)} />
                    <GlassCard className="bg-[#0a0a0c] rounded-t-[40px] border-t border-white/10 p-6 items-center shadow-lg">
                        <TouchableOpacity 
                            className="absolute top-4 right-4 p-2 bg-white/5 border border-white/5 rounded-full z-10"
                            onPress={() => {
                                setIsProfileModalVisible(false);
                                if (selectedParticipantUser) {
                                    setSelectedParticipantUser(null);
                                    setIsGroupProfileModalVisible(true);
                                }
                            }}
                        >
                            <X size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                        
                        <View className="w-20 h-20 rounded-full mb-4 border-4 border-white/10 bg-brand-blue/20 items-center justify-center">
                            <Text className="text-blue-400 text-3xl font-black">{getInitials((selectedParticipantUser || otherUser)?.name || name)}</Text>
                        </View>
                        
                        <Text className="text-xl font-black text-white mb-1">{(selectedParticipantUser || otherUser)?.name || name}</Text>
                        <Text className="text-xs text-blue-400 font-extrabold uppercase mb-6 tracking-wider">{(selectedParticipantUser || otherUser)?.role?.name || 'Mitarbeiter'}</Text>
                        
                        <View className="w-full space-y-4">
                            <TouchableOpacity 
                                className="flex-row items-center bg-white/5 border border-white/5 p-4 rounded-2xl"
                                onPress={() => {
                                    const userToCall = selectedParticipantUser || otherUser;
                                    if (userToCall?.phone) {
                                        Linking.openURL(`tel:${userToCall.phone}`);
                                    } else {
                                        Alert.alert('Hinweis', 'Keine Telefonnummer hinterlegt.');
                                    }
                                }}
                            >
                                <View className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 items-center justify-center mr-4">
                                    <Phone size={18} color="#3B82F6" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Telefon</Text>
                                    <Text className="text-sm text-white font-extrabold mt-0.5">{(selectedParticipantUser || otherUser)?.phone || 'Nicht hinterlegt'}</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                className="flex-row items-center bg-white/5 border border-white/5 p-4 rounded-2xl"
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
                                <View className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 items-center justify-center mr-4">
                                    <Mail size={18} color="#3B82F6" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">E-Mail</Text>
                                    <Text className="text-sm text-white font-extrabold mt-0.5">{(selectedParticipantUser || otherUser)?.email || 'Nicht hinterlegt'}</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </GlassCard>
                </BlurView>
            </Modal>

            {/* Group Profile Modal */}
            <Modal visible={isGroupProfileModalVisible} transparent={true} animationType="fade">
                <BlurView intensity={90} tint="dark" className="flex-1 justify-end bg-black/60">
                    <TouchableOpacity className="flex-1" onPress={() => setIsGroupProfileModalVisible(false)} />
                    <GlassCard className="bg-[#0a0a0c] rounded-t-[40px] border-t border-white/10 p-6 shadow-lg max-h-[80%]">
                        <TouchableOpacity 
                            className="absolute top-4 right-4 p-2 bg-white/5 border border-white/5 rounded-full z-10"
                            onPress={() => setIsGroupProfileModalVisible(false)}
                        >
                            <X size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                        
                        <View className="items-center mb-6">
                            <View className="w-20 h-20 rounded-full mb-4 border-4 border-white/10 bg-brand-blue/20 items-center justify-center">
                                <Text className="text-blue-400 text-3xl font-black">{getInitials(name)}</Text>
                            </View>
                            <Text className="text-xl font-black text-white mb-1">{name}</Text>
                            <Text className="text-xs text-gray-500 font-bold uppercase tracking-wider">{participants?.length || 0} Mitglieder</Text>
                        </View>
                        
                        <Text className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-1">Mitglieder</Text>
                        
                        <ScrollView className="mb-4" showsVerticalScrollIndicator={false}>
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
                                        className="flex-row items-center bg-white/5 border border-white/5 p-3 rounded-2xl mb-2"
                                    >
                                        <View className="w-10 h-10 rounded-full bg-brand-blue/20 border border-brand-blue/30 items-center justify-center mr-3">
                                            <Text className="text-blue-400 font-black text-sm uppercase tracking-wider">{getInitials(p.user?.name || 'U')}</Text>
                                        </View>
                                        <View className="flex-1 pr-3">
                                            <Text className="font-extrabold text-sm text-white" numberOfLines={1}>
                                                {p.user?.name || 'Benutzer'} {isMe ? '(Du)' : ''}
                                            </Text>
                                            <Text className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{p.user?.role?.name || 'Mitarbeiter'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <TouchableOpacity 
                            onPress={leaveGroup}
                            className="bg-red-500/10 py-4 rounded-xl items-center border border-red-500/20"
                        >
                            <Text className="text-red-500 font-black uppercase text-xs tracking-widest">Gruppe verlassen</Text>
                        </TouchableOpacity>
                    </GlassCard>
                </BlurView>
            </Modal>

            {/* Image Editor Modal */}
            <Modal visible={isEditingImage} animationType="slide" transparent={false}>
                <SafeAreaView className="flex-1 bg-black justify-between">
                    {/* Header */}
                    <View className="flex-row justify-between items-center px-4 py-3 border-b border-white/5">
                        <TouchableOpacity 
                            disabled={isUploading}
                            onPress={() => {
                                setIsEditingImage(false);
                                setEditingImageUri('');
                                setEditingAssetIndex(null);
                                setPaths([]);
                                setCurrentPath([]);
                                setIsDrawingMode(false);
                            }}
                            className="p-2 bg-white/5 rounded-full border border-white/5"
                        >
                            <X color="white" size={20} />
                        </TouchableOpacity>
                        
                        <Text className="text-white font-black text-sm uppercase tracking-widest">Bild bearbeiten</Text>
                        
                        <TouchableOpacity 
                            disabled={isUploading}
                            onPress={handleSaveEditedImage}
                            className="px-4 py-2 bg-blue-500 rounded-full shadow-lg shadow-blue-500/30"
                        >
                            <Text className="text-white font-black text-xs uppercase tracking-wider">
                                {isUploading ? 'Speichern...' : 'Fertig'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Canvas Area */}
                    <View className="flex-1 justify-center items-center p-6 relative">
                        <ScrollView 
                            maximumZoomScale={4}
                            minimumZoomScale={1}
                            scrollEnabled={!isDrawingMode}
                            showsHorizontalScrollIndicator={false}
                            showsVerticalScrollIndicator={false}
                            className="w-full h-full"
                            contentContainerStyle={{ justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}
                        >
                            <View 
                                onLayout={(e) => {
                                    const { width, height } = e.nativeEvent.layout;
                                    setImageLayout({ width: width || 1, height: height || 1 });
                                }}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                className="w-full h-[60%] bg-black/40 justify-center items-center relative overflow-hidden rounded-3xl border border-white/5"
                                style={{ aspectRatio: 1 }}
                            >
                                {editingImageUri ? (
                                    <Image 
                                        source={{ uri: editingImageUri }} 
                                        className="w-full h-full" 
                                        resizeMode="contain" 
                                    />
                                ) : null}
                                
                                {/* Drawing Overlay */}
                                <Svg className="absolute inset-0 w-full h-full" pointerEvents="none">
                                    {paths.map((p, idx) => (
                                        <Path
                                            key={idx}
                                            d={getPathString(p.points)}
                                            fill="none"
                                            stroke={p.color}
                                            strokeWidth={p.width}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    ))}
                                    {currentPath.length > 0 && (
                                        <Path
                                            d={getPathString(currentPath)}
                                            fill="none"
                                            stroke={drawColor}
                                            strokeWidth={drawWidth}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    )}
                                </Svg>
                            </View>
                        </ScrollView>
                    </View>

                    {/* Toolbar */}
                    <View className="p-4 bg-white/5 border-t border-white/5">
                        {/* Drawing controls */}
                        {isDrawingMode && (
                            <View className="flex-row justify-center items-center gap-3 mb-4">
                                {['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#FFFFFF'].map((color) => (
                                    <TouchableOpacity
                                        key={color}
                                        onPress={() => setDrawColor(color)}
                                        className={`w-8 h-8 rounded-full border-2 justify-center items-center`}
                                        style={{ backgroundColor: color, borderColor: drawColor === color ? '#3B82F6' : 'transparent' }}
                                    >
                                        {drawColor === color && (
                                            <View className="w-2.5 h-2.5 rounded-full bg-black/40" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity 
                                    onPress={() => setPaths([])}
                                    className="ml-3 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full"
                                >
                                    <Text className="text-red-400 font-bold text-[10px] uppercase tracking-wider">Löschen</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Main Tools Row */}
                        <View className="flex-row justify-around items-center py-2">
                            <TouchableOpacity 
                                onPress={() => setIsDrawingMode(!isDrawingMode)}
                                className="items-center"
                            >
                                <View className={`p-3 rounded-full border ${isDrawingMode ? 'bg-blue-500/20 border-blue-500' : 'bg-white/5 border-white/5'}`}>
                                    <Edit2 color={isDrawingMode ? '#3B82F6' : 'white'} size={20} />
                                </View>
                                <Text className="text-[10px] text-gray-400 font-bold uppercase mt-1">Zeichnen</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={handleRotate}
                                className="items-center"
                            >
                                <View className="p-3 rounded-full bg-white/5 border border-white/5">
                                    <ChevronDown color="white" size={20} style={{ transform: [{ rotate: '-90deg' }] }} />
                                </View>
                                <Text className="text-[10px] text-gray-400 font-bold uppercase mt-1">Drehen</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={handleFlip}
                                className="items-center"
                            >
                                <View className="p-3 rounded-full bg-white/5 border border-white/5">
                                    <FlipHorizontal color="white" size={20} />
                                </View>
                                <Text className="text-[10px] text-gray-400 font-bold uppercase mt-1">Spiegeln</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </SafeAreaView>

                {/* Hidden WebView for canvas flattening */}
                {isFlattening && flattenPayload && (
                    <View style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}>
                        <WebView
                            ref={webViewRef}
                            source={{ html: `
                              <!DOCTYPE html>
                              <html>
                              <head>
                                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                                <style>
                                  body { margin: 0; padding: 0; background: black; display: flex; justify-content: center; align-items: center; height: 100vh; }
                                  canvas { max-width: 100%; max-height: 100%; object-fit: contain; }
                                </style>
                              </head>
                              <body>
                                <canvas id="canvas"></canvas>
                                <script>
                                  setTimeout(() => {
                                    try {
                                      const data = ${JSON.stringify(flattenPayload)};
                                      const img = new Image();
                                      img.src = data.base64Image;
                                      img.onload = () => {
                                        const canvas = document.getElementById('canvas');
                                        const ctx = canvas.getContext('2d');
                                        
                                        canvas.width = img.width;
                                        canvas.height = img.height;
                                        ctx.drawImage(img, 0, 0);
                                        
                                        data.paths.forEach(path => {
                                          if (path.points.length < 1) return;
                                          
                                          ctx.beginPath();
                                          ctx.strokeStyle = path.color;
                                          ctx.lineWidth = path.width * (img.width / data.layoutWidth);
                                          ctx.lineCap = 'round';
                                          ctx.lineJoin = 'round';
                                          
                                          ctx.moveTo(path.points[0].x * img.width, path.points[0].y * img.height);
                                          for (let i = 1; i < path.points.length; i++) {
                                            ctx.lineTo(path.points[i].x * img.width, path.points[i].y * img.height);
                                          }
                                          ctx.stroke();
                                        });
                                        
                                        const result = canvas.toDataURL('image/jpeg', 0.9);
                                        window.ReactNativeWebView.postMessage(result);
                                      };
                                    } catch (err) {
                                      window.ReactNativeWebView.postMessage(JSON.stringify({ error: err.message }));
                                    }
                                  }, 100);
                                </script>
                              </body>
                              </html>
                            ` }}
                            onMessage={handleWebViewMessage}
                            originWhitelist={['*']}
                            allowFileAccess={true}
                        />
                    </View>
                )}
            </Modal>

            {/* WebView-based calling overlay */}
            <Modal visible={isCallModalVisible} transparent={false} animationType="slide">
                <View style={{ flex: 1, backgroundColor: '#050507' }}>
                    {isCallModalVisible && activeCall && token && (
                        <WebView
                            originWhitelist={['*']}
                            source={{
                                html: getCallHtml(
                                    token,
                                    activeCall.type,
                                    activeCall.direction,
                                    activeCall.remoteUser,
                                    user,
                                    activeCall.remotePeerId
                                )
                            }}
                            style={{ flex: 1, backgroundColor: 'transparent' }}
                            allowsInlineMediaPlayback={true}
                            mediaPlaybackRequiresUserAction={false}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                            mediaCapturePermissionGrantType="grant"
                            onMessage={async (event) => {
                                try {
                                    const data = JSON.parse(event.nativeEvent.data);
                                    console.log('WebView calling notification received:', data);
                                    
                                    if (data.type === 'finished') {
                                        setIsCallModalVisible(false);
                                        setActiveCall(null);
                                        setIncomingCall(null);
                                    } else if (data.type === 'declined') {
                                        socketService.emit('call:response', {
                                            targetUserId: data.payload.targetUserId,
                                            accepted: false
                                        });
                                        setIsCallModalVisible(false);
                                        setActiveCall(null);
                                        setIncomingCall(null);
                                    } else if (data.type === 'error') {
                                        if (activeCall?.remoteUser?.id) {
                                            socketService.emit('call:end', { targetUserId: activeCall.remoteUser.id });
                                        }
                                        Alert.alert('Fehler', data.payload);
                                        setIsCallModalVisible(false);
                                        setActiveCall(null);
                                        setIncomingCall(null);
                                    } else if (data.type === 'log_end') {
                                        const duration = Number(data.payload);
                                        const mins = Math.floor(duration / 60);
                                        const secs = duration % 60;
                                        const durStr = `${mins}:${secs.toString().padStart(2, '0')}`;
                                        
                                        await apiClient.post(`/chat/conversations/${conversationId}/messages`, {
                                            text: `📞 ${activeCall.type === 'video' ? 'Videoanruf' : 'Audioanruf'} beendet (${durStr})`
                                        });
                                        fetchMessages();
                                    } else if (data.type === 'log_missed') {
                                        await apiClient.post(`/chat/conversations/${conversationId}/messages`, {
                                            text: `📴 Verpasster ${activeCall.type === 'video' ? 'Videoanruf' : 'Audioanruf'}`
                                        });
                                        fetchMessages();
                                    }
                                } catch (e) {
                                    console.error('Error parsing WebView message:', e);
                                }
                            }}
                        />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const getCallHtml = (
    token: string,
    callType: 'audio' | 'video',
    callDirection: 'in' | 'out',
    remoteUser: any,
    currentUser: any,
    remotePeerId?: string
) => {
    const callerDisplayName = currentUser ? (
        (currentUser.firstName && currentUser.lastName) 
            ? `${currentUser.firstName} ${currentUser.lastName}` 
            : (currentUser.name || currentUser.username || 'Mitarbeiter')
    ) : 'Mitarbeiter';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet" />
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            background-color: #050507;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            overflow: hidden;
            height: 100vh;
            width: 100vw;
        }
        .pulsing-bg {
            background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(5,5,7,1) 70%);
            animation: pulse-glow 4s infinite alternate;
        }
        @keyframes pulse-glow {
            0% { transform: scale(1); opacity: 0.8; }
            100% { transform: scale(1.1); opacity: 1; }
        }
        .pulsing-avatar {
            animation: pulse-avatar 2s infinite ease-in-out;
        }
        @keyframes pulse-avatar {
            0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
            70% { box-shadow: 0 0 0 20px rgba(59, 130, 246, 0); }
            100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
    </style>
</head>
<body class="flex flex-col items-center justify-between p-8 relative overflow-hidden bg-[#050507]">
    <div class="absolute inset-0 pulsing-bg z-0 pointer-events-none"></div>

    <!-- Header Details -->
    <div class="w-full flex flex-col items-center mt-12 z-10">
        <div class="relative w-28 h-28 rounded-full mb-6 flex items-center justify-center bg-blue-600/10 border border-blue-500/30 shadow-2xl overflow-hidden pulsing-avatar">
            <div id="avatarText" class="text-3xl font-black text-blue-400 uppercase tracking-widest">
                ${remoteUser && remoteUser.name ? remoteUser.name.charAt(0) : 'U'}
            </div>
        </div>
        <h2 id="callerName" class="text-2xl font-bold tracking-tight text-white mb-2 text-center w-full px-6 truncate">${remoteUser && remoteUser.name ? remoteUser.name : 'Unbekannt'}</h2>
        <p id="callStatus" class="text-blue-400 font-semibold uppercase tracking-wider text-xs animate-pulse">
            ${callDirection === 'out' 
                ? (callType === 'video' ? 'Videoanruf...' : 'Audioanruf...') 
                : (callType === 'video' ? 'Eingehender Videoanruf' : 'Eingehender Audioanruf')}
        </p>
        
        <!-- Timer -->
        <div id="callTimer" class="hidden px-5 py-2.5 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl mt-4 flex items-center gap-3">
            <div class="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
            <span id="timerText" class="text-white/60 font-mono text-xl tracking-widest">00:00</span>
        </div>
    </div>

    <!-- Video Streams Container -->
    <div class="absolute inset-0 w-full h-full z-0">
        <!-- Remote Video -->
        <video id="remoteVideo" class="w-full h-full object-cover hidden" autoplay playsinline></video>
        
        <!-- Local Video PIP -->
        <div id="localVideoContainer" class="absolute bottom-32 right-6 w-32 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl hidden z-20">
            <video id="localVideo" class="w-full h-full object-cover" autoplay playsinline muted></video>
            <div id="videoOffPlaceholder" class="absolute inset-0 bg-[#0a0a0c] flex items-center justify-center hidden">
                <i class="fa-solid fa-video-slash text-white/30 text-xl"></i>
            </div>
        </div>
    </div>

    <!-- Incoming Call Accept/Decline Controls -->
    <div id="incomingControls" class="w-full flex items-center justify-between gap-6 px-4 z-10 mb-12 hidden">
        <button id="declineBtn" class="flex-1 h-16 rounded-2xl bg-red-600/20 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all text-xl">
            <i class="fa-solid fa-xmark"></i>
        </button>
        <button id="acceptBtn" class="flex-[2] h-16 rounded-2xl bg-green-600 text-white shadow-2xl shadow-green-600/40 flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all text-lg font-bold">
            <i class="fa-solid fa-phone"></i>
            <span>Annehmen</span>
        </button>
    </div>

    <!-- Active Call / Outgoing Controls -->
    <div id="activeControls" class="flex items-center justify-center gap-6 z-10 mb-12 w-full">
        <!-- Audio Mute -->
        <button id="muteBtn" class="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all text-xl">
            <i class="fa-solid fa-microphone"></i>
        </button>
        
        <!-- Video Toggle -->
        <button id="cameraBtn" class="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all text-xl hidden">
            <i class="fa-solid fa-video"></i>
        </button>

        <!-- End Call -->
        <button id="endCallBtn" class="w-20 h-20 rounded-3xl bg-red-600 text-white shadow-2xl shadow-red-600/40 flex items-center justify-center hover:scale-110 active:scale-90 transition-all text-2xl">
            <i class="fa-solid fa-phone-slash rotate-[135deg]"></i>
        </button>
    </div>

    <script>
        const socketServerUrl = "${serverDomain}";
        const token = "${token}";
        const callType = "${callType}";
        const callDirection = "${callDirection}";
        const targetUserId = "${remoteUser.id}";
        const myPeerId = "mobile_" + "${currentUser.id}" + "_" + Math.random().toString(36).substr(2, 5);
        let remotePeerId = "${remotePeerId || ''}";

        let socket, peer, localStream, activeCallObj;
        let isMuted = false;
        let isCameraOff = false;
        let callTimerInterval;
        let callDuration = 0;

        // UI Elements
        const callStatus = document.getElementById("callStatus");
        const callTimer = document.getElementById("callTimer");
        const timerText = document.getElementById("timerText");
        const remoteVideo = document.getElementById("remoteVideo");
        const localVideo = document.getElementById("localVideo");
        const localVideoContainer = document.getElementById("localVideoContainer");
        const videoOffPlaceholder = document.getElementById("videoOffPlaceholder");
        
        const incomingControls = document.getElementById("incomingControls");
        const activeControls = document.getElementById("activeControls");
        
        const muteBtn = document.getElementById("muteBtn");
        const cameraBtn = document.getElementById("cameraBtn");
        const endCallBtn = document.getElementById("endCallBtn");
        const acceptBtn = document.getElementById("acceptBtn");
        const declineBtn = document.getElementById("declineBtn");

        // Notify React Native
        function notifyRN(type, payload) {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
            }
        }

        // Initialize Audio/Video Devices
        async function getMediaStream() {
            try {
                const constraints = {
                    audio: true,
                    video: callType === "video"
                };
                localStream = await navigator.mediaDevices.getUserMedia(constraints);
                localVideo.srcObject = localStream;
                if (callType === "video") {
                    localVideoContainer.classList.remove("hidden");
                    cameraBtn.classList.remove("hidden");
                }
                return localStream;
            } catch (err) {
                console.error("Failed to capture local media stream:", err);
                notifyRN("error", "Kamera- oder Mikrofonzugriff verweigert.");
            }
        }

        // Setup Signaling Socket & Peer
        function initSignaling() {
            socket = io(socketServerUrl, {
                auth: { token },
                transports: ["websocket"]
            });

            peer = new Peer(myPeerId, {
                config: {
                    iceServers: [
                        { urls: "stun:stun.l.google.com:19302" },
                        { urls: "stun:stun1.l.google.com:19302" },
                        { urls: "stun:stun2.l.google.com:19302" }
                    ]
                }
            });

            peer.on("open", (id) => {
                console.log("PeerJS open with ID:", id);
                if (callDirection === "out") {
                    // Send call request once peer is open
                    socket.emit("call:request", {
                        targetUserId: targetUserId,
                        peerId: myPeerId,
                        type: callType,
                        callerName: "${callerDisplayName}"
                    });
                }
            });

            peer.on("call", async (call) => {
                console.log("Incoming PeerJS call...");
                activeCallObj = call;
                if (!localStream) {
                    await getMediaStream();
                }
                call.answer(localStream);
                
                call.on("stream", (remoteStream) => {
                    console.log("Received remote stream inside call.on('stream')");
                    remoteVideo.srcObject = remoteStream;
                    remoteVideo.classList.remove("hidden");
                    startCallTimer();
                });

                call.on("close", () => {
                    handleCallFinished();
                });
            });

            // Socket Listeners
            socket.on("call:answered", async (data) => {
                console.log("Call response received:", data);
                if (data.accepted) {
                    remotePeerId = data.peerId;
                    callStatus.innerText = "Verbinde...";
                    establishConnection();
                } else {
                    notifyRN("log_missed", "abgelehnt");
                    handleCallFinished();
                }
            });

            socket.on("call:finished", () => {
                handleCallFinished();
            });

            socket.on("connect_error", (err) => {
                console.error("Socket connect error:", err);
            });
        }

        async function establishConnection() {
            if (!localStream) {
                await getMediaStream();
            }
            console.log("Calling remote peer:", remotePeerId);
            const call = peer.call(remotePeerId, localStream);
            activeCallObj = call;

            call.on("stream", (remoteStream) => {
                console.log("Received remote stream inside peer.call()");
                remoteVideo.srcObject = remoteStream;
                remoteVideo.classList.remove("hidden");
                startCallTimer();
            });

            call.on("close", () => {
                handleCallFinished();
            });

            call.on("error", (err) => {
                console.error("Call connection error:", err);
                handleCallFinished();
            });
        }

        function startCallTimer() {
            callStatus.classList.add("hidden");
            callTimer.classList.remove("hidden");
            
            clearInterval(callTimerInterval);
            callTimerInterval = setInterval(() => {
                callDuration++;
                const mins = Math.floor(callDuration / 60).toString().padStart(2, "0");
                const secs = (callDuration % 60).toString().padStart(2, "0");
                timerText.innerText = mins + ":" + secs;
                
                // Keep screen active
                notifyRN("tick", callDuration);
            }, 1000);
        }

        function handleCallFinished() {
            clearInterval(callTimerInterval);
            
            // Log call to history if caller
            if (callDirection === "out" && callDuration > 0) {
                notifyRN("log_end", callDuration);
            } else if (callDirection === "out" && callDuration === 0) {
                notifyRN("log_missed", "verpasst");
            }

            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            if (activeCallObj) {
                activeCallObj.close();
            }
            if (peer) {
                peer.destroy();
            }
            if (socket) {
                socket.disconnect();
            }
            notifyRN("finished", "success");
        }

        // Outbound Initialization
        if (callDirection === "out") {
            getMediaStream().then(() => {
                initSignaling();
            });
        } else {
            // Incoming Screen Layout
            incomingControls.classList.remove("hidden");
            activeControls.classList.add("hidden");
        }

        // Outbound/Call End Event
        endCallBtn.addEventListener("click", () => {
            console.log("Ending call locally...");
            socket.emit("call:end", { targetUserId: targetUserId });
            handleCallFinished();
        });

        // Decline Incoming
        declineBtn.addEventListener("click", () => {
            console.log("Declining call via native socket...");
            notifyRN("declined", { targetUserId: targetUserId });
        });

        // Accept Incoming
        acceptBtn.addEventListener("click", async () => {
            console.log("Accepting call...");
            incomingControls.classList.add("hidden");
            activeControls.classList.remove("hidden");
            callStatus.innerText = "Verbinde...";
            
            await getMediaStream();
            initSignaling();

            socket.emit("call:response", {
                targetUserId: targetUserId,
                accepted: true,
                peerId: myPeerId
            });
        });

        // In-Call Features Toggle
        muteBtn.addEventListener("click", () => {
            isMuted = !isMuted;
            if (localStream && localStream.getAudioTracks().length > 0) {
                localStream.getAudioTracks()[0].enabled = !isMuted;
            }
            muteBtn.classList.toggle("bg-red-600/20");
            muteBtn.classList.toggle("text-red-500");
            muteBtn.classList.toggle("border-red-500/50");
            muteBtn.innerHTML = isMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
        });

        cameraBtn.addEventListener("click", () => {
            isCameraOff = !isCameraOff;
            if (localStream && localStream.getVideoTracks().length > 0) {
                localStream.getVideoTracks()[0].enabled = !isCameraOff;
            }
            videoOffPlaceholder.classList.toggle("hidden");
            cameraBtn.classList.toggle("bg-red-600/20");
            cameraBtn.classList.toggle("text-red-500");
            cameraBtn.classList.toggle("border-red-500/50");
            cameraBtn.innerHTML = isCameraOff ? '<i class="fa-solid fa-video-slash"></i>' : '<i class="fa-solid fa-video"></i>';
        });
    </script>
</body>
</html>
`;
};

