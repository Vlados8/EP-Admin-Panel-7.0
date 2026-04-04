import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  TextInput,
  Image,
  Dimensions
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchProjects } from '../api/projects';
import { ScreenLayout } from '../components/ScreenLayout';
import { GlassCard } from '../components/GlassCard';
import { 
  Briefcase, 
  ChevronRight, 
  Calendar, 
  Search, 
  X,
  MapPin,
  Users
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { serverDomain } from '../api/client';

export default function ProjectsScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: projectsData, isLoading, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

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
        <Text className="text-gray-600 font-bold text-[10px] uppercase tracking-widest">{filteredProjects?.length || 0} GESAMT</Text>
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
    </ScreenLayout>
  );
}

