import React, { useState, useEffect } from 'react';
import { View, Text, Switch, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenLayout } from '../components/ScreenLayout';
import { GlassCard } from '../components/GlassCard';
import { ChevronLeft, Mail, MessageSquare, FileText, CheckSquare, Phone } from 'lucide-react-native';
import { apiClient } from '../api/client';

const channels = [
  { 
    type: 'email', 
    name: 'E-Mails erhalten', 
    desc: 'Benachrichtigung bei neuen eingehenden E-Mails.', 
    icon: Mail, 
    iconColor: '#EAB308' 
  },
  { 
    type: 'chat', 
    name: 'Chat-Nachrichten', 
    desc: 'Benachrichtigung bei Direkt- und Gruppennachrichten.', 
    icon: MessageSquare, 
    iconColor: '#A855F7' 
  },
  { 
    type: 'note', 
    name: 'Bautagebuch (Notizen)', 
    desc: 'Erinnerung an fällige Bautagebuch-Notizen.', 
    icon: FileText, 
    iconColor: '#22C55E' 
  },
  { 
    type: 'task', 
    name: 'Aufgaben-Fälligkeit', 
    desc: 'Zuweisung neuer Aufgaben sowie fällige Fristen.', 
    icon: CheckSquare, 
    iconColor: '#3B82F6' 
  },
  { 
    type: 'call', 
    name: 'Telefonate & Anrufe', 
    desc: 'Mitteilung bei eingehenden Audio- und Videogesprächen.', 
    icon: Phone, 
    iconColor: '#EF4444' 
  }
];

export default function NotificationSettingsScreen() {
  const navigation = useNavigation();
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiClient.get('/notifications/settings');
      const dbSettings = res.data?.data?.settings || [];
      
      const state: Record<string, boolean> = {};
      channels.forEach(ch => {
        const match = dbSettings.find((s: any) => s.type === ch.type);
        state[ch.type] = match ? match.enabled : true;
      });
      
      setToggles(state);
    } catch (err) {
      console.error('[NotificationSettingsScreen] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (type: string, value: boolean) => {
    // Optimistic UI state update
    setToggles(prev => ({ ...prev, [type]: value }));
    try {
      await apiClient.post('/notifications/settings', { type, enabled: value });
    } catch (err) {
      console.error('[NotificationSettingsScreen] Save error:', err);
      // Revert state on error
      setToggles(prev => ({ ...prev, [type]: !value }));
    }
  };

  return (
    <ScreenLayout>
      <View className="mb-6 flex-row items-center">
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          className="mr-4 p-2 bg-white/10 rounded-full"
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white font-bold text-2xl flex-1">
          Mitteilungen
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <Text className="text-gray-400 text-sm mb-6 leading-relaxed">
          Bestimmen Sie hier, über welche Bautätigkeiten Sie per Push-Mitteilung auf diesem Smartphone benachrichtigt werden möchten.
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" className="mt-12" />
        ) : (
          <View className="mb-10">
            {channels.map(ch => {
              const Icon = ch.icon;
              return (
                <GlassCard key={ch.type} className="p-5 flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center flex-1 mr-4">
                    <View className="w-11 h-11 rounded-xl bg-white/5 items-center justify-center mr-4 border border-white/10">
                      <Icon size={20} color={ch.iconColor} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-bold text-sm">{ch.name}</Text>
                      <Text className="text-gray-400 text-[10px] mt-1 leading-relaxed">{ch.desc}</Text>
                    </View>
                  </View>
                  <Switch
                    value={toggles[ch.type] ?? true}
                    onValueChange={(val) => handleToggle(ch.type, val)}
                    trackColor={{ false: '#3E3E3E', true: '#2563EB' }}
                    thumbColor="white"
                  />
                </GlassCard>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
