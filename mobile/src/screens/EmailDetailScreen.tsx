import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchEmailById } from '../api/emails';
import { ScreenLayout } from '../components/ScreenLayout';
import { GlassCard } from '../components/GlassCard';
import { Mail, Calendar, User, ChevronLeft, Paperclip } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function EmailDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params as { id: number };
  const { width } = useWindowDimensions();

  const { data: email, isLoading } = useQuery({
    queryKey: ['email', id],
    queryFn: () => fetchEmailById(id),
  });

  if (isLoading) {
    return (
      <ScreenLayout>
        <ActivityIndicator size="large" color="#3B82F6" className="mt-20" />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <View className="mb-6 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4 p-2 bg-white/10 rounded-full">
          <ChevronLeft size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white font-bold text-2xl flex-1" numberOfLines={1}>
          E-Mail Details
        </Text>
      </View>

      <GlassCard className="p-6 mb-6">
        <Text className="text-white font-bold text-xl mb-4">{email?.subject || '(Kein Betreff)'}</Text>
        
        <View className="flex-row items-center mb-3">
          <User size={16} color="#6B7280" />
          <Text className="text-gray-400 text-xs ml-2">Von: </Text>
          <Text className="text-brand-blue text-xs font-bold">{email?.fromName || email?.fromEmail || 'Unbekannt'}</Text>
        </View>

        <View className="flex-row items-center mb-3">
          <Calendar size={16} color="#6B7280" />
          <Text className="text-gray-400 text-xs ml-2">Datum: </Text>
          <Text className="text-white text-xs">
            {email?.createdAt ? new Date(email.createdAt).toLocaleString('de-DE') : '-'}
          </Text>
        </View>

        {email?.attachments?.length > 0 && (
          <View className="flex-row items-center mt-2 p-2 bg-white/5 rounded-lg">
            <Paperclip size={14} color="#3B82F6" />
            <Text className="text-brand-blue text-[10px] font-bold ml-2">
              {email.attachments.length} ANHÄNGE
            </Text>
          </View>
        )}
      </GlassCard>

      <View className="mb-10">
        <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-3 ml-1">Inhalt</Text>
        <GlassCard className="p-4">
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                <Text className="text-gray-300 text-sm leading-relaxed">
                    {email?.body || email?.content || 'Kein Inhalt vorhanden.'}
                </Text>
            </ScrollView>
        </GlassCard>
      </View>
    </ScreenLayout>
  );
}
