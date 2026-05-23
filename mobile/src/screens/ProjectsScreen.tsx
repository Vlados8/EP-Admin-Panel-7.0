import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  TextInput,
  Image,
  Dimensions,
  Modal,
  ScrollView,
  Keyboard,
  Alert
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchProjects, 
  fetchClients, 
  createProject, 
  fetchCategories, 
  fetchSubcontractors,
  createClient
} from '../api/projects';
import { fetchUsers } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { ScreenLayout } from '../components/ScreenLayout';
import { GlassCard } from '../components/GlassCard';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  Briefcase, 
  ChevronRight, 
  Calendar, 
  Search, 
  X,
  MapPin,
  Users,
  Plus,
  Check,
  CheckCircle2,
  DollarSign,
  Tag,
  UserCheck,
  Building2,
  Info
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { serverDomain } from '../api/client';

export default function ProjectsScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canCreateProject = 
    user?.role === 'Admin' || 
    user?.role === 'Büro' || 
    user?.role === 'Projektleiter' || 
    (user as any)?.role?.name === 'Admin' || 
    (user as any)?.role?.name === 'Büro' || 
    (user as any)?.role?.name === 'Projektleiter';

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split('T')[0];
  });
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Client Selection / Inline Creation
  const [isNewClient, setIsNewClient] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientType, setClientType] = useState<'company' | 'private'>('company');
  const [clientContactPerson, setClientContactPerson] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientZip, setClientZip] = useState('');
  const [clientCity, setClientCity] = useState('');

  // Classification
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');

  // Team
  const [selectedPL, setSelectedPL] = useState('');
  const [selectedGL, setSelectedGL] = useState('');
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);

  // Subcontractors
  const [selectedSubcontractors, setSelectedSubcontractors] = useState<number[]>([]);

  // Data Queries
  const { data: projectsData, isLoading, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
    enabled: isCreateOpen,
  });
  const clients = clientsData?.data?.clients || [];

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    enabled: isCreateOpen,
  });
  const plList = useMemo(() => (users || []).filter((u: any) => u.role?.name?.toLowerCase() === 'projektleiter' || u.role?.name?.toLowerCase() === 'pl'), [users]);
  const glList = useMemo(() => (users || []).filter((u: any) => u.role?.name?.toLowerCase() === 'gruppenleiter' || u.role?.name?.toLowerCase() === 'gl'), [users]);
  const workerList = useMemo(() => (users || []).filter((u: any) => u.role?.name?.toLowerCase() === 'worker' || u.role?.name?.toLowerCase() === 'arbeiter'), [users]);

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    enabled: isCreateOpen,
  });
  const categories = categoriesData?.data?.categories || [];
  const selectedCategory = useMemo(() => {
    if (!categoryId) return null;
    return categories.find((c: any) => c.id && c.id.toString() === categoryId);
  }, [categories, categoryId]);

  const { data: subsData } = useQuery({
    queryKey: ['subcontractors'],
    queryFn: fetchSubcontractors,
    enabled: isCreateOpen,
  });
  const subcontractors = subsData?.data?.subcontractors || [];

  const projects = projectsData?.data?.projects || [];

  const filteredProjects = useMemo(() => {
    return projects.filter((p: any) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        p.title?.toLowerCase().includes(q) ||
        p.project_number?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.client?.name?.toLowerCase().includes(q)
      );
    });
  }, [projects, searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAddress('');
    setBudget('');
    setStartDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    setEndDate(d.toISOString().split('T')[0]);
    setClientId('');
    setIsNewClient(false);
    setClientName('');
    setClientType('company');
    setClientContactPerson('');
    setClientEmail('');
    setClientPhone('');
    setClientAddress('');
    setClientZip('');
    setClientCity('');
    setCategoryId('');
    setSubcategoryId('');
    setSelectedPL('');
    setSelectedGL('');
    setSelectedWorkers([]);
    setSelectedSubcontractors([]);
  };

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      let finalClientId = clientId;

      if (isNewClient) {
        if (!clientName) {
          throw new Error('Bitte geben Sie einen Kundennamen an.');
        }
        const clientRes = await createClient({
          name: clientName,
          type: clientType,
          contact_person: clientContactPerson || undefined,
          email: clientEmail || undefined,
          phone: clientPhone || undefined,
          address: clientAddress || undefined,
          zip_code: clientZip || undefined,
          city: clientCity || undefined,
          source: 'mobile_app'
        });

        if (clientRes && clientRes.data?.client?.id) {
          finalClientId = clientRes.data.client.id;
        } else if (clientRes?.client?.id) {
          finalClientId = clientRes.client.id;
        } else {
          throw new Error('Kunde konnte nicht inline angelegt werden.');
        }
      }

      if (!finalClientId) {
        throw new Error('Bitte wählen Sie einen Kunden aus.');
      }

      const assignedUsersArray: any[] = [];
      if (selectedPL) {
        assignedUsersArray.push({ user_id: selectedPL, role: 'projektleiter' });
      }
      if (selectedGL) {
        assignedUsersArray.push({ user_id: selectedGL, role: 'gruppenleiter' });
      }
      selectedWorkers.forEach(wId => {
        assignedUsersArray.push({ user_id: wId, role: 'worker' });
      });

      const bodyPayload = {
        title,
        description,
        address,
        budget: budget ? parseFloat(budget) : 0,
        start_date: startDate || null,
        end_date: endDate || null,
        client_id: finalClientId,
        category_id: categoryId ? parseInt(categoryId) : null,
        subcategory_id: subcategoryId ? parseInt(subcategoryId) : null,
        assigned_users: JSON.stringify(assignedUsersArray),
        assigned_subcontractors: JSON.stringify(selectedSubcontractors),
        status: 'Aktiv'
      };

      return createProject(bodyPayload);
    },
    onSuccess: () => {
      Alert.alert('Erfolg', 'Das Projekt wurde erfolgreich erstellt.');
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: any) => {
      console.error('Error creating project:', err);
      Alert.alert('Fehler', err.message || 'Projekt konnte nicht erstellt werden.');
    }
  });

  const handleSaveProject = () => {
    if (!title) {
      Alert.alert('Hinweis', 'Bitte geben Sie einen Projekttitel an.');
      return;
    }
    if (!isNewClient && !clientId) {
      Alert.alert('Hinweis', 'Bitte wählen Sie einen Kunden aus.');
      return;
    }
    if (isNewClient && !clientName) {
      Alert.alert('Hinweis', 'Bitte geben Sie einen Namen für den neuen Kunden an.');
      return;
    }
    createProjectMutation.mutate();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  };

  const getStatusLevel = (p: any) => {
    const hasPL = (p.assigned_personnel || []).some((pers: any) => 
        pers.role?.toLowerCase() === 'projektleiter' || pers.role?.toLowerCase() === 'pl'
    );
    if (hasPL) return 0; // Normal

    if (!p.start_date) return 1; // Warning (Orange)

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(p.start_date);
    startDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 3; // Critical (Purple)
    if (diffDays <= 3) return 2; // Urgent (Red)
    return 1; // Warning (Orange)
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return '#10B981'; // Emerald
    if (progress > 50) return '#3B82F6';   // Blue
    if (progress > 20) return '#F59E0B';   // Amber
    return '#EF4444';                      // Red
  };

  const ProjectCard = ({ project }: any) => {
    const statusLevel = getStatusLevel(project);
    const progress = project.progress || 0;
    
    // Status Styles
    let borderColor = 'border-white/10';
    let statusText = 'Normal';
    if (statusLevel === 3) { borderColor = 'border-purple-500 shadow-lg shadow-purple-500/20'; statusText = 'CRITICAL'; }
    else if (statusLevel === 2) { borderColor = 'border-red-500 shadow-lg shadow-red-500/20'; statusText = 'URGENT'; }
    else if (statusLevel === 1) { borderColor = 'border-orange-500 shadow-lg shadow-orange-500/20'; statusText = 'WARNING'; }

    return (
      <TouchableOpacity 
        activeOpacity={0.9} 
        className="mb-6 rounded-3xl overflow-hidden"
        onPress={() => navigation.navigate('ProjectDetail', { id: project.id })}
      >
        <GlassCard className={`border ${borderColor}`}>
          {/* Hero Image Section */}
          <View className="h-32 bg-black/40 relative">
            {project.main_image ? (
              <Image 
                source={{ uri: `${serverDomain}${project.main_image}` }} 
                className="absolute inset-0 w-full h-full opacity-60"
                resizeMode="cover"
              />
            ) : (
              <View className="absolute inset-0 bg-blue-500/10" />
            )}
            
            <View className="p-4 flex-row justify-between items-start">
              <View className={`px-2.5 py-1 rounded-lg border backdrop-blur-md ${
                project.status === 'Aktiv' ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-gray-500/20 border-white/10'
              }`}>
                <Text className={`text-[10px] font-bold uppercase tracking-wider ${
                  project.status === 'Aktiv' ? 'text-emerald-400' : 'text-gray-400'
                }`}>
                  {project.status || 'Aktiv'}
                </Text>
              </View>
              <View className="bg-black/60 px-2.5 py-1 rounded-lg border border-white/10">
                <Text className="text-white text-[10px] font-bold tracking-widest">{project.project_number}</Text>
              </View>
            </View>
          </View>

          {/* Body Section */}
          <View className="p-5 bg-black/20">
            <Text className="text-white font-bold text-xl mb-1.5" numberOfLines={1}>{project.title}</Text>
            <View className="flex-row items-center mb-4">
              <MapPin size={12} color="#3B82F6" />
              <Text className="text-gray-400 text-xs ml-1.5 flex-1" numberOfLines={1}>
                {project.address || `${project.client?.city || ''}, ${project.client?.address || ''}`}
              </Text>
            </View>

            {/* Progress Bar */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-1.5 px-1">
                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fortschritt</Text>
                <Text className="text-white font-bold text-[10px]">{progress}%</Text>
              </View>
              <View className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                <View 
                  className="h-full rounded-full" 
                  style={{ width: `${progress}%`, backgroundColor: getProgressColor(progress) }} 
                />
              </View>
            </View>

            {/* Team Footer */}
            <View className="flex-row justify-between items-center pt-3 border-t border-white/5">
              <View className="flex-row items-center">
                <View className="flex-row -space-x-3 mr-3 mt-1">
                  {(project.assigned_personnel || []).slice(0, 3).map((ap: any, i: number) => {
                    const initials = ap.user?.name?.split(' ').map((n:any) => n[0]).join('').toUpperCase().substring(0, 2);
                    return (
                      <View 
                        key={i} 
                        className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 items-center justify-center"
                      >
                        <Text className="text-blue-400 text-[10px] font-bold">{initials}</Text>
                      </View>
                    );
                  })}
                  {project.assigned_personnel?.length > 3 && (
                    <View className="w-7 h-7 rounded-full bg-black/60 border border-white/10 items-center justify-center">
                      <Text className="text-gray-400 text-[10px] font-bold">+{project.assigned_personnel.length - 3}</Text>
                    </View>
                  )}
                </View>
                {!project.assigned_personnel?.length ? (
                  <Text className="text-gray-500 text-[10px] font-bold italic">Kein Team</Text>
                ) : null}
              </View>

              <View className="flex-row items-center">
                <Text className="text-brand-blue font-bold text-xs mr-1">Ansehen</Text>
                <ChevronRight size={14} color="#3B82F6" />
              </View>
            </View>
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenLayout scroll={false}>
      <View className="mb-6 flex-row items-center justify-between">
        <View className="flex-row items-center">
            <View className="w-1.5 h-7 bg-brand-blue rounded-full mr-3 shadow-lg shadow-blue-500/50" />
            <Text className="text-white font-black text-2xl uppercase tracking-tighter">Projekte</Text>
        </View>
        <View className="flex-row items-center">
          {canCreateProject && (
            <TouchableOpacity 
              onPress={() => setIsCreateOpen(true)}
              className="bg-brand-blue p-2 rounded-xl shadow-lg shadow-blue-500/20 mr-3"
            >
              <Plus size={20} color="white" />
            </TouchableOpacity>
          )}
          <Text className="text-gray-600 font-bold text-[10px] uppercase tracking-widest">{filteredProjects?.length || 0} GESAMT</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View className="mb-6">
        <GlassCard className="flex-row items-center px-4 py-3 bg-black/40 border border-white/5">
          <Search size={18} color="#6B7280" />
          <TextInput 
            className="flex-1 ml-3 text-white text-sm"
            placeholder="Suchen nach Projekten, IDs или клиентам..."
            placeholderTextColor="#4B5563"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color="#6B7280" />
            </TouchableOpacity>
          )}
        </GlassCard>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredProjects}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <ProjectCard project={item} />}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <GlassCard className="p-12 items-center bg-black/10">
              <Text className="text-gray-500 text-center uppercase text-[10px] font-bold tracking-[4px]">
                Keine Projekte gefunden
              </Text>
            </GlassCard>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Project Creation Modal */}
      <Modal
        visible={isCreateOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCreateOpen(false)}
      >
        <BlurView intensity={90} tint="dark" className="flex-1 justify-end">
          <TouchableOpacity 
             activeOpacity={1} 
             onPress={Keyboard.dismiss} 
             className="flex-1"
          />
          <GlassCard className="p-6 rounded-t-[40px] border-t border-white/10 bg-black/60" style={{ height: '90%' }}>
            <View className="w-full pb-6 items-center">
               <View className="w-12 h-1.5 bg-white/10 rounded-full" />
            </View>
            
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold uppercase tracking-widest">
                Neues Projekt
              </Text>
              <TouchableOpacity onPress={() => setIsCreateOpen(false)}>
                <Text className="text-gray-500 font-bold uppercase text-xs tracking-widest">Abbrechen</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              
              {/* SECTION 1: KUNDE */}
              <View className="mb-6">
                <Text className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-3 ml-1">Kunde auswählen</Text>
                
                {/* Client Toggle */}
                <View className="flex-row mb-4 bg-white/5 rounded-xl p-1 border border-white/5">
                  <TouchableOpacity 
                    onPress={() => setIsNewClient(false)}
                    className={`flex-1 py-2.5 items-center justify-center rounded-lg ${!isNewClient ? 'bg-brand-blue shadow-lg shadow-blue-500/30' : ''}`}
                  >
                    <Text className={`text-xs font-bold uppercase tracking-wider ${!isNewClient ? 'text-white' : 'text-gray-500'}`}>Bestehender Kunde</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setIsNewClient(true)}
                    className={`flex-1 py-2.5 items-center justify-center rounded-lg ${isNewClient ? 'bg-brand-blue shadow-lg shadow-blue-500/30' : ''}`}
                  >
                    <Text className={`text-xs font-bold uppercase tracking-wider ${isNewClient ? 'text-white' : 'text-gray-500'}`}>Neuer Kunde</Text>
                  </TouchableOpacity>
                </View>

                {!isNewClient ? (
                  <View>
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Kunde wählen <Text className="text-red-400">*</Text></Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-2">
                      {clients.map((c: any) => {
                        if (!c || !c.id) return null;
                        const isSelected = clientId === c.id.toString();
                        return (
                          <TouchableOpacity
                            key={c.id}
                            onPress={() => setClientId(c.id.toString())}
                            className={`p-3 rounded-2xl mr-3 border flex-row items-center bg-black/40 ${isSelected ? 'border-brand-blue bg-brand-blue/10' : 'border-white/5'}`}
                          >
                            <View className="w-8 h-8 rounded-full bg-blue-500/20 items-center justify-center mr-2">
                              <Text className="text-blue-400 text-xs font-bold">{c.name ? c.name[0].toUpperCase() : 'K'}</Text>
                            </View>
                            <View>
                              <Text className="text-white font-bold text-xs" numberOfLines={1}>{c.name}</Text>
                              {c.contact_person ? (
                                <Text className="text-gray-500 text-[10px]" numberOfLines={1}>{c.contact_person}</Text>
                              ) : null}
                            </View>
                            {isSelected && <Check size={14} color="#3B82F6" className="ml-2" />}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : (
                  <View className="space-y-4">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1 ml-1">Kunden-Daten</Text>
                    <GlassCard className="p-4 bg-black/40 border border-white/5 space-y-4">
                      
                      <View className="flex-row gap-x-3 mb-2">
                        <TouchableOpacity 
                          onPress={() => setClientType('company')}
                          className={`flex-1 py-1.5 items-center justify-center rounded-lg border ${clientType === 'company' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'border-white/10 text-gray-500'}`}
                        >
                          <Text className="text-[10px] font-bold uppercase tracking-wider">Firma</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => setClientType('private')}
                          className={`flex-1 py-1.5 items-center justify-center rounded-lg border ${clientType === 'private' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'border-white/10 text-gray-500'}`}
                        >
                          <Text className="text-[10px] font-bold uppercase tracking-wider">Privatperson</Text>
                        </TouchableOpacity>
                      </View>

                      <TextInput
                        value={clientName}
                        onChangeText={setClientName}
                        placeholder="Firma / Name... *"
                        placeholderTextColor="#4B5563"
                        className="bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white text-xs font-bold"
                      />
                      <TextInput
                        value={clientContactPerson}
                        onChangeText={setClientContactPerson}
                        placeholder="Ansprechpartner..."
                        placeholderTextColor="#4B5563"
                        className="bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white text-xs"
                      />
                      <View className="flex-row gap-x-2">
                        <TextInput
                          value={clientEmail}
                          onChangeText={setClientEmail}
                          placeholder="E-Mail..."
                          placeholderTextColor="#4B5563"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          className="flex-1 bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white text-xs"
                        />
                        <TextInput
                          value={clientPhone}
                          onChangeText={setClientPhone}
                          placeholder="Telefon..."
                          placeholderTextColor="#4B5563"
                          className="flex-1 bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white text-xs"
                        />
                      </View>
                      <TextInput
                        value={clientAddress}
                        onChangeText={setClientAddress}
                        placeholder="Adresse..."
                        placeholderTextColor="#4B5563"
                        className="bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white text-xs"
                      />
                      <View className="flex-row gap-x-2">
                        <TextInput
                          value={clientZip}
                          onChangeText={setClientZip}
                          placeholder="PLZ..."
                          placeholderTextColor="#4B5563"
                          className="w-1/3 bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white text-xs"
                        />
                        <TextInput
                          value={clientCity}
                          onChangeText={setClientCity}
                          placeholder="Stadt..."
                          placeholderTextColor="#4B5563"
                          className="flex-1 bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white text-xs"
                        />
                      </View>
                    </GlassCard>
                  </View>
                )}
              </View>

              {/* SECTION 2: BASIC INFO */}
              <View className="mb-6">
                <Text className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-3 ml-1">Projektdetails</Text>
                <GlassCard className="p-4 bg-black/40 border border-white/5 space-y-4">
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Projekttitel (z.B. PV Anlage Huber)... *"
                    placeholderTextColor="#4B5563"
                    className="bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white text-xs font-bold"
                  />
                  <TextInput
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Bauadresse..."
                    placeholderTextColor="#4B5563"
                    className="bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white text-xs"
                  />
                  <TextInput
                    value={budget}
                    onChangeText={setBudget}
                    placeholder="Budget (€)..."
                    placeholderTextColor="#4B5563"
                    keyboardType="numeric"
                    className="bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white text-xs"
                  />
                  
                  {/* Start & End Date triggers */}
                  <View className="flex-row gap-x-3">
                    <TouchableOpacity 
                      onPress={() => setShowStartDatePicker(true)}
                      className="flex-1 bg-black/30 border border-white/5 rounded-xl p-3 flex-row items-center justify-between"
                    >
                      <View>
                        <Text className="text-gray-500 text-[8px] font-bold uppercase">Geplanter Start</Text>
                        <Text className="text-white text-xs font-bold mt-0.5">{formatDate(startDate) || 'Wählen...'}</Text>
                      </View>
                      <Calendar size={14} color="#6B7280" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setShowEndDatePicker(true)}
                      className="flex-1 bg-black/30 border border-white/5 rounded-xl p-3 flex-row items-center justify-between"
                    >
                      <View>
                        <Text className="text-gray-500 text-[8px] font-bold uppercase">Geplantes Ende</Text>
                        <Text className="text-white text-xs font-bold mt-0.5">{formatDate(endDate) || 'Wählen...'}</Text>
                      </View>
                      <Calendar size={14} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  {showStartDatePicker && (
                    <DateTimePicker
                      value={new Date(startDate)}
                      mode="date"
                      display="default"
                      onChange={(event: any, selectedDate?: Date) => {
                        setShowStartDatePicker(false);
                        if (selectedDate) {
                          setStartDate(selectedDate.toISOString().split('T')[0]);
                        }
                      }}
                    />
                  )}
                  {showEndDatePicker && (
                    <DateTimePicker
                      value={new Date(endDate)}
                      mode="date"
                      display="default"
                      onChange={(event: any, selectedDate?: Date) => {
                        setShowEndDatePicker(false);
                        if (selectedDate) {
                          setEndDate(selectedDate.toISOString().split('T')[0]);
                        }
                      }}
                    />
                  )}

                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Projekt-Beschreibung / Notizen..."
                    placeholderTextColor="#4B5563"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    className="bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white text-xs min-h-[80px]"
                  />
                </GlassCard>
              </View>

              {/* SECTION 3: CLASSIFICATION */}
              <View className="mb-6">
                <Text className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-3 ml-1">Klassifizierung</Text>
                
                {/* Horizontal Scroll Categories */}
                <Text className="text-gray-500 text-[9px] font-bold uppercase tracking-widest mb-2 ml-1">Kategorie</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-3">
                  {categories.map((cat: any) => {
                    if (!cat || !cat.id) return null;
                    const isSelected = categoryId === cat.id.toString();
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => {
                          setCategoryId(cat.id.toString());
                          setSubcategoryId(''); // Reset subcat
                        }}
                        className={`px-3 py-2.5 rounded-xl mr-2 border flex-row items-center bg-black/40 ${isSelected ? 'border-brand-blue bg-brand-blue/15' : 'border-white/5'}`}
                      >
                        <Tag size={12} color={isSelected ? '#3B82F6' : '#6B7280'} className="mr-1.5" />
                        <Text className={`text-xs font-bold ${isSelected ? 'text-brand-blue' : 'text-gray-400'}`}>{cat.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Subcategories scroll if selected */}
                {selectedCategory?.subcategories?.length > 0 && (
                  <View>
                    <Text className="text-gray-500 text-[9px] font-bold uppercase tracking-widest mb-2 ml-1">Unterkategorie</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-2">
                      {selectedCategory.subcategories.map((sub: any) => {
                        if (!sub || !sub.id) return null;
                        const isSelected = subcategoryId === sub.id.toString();
                        return (
                          <TouchableOpacity
                            key={sub.id}
                            onPress={() => setSubcategoryId(sub.id.toString())}
                            className={`px-3 py-2 rounded-xl mr-2 border flex-row items-center bg-black/40 ${isSelected ? 'border-brand-blue bg-brand-blue/15' : 'border-white/5'}`}
                          >
                            <Text className={`text-[11px] font-bold ${isSelected ? 'text-brand-blue' : 'text-gray-400'}`}>{sub.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* SECTION 4: TEAM */}
              <View className="mb-6">
                <Text className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-3 ml-1">Team-Zuweisung</Text>
                
                {/* Projektleiter */}
                <Text className="text-gray-500 text-[9px] font-bold uppercase tracking-widest mb-2 ml-1">Projektleiter</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
                  <TouchableOpacity
                    onPress={() => setSelectedPL('')}
                    className={`px-3 py-2 rounded-xl mr-2 border flex-row items-center ${selectedPL === '' ? 'bg-white/10 border-white/20' : 'bg-transparent border-transparent'}`}
                  >
                    <Text className={`text-xs font-bold ${selectedPL === '' ? 'text-white' : 'text-gray-500'}`}>Keiner</Text>
                  </TouchableOpacity>
                  {plList.map((pl: any) => {
                    if (!pl || !pl.id) return null;
                    const isSelected = selectedPL === pl.id.toString();
                    return (
                      <TouchableOpacity
                        key={pl.id}
                        onPress={() => setSelectedPL(pl.id.toString())}
                        className={`px-3 py-2.5 rounded-xl mr-2 border flex-row items-center bg-black/40 ${isSelected ? 'border-brand-blue bg-brand-blue/15' : 'border-white/5'}`}
                      >
                        <UserCheck size={12} color={isSelected ? '#3B82F6' : '#6B7280'} className="mr-1.5" />
                        <Text className={`text-xs font-bold ${isSelected ? 'text-brand-blue' : 'text-gray-400'}`}>{pl.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Gruppenleiter */}
                <Text className="text-gray-500 text-[9px] font-bold uppercase tracking-widest mb-2 ml-1">Gruppenleiter</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
                  <TouchableOpacity
                    onPress={() => setSelectedGL('')}
                    className={`px-3 py-2 rounded-xl mr-2 border flex-row items-center ${selectedGL === '' ? 'bg-white/10 border-white/20' : 'bg-transparent border-transparent'}`}
                  >
                    <Text className={`text-xs font-bold ${selectedGL === '' ? 'text-white' : 'text-gray-500'}`}>Keiner</Text>
                  </TouchableOpacity>
                  {glList.map((gl: any) => {
                    if (!gl || !gl.id) return null;
                    const isSelected = selectedGL === gl.id.toString();
                    return (
                      <TouchableOpacity
                        key={gl.id}
                        onPress={() => setSelectedGL(gl.id.toString())}
                        className={`px-3 py-2.5 rounded-xl mr-2 border flex-row items-center bg-black/40 ${isSelected ? 'border-brand-blue bg-brand-blue/15' : 'border-white/5'}`}
                      >
                        <UserCheck size={12} color={isSelected ? '#3B82F6' : '#6B7280'} className="mr-1.5" />
                        <Text className={`text-xs font-bold ${isSelected ? 'text-brand-blue' : 'text-gray-400'}`}>{gl.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Workers (Multi-Select) */}
                <Text className="text-gray-500 text-[9px] font-bold uppercase tracking-widest mb-2 ml-1">Mitarbeiter (Workers)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
                  {workerList.map((w: any) => {
                    if (!w || !w.id) return null;
                    const isSelected = selectedWorkers.includes(w.id.toString());
                    return (
                      <TouchableOpacity
                        key={w.id}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedWorkers(prev => prev.filter(id => id !== w.id.toString()));
                          } else {
                            setSelectedWorkers(prev => [...prev, w.id.toString()]);
                          }
                        }}
                        className={`px-3 py-2.5 rounded-xl mr-2 border flex-row items-center bg-black/40 ${isSelected ? 'border-brand-blue bg-brand-blue/15' : 'border-white/5'}`}
                      >
                        <Users size={12} color={isSelected ? '#3B82F6' : '#6B7280'} className="mr-1.5" />
                        <Text className={`text-xs font-bold ${isSelected ? 'text-brand-blue' : 'text-gray-400'}`}>{w.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* SECTION 5: SUBCONTRACTORS */}
              <View className="mb-6">
                <Text className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-3 ml-1">Nachunternehmer</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-2">
                  {subcontractors.map((sub: any) => {
                    if (!sub || !sub.id) return null;
                    const isSelected = selectedSubcontractors.includes(sub.id);
                    return (
                      <TouchableOpacity
                        key={sub.id}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedSubcontractors(prev => prev.filter(id => id !== sub.id));
                          } else {
                            setSelectedSubcontractors(prev => [...prev, sub.id]);
                          }
                        }}
                        className={`px-3 py-2.5 rounded-xl mr-2 border flex-row items-center bg-black/40 ${isSelected ? 'border-brand-blue bg-brand-blue/15' : 'border-white/5'}`}
                      >
                        <Building2 size={12} color={isSelected ? '#3B82F6' : '#6B7280'} className="mr-1.5" />
                        <Text className={`text-xs font-bold ${isSelected ? 'text-brand-blue' : 'text-gray-400'}`}>{sub.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View className="h-10" />
            </ScrollView>

            <TouchableOpacity 
              onPress={handleSaveProject}
              disabled={createProjectMutation.isPending}
              className="bg-brand-blue py-4 rounded-2xl items-center shadow-lg shadow-blue-500/30 flex-row justify-center"
            >
              {createProjectMutation.isPending ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <CheckCircle2 size={20} color="white" className="mr-3" />
                  <Text className="text-white font-bold uppercase tracking-widest">
                    Projekt erstellen
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </GlassCard>
        </BlurView>
      </Modal>
    </ScreenLayout>
  );
}

