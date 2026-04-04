import React, { useState } from 'react';
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
  Alert,
  Image,
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
import { fetchTasks, updateTaskStatus, createTask, deleteTask, updateTask } from '../api/tasks';
import { fetchUsers } from '../api/users';
import { fetchCurrentUser } from '../api/auth';
import { fetchProjects } from '../api/projects';
import { ScreenLayout } from '../components/ScreenLayout';
import { GlassCard } from '../components/GlassCard';
import { 
  SquareCheck, 
  Circle, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  Plus, 
  Trash2, 
  User, 
  Briefcase, 
  Calendar as CalendarIcon, 
  Send,
  UploadCloud,
  LogOut,
  Edit2,
  RefreshCw,
  Construction,
  Download,
  ExternalLink,
  X,
  Share2,
  Copy
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const STATUS_OPTIONS = ['IN_PROGRESS', 'WAITING', 'COMPLETED', 'IN ARBEIT', 'WARTEN', 'ERLEDIGT'];

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

interface TaskForm {
  title: string;
  description: string;
  status: string;
  assigned_to_id: string | number;
  project_id: string | number;
  due_date: string;
}

export default function TasksScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form State
  const [formData, setFormData] = useState<TaskForm>({
    title: '',
    description: '',
    status: 'In Arbeit',
    assigned_to_id: '',
    project_id: '',
    due_date: getISODate(),
  });
  const [attachments, setAttachments] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<{uri: string, fileName: string}[]>([]);

  const { data: tasksData, isLoading, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const { data: userData } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
  });

  const tasks = tasksData?.data?.tasks || [];
  const projects = projectsData?.data?.projects || [];
  const usersList = users || [];
  const currentUser = userData?.data?.user;
  const canCreateTask = currentUser?.role?.name !== 'Worker';

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

  const handleCopyDescription = async (text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert('Kopiert', 'Die Aufgabenbeschreibung wurde in die Zwischenablage копiert.');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateTaskStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const fullUpdateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) => updateTask(id, data),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => {
      Alert.alert('Fehler', 'Aufgabe konnte nicht aktualisiert werden.');
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => createTask(data),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => {
      Alert.alert('Fehler', 'Aufgabe konnte nicht erstellt werden.');
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateTaskStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const handleOpenModal = (task: any = null) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'In Arbeit',
        assigned_to_id: task.assigned_to_id || '',
        project_id: task.project_id || '',
        due_date: task.due_date ? task.due_date.split('T')[0] : getISODate(),
      });
    } else {
      setEditingTask(null);
      setFormData({
        title: '',
        description: '',
        status: 'In Arbeit',
        assigned_to_id: '',
        project_id: '',
        due_date: getISODate(),
      });
    }
    setAttachments([]);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
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
      setFormData({ ...formData, due_date: getISODate(selected) });
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!formData.title) {
      Alert.alert('Hinweis', 'Bitte geben Sie einen Titel an.');
      return;
    }

    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description || '');
    data.append('status', formData.status);
    if (formData.assigned_to_id) data.append('assigned_to_id', formData.assigned_to_id.toString());
    if (formData.project_id) data.append('project_id', formData.project_id.toString());
    if (formData.due_date) data.append('due_date', formData.due_date);

    attachments.forEach((file: any, index) => {
      data.append('files', {
        uri: file.uri,
        name: file.fileName || `media_${index}.jpg`,
        type: file.mimeType || (file.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      } as any);
    });

    if (editingTask) {
      fullUpdateMutation.mutate({ id: editingTask.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      'Aufgabe löschen',
      'Möchten Sie diese Aufgabe действительно löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
      ]
    );
  };

  const handleStatusChange = (task: any) => {
    Alert.alert(
      'Status ändern',
      'Wählen Sie einen neuen Status aus:',
      [
        { text: 'In Arbeit', onPress: () => updateMutation.mutate({ id: task.id, status: 'In Arbeit' }) },
        { text: 'Warten', onPress: () => updateMutation.mutate({ id: task.id, status: 'Warten' }) },
        { text: 'Erledigt', onPress: () => updateMutation.mutate({ id: task.id, status: 'Erledigt' }) },
        { text: 'Abbrechen', style: 'cancel' }
      ]
    );
  };

  const openAttachment = (url: string, fileName: string) => {
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `${serverDomain}${url}`;
    
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fullUrl);
    
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
      const localUri = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + 'temp_save.jpg';
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
      const localUri = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + 'temp_share.jpg';
      const downloadRes = await FileSystem.downloadAsync(fullUrl, localUri);
      
      if (downloadRes.status === 200) {
          await Sharing.shareAsync(downloadRes.uri);
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const TaskCard = ({ task }: any) => {
    const isOwnerOrHigher = canCreateTask || currentUser?.id === task.creator_id;

    const translateStatus = (st: string) => {
      if (st === 'IN_PROGRESS') return 'In Arbeit';
      if (st === 'WAITING') return 'Warten';
      if (st === 'COMPLETED') return 'Erledigt';
      return st || 'Offen';
    };

    return (
      <GlassCard className="p-4 mb-4">
        {/* Top Header Row */}
        <View className="flex-row justify-between items-start mb-3">
          <View>
            <View className={`px-2 py-1 flex-row items-center rounded-lg mb-1 ${task.status === 'In Arbeit' ? 'bg-brand-blue/20' : task.status === 'Erledigt' ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
              <Construction size={12} color={task.status === 'In Arbeit' ? '#3B82F6' : task.status === 'Erledigt' ? '#10B981' : '#F59E0B'} />
              <Text className={`text-[10px] font-bold ml-1 ${task.status === 'In Arbeit' ? 'text-brand-blue' : task.status === 'Erledigt' ? 'text-green-500' : 'text-orange-500'}`}>
                {translateStatus(task.status)}
              </Text>
            </View>
            <View className="flex-row items-center">
              <CalendarIcon size={10} color="#EF4444" />
              <Text className="text-[#EF4444] text-[10px] font-bold ml-1">
                Bis: {task.due_date ? new Date(task.due_date).toLocaleDateString('de-DE') : 'Keine Frist'}
              </Text>
            </View>
          </View>
          
          <View className="flex-row gap-x-2">
            {isOwnerOrHigher && (
              <TouchableOpacity onPress={() => handleOpenModal(task)} className="p-2 bg-white/5 rounded-lg">
                <Edit2 size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => handleStatusChange(task)} className="p-2 bg-white/5 rounded-lg">
              <RefreshCw size={16} color="#9CA3AF" />
            </TouchableOpacity>
            {isOwnerOrHigher && (
              <TouchableOpacity onPress={() => handleDelete(task.id)} className="p-2 bg-white/5 rounded-lg">
                <Trash2 size={16} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Body content */}
        <View>
          <Text selectable={true} className="text-white font-bold text-lg mb-1">{task.title}</Text>
          <Text selectable={true} className="text-gray-400 text-sm mb-4 leading-relaxed">{task.description || 'Keine Beschreibung'}</Text>
        </View>

        {/* Attachments */}
        {task.attachments && task.attachments.length > 0 && (
          <View className="mb-4">
            <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">ANHÄNGE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
              {task.attachments.map((att: any) => {
                const imgUri = att.file_url ? (att.file_url.startsWith('http') ? att.file_url : `${serverDomain}${att.file_url}`) : null;
                return (
                  <TouchableOpacity 
                     key={att.id} 
                     onPress={() => openAttachment(att.file_url, att.file_name)}
                     activeOpacity={0.7}
                     className="mr-2 border border-white/5 rounded-lg p-2 flex-row items-center bg-black/20"
                  >
                    {att.content_type?.includes('video') ? (
                      <View className="w-8 h-8 rounded bg-gray-800 justify-center items-center">
                         <Text className="text-white text-[8px] font-bold">VID</Text>
                      </View>
                    ) : (
                      <Image source={imgUri ? { uri: imgUri } : undefined} className="w-8 h-8 rounded" />
                    )}
                    <View className="ml-2 w-24 flex-row items-center justify-between">
                      <Text className="text-gray-300 text-xs font-bold flex-1 mr-1" numberOfLines={1}>
                        {att.file_name}
                      </Text>
                      <TouchableOpacity onPress={() => downloadFile(att.file_url, att.file_name)}>
                         <Download size={12} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Bottom Footer */}
        <View className="flex-row justify-between items-center pt-3 border-t border-white/5 mt-2">
           <View className="flex-row items-center flex-1">
             <LogOut size={12} color="#6B7280" style={{ transform: [{ rotate: '180deg' }] }} className="mr-1" />
             <Text className="text-gray-500 text-[10px] font-bold uppercase flex-1" numberOfLines={1}>
                {task.project ? `${task.project.project_number} - ${task.project.title}` : 'Kein Projekt'}
             </Text>
           </View>
           
           {(task.assigned_to || task.creator) && (
              <View className="bg-white/5 px-2 py-1.5 rounded-md flex-row items-center border border-white/10">
                <User size={12} color="#60A5FA" className="mr-2" />
                <Text className="text-white text-[10px] font-bold">{task.assigned_to?.name || task.creator?.name || 'System Admin1'}</Text>
              </View>
           )}
        </View>
      </GlassCard>
    );
  };

  return (
    <ScreenLayout scroll={false}>
      <View className="mb-6 flex-row items-center justify-between">
        <View className="flex-row items-center">
            <View className="w-1 h-6 bg-brand-blue rounded-full mr-3" />
            <Text className="text-white font-bold text-2xl uppercase tracking-widest">Aufgaben</Text>
        </View>
        <TouchableOpacity 
          onPress={() => handleOpenModal()}
          className="bg-brand-blue p-2 rounded-xl shadow-lg shadow-blue-500/20"
        >
          <Plus size={24} color="white" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <TaskCard task={item} />}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <GlassCard className="p-10 items-center">
              <Text className="text-gray-400 text-center uppercase text-xs font-bold tracking-widest">
                Keine Aufgaben gefunden
              </Text>
            </GlassCard>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add Task Modal */}
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
          <GlassCard className="p-6 rounded-t-[40px] border-t border-white/10 bg-black/60" style={{ height: '85%' }}>
            <View {...modalPanResponder.panHandlers} className="w-full pb-6 items-center">
              <View className="w-12 h-1.5 bg-white/10 rounded-full" />
            </View>
            
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold uppercase tracking-widest">
                {editingTask ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Text className="text-gray-500 font-bold uppercase text-xs tracking-widest">Abbrechen</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              {/* Title Input */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Titel</Text>
                <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                  <TextInput
                    value={formData.title}
                    onChangeText={(text) => setFormData({ ...formData, title: text })}
                    placeholder="z.B. Material bestellen"
                    placeholderTextColor="#4B5563"
                    className="p-4 text-white font-bold"
                  />
                </GlassCard>
              </View>

              {/* Assignee Selection */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Zuweisen an</Text>
                <GlassCard className="p-3 bg-black/40 border border-white/5">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {usersList.map((u: any) => (
                      <TouchableOpacity
                        key={u.id}
                        onPress={() => setFormData({ ...formData, assigned_to_id: u.id })}
                        className={`px-3 py-2 rounded-lg mr-2 border flex-row items-center ${formData.assigned_to_id === u.id ? 'bg-brand-blue border-brand-blue' : 'bg-white/5 border-white/5'}`}
                      >
                        <User size={14} color={formData.assigned_to_id === u.id ? 'white' : '#6B7280'} className="mr-1" />
                        <Text className={`text-xs font-bold ${formData.assigned_to_id === u.id ? 'text-white' : 'text-gray-400'}`}>
                          {u.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </GlassCard>
              </View>

              {/* Due Date */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Fälligkeitsdatum (Optional)</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                  <GlassCard className="p-4 bg-black/40 border border-white/5 flex-row items-center justify-between">
                    <CalendarIcon size={16} color="#6B7280" />
                    <Text className="text-white font-bold text-sm tracking-widest">{formatDate(formData.due_date) || 'DD.MM.YYYY'}</Text>
                    <CalendarIcon size={16} color="#6B7280" />
                  </GlassCard>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={new Date(formData.due_date)}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                  />
                )}
              </View>

              {/* Project Selection */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Projekt (Optional)</Text>
                <GlassCard className="p-3 bg-black/40 border border-white/5">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    <TouchableOpacity
                      onPress={() => setFormData({ ...formData, project_id: '' })}
                      className={`px-3 py-2 rounded-lg mr-2 border flex-row items-center ${formData.project_id === '' ? 'bg-white/10 border-white/20' : 'bg-transparent border-transparent'}`}
                    >
                      <Briefcase size={14} color={formData.project_id === '' ? '#fff' : '#6B7280'} className="mr-2" />
                      <Text className={`text-xs font-bold ${formData.project_id === '' ? 'text-white' : 'text-gray-400'}`}>Kein Projekt ausgewählt</Text>
                    </TouchableOpacity>
                    {projects.map((p: any) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setFormData({ ...formData, project_id: p.id })}
                        className={`px-3 py-2 rounded-lg mr-2 border ${formData.project_id === p.id ? 'bg-brand-blue border-brand-blue' : 'bg-white/5 border-white/5'}`}
                      >
                        <Text className={`text-xs font-bold ${formData.project_id === p.id ? 'text-white' : 'text-gray-400'}`}>
                          {p.project_number} - {p.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </GlassCard>
              </View>

              {/* Description Input */}
              <View className="mb-5">
                <View className="flex-row justify-between items-center mb-2 ml-1">
                   <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Beschreibung</Text>
                   <TouchableOpacity 
                      onPress={() => handleCopyDescription(formData.description)}
                      className="flex-row items-center bg-white/5 px-3 py-1.5 rounded-lg border border-white/5"
                   >
                      <Copy size={12} color="#3B82F6" className="mr-2" />
                      <Text className="text-white text-[10px] font-bold uppercase tracking-widest">Kopieren</Text>
                   </TouchableOpacity>
                </View>
                <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                  <TextInput
                    value={formData.description}
                    onChangeText={(text) => setFormData({ ...formData, description: text })}
                    placeholder="Details zur Aufgabe..."
                    placeholderTextColor="#4B5563"
                    className="p-4 text-white text-sm"
                    multiline
                    numberOfLines={4}
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

              <View className="h-10" />
            </ScrollView>

            <View className="flex-row justify-between pt-4 border-t border-white/5">
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
                disabled={createMutation.isPending || fullUpdateMutation.isPending}
                className="bg-brand-blue flex-1 py-4 rounded-xl items-center shadow-lg shadow-blue-500/30 border border-brand-blue"
              >
                {createMutation.isPending || fullUpdateMutation.isPending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-bold text-sm tracking-widest">
                    {editingTask ? 'Speichern' : 'Aufgabe speichern'}
                  </Text>
                )}
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
    </ScreenLayout>
  );
}
