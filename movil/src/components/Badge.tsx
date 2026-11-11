import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type BadgeVariant = 'info' | 'warning' | 'neutral' | 'success' | 'danger';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: any;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', style }) => {
  return (
    <View style={[styles.badge, styles[variant], style]}>
      <Text style={[styles.text, textStyles[variant]]}>{children}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  info: {
    backgroundColor: '#E0F2FE', // sky-100
    borderWidth: 1,
    borderColor: '#BAE6FD', // sky-200
  },
  warning: {
    backgroundColor: '#FEF3C7', // amber-100
    borderWidth: 1,
    borderColor: '#FDE68A', // amber-200
  },
  neutral: {
    backgroundColor: '#F1F5F9', // slate-100
    borderWidth: 1,
    borderColor: '#E2E8F0', // slate-200
  },
  success: {
    backgroundColor: '#DCFCE7', // emerald-100
    borderWidth: 1,
    borderColor: '#BBF7D0', // emerald-200
  },
  danger: {
    backgroundColor: '#FEE2E2', // rose-100
    borderWidth: 1,
    borderColor: '#FECDD3', // rose-200
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

const textStyles = StyleSheet.create({
  info: {
    color: '#0369A1', // sky-700
  },
  warning: {
    color: '#B45309', // amber-700
  },
  neutral: {
    color: '#475569', // slate-600
  },
  success: {
    color: '#15803D', // emerald-700
  },
  danger: {
    color: '#B91C1C', // rose-700
  },
});
