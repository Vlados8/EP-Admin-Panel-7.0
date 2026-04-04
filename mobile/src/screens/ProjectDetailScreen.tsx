import React, { useState } from 'react';
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
  toggleProjectFolderPublic
} from '../api/projects';
import { fetchRoles } from '../api/roles';
import * as Clipboard from 'expo-clipboard';

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
  Briefcase as BriefcaseIcon
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';

import { serverDomain, frontendDomain } from '../api/client';

const { width } = Dimensions.get('window');

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

  const { data: stagesRes, isLoading: stagesLoading } = useQuery({
    queryKey: ['project-stages', id],
    queryFn: () => fetchProjectStages(id),
    enabled: activeTab === 'steps'
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

      return createProjectStage(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-stages', id] });
      setIsStageModalOpen(false);
      resetStageForm();
    },
    onError: () => {
      Alert.alert('Fehler', 'Etappe konnte nicht erstellt werden.');
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

      return updateProjectStage(stageId, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-stages', id] });
      setIsStageModalOpen(false);
      resetStageForm();
    },
    onError: () => {
      Alert.alert('Fehler', 'Etappe konnte nicht aktualisiert werden.');
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

  const uploadFilesMutation = useMutation({
    mutationFn: (formData: FormData) => uploadProjectFiles(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-files', id, currentPath] });
    },
    onError: (err: any) => {
      Alert.alert('Fehler', 'Dateien konnten nicht hochgeladen werden.');
    }
  });

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
      uri: img.uri || (img.path ? `${serverDomain}${img.path}` : img)
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
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
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
      handleOpenViewer(allImages.map((f: any) => `${serverDomain}${f.url}`), initialIndex);
      return;
    }

    try {
      const fileUri = `${FileSystem.cacheDirectory}${file.name}`;
      const downloadUrl = `${serverDomain}${file.url}`;

      const { uri } = await FileSystem.downloadAsync(downloadUrl, fileUri);
      await Sharing.shareAsync(uri);
    } catch (error) {
      Alert.alert('Fehler', 'Datei konnte nicht geöffnet werden.');
    }
  };

  const executeFileUpload = (assets: any[]) => {
    const formData = new FormData();
    formData.append('path', currentPath);

    assets.forEach(asset => {
      formData.append('files', {
        uri: asset.uri,
        name: asset.name || asset.fileName || `upload_${Date.now()}.jpg`,
        type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg')
      } as any);
    });

    uploadFilesMutation.mutate(formData);
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
    if (!stageTitle.trim()) return;
    if (editingStage) {
      updateStageDetailsMutation.mutate({
        stageId: editingStage.id,
        data: { title: stageTitle, description: stageDescription }
      });
    } else {
      createStageMutation.mutate({ title: stageTitle, description: stageDescription });
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
  const renderInfoTab = () => (
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
      <View className="flex-row flex-wrap justify-between">
        <GlassCard className="w-[48%] p-4 mb-4">
          <View className="flex-row items-center mb-2">
            <MapPin size={12} color="#3B82F6" />
            <Text className="text-gray-500 font-bold uppercase tracking-widest text-[9px] ml-1.5">Standort</Text>
          </View>
          <Text className="text-white text-xs font-bold">{project?.address || 'N/A'}</Text>
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

      {/* Classification & Category */}
      {(project?.category || project?.subcategory) && (
        <View>
          <Text className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-3 ml-1">Klassifizierung</Text>
          <GlassCard className="p-5 flex-row">
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
                onPress={() => handleOpenViewer(stage.images.map((img: any) => `${serverDomain}${img.path}`))}
                className="ml-4 relative"
              >
                <Image
                  source={{ uri: `${serverDomain}${stage.images[0].path}` }}
                  className="w-12 h-12 rounded-lg border border-white/10"
                />
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
          source={project?.main_image ? { uri: `${serverDomain}${project.main_image}` } : undefined}
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
            <View className="bg-black/60 px-3 py-1.5 rounded-xl border border-white/20 blur-md">
              <Text className="text-white font-bold text-[10px] tracking-widest uppercase">{project?.project_number}</Text>
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
      <View className="px-6 flex-row items-center border-b border-white/5 mb-6">
        <TabButton label="Info" id="info" icon={Briefcase} />
        <TabButton label="Steps" id="steps" icon={CheckSquare} />
        <TabButton label="Files" id="files" icon={FileText} />
      </View>

      {/* Content */}
      <View className="px-6">
        {activeTab === 'info' && renderInfoTab()}
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
                            source={{ uri: `${serverDomain}${img.path}` }}
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
                disabled={createStageMutation.isPending || updateStageDetailsMutation.isPending}
                className="bg-brand-blue flex-1 py-4 rounded-xl items-center shadow-lg shadow-blue-500/30 border border-brand-blue"
              >
                {(createStageMutation.isPending || updateStageDetailsMutation.isPending) ? (
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
                    className={`flex-row items-center justify-between p-4 rounded-xl mb-2 border ${
                      isSelected ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/5'
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
                      <View className={`w-6 h-6 rounded-md border-2 items-center justify-center ${
                        isSelected ? 'bg-brand-blue border-brand-blue' : 'border-white/20'
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
                className={`w-14 h-8 rounded-full justify-center px-1 ${
                  isPublic ? 'bg-brand-blue' : 'bg-white/10'
                }`}
              >
                {togglePublicMutation.isPending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <View className={`w-6 h-6 rounded-full bg-white shadow-sm ${
                    isPublic ? 'self-end' : 'self-start'
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


