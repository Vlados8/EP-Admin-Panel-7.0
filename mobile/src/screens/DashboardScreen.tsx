import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ScreenLayout } from '../components/ScreenLayout';
import { GlassCard } from '../components/GlassCard';
import { useQuery } from '@tanstack/react-query';
import { fetchSummary, fetchRecentActivity } from '../api/dashboard';
import { 
  CirclePlus, 
  SquareCheck, 
  Briefcase, 
  Mail, 
  LogOut,
  Bell,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  ClipboardList
} from 'lucide-react-native';

export default function DashboardScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: fetchSummary,
  });

  const { data: activities, isLoading: isActivityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ['recentActivity'],
    queryFn: fetchRecentActivity,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchActivity()]);
    setRefreshing(false);
  };

  const QuickAction = ({ icon: Icon, label, onPress, color = "#3B82F6" }: any) => (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.7}
      className="w-[48%] mb-4"
    >
      <GlassCard className="p-5 items-center justify-center h-32">
        <View className="p-3 rounded-2xl mb-3 bg-white/10">
          <Icon size={24} color={color} />
        </View>
        <Text className="text-white font-bold text-[10px] text-center uppercase tracking-widest">
          {label}
        </Text>
      </GlassCard>
    </TouchableOpacity>
  );

  const StatItem = ({ label, value, color = "text-white" }: any) => (
    <View className="items-center">
      <Text className={`text-2xl font-bold ${color}`}>{value || '0'}</Text>
      <Text className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">{label}</Text>
    </View>
  );

  return (
    <ScreenLayout>
      {/* Header */}
      <View className="flex-row justify-between items-center mb-10">
        <View>
          <Text className="text-gray-500 text-sm font-medium">Willkommen zurück,</Text>
          <Text className="text-2xl font-bold text-white uppercase tracking-tight">
            {user?.firstName || 'Mitarbeiter'}
          </Text>
        </View>
        <View className="flex-row gap-x-3">
          <TouchableOpacity className="bg-white/10 p-3 rounded-full border border-white/10">
            <Bell size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} className="bg-red-500/10 p-3 rounded-full border border-red-500/20">
            <LogOut size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      <GlassCard className="p-6 mb-8 flex-row justify-between">
        <StatItem label="Projekte" value={summary?.counts?.projects} />
        <View className="w-[1px] h-full bg-white/10" />
        <StatItem label="Aufgaben" value={summary?.counts?.tasks} color="text-brand-blue" />
        <View className="w-[1px] h-full bg-white/10" />
        <StatItem label="Kunden" value={summary?.counts?.customers} />
      </GlassCard>

      {/* Quick Actions Title */}
      <View className="flex-row items-center mb-6">
        <View className="w-1 h-6 bg-brand-blue rounded-full mr-3" />
        <Text className="text-white font-bold text-xl uppercase tracking-widest">Schnellzugriff</Text>
      </View>

      {/* Grid */}
      <View className="flex-row flex-wrap justify-between">
        <QuickAction 
          icon={CirclePlus} 
          label="Neue Notiz" 
          onPress={() => navigation.navigate('Notizen')} 
          color="#3B82F6"
        />
        <QuickAction 
          icon={SquareCheck} 
          label="Aufgaben" 
          onPress={() => navigation.navigate('Aufgaben')} 
          color="#10B981"
        />
        <QuickAction 
          icon={Briefcase} 
          label="Projekte" 
          onPress={() => navigation.navigate('Projekte')} 
          color="#F59E0B"
        />
        <QuickAction 
          icon={Mail} 
          label="E-Mail" 
          onPress={() => navigation.navigate('Main', { screen: 'E-Mail' })} 
          color="#8B5CF6"
        />
      </View>

      {/* Recent Activity */}
      <View className="mt-4 mb-10">
        <View className="flex-row items-center mb-6">
          <View className="w-1 h-6 bg-gray-500 rounded-full mr-3" />
          <Text className="text-white font-bold text-xl uppercase tracking-widest">Letzte Aktivität</Text>
        </View>
        <GlassCard className="p-6">
          <View className="flex-row items-center justify-center py-4">
            <Clock size={20} color="#6B7280" className="mr-3" />
            <Text className="text-gray-500 text-sm italic ml-3">
              Keine aktuellen Benachrichtigungen.
            </Text>
          </View>
        </GlassCard>
      </View>
    </ScreenLayout>
  );
}
