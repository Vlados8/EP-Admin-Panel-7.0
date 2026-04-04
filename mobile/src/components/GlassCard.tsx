import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}

export const GlassCard = ({ children, className = '', ...props }: GlassCardProps) => {
  return (
    <View 
      className={`bg-white/5 border border-white/10 rounded-3xl overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </View>
  );
};
