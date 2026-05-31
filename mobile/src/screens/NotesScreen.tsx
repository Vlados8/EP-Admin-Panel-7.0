import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Keyboard, 
  Modal, 
  Alert,
  Image,
  ScrollView,
  Linking,
  PanResponder
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import ImageView from "react-native-image-viewing";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { serverDomain } from '../api/client';
import { fetchNotes, createNote, deleteNote, updateNote } from '../api/notes';
import { fetchProjects } from '../api/projects';
import { ScreenLayout } from '../components/ScreenLayout';
import { GlassCard } from '../components/GlassCard';
import { 
  FileText, 
  Plus, 
  Send, 
  Clock, 
  User, 
  Calendar as CalendarIcon, 
  Trash2, 
  CheckCircle2, 
  ChevronDown, 
  Tag,
  Palette,
  Briefcase,
  UploadCloud,
  Download,
  Share2,
  X,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Check
} from 'lucide-react-native';
import { MonthCalendar } from '../components/MonthCalendar';
import { useNavigation } from '@react-navigation/native';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  const day = (`0${d.getDate()}`).slice(-2);
  const month = (`0${d.getMonth() + 1}`).slice(-2);
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

const getISODate = (date: Date = new Date()) => {
  return date.toISOString().split('T')[0];
};

interface NoteForm {
  title: string;
  content: string;
  color: string;
  date: string;
  time: string;
  project_id: string | number;
  showInDiary: boolean;
}

