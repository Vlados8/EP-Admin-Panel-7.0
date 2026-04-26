import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Image, SafeAreaView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Send, ArrowLeft, Image as ImageIcon } from 'lucide-react-native';
import { apiClient, serverDomain } from '../api/client';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socket';

export default function ChatDetailScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation();
    const { conversationId, name, avatar } = route.params;
    const { user } = useAuth();
    
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    const fetchMessages = async () => {
        try {
            const res = await apiClient.get(`/chat/conversations/${conversationId}/messages`);
            setMessages(res.data.data.messages);
        } catch (err) {
            console.error('Error fetching messages:', err);
        }
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

        socketService.on('new_message', handleNewMessage);
        socketService.on('messages_read', handleMessagesRead);
        socketService.on('user_typing', handleTyping);

        return () => {
            socketService.emit('leave_conversation', conversationId);
            socketService.off('new_message', handleNewMessage);
            socketService.off('messages_read', handleMessagesRead);
            socketService.off('user_typing', handleTyping);
        };
    }, [conversationId]);

    const sendMessage = async () => {
        if (!inputText.trim()) return;
        
        const tempText = inputText;
        setInputText('');
        
        // Optimistic UI
        const optimisticMsg = {
            id: Date.now().toString(),
            text: tempText,
            senderId: user?.id,
            type: 'text',
            createdAt: new Date().toISOString(),
            isRead: false
        };
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const res = await apiClient.post(`/chat/conversations/${conversationId}/messages`, {
                text: tempText,
                type: 'text'
            });
            // Update optimistic msg with real msg
            setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? res.data.data.message : m));
        } catch (err) {
            console.error('Error sending message:', err);
            // Revert on error
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
            setInputText(tempText);
        }
    };

    const getImageUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/')) return `${serverDomain}${url}`;
        return `${serverDomain}/${url}`;
    };

    const renderMessage = ({ item, index }: { item: any, index: number }) => {
        const isOwn = item.senderId === user?.id;
        const isImage = item.type === 'image';
        
        return (
            <View className={`flex-row my-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <View 
                    className={`max-w-[80%] px-4 py-2 rounded-2xl ${isOwn ? 'bg-blue-500 rounded-tr-sm' : 'bg-gray-100 dark:bg-gray-800 rounded-tl-sm'}`}
                >
                    {isImage ? (
                        <Image 
                            source={{ uri: getImageUrl(item.text) }} 
                            className="w-48 h-48 rounded-xl bg-gray-200"
                            resizeMode="cover"
                        />
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
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-[#0a0a0c]">
            {/* Header */}
            <View className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800 mt-10">
                <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
                    <ArrowLeft size={24} color="#3B82F6" />
                </TouchableOpacity>
                <Image source={{ uri: avatar }} className="w-10 h-10 rounded-full mr-3" />
                <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white">{name}</Text>
                    {isTyping && <Text className="text-xs text-blue-500">schreibt...</Text>}
                </View>
            </View>

            {/* Messages */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id.toString()}
                renderItem={renderMessage}
                contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: 'flex-end' }}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            {/* Input Area */}
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <View className="flex-row items-center px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#0a0a0c]">
                    <TouchableOpacity className="p-2 mr-2">
                        <ImageIcon size={24} color="#6B7280" />
                    </TouchableOpacity>
                    <TextInput
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
                    <TouchableOpacity 
                        onPress={sendMessage}
                        disabled={!inputText.trim()}
                        className={`ml-2 p-3 rounded-full ${inputText.trim() ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-800'}`}
                    >
                        <Send size={20} color={inputText.trim() ? "white" : "#9CA3AF"} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
