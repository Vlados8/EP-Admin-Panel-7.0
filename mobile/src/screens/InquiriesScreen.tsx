import React, { useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl 
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchInquiries } from '../api/inquiries';
import { ScreenLayout } from '../components/ScreenLayout';
import { GlassCard } from '../components/GlassCard';
import { 
  ClipboardList, 
  ChevronRight, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle,
  Briefcase
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'OPEN':
    case 'OFFEN':
      return '#3B82F6'; // Blue
    case 'IN_PROGRESS':
    case 'IN ARBEIT':
      return '#F59E0B'; // Orange
    case 'COMPLETED':
    case 'ERLEDIGT':
    case 'ABGESCHLOSSEN':
      return '#10B981'; // Green
    case 'CANCELLED':
    case 'STORNIERT':
      return '#EF4444'; // Red
    default:
      return '#6B7280'; // Gray
  }
};

const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'OPEN':
      case 'OFFEN':
        return <HelpCircle size={14} color="#3B82F6" />;
      case 'IN_PROGRESS':
      case 'IN ARBEIT':
        return <Clock size={14} color="#F59E0B" />;
      case 'COMPLETED':
      case 'ERLEDIGT':
      case 'ABGESCHLOSSEN':
        return <CheckCircle2 size={14} color="#10B981" />;
      default:
        return <AlertCircle size={14} color="#6B7280" />;
    }
};

export default function InquiriesScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);

  const { data: inquiries, isLoading, refetch } = useQuery({
    queryKey: ['inquiries'],
    queryFn: fetchInquiries,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const InquiryCard = ({ inquiry }: { inquiry: any }) => {
    const statusColor = getStatusColor(inquiry.status);
    
    return (
      <TouchableOpacity 
        activeOpacity={0.8} 
        onPress={() => navigation.navigate('InquiryDetail', { id: inquiry.id })}
        className="mb-4"
      >
        <GlassCard className="p-5 flex-row items-center border-l-4" style={{ borderLeftColor: statusColor }}>
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center bg-white/5 px-2 py-1 rounded-lg">
                {getStatusIcon(inquiry.status)}
                <Text className="text-[10px] font-bold ml-1 uppercase tracking-widest" style={{ color: statusColor }}>
                  {inquiry.status || 'OFFEN'}
                </Text>
              </View>
              <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                {new Date(inquiry.createdAt).toLocaleDateString('de-DE')}
              </Text>
            </View>

            <Text className="text-white font-bold text-lg mb-1">
              {inquiry.client_name || inquiry.name || 'Unbekannter Interessent'}
            </Text>

            <View className="flex-row items-center">
               <User size={12} color="#6B7280" />
               <Text className="text-gray-500 text-xs ml-2" numberOfLines={1}>
                 {inquiry.client_email || inquiry.email}
               </Text>
            </View>

            {inquiry.project_number && (
               <View className="flex-row items-center mt-2 bg-emerald-500/10 self-start px-2 py-1 rounded-md border border-emerald-500/20">
                 <Briefcase size={12} color="#10B981" />
                 <Text className="text-emerald-400 text-[10px] font-bold ml-1 uppercase">
                   PROJEKT: {inquiry.project_number}
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
            <Text className="text-white font-bold text-2xl uppercase tracking-widest">Anfragen</Text>
        </View>
        <Text className="text-gray-500 font-bold text-sm">{(inquiries || []).length} GESAMT</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      ) : (
        <FlatList
          data={inquiries}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <InquiryCard inquiry={item} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3B82F6"
              colors={['#3B82F6']}
            />
          }
          ListEmptyComponent={
            <GlassCard className="p-10 items-center">
              <ClipboardList size={40} color="#374151" className="mb-3" />
              <Text className="text-gray-400 text-center uppercase text-xs font-bold tracking-widest">
                Keine Anfragen gefunden
              </Text>
            </GlassCard>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenLayout>
  );
}
