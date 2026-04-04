import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTaskById, updateTaskStatus } from '../api/tasks';
import { ScreenLayout } from '../components/ScreenLayout';
import { GlassCard } from '../components/GlassCard';
import { CheckSquare, Circle, Clock, User, ChevronLeft, MapPin } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function TaskDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const queryClient = useQueryClient();
  const { id } = route.params as { id: number };

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => fetchTaskById(id),
  });

  const mutation = useMutation({
    mutationFn: (status: string) => updateTaskStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  if (isLoading) {
    return (
      <ScreenLayout>
        <ActivityIndicator size="large" color="#3B82F6" className="mt-20" />
      </ScreenLayout>
    );
  }

  const isCompleted = task?.status === 'COMPLETED' || task?.status === 'ERLEDIGT';

  return (
    <ScreenLayout>
      <View className="mb-6 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4 p-2 bg-white/10 rounded-full">
          <ChevronLeft size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white font-bold text-2xl flex-1" numberOfLines={1}>
          {task?.title || task?.name || 'Task Details'}
        </Text>
      </View>

      <GlassCard className={`p-6 mb-6 border-l-4 ${isCompleted ? 'border-l-green-500' : 'border-l-brand-blue'}`}>
        <TouchableOpacity 
          onPress={() => mutation.mutate(isCompleted ? 'IN_PROGRESS' : 'COMPLETED')}
          className="flex-row items-center mb-6"
        >
          <View className={`p-3 rounded-2xl mr-4 ${isCompleted ? 'bg-green-500/20' : 'bg-brand-blue/20'}`}>
            {isCompleted ? (
              <CheckSquare size={24} color="#10B981" />
            ) : (
              <Circle size={24} color="#3B82F6" />
            )}
          </View>
          <View>
            <Text className="text-gray-400 text-[10px] uppercase font-bold tracking-widest">Status</Text>
            <Text className={`font-bold text-lg ${isCompleted ? 'text-green-400' : 'text-brand-blue'}`}>
              {isCompleted ? 'ERLEDIGT' : 'IN BEARBEITUNG'}
            </Text>
          </View>
        </TouchableOpacity>

        <View className="flex-row justify-between border-t border-white/10 pt-4">
            <View className="flex-1">
                <View className="flex-row items-center mb-1">
                    <Clock size={14} color="#6B7280" />
                    <Text className="text-gray-500 text-[10px] ml-1 uppercase font-bold">Frist</Text>
                </View>
                <Text className="text-white text-sm">
                    {task?.dueDate ? new Date(task.dueDate).toLocaleDateString('de-DE') : 'Keine'}
                </Text>
            </View>
            <View className="flex-1 ml-4">
                <View className="flex-row items-center mb-1">
                    <MapPin size={14} color="#6B7280" />
                    <Text className="text-gray-500 text-[10px] ml-1 uppercase font-bold">Priorität</Text>
                </View>
                <Text className="text-white text-sm uppercase font-bold">
                    {task?.priority || 'NORMAL'}
                </Text>
            </View>
        </View>
      </GlassCard>

      <View className="mb-4">
        <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-3 ml-1">Beschreibung</Text>
        <GlassCard className="p-4 min-h-[100px]">
            <Text className="text-gray-300 text-sm leading-relaxed">
                {task?.description || 'Keine Beschreibung vorhanden.'}
            </Text>
        </GlassCard>
      </View>
    </ScreenLayout>
  );
}
