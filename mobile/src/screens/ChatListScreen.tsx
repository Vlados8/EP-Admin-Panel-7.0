import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, SafeAreaView } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MessageCircle, Users } from 'lucide-react-native';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socket';

export default function ChatListScreen() {
    const { user } = useAuth();
    const navigation = useNavigation();
    const [conversations, setConversations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchConversations = async () => {
        try {
            const res = await apiClient.get('/chat/conversations');
            const rawConvs = res.data.data.conversations || [];
            
            // Sort by most recent activity
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
                name: c.isGroup ? c.name : c.participants.find(p => p.userId !== user?.id)?.user?.name || 'Unbekannt',
                avatar: c.isGroup
                    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || 'G')}&background=random&color=fff`
                    : c.participants.find(p => p.userId !== user?.id)?.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.participants.find(p => p.userId !== user?.id)?.user?.name || 'U')}&background=random&color=fff`,
                lastMessage: c.messages?.[0]?.text || 'Keine Nachrichten',
                time: c.messages?.[0] ? new Date(c.messages[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                online: c.isOnline,
                unread: c.unreadCount || 0
            }));
            
            setConversations(data);
        } catch (err) {
            console.error('Error fetching conversations:', err);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchConversations();
            
            socketService.connect();

            const handleNewMessage = (data: any) => {
                fetchConversations();
            };

            socketService.on('new_message', handleNewMessage);
            socketService.on('messages_read', handleNewMessage);
            socketService.on('user_online', handleNewMessage);
            socketService.on('user_offline', handleNewMessage);

            return () => {
                socketService.off('new_message', handleNewMessage);
                socketService.off('messages_read', handleNewMessage);
                socketService.off('user_online', handleNewMessage);
                socketService.off('user_offline', handleNewMessage);
            };
        }, [user])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchConversations();
    }, []);

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity 
            className="flex-row items-center p-4 border-b border-gray-100 dark:border-gray-800"
            onPress={() => navigation.navigate('ChatDetail' as never, { conversationId: item.id, name: item.name, isGroup: item.isGroup, avatar: item.avatar } as never)}
        >
            <View className="relative">
                <Image 
                    source={{ uri: item.avatar }} 
                    className="w-12 h-12 rounded-full"
                />
                {item.online && (
                    <View className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                )}
            </View>
            <View className="flex-1 ml-3">
                <View className="flex-row justify-between items-center mb-1">
                    <Text className="font-bold text-gray-900 dark:text-white" numberOfLines={1}>
                        {item.name}
                    </Text>
                    <Text className="text-xs text-gray-500">{item.time}</Text>
                </View>
                <View className="flex-row justify-between items-center">
                    <Text className="text-sm text-gray-600 dark:text-gray-400 flex-1" numberOfLines={1}>
                        {item.lastMessage}
                    </Text>
                    {item.unread > 0 && (
                        <View className="bg-blue-500 rounded-full min-w-[20px] h-5 items-center justify-center px-1 ml-2">
                            <Text className="text-white text-xs font-bold">{item.unread}</Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-[#0a0a0c]">
            <View className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-row justify-between items-center mt-10">
                <Text className="text-2xl font-bold text-gray-900 dark:text-white">Chats</Text>
                <TouchableOpacity className="p-2 bg-gray-100 dark:bg-white/10 rounded-full">
                    <Users size={20} color="#3B82F6" />
                </TouchableOpacity>
            </View>
            <FlatList
                data={conversations}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
                }
                ListEmptyComponent={
                    !isLoading ? (
                        <View className="flex-1 items-center justify-center p-8 mt-20">
                            <MessageCircle size={48} color="#9CA3AF" />
                            <Text className="text-gray-500 mt-4 text-center">Keine Nachrichten vorhanden</Text>
                        </View>
                    ) : null
                }
            />
        </SafeAreaView>
    );
}
