import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Play, Pause } from 'lucide-react-native';
import { Audio } from 'expo-av';

export default function AudioPlayer({ audioUri, isOwn }: { audioUri: string, isOwn: boolean }) {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);

    useEffect(() => {
        return sound
            ? () => {
                  sound.unloadAsync();
              }
            : undefined;
    }, [sound]);

    const playPauseSound = async () => {
        if (!sound) {
            setIsLoading(true);
            try {
                const { sound: newSound } = await Audio.Sound.createAsync(
                    { uri: audioUri },
                    { shouldPlay: true },
                    onPlaybackStatusUpdate
                );
                setSound(newSound);
                setIsPlaying(true);
            } catch (err) {
                console.error('Failed to load sound', err);
            } finally {
                setIsLoading(false);
            }
        } else {
            if (isPlaying) {
                await sound.pauseAsync();
                setIsPlaying(false);
            } else {
                if (position >= duration && duration > 0) {
                    await sound.replayAsync();
                } else {
                    await sound.playAsync();
                }
                setIsPlaying(true);
            }
        }
    };

    const onPlaybackStatusUpdate = (status: any) => {
        if (status.isLoaded) {
            setDuration(status.durationMillis || 0);
            setPosition(status.positionMillis || 0);
            if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(status.durationMillis || 0);
            }
        }
    };

    const formatTime = (millis: number) => {
        if (isNaN(millis) || millis < 0) return '0:00';
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;

    return (
        <View className="flex-row items-center min-w-[150px]">
            <TouchableOpacity onPress={playPauseSound} disabled={isLoading} className="mr-3">
                {isLoading ? (
                    <ActivityIndicator size="small" color={isOwn ? '#fff' : '#3B82F6'} />
                ) : isPlaying ? (
                    <Pause size={24} color={isOwn ? '#fff' : '#3B82F6'} fill={isOwn ? '#fff' : '#3B82F6'} />
                ) : (
                    <Play size={24} color={isOwn ? '#fff' : '#3B82F6'} fill={isOwn ? '#fff' : '#3B82F6'} />
                )}
            </TouchableOpacity>

            <View className="flex-1">
                <View className="h-1 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden w-full">
                    <View 
                        className={`h-full ${isOwn ? 'bg-white' : 'bg-blue-500'} rounded-full`} 
                        style={{ width: `${progressPercentage}%` }} 
                    />
                </View>
                <View className="flex-row justify-between mt-1">
                    <Text className={`text-[10px] ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                        {formatTime(position)}
                    </Text>
                    {duration > 0 && (
                        <Text className={`text-[10px] ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                            {formatTime(duration)}
                        </Text>
                    )}
                </View>
            </View>
        </View>
    );
}