export default function NotesScreen() {
  const navigation = useNavigation<any>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalEditMode, setIsModalEditMode] = useState(false);
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<{uri: string, fileName: string}[]>([]);
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState<NoteForm>({
    title: '',
    content: '',
    color: COLORS[0],
    date: getISODate(),
    time: '',
    project_id: '',
    showInDiary: false,
  });
  const [attachments, setAttachments] = useState<ImagePicker.ImagePickerAsset[]>([]);

  const modalPanResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dy > 50) { // Swiped down
          closeModal();
        }
      },
    })
  ).current;

  const queryClient = useQueryClient();

  const { data: notesData, isLoading, refetch } = useQuery({
    queryKey: ['notes'],
    queryFn: fetchNotes,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  // Date Selection (defaults to today's date filter as requested)
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const notes = notesData?.data?.notes || [];

  const filteredNotes = notes.filter((n: any) => {
    if (selectedDate) {
      const nDate = new Date(n.date || n.createdAt);
      return nDate.toDateString() === selectedDate.toDateString();
    }
    return true; // No date filter selected, show all notes
  });

  const projects = projectsData?.data?.projects || [];

  const handleCopyContent = async (text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert('Kopiert', 'Der Inhalt der Notiz wurde in die Zwischenablage kopiert.');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const createMutation = useMutation({
    mutationFn: (data: FormData) => createNote(data),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (error) => {
        Alert.alert('Fehler', 'Notiz konnte nicht gespeichert werden.');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) => updateNote(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      if (isModalEditMode) {
        closeModal();
      } else {
        setEditingNote(data);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  const handleOpenModal = (note: any = null, forceEditMode: boolean = false) => {
    if (note) {
      setEditingNote(note);
      setFormData({
        title: note.title || '',
        content: note.content || '',
        color: note.color || COLORS[0],
        date: note.date ? note.date.split('T')[0] : getISODate(),
        time: note.time || '',
        project_id: note.project_id || '',
        showInDiary: note.showInDiary || false,
      });
      setIsModalEditMode(forceEditMode);
    } else {
      setEditingNote(null);
      setFormData({
        title: '',
        content: '',
        color: COLORS[0],
        date: getISODate(),
        time: '',
        project_id: '',
        showInDiary: false,
      });
      setIsModalEditMode(true);
    }
    setAttachments([]);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingNote(null);
    setAttachments([]);
  };

  const handlePickMedia = () => {
    Alert.alert(
      'Dateien auswählen',
      'Wie möchten Sie Medien hinzufügen?',
      [
        {
          text: 'Kamera',
          onPress: async () => {
            let result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.All,
              quality: 0.8,
            });
            if (!result.canceled) {
              setAttachments([...attachments, ...result.assets]);
            }
          }
        },
        {
          text: 'Galerie',
          onPress: async () => {
            let result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.All,
              allowsMultipleSelection: true,
              quality: 0.8,
            });
            if (!result.canceled) {
              setAttachments([...attachments, ...result.assets]);
            }
          }
        },
        { text: 'Abbrechen', style: 'cancel' }
      ]
    );
  };

  const onDateChange = (event: any, selected: Date | undefined) => {
    setShowDatePicker(false);
    if (selected) {
      setFormData({ ...formData, date: getISODate(selected) });
    }
  };

  const onTimeChange = (event: any, selected: Date | undefined) => {
    setShowTimePicker(false);
    if (selected) {
      const hours = (`0${selected.getHours()}`).slice(-2);
      const minutes = (`0${selected.getMinutes()}`).slice(-2);
      setFormData({ ...formData, time: `${hours}:${minutes}` });
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.content) {
      Alert.alert('Hinweis', 'Bitte füllen Sie Titel und Inhalt aus.');
      return;
    }

    const data = new FormData();
    data.append('title', formData.title);
    data.append('content', formData.content);
    data.append('color', formData.color);
    data.append('date', formData.date);
    if (formData.time) data.append('time', formData.time);
    if (formData.project_id) data.append('project_id', formData.project_id.toString());
    data.append('showInDiary', formData.showInDiary ? 'true' : 'false');

    attachments.forEach((file: any, index) => {
      data.append('files', {
        uri: file.uri,
        name: file.fileName || `media_${index}.jpg`,
        type: file.mimeType || (file.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      } as any);
    });

    if (editingNote) {
      updateMutation.mutate({ id: editingNote.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      'Notiz löschen',
      'Möchten Sie diese Notiz wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
      ]
    );
  };

  const toggleDone = (note: any) => {
    const data = new FormData();
    data.append('isDone', (!note.isDone).toString());
    updateMutation.mutate({ id: note.id, data });
  };

  const openAttachment = (att: any) => {
    if (!att) return;
    const url = att.originalUrl || att.original_url || att.fileUrl || att.file_url;
    const fileName = att.fileName || att.file_name;
    
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `${serverDomain}${url}`;
    
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg|heic|heif|tiff|bmp|jfif|avif|ico)$/i.test(fullUrl);
    
    if (isImage) {
      setViewerImages([{ uri: fullUrl, fileName: fileName }]);
      setIsViewerVisible(true);
    } else {
      Linking.openURL(fullUrl).catch(() => {
        Alert.alert('Fehler', 'Datei konnte nicht geöffnet werden');
      });
    }
  };

  const downloadFile = async (url: string, fileName: string) => {
    try {
      if (!url) return;
      const fullUrl = url.startsWith('http') ? url : `${serverDomain}${url}`;
      
      // Clean fileName of special characters
      const cleanFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const fileUri = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + cleanFileName;
      
      const downloadRes = await FileSystem.downloadAsync(fullUrl, fileUri);
      
      if (downloadRes.status === 200) {
        await Sharing.shareAsync(downloadRes.uri);
      } else {
        Alert.alert('Fehler', 'Datei konnte nicht heruntergeladen werden (Server-Fehler).');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Fehler', 'Fehler beim Herunterladen der Datei.');
    }
  };

  const saveToGallery = async (url: string) => {
    try {
      if (!url) return;
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
          Alert.alert('Berechtigung', 'Wir benötigen Zugriff auf Ihre Galerie.');
          return;
      }
      
      const fullUrl = url.startsWith('http') ? url : `${serverDomain}${url}`;
      const localUri = FileSystem.cacheDirectory + 'temp_save.jpg';
      const downloadRes = await FileSystem.downloadAsync(fullUrl, localUri);
      
      if (downloadRes.status === 200) {
          await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
          Alert.alert('Erfolg', 'Bild wurde in der Galerie gespeichert.');
      } else {
          Alert.alert('Fehler', 'Fehler beim Herunterladen (Server).');
      }
    } catch (err) {
      console.error('Save to gallery error:', err);
      Alert.alert('Fehler', 'Bild konnte nicht gespeichert werden.');
    }
  };

  const shareFile = async (url: string) => {
    try {
      if (!url) return;
      const fullUrl = url.startsWith('http') ? url : `${serverDomain}${url}`;
      const localUri = FileSystem.cacheDirectory + 'temp_share.jpg';
      const downloadRes = await FileSystem.downloadAsync(fullUrl, localUri);
      
      if (downloadRes.status === 200) {
          await Sharing.shareAsync(downloadRes.uri);
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const NoteCard = ({ note }: { note: any }) => {
    const isDone = note.isDone;
    return (
      <TouchableOpacity 
        activeOpacity={0.95} 
        onPress={() => handleOpenModal(note, false)}
      >
        <GlassCard className={`p-5 mb-4 border-l-4 ${isDone ? 'opacity-60' : ''}`} style={{ borderLeftColor: note.color || '#3B82F6' }}>
          <View className="flex-row justify-between items-start mb-2">
            <View className="flex-1">
              <View className="flex-row items-center mb-1">
                 <Text selectable={true} className={`text-white font-bold text-lg ${isDone ? 'line-through text-gray-500' : ''}`}>
                   {note.title}
                 </Text>
              </View>
              <View className="flex-row items-center">
                <CalendarIcon size={12} color="#6B7280" />
                <Text className="text-gray-500 text-[10px] ml-1 uppercase font-bold">
                  {formatDate(note.date)}
                </Text>
                {note.time && (
                  <View className="flex-row items-center ml-2">
                     <Clock size={10} color="#6B7280" />
                     <Text className="text-gray-400 text-[10px] ml-1 font-bold">{note.time}</Text>
                  </View>
                )}
              </View>
              {note.project && (
                <View className="flex-row mt-2 self-start">
                  <TouchableOpacity 
                    onPress={() => navigation.navigate('ProjectDetail', { id: note.project.id })}
                    className="flex-row items-center bg-brand-blue/10 px-2 py-1 rounded-lg border border-brand-blue/20"
                  >
                    <Briefcase size={10} color="#3B82F6" />
                    <Text className="text-blue-400 text-[10px] ml-1 font-bold">
                      {note.project.project_number} - {note.project.title}
                    </Text>
                    <ExternalLink size={8} color="#3B82F6" className="ml-1.5" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <View className="flex-row">
              <TouchableOpacity onPress={() => toggleDone(note)} className="p-2 bg-white/5 rounded-lg mr-2">
                <CheckCircle2 size={18} color={isDone ? '#10B981' : '#4B5563'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleOpenModal(note, false)} className="p-2 bg-white/5 rounded-lg mr-2">
                <FileText size={18} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(note.id)} className="p-2 bg-white/5 rounded-lg">
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
          
          <Text selectable={true} className={`text-gray-300 text-sm leading-relaxed mb-4 ${isDone ? 'text-gray-500' : ''}`}>
            {note.content}
          </Text>
  
          {note.attachments && note.attachments.length > 0 && (
            <View>
              <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Anhänge</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {note.attachments.map((att: any) => {
                  const url = att.fileUrl || att.file_url;
                  const thumbUrl = att.thumbUrl || att.thumb_url;
                  const name = att.fileName || att.file_name;
                  const type = att.fileType || att.content_type;
                  // Use thumbUrl for the small icon preview, fallback to fileUrl
                  const displayUrl = thumbUrl || url;
                  const fullUrl = displayUrl ? (displayUrl.startsWith('http') ? displayUrl : `${serverDomain}${displayUrl}`) : '';
                  return (
                    <TouchableOpacity 
                       key={att.id} 
                       onPress={() => openAttachment(att)}
                       activeOpacity={0.7}
                       className="mr-2 border border-white/5 rounded-lg p-2 flex-row items-center bg-black/20"
                    >
                      {type?.includes('video') ? (
                        <View className="w-8 h-8 rounded bg-gray-800 justify-center items-center">
                           <Text className="text-white text-[8px] font-bold">VID</Text>
                        </View>
                      ) : (
                        <View className="w-8 h-8 rounded bg-white/5 justify-center items-center">
                          <ImageIcon size={16} color="#6B7280" />
                        </View>
                      )}
                      <View className="ml-2 w-24 flex-row items-center justify-between">
                        <Text className="text-gray-300 text-xs font-bold flex-1 mr-1" numberOfLines={1}>{name}</Text>
                        <TouchableOpacity onPress={() => {
                          const downloadUrl = att.originalUrl || att.original_url || att.fileUrl || att.file_url;
                          downloadFile(downloadUrl, name);
                        }}>
                           <Download size={12} color="#6B7280" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenLayout scroll={false}>
      <View className="flex-1">
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator color="#3B82F6" size="large" />
          </View>
        ) : (
          <FlatList
            data={filteredNotes}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => <NoteCard note={item} />}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListHeaderComponent={
              <View>
                <View className="mb-4 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="w-1 h-6 bg-brand-blue rounded-full mr-3" />
                    <Text className="text-white font-bold text-2xl uppercase tracking-widest">Notizen</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => handleOpenModal()}
                    className="bg-brand-blue p-2 rounded-xl shadow-lg shadow-blue-500/20"
                  >
                    <Plus size={24} color="white" />
                  </TouchableOpacity>
                </View>

                <MonthCalendar 
                  selectedDate={selectedDate} 
                  onSelectDate={setSelectedDate}
                  notes={notes}
                />

                <Text className="text-white font-bold text-lg mb-4">
                  {selectedDate 
                    ? `Notizen für den ${selectedDate.getDate()}. ${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
                    : 'Alle Notizen'
                  }
                </Text>
              </View>
            }
            ListEmptyComponent={
              <GlassCard className="p-10 items-center">
                <Text className="text-gray-400 text-center uppercase text-xs font-bold tracking-widest">
                  Keine Notizen vorhanden
                </Text>
              </GlassCard>
            }
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Add/Edit Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <BlurView intensity={80} tint="dark" className="flex-1 justify-end">
          <TouchableOpacity 
             activeOpacity={1} 
             onPress={Keyboard.dismiss} 
             className="flex-1"
          />
          <GlassCard className="p-6 rounded-t-[40px] border-t border-white/10 bg-black/60 overflow-hidden" style={{ height: '85%' }}>
            <View {...modalPanResponder.panHandlers} className="w-full pb-6 items-center">
              <View className="w-12 h-1.5 bg-white/10 rounded-full" />
            </View>
              <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold uppercase tracking-widest">
                {!isModalEditMode && editingNote ? 'Notiz Details' : editingNote ? 'Notiz bearbeiten' : 'Neue Notiz'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Text className="text-gray-500 font-bold uppercase text-xs tracking-widest">
                  {!isModalEditMode && editingNote ? 'Schließen' : 'Abbrechen'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              {!isModalEditMode && editingNote ? (
                <View>
                  {/* Title & Color bar */}
                  <View className="flex-row items-center mb-4">
                    <View className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: editingNote.color || '#3B82F6' }} />
                    <Text selectable={true} className="text-white text-xl font-bold flex-1 leading-snug">
                      {editingNote.title}
                    </Text>
                  </View>

                  {/* Metadata: Date, Time & Project badge */}
                  <View className="flex-row flex-wrap items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 mb-4">
                    <View className="flex-row items-center">
                      <CalendarIcon size={14} color="#3B82F6" />
                      <Text className="text-gray-300 text-xs ml-1.5 font-semibold">
                        {formatDate(editingNote.date)}
                      </Text>
                    </View>
                    {editingNote.time && (
                      <View className="flex-row items-center">
                        <Clock size={14} color="#10B981" />
                        <Text className="text-gray-300 text-xs ml-1.5 font-semibold">
                          {editingNote.time}
                        </Text>
                      </View>
                    )}
                    {editingNote.project && (
                      <TouchableOpacity 
                        onPress={() => {
                          closeModal();
                          navigation.navigate('ProjectDetail', { id: editingNote.project.id });
                        }}
                        className="flex-row items-center bg-brand-blue/20 border border-brand-blue/30 px-2.5 py-1 rounded-lg"
                      >
                        <Briefcase size={12} color="#3B82F6" />
                        <Text className="text-blue-400 text-xs ml-1.5 font-bold">
                          {editingNote.project.project_number}
                        </Text>
                        <ExternalLink size={10} color="#3B82F6" className="ml-1" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Public Diary Switch */}
                  {editingNote.project && (
                    <View className="mb-4 flex-row justify-between items-center bg-white/5 border border-white/5 p-4 rounded-2xl">
                      <View className="flex-1 mr-4">
                        <Text className="text-white font-bold text-sm">Im Bautagebuch anzeigen</Text>
                        <Text className="text-gray-500 text-[10px] mt-0.5">Soll diese Notiz im öffentlichen Bautagebuch erscheinen?</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          const data = new FormData();
                          data.append('showInDiary', (!editingNote.showInDiary).toString());
                          updateMutation.mutate({ id: editingNote.id, data });
                        }}
                        activeOpacity={0.8}
                        className={`w-12 h-6 rounded-full justify-center px-0.5 ${editingNote.showInDiary ? 'bg-brand-blue' : 'bg-white/10'}`}
                      >
                        <View className={`w-5 h-5 rounded-full bg-white shadow-sm ${editingNote.showInDiary ? 'self-end' : 'self-start'}`} />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Note Content Block */}
                  <View className="mb-4 bg-white/5 border border-white/5 p-5 rounded-2xl">
                    <View className="flex-row justify-between items-center mb-3">
                      <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider">Inhalt</Text>
                      <TouchableOpacity 
                        onPress={() => handleCopyContent(editingNote.content)}
                        className="flex-row items-center bg-white/5 px-2.5 py-1 rounded-lg border border-white/5"
                      >
                        <Copy size={12} color="#3B82F6" className="mr-1.5" />
                        <Text className="text-white text-[10px] font-bold uppercase">Kopieren</Text>
                      </TouchableOpacity>
                    </View>
                    <Text selectable={true} className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                      {editingNote.content}
                    </Text>
                  </View>

                  {/* Status Block */}
                  <View className="mb-4 flex-row justify-between items-center bg-white/5 border border-white/5 p-4 rounded-2xl">
                    <View>
                      <Text className="text-white font-bold text-sm">Erledigt-Status</Text>
                      <Text className="text-gray-500 text-[10px] mt-0.5">Markiere diese Notiz als erledigt oder offen</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => toggleDone(editingNote)}
                      className={`flex-row items-center px-4 py-2 rounded-xl border ${editingNote.isDone ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}
                    >
                      <CheckCircle2 size={16} color={editingNote.isDone ? '#10B981' : '#6B7280'} className="mr-2" />
                      <Text className={`text-xs font-bold ${editingNote.isDone ? 'text-emerald-400' : 'text-gray-400'}`}>
                        {editingNote.isDone ? 'Erledigt' : 'Offen'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Attachments Section */}
                  {editingNote.attachments && editingNote.attachments.length > 0 && (
                    <View className="mb-4 bg-white/5 border border-white/5 p-5 rounded-2xl">
                      <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Anhänge</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {editingNote.attachments.map((att: any) => {
                          const name = att.fileName || att.file_name;
                          const type = att.fileType || att.content_type;
                          return (
                            <TouchableOpacity
                              key={att.id}
                              onPress={() => openAttachment(att)}
                              className="w-full flex-row items-center justify-between bg-black/30 border border-white/5 rounded-xl p-3"
                            >
                              <View className="flex-row items-center flex-1 mr-3">
                                <View className="w-10 h-10 rounded-lg bg-brand-blue/10 justify-center items-center">
                                  <FileText size={20} color="#3B82F6" />
                                </View>
                                <Text className="text-gray-200 text-xs font-bold ml-3 flex-1" numberOfLines={1}>
                                  {name}
                                </Text>
                              </View>
                              <TouchableOpacity 
                                onPress={() => {
                                  const downloadUrl = att.originalUrl || att.original_url || att.fileUrl || att.file_url;
                                  downloadFile(downloadUrl, name);
                                }}
                                className="p-2 bg-white/5 rounded-lg border border-white/5"
                              >
                                <Download size={14} color="#6B7280" />
                              </TouchableOpacity>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <View>
                  {/* Title Input */}
                  <View className="mb-5">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Titel</Text>
                    <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                      <TextInput
                        value={formData.title}
                        onChangeText={(text) => setFormData({ ...formData, title: text })}
                        placeholder="z.B. Material fehlt"
                        placeholderTextColor="#4B5563"
                        className="p-4 text-white font-bold"
                      />
                    </GlassCard>
                  </View>

                  {/* Column: Date & Time */}
                  <View className="flex-row justify-between mb-5">
                    {/* Date Picker */}
                    <View className="flex-1 mr-2">
                      <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Datum</Text>
                      <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                        <GlassCard className="p-4 bg-black/40 border border-white/5 flex-row items-center justify-between">
                          <CalendarIcon size={16} color="#6B7280" />
                          <Text className="text-white font-bold">{formatDate(formData.date)}</Text>
                        </GlassCard>
                      </TouchableOpacity>
                      {showDatePicker && (
                        <DateTimePicker
                          value={new Date(formData.date)}
                          mode="date"
                          display="default"
                          onChange={onDateChange}
                        />
                      )}
                    </View>

                    {/* Time Picker */}
                    <View className="flex-1 ml-2">
                      <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Zeit (Opt.)</Text>
                      <TouchableOpacity onPress={() => setShowTimePicker(true)}>
                        <GlassCard className="p-4 bg-black/40 border border-white/5 flex-row items-center justify-between">
                          <Clock size={16} color="#6B7280" />
                          <Text className="text-white font-bold">{formData.time || '--:--'}</Text>
                        </GlassCard>
                      </TouchableOpacity>
                      {showTimePicker && (
                        <DateTimePicker
                          value={formData.time ? (() => {
                            const [h, m] = formData.time.split(':');
                            const d = new Date();
                            d.setHours(parseInt(h), parseInt(m));
                            return d;
                          })() : new Date()}
                          mode="time"
                          is24Hour={true}
                          display="default"
                          onChange={onTimeChange}
                        />
                      )}
                    </View>
                  </View>

                  {/* Row: Color Selection */}
                  <View className="mb-5">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Farbe</Text>
                    <GlassCard className="p-4 bg-black/40 border border-white/5 flex-row items-center justify-between">
                      <Palette size={16} color={formData.color} />
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="ml-2">
                        {COLORS.map((c) => (
                          <TouchableOpacity
                            key={c}
                            onPress={() => setFormData({ ...formData, color: c })}
                            className={`w-6 h-6 rounded-full mx-1 items-center justify-center ${formData.color === c ? 'border border-white scale-110' : ''}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </ScrollView>
                    </GlassCard>
                  </View>

                  {/* Project Selection Trigger */}
                  <View className="mb-5">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Projekt (Optional)</Text>
                    <TouchableOpacity 
                      onPress={() => setIsProjectSelectorOpen(true)}
                      activeOpacity={0.8}
                    >
                      <GlassCard className="p-4 flex-row justify-between items-center border border-white/5 bg-black/40">
                        <View className="flex-row items-center">
                          <View className="w-8 h-8 rounded-full bg-brand-blue/10 items-center justify-center mr-3">
                            <Briefcase size={16} color="#3B82F6" />
                          </View>
                          <View className="flex-1 pr-4">
                            <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                              Zugeordnetes Projekt
                            </Text>
                            <Text className="text-white font-bold text-sm mt-0.5" numberOfLines={1}>
                              {formData.project_id === '' 
                                ? 'Kein Projekt ausgewählt' 
                                : (() => {
                                    const selectedProj = projects.find((p: any) => p.id.toString() === formData.project_id.toString());
                                    return selectedProj ? `${selectedProj.project_number} - ${selectedProj.title}` : 'Kein Projekt ausgewählt';
                                  })()}
                            </Text>
                          </View>
                        </View>
                        <ChevronDown size={16} color="#6B7280" />
                      </GlassCard>
                    </TouchableOpacity>
                  </View>

                  {/* Show In Diary Switch */}
                  {formData.project_id ? (
                    <View className="mb-5 flex-row justify-between items-center bg-black/40 border border-white/5 p-4 rounded-xl">
                      <View className="flex-1 mr-4">
                        <Text className="text-white font-bold text-sm">Im Bautagebuch anzeigen</Text>
                        <Text className="text-gray-500 text-[10px] mt-1">Soll dieser Eintrag im öffentlichen Bautagebuch des Projekts erscheinen?</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setFormData({ ...formData, showInDiary: !formData.showInDiary })}
                        activeOpacity={0.8}
                        className={`w-12 h-6 rounded-full justify-center px-0.5 ${formData.showInDiary ? 'bg-brand-blue' : 'bg-white/10'}`}
                      >
                        <View className={`w-5 h-5 rounded-full bg-white shadow-sm ${formData.showInDiary ? 'self-end' : 'self-start'}`} />
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {/* Content Input */}
                  <View className="mb-5">
                    <View className="flex-row justify-between items-center mb-2 ml-1">
                       <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Inhalt</Text>
                       <TouchableOpacity 
                          onPress={() => handleCopyContent(formData.content)}
                          className="flex-row items-center bg-white/5 px-3 py-1.5 rounded-lg border border-white/5"
                       >
                          <Copy size={12} color="#3B82F6" className="mr-2" />
                          <Text className="text-white text-[10px] font-bold uppercase tracking-widest">Kopieren</Text>
                       </TouchableOpacity>
                    </View>
                    <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                      <TextInput
                        value={formData.content}
                        onChangeText={(text) => setFormData({ ...formData, content: text })}
                        placeholder="Notizendetails eingeben..."
                        placeholderTextColor="#4B5563"
                        className="p-4 text-white text-sm"
                        multiline
                        numberOfLines={6}
                        textAlignVertical="top"
                      />
                    </GlassCard>
                  </View>

                  {/* Attachments Section */}
                  <View className="mb-5">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Anhänge (Bilder, Videos, Dokumentе)</Text>
                    <TouchableOpacity onPress={handlePickMedia} activeOpacity={0.8}>
                       <GlassCard className="p-6 bg-black/40 border border-dashed border-white/20 items-center justify-center">
                          <UploadCloud size={32} color="#6B7280" className="mb-2" />
                          <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest">Dateien auswählen</Text>
                       </GlassCard>
                    </TouchableOpacity>

                    {attachments.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-4">
                            {attachments.map((file, i) => (
                                <View key={i} className="mr-3 relative">
                                    {file.type === 'video' ? (
                                        <View className="w-20 h-20 rounded-xl bg-gray-800 justify-center items-center border border-white/10">
                                            <Text className="text-white font-bold text-xs">VIDEO</Text>
                                        </View>
                                    ) : (
                                        <Image source={{ uri: file.uri }} className="w-20 h-20 rounded-xl border border-white/10" />
                                    )}
                                    <TouchableOpacity 
                                        onPress={() => removeAttachment(i)}
                                        className="absolute -top-2 -right-2 bg-[#1A1A1A] w-6 h-6 rounded-full items-center justify-center border border-white/20"
                                    >
                                        <Text className="text-white font-bold text-[10px]">X</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>

            <View className="flex-row justify-between pt-4 border-t border-white/5">
              {!isModalEditMode && editingNote ? (
                <>
                  <TouchableOpacity 
                    onPress={closeModal}
                    className="bg-white/5 flex-1 py-4 rounded-xl items-center mr-2 border border-white/10"
                  >
                      <Text className="text-white font-bold text-sm tracking-widest">
                        SCHLIESSEN
                      </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setIsModalEditMode(true)}
                    className="bg-brand-blue flex-1 py-4 rounded-xl items-center shadow-lg shadow-blue-500/30 border border-brand-blue"
                  >
                      <Text className="text-white font-bold text-sm tracking-widest">
                        BEARBEITEN
                      </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity 
                    onPress={closeModal}
                    className="bg-white/5 flex-1 py-4 rounded-xl items-center mr-2 border border-white/10"
                  >
                      <Text className="text-white font-bold text-sm tracking-widest">
                        Abbrechen
                      </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={handleSubmit}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="bg-brand-blue flex-1 py-4 rounded-xl items-center shadow-lg shadow-blue-500/30 border border-brand-blue"
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text className="text-white font-bold text-sm tracking-widest">
                        {editingNote ? 'Speichern' : 'Notiz speichern'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </GlassCard>

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
                      onPress={() => saveToGallery(viewerImages[0]?.uri)}
                      className="bg-black/50 p-2 rounded-full"
                    >
                       <Download color="white" size={24} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => shareFile(viewerImages[0]?.uri)}
                      className="bg-black/50 p-2 rounded-full"
                    >
                       <Share2 color="white" size={24} />
                    </TouchableOpacity>
                  </View>
               </View>
            )}
          />

          {/* Project Selector Bottom Sheet */}
          <Modal
            visible={isProjectSelectorOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setIsProjectSelectorOpen(false)}
          >
            <BlurView intensity={90} tint="dark" className="flex-1 justify-end">
              <TouchableOpacity 
                 activeOpacity={1} 
                 onPress={() => setIsProjectSelectorOpen(false)} 
                 className="flex-1"
              />
              <GlassCard className="p-6 rounded-t-[40px] border-t border-white/10 bg-black/80 overflow-hidden" style={{ maxHeight: '70%' }}>
                <View className="w-full pb-6 items-center">
                   <View className="w-12 h-1.5 bg-white/10 rounded-full" />
                </View>
                <View className="flex-row justify-between items-center mb-6">
                  <Text className="text-white text-base font-bold uppercase tracking-widest">
                    Projekt auswählen
                  </Text>
                  <TouchableOpacity onPress={() => setIsProjectSelectorOpen(false)}>
                    <Text className="text-gray-500 font-bold uppercase text-xs tracking-widest">Schließen</Text>
                  </TouchableOpacity>
                </View>
                
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Option: Kein Projekt */}
                  <TouchableOpacity
                    onPress={() => {
                      setFormData({ ...formData, project_id: '', showInDiary: false });
                      setIsProjectSelectorOpen(false);
                    }}
                    className={`p-4 rounded-2xl mb-3 border flex-row items-center justify-between ${formData.project_id === '' ? 'border-brand-blue bg-brand-blue/10' : 'border-white/5 bg-white/5'}`}
                  >
                    <View className="flex-row items-center">
                      <View className="w-8 h-8 rounded-full bg-brand-blue/20 items-center justify-center mr-3">
                        <Briefcase size={16} color="#3B82F6" />
                      </View>
                      <View>
                        <Text className="text-white font-bold text-sm">Kein Projekt</Text>
                        <Text className="text-gray-500 text-xs mt-0.5">Notiz ist keinem Projekt zugeordnet</Text>
                      </View>
                    </View>
                    {formData.project_id === '' && <Check size={16} color="#3B82F6" />}
                  </TouchableOpacity>

                  {/* Individual Projects */}
                  {projects.map((p: any) => {
                    const isSelected = formData.project_id.toString() === p.id.toString();
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => {
                          setFormData({ ...formData, project_id: p.id });
                          setIsProjectSelectorOpen(false);
                        }}
                        className={`p-4 rounded-2xl mb-3 border flex-row items-center justify-between ${isSelected ? 'border-brand-blue bg-brand-blue/10' : 'border-white/5 bg-white/5'}`}
                      >
                        <View className="flex-row items-center flex-1 pr-3">
                          <View className="w-8 h-8 rounded-full bg-blue-500/20 items-center justify-center mr-3">
                            <Text className="text-blue-400 text-xs font-bold">{p.project_number ? p.project_number.substring(0,2) : 'EP'}</Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-white font-bold text-sm" numberOfLines={1}>{p.project_number} - {p.title}</Text>
                            <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>{p.address || 'Keine Adresse'}</Text>
                          </View>
                        </View>
                        {isSelected && <Check size={16} color="#3B82F6" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </GlassCard>
            </BlurView>
          </Modal>
        </BlurView>
      </Modal>
    </ScreenLayout>
  );
}
