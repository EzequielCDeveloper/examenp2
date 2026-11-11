import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  WatchAgreement,
  getCachedAgreements,
  saveCachedAgreements,
  checkScraperHealth,
} from './src/services/api';
import { watchEvents } from 'react-native-wear-connectivity';

export default function App() {
  const [agreements, setAgreements] = useState<WatchAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const isOnline = await checkScraperHealth();
      setConnected(isOnline);

      const cached = await getCachedAgreements();
      setAgreements(cached);
    } catch (e) {
      console.warn('Watch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Request critical runtime permissions for Wearable Data Layer and FGS (Android 12+ / 14+)
    const requestPermissions = async () => {
      if (Platform.OS === 'android') {
        try {
          const perms: any[] = [];
          if (Platform.Version >= 31) {
            perms.push(
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE
            );
          }
          if (Platform.Version >= 33) {
            perms.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
          }
          if (perms.length > 0) {
            await PermissionsAndroid.requestMultiple(perms);
          }
        } catch (err) {
          console.warn('[Watch] Error al solicitar permisos:', err);
        }
      }
    };
    requestPermissions();

    loadData();

    // Listen to Wearable Data Layer messages from mobile
    let unsubscribe: Function | undefined;
    try {
      unsubscribe = watchEvents.on('message', (message: any) => {
        console.log('[Watch] Mensaje recibido vía Wearable Data Layer:', message);
        if (!message) return;

        if (message.id_detalle && message.expediente) {
          const item: WatchAgreement = {
            id_detalle: String(message.id_detalle),
            expediente: String(message.expediente),
            alias: String(message.alias || 'Acuerdo'),
            fecha: String(message.fecha || new Date().toLocaleDateString('es-MX')),
            sintesis: String(message.sintesis || message.body || ''),
            is_modified: Boolean(message.is_modified),
          };
          setAgreements((prev) => {
            const exists = prev.some((a) => a.id_detalle === item.id_detalle);
            const updated = exists
              ? prev.map((a) => (a.id_detalle === item.id_detalle ? item : a))
              : [item, ...prev];
            saveCachedAgreements(updated);
            return updated;
          });
        } else if (message.title || message.body) {
          const item: WatchAgreement = {
            id_detalle: 'msg_' + Date.now(),
            expediente: String(message.title || 'Alerta'),
            alias: String(message.alias || 'Móvil'),
            fecha: new Date().toLocaleDateString('es-MX', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
            sintesis: String(message.body || message.text || ''),
            is_modified: false,
          };
          setAgreements((prev) => {
            const updated = [item, ...prev];
            saveCachedAgreements(updated);
            return updated;
          });
        }
      });
    } catch (err) {
      console.warn('[Watch] Error al registrar listener de Wearable:', err);
    }

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [loadData]);

  const handleDismiss = async (id_detalle: string) => {
    const updated = agreements.filter((a) => a.id_detalle !== id_detalle);
    setAgreements(updated);
    await saveCachedAgreements(updated);
  };

  const handleClearAll = async () => {
    setAgreements([]);
    await saveCachedAgreements([]);
  };

  const handleSimulateAlert = async () => {
    const testItem: WatchAgreement = {
      id_detalle: 'demo_' + Date.now(),
      expediente: 'Exp. 18/2026',
      alias: 'Toca Civil Sonora',
      fecha: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      sintesis: 'Se tiene por recibido oficio de Sala Regional. Se agrega a los autos para surtir efectos legales conducentes.',
      is_modified: false,
    };
    const updated = [testItem, ...agreements];
    setAgreements(updated);
    await saveCachedAgreements(updated);
  };

  const renderItem = ({ item }: { item: WatchAgreement }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardAlias} numberOfLines={1}>
            {item.alias || 'Expediente'}
          </Text>
          <Text style={styles.cardExpediente}>{item.expediente}</Text>
        </View>

        <Text style={styles.cardDate}>{item.fecha}</Text>

        <Text style={styles.cardSintesis} numberOfLines={3}>
          {item.sintesis}
        </Text>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => handleDismiss(item.id_detalle)}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>Descartar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.watchBezel}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>STJ COMPANION</Text>
          <View style={[styles.statusDot, { backgroundColor: connected ? '#22C55E' : '#EF4444' }]} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color="#38BDF8" />
            <Text style={styles.loadingText}>Conectando...</Text>
          </View>
        ) : agreements.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyCircle} />
            <Text style={styles.emptyTitle}>Al día</Text>
            <Text style={styles.emptyText}>
              {connected
                ? 'Mini-scraper conectado.\nSin alertas pendientes.'
                : 'Scraper desconectado.\nRevisa tu red.'}
            </Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.refreshBtn} onPress={loadData} activeOpacity={0.8}>
                <Text style={styles.refreshBtnText}>Verificar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.simulateBtn} onPress={handleSimulateAlert} activeOpacity={0.8}>
                <Text style={styles.simulateBtnText}>Simular</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <FlatList
            data={agreements}
            keyExtractor={(item) => item.id_detalle}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
            ListFooterComponent={
              agreements.length > 1 ? (
                <TouchableOpacity style={styles.clearAllBtn} onPress={handleClearAll}>
                  <Text style={styles.clearAllText}>Limpiar Todos</Text>
                </TouchableOpacity>
              ) : undefined
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  watchBezel: {
    flex: 1,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  appTitle: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listContainer: {
    width: '100%',
    paddingBottom: 20,
    gap: 8,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardAlias: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: 'bold',
    flex: 1,
  },
  cardExpediente: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
  },
  cardDate: {
    color: '#94A3B8',
    fontSize: 10,
    marginBottom: 4,
  },
  cardSintesis: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 8,
  },
  actionBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  clearAllBtn: {
    backgroundColor: '#334155',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  clearAllText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 6,
  },
  emptyCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#38BDF8',
    marginBottom: 6,
    opacity: 0.8,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  refreshBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  refreshBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  simulateBtn: {
    backgroundColor: '#0369A1',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  simulateBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
