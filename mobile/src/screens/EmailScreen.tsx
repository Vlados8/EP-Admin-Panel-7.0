import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  Modal, 
  TextInput, 
  ScrollView, 
  Keyboard, 
  Alert 
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchEmailMessages, 
  sendEmail, 
  fetchEmailAccounts, 
  markEmailAsRead,
  deleteEmailMessage 
} from '../api/emails';
import { useAuth } from '../context/AuthContext';
import { ScreenLayout } from '../components/ScreenLayout';
import { GlassCard } from '../components/GlassCard';
import { BlurView } from 'expo-blur';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import ImageView from "react-native-image-viewing";
import { 
  Mail, 
  ChevronRight, 
  Clock, 
  User, 
  Plus, 
  Send, 
  Search,
  MessageSquare,
  FileText,
  AlertCircle,
  Inbox,
  SendHorizontal,
  Trash2,
  X,
  Download,
  Share2,
  Copy,
  CheckCircle,
  Check
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { serverDomain } from '../api/client';

export default function EmailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'INBOX' | 'SENT'>('INBOX');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountEmail, setSelectedAccountEmail] = useState('');
  const [isAccountSelectorOpen, setIsAccountSelectorOpen] = useState(false);
  const [isSenderDropdownOpen, setIsSenderDropdownOpen] = useState(false);

  // Handle incoming params for new email
  useEffect(() => {
    if (route.params?.initialRecipient) {
      setFormData(prev => ({ 
        ...prev, 
        to: route.params.initialRecipient,
        subject: route.params.initialSubject || ''
      }));
      setIsComposeOpen(true);
      // Clear params so it doesn't reopen on every navigation
      navigation.setParams({ initialRecipient: undefined, initialSubject: undefined });
    }
  }, [route.params]);

  // Image Viewer State
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    from: '',
    to: '',
    subject: '',
    message: '',
  });

  const { data: emailData, isLoading, refetch } = useQuery({
    queryKey: ['emails'],
    queryFn: fetchEmailMessages,
  });

  const { data: accounts, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['emailAccounts'],
    queryFn: fetchEmailAccounts,
  });

  const allMessages = emailData?.messages || [];
  
  const filteredMessages = allMessages
    .filter((m: any) => {
      if (!m) return false;
      const matchMode = viewMode === 'INBOX' ? m.direction === 'inbound' : m.direction === 'outbound';
      
      let matchAccount = true;
      if (selectedAccountEmail) {
        const cleanSelected = selectedAccountEmail.toLowerCase().trim();
        if (viewMode === 'INBOX') {
          const recEmail = (m.recipient_email || m.recipient || '').toLowerCase().trim();
          matchAccount = recEmail.includes(cleanSelected);
        } else {
          const sndEmail = (m.sender_email || m.sender || '').toLowerCase().trim();
          matchAccount = sndEmail.includes(cleanSelected);
        }
      }

      const matchSearch = !searchQuery || 
        m.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.sender_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.recipient_name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchMode && matchAccount && matchSearch;
    });

  const hasAccounts = accounts && accounts.length > 0;

  useEffect(() => {
    if (hasAccounts && !formData.from) {
      setFormData(prev => ({ ...prev, from: accounts[0].email }));
    }
  }, [accounts, hasAccounts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const readMutation = useMutation({
    mutationFn: (id: number) => markEmailAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEmailMessage(id),
    onSuccess: () => {
      setIsDetailOpen(false);
      setSelectedEmail(null);
      Alert.alert('Erfolg', 'E-Mail wurde gelöscht.');
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    }
  });

  const sendMutation = useMutation({
    mutationFn: (data: any) => {
      const fd = new FormData();
      fd.append('from', data.from);
      fd.append('to', data.to);
      fd.append('subject', data.subject);
      fd.append('text', data.message);
      return sendEmail(fd);
    },
    onSuccess: () => {
      Alert.alert('Erfolg', 'E-Mail wurde erfolgreich gesendet.');
      setIsComposeOpen(false);
      setFormData({ from: accounts?.[0]?.email || '', to: '', subject: '', message: '' });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    }
  });
  
  const handleCopyBody = async (text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert('Kopiert', 'Der E-Mail-Inhalt wurde in die Zwischenablage kopiert.');
  };

  const handleNewEmail = () => {
    setFormData({ from: accounts?.[0]?.email || '', to: '', subject: '', message: '' });
    setIsComposeOpen(true);
  };

  const handleOpenEmail = (email: any) => {
    setSelectedEmail(email);
    setIsDetailOpen(true);
    if (email.direction === 'inbound' && !email.is_read) {
      readMutation.mutate(email.id);
    }
  };

  const handleAttachmentPress = (attr: any) => {
    const isImage = attr.content_type?.startsWith('image/') || 
                   ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'heif', 'tiff', 'bmp', 'jfif', 'avif', 'ico', 'dng'].some(ext => attr.file_name.toLowerCase().endsWith(ext));
    
    if (isImage) {
      setViewerImages([{ 
        uri: `${serverDomain}${attr.file_url}`,
        fileName: attr.file_name 
      }]);
      setIsViewerVisible(true);
    } else {
      // For docs, try to download/share
      downloadFile(attr.file_url, attr.file_name);
    }
  };

  const downloadFile = async (url: string, fileName: string) => {
    try {
      const fullUrl = url.startsWith('http') ? url : `${serverDomain}${url}`;
      const cleanFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const fileUri = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + cleanFileName;
      
      const downloadRes = await FileSystem.downloadAsync(fullUrl, fileUri);
      if (downloadRes.status === 200) {
        await Sharing.shareAsync(downloadRes.uri);
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Fehler', 'Fehler beim Herunterladen der Datei.');
    }
  };

  const handleSubmit = () => {
    if (!formData.to || !formData.subject || !formData.message || !formData.from) {
      Alert.alert('Hinweis', 'Bitte füllen Sie alle Felder aus.');
      return;
    }
    sendMutation.mutate(formData);
  };

  if (!isLoadingAccounts && !hasAccounts) {
    return (
      <ScreenLayout>
        <View className="flex- row items-center mb-6">
            <View className="w-1 h-6 bg-brand-blue rounded-full mr-3" />
            <Text className="text-white font-bold text-2xl uppercase tracking-widest">E-Mail</Text>
        </View>
        <GlassCard className="p-10 items-center justify-center mt-20">
          <AlertCircle size={48} color="#EF4444" className="mb-4" />
          <Text className="text-white font-bold text-lg text-center mb-2">Kein E-Mail-Konto</Text>
          <Text className="text-gray-400 text-center text-sm">
            Sie haben еще не привязали почтовый аккаунт. Пожалуйста, свяжитесь с администратором.
          </Text>
        </GlassCard>
      </ScreenLayout>
    );
  }

  const EmailItem = ({ email }: any) => {
    if (!email) return null;
    const isUnread = email.direction === 'inbound' && !email.is_read;
    const name = email.direction === 'inbound' 
      ? (email.sender_name || email.sender_email) 
      : `An: ${email.recipient_name || email.recipient_email}`;

    return (
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={() => handleOpenEmail(email)}
        className="mb-4"
      >
        <GlassCard className={`p-5 flex-row items-center border-l-4 ${isUnread ? 'border-l-brand-blue' : 'border-l-white/10'}`}>
          <View className="flex-1">
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-row items-center">
                <User size={12} color={isUnread ? "#3B82F6" : "#9CA3AF"} />
                <Text className={`${isUnread ? 'text-brand-blue' : 'text-gray-400'} text-[10px] font-bold ml-2 uppercase tracking-widest`}>
                  {name}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Clock size={12} color="#6B7280" />
                <Text className="text-gray-500 text-[10px] ml-1 uppercase font-bold">
                  {new Date(email.received_at || email.createdAt).toLocaleDateString('de-DE')}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center mb-1">
               <Text className={`text-white ${isUnread ? 'font-bold' : 'font-medium'} text-base flex-1`} numberOfLines={1}>
                 {email.subject}
               </Text>
               {isUnread && <View className="w-2.5 h-2.5 rounded-full bg-brand-blue ml-2 shadow-lg shadow-blue-500/50" />}
            </View>
            <Text className="text-gray-400 text-xs" numberOfLines={2}>
              {email.body_plain?.substring(0, 100) || email.body_html?.replace(/<[^>]*>?/gm, '').substring(0, 100) || 'Keine Nachricht...'}
            </Text>
            {email.attachments?.length > 0 && (
              <View className="mt-2 flex-row items-center">
                <FileText size={10} color="#6B7280" />
                <Text className="text-gray-600 text-[9px] font-bold uppercase ml-1">
                  {email.attachments.length} Anhang/Anhänge
                </Text>
              </View>
            )}
          </View>
          <ChevronRight size={20} color="#6B7280" className="ml-4" />
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenLayout scroll={false}>
      <View className="mb-6 flex-row items-center justify-between">
        <View className="flex-row items-center">
            <View className="w-1 h-6 bg-brand-blue rounded-full mr-3" />
            <Text className="text-white font-bold text-2xl uppercase tracking-widest">E-Mail</Text>
        </View>
        {hasAccounts && (
          <TouchableOpacity 
            onPress={handleNewEmail}
            className="bg-brand-blue p-2 rounded-xl shadow-lg shadow-blue-500/20"
          >
            <Plus size={24} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View className="flex-row mb-6 bg-white/5 rounded-2xl p-1 border border-white/5">
        <TouchableOpacity 
          onPress={() => setViewMode('INBOX')}
          className={`flex-1 py-3 items-center justify-center rounded-xl flex-row ${viewMode === 'INBOX' ? 'bg-brand-blue shadow-lg shadow-blue-500/30' : ''}`}
        >
          <Inbox size={16} color={viewMode === 'INBOX' ? "white" : "#6B7280"} className="mr-2" />
          <Text className={`text-xs font-bold uppercase tracking-widest ${viewMode === 'INBOX' ? 'text-white' : 'text-gray-500'}`}>Inbox</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setViewMode('SENT')}
          className={`flex-1 py-3 items-center justify-center rounded-xl flex-row ${viewMode === 'SENT' ? 'bg-brand-blue shadow-lg shadow-blue-500/30' : ''}`}
        >
          <SendHorizontal size={16} color={viewMode === 'SENT' ? "white" : "#6B7280"} className="mr-2" />
          <Text className={`text-xs font-bold uppercase tracking-widest ${viewMode === 'SENT' ? 'text-white' : 'text-gray-500'}`}>Gesendet</Text>
        </TouchableOpacity>
      </View>

      {/* Account Switcher Button */}
      {hasAccounts && (
        <View className="mb-6">
          <TouchableOpacity 
            onPress={() => setIsAccountSelectorOpen(true)}
            activeOpacity={0.8}
          >
            <GlassCard className="p-4 flex-row justify-between items-center border border-white/10 bg-black/30">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-brand-blue/10 items-center justify-center mr-3">
                  <Mail size={16} color="#3B82F6" />
                </View>
                <View>
                  <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                    Aktives Postfach
                  </Text>
                  <Text className="text-white font-bold text-sm mt-0.5">
                    {selectedAccountEmail === '' 
                      ? 'Alle Konten' 
                      : (accounts.find((acc: any) => acc.email === selectedAccountEmail)?.display_name || selectedAccountEmail)}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center">
                {(() => {
                  const activeAcc = accounts.find((acc: any) => acc.email === selectedAccountEmail);
                  const totalUnread = selectedAccountEmail === '' 
                    ? accounts.reduce((acc: number, curr: any) => acc + (curr.unread_count || 0), 0)
                    : (activeAcc?.unread_count || 0);
                  
                  if (totalUnread > 0) {
                    return (
                      <View className="bg-brand-blue px-2.5 py-1 rounded-full mr-3 shadow-lg shadow-blue-500/20">
                        <Text className="text-white text-[10px] font-black">{totalUnread} Neu</Text>
                      </View>
                    );
                  }
                  return null;
                })()}
                <ChevronRight size={16} color="#6B7280" style={{ transform: [{ rotate: '90deg' }] }} />
              </View>
            </GlassCard>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Bar */}
      <GlassCard className="p-3 mb-6 flex-row items-center border border-white/5">
        <Search size={18} color="#4B5563" className="mr-3 ml-1" />
        <TextInput 
          placeholder="E-Mails durchsuchen..." 
          placeholderTextColor="#4B5563"
          value={searchQuery}
          onChangeText={setSearchQuery}
          className="flex-1 text-white text-sm"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity 
            onPress={() => setSearchQuery('')}
            className="p-1"
          >
            <X size={18} color="#4B5563" />
          </TouchableOpacity>
        )}
      </GlassCard>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredMessages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <EmailItem email={item} />}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <GlassCard className="p-10 items-center">
              <Mail size={40} color="#374151" className="mb-3" />
              <Text className="text-gray-400 text-center uppercase text-xs font-bold tracking-widest">
                Keine E-Mails in {viewMode === 'INBOX' ? 'Posteingang' : 'Gesendet'}
              </Text>
            </GlassCard>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Compose Modal */}
      <Modal
        visible={isComposeOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsComposeOpen(false)}
      >
        <BlurView intensity={80} tint="dark" className="flex-1 justify-end">
          <TouchableOpacity 
             activeOpacity={1} 
             onPress={Keyboard.dismiss} 
             className="flex-1"
          />
          <GlassCard className="p-6 rounded-t-[40px] border-t border-white/10 bg-black/60" style={{ height: '85%' }}>
            <View className="w-full pb-6 items-center">
               <View className="w-12 h-1.5 bg-white/10 rounded-full" />
            </View>
            
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold uppercase tracking-widest">
                E-Mail verfassen
              </Text>
              <TouchableOpacity onPress={() => setIsComposeOpen(false)}>
                <Text className="text-gray-500 font-bold uppercase text-xs tracking-widest">Abbrechen</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              {/* Sender selection if multiple */}
              {hasAccounts && (
                 <View className="mb-5">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Absender</Text>
                    <TouchableOpacity onPress={() => setIsSenderDropdownOpen(!isSenderDropdownOpen)}>
                      <GlassCard className="p-4 bg-black/40 border border-white/5 flex-row justify-between items-center">
                         <Text className="text-brand-blue font-bold">{formData.from}</Text>
                         <ChevronRight size={14} color="#3B82F6" style={{ transform: [{ rotate: isSenderDropdownOpen ? '90deg' : '0deg' }] }} />
                      </GlassCard>
                    </TouchableOpacity>
                    
                    {isSenderDropdownOpen && (
                      <View className="mt-2 rounded-2xl border border-white/10 bg-black/80 overflow-hidden">
                        {(accounts || []).map((acc: any) => {
                          if (!acc) return null;
                          const isSelected = formData.from === acc.email;
                          return (
                            <TouchableOpacity
                              key={acc.id}
                              onPress={() => {
                                setFormData(prev => ({ ...prev, from: acc.email }));
                                setIsSenderDropdownOpen(false);
                              }}
                              className={`p-4 border-b border-white/5 flex-row items-center justify-between ${isSelected ? 'bg-brand-blue/10' : ''}`}
                            >
                              <View>
                                <Text className="text-white font-bold text-xs">{acc.display_name || acc.email}</Text>
                                {acc.display_name && <Text className="text-gray-500 text-[10px] mt-0.5">{acc.email}</Text>}
                              </View>
                              {isSelected && <Check size={14} color="#3B82F6" />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                 </View>
              )}

              {/* Recipient */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Empfänger</Text>
                <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                  <TextInput
                    value={formData.to}
                    onChangeText={(text) => setFormData({ ...formData, to: text })}
                    placeholder="E-Mail-Adresse..."
                    placeholderTextColor="#4B5563"
                    className="p-4 text-white font-bold"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </GlassCard>
              </View>

              {/* Subject */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Betreff</Text>
                <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                  <TextInput
                    value={formData.subject}
                    onChangeText={(text) => setFormData({ ...formData, subject: text })}
                    placeholder="Betreff Ihrer Nachricht..."
                    placeholderTextColor="#4B5563"
                    className="p-4 text-white font-bold"
                  />
                </GlassCard>
              </View>

              {/* Body */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Nachricht</Text>
                <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                  <TextInput
                    value={formData.message}
                    onChangeText={(text) => setFormData({ ...formData, message: text })}
                    placeholder="Schreiben Sie Ihre Nachricht hier..."
                    placeholderTextColor="#4B5563"
                    className="p-4 text-white text-sm"
                    multiline
                    numberOfLines={10}
                    textAlignVertical="top"
                  />
                </GlassCard>
              </View>

              <View className="h-10" />
            </ScrollView>

            <TouchableOpacity 
              onPress={handleSubmit}
              disabled={sendMutation.isPending}
              className="bg-brand-blue py-5 rounded-2xl items-center shadow-lg shadow-blue-500/30 flex-row justify-center"
            >
              {sendMutation.isPending ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Send size={20} color="white" className="mr-3" />
                  <Text className="text-white font-bold uppercase tracking-widest">
                    Senden
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </GlassCard>
        </BlurView>
      </Modal>

      {/* Detail Modal */}
      <Modal
        visible={isDetailOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsDetailOpen(false)}
      >
        <BlurView intensity={80} tint="dark" className="flex-1 justify-end">
           <TouchableOpacity 
              activeOpacity={1} 
              onPress={() => setIsDetailOpen(false)} 
              className="flex-1"
           />
           <GlassCard className="p-6 rounded-t-[40px] border-t border-white/10 bg-black/60" style={{ height: '90%' }}>
              <View className="w-full pb-6 items-center">
                 <View className="w-12 h-1.5 bg-white/10 rounded-full" />
              </View>
              
              <View className="flex-row justify-between items-start mb-6">
                 <View className="flex-1">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Betreff</Text>
                    <Text selectable={true} className="text-white text-xl font-bold">{selectedEmail?.subject}</Text>
                 </View>
                 <TouchableOpacity 
                    onPress={() => setIsDetailOpen(false)}
                    className="ml-4 bg-white/5 p-2 rounded-full"
                 >
                    <X size={20} color="#6B7280" />
                 </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                 <View className="flex-row items-center mb-6">
                    <View className="w-10 h-10 rounded-full bg-brand-blue/20 items-center justify-center mr-3">
                       <User size={20} color="#3B82F6" />
                    </View>
                    <View>
                       <Text selectable={true} className="text-white font-bold">
                          {selectedEmail?.direction === 'inbound' ? selectedEmail?.sender_name : selectedEmail?.recipient_name}
                       </Text>
                       <Text selectable={true} className="text-gray-500 text-xs">
                          {selectedEmail?.direction === 'inbound' ? selectedEmail?.sender_email : selectedEmail?.recipient_email}
                       </Text>
                    </View>
                    <View className="flex-1" />
                    <Text selectable={true} className="text-gray-600 text-[10px] font-bold uppercase">
                       {new Date(selectedEmail?.received_at || selectedEmail?.createdAt).toLocaleDateString('de-DE')}
                    </Text>
                 </View>

                 <View className="bg-white/5 h-[1px] w-full mb-6" />
                 
                 <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Inhalt</Text>
                    <TouchableOpacity 
                       onPress={() => handleCopyBody(selectedEmail?.body_plain || selectedEmail?.body_html?.replace(/<[^>]*>?/gm, ''))}
                       className="flex-row items-center bg-white/5 px-3 py-1.5 rounded-lg border border-white/5"
                    >
                       <Copy size={12} color="#3B82F6" className="mr-2" />
                       <Text className="text-white text-[10px] font-bold uppercase tracking-widest">Kopieren</Text>
                    </TouchableOpacity>
                 </View>

                 <Text selectable={true} className="text-gray-300 text-sm leading-6">
                    {selectedEmail?.body_plain || selectedEmail?.body_html?.replace(/<[^>]*>?/gm, '') || 'Kein Inhalt...'}
                 </Text>

                 {selectedEmail?.attachments?.length > 0 && (
                    <View className="mt-8">
                       <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-4">Anhänge ({selectedEmail.attachments.length})</Text>
                       <View className="flex-row flex-wrap gap-3">
                          {selectedEmail.attachments.map((attr: any) => (
                             <TouchableOpacity 
                                key={attr.id}
                                onPress={() => handleAttachmentPress(attr)}
                                className="w-[47%]"
                             >
                                <GlassCard className="p-3 flex-row items-center bg-black/40 border border-white/5">
                                   <FileText size={16} color="#3B82F6" />
                                   <Text className="text-white text-[10px] ml-2 flex-1" numberOfLines={1}>
                                      {attr.file_name}
                                   </Text>
                                </GlassCard>
                             </TouchableOpacity>
                          ))}
                       </View>
                    </View>
                 )}

                 <View className="h-20" />
              </ScrollView>

              <View className="flex-row gap-x-4">
                 <TouchableOpacity 
                    onPress={() => {
                       setIsDetailOpen(false);
                       setFormData(prev => ({ ...prev, to: selectedEmail?.sender_email, subject: `Re: ${selectedEmail?.subject}`, message: '\n\n--- Original Nachricht ---\n' + selectedEmail?.body_plain }));
                       setIsComposeOpen(true);
                    }}
                    className="flex-1 bg-brand-blue py-5 rounded-2xl items-center flex-row justify-center"
                 >
                    <MessageSquare size={20} color="white" className="mr-3" />
                    <Text className="text-white font-bold uppercase tracking-widest">Antworten</Text>
                 </TouchableOpacity>

                 <TouchableOpacity 
                    onPress={() => {
                       Alert.alert('Löschen', 'Möchten Sie diese Nachricht wirklich löschen?', [
                          { text: 'Abbrechen', style: 'cancel' },
                          { text: 'Löschen', onPress: () => deleteMutation.mutate(selectedEmail.id), style: 'destructive' }
                       ]);
                    }}
                    className="bg-red-500/10 p-5 rounded-2xl items-center justify-center border border-red-500/20"
                 >
                    <Trash2 size={24} color="#EF4444" />
                 </TouchableOpacity>
              </View>
           </GlassCard>
        </BlurView>
      </Modal>

      <ImageView
        images={viewerImages}
        imageIndex={0}
        visible={isViewerVisible}
        onRequestClose={() => setIsViewerVisible(false)}
        HeaderComponent={() => (
           <View className="flex-row justify-between items-center p-6 pt-12">
              <TouchableOpacity 
                onPress={() => setIsViewerVisible(false)}
                className="bg-black/50 p-2 rounded-full"
              >
                 <X color="white" size={24} />
              </TouchableOpacity>
              
              <View className="flex-row gap-x-4">
                <TouchableOpacity 
                  onPress={() => downloadFile(viewerImages[0]?.uri, viewerImages[0]?.fileName)}
                  className="bg-black/50 p-2 rounded-full"
                >
                   <Download color="white" size={24} />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => Sharing.shareAsync(viewerImages[0]?.uri)}
                  className="bg-black/50 p-2 rounded-full"
                >
                   <Share2 color="white" size={24} />
                </TouchableOpacity>
              </View>
           </View>
        )}
      />

      {/* Account Selector Bottom Sheet */}
      <Modal
        visible={isAccountSelectorOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAccountSelectorOpen(false)}
      >
        <BlurView intensity={90} tint="dark" className="flex-1 justify-end">
          <TouchableOpacity 
             activeOpacity={1} 
             onPress={() => setIsAccountSelectorOpen(false)} 
             className="flex-1"
          />
          <GlassCard className="p-6 rounded-t-[40px] border-t border-white/10 bg-black/80" style={{ maxHeight: '70%' }}>
            <View className="w-full pb-6 items-center">
               <View className="w-12 h-1.5 bg-white/10 rounded-full" />
            </View>
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-base font-bold uppercase tracking-widest">
                Postfach auswählen
              </Text>
              <TouchableOpacity onPress={() => setIsAccountSelectorOpen(false)}>
                <Text className="text-gray-500 font-bold uppercase text-xs tracking-widest">Schließen</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Option: Alle Konten */}
              <TouchableOpacity
                onPress={() => {
                  setSelectedAccountEmail('');
                  setIsAccountSelectorOpen(false);
                }}
                className={`p-4 rounded-2xl mb-3 border flex-row items-center justify-between ${selectedAccountEmail === '' ? 'border-brand-blue bg-brand-blue/10' : 'border-white/5 bg-white/5'}`}
              >
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-brand-blue/20 items-center justify-center mr-3">
                    <Mail size={16} color="#3B82F6" />
                  </View>
                  <View>
                    <Text className="text-white font-bold text-sm">Alle Konten</Text>
                    <Text className="text-gray-500 text-xs mt-0.5">Sämtliche verknüpfte E-Mail-Postfächer</Text>
                  </View>
                </View>
                {selectedAccountEmail === '' && <Check size={16} color="#3B82F6" />}
              </TouchableOpacity>

              {/* Individual Accounts */}
              {(accounts || []).map((acc: any) => {
                if (!acc) return null;
                const isSelected = selectedAccountEmail === acc.email;
                const count = acc.unread_count || 0;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    onPress={() => {
                      setSelectedAccountEmail(acc.email);
                      setIsAccountSelectorOpen(false);
                    }}
                    className={`p-4 rounded-2xl mb-3 border flex-row items-center justify-between ${isSelected ? 'border-brand-blue bg-brand-blue/10' : 'border-white/5 bg-white/5'}`}
                  >
                    <View className="flex-row items-center">
                      <View className="w-8 h-8 rounded-full bg-blue-500/20 items-center justify-center mr-3">
                        <Text className="text-blue-400 text-xs font-bold">{acc.display_name ? acc.display_name[0].toUpperCase() : 'E'}</Text>
                      </View>
                      <View>
                        <Text className="text-white font-bold text-sm">{acc.display_name || acc.email}</Text>
                        {acc.display_name && <Text className="text-gray-500 text-xs mt-0.5">{acc.email}</Text>}
                      </View>
                    </View>
                    
                    <View className="flex-row items-center">
                      {count > 0 && (
                        <View className="bg-brand-blue px-2 py-0.5 rounded-md mr-3">
                          <Text className="text-white text-[8px] font-black">{count}</Text>
                        </View>
                      )}
                      {isSelected && <Check size={16} color="#3B82F6" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </GlassCard>
        </BlurView>
      </Modal>
    </ScreenLayout>
  );
}
