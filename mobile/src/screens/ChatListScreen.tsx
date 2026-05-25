import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MessageCircle, Users, Plus, X, Search } from 'lucide-react-native';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socket';
import { ScreenLayout } from '../components/ScreenLayout';
import { GlassCard } from '../components/GlassCard';
import { BlurView } from 'expo-blur';

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

    const renderItem = ({ item }: { item: any }) => {
        const isOnline = item.online;
        return (
            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => (navigation as any).navigate('ChatDetail', { 
                    conversationId: item.id, 
                    name: item.name, 
                    isGroup: item.isGroup, 
                    avatar: item.avatar,
                    otherUser: item.otherUser,
                    isOnline: item.online,
                    participants: item.participants
                })}
                className="mb-3"
            >
                <GlassCard className="flex-row items-center p-4 border border-white/5 bg-white/5 rounded-2xl">
                    <View className="relative">
                        <View className="w-12 h-12 rounded-full bg-brand-blue/20 border border-brand-blue/30 items-center justify-center">
                            <Text className="text-blue-400 text-base font-black uppercase tracking-wider">{getInitials(item.name)}</Text>
                        </View>
                        {isOnline && (
                            <View className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#0a0a0c] rounded-full shadow-md shadow-green-500/50" />
                        )}
                    </View>
                    <View className="flex-1 ml-4">
                        <View className="flex-row justify-between items-center mb-1.5">
                            <Text className="font-extrabold text-white text-base leading-snug" numberOfLines={1}>
                                {item.name}
                            </Text>
                            <Text className="text-[10px] text-gray-500 font-bold uppercase">{item.time}</Text>
                        </View>
                        <View className="flex-row justify-between items-center">
                            <Text className="text-xs text-gray-400 flex-1 leading-snug" numberOfLines={1}>
                                {item.lastMessage}
                            </Text>
                            {item.unread > 0 && (
                                <View className="bg-brand-blue rounded-full min-w-[20px] h-5 items-center justify-center px-1.5 ml-2 shadow-lg shadow-blue-500/30">
                                    <Text className="text-white text-[10px] font-black">{item.unread}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </GlassCard>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenLayout scroll={false}>
            {/* Header */}
            <View className="mb-6 flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <View className="w-1 h-6 bg-brand-blue rounded-full mr-3" />
                    <Text className="text-white font-bold text-2xl uppercase tracking-widest">Chats</Text>
                </View>
                <TouchableOpacity 
                    onPress={openNewChatModal}
                    className="p-2 bg-white/5 rounded-xl border border-white/10"
                >
                    <Users size={20} color="#3B82F6" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={conversations}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" colors={['#3B82F6']} />
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                    !isLoading ? (
                        <GlassCard className="p-10 items-center mt-10">
                            <MessageCircle size={48} color="#4B5563" />
                            <Text className="text-gray-400 mt-4 text-center font-bold uppercase tracking-widest text-xs">
                                Keine Nachrichten vorhanden
                            </Text>
                        </GlassCard>
                    ) : (
                        <ActivityIndicator color="#3B82F6" size="large" className="mt-20" />
                    )
                }
            />

            {/* FAB */}
            <TouchableOpacity 
                activeOpacity={0.8}
                className="absolute bottom-6 right-6 w-14 h-14 bg-brand-blue rounded-full items-center justify-center shadow-lg shadow-blue-500/40"
                onPress={openNewChatModal}
            >
                <Plus size={24} color="white" />
            </TouchableOpacity>

            {/* New Chat Modal */}
            <Modal
                visible={isNewChatModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={closeNewChatModal}
            >
                <BlurView intensity={80} tint="dark" className="flex-1 justify-end">
                    <TouchableOpacity 
                        activeOpacity={1} 
                        onPress={closeNewChatModal} 
                        className="flex-1"
                    />
                    <GlassCard className="p-6 rounded-t-[40px] border-t border-white/10 bg-[#0a0a0c] overflow-hidden" style={{ height: '85%' }}>
                        <View className="w-full pb-6 items-center">
                            <View className="w-12 h-1.5 bg-white/10 rounded-full" />
                        </View>

                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-white text-xl font-bold uppercase tracking-widest">
                                {isCreatingGroup ? 'Neue Gruppe' : 'Neuer Chat'}
                            </Text>
                            <TouchableOpacity onPress={closeNewChatModal}>
                                <Text className="text-gray-500 font-bold uppercase text-xs tracking-widest">Abbrechen</Text>
                            </TouchableOpacity>
                        </View>

                        {isCreatingGroup && (
                            <View className="mb-5">
                                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Gruppenname</Text>
                                <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                                    <TextInput
                                        className="p-4 text-white font-bold"
                                        placeholder="Name der Gruppe..."
                                        placeholderTextColor="#4B5563"
                                        value={groupName}
                                        onChangeText={setGroupName}
                                    />
                                </GlassCard>
                            </View>
                        )}

                        <View className="mb-5">
                            <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Empfänger Suchen</Text>
                            <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5 flex-row items-center px-4">
                                <Search size={16} color="#6B7280" />
                                <TextInput
                                    className="flex-1 p-4 text-white font-bold"
                                    placeholder="Kontakt suchen..."
                                    placeholderTextColor="#4B5563"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <X size={16} color="#6B7280" />
                                    </TouchableOpacity>
                                )}
                            </GlassCard>
                        </View>

                        {isLoadingUsers ? (
                            <View className="flex-1 items-center justify-center">
                                <ActivityIndicator size="large" color="#3B82F6" />
                            </View>
                        ) : (
                            <View className="flex-1">
                                {!isCreatingGroup && (
                                    <TouchableOpacity 
                                        activeOpacity={0.8}
                                        className="flex-row items-center p-4 border border-white/5 bg-green-500/10 rounded-2xl mb-4"
                                        onPress={() => setIsCreatingGroup(true)}
                                    >
                                        <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center mr-3 shadow-sm shadow-green-500/30">
                                            <Users size={20} color="#10B981" />
                                        </View>
                                        <Text className="text-base font-black text-green-400 uppercase tracking-wider">Neue Gruppe erstellen</Text>
                                    </TouchableOpacity>
                                )}

                                <FlatList
                                    data={filteredUsers}
                                    keyExtractor={item => item.id}
                                    showsVerticalScrollIndicator={false}
                                    renderItem={({ item }) => {
                                        const isSelected = selectedUserIds.includes(item.id);
                                        return (
                                            <TouchableOpacity 
                                                activeOpacity={0.8}
                                                className={`flex-row items-center p-4 border border-white/5 rounded-2xl mb-3 ${isSelected ? 'bg-brand-blue/10 border-brand-blue/30' : 'bg-white/5'}`}
                                                onPress={() => isCreatingGroup ? toggleUserSelection(item.id) : startNewChat(item.id)}
                                            >
                                                <View className="w-10 h-10 rounded-full bg-brand-blue/20 items-center justify-center mr-3 relative border border-brand-blue/30">
                                                    <Text className="text-blue-400 text-sm font-black uppercase tracking-wider">{getInitials(item.name)}</Text>
                                                    {isCreatingGroup && isSelected && (
                                                        <View className="absolute -bottom-1 -right-1 bg-green-500 rounded-full w-5 h-5 items-center justify-center border-2 border-[#121212]">
                                                            <Text className="text-white text-[10px] font-black">✓</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <View className="flex-1 pr-3">
                                                    <Text className="text-sm font-black text-white" numberOfLines={1}>{item.name}</Text>
                                                    <Text className="text-gray-500 text-[10px] uppercase font-bold mt-0.5">{item.role?.name || item.email}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    }}
                                    ListEmptyComponent={
                                        <View className="flex-1 items-center justify-center p-8 mt-10">
                                            <Users size={32} color="#4B5563" />
                                            <Text className="text-gray-400 mt-4 text-center font-bold uppercase tracking-widest text-xs">Keine Kontakte gefunden</Text>
                                        </View>
                                    }
                                />
                            </View>
                        )}

                        {isCreatingGroup && (
                            <View className="pt-4 flex-row justify-between border-t border-white/5">
                                <TouchableOpacity 
                                    onPress={() => setIsCreatingGroup(false)}
                                    className="bg-white/5 flex-1 py-4 rounded-xl items-center mr-2 border border-white/10"
                                >
                                    <Text className="text-white font-bold text-sm tracking-widest">
                                        Zurück
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={createGroupChat} 
                                    disabled={isCreatingGroupLoading}
                                    className="bg-brand-blue flex-1 py-4 rounded-xl items-center shadow-lg shadow-blue-500/30 border border-brand-blue"
                                >
                                    {isCreatingGroupLoading ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <Text className="text-white font-bold text-sm tracking-widest">
                                            Erstellen
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </GlassCard>
                </BlurView>
            </Modal>
        </ScreenLayout>
    );
}
