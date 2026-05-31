import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  ImageBackground,
  Image,
  Linking,
  Dimensions,
  Platform,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Modal,
  PanResponder
} from 'react-native';
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import ImageView from "react-native-image-viewing";
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjectById,
  fetchProjectStages,
  updateProjectStage,
  createProjectStage,
  deleteProjectStage,
  fetchProjectFiles,
  uploadProjectFiles,
  createProjectFolder,
  deleteProjectFile,
  updateProjectFolderPermissions,
  toggleProjectFolderPublic,
  updateProject,
  fetchCategories,
  fetchSubcontractors
} from '../api/projects';
import { fetchRoles } from '../api/roles';
import { fetchUsers } from '../api/users';
import { fetchNotesByProjectId, createNote, deleteNote } from '../api/notes';
import * as Clipboard from 'expo-clipboard';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ScreenLayout } from '../components/ScreenLayout';
import { GlassCard } from '../components/GlassCard';
import {
  Briefcase,
  Calendar,
  User,
  Clock,
  FileText,
  CheckSquare,
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  Building,
  Target,
  Users as UsersIcon,
  ChevronRight,
  Plus,
  Trash2,
  UploadCloud,
  X,
  Folder,
  File,
  MoreVertical,
  FolderPlus,
  Download,
  AlertCircle,
  Share2,
  ShieldCheck,
  Lock,
  Link as LinkIcon,
  Copy,
  Check,
  Shield,
  HardHat,
  Briefcase as BriefcaseIcon,
  Image as ImageIcon,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Car,
  PieChart
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';

import { serverDomain, frontendDomain, getFullUrl, apiClient } from '../api/client';

const { width } = Dimensions.get('window');

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

export default function ProjectDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const queryClient = useQueryClient();
  const { id } = route.params as { id: number };
  const { user } = useAuth();

  // 1. All Hooks at the very top
  const [activeTab, setActiveTab] = useState('info');
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<any>(null);
  const [stageTitle, setStageTitle] = useState('');
  const [stageDescription, setStageDescription] = useState('');
  const [attachments, setAttachments] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);
  const [imageIdsToDelete, setImageIdsToDelete] = useState<string[]>([]);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<{ uri: string }[]>([]);
  const [currentViewerIndex, setCurrentViewerIndex] = useState(0);

  // Stage progress & double click states
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSavingStage, setIsSavingStage] = useState(false);

  // Diary Tab States
  const [isDiaryModalOpen, setIsDiaryModalOpen] = useState(false);
  const [diaryTitle, setDiaryTitle] = useState('');
  const [diaryContent, setDiaryContent] = useState('');
  const [diaryColor, setDiaryColor] = useState(COLORS[0]);
  const [diaryDate, setDiaryDate] = useState(getISODate());
  const [showDiaryDatePicker, setShowDiaryDatePicker] = useState(false);
  const [diaryTime, setDiaryTime] = useState('');
  const [showDiaryTimePicker, setShowDiaryTimePicker] = useState(false);
  const [diaryAttachments, setDiaryAttachments] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [isSavingDiary, setIsSavingDiary] = useState(false);

  // Files Tab State
  const [currentPath, setCurrentPath] = useState('');
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);
  const [allowedRoleIds, setAllowedRoleIds] = useState<number[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isBatchUploading, setIsBatchUploading] = useState(false);

  // Edit Project State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCustomClientEnabled, setIsCustomClientEnabled] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    address: '',
    status: '',
    progress: 0,
    start_date: '',
    end_date: '',
    category_id: '' as string | number,
    subcategory_id: '' as string | number,
    budget: '',
    client_first_name: '',
    client_last_name: '',
    client_phone: '',
    client_email: '',
    client_address: '',
    client_notes: ''
  });
  const [assignedUsers, setAssignedUsers] = useState<{ user_id: number, role: string }[]>([]);
  const [assignedSubcontractors, setAssignedSubcontractors] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<{ category_id: number; subcategory_id: number | null }[]>([]);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Geocoding, Routing & Weather Forecast states
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: number } | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [projectCoords, setProjectCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [weatherForecast, setWeatherForecast] = useState<any[]>([]);
  const [loadingWeather, setLoadingWeather] = useState(false);

  const modalPanResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dy > 50) { // Swiped down
          setIsStageModalOpen(false);
        }
      },
    })
  ).current;

  const { data: projectRes, isLoading: itemsLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProjectById(id),
  });

  const { data: companyData } = useQuery({
    queryKey: ['company-public'],
    queryFn: async () => {
      const res = await apiClient.get('/company/public');
      return res.data?.data;
    }
  });

  const { data: stagesRes, isLoading: stagesLoading } = useQuery({
    queryKey: ['project-stages', id],
    queryFn: () => fetchProjectStages(id),
    enabled: activeTab === 'steps'
  });

  const { data: diaryRes, isLoading: diaryLoading } = useQuery({
    queryKey: ['project-diary', id],
    queryFn: () => fetchNotesByProjectId(id),
    enabled: activeTab === 'diary'
  });

  const diaryLogs = diaryRes?.data?.notes || [];

  const { data: categoriesRes } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    enabled: isEditModalOpen
  });

  const { data: subcontractorsRes } = useQuery({
    queryKey: ['subcontractors'],
    queryFn: fetchSubcontractors,
    enabled: isEditModalOpen
  });

  const { data: allUsersRes } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    enabled: isEditModalOpen
  });

  const updateProjectMutation = useMutation({
    mutationFn: (payload: any) => updateProject(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setIsEditModalOpen(false);
      Alert.alert('Erfolg', 'Projekt wurde aktualisiert.');
    },
    onError: (err: any) => {
      Alert.alert('Fehler', err.response?.data?.error || 'Projekt konnte nicht aktualisiert werden.');
    }
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ stageId, status }: { stageId: number, status: string }) =>
      updateProjectStage(stageId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-stages', id] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    }
  });

  const createStageMutation = useMutation({
    mutationFn: (data: any) => {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('description', data.description || '');
      formData.append('project_id', String(id));

      attachments.forEach((file: any, index) => {
        formData.append('images', {
          uri: file.uri,
          name: file.fileName || `media_${index}.jpg`,
          type: file.mimeType || (file.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        } as any);
      });

      return createProjectStage(formData, (progressEvent) => {
        const total = progressEvent.total || 1;
        const percentCompleted = Math.round((progressEvent.loaded * 100) / total);
        setUploadProgress(percentCompleted);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-stages', id] });
      setIsStageModalOpen(false);
      resetStageForm();
    },
    onError: () => {
      Alert.alert('Fehler', 'Etappe konnte nicht erstellt werden.');
    },
    onSettled: () => {
      setUploadProgress(0);
    }
  });

  const updateStageDetailsMutation = useMutation({
    mutationFn: ({ stageId, data }: { stageId: number, data: any }) => {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('description', data.description || '');

      attachments.forEach((file: any, index) => {
        formData.append('images', {
          uri: file.uri,
          name: file.fileName || `media_${index}.jpg`,
          type: file.mimeType || (file.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        } as any);
      });

      if (imageIdsToDelete.length > 0) {
        formData.append('imagesToDelete', JSON.stringify(imageIdsToDelete));
      }

      return updateProjectStage(stageId, formData, (progressEvent) => {
        const total = progressEvent.total || 1;
        const percentCompleted = Math.round((progressEvent.loaded * 100) / total);
        setUploadProgress(percentCompleted);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-stages', id] });
      setIsStageModalOpen(false);
      resetStageForm();
    },
    onError: () => {
      Alert.alert('Fehler', 'Etappe konnte nicht aktualisiert werden.');
    },
    onSettled: () => {
      setUploadProgress(0);
    }
  });

  const createDiaryLogMutation = useMutation({
    mutationFn: (formData: FormData) => createNote(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-diary', id] });
      setIsDiaryModalOpen(false);
      resetDiaryForm();
    },
    onError: () => {
      Alert.alert('Fehler', 'Bautagebucheintrag konnte nicht erstellt werden.');
    }
  });

  const deleteDiaryLogMutation = useMutation({
    mutationFn: (logId: number) => deleteNote(logId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-diary', id] });
    },
    onError: () => {
      Alert.alert('Fehler', 'Eintrag konnte nicht gelöscht werden.');
    }
  });

  const deleteStageMutation = useMutation({
    mutationFn: (stageId: number) => deleteProjectStage(stageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-stages', id] });
    }
  });

  // Files Tab Logic
  const { data: filesRes, isLoading: filesLoading, refetch: refetchFiles } = useQuery({
    queryKey: ['project-files', id, currentPath],
    queryFn: () => fetchProjectFiles(id, currentPath),
    enabled: activeTab === 'files'
  });

  const files = filesRes?.data || [];

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => createProjectFolder(id, { name, path: currentPath }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-files', id, currentPath] });
      setIsNewFolderModalOpen(false);
      setNewFolderName('');
    },
    onError: (err: any) => {
      Alert.alert('Fehler', err.response?.data?.error || 'Ordner konnte nicht erstellt werden.');
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: (filePath: string) => deleteProjectFile(id, filePath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-files', id, currentPath] });
    }
  });

  // uploadFilesMutation removed - using sequential upload logic instead

  const { data: rolesRes } = useQuery({
    queryKey: ['roles'],
    queryFn: fetchRoles,
    enabled: activeTab === 'files'
  });

  const managementRoleNames = ['Admin', 'Büro', 'Projektleiter', 'Gruppenleiter'];
  const canManagePermissions = typeof user?.role === 'string'
    ? managementRoleNames.includes(user.role)
    : managementRoleNames.includes((user?.role as any)?.name || '');
  const isManagement = canManagePermissions;
  const roleName = typeof user?.role === 'string' ? user.role : (user?.role as any)?.name || '';
  const isWorker = roleName === 'Worker';
  const isGroupLeader = roleName === 'Gruppenleiter';
  const isRestricted = isWorker || isGroupLeader;
  const roles = (rolesRes?.data?.roles || [])
    .filter((role: any) => !['Admin', 'Büro'].includes(role.name))
    .sort((a: any, b: any) => {
      // Priority order for remaining roles: Projektleiter (0), others (1)
      if (a.name === 'Projektleiter') return -1;
      if (b.name === 'Projektleiter') return 1;
      return a.name.localeCompare(b.name);
    });

  const updatePermissionsMutation = useMutation({
    mutationFn: (data: any) => updateProjectFolderPermissions(id, data),
    onSuccess: () => {
      setIsPermissionsModalOpen(false);
      setSelectedFolder(null); // Clear selected folder state
      queryClient.invalidateQueries({ queryKey: ['project-files', id, currentPath] });
    },
    onError: (err: any) => {
      Alert.alert('Fehler', err.response?.data?.error || 'Berechtigungen konnten nicht gespeichert werden.');
    }
  });

  const togglePublicMutation = useMutation({
    mutationFn: (data: any) => toggleProjectFolderPublic(id, data),
    onSuccess: (res: any) => {
      setIsPublic(res.is_public);
      setShareToken(res.share_token);
      queryClient.invalidateQueries({ queryKey: ['project-files', id, currentPath] });
    },
    onError: (err: any) => {
      Alert.alert('Fehler', err.response?.data?.error || 'Link konnte nicht aktiviert werden.');
    }
  });

  // Haversine fallback formula for straight line distance
  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateDistance = async (fromAddr: string, toAddr: string) => {
    try {
      // 1. Geocode Company address
      const fromRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fromAddr)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'EP-Mobile-App-Geocoder' } }
      );
      const fromData = await fromRes.json();
      if (!fromData || fromData.length === 0) return null;
      const fromLat = parseFloat(fromData[0].lat);
      const fromLon = parseFloat(fromData[0].lon);

      // 2. Geocode Project address
      const toRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(toAddr)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'EP-Mobile-App-Geocoder' } }
      );
      const toData = await toRes.json();
      if (!toData || toData.length === 0) return null;
      const toLat = parseFloat(toData[0].lat);
      const toLon = parseFloat(toData[0].lon);

      setProjectCoords({ lat: toLat, lon: toLon });

      // 3. Get OSRM road distance
      try {
        const osrmRes = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=false`
        );
        const osrmData = await osrmRes.json();
        if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
          const route = osrmData.routes[0];
          const distanceKm = (route.distance / 1000).toFixed(1);
          const durationMin = Math.round(route.duration / 60);
          return { distance: distanceKm, duration: durationMin };
        }
      } catch (osrmErr) {
        console.warn('OSRM router failed, using Haversine fallback:', osrmErr);
      }

      // Fallback
      const distanceKm = haversineDistance(fromLat, fromLon, toLat, toLon).toFixed(1);
      return { distance: distanceKm, duration: Math.round(parseFloat(distanceKm) * 1.2) };
    } catch (err) {
      console.error('Error calculating distance:', err);
      return null;
    }
  };

  useEffect(() => {
    if (projectRes?.address && companyData?.settings?.address) {
      const fromAddr = `${companyData.settings.address}, ${companyData.settings.zipCity || ''}`;
      const toAddr = projectRes.address;

      setCalculatingRoute(true);
      calculateDistance(fromAddr, toAddr).then((info) => {
        setRouteInfo(info);
        setCalculatingRoute(false);
      });
    } else if (projectRes?.data?.project?.address && companyData?.settings?.address) {
      const fromAddr = `${companyData.settings.address}, ${companyData.settings.zipCity || ''}`;
      const toAddr = projectRes.data.project.address;

      setCalculatingRoute(true);
      calculateDistance(fromAddr, toAddr).then((info) => {
        setRouteInfo(info);
        setCalculatingRoute(false);
      });
    }
  }, [projectRes?.address, projectRes?.data?.project?.address, companyData?.settings?.address]);

  useEffect(() => {
    if (projectCoords) {
      setLoadingWeather(true);
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${projectCoords.lat}&longitude=${projectCoords.lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data && data.daily) {
            const forecast = [];
            for (let i = 0; i < 3; i++) {
              forecast.push({
                date: new Date(data.daily.time[i]).toLocaleDateString('de-DE', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                }),
                code: data.daily.weathercode[i],
                tempMax: Math.round(data.daily.temperature_2m_max[i]),
                tempMin: Math.round(data.daily.temperature_2m_min[i]),
              });
            }
            setWeatherForecast(forecast);
          }
          setLoadingWeather(false);
        })
        .catch((err) => {
          console.error('Weather forecast fetch error:', err);
          setLoadingWeather(false);
        });
    }
  }, [projectCoords]);

  const getWeatherDesc = (code: number) => {
    if (code === 0) return 'Sonnig';
    if ([1, 2, 3].includes(code)) return 'Leicht bewölkt';
    if ([45, 48].includes(code)) return 'Nebel';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Regen';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Schnee';
    if ([95, 96, 99].includes(code)) return 'Gewitter';
    return 'Bewölkt';
  };

  const getWeatherIcon = (code: number, size = 16) => {
    if (code === 0) return <Sun size={size} color="#F59E0B" />;
    if ([1, 2, 3].includes(code)) return <Cloud size={size} color="#9CA3AF" />;
    if ([45, 48].includes(code)) return <CloudFog size={size} color="#9CA3AF" />;
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return <CloudRain size={size} color="#3B82F6" />;
    if ([71, 73, 75, 77, 85, 86].includes(code)) return <CloudSnow size={size} color="#3B82F6" />;
    if ([95, 96, 99].includes(code)) return <CloudLightning size={size} color="#8B5CF6" />;
    return <Cloud size={size} color="#9CA3AF" />;
  };

  // 2. Early return for loading
  if (itemsLoading) {
    return (
      <ScreenLayout>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-gray-500 mt-4 font-bold uppercase tracking-widest text-[10px]">Lade Projekt...</Text>
        </View>
      </ScreenLayout>
    );
  }

  // 3. Derived values and helper functions
  const project = projectRes?.data?.project || projectRes;
  const stages = stagesRes?.data?.stages || [];
  const progress = project?.progress || 0;

  const resetStageForm = () => {
    setStageTitle('');
    setStageDescription('');
    setEditingStage(null);
    setAttachments([]);
    setExistingImages([]);
    setImageIdsToDelete([]);
  };

  const handleOpenStageModal = (stage: any = null) => {
    resetStageForm();
    if (stage) {
      setEditingStage(stage);
      setStageTitle(stage.title);
      setStageDescription(stage.description || '');
      setExistingImages(stage.images || []);
    }
    setIsStageModalOpen(true);
  };

  const handleOpenViewer = (images: any[], index: number = 0) => {
    const formatted = images.map(img => ({
      uri: getFullUrl(img.uri || img.path || img)
    }));
    setViewerImages(formatted);
    setCurrentViewerIndex(index);
    setIsViewerVisible(true);
  };

  const handleDownloadImage = async (url: string) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Fehler', 'Zugriff auf Galerie verweigert.');
        return;
      }
      const filename = url.split('/').pop() || `img_${Date.now()}.jpg`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Erfolg', 'In Galerie gespeichert.');
    } catch (error) {
      Alert.alert('Fehler', 'Konnte nicht gespeichert werden.');
    }
  };

  const handleShareImage = async (url: string) => {
    try {
      const filename = url.split('/').pop() || `img_${Date.now()}.jpg`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      await Sharing.shareAsync(uri);
    } catch (error) {
      Alert.alert('Fehler', 'Konnte nicht geteilt werden.');
    }
  };

  const ImageHeader = ({ index }: { index: number }) => (
    <View className="flex-row justify-between items-center px-6 pt-12">
      <TouchableOpacity
        onPress={() => setIsViewerVisible(false)}
        className="w-10 h-10 items-center justify-center rounded-full bg-black/40 border border-white/10"
      >
        <X size={20} color="white" />
      </TouchableOpacity>
      <View className="flex-row">
        <TouchableOpacity
          onPress={() => handleDownloadImage(viewerImages[index]?.uri)}
          className="w-10 h-10 items-center justify-center rounded-full bg-black/40 border border-white/10 mr-3"
        >
          <Download size={20} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleShareImage(viewerImages[index]?.uri)}
          className="w-10 h-10 items-center justify-center rounded-full bg-black/40 border border-white/10"
        >
          <Share2 size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleRemoveExistingImage = (imgId: string) => {
    setImageIdsToDelete(prev => [...prev, imgId]);
    setExistingImages(prev => prev.filter(img => img.id !== imgId));
  };

  const handlePickMedia = () => {
    Alert.alert(
      'Dateien auswählen',
      'Wählen Sie eine Quelle',
      [
        {
          text: 'Kamera', onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
            if (!result.canceled) setAttachments(prev => [...prev, ...result.assets]);
          }
        },
        {
          text: 'Galerie', onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, allowsMultipleSelection: true });
            if (!result.canceled) setAttachments(prev => [...prev, ...result.assets]);
          }
        },
        { text: 'Abbrechen', style: 'cancel' }
      ]
    );
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Files Tab Helpers
  const isImageFile = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'heif', 'tiff', 'bmp', 'jfif', 'avif', 'ico', 'dng'].includes(ext || '');
  };

  const handleOpenPermissions = (folder: any) => {
    setSelectedFolder(folder);
    const perms = folder.permissions || {};

    let currentAllowed = [];
    if (perms.allowed_role_ids) {
      currentAllowed = Array.isArray(perms.allowed_role_ids)
        ? perms.allowed_role_ids
        : JSON.parse(perms.allowed_role_ids);
    }

    setAllowedRoleIds(currentAllowed);
    setIsPublic(perms.is_public || false);
    setShareToken(perms.share_token || null);
    setIsPermissionsModalOpen(true);
  };

  const toggleRole = (roleId: number) => {
    setAllowedRoleIds(prev =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const handleCopyLink = async () => {
    if (!shareToken) return;
    const link = `${frontendDomain}/shared/${shareToken}`;
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileOpen = async (file: any) => {
    if (file.isDirectory) {
      setCurrentPath(currentPath ? `${currentPath}/${file.physicalName}` : file.physicalName);
      return;
    }

    if (isImageFile(file.name)) {
      const allImages = files.filter((f: any) => !f.isDirectory && isImageFile(f.name));
      const initialIndex = allImages.findIndex((f: any) => f.name === file.name);
      handleOpenViewer(allImages.map((f: any) => f.url), initialIndex);
      return;
    }

    try {
      const fileUri = `${FileSystem.cacheDirectory}${file.name}`;
      const downloadUrl = getFullUrl(file.url);

      const { uri } = await FileSystem.downloadAsync(downloadUrl, fileUri);
      await Sharing.shareAsync(uri);
    } catch (error) {
      Alert.alert('Fehler', 'Datei konnte nicht geöffnet werden.');
    }
  };

  const executeFileUpload = async (assets: any[]) => {
    if (!assets || assets.length === 0) return;

    setIsBatchUploading(true);
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB

    try {
      for (const asset of assets) {
        // Size validation
        if (asset.size && asset.size > MAX_SIZE) {
          Alert.alert('Fehler', `Datei "${asset.name || asset.fileName}" ist zu groß (Max 100MB).`);
          continue;
        }

        const formData = new FormData();
        formData.append('path', currentPath);
        formData.append('files', {
          uri: asset.uri,
          name: asset.name || asset.fileName || `upload_${Date.now()}.jpg`,
          type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg')
        } as any);

        console.log(`[UPLOAD] Starting for: ${asset.name || asset.fileName}`);
        
        try {
          await uploadProjectFiles(id, formData);
        } catch (err: any) {
          console.error('[UPLOAD ERROR]', err);
          const serverError = err.response?.data?.error || err.message || 'Upload fehlgeschlagen';
          Alert.alert('Upload-Fehler', `Datei "${asset.name || asset.fileName}" konnte nicht hochgeladen werden:\n\n${serverError}`);
          // We continue with other files even if one fails
        }
      }
      
      // Refresh list once at the end
      queryClient.invalidateQueries({ queryKey: ['project-files', id, currentPath] });
    } finally {
      setIsBatchUploading(false);
    }
  };

  const handleFileUpload = async () => {
    Alert.alert(
      'Dateien hochladen',
      'Wählen Sie eine Quelle',
      [
        {
          text: 'Kamera', onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
            if (!result.canceled) executeFileUpload(result.assets);
          }
        },
        {
          text: 'Galerie', onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, allowsMultipleSelection: true });
            if (!result.canceled) executeFileUpload(result.assets);
          }
        },
        {
          text: 'Dateien', onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({ multiple: true, type: '*/*' });
              if (!result.canceled) executeFileUpload(result.assets);
            } catch (error) {
              Alert.alert('Fehler', 'Dateien konnten nicht ausgewählt werden.');
            }
          }
        },
        { text: 'Abbrechen', style: 'cancel' }
      ]
    );
  };


  const handleOpenEditModal = () => {
    const p = projectRes?.data?.project || projectRes;
    if (!p) return;

    setIsCustomClientEnabled(!!(p.client_first_name || p.client_last_name));
    setEditFormData({
      title: p.title || '',
      description: p.description || '',
      address: p.address || '',
      status: p.status || 'Aktiv',
      progress: p.progress || 0,
      start_date: p.start_date ? p.start_date.split('T')[0] : '',
      end_date: p.end_date ? p.end_date.split('T')[0] : '',
      category_id: p.category_id || '',
      subcategory_id: p.subcategory_id || '',
      budget: p.budget?.toString() || '',
      client_first_name: p.client_first_name || '',
      client_last_name: p.client_last_name || '',
      client_phone: p.client_phone || '',
      client_email: p.client_email || '',
      client_address: p.client_address || '',
      client_notes: p.client_notes || ''
    });
    setAssignedUsers(p.assigned_personnel?.map((ap: any) => ({ user_id: ap.user_id, role: ap.role })) || []);
    setAssignedSubcontractors(p.assigned_subcontractors?.map((as: any) => as.subcontractor_id) || []);

    let parsedCats = [];
    if (p.categories_json) {
      try {
        parsedCats = typeof p.categories_json === 'string' ? JSON.parse(p.categories_json) : p.categories_json;
      } catch (err) {
        console.error('Error parsing categories_json:', err);
      }
    }
    if (!parsedCats || parsedCats.length === 0) {
      if (p.category_id) {
        parsedCats = [{
          category_id: parseInt(p.category_id),
          subcategory_id: p.subcategory_id ? parseInt(p.subcategory_id) : null
        }];
      }
    }
    setSelectedCategories(parsedCats || []);

    setIsEditModalOpen(true);
  };

  const handleTogglePersonnel = (userId: number, role: string) => {
    setAssignedUsers(prev => {
      const exists = prev.find(au => au.user_id === userId && au.role === role);
      if (exists) {
        return prev.filter(au => !(au.user_id === userId && au.role === role));
      } else {
        // For PL and GL, we might want to limit to one or just allow multiple as per DB
        return [...prev, { user_id: userId, role }];
      }
    });
  };

  const handleSaveProjectEdit = () => {
    if (!editFormData.title.trim()) {
      Alert.alert('Fehler', 'Bite geben Sie einen Titel ein.');
      return;
    }

    const finalClientData = isCustomClientEnabled ? {
      client_first_name: editFormData.client_first_name,
      client_last_name: editFormData.client_last_name,
      client_phone: editFormData.client_phone,
      client_email: editFormData.client_email,
      client_address: editFormData.client_address,
      client_notes: editFormData.client_notes
    } : {
      client_first_name: '',
      client_last_name: '',
      client_phone: '',
      client_email: '',
      client_address: '',
      client_notes: ''
    };

    const firstCat = selectedCategories[0] || null;
    const legacyCategoryData = {
      category_id: firstCat ? firstCat.category_id : '',
      subcategory_id: firstCat ? (firstCat.subcategory_id || '') : '',
      categories_json: JSON.stringify(selectedCategories)
    };

    updateProjectMutation.mutate({
      ...editFormData,
      ...finalClientData,
      ...legacyCategoryData,
      assigned_users: assignedUsers,
      assigned_subcontractors: assignedSubcontractors
    });
  };

  const canEditProject = typeof user?.role === 'string'
    ? ['Admin', 'Büro', 'Projektleiter'].includes(user.role)
    : ['Admin', 'Büro', 'Projektleiter'].includes((user?.role as any)?.name || '');

  const confirmDeleteFile = (item: any) => {
    Alert.alert(
      'Löschen bestätigen',
      `Möchten Sie "${item.name}" wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => deleteFileMutation.mutate(currentPath ? `${currentPath}/${item.name}` : item.name)
        }
      ]
    );
  };

  const handleSaveStage = () => {
    if (!stageTitle.trim() || isSavingStage) return;
    setIsSavingStage(true);
    if (editingStage) {
      updateStageDetailsMutation.mutate({
        stageId: editingStage.id,
        data: { title: stageTitle, description: stageDescription }
      }, {
        onSettled: () => setIsSavingStage(false)
      });
    } else {
      createStageMutation.mutate({ title: stageTitle, description: stageDescription }, {
        onSettled: () => setIsSavingStage(false)
      });
    }
  };

  const confirmDeleteStage = (stageId: number) => {
    Alert.alert(
      'Etappe löschen',
      'Möchten Sie diese Etappe wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: () => deleteStageMutation.mutate(stageId) }
      ]
    );
  };

  const resetDiaryForm = () => {
    setDiaryTitle('');
    setDiaryContent('');
    setDiaryColor(COLORS[0]);
    setDiaryDate(getISODate());
    setDiaryAttachments([]);
  };

  const handlePickDiaryMedia = () => {
    Alert.alert(
      'Dateien auswählen',
      'Wählen Sie eine Quelle',
      [
        {
          text: 'Kamera', onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
            if (!result.canceled) setDiaryAttachments(prev => [...prev, ...result.assets]);
          }
        },
        {
          text: 'Galerie', onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, allowsMultipleSelection: true });
            if (!result.canceled) setDiaryAttachments(prev => [...prev, ...result.assets]);
          }
        },
        { text: 'Abbrechen', style: 'cancel' }
      ]
    );
  };

  const removeDiaryAttachment = (index: number) => {
    setDiaryAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveDiaryLog = () => {
    if (!diaryTitle.trim() || !diaryContent.trim() || isSavingDiary) return;
    setIsSavingDiary(true);

    const formData = new FormData();
    formData.append('title', diaryTitle);
    formData.append('content', diaryContent);
    formData.append('color', diaryColor);
    formData.append('date', diaryDate);
    if (diaryTime) formData.append('time', diaryTime);
    formData.append('project_id', String(id));
    formData.append('showInDiary', 'true');

    diaryAttachments.forEach((file: any, index) => {
      formData.append('files', {
        uri: file.uri,
        name: file.fileName || `media_${index}.jpg`,
        type: file.mimeType || (file.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      } as any);
    });

    createDiaryLogMutation.mutate(formData, {
      onSettled: () => setIsSavingDiary(false)
    });
  };

  const confirmDeleteDiaryLog = (logId: number) => {
    Alert.alert(
      'Eintrag löschen',
      'Möchten Sie diesen Bautagebucheintrag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: () => deleteDiaryLogMutation.mutate(logId) }
      ]
    );
  };

  const renderDiaryTab = () => (
    <View className="space-y-4 pb-20">
      <View className="flex-row justify-between items-center mb-2 px-1">
        <Text className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Bautagebuch</Text>
        <TouchableOpacity
          onPress={() => {
            resetDiaryForm();
            setIsDiaryModalOpen(true);
          }}
          className="bg-brand-blue/20 px-3 py-1.5 rounded-lg border border-brand-blue/30 flex-row items-center"
        >
          <Plus size={12} color="#3B82F6" className="mr-1.5" />
          <Text className="text-brand-blue text-[10px] font-bold uppercase">Neuer Eintrag</Text>
        </TouchableOpacity>
      </View>

      {diaryLoading ? (
        <ActivityIndicator color="#3B82F6" className="my-10" />
      ) : diaryLogs.length > 0 ? (
        diaryLogs.map((log: any) => (
          <GlassCard key={log.id} className="p-5 mb-4 border-l-4" style={{ borderLeftColor: log.color || '#3B82F6' }}>
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1">
                <Text selectable={true} className="text-white font-bold text-base mb-1">{log.title}</Text>
                <View className="flex-row items-center">
                  <Calendar size={10} color="#6B7280" />
                  <Text className="text-gray-500 text-[10px] ml-1.5 font-bold">{formatDate(log.date)}</Text>
                  {log.time && (
                    <View className="flex-row items-center ml-3">
                      <Clock size={10} color="#6B7280" />
                      <Text className="text-gray-400 text-[10px] ml-1 font-bold">{log.time}</Text>
                    </View>
                  )}
                  {log.user && (
                    <View className="flex-row items-center ml-3">
                      <User size={10} color="#6B7280" />
                      <Text className="text-gray-400 text-[10px] ml-1 font-bold">{log.user.name}</Text>
                    </View>
                  )}
                </View>
              </View>
              {log.user_id === user?.id && (
                <TouchableOpacity onPress={() => confirmDeleteDiaryLog(log.id)} className="p-2 bg-white/5 rounded-lg">
                  <Trash2 size={14} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
            <Text selectable={true} className="text-gray-300 text-sm leading-relaxed mb-4">{log.content}</Text>
            
            {log.attachments && log.attachments.length > 0 && (
              <View className="mt-2">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  {log.attachments.map((att: any, i: number) => {
                    const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.file_url || att.fileUrl || '');
                    return (
                      <TouchableOpacity
                        key={att.id}
                        onPress={() => {
                          if (isImg) {
                            handleOpenViewer(log.attachments.map((a: any) => a.file_url || a.fileUrl), i);
                          } else {
                            Linking.openURL(getFullUrl(att.file_url || att.fileUrl)).catch(() => {
                              Alert.alert('Fehler', 'Datei konnte nicht geöffnet werden');
                            });
                          }
                        }}
                        className="mr-3 border border-white/5 rounded-lg p-2 flex-row items-center bg-black/20"
                      >
                        <ImageIcon size={14} color="#6B7280" />
                        <Text className="text-gray-300 text-xs font-bold ml-2 w-24" numberOfLines={1}>
                          {att.file_name || 'Anhang'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </GlassCard>
        ))
      ) : (
        <GlassCard className="p-10 items-center">
          <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest text-center">Keine Bautagebucheinträge vorhanden</Text>
        </GlassCard>
      )}
    </View>
  );

  const TabButton = ({ label, id, icon: Icon }: any) => (
    <TouchableOpacity
      onPress={() => setActiveTab(id)}
      className={`px-4 py-3 flex-row items-center border-b-2 ${activeTab === id ? 'border-brand-blue' : 'border-transparent'}`}
    >
      {Icon && <Icon size={14} color={activeTab === id ? '#3B82F6' : '#6B7280'} className="mr-2" />}
      <Text className={`text-xs font-bold uppercase tracking-wider ${activeTab === id ? 'text-white' : 'text-gray-500'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // 4. Content Render functions (not components to avoid re-mounting)
  const renderInfoTab = () => {
    const budget = parseFloat(project?.budget || 0);
    const estimatedCosts = project?.estimated_costs !== undefined && project?.estimated_costs !== null
      ? parseFloat(project.estimated_costs)
      : budget * 0.65;
    const profitMargin = budget - estimatedCosts;

    const costPercent = budget > 0 ? Math.round((estimatedCosts / budget) * 100) : 65;
    const marginPercent = budget > 0 ? Math.round((profitMargin / budget) * 100) : 35;

    const formatCurrency = (val: number) => {
      return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    };

    return (
      <View className="space-y-6 pb-20">
        {/* Progress Section */}
        <GlassCard className="p-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Fortschritt</Text>
            <Text className="text-white font-black text-xl">{progress}%</Text>
          </View>
          <View className="w-full h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <LinearGradient
              colors={['#3B82F6', '#60A5FA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: `${progress}%`, height: '100%', borderRadius: 6 }}
            />
          </View>
        </GlassCard>

        {/* Financial Widget */}
        {!isRestricted && (
          <GlassCard className="p-5">
            <View className="flex-row items-center mb-4 pb-3 border-b border-white/5">
              <PieChart size={16} color="#3B82F6" className="mr-2" />
              <Text className="text-white font-bold text-sm">Finanzübersicht & Marge</Text>
            </View>
            <View className="space-y-4">
              <View className="flex-row justify-between items-center">
                <Text className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Gesamtbudget</Text>
                <Text className="text-white font-black text-base">{formatCurrency(budget)}</Text>
              </View>
              <View className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-[2px] flex flex-row">
                <View style={{ width: `${costPercent}%` }} className="h-full bg-amber-500 rounded-full" />
                <View style={{ width: `${marginPercent}%` }} className="h-full bg-emerald-500 rounded-full" />
              </View>

              <View className="flex-row justify-between mt-2">
                <View className="bg-white/5 p-4 rounded-xl border border-white/5 w-[48%]">
                  <Text className="text-gray-500 text-[9px] font-bold uppercase tracking-wider mb-1">Kosten ({costPercent}%)</Text>
                  <Text className="text-amber-400 font-black text-sm">{formatCurrency(estimatedCosts)}</Text>
                </View>
                <View className={`p-4 rounded-xl border w-[48%] ${profitMargin >= 0 ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                  <Text className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${profitMargin >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>Marge ({marginPercent}%)</Text>
                  <Text className={`font-black text-sm ${profitMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(profitMargin)}</Text>
                </View>
              </View>
            </View>
          </GlassCard>
        )}

        {/* Weather Forecast Widget */}
        {weatherForecast && weatherForecast.length > 0 ? (
          <GlassCard className="p-5">
            <View className="flex-row items-center mb-4 pb-3 border-b border-white/5">
              <Sun size={16} color="#F59E0B" className="mr-2" />
              <Text className="text-white font-bold text-sm">3-Tage-Wettervorhersage</Text>
            </View>
            <View className="flex-row justify-between">
              {weatherForecast.map((day, index) => (
                <View key={index} className="bg-white/5 p-3 rounded-xl border border-white/5 items-center w-[30%]">
                  <Text className="text-gray-400 text-[9px] font-bold uppercase mb-2">{day.date}</Text>
                  {getWeatherIcon(day.code, 20)}
                  <Text className="text-white text-xs font-black mt-2">{day.tempMax}°C</Text>
                  <Text className="text-gray-500 text-[9px] font-bold mt-0.5">{day.tempMin}°C</Text>
                  <Text className="text-gray-400 text-[8px] font-bold mt-1 text-center" numberOfLines={1}>
                    {getWeatherDesc(day.code)}
                  </Text>
                </View>
              ))}
            </View>
          </GlassCard>
        ) : null}

        {/* Description */}
        <View>
          <Text className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-3 ml-1">Beschreibung</Text>
          <GlassCard className="p-5">
            <Text className="text-gray-300 text-sm leading-relaxed">
              {project?.description || 'Keine Beschreibung hinterlegt.'}
            </Text>
          </GlassCard>
        </View>

        {/* Details Grid */}
        <View>
          <View className="flex-row flex-wrap justify-between">
            <GlassCard className="w-full p-4 mb-4">
              <View className="flex-row items-center mb-2">
                <MapPin size={12} color="#3B82F6" />
                <Text className="text-gray-500 font-bold uppercase tracking-widest text-[9px] ml-1.5">Standort</Text>
              </View>
              <Text selectable={true} className="text-white text-xs font-bold">{project?.address || 'N/A'}</Text>
            </GlassCard>

            <GlassCard className="w-[48%] p-4 mb-4">
              <View className="flex-row items-center mb-2">
                <Calendar size={12} color="#3B82F6" />
                <Text className="text-gray-500 font-bold uppercase tracking-widest text-[9px] ml-1.5">Startdatum</Text>
              </View>
              <Text className="text-white text-xs font-bold">
                {project?.start_date ? new Date(project.start_date).toLocaleDateString('de-DE') : 'N/A'}
              </Text>
            </GlassCard>

            <GlassCard className="w-[48%] p-4 mb-4">
              <View className="flex-row items-center mb-2">
                <Calendar size={12} color="#10B981" />
                <Text className="text-gray-500 font-bold uppercase tracking-widest text-[9px] ml-1.5">Enddatum</Text>
              </View>
              <Text className="text-white text-xs font-bold">
                {project?.end_date ? new Date(project.end_date).toLocaleDateString('de-DE') : 'N/A'}
              </Text>
            </GlassCard>
          </View>

          {calculatingRoute && (
            <View className="flex-row items-center justify-center p-3 bg-white/5 border border-white/10 rounded-xl mb-4">
              <ActivityIndicator size="small" color="#3B82F6" className="mr-2.5" />
              <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest">Berechne Anfahrtsweg...</Text>
            </View>
          )}

          {routeInfo && (
            <View className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex-row items-center mb-4">
              <View className="w-8 h-8 rounded-lg bg-blue-500/20 items-center justify-center mr-3">
                <Car size={16} color="#3B82F6" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-white text-xs">{routeInfo.distance} km Anfahrtsweg</Text>
                <Text className="text-[9px] text-gray-400">ca. {routeInfo.duration} Min. Fahrtzeit vom Firmensitz</Text>
              </View>
            </View>
          )}

          {project?.address ? (
            <View className="w-full h-48 rounded-2xl overflow-hidden border border-white/10 mb-4 bg-black/20">
              <WebView
                originWhitelist={['*']}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                source={{
                  html: `
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                        <style>
                          html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
                          iframe { border: 0; width: 100%; height: 100%; }
                        </style>
                      </head>
                      <body>
                        <iframe
                          src="https://maps.google.com/maps?q=${encodeURIComponent(project.address)}&t=&z=14&ie=UTF8&iwloc=&output=embed"
                          allowfullscreen
                        ></iframe>
                      </body>
                    </html>
                  `
                }}
                style={{ flex: 1, backgroundColor: 'transparent', opacity: 0.8 }}
              />
            </View>
          ) : null}
        </View>

        {/* Client Information */}
        <View>
          <Text className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-3 ml-1">Kundeninformationen</Text>
          <GlassCard className="p-5">
            <View className="flex-row items-center mb-4">
              <View className="w-10 h-10 rounded-xl bg-blue-500/20 items-center justify-center border border-blue-500/30">
                <Building size={20} color="#3B82F6" />
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-white font-bold text-base">{project?.client?.company_name || project?.client?.name || 'Unbekannter Kunde'}</Text>
                <Text className="text-gray-500 text-xs">{project?.client?.industry || 'Kunde'}</Text>
              </View>
            </View>

            {(project?.client?.phone || project?.client?.email) && (
              <View className="pt-3 border-t border-white/5 space-y-2">
                {project.client.phone && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${project.client.phone}`)}
                    className="flex-row items-center"
                  >
                    <Phone size={12} color="#3B82F6" className="mr-2" />
                    <Text className="text-blue-400 text-xs font-medium">{project.client.phone}</Text>
                  </TouchableOpacity>
                )}
                {project.client.email && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Main', { screen: 'E-Mail', params: { initialRecipient: project.client.email, initialSubject: `Projekt: ${project.title}` } })}
                    className="flex-row items-center"
                  >
                    <Mail size={12} color="#3B82F6" className="mr-2" />
                    <Text className="text-blue-400 text-xs font-medium">{project.client.email}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </GlassCard>
        </View>

        {/* Project Specific Ansprechpartner */}
        {(project?.client_first_name || project?.client_last_name) && (
          <View>
            <Text className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-3 ml-1">Ansprechpartner / Endkunde</Text>
            <GlassCard className="p-5 border-emerald-500/10">
              <View className="flex-row items-center mb-4">
                <View className="w-10 h-10 rounded-xl bg-emerald-500/20 items-center justify-center border border-emerald-500/30">
                  <User size={20} color="#10B981" />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-white font-bold text-base">
                    {project.client_first_name || ''} {project.client_last_name || ''}
                  </Text>
                  <Text className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Projekt-Ansprechpartner</Text>
                </View>
              </View>

              {(project.client_phone || project.client_email || project.client_address) && (
                <View className="pt-3 border-t border-white/5 space-y-2.5">
                  {project.client_phone && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${project.client_phone}`)}
                      className="flex-row items-center"
                    >
                      <Phone size={12} color="#10B981" className="mr-2.5" />
                      <Text className="text-emerald-400 text-xs font-semibold">{project.client_phone}</Text>
                    </TouchableOpacity>
                  )}
                  {project.client_email && (
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Main', { screen: 'E-Mail', params: { initialRecipient: project.client_email, initialSubject: `Projekt: ${project.title}` } })}
                      className="flex-row items-center"
                    >
                      <Mail size={12} color="#10B981" className="mr-2.5" />
                      <Text className="text-emerald-400 text-xs font-semibold">{project.client_email}</Text>
                    </TouchableOpacity>
                  )}
                  {project.client_address && (
                    <View className="flex-row items-center">
                      <MapPin size={12} color="#6B7280" className="mr-2.5" />
                      <Text className="text-gray-300 text-xs">{project.client_address}</Text>
                    </View>
                  )}
                </View>
              )}
            </GlassCard>
          </View>
        )}

        {/* Project Notes (Internal) */}
        {project?.client_notes && (
          <View>
            <Text className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-3 ml-1">Interne Projekt-Notizen</Text>
            <GlassCard className="p-5 border-emerald-500/10 bg-emerald-500/5">
              <Text className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">
                {project.client_notes}
              </Text>
            </GlassCard>
          </View>
        )}

        {/* Classification & Category */}
        {((project?.categories_list && project.categories_list.length > 0) || project?.category || project?.subcategory) && (
          <View>
            <Text className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-3 ml-1">Klassifizierung</Text>
            <GlassCard className="p-5">
              {project.categories_list && project.categories_list.length > 0 ? (
                <View className="flex-row flex-wrap">
                  {project.categories_list.map((catItem: any, idx: number) => (
                    <View 
                      key={idx} 
                      className="bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-xl flex-row items-center mr-2 mb-2"
                    >
                      <Target size={12} color="#3B82F6" className="mr-1.5" />
                      <Text className="text-white text-xs font-bold">
                        {catItem.category?.name || 'Kategorie'}
                        {catItem.subcategory?.name ? ` : ${catItem.subcategory.name}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View className="flex-row">
                  {project?.category && (
                    <View className="flex-1 border-r border-white/5 pr-4">
                      <Text className="text-gray-500 text-[9px] uppercase font-bold mb-1">Kategorie</Text>
                      <View className="flex-row items-center">
                        <View className="w-6 h-6 rounded bg-blue-500/10 items-center justify-center mr-2">
                          <Target size={12} color="#3B82F6" />
                        </View>
                        <Text className="text-white text-xs font-bold" numberOfLines={1}>{project.category.name}</Text>
                      </View>
                    </View>
                  )}
                  {project?.subcategory && (
                    <View className="flex-1 pl-4">
                      <Text className="text-gray-500 text-[9px] uppercase font-bold mb-1">Unterkategorie</Text>
                      <View className="flex-row items-center">
                        <View className="w-6 h-6 rounded bg-purple-500/10 items-center justify-center mr-2">
                          <BriefcaseIcon size={12} color="#A855F7" />
                        </View>
                        <Text className="text-white text-xs font-bold" numberOfLines={1}>{project.subcategory.name}</Text>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </GlassCard>
          </View>
        )}

        {/* Answers Section */}
        {project?.answers?.length > 0 && (
          <View>
            <Text className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-3 ml-1">Zusatzinformationen</Text>
            <View className="space-y-3">
              {project.answers.map((ans: any) => (
                <GlassCard key={ans.id} className="p-4 bg-black/30 border-white/5">
                  <Text className="text-gray-500 text-[9px] font-bold uppercase mb-1">{ans.question?.question_text || 'Info'}</Text>
                  <Text className="text-white text-xs font-bold">
                    {ans.custom_value || ans.answer?.answer_text || '-'}
                  </Text>
                </GlassCard>
              ))}
            </View>
          </View>
        )}

        {/* Team Section */}
        {project?.assigned_personnel?.length > 0 && (
          <View>
            <Text className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-3 ml-1">Team</Text>
            <GlassCard className="p-5">
              <View className="space-y-4">
                {project.assigned_personnel.map((ap: any, idx: number) => (
                  <View key={idx} className="flex-row items-center justify-between mb-4 last:mb-0">
                    <View className="flex-row items-center flex-1">
                      <View className="w-8 h-8 rounded-full bg-blue-500/20 items-center justify-center border border-blue-500/30">
                        <Text className="text-blue-400 text-[10px] font-bold">
                          {ap.user?.name?.split(' ').map((n: any) => n[0]).join('').toUpperCase()}
                        </Text>
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-white text-sm font-bold" numberOfLines={1}>{ap.user?.name}</Text>
                        <Text className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">{ap.role}</Text>
                      </View>
                    </View>
                    <ChevronRight size={14} color="#4B5563" />
                  </View>
                ))}
              </View>
            </GlassCard>
          </View>
        )}

        {/* Subcontractors Section */}
        {project?.assigned_subcontractors?.length > 0 && (
          <View>
            <Text className="text-amber-400 font-bold uppercase tracking-widest text-[10px] mb-3 ml-1">Nachunternehmer</Text>
            <View className="space-y-3">
              {project.assigned_subcontractors.map((as: any) => (
                <GlassCard key={as.id} className="p-4 border-amber-500/10">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-1">
                      <Text className="text-white font-bold text-sm">{as.subcontractor?.name}</Text>
                      <Text className="text-gray-500 text-[9px] uppercase font-bold tracking-wider mt-0.5">{as.subcontractor?.trade}</Text>
                    </View>
                    <View className="w-8 h-8 rounded-lg bg-amber-500/10 items-center justify-center border border-amber-500/20">
                      <HardHat size={16} color="#F59E0B" />
                    </View>
                  </View>

                  {(as.subcontractor?.contact_person || as.subcontractor?.phone || as.subcontractor?.email) && (
                    <View className="pt-3 border-t border-white/5 space-y-2">
                      {as.subcontractor.contact_person && (
                        <View className="flex-row items-center">
                          <User size={12} color="#6B7280" className="mr-2" />
                          <Text className="text-gray-300 text-xs">{as.subcontractor.contact_person}</Text>
                        </View>
                      )}
                      {as.subcontractor.phone && (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(`tel:${as.subcontractor.phone}`)}
                          className="flex-row items-center"
                        >
                          <Phone size={12} color="#3B82F6" className="mr-2" />
                          <Text className="text-blue-400 text-xs font-medium">{as.subcontractor.phone}</Text>
                        </TouchableOpacity>
                      )}
                      {as.subcontractor.email && (
                        <TouchableOpacity
                          onPress={() => navigation.navigate('Main', { screen: 'E-Mail', params: { initialRecipient: as.subcontractor.email, initialSubject: `Projekt: ${project.title}` } })}
                          className="flex-row items-center"
                        >
                          <Mail size={12} color="#3B82F6" className="mr-2" />
                          <Text className="text-blue-400 text-xs font-medium">{as.subcontractor.email}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </GlassCard>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderStepsTab = () => (
    <View className="space-y-4 pb-20">
      <View className="flex-row justify-between items-center mb-2 px-1">
        <Text className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Etappen list</Text>
        <TouchableOpacity
          onPress={() => handleOpenStageModal()}
          className="bg-brand-blue/20 px-3 py-1.5 rounded-lg border border-brand-blue/30 flex-row items-center"
        >
          <Plus size={12} color="#3B82F6" className="mr-1.5" />
          <Text className="text-brand-blue text-[10px] font-bold uppercase">Hinzufügen</Text>
        </TouchableOpacity>
      </View>

      {stagesLoading ? (
        <ActivityIndicator color="#3B82F6" className="my-10" />
      ) : stages.length > 0 ? (
        stages.map((stage: any, idx: number) => (
          <GlassCard key={stage.id} className={`p-5 flex-row items-center border ${stage.status === 'Erledigt' ? 'border-emerald-500/30' : 'border-white/10'}`}>
            <TouchableOpacity
              onPress={() => updateStageMutation.mutate({
                stageId: stage.id,
                status: stage.status === 'Erledigt' ? 'In Arbeit' : 'Erledigt'
              })}
              className={`w-6 h-6 rounded-lg items-center justify-center border ${stage.status === 'Erledigt' ? 'bg-emerald-500 border-emerald-500' : 'bg-black/40 border-white/10'
                }`}
            >
              {stage.status === 'Erledigt' && <CheckSquare size={14} color="white" />}
            </TouchableOpacity>

            <TouchableOpacity
              className="ml-4 flex-1"
              onPress={() => handleOpenStageModal(stage)}
            >
              <Text className={`text-white font-bold text-sm ${stage.status === 'Erledigt' ? 'line-through text-gray-500' : ''}`}>
                {stage.title}
              </Text>
              {stage.description && (
                <Text className="text-gray-500 text-[10px] mt-1" numberOfLines={1}>{stage.description}</Text>
              )}
            </TouchableOpacity>

            {/* Stage Image Preview */}
            {stage.images && stage.images.length > 0 && (
              <TouchableOpacity
                onPress={() => handleOpenViewer(stage.images, 0)}
                className="ml-4 relative"
              >
                <View className="w-12 h-12 rounded-lg border border-white/10 bg-white/5 justify-center items-center">
                  <ImageIcon size={20} color="#6B7280" />
                </View>
                {stage.images.length > 1 && (
                  <View className="absolute -bottom-1 -right-1 bg-brand-blue w-5 h-5 rounded-full items-center justify-center border border-black">
                    <Text className="text-white text-[8px] font-bold">+{stage.images.length - 1}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => confirmDeleteStage(stage.id)} className="p-1 ml-3">
              <Trash2 size={14} color="#EF4444" />
            </TouchableOpacity>
          </GlassCard>
        ))
      ) : (
        <GlassCard className="p-10 items-center">
          <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest text-center">Keine Etappen vorhanden</Text>
        </GlassCard>
      )}
    </View>
  );

  const renderFilesTab = () => (
    <View className="space-y-4 pb-20">
      <View className="flex-row justify-between items-center mb-2 px-1">
        <View className="flex-1 mr-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center', flexDirection: 'row' }}
          >
            <TouchableOpacity onPress={() => setCurrentPath('')}>
              <Text className={`text-[10px] font-bold uppercase tracking-widest ${!currentPath ? 'text-brand-blue' : 'text-gray-500'}`}>Projekte</Text>
            </TouchableOpacity>
            {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
              <View key={i} className="flex-row items-center">
                <ChevronRight size={10} color="#4B5563" className="mx-1" />
                <TouchableOpacity onPress={() => setCurrentPath(arr.slice(0, i + 1).join('/'))}>
                  <Text className={`text-[10px] font-bold uppercase tracking-widest ${i === arr.length - 1 ? 'text-brand-blue' : 'text-gray-500'}`}>{part}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>

        <View className="flex-row">
          <TouchableOpacity
            onPress={() => setIsNewFolderModalOpen(true)}
            className="bg-white/5 w-8 h-8 rounded-lg items-center justify-center border border-white/10 mr-2"
          >
            <FolderPlus size={14} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleFileUpload}
            className="bg-brand-blue w-8 h-8 rounded-lg items-center justify-center border border-brand-blue shadow-lg shadow-blue-500/20"
          >
            <UploadCloud size={14} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {isBatchUploading && (
        <GlassCard className="p-4 border-blue-500/30 bg-blue-500/5 mb-4 flex-row items-center">
          <ActivityIndicator color="#3B82F6" size="small" className="mr-3" />
          <Text className="text-blue-400 font-bold text-[10px] uppercase tracking-widest flex-1">
            Dateien werden hochgeladen... Bitte warten
          </Text>
        </GlassCard>
      )}

      {filesLoading ? (
        <ActivityIndicator color="#3B82F6" className="my-10" />
      ) : files.length > 0 ? (
        <View className="space-y-3">
          {files.map((file: any, idx: number) => (
            <GlassCard key={idx} className="p-4 border-white/5 bg-black/20">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleFileOpen(file)}
                className="flex-row items-center justify-between"
              >
                <View className="flex-row items-center flex-1">
                  <View className={`w-10 h-10 rounded-xl items-center justify-center mr-4 ${file.isDirectory ? 'bg-blue-500/10' : 'bg-gray-500/10'}`}>
                    {file.isDirectory ? (
                      <Folder size={20} color="#3B82F6" />
                    ) : (
                      <File size={20} color="#9CA3AF" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-bold text-xs" numberOfLines={1}>{file.name}</Text>
                    {!file.isDirectory && (
                      <Text className="text-gray-500 text-[9px] mt-0.5">
                        {(file.size / 1024).toFixed(1)} KB • {new Date(file.createdAt).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>

                <View className="flex-row items-center">
                  {file.isDirectory && canManagePermissions && (
                    <TouchableOpacity
                      onPress={() => handleOpenPermissions(file)}
                      className="mr-3 p-2 bg-white/5 rounded-lg border border-white/10"
                    >
                      <ShieldCheck size={16} color={(file.permissions && (file.permissions.allowed_role_ids !== null || file.permissions.is_public)) ? "#3B82F6" : "#4B5563"} />
                    </TouchableOpacity>
                  )}
                  {!file.isDirectory && (
                    <TouchableOpacity onPress={() => handleFileOpen(file)} className="p-2 mr-1">
                      <Download size={14} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                  {(() => {
                    const isSpecialFolder = currentPath === '' && file.name === 'stages';
                    let canDelete = false;
                    if (isManagement) {
                      canDelete = !isSpecialFolder;
                    } else {
                      canDelete = !file.isDirectory && file.created_by_id === user?.id;
                    }
                    if (!canDelete) return null;

                    return (
                      <TouchableOpacity onPress={() => confirmDeleteFile(file)} className="p-2">
                        <Trash2 size={14} color="#EF4444" />
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              </TouchableOpacity>
            </GlassCard>
          ))}
        </View>
      ) : (
        <GlassCard className="p-10 items-center">
          <AlertCircle size={32} color="#1F2937" className="mb-3" />
          <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest text-center">Dieser Ordner ist leer</Text>
        </GlassCard>
      )}
    </View>
  );

  return (
    <ScreenLayout padding={false}>
      <View className="h-64 relative">
        <ImageBackground
          source={project?.main_image ? { uri: getFullUrl(project.main_image) } : undefined}
          className="w-full h-full bg-black/40"
          resizeMode="cover"
        >
          <LinearGradient
            colors={['transparent', '#0a0a0c']}
            className="absolute inset-0"
          />
          <View className="absolute top-12 left-6 right-6 flex-row justify-between items-center">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-10 h-10 rounded-full bg-black/40 items-center justify-center border border-white/20"
            >
              <ChevronLeft size={24} color="white" />
            </TouchableOpacity>

            <View className="flex-row items-center">
              {canEditProject && (
                <TouchableOpacity
                  onPress={handleOpenEditModal}
                  className="w-10 h-10 rounded-full bg-black/40 items-center justify-center border border-white/20 mr-2"
                >
                  <FileText size={18} color="#3B82F6" />
                </TouchableOpacity>
              )}
              <View className="bg-black/60 px-3 py-1.5 rounded-xl border border-white/20 blur-md">
                <Text className="text-white font-bold text-[10px] tracking-widest uppercase">{project?.project_number}</Text>
              </View>
            </View>
          </View>

          <View className="absolute bottom-6 left-6 right-6">
            <View className="bg-emerald-500/20 px-2 py-1 rounded-lg border border-emerald-500/30 self-start mb-2">
              <Text className="text-emerald-400 text-[10px] font-bold uppercase">{project?.status || 'Aktiv'}</Text>
            </View>
            <Text className="text-white font-black text-3xl tracking-tighter" numberOfLines={2}>
              {project?.title}
            </Text>
            <View className="flex-row items-center mt-2 opacity-60">
              <MapPin size={12} color="white" />
              <Text className="text-white text-xs ml-1.5">{project?.address}</Text>
            </View>
          </View>
        </ImageBackground>
      </View>

      {/* Tabs */}
      <View className="border-b border-white/5 mb-6">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 4 }}
          className="flex-row"
        >
          <TabButton label="Info" id="info" icon={Briefcase} />
          <TabButton label="Bautagebuch" id="diary" icon={Clock} />
          <TabButton label="Steps" id="steps" icon={CheckSquare} />
          <TabButton label="Files" id="files" icon={FileText} />
        </ScrollView>
      </View>

      {/* Content */}
      <View className="px-6">
        {activeTab === 'info' && renderInfoTab()}
        {activeTab === 'diary' && renderDiaryTab()}
        {activeTab === 'steps' && renderStepsTab()}
        {activeTab === 'files' && renderFilesTab()}
      </View>

      {/* Stage Modal (Add/Edit) */}
      <Modal
        visible={isStageModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsStageModalOpen(false)}
      >
        <BlurView intensity={80} tint="dark" className="flex-1 justify-end">
          <TouchableOpacity
            activeOpacity={1}
            onPress={Keyboard.dismiss}
            className="flex-1"
          />
          <GlassCard className="p-6 rounded-t-[40px] border-t border-white/10 bg-black/60 rounded-b-none" style={{ height: '85%' }}>
            <View {...modalPanResponder.panHandlers} className="w-full pb-6 items-center">
              <View className="w-12 h-1.5 bg-white/10 rounded-full" />
            </View>

            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold uppercase tracking-widest">
                {editingStage ? 'Etappe bearbeiten' : 'Neue Etappe'}
              </Text>
              <TouchableOpacity onPress={() => setIsStageModalOpen(false)}>
                <Text className="text-gray-500 font-bold uppercase text-xs tracking-widest">Abbrechen</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              {/* Title Input */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Titel</Text>
                <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                  <TextInput
                    value={stageTitle}
                    onChangeText={setStageTitle}
                    placeholder="z.B. Fundament gießen"
                    placeholderTextColor="#4B5563"
                    className="p-4 text-white font-bold"
                  />
                </GlassCard>
              </View>

              {/* Description Input */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Beschreibung (Optional)</Text>
                <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                  <TextInput
                    value={stageDescription}
                    onChangeText={setStageDescription}
                    placeholder="Details к этапу..."
                    placeholderTextColor="#4B5563"
                    className="p-4 text-white text-sm"
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />
                </GlassCard>
              </View>

              {/* Media Upload Section */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Anhänge (Bilder, Videos)</Text>
                <TouchableOpacity onPress={handlePickMedia} activeOpacity={0.8} className="mb-4">
                  <GlassCard className="p-6 bg-black/40 border border-dashed border-white/20 items-center justify-center">
                    <UploadCloud size={32} color="#6B7280" className="mb-2" />
                    <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest">Dateien auswählen</Text>
                  </GlassCard>
                </TouchableOpacity>

                {(existingImages.length > 0 || attachments.length > 0) && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ flexDirection: 'row' }}
                  >
                    {/* Existing Images */}
                    {existingImages.map((img, i) => (
                      <View key={`existing-${img.id}`} className="mr-3 relative">
                        <TouchableOpacity onPress={() => handleOpenViewer(existingImages.map(ei => ei.path), i)}>
                          <Image
                            source={{ uri: getFullUrl(img.path) }}
                            className="w-20 h-20 rounded-xl border border-white/10"
                            style={{ width: 80, height: 80 }}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleRemoveExistingImage(img.id)}
                          className="absolute -top-2 -right-2 bg-[#1A1A1A] w-6 h-6 rounded-full items-center justify-center border border-white/20"
                        >
                          <Text className="text-white font-bold text-[10px]">X</Text>
                        </TouchableOpacity>
                      </View>
                    ))}

                    {/* New Attachments */}
                    {attachments.map((file, i) => (
                      <View key={`new-${i}`} className="mr-3 relative">
                        <TouchableOpacity onPress={() => handleOpenViewer(attachments, i)}>
                          {file.type === 'video' ? (
                            <View className="w-20 h-20 rounded-xl bg-gray-800 justify-center items-center border border-white/10">
                              <Text className="text-white font-bold text-xs">VIDEO</Text>
                            </View>
                          ) : (
                            <Image source={{ uri: file.uri }} className="w-20 h-20 rounded-xl border border-white/10" style={{ width: 80, height: 80 }} />
                          )}
                        </TouchableOpacity>
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

              {/* Upload Progress Bar */}
              {uploadProgress > 0 && (
                <View className="mb-5 px-1">
                  <View className="flex-row justify-between items-center mb-1.5">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Dateiupload läuft...</Text>
                    <Text className="text-white font-black text-xs">{uploadProgress}%</Text>
                  </View>
                  <View className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <View style={{ width: `${uploadProgress}%` }} className="h-full bg-brand-blue" />
                  </View>
                </View>
              )}

              <View className="h-10" />
            </ScrollView>

            <View className="flex-row justify-between pt-4 border-t border-white/5">
              <TouchableOpacity
                onPress={() => setIsStageModalOpen(false)}
                className="bg-white/5 flex-1 py-4 rounded-xl items-center mr-2 border border-white/10"
              >
                <Text className="text-white font-bold text-sm tracking-widest">
                  Abbrechen
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveStage}
                disabled={createStageMutation.isPending || updateStageDetailsMutation.isPending || isSavingStage}
                className="bg-brand-blue flex-1 py-4 rounded-xl items-center shadow-lg shadow-blue-500/30 border border-brand-blue"
              >
                {(createStageMutation.isPending || updateStageDetailsMutation.isPending || isSavingStage) ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-bold text-sm tracking-widest">
                    {editingStage ? 'Speichern' : 'Etappe speichern'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

          </GlassCard>
        </BlurView>
      </Modal>

      {/* Diary Modal (Add) */}
      <Modal
        visible={isDiaryModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsDiaryModalOpen(false)}
      >
        <BlurView intensity={80} tint="dark" className="flex-1 justify-end">
          <TouchableOpacity
            activeOpacity={1}
            onPress={Keyboard.dismiss}
            className="flex-1"
          />
          <GlassCard className="p-6 rounded-t-[40px] border-t border-white/10 bg-black/60 rounded-b-none" style={{ height: '85%' }}>
            <View className="w-full pb-6 items-center">
              <View className="w-12 h-1.5 bg-white/10 rounded-full" />
            </View>

            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold uppercase tracking-widest">Neuer Tagebucheintrag</Text>
              <TouchableOpacity onPress={() => setIsDiaryModalOpen(false)}>
                <Text className="text-gray-500 font-bold uppercase text-xs tracking-widest">Abbrechen</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              {/* Title Input */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Titel</Text>
                <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                  <TextInput
                    value={diaryTitle}
                    onChangeText={setDiaryTitle}
                    placeholder="z.B. Wetter/Vorkommnisse"
                    placeholderTextColor="#4B5563"
                    className="p-4 text-white font-bold"
                  />
                </GlassCard>
              </View>

              {/* Date Input */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Datum</Text>
                <TouchableOpacity onPress={() => setShowDiaryDatePicker(true)}>
                  <GlassCard className="p-4 bg-black/40 border border-white/5 flex-row items-center justify-between">
                    <Calendar size={16} color="#6B7280" />
                    <Text className="text-white font-bold">{formatDate(diaryDate)}</Text>
                  </GlassCard>
                </TouchableOpacity>
                {showDiaryDatePicker && (
                  <DateTimePicker
                    value={new Date(diaryDate)}
                    mode="date"
                    display="default"
                    onChange={(event, selected) => {
                      setShowDiaryDatePicker(false);
                      if (selected) setDiaryDate(getISODate(selected));
                    }}
                  />
                )}
              </View>

              {/* Color Selector */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Kategorie / Farbe</Text>
                <GlassCard className="p-4 bg-black/40 border border-white/5 flex-row items-center justify-between">
                  <ImageIcon size={16} color={diaryColor} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="ml-2">
                    {COLORS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setDiaryColor(c)}
                        className={`w-6 h-6 rounded-full mx-1 items-center justify-center ${diaryColor === c ? 'border border-white scale-110' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </ScrollView>
                </GlassCard>
              </View>

              {/* Description Input */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Inhalt</Text>
                <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                  <TextInput
                    value={diaryContent}
                    onChangeText={setDiaryContent}
                    placeholder="Details zum Eintrag..."
                    placeholderTextColor="#4B5563"
                    className="p-4 text-white text-sm"
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />
                </GlassCard>
              </View>

              {/* Media Upload Section */}
              <View className="mb-5">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Anhänge</Text>
                <TouchableOpacity onPress={handlePickDiaryMedia} activeOpacity={0.8} className="mb-4">
                  <GlassCard className="p-6 bg-black/40 border border-dashed border-white/20 items-center justify-center">
                    <UploadCloud size={32} color="#6B7280" className="mb-2" />
                    <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest">Dateien auswählen</Text>
                  </GlassCard>
                </TouchableOpacity>

                {diaryAttachments.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {diaryAttachments.map((file, i) => (
                      <View key={i} className="mr-3 relative">
                        {file.type === 'video' ? (
                          <View className="w-20 h-20 rounded-xl bg-gray-800 justify-center items-center border border-white/10">
                            <Text className="text-white font-bold text-xs">VIDEO</Text>
                          </View>
                        ) : (
                          <Image source={{ uri: file.uri }} className="w-20 h-20 rounded-xl border border-white/10" style={{ width: 80, height: 80 }} />
                        )}
                        <TouchableOpacity
                          onPress={() => removeDiaryAttachment(i)}
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
                onPress={() => setIsDiaryModalOpen(false)}
                className="bg-white/5 flex-1 py-4 rounded-xl items-center mr-2 border border-white/10"
              >
                <Text className="text-white font-bold text-sm tracking-widest">Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveDiaryLog}
                disabled={createDiaryLogMutation.isPending || isSavingDiary}
                className="bg-brand-blue flex-1 py-4 rounded-xl items-center shadow-lg shadow-blue-500/30 border border-brand-blue"
              >
                {(createDiaryLogMutation.isPending || isSavingDiary) ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-bold text-sm tracking-widest">Speichern</Text>
                )}
              </TouchableOpacity>
            </View>
          </GlassCard>
        </BlurView>
      </Modal>

      {/* New Folder Modal */}
      <Modal
        visible={isNewFolderModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsNewFolderModalOpen(false)}
      >
        <BlurView intensity={60} tint="dark" className="flex-1 justify-center px-6">
          <GlassCard className="p-6 border-white/10">
            <Text className="text-white text-lg font-bold mb-4 uppercase tracking-widest">Neuer Ordner</Text>
            <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5 mb-6">
              <TextInput
                value={newFolderName}
                onChangeText={setNewFolderName}
                placeholder="Ordnername..."
                placeholderTextColor="#4B5563"
                className="p-4 text-white font-bold"
                autoFocus
              />
            </GlassCard>
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => setIsNewFolderModalOpen(false)}
                className="flex-1 py-3 items-center"
              >
                <Text className="text-gray-500 font-bold uppercase text-xs">Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => createFolderMutation.mutate(newFolderName)}
                disabled={!newFolderName || createFolderMutation.isPending}
                className="flex-1 bg-brand-blue py-3 rounded-xl items-center"
              >
                {createFolderMutation.isPending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-bold uppercase text-xs">Erstellen</Text>
                )}
              </TouchableOpacity>
            </View>
          </GlassCard>
        </BlurView>
      </Modal>

      {/* Folder Permissions Modal */}
      <Modal
        visible={isPermissionsModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPermissionsModalOpen(false)}
      >
        <BlurView intensity={80} tint="dark" className="flex-1 justify-end">
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => setIsPermissionsModalOpen(false)}
          />
          <GlassCard className="rounded-t-3xl border-white/10 p-6 pb-12">
            <View className="flex-row justify-between items-center mb-6">
              <View className="flex-row items-center">
                <ShieldCheck size={24} color="#3B82F6" className="mr-3" />
                <View>
                  <Text className="text-white text-xl font-bold">Ordner-Berechtigungen</Text>
                  <Text className="text-gray-400 text-xs mt-1">{selectedFolder?.name}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsPermissionsModalOpen(false)}>
                <X size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <Text className="text-gray-400 text-xs font-bold uppercase mb-4 tracking-widest">
              Wer darf diesen Ordner sehen?
            </Text>

            <ScrollView className="max-h-60 mb-6">
              {roles.map((role: any) => {
                const isBypass = ['Admin', 'Büro'].includes(role.name);
                const isSelected = isBypass || allowedRoleIds.includes(role.id);

                return (
                  <TouchableOpacity
                    key={role.id}
                    onPress={() => !isBypass && toggleRole(role.id)}
                    activeOpacity={isBypass ? 1 : 0.7}
                    className={`flex-row items-center justify-between p-4 rounded-xl mb-2 border ${isSelected ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/5'
                      }`}
                  >
                    <View className="flex-row items-center">
                      <User size={18} color={isSelected ? "#3B82F6" : "#4B5563"} className="mr-3" />
                      <Text className={`font-bold ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                        {role.name}
                      </Text>
                    </View>
                    {isBypass ? (
                      <Lock size={16} color="#4B5563" />
                    ) : (
                      <View className={`w-6 h-6 rounded-md border-2 items-center justify-center ${isSelected ? 'bg-brand-blue border-brand-blue' : 'border-white/20'
                        }`}
                      >
                        {isSelected && <Check size={16} color="white" />}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View className="h-[1px] bg-white/10 mb-6" />

            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-1 mr-4">
                <Text className="text-white font-bold text-base">Inhaber eines Links</Text>
                <Text className="text-gray-400 text-xs mt-1">Jeder mit diesem Link kann die Dateien sehen.</Text>
              </View>
              <TouchableOpacity
                onPress={() => togglePublicMutation.mutate({ path: currentPath, name: selectedFolder?.name })}
                activeOpacity={0.8}
                disabled={togglePublicMutation.isPending}
                className={`w-14 h-8 rounded-full justify-center px-1 ${isPublic ? 'bg-brand-blue' : 'bg-white/10'
                  }`}
              >
                {togglePublicMutation.isPending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <View className={`w-6 h-6 rounded-full bg-white shadow-sm ${isPublic ? 'self-end' : 'self-start'
                    }`} />
                )}
              </TouchableOpacity>
            </View>

            {isPublic && shareToken && (
              <GlassCard className="p-4 mt-4 bg-black/40 border-white/5 flex-row items-center justify-between">
                <View className="flex-1 mr-4">
                  <Text className="text-gray-500 text-[10px] uppercase font-bold mb-1">Öffentlicher Link</Text>
                  <Text className="text-blue-400 text-xs" numberOfLines={1}>
                    {`${frontendDomain}/shared/${shareToken}`}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleCopyLink}
                  className="bg-brand-blue/20 p-2 rounded-lg"
                >
                  {copied ? <Check size={18} color="#3B82F6" /> : <Copy size={18} color="#3B82F6" />}
                </TouchableOpacity>
              </GlassCard>
            )}

            <View className="flex-row mt-8">
              <TouchableOpacity
                onPress={() => setIsPermissionsModalOpen(false)}
                className="flex-1 py-4 items-center bg-white/5 rounded-xl mr-2 border border-white/10"
              >
                <Text className="text-gray-400 font-bold uppercase text-xs tracking-widest">Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => updatePermissionsMutation.mutate({
                  path: currentPath,
                  name: selectedFolder?.name,
                  allowed_role_ids: allowedRoleIds
                })}
                className="flex-1 py-4 items-center bg-brand-blue rounded-xl ml-2 shadow-lg shadow-blue-500/30"
              >
                {updatePermissionsMutation.isPending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-bold uppercase text-xs tracking-widest">Speichern</Text>
                )}
              </TouchableOpacity>
            </View>
          </GlassCard>
        </BlurView>
      </Modal>

      {/* Full-screen Image Viewer */}
      {/* Project Edit Modal */}
      <Modal visible={isEditModalOpen} animationType="slide" transparent onRequestClose={() => setIsEditModalOpen(false)}>
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
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-xl bg-brand-blue/10 items-center justify-center mr-3 border border-brand-blue/20">
                  <FileText size={20} color="#3B82F6" />
                </View>
                <View>
                  <Text className="text-white text-xl font-bold uppercase tracking-widest">Projekt bearbeiten</Text>
                  <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{project?.project_number}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <Text className="text-gray-500 font-bold uppercase text-xs tracking-widest">Abbrechen</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              <View className="space-y-6 pb-12">
                {/* Title */}
                <View>
                  <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Projekttitel</Text>
                  <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                    <TextInput
                      value={editFormData.title}
                      onChangeText={(txt) => setEditFormData({ ...editFormData, title: txt })}
                      className="p-4 text-white font-bold"
                      placeholder="Titel eingeben..."
                      placeholderTextColor="#4B5563"
                    />
                  </GlassCard>
                </View>

                {/* Status & Progress */}
                <View className="flex-row justify-between">
                  <View className="flex-1 mr-2">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Status</Text>
                    <GlassCard className="p-2 bg-black/40 border border-white/5">
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                        {['Aktiv', 'Pausiert', 'Abgeschlossen'].map((s) => (
                          <TouchableOpacity
                            key={s}
                            onPress={() => setEditFormData({ ...editFormData, status: s })}
                            className={`px-3 py-2 rounded-lg mr-2 border ${editFormData.status === s ? 'bg-brand-blue border-brand-blue' : 'bg-white/5 border-white/5'}`}
                          >
                            <Text className={`text-[10px] font-bold ${editFormData.status === s ? 'text-white' : 'text-gray-400'}`}>{s}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </GlassCard>
                  </View>

                  <View className="w-24 ml-2">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Fortschritt %</Text>
                    <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                      <TextInput
                        value={(editFormData.progress || 0).toString()}
                        onChangeText={(txt) => {
                          const val = parseInt(txt) || 0;
                          setEditFormData({ ...editFormData, progress: Math.min(100, Math.max(0, val)) });
                        }}
                        keyboardType="numeric"
                        className="p-4 text-white font-black text-center"
                        maxLength={3}
                      />
                    </GlassCard>
                  </View>
                </View>

                {/* Visual Progress Bar */}
                <View className="mt-[-12px]">
                  <View className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <View style={{ width: `${editFormData.progress}%` }} className="h-full bg-brand-blue" />
                  </View>
                </View>

                {/* Categories Checkbox Grid */}
                <View>
                  <Text className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-3 ml-1">Klassifizierung (Mehrfachauswahl)</Text>
                  <Text className="text-gray-500 text-[9px] font-bold uppercase tracking-widest mb-2 ml-1">Hauptkategorien</Text>
                  
                  <View className="flex-row flex-wrap gap-2 mb-4">
                    {categoriesRes?.data?.categories?.map((cat: any) => {
                      const isSelected = selectedCategories.some(c => c.category_id === cat.id);
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => {
                            setSelectedCategories(prev => {
                              const exists = prev.some(c => c.category_id === cat.id);
                              if (exists) {
                                return prev.filter(c => c.category_id !== cat.id);
                              } else {
                                return [...prev, { category_id: cat.id, subcategory_id: null }];
                              }
                            });
                          }}
                          className={`px-3.5 py-2.5 rounded-xl border flex-row items-center mb-1 bg-black/40 ${isSelected ? 'border-brand-blue bg-brand-blue/15' : 'border-white/5'}`}
                        >
                          <View className={`w-4 h-4 rounded border mr-2 items-center justify-center ${isSelected ? 'bg-brand-blue border-brand-blue' : 'border-white/20'}`}>
                            {isSelected && <Check size={10} color="white" />}
                          </View>
                          <Text className={`text-xs font-bold ${isSelected ? 'text-brand-blue' : 'text-gray-400'}`}>{cat.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Selected Categories with subcategory selects */}
                  {selectedCategories.length > 0 && (
                    <View className="space-y-3">
                      <Text className="text-gray-500 text-[9px] font-bold uppercase tracking-widest mb-1.5 ml-1">Unterkategorien zuweisen</Text>
                      {selectedCategories.map((selectedCat) => {
                        const cat = categoriesRes?.data?.categories?.find((c: any) => c.id === selectedCat.category_id);
                        if (!cat || !cat.subcategories || cat.subcategories.length === 0) return null;
                        
                        return (
                          <GlassCard key={selectedCat.category_id} className="p-4 bg-black/40 border border-white/5 mb-2.5">
                            <View className="flex-row justify-between items-center mb-2.5">
                              <Text className="text-white text-xs font-bold">{cat.name}</Text>
                              <TouchableOpacity
                                onPress={() => setSelectedCategories(prev => prev.filter(c => c.category_id !== selectedCat.category_id))}
                                className="text-gray-500"
                              >
                                <X size={14} color="#6B7280" />
                              </TouchableOpacity>
                            </View>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                              <TouchableOpacity
                                onPress={() => {
                                  setSelectedCategories(prev => prev.map(c => c.category_id === selectedCat.category_id ? { ...c, subcategory_id: null } : c));
                                }}
                                className={`px-3 py-2 rounded-lg mr-2 border ${selectedCat.subcategory_id === null ? 'bg-white/10 border-white/20' : 'bg-transparent border-white/5'}`}
                              >
                                <Text className={`text-[10px] font-bold ${selectedCat.subcategory_id === null ? 'text-white' : 'text-gray-500'}`}>Keine</Text>
                              </TouchableOpacity>

                              {cat.subcategories.map((sub: any) => {
                                const isSubSelected = selectedCat.subcategory_id === sub.id;
                                return (
                                  <TouchableOpacity
                                    key={sub.id}
                                    onPress={() => {
                                      setSelectedCategories(prev => prev.map(c => c.category_id === selectedCat.category_id ? { ...c, subcategory_id: sub.id } : c));
                                    }}
                                    className={`px-3 py-2 rounded-lg mr-2 border ${isSubSelected ? 'bg-brand-blue border-brand-blue' : 'bg-transparent border-white/5'}`}
                                  >
                                    <Text className={`text-[10px] font-bold ${isSubSelected ? 'text-white' : 'text-gray-500'}`}>{sub.name}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>
                          </GlassCard>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Dates & Budget */}
                <View className="flex-row justify-between">
                  {/* Start Date */}
                  <View className="flex-1 mr-2">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Startdatum</Text>
                    <TouchableOpacity onPress={() => setShowStartDatePicker(true)}>
                      <GlassCard className="p-4 bg-black/40 border border-white/5 flex-row items-center justify-between">
                        <Calendar size={16} color="#6B7280" />
                        <Text className="text-white font-bold">{editFormData.start_date || 'N/A'}</Text>
                      </GlassCard>
                    </TouchableOpacity>
                  </View>
                  {/* End Date */}
                  <View className="flex-1 ml-2">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Enddatum</Text>
                    <TouchableOpacity onPress={() => setShowEndDatePicker(true)}>
                      <GlassCard className="p-4 bg-black/40 border border-white/5 flex-row items-center justify-between">
                        <Calendar size={16} color="#6B7280" />
                        <Text className="text-white font-bold">{editFormData.end_date || 'N/A'}</Text>
                      </GlassCard>
                    </TouchableOpacity>
                  </View>
                </View>

                {showStartDatePicker && (
                  <DateTimePicker
                    value={editFormData.start_date ? new Date(editFormData.start_date) : new Date()}
                    mode="date" display="default"
                    onChange={(event, date) => { setShowStartDatePicker(false); if (date) setEditFormData({ ...editFormData, start_date: date.toISOString().split('T')[0] }); }}
                  />
                )}
                {showEndDatePicker && (
                  <DateTimePicker
                    value={editFormData.end_date ? new Date(editFormData.end_date) : new Date()}
                    mode="date" display="default"
                    onChange={(event, date) => { setShowEndDatePicker(false); if (date) setEditFormData({ ...editFormData, end_date: date.toISOString().split('T')[0] }); }}
                  />
                )}

                {/* Financials & Address */}
                <View className="flex-row justify-between">
                  <View className="flex-1 mr-2">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Budget (€)</Text>
                    <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                      <TextInput
                        value={editFormData.budget}
                        onChangeText={(txt) => setEditFormData({ ...editFormData, budget: txt })}
                        keyboardType="numeric"
                        className="p-4 text-white font-bold"
                        placeholder="0.00"
                        placeholderTextColor="#4B5563"
                      />
                    </GlassCard>
                  </View>
                  <View className="flex-[2] ml-2">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Adresse</Text>
                    <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                      <TextInput
                        value={editFormData.address}
                        onChangeText={(txt) => setEditFormData({ ...editFormData, address: txt })}
                        className="p-4 text-white font-bold"
                        placeholder="Adresse..."
                        placeholderTextColor="#4B5563"
                      />
                    </GlassCard>
                  </View>
                </View>

                {/* Description */}
                <View>
                  <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Beschreibung</Text>
                  <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                    <TextInput
                      value={editFormData.description}
                      onChangeText={(txt) => setEditFormData({ ...editFormData, description: txt })}
                      multiline numberOfLines={4}
                      className="p-4 text-white min-h-[100px] text-left align-top"
                      placeholder="Beschreibung..."
                      placeholderTextColor="#4B5563"
                    />
                  </GlassCard>
                </View>

                {/* Abweichender Ansprechpartner Toggle */}
                <View className="flex-row justify-between items-center bg-white/5 border border-white/5 p-4 rounded-2xl mt-4">
                  <View className="flex-1 pr-3">
                    <Text className="text-white text-xs font-bold">Abweichender Ansprechpartner / Endkunde</Text>
                    <Text className="text-gray-500 text-[10px] mt-0.5">Spezifischen Kontakt für dieses Projekt hinterlegen</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsCustomClientEnabled(!isCustomClientEnabled)}
                    className={`w-12 h-6 rounded-full p-0.5 justify-center ${isCustomClientEnabled ? 'bg-emerald-500 items-end' : 'bg-gray-600 items-start'}`}
                  >
                    <View className="w-5 h-5 rounded-full bg-white shadow" />
                  </TouchableOpacity>
                </View>

                {isCustomClientEnabled && (
                  <View className="mt-4 p-4 border border-emerald-500/10 bg-emerald-500/5 rounded-2xl space-y-4">
                    <Text className="text-emerald-400 font-bold uppercase tracking-widest text-[9px] mb-1">
                      Kontakt-Details des Endkunden
                    </Text>

                    <View className="flex-row gap-x-2">
                      <View className="flex-1">
                        <Text className="text-gray-500 text-[9px] font-bold uppercase tracking-widest mb-1.5 ml-1">Vorname</Text>
                        <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                          <TextInput
                            value={editFormData.client_first_name}
                            onChangeText={(txt) => setEditFormData({ ...editFormData, client_first_name: txt })}
                            className="p-3.5 text-white text-xs"
                            placeholder="Vorname..."
                            placeholderTextColor="#4B5563"
                          />
                        </GlassCard>
                      </View>
                      <View className="flex-1">
                        <Text className="text-gray-500 text-[9px] font-bold uppercase tracking-widest mb-1.5 ml-1">Nachname</Text>
                        <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                          <TextInput
                            value={editFormData.client_last_name}
                            onChangeText={(txt) => setEditFormData({ ...editFormData, client_last_name: txt })}
                            className="p-3.5 text-white text-xs"
                            placeholder="Nachname..."
                            placeholderTextColor="#4B5563"
                          />
                        </GlassCard>
                      </View>
                    </View>

                    <View className="flex-row gap-x-2">
                      <View className="flex-1">
                        <Text className="text-gray-500 text-[9px] font-bold uppercase tracking-widest mb-1.5 ml-1">Telefon</Text>
                        <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                          <TextInput
                            value={editFormData.client_phone}
                            onChangeText={(txt) => setEditFormData({ ...editFormData, client_phone: txt })}
                            className="p-3.5 text-white text-xs"
                            placeholder="Telefon..."
                            placeholderTextColor="#4B5563"
                          />
                        </GlassCard>
                      </View>
                      <View className="flex-1">
                        <Text className="text-gray-500 text-[9px] font-bold uppercase tracking-widest mb-1.5 ml-1">E-Mail</Text>
                        <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                          <TextInput
                            value={editFormData.client_email}
                            onChangeText={(txt) => setEditFormData({ ...editFormData, client_email: txt })}
                            className="p-3.5 text-white text-xs"
                            placeholder="E-Mail..."
                            placeholderTextColor="#4B5563"
                            keyboardType="email-address"
                            autoCapitalize="none"
                          />
                        </GlassCard>
                      </View>
                    </View>

                    <View>
                      <Text className="text-gray-500 text-[9px] font-bold uppercase tracking-widest mb-1.5 ml-1">Adresse</Text>
                      <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                        <TextInput
                          value={editFormData.client_address}
                          onChangeText={(txt) => setEditFormData({ ...editFormData, client_address: txt })}
                          className="p-3.5 text-white text-xs"
                          placeholder="Adresse..."
                          placeholderTextColor="#4B5563"
                        />
                      </GlassCard>
                    </View>

                    <View>
                      <Text className="text-gray-500 text-[9px] font-bold uppercase tracking-widest mb-1.5 ml-1">Interne Notizen zum Endkunden</Text>
                      <GlassCard className="p-0 overflow-hidden bg-black/40 border border-white/5">
                        <TextInput
                          value={editFormData.client_notes}
                          onChangeText={(txt) => setEditFormData({ ...editFormData, client_notes: txt })}
                          multiline
                          numberOfLines={3}
                          className="p-3.5 text-white text-xs min-h-[60px] text-left align-top"
                          placeholder="Interne Notizen..."
                          placeholderTextColor="#4B5563"
                        />
                      </GlassCard>
                    </View>
                  </View>
                )}

                {/* Team Assignment */}
                <View className="pt-4 mt-4 border-t border-white/5">
                  <View className="flex-row items-center mb-6">
                    <View className="w-1 h-6 bg-brand-blue rounded-full mr-3" />
                    <Text className="text-white font-bold uppercase tracking-widest text-sm">Team & Besetzung</Text>
                  </View>

                  {/* PL / GL / Workers */}
                  {['Projektleiter', 'Gruppenleiter', 'Worker'].map((roleName) => (
                    <View key={roleName} className="mb-6">
                      <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">{roleName}</Text>
                      <View className="space-y-2">
                        {(allUsersRes || []).filter((u: any) => {
                          const userRole = u.role?.name?.toLowerCase();
                          const currentRoleMatch = roleName.toLowerCase();
                          if (currentRoleMatch === 'projektleiter') {
                            return userRole === 'projektleiter' || userRole === 'pl' || userRole === 'admin' || userRole === 'büro' || userRole === 'buero';
                          }
                          return userRole === currentRoleMatch || (currentRoleMatch === 'worker' && userRole === 'arbeiter');
                        }).map((u: any) => {
                          const roleId = roleName.toLowerCase() as any;
                          const isAssigned = assignedUsers.some(au => au.user_id === u.id && au.role === roleId);
                          return (
                            <TouchableOpacity
                              key={u.id}
                              onPress={() => handleTogglePersonnel(u.id, roleId)}
                              className={`p-3.5 rounded-2xl border flex-row items-center justify-between ${isAssigned ? 'bg-brand-blue/20 border-brand-blue' : 'bg-black/40 border-white/5'}`}
                            >
                              <View className="flex-row items-center flex-1 pr-3">
                                <User size={16} color={isAssigned ? '#3B82F6' : '#6B7280'} className="mr-3" />
                                <View className="flex-1">
                                  <Text className={`text-xs font-bold ${isAssigned ? 'text-white' : 'text-gray-300'}`}>
                                    {u.name} {u.role?.name ? `(${u.role.name})` : ''}
                                  </Text>
                                  {u.specialty ? <Text className="text-[10px] text-gray-500 mt-0.5">{u.specialty}</Text> : null}
                                  {(u.phone || u.email) && (
                                    <View className="mt-1.5 pt-1.5 border-t border-white/5 space-y-1">
                                      {u.phone && (
                                        <View className="flex-row items-center">
                                          <Phone size={10} color="#4B5563" className="mr-1.5" />
                                          <Text className="text-[10px] text-gray-400">{u.phone}</Text>
                                        </View>
                                      )}
                                      {u.email && (
                                        <View className="flex-row items-center">
                                          <Mail size={10} color="#4B5563" className="mr-1.5" />
                                          <Text className="text-[10px] text-gray-400">{u.email}</Text>
                                        </View>
                                      )}
                                    </View>
                                  )}
                                </View>
                              </View>
                              <View className={`w-5 h-5 rounded-full items-center justify-center border ${isAssigned ? 'bg-brand-blue border-brand-blue' : 'border-white/20'}`}>
                                {isAssigned && <Check size={10} color="white" />}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}

                  {/* Subcontractors */}
                  <View className="mb-6">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Nachunternehmer</Text>
                    <View className="flex-row flex-wrap">
                      {(subcontractorsRes?.data?.subcontractors || []).map((sub: any) => {
                        const isAssigned = assignedSubcontractors.includes(sub.id);
                        return (
                          <TouchableOpacity
                            key={sub.id}
                            onPress={() => setAssignedSubcontractors(prev => prev.includes(sub.id) ? prev.filter(sid => sid !== sub.id) : [...prev, sub.id])}
                            className={`w-[48%] p-3 rounded-xl mb-2 border ${isAssigned ? 'bg-brand-blue/20 border-brand-blue' : 'bg-black/40 border-white/5'} ${assignedSubcontractors.indexOf(sub.id) % 2 === 0 ? 'mr-[4%]' : ''}`}
                          >
                            <Text className={`text-xs font-bold text-center ${isAssigned ? 'text-brand-blue' : 'text-gray-400'}`}>{sub.name}</Text>
                            <Text className="text-[10px] text-center text-gray-600 font-bold uppercase tracking-tighter mt-1">{sub.trade}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleSaveProjectEdit}
              disabled={updateProjectMutation.isPending}
              className="mt-4 bg-brand-blue py-5 rounded-2xl items-center shadow-lg shadow-blue-500/40"
            >
              {updateProjectMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-black uppercase tracking-[3px]">Projekt speichern</Text>
              )}
            </TouchableOpacity>
          </GlassCard>
        </BlurView>
      </Modal>

      <ImageView
        images={viewerImages}
        imageIndex={currentViewerIndex}
        visible={isViewerVisible}
        onRequestClose={() => setIsViewerVisible(false)}
        HeaderComponent={({ imageIndex }) => <ImageHeader index={imageIndex} />}
      />
    </ScreenLayout>
  );
}


