import React from 'react';
import { SafeAreaView, StatusBar, View, ScrollView, RefreshControl } from 'react-native';

interface ScreenLayoutProps {
  children: React.ReactNode;
  scroll?: boolean;
  className?: string;
  padding?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export const ScreenLayout = ({ 
  children, 
  scroll = true, 
  className = '',
  padding = true,
  refreshing = false,
  onRefresh
}: ScreenLayoutProps) => {
  const ContentWrapper = scroll ? ScrollView : View;

  return (
    <SafeAreaView className="flex-1 bg-[#0a0a0c]">
      <StatusBar barStyle="light-content" />
      <ContentWrapper 
        className={`flex-1 ${padding ? 'px-6 py-4' : ''} ${className}`}
        contentContainerStyle={scroll ? { flexGrow: 1 } : undefined}
        refreshControl={
          scroll && onRefresh ? (
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor="#3B82F6"
              colors={['#3B82F6']}
            />
          ) : undefined
        }
      >
        {children}
      </ContentWrapper>
    </SafeAreaView>
  );
};
