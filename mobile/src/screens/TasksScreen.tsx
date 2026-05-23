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
  Copy,
  Image as ImageIcon
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

const monthNames = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];
const dayNamesShort = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const dayNamesLong = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday is 0, Sunday is 6
};
const getWeekDays = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(date.setDate(diff));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(monday);
    nextDay.setDate(monday.getDate() + i);
    days.push(nextDay);
  }
  return days;
};
const formatDateString = (dateObj: Date) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const getTaskHour = (timeStr: string) => {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10);
};

interface TaskForm {
  title: string;
  description: string;
  status: string;
  assigned_to_id: string | number;
  project_id: string | number;
  due_date: string;
  time: string;
}

export default function TasksScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalEditMode, setIsModalEditMode] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Calendar Schedulers State
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarTab, setCalendarTab] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTimelineUserId, setSelectedTimelineUserId] = useState<string | number>('all');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string>(formatDateString(new Date()));
  const [selectedWeekDay, setSelectedWeekDay] = useState<string>(formatDateString(new Date()));
  const [now, setNow] = useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handlePrevDate = () => {
    if (calendarTab === 'month') {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
    } else if (calendarTab === 'week') {
      const prevWeek = new Date(selectedDate);
      prevWeek.setDate(selectedDate.getDate() - 7);
      setSelectedDate(prevWeek);
      setSelectedWeekDay(formatDateString(prevWeek));
    }
  };

  const handleNextDate = () => {
    if (calendarTab === 'month') {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
    } else if (calendarTab === 'week') {
      const nextWeek = new Date(selectedDate);
      nextWeek.setDate(selectedDate.getDate() + 7);
      setSelectedDate(nextWeek);
      setSelectedWeekDay(formatDateString(nextWeek));
    }
  };

  const handleSetToday = () => {
    const todayStr = formatDateString(new Date());
    setSelectedDate(new Date());
    setSelectedWeekDay(todayStr);
    setSelectedCalendarDay(todayStr);
  };

  const getCalendarNavTitle = () => {
    if (calendarTab === 'month') {
      return `${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
    } else if (calendarTab === 'week') {
      const weekDays = getWeekDays(selectedDate);
      const startStr = `${weekDays[0].getDate()}. ${monthNames[weekDays[0].getMonth()].substring(0, 3)}.`;
      const endStr = `${weekDays[6].getDate()}. ${monthNames[weekDays[6].getMonth()].substring(0, 3)}. ${weekDays[6].getFullYear()}`;
      return `${startStr} - ${endStr}`;
    }
    return '';
  };

  // Form State
  const [formData, setFormData] = useState<TaskForm>({
    title: '',
    description: '',
    status: 'In Arbeit',
    assigned_to_id: '',
    project_id: '',
    due_date: getISODate(),
    time: '',
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

  const handleOpenModal = (task: any = null, forceEditMode: boolean = false) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'In Arbeit',
        assigned_to_id: task.assigned_to_id || '',
        project_id: task.project_id || '',
        due_date: task.due_date ? task.due_date.split('T')[0] : getISODate(),
        time: task.time || '',
      });
      setIsModalEditMode(forceEditMode);
    } else {
      setEditingTask(null);
      setFormData({
        title: '',
        description: '',
        status: 'In Arbeit',
        assigned_to_id: '',
        project_id: '',
        due_date: getISODate(),
        time: '',
      });
      setIsModalEditMode(true);
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
    if (formData.time) data.append('time', formData.time);

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

  const openAttachment = (att: any) => {
    if (!att) return;
    const url = att.original_url || att.originalUrl || att.file_url || att.fileUrl;
    const fileName = att.file_name || att.fileName;
    
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

  const translateStatus = (st: string) => {
    if (st === 'IN_PROGRESS') return 'In Arbeit';
    if (st === 'WAITING') return 'Warten';
    if (st === 'COMPLETED') return 'Erledigt';
    return st || 'Offen';
  };

  const TaskCard = ({ task }: any) => {
    const isOwnerOrHigher = canCreateTask || currentUser?.id === task.creator_id;

    return (
      <TouchableOpacity 
        activeOpacity={0.95} 
        onPress={() => handleOpenModal(task, false)}
      >
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
              {task.time && (
                <View className="flex-row items-center ml-2 border-l border-white/10 pl-2">
                   <Clock size={10} color="#EF4444" />
                   <Text className="text-[#EF4444] text-[10px] font-bold ml-1">{task.time}</Text>
                </View>
              )}
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
                const url = att.file_url || att.fileUrl;
                const thumbUrl = att.thumb_url || att.thumbUrl;
                // Use thumbUrl for icon preview, fallback to fileUrl
                const displayUrl = thumbUrl || url;
                const imgUri = displayUrl ? (displayUrl.startsWith('http') ? displayUrl : `${serverDomain}${displayUrl}`) : null;
                return (
                  <TouchableOpacity 
                     key={att.id} 
                     onPress={() => openAttachment(att)}
                     activeOpacity={0.7}
                     className="mr-2 border border-white/5 rounded-lg p-2 flex-row items-center bg-black/20"
                  >
                    {att.content_type?.includes('video') ? (
                      <View className="w-8 h-8 rounded bg-gray-800 justify-center items-center">
                         <Text className="text-white text-[8px] font-bold">VID</Text>
                      </View>
                    ) : (
                      <View className="w-8 h-8 rounded bg-white/5 justify-center items-center">
                        <ImageIcon size={16} color="#6B7280" />
                      </View>
                    )}
                    <View className="ml-2 w-24 flex-row items-center justify-between">
                      <Text className="text-gray-300 text-xs font-bold flex-1 mr-1" numberOfLines={1}>
                        {att.file_name}
                      </Text>
                      <TouchableOpacity onPress={() => {
                        const downloadUrl = att.original_url || att.originalUrl || att.file_url || att.fileUrl;
                        downloadFile(downloadUrl, att.file_name);
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

        {/* Bottom Footer */}
        <View className="flex-row justify-between items-center pt-3 border-t border-white/5 mt-2">
           <View className="flex-row items-center flex-1">
             <LogOut size={12} color="#6B7280" style={{ transform: [{ rotate: '180deg' }] }} className="mr-1" />
             {task.project ? (
               <TouchableOpacity 
                 onPress={() => navigation.navigate('ProjectDetail', { id: task.project.id })}
                 className="flex-1"
               >
                 <Text className="text-blue-400 text-[10px] font-bold uppercase" numberOfLines={1}>
                    {task.project.project_number} - {task.project.title}
                 </Text>
               </TouchableOpacity>
             ) : (
               <Text className="text-gray-500 text-[10px] font-bold uppercase flex-1" numberOfLines={1}>
                  Kein Projekt
               </Text>
             )}
           </View>
           
           {(task.assigned_to || task.creator) && (
              <View className="bg-white/5 px-2 py-1.5 rounded-md flex-row items-center border border-white/10">
                <User size={12} color="#60A5FA" className="mr-2" />
                <Text className="text-white text-[10px] font-bold">{task.assigned_to?.name || task.creator?.name || 'System Admin1'}</Text>
              </View>
           )}
        </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  const renderMonthView = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayIndex = getFirstDayOfMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month - 1);
    
    const gridDays = [];
    
    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      gridDays.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        dateObj: new Date(year, month - 1, prevMonthDays - i)
      });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      gridDays.push({
        day: i,
        isCurrentMonth: true,
        dateObj: new Date(year, month, i)
      });
    }
    
    // Next month padding
    const totalCells = gridDays.length > 35 ? 42 : 35;
    const nextMonthPadding = totalCells - gridDays.length;
    for (let i = 1; i <= nextMonthPadding; i++) {
      gridDays.push({
        day: i,
        isCurrentMonth: false,
        dateObj: new Date(year, month + 1, i)
      });
    }
    
    const dayTasksForSelected = tasks.filter((t: any) => t.due_date === selectedCalendarDay);
    
    return (
      <View className="space-y-4">
        <GlassCard className="p-3 bg-black/40">
          {/* Days of week header */}
          <View className="flex-row justify-between mb-3 border-b border-white/5 pb-2">
            {dayNamesShort.map((day, idx) => (
              <Text key={idx} className="w-[14%] text-center text-[10px] font-black text-gray-500 uppercase">
                {day}
              </Text>
            ))}
          </View>
          
          {/* Days grid */}
          <View className="flex-row flex-wrap">
            {gridDays.map((cell, idx) => {
              const cellDateStr = formatDateString(cell.dateObj);
              const isToday = formatDateString(new Date()) === cellDateStr;
              const isSelected = selectedCalendarDay === cellDateStr;
              
              const dayTasks = tasks.filter((t: any) => t.due_date === cellDateStr);
              
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.8}
                  onPress={() => setSelectedCalendarDay(cellDateStr)}
                  className={`w-[14.28%] aspect-square justify-center items-center rounded-xl p-1 mb-1 ${
                    cell.isCurrentMonth ? '' : 'opacity-20'
                  } ${
                    isSelected ? 'bg-brand-blue border border-brand-blue' : isToday ? 'border border-blue-500/50 bg-blue-500/10' : ''
                  }`}
                >
                  <Text className={`text-xs font-bold ${isSelected ? 'text-white' : isToday ? 'text-blue-400 font-black' : 'text-gray-300'}`}>
                    {cell.day}
                  </Text>
                  
                  {/* Color dots for tasks */}
                  {dayTasks.length > 0 && (
                    <View className="flex-row gap-x-[3px] mt-1 justify-center w-full">
                      {dayTasks.slice(0, 3).map((t: any) => (
                        <View 
                          key={t.id} 
                          className={`w-1 h-1 rounded-full ${
                            t.status === 'Erledigt' ? 'bg-green-500' : t.status === 'Warten' ? 'bg-orange-500' : 'bg-blue-500'
                          }`} 
                        />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </GlassCard>

        {/* Selected Day Tasks Header */}
        <View className="flex-row justify-between items-center mt-3 mb-2 px-1">
          <Text className="text-white font-bold text-xs uppercase tracking-widest">
            Aufgaben am {formatDate(selectedCalendarDay)}
          </Text>
          <TouchableOpacity 
            onPress={() => handleOpenModalForDate(selectedCalendarDay)}
            className="flex-row items-center bg-brand-blue/20 px-2.5 py-1.5 rounded-lg border border-brand-blue/30"
          >
            <Plus size={10} color="#3B82F6" className="mr-1" />
            <Text className="text-brand-blue text-[10px] font-bold uppercase tracking-wider">Hinzufügen</Text>
          </TouchableOpacity>
        </View>

        {/* Day Tasks Cards List */}
        <View className="space-y-3">
          {dayTasksForSelected.map((t: any) => (
            <TaskCard key={t.id} task={t} />
          ))}
          {dayTasksForSelected.length === 0 && (
            <GlassCard className="p-8 items-center bg-black/20">
              <Text className="text-gray-500 text-xs font-bold uppercase tracking-widest text-center">
                Keine Aufgaben für diesen Tag vorhanden
              </Text>
            </GlassCard>
          )}
        </View>
      </View>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays(selectedDate);
    
    // Filter tasks based on selected worker
    const weekTasks = tasks.filter((t: any) => {
      if (selectedTimelineUserId !== 'all') {
        if (!t.assigned_to_id || t.assigned_to_id.toString() !== selectedTimelineUserId.toString()) return false;
      }
      return weekDays.some(day => formatDateString(day) === t.due_date);
    });
    
    const activeTasks = weekTasks.filter((t: any) => t.due_date === selectedWeekDay);
    
    const hours = [];
    for (let i = 7; i <= 20; i++) {
      hours.push(i);
    }
    
    const today = now;
    const isSelectedDayToday = formatDateString(today) === selectedWeekDay;
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    
    return (
      <View className="space-y-4">
        {/* Days of week tabs */}
        <GlassCard className="p-3 bg-black/40">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {weekDays.map((day, idx) => {
              const dateStr = formatDateString(day);
              const isSelected = selectedWeekDay === dateStr;
              const isToday = formatDateString(today) === dateStr;
              
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.8}
                  onPress={() => setSelectedWeekDay(dateStr)}
                  className={`px-3 py-2 rounded-xl mr-2 border items-center min-w-[70px] ${
                    isSelected 
                      ? 'bg-brand-blue border-brand-blue' 
                      : isToday 
                        ? 'bg-blue-500/10 border-blue-500/50' 
                        : 'bg-white/5 border-white/5'
                  }`}
                >
                  <Text className={`text-[10px] font-black uppercase ${isSelected ? 'text-white' : isToday ? 'text-blue-400' : 'text-gray-500'}`}>
                    {dayNamesShort[idx]}
                  </Text>
                  <Text className={`text-xs font-black mt-0.5 ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                    {day.getDate()}.{String(day.getMonth() + 1).padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </GlassCard>

        {/* Ganztägig row */}
        <GlassCard className="p-3 bg-black/40 flex-row items-center border-l-4 border-l-purple-500">
          <View className="w-16 items-center border-r border-white/10 pr-2 mr-3">
            <Text className="text-[8px] font-black text-gray-500 uppercase tracking-wider text-center">Ganztägig</Text>
          </View>
          <View className="flex-1 space-y-2">
            {activeTasks.filter((t: any) => !t.time).map((t: any) => (
              <TouchableOpacity 
                key={t.id}
                onPress={() => handleOpenModal(t, false)}
                className="bg-white/5 border border-white/10 rounded-lg p-2 flex-row items-center justify-between"
              >
                <Text className="text-white font-bold text-xs flex-1 truncate pr-2" numberOfLines={1}>{t.title}</Text>
                <ChevronRight size={12} color="#6B7280" />
              </TouchableOpacity>
            ))}
            {activeTasks.filter((t: any) => !t.time).length === 0 && (
              <Text className="text-gray-600 text-[10px] italic font-bold">Keine Aufgaben</Text>
            )}
          </View>
        </GlassCard>

        {/* Hourly rows */}
        <View className="relative bg-black/20 rounded-2xl border border-white/5 p-3 space-y-3">
          {/* Running time indicator line */}
          {isSelectedDayToday && currentHour >= 7 && currentHour < 21 && (
            <View 
              className="absolute left-[70px] right-0 flex-row items-center pointer-events-none z-30"
              style={{ top: `${((currentHour - 7) + currentMinute / 60) * (90 + 12) + 12}px` }} // 90px row height, 12px vertical spacing
            >
              <View className="flex-1 border-t-2 border-red-500 relative flex-row items-center">
                <View className="absolute -left-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-500/30 animate-pulse" />
                <View className="absolute -left-[54px] bg-red-500 px-1.5 py-0.5 rounded text-[8px] font-bold text-white flex-row items-center gap-0.5 shadow-lg">
                  <Clock size={8} color="white" />
                  <Text className="text-white text-[8px] font-bold">{String(currentHour).padStart(2, '0')}:{String(currentMinute).padStart(2, '0')}</Text>
                </View>
              </View>
            </View>
          )}

          {hours.map(hour => {
            const hourStr = `${String(hour).padStart(2, '0')}:00`;
            const hourTasks = activeTasks.filter((t: any) => {
              const taskHour = getTaskHour(t.time);
              return taskHour === hour;
            });
            
            return (
              <View key={hour} className="flex-row items-stretch h-[90px] border-b border-white/5 pb-2">
                {/* Hour Label */}
                <View className="w-16 shrink-0 justify-center items-center border-r border-white/10 pr-2 mr-3">
                  <Text className="text-xs font-black text-gray-500">{hourStr}</Text>
                </View>
                
                {/* Hour slot container */}
                <View className="flex-1 flex-row items-center relative">
                  <View className="flex-1 space-y-1.5 pr-6 overflow-y-auto max-h-[80px]">
                    {hourTasks.map((t: any) => (
                      <TouchableOpacity 
                        key={t.id}
                        onPress={() => handleOpenModal(t, false)}
                        className={`bg-white/5 border border-white/10 rounded-lg p-1.5 flex-row items-center justify-between border-l-4 ${
                          t.status === 'Erledigt' ? 'border-l-green-500' : t.status === 'Warten' ? 'border-l-orange-500' : 'border-l-blue-500'
                        }`}
                      >
                        <View className="flex-1 pr-1">
                          <Text className="text-white font-bold text-[10px] truncate" numberOfLines={1}>{t.title}</Text>
                          {selectedTimelineUserId === 'all' && t.assignee && (
                            <Text className="text-blue-400 text-[8px] font-bold truncate mt-0.5">
                              {t.assignee.name}
                            </Text>
                          )}
                        </View>
                        <ChevronRight size={10} color="#6B7280" />
                      </TouchableOpacity>
                    ))}
                    {hourTasks.length === 0 && (
                      <View className="flex-1 justify-center">
                        <Text className="text-gray-600 text-[10px] font-bold italic">Frei</Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Inline Add Button on Right */}
                  <TouchableOpacity
                    onPress={() => handleOpenModalForDate(selectedWeekDay, selectedTimelineUserId === 'all' ? '' : selectedTimelineUserId, `${String(hour).padStart(2, '0')}:00`)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 items-center justify-center border border-blue-500/30"
                  >
                    <Plus size={12} color="#3B82F6" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ScreenLayout scroll={false}>
      <View className="mb-4 flex-row items-center justify-between">
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

      {/* View Switcher Toggle */}
      <View className="flex-row bg-white/5 p-1 rounded-xl border border-white/10 mb-4">
        <TouchableOpacity
          onPress={() => setViewMode('list')}
          className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${
            viewMode === 'list' 
              ? 'bg-brand-blue border border-brand-blue' 
              : ''
          }`}
        >
          <Text className={`text-xs font-bold uppercase tracking-wider ${viewMode === 'list' ? 'text-white' : 'text-gray-400'}`}>
            Liste
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setViewMode('calendar')}
          className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${
            viewMode === 'calendar' 
              ? 'bg-brand-blue border border-brand-blue' 
              : ''
          }`}
        >
          <Text className={`text-xs font-bold uppercase tracking-wider ${viewMode === 'calendar' ? 'text-white' : 'text-gray-400'}`}>
            Zeitplan
          </Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Mode Tabs & Date Navigation */}
      {viewMode === 'calendar' && (
        <View className="mb-4 space-y-3 animate-[fadeIn_0.2s_ease-out]">
          {/* Sub Tab Switchers */}
          <View className="flex-row bg-black/40 p-1 rounded-xl border border-white/5 self-start">
            <TouchableOpacity
              onPress={() => setCalendarTab('month')}
              className={`px-3 py-1.5 rounded-lg mr-1 ${
                calendarTab === 'month' ? 'bg-white/10 border border-white/5' : ''
              }`}
            >
              <Text className={`text-[10px] font-bold uppercase tracking-wider ${calendarTab === 'month' ? 'text-white' : 'text-gray-400'}`}>
                Monatsansicht
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCalendarTab('week')}
              className={`px-3 py-1.5 rounded-lg ${
                calendarTab === 'week' ? 'bg-white/10 border border-white/5' : ''
              }`}
            >
              <Text className={`text-[10px] font-bold uppercase tracking-wider ${calendarTab === 'week' ? 'text-white' : 'text-gray-400'}`}>
                Wochenplan
              </Text>
            </TouchableOpacity>
          </View>

          {/* Date Navigators */}
          <View className="flex-row items-center justify-between gap-x-2">
            <View className="flex-row items-center bg-black/40 rounded-xl border border-white/5 overflow-hidden p-0.5">
              <TouchableOpacity 
                onPress={handlePrevDate}
                className="px-3 py-2 rounded-lg bg-white/5 mr-1"
              >
                <Text className="text-white text-xs font-bold">{"<"}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSetToday}
                className="px-3 py-2 rounded-lg bg-white/5 mr-1"
              >
                <Text className="text-blue-400 text-xs font-bold uppercase tracking-wider">Heute</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleNextDate}
                className="px-3 py-2 rounded-lg bg-white/5"
              >
                <Text className="text-white text-xs font-bold">{">"}</Text>
              </TouchableOpacity>
            </View>
            
            <GlassCard className="px-3 py-2 border border-white/10 flex-1 max-w-[180px] items-center">
              <Text className="text-white font-bold text-[10px] tracking-wider" numberOfLines={1}>
                {getCalendarNavTitle()}
              </Text>
            </GlassCard>
          </View>

          {/* Wochenplan Selector Dropdown for Employees */}
          {calendarTab === 'week' && (
            <View className="mb-2">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                <TouchableOpacity
                  onPress={() => setSelectedTimelineUserId('all')}
                  className={`px-3 py-2 rounded-xl mr-2 border ${
                    selectedTimelineUserId === 'all' 
                      ? 'bg-brand-blue border-brand-blue' 
                      : 'bg-white/5 border-white/5'
                  }`}
                >
                  <Text className={`text-[10px] font-bold ${selectedTimelineUserId === 'all' ? 'text-white' : 'text-gray-400'}`}>
                    Alle Mitarbeiter
                  </Text>
                </TouchableOpacity>
                {usersList.map((u: any) => (
                  <TouchableOpacity
                    key={u.id}
                    onPress={() => setSelectedTimelineUserId(u.id)}
                    className={`px-3 py-2 rounded-xl mr-2 border ${
                      selectedTimelineUserId === u.id 
                        ? 'bg-brand-blue border-brand-blue' 
                        : 'bg-white/5 border-white/5'
                    }`}
                  >
                    <Text className={`text-[10px] font-bold ${selectedTimelineUserId === u.id ? 'text-white' : 'text-gray-400'}`}>
                      {u.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      ) : viewMode === 'list' ? (
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
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {calendarTab === 'month' ? renderMonthView() : renderWeekView()}
        </ScrollView>
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
                {editingTask ? (isModalEditMode ? 'Aufgabe bearbeiten' : 'Aufgabendetails') : 'Neue Aufgabe'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Text className="text-gray-500 font-bold uppercase text-xs tracking-widest">Schließen</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              {!isModalEditMode && editingTask ? (
                <View className="space-y-6">
                  {/* Status Indicator */}
                  <View className="mb-5">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Status</Text>
                    <GlassCard className="p-4 bg-black/40 border border-white/5 flex-row items-center">
                      <Construction size={18} color={editingTask.status === 'In Arbeit' ? '#3B82F6' : editingTask.status === 'Erledigt' ? '#10B981' : '#F59E0B'} />
                      <Text className={`font-black text-sm ml-2 ${editingTask.status === 'In Arbeit' ? 'text-brand-blue' : editingTask.status === 'Erledigt' ? 'text-green-500' : 'text-orange-500'}`}>
                        {translateStatus(editingTask.status)}
                      </Text>
                    </GlassCard>
                  </View>

                  {/* Assignee */}
                  <View className="mb-5">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Zugewiesen an</Text>
                    <GlassCard className="p-4 bg-black/40 border border-white/5 flex-row items-center">
                      <User size={16} color="#60A5FA" className="mr-3" />
                      <Text className="text-white font-bold text-sm">
                        {editingTask.assigned_to?.name || editingTask.creator?.name || 'Unbekannt'}
                      </Text>
                    </GlassCard>
                  </View>

                  {/* Due Date & Time */}
                  <View className="mb-5 flex-row justify-between gap-x-3">
                    <View className="flex-1">
                      <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Fälligkeit</Text>
                      <GlassCard className="p-4 bg-black/40 border border-white/5 flex-row items-center">
                        <CalendarIcon size={16} color="#EF4444" className="mr-2" />
                        <Text className="text-white font-bold text-xs">
                          {editingTask.due_date ? new Date(editingTask.due_date).toLocaleDateString('de-DE') : 'Keine Frist'}
                        </Text>
                      </GlassCard>
                    </View>
                    {editingTask.time && (
                      <View className="flex-1">
                        <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Uhrzeit</Text>
                        <GlassCard className="p-4 bg-black/40 border border-white/5 flex-row items-center">
                          <Clock size={16} color="#EF4444" className="mr-2" />
                          <Text className="text-white font-bold text-xs">{editingTask.time}</Text>
                        </GlassCard>
                      </View>
                    )}
                  </View>

                  {/* Project */}
                  <View className="mb-5">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Projekt</Text>
                    <GlassCard className="p-4 bg-black/40 border border-white/5">
                      {editingTask.project ? (
                        <TouchableOpacity
                          onPress={() => {
                            closeModal();
                            navigation.navigate('ProjectDetail', { id: editingTask.project.id });
                          }}
                          className="flex-row items-center"
                        >
                          <Briefcase size={16} color="#10B981" className="mr-3" />
                          <Text className="text-blue-400 font-bold text-sm underline flex-1 pr-2" numberOfLines={1}>
                            {editingTask.project.project_number} - {editingTask.project.title}
                          </Text>
                          <ChevronRight size={14} color="#6B7280" />
                        </TouchableOpacity>
                      ) : (
                        <View className="flex-row items-center">
                          <Briefcase size={16} color="#6B7280" className="mr-3" />
                          <Text className="text-gray-500 font-bold text-sm">Kein Projekt</Text>
                        </View>
                      )}
                    </GlassCard>
                  </View>

                  {/* Description */}
                  <View className="mb-5">
                    <View className="flex-row justify-between items-center mb-2 ml-1">
                      <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Beschreibung</Text>
                      <TouchableOpacity 
                        onPress={() => handleCopyDescription(editingTask.description)}
                        className="flex-row items-center bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5"
                      >
                        <Copy size={10} color="#3B82F6" className="mr-1.5" />
                        <Text className="text-white text-[9px] font-bold uppercase tracking-widest">Kopieren</Text>
                      </TouchableOpacity>
                    </View>
                    <GlassCard className="p-4 bg-black/40 border border-white/5 min-h-[80px]">
                      <Text selectable={true} className="text-gray-300 text-sm leading-relaxed">
                        {editingTask.description || 'Keine Beschreibung vorhanden.'}
                      </Text>
                    </GlassCard>
                  </View>

                  {/* Attachments Display Grid */}
                  {editingTask.attachments && editingTask.attachments.length > 0 && (
                    <View className="mb-6">
                      <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">ANHÄNGE (ZUM ANSEHEN ANKLICKEN)</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {editingTask.attachments.map((att: any, idx: number) => {
                          const url = att.file_url || att.fileUrl;
                          const thumbUrl = att.thumb_url || att.thumbUrl || url;
                          const fullUrl = thumbUrl ? (thumbUrl.startsWith('http') ? thumbUrl : `${serverDomain}${thumbUrl}`) : null;
                          const isImage = att.content_type?.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                          
                          return (
                            <TouchableOpacity 
                              key={att.id}
                              activeOpacity={0.8}
                              onPress={() => openAttachment(att)}
                              className="w-[28%] aspect-square rounded-xl overflow-hidden border border-white/10 bg-black/40 justify-center items-center relative"
                            >
                              {isImage && fullUrl ? (
                                <Image source={{ uri: fullUrl }} className="w-full h-full object-cover" />
                              ) : (
                                <View className="items-center p-1">
                                  <ImageIcon size={20} color="#6B7280" className="mb-1" />
                                  <Text className="text-[8px] text-gray-400 text-center font-bold px-1" numberOfLines={1}>{att.file_name}</Text>
                                </View>
                              )}
                              <View className="absolute bottom-1 right-1 bg-black/50 p-1 rounded-full">
                                <Download size={10} color="white" />
                              </View>
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

              {/* Due Time */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Fälligkeitszeit (Optional)</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(true)}>
                  <GlassCard className="p-4 bg-black/40 border border-white/5 flex-row items-center justify-between">
                    <Clock size={16} color="#6B7280" />
                    <Text className="text-white font-bold text-sm tracking-widest">{formData.time || '--:--'}</Text>
                    <Clock size={16} color="#6B7280" />
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

                </View>
              )}
              <View className="h-10" />
            </ScrollView>

            <View className="flex-row justify-between pt-4 border-t border-white/5">
              {!isModalEditMode && editingTask ? (
                <>
                  {(canCreateTask || currentUser?.id === editingTask.creator_id) ? (
                    <TouchableOpacity 
                      onPress={() => setIsModalEditMode(true)}
                      className="bg-brand-blue flex-1 py-4 rounded-xl items-center mr-2 shadow-lg shadow-blue-500/20 border border-brand-blue"
                    >
                      <Text className="text-white font-bold text-sm tracking-widest">
                        BEARBEITEN
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity 
                    onPress={closeModal}
                    className="bg-white/5 flex-1 py-4 rounded-xl items-center border border-white/10"
                  >
                    <Text className="text-white font-bold text-sm tracking-widest">
                      SCHLIEẞEN
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity 
                    onPress={() => {
                      if (editingTask) {
                        setIsModalEditMode(false);
                      } else {
                        closeModal();
                      }
                    }}
                    className="bg-white/5 flex-1 py-4 rounded-xl items-center mr-2 border border-white/10"
                  >
                      <Text className="text-white font-bold text-sm tracking-widest">
                        {editingTask ? 'ZURÜCK' : 'ABBRECHEN'}
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
                        {editingTask ? 'SPEICHERN' : 'SPEICHERN'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
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
