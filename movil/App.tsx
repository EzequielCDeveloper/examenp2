import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InboxScreen } from './src/screens/InboxScreen';
import { CasesScreen } from './src/screens/CasesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { getDb, getUnreadCount } from './src/services/db';
import { registerForPushNotificationsAsync } from './src/services/notifications';
import { startSchedulerDaemon, registerBackgroundFetchAsync } from './src/services/scheduler';

type Tab = 'inbox' | 'cases' | 'settings';

function MainApp() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    getDb().then(() => {
      refreshCount();
    });
    registerForPushNotificationsAsync();

    // Register background sync task with Android WorkManager
    registerBackgroundFetchAsync();

    // Start in-app exact-minute daemon for when app is in foreground
    const stopDaemon = startSchedulerDaemon((summary) => {
      console.log('[MainApp] Consulta automática finalizada:', summary);
      refreshCount();
    });

    return () => {
      stopDaemon();
    };
  }, []);

  const refreshCount = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.warn('Error reading unread count from SQLite:', err);
    }
  };

  return (
    <View style={[styles.rootContainer, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Main Content Area */}
      <View style={styles.content}>
        {activeTab === 'inbox' && <InboxScreen />}
        {activeTab === 'cases' && <CasesScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </View>

      {/* Bottom Tab Bar with Inset Padding */}
      <View
        style={[
          styles.tabBar,
          {
            paddingBottom: Math.max(insets.bottom, 10),
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: Math.max(insets.right, 16),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'inbox' && styles.tabItemActive]}
          onPress={() => {
            setActiveTab('inbox');
            refreshCount();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <Ionicons
              name={activeTab === 'inbox' ? 'file-tray-full' : 'file-tray-full-outline'}
              size={20}
              color={activeTab === 'inbox' ? '#38BDF8' : '#94A3B8'}
            />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.tabLabel, activeTab === 'inbox' && styles.tabLabelActive]}>
            Novedades
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'cases' && styles.tabItemActive]}
          onPress={() => {
            setActiveTab('cases');
            refreshCount();
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'cases' ? 'folder-open' : 'folder-open-outline'}
            size={20}
            color={activeTab === 'cases' ? '#38BDF8' : '#94A3B8'}
          />
          <Text style={[styles.tabLabel, activeTab === 'cases' && styles.tabLabelActive]}>
            Expedientes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
          onPress={() => {
            setActiveTab('settings');
            refreshCount();
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'settings' ? 'settings' : 'settings-outline'}
            size={20}
            color={activeTab === 'settings' ? '#38BDF8' : '#94A3B8'}
          />
          <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>
            Ajustes
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#0F172A', // slate-900 status bar area
  },
  content: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0F172A', // slate-900
    borderTopWidth: 1,
    borderTopColor: '#1E293B', // slate-800
    paddingTop: 8,
    justifyContent: 'space-around',
  },
  tabItem: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#1E293B',
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#38BDF8', // sky-400
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#0284C7', // sky-600
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
