import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, SafeAreaView, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MessageCircle, Users, Plus, X, Search } from 'lucide-react-native';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socket';

export default function ChatListScreen() {
    const { user } = useAuth();
    const navigation = useNavigation();
    const [conversations, setConversations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // New Chat State
    const [isNewChatModalVisible, setIsNewChatModalVisible] = useState(false);
    const [usersList, setUsersList] = useState<any[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Group Creation State
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isCreatingGroupLoading, setIsCreatingGroupLoading] = useState(false);

    const getInitials = (fullName: string) => {
        if (!fullName) return 'U';
        const parts = fullName.trim().split(' ');
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return parts[0][0].toUpperCase();
    };

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

            const data = sortedRaw.map(c => {
                const otherUser = c.isGroup ? null : c.participants.find((p: any) => p.userId !== user?.id)?.user;
                return {
                    ...c,
                    otherUser,
                    name: c.isGroup ? c.name : otherUser?.name || 'Unbekannt',
                    avatar: c.isGroup
                        ? `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || 'G')}&background=random&color=fff`
                        : otherUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.name || 'U')}&background=random&color=fff`,
                    lastMessage: c.messages?.[0]?.text || 'Keine Nachrichten',
                    time: c.messages?.[0] ? new Date(c.messages[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                    online: c.isOnline,
                    unread: c.unreadCount || 0
                };
            });
            
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

    const fetchUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const res = await apiClient.get('/users');
            if (res.data?.status === 'success' || res.data?.success) {
                const filteredUsers = res.data.data.users.filter((u: any) => u.id !== user?.id);
                setUsersList(filteredUsers);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const openNewChatModal = () => {
        setIsNewChatModalVisible(true);
        if (usersList.length === 0) {
            fetchUsers();
        }
    };

    const startNewChat = async (targetUserId: string) => {
        try {
            const res = await apiClient.post('/chat/conversations/direct', { targetUserId });
            if (res.data?.success) {
                closeNewChatModal();
                const conv = res.data.data.conversation;
                const otherParticipant = conv.participants.find((p: any) => p.userId !== user?.id)?.user;
                
                (navigation as any).navigate('ChatDetail', {
                    conversationId: conv.id,
                    name: otherParticipant?.name || 'Unbekannt',
                    isGroup: conv.isGroup,
                    avatar: otherParticipant?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherParticipant?.name || 'U')}&background=random&color=fff`,
                    otherUser: otherParticipant,
                    isOnline: false
                });
            }
        } catch (err) {
            console.error('Error creating direct chat:', err);
        }
    };

    const toggleUserSelection = (id: string) => {
        setSelectedUserIds(prev => 
            prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
        );
    };

    const createGroupChat = async () => {
        if (!groupName.trim()) {
            Alert.alert('Fehler', 'Bitte geben Sie einen Gruppennamen ein.');
            return;
        }
        if (selectedUserIds.length === 0) {
            Alert.alert('Fehler', 'Bitte wählen Sie mindestens einen Teilnehmer aus.');
            return;
        }

        setIsCreatingGroupLoading(true);
        try {
            const res = await apiClient.post('/chat/conversations/group', {
                name: groupName.trim(),
                userIds: selectedUserIds
            });
            if (res.data?.success) {
                closeNewChatModal();
                
                const conv = res.data.data.conversation;
                (navigation as any).navigate('ChatDetail', {
                    conversationId: conv.id,
                    name: conv.name,
                    isGroup: true,
                    avatar: conv.avatar,
                    otherUser: null,
                    isOnline: false,
                    participants: conv.participants
                });
            }
        } catch (err: any) {
            console.error('Error creating group chat:', err);
            Alert.alert('Fehler', err.response?.data?.message || 'Fehler beim Erstellen der Gruppe.');
        } finally {
            setIsCreatingGroupLoading(false);
        }
    };

    const closeNewChatModal = () => {
        setIsNewChatModalVisible(false);
        setIsCreatingGroup(false);
        setGroupName('');
        setSelectedUserIds([]);
        setSearchQuery('');
    };

    const filteredUsers = usersList.filter(u => {
        // Exclude users we already have a 1-on-1 chat with (only if NOT creating a group)
        if (!isCreatingGroup) {
            const alreadyHasChat = conversations.some(c => !c.isGroup && c.otherUser?.id === u.id);
            if (alreadyHasChat) return false;
        }

        // Apply search filter
        return u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
               u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity 
            className="flex-row items-center p-4 border-b border-gray-100 dark:border-gray-800"
            onPress={() => (navigation as any).navigate('ChatDetail', { 
                conversationId: item.id, 
                name: item.name, 
                isGroup: item.isGroup, 
                avatar: item.avatar,
                otherUser: item.otherUser,
                isOnline: item.online,
                participants: item.participants
            })}
        >
            <View className="relative">
                <View className="w-12 h-12 rounded-full bg-blue-500 items-center justify-center">
                    <Text className="text-white text-lg font-bold">{getInitials(item.name)}</Text>
                </View>
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

            {/* FAB */}
            <TouchableOpacity 
                className="absolute bottom-6 right-6 w-14 h-14 bg-blue-500 rounded-full items-center justify-center shadow-lg"
                onPress={openNewChatModal}
            >
                <Plus size={24} color="white" />
            </TouchableOpacity>

            {/* New Chat Modal */}
            <Modal
                visible={isNewChatModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={closeNewChatModal}
            >
                <SafeAreaView className="flex-1 bg-white dark:bg-[#0a0a0c]">
                    <View className="px-4 py-3 flex-row justify-between items-center border-b border-gray-100 dark:border-gray-800">
                        {isCreatingGroup ? (
                            <TouchableOpacity onPress={() => setIsCreatingGroup(false)} className="p-2 -ml-2">
                                <Text className="text-blue-500 font-bold">Zurück</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text className="text-xl font-bold text-gray-900 dark:text-white">Neuer Chat</Text>
                        )}
                        
                        {isCreatingGroup ? (
                            <Text className="text-xl font-bold text-gray-900 dark:text-white">Neue Gruppe</Text>
                        ) : null}

                        {isCreatingGroup ? (
                            <TouchableOpacity 
                                onPress={createGroupChat} 
                                disabled={isCreatingGroupLoading}
                                className={`p-2 -mr-2 ${isCreatingGroupLoading ? 'opacity-50' : ''}`}
                            >
                                {isCreatingGroupLoading ? (
                                    <ActivityIndicator size="small" color="#3B82F6" />
                                ) : (
                                    <Text className="text-blue-500 font-bold">Erstellen</Text>
                                )}
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={closeNewChatModal} className="p-2">
                                <X size={24} color="#6B7280" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {isCreatingGroup && (
                        <View className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#1a1a1c]">
                            <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Gruppenname</Text>
                            <TextInput
                                className="bg-white dark:bg-[#252528] px-4 py-3 rounded-xl text-gray-900 dark:text-white text-base border border-gray-200 dark:border-gray-700"
                                placeholder="Name der Gruppe..."
                                placeholderTextColor="#9CA3AF"
                                value={groupName}
                                onChangeText={setGroupName}
                            />
                        </View>
                    )}

                    <View className="p-4 border-b border-gray-100 dark:border-gray-800">
                        <View className="flex-row items-center bg-gray-100 dark:bg-[#252528] rounded-xl px-3 py-2">
                            <Search size={20} color="#9CA3AF" />
                            <TextInput
                                className="flex-1 ml-2 text-gray-900 dark:text-white text-base"
                                placeholder="Kontakt suchen..."
                                placeholderTextColor="#9CA3AF"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <X size={16} color="#9CA3AF" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {isLoadingUsers ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color="#3B82F6" />
                        </View>
                    ) : (
                        <>
                            {!isCreatingGroup && (
                                <TouchableOpacity 
                                    className="flex-row items-center p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#1a1a1c]"
                                    onPress={() => setIsCreatingGroup(true)}
                                >
                                    <View className="w-12 h-12 rounded-full bg-green-500 items-center justify-center mr-3 shadow-sm shadow-green-500/30">
                                        <Users size={24} color="white" />
                                    </View>
                                    <Text className="text-base font-bold text-green-600 dark:text-green-400">Neue Gruppe erstellen</Text>
                                </TouchableOpacity>
                            )}
                            <FlatList
                                data={filteredUsers}
                                keyExtractor={item => item.id}
                                renderItem={({ item }) => {
                                    const isSelected = selectedUserIds.includes(item.id);
                                    return (
                                        <TouchableOpacity 
                                            className={`flex-row items-center p-4 border-b border-gray-100 dark:border-gray-800 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                            onPress={() => isCreatingGroup ? toggleUserSelection(item.id) : startNewChat(item.id)}
                                        >
                                            <View className="w-12 h-12 rounded-full bg-blue-500 items-center justify-center mr-3 relative">
                                                <Text className="text-white text-lg font-bold">{getInitials(item.name)}</Text>
                                                {isCreatingGroup && isSelected && (
                                                    <View className="absolute -bottom-1 -right-1 bg-green-500 rounded-full w-5 h-5 items-center justify-center border-2 border-white dark:border-[#0a0a0c]">
                                                        <Text className="text-white text-[10px] font-bold">✓</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-base font-bold text-gray-900 dark:text-white">{item.name}</Text>
                                                <Text className="text-sm text-gray-500">{item.role?.name || item.email}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                }}
                                ListEmptyComponent={
                                    <View className="flex-1 items-center justify-center p-8 mt-10">
                                        <Users size={48} color="#9CA3AF" />
                                        <Text className="text-gray-500 mt-4 text-center">Keine Kontakte gefunden</Text>
                                    </View>
                                }
                            />
                        </>
                    )}
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}
