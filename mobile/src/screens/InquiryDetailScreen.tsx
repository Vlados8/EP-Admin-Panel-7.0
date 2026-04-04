import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Linking, 
  Alert,
  Modal
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchInquiryById, updateInquiryStatus } from '../api/inquiries';
import { ScreenLayout } from '../components/ScreenLayout';
import { GlassCard } from '../components/GlassCard';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ExternalLink,
  Briefcase,
  ChevronDown
} from 'lucide-react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

const STATUS_MAP: Record<string, string> = {
  'NEW': 'Offen',
  'OFFEN': 'Offen',
  'OPEN': 'Offen',
  'IN_PROGRESS': 'In Arbeit',
  'IN ARBEIT': 'In Arbeit',
  'COMPLETED': 'Erledigt',
  'ERLEDIGT': 'Erledigt',
  'CANCELLED': 'Storniert',
  'STORNIERT': 'Storniert'
};

const STATUS_COLORS: Record<string, string> = {
  'OFFEN': '#3B82F6',
  'IN ARBEIT': '#F59E0B',
  'ERLEDIGT': '#10B981',
  'STORNIERT': '#EF4444'
};

export default function InquiryDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { id } = route.params;

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const { data: inquiry, isLoading } = useQuery({
    queryKey: ['inquiry', id],
    queryFn: () => fetchInquiryById(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateInquiryStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiry', id] });
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
      setIsStatusModalOpen(false);
    },
  });

  if (isLoading || !inquiry) {
    return (
      <ScreenLayout>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      </ScreenLayout>
    );
  }

  const currentStatus = STATUS_MAP[inquiry.status?.toUpperCase()] || 'Offen';
  const statusColor = STATUS_COLORS[currentStatus.toUpperCase()] || '#6B7280';

  const InfoRow = ({ icon: Icon, label, value, onPress }: any) => (
    <TouchableOpacity 
      disabled={!onPress} 
      onPress={onPress}
      className={`flex-row items-center p-4 bg-white/5 rounded-2xl mb-3 border border-white/5 ${onPress ? 'active:bg-white/10' : ''}`}
    >
      <View className="w-10 h-10 rounded-xl bg-brand-blue/10 items-center justify-center mr-4">
        <Icon size={20} color="#3B82F6" />
      </View>
      <View className="flex-1">
        <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">{label}</Text>
        <Text className="text-white font-medium text-sm">{value || 'Nicht angegeben'}</Text>
      </View>
      {onPress && <ExternalLink size={16} color="#4B5563" />}
    </TouchableOpacity>
  );

  return (
    <ScreenLayout>
      <View className="mb-6 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => navigation.goBack()} className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-white/5 items-center justify-center mr-3">
              <ChevronRight size={20} color="white" style={{ transform: [{ rotate: '180deg' }] }} />
            </View>
            <Text className="text-white font-bold text-xl uppercase tracking-widest">Detail</Text>
        </TouchableOpacity>
      </View>

      {/* Header Info */}
      <GlassCard className="p-6 mb-6">
        <View className="flex-row justify-between items-start mb-4">
          <View className="flex-1 mr-4">
            <Text className="text-white font-bold text-2xl mb-1">{inquiry.contact_name || inquiry.name}</Text>
            <View className="flex-row items-center">
              <Calendar size={12} color="#6B7280" />
              <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest ml-1">
                Eingegangen am {new Date(inquiry.createdAt).toLocaleDateString('de-DE')}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => setIsStatusModalOpen(true)}
            className="px-3 py-1.5 rounded-full border border-white/10 flex-row items-center"
            style={{ backgroundColor: `${statusColor}20` }}
          >
            <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: statusColor }} />
            <Text className="font-bold text-[10px] uppercase tracking-widest mr-1" style={{ color: statusColor }}>
              {currentStatus}
            </Text>
            <ChevronDown size={14} color={statusColor} />
          </TouchableOpacity>
        </View>

        {inquiry.project && (
           <TouchableOpacity 
             onPress={() => navigation.navigate('Projects', { screen: 'ProjectDetail', params: { id: inquiry.project.id } })}
             className="bg-emerald-500/20 border border-emerald-500/30 p-4 rounded-2xl flex-row items-center justify-between"
           >
             <View className="flex-row items-center">
               <Briefcase size={20} color="#10B981" />
               <View className="ml-3">
                 <Text className="text-emerald-400 font-bold text-sm">PROJEKT ERSTELLT</Text>
                 <Text className="text-white text-xs opacity-70">Nummer: {inquiry.project.project_number}</Text>
               </View>
             </View>
             <ChevronRight size={20} color="#10B981" />
           </TouchableOpacity>
        )}
      </GlassCard>

      {/* Contact Details */}
      <View className="mb-6">
        <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-3 ml-1">Kontaktinformationen</Text>
        <InfoRow 
          icon={Mail} 
          label="Email" 
          value={inquiry.contact_email || inquiry.email} 
          onPress={() => Linking.openURL(`mailto:${inquiry.contact_email || inquiry.email}`)}
        />
        <InfoRow 
          icon={Phone} 
          label="Telefon" 
          value={inquiry.contact_phone || inquiry.phone} 
          onPress={() => Linking.openURL(`tel:${inquiry.contact_phone || inquiry.phone}`)}
        />
        <InfoRow 
          icon={MapPin} 
          label="Standort" 
          value={inquiry.location} 
        />
      </View>

      {/* Answers / Details */}
      {inquiry.answers && inquiry.answers.length > 0 && (
        <View className="mb-6">
          <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-3 ml-1">Anfrage Details</Text>
          <GlassCard className="p-2">
            {inquiry.answers.map((answer: any, index: number) => (
              <View 
                key={answer.id} 
                className={`p-4 ${index !== inquiry.answers.length - 1 ? 'border-b border-white/5' : ''}`}
              >
                <Text className="text-gray-500 text-[10px] font-bold uppercase mb-1">
                  {answer.question?.question_text || 'Frage'}
                </Text>
                <Text className="text-white text-sm font-medium">
                  {answer.answer_value || 'Nicht beantwortet'}
                </Text>
              </View>
            ))}
          </GlassCard>
        </View>
      )}

      {/* Internal Notes */}
      <View className="mb-20">
        <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-3 ml-1">Interne Notizen</Text>
        <GlassCard className="p-5">
           <Text className="text-gray-300 text-sm leading-relaxed">
             {inquiry.notes || 'Keine internen Notizen vorhanden.'}
           </Text>
        </GlassCard>
      </View>

      {/* Status Selection Modal */}
      <Modal
        visible={isStatusModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsStatusModalOpen(false)}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setIsStatusModalOpen(false)}
          className="flex-1 bg-black/80 justify-center p-6"
        >
          <GlassCard className="p-6">
            <Text className="text-white font-bold text-lg mb-6 uppercase tracking-widest text-center">Status ändern</Text>
            {Object.keys(STATUS_COLORS).map((status) => (
              <TouchableOpacity
                key={status}
                onPress={() => statusMutation.mutate(status)}
                className="py-4 border-b border-white/5 flex-row items-center justify-between"
              >
                <View className="flex-row items-center">
                  <View className="w-3 h-3 rounded-full mr-4" style={{ backgroundColor: STATUS_COLORS[status] }} />
                  <Text className="text-white font-bold uppercase tracking-widest text-xs">{status}</Text>
                </View>
                {currentStatus.toUpperCase() === status && <CheckCircle2 size={18} color="#3B82F6" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity 
              onPress={() => setIsStatusModalOpen(false)}
              className="mt-6 py-4 items-center bg-white/5 rounded-2xl"
            >
              <Text className="text-gray-500 font-bold uppercase tracking-widest text-xs">Abbrechen</Text>
            </TouchableOpacity>
          </GlassCard>
        </TouchableOpacity>
      </Modal>
    </ScreenLayout>
  );
}
