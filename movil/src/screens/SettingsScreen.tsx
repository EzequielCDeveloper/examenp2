import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Badge } from '../components/Badge';
import { getScraperUrl, saveScraperUrl, syncActiveCasesWithScraper } from '../services/scraperApi';
import { scheduleLocalNotification } from '../services/notifications';
import { getAllCases, getAgreements, getSetting } from '../services/db';
import { validateUrl } from '../utils/validation';
import {
  ScheduleItem,
  getSchedules,
  addSchedule,
  removeSchedule,
  toggleSchedule,
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  getLastSyncInfo,
} from '../services/scheduler';

export const SettingsScreen: React.FC = () => {
  const [scraperUrl, setScraperUrl] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; latency?: number } | null>(null);
  const [stats, setStats] = useState({ casesCount: 0, agreementsCount: 0 });
  const [pushToken, setPushToken] = useState<string>('');

  // Scheduled querying state
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState(true);
  const [newScheduleTime, setNewScheduleTime] = useState('');
  const [newScheduleLabel, setNewScheduleLabel] = useState('');
  const [lastSyncInfo, setLastSyncInfo] = useState<{ timestamp: string | null; summary: any | null }>({
    timestamp: null,
    summary: null,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const url = await getScraperUrl();
    setScraperUrl(url);

    const cases = await getAllCases();
    const agreements = await getAgreements(false);
    setStats({ casesCount: cases.length, agreementsCount: agreements.length });

    const token = await getSetting('expo_push_token', '');
    setPushToken(token);

    const loadedSchedules = await getSchedules();
    setSchedules(loadedSchedules);

    const isAuto = await isAutoSyncEnabled();
    setAutoSyncEnabledState(isAuto);

    const syncInfo = await getLastSyncInfo();
    setLastSyncInfo(syncInfo);

    testConnection(url);
  };

  const handleToggleAutoSync = async (val: boolean) => {
    setAutoSyncEnabledState(val);
    await setAutoSyncEnabled(val);
  };

  const handleToggleScheduleItem = async (id: string, currentVal: boolean) => {
    const updated = await toggleSchedule(id, !currentVal);
    setSchedules(updated);
  };

  const handleDeleteSchedule = async (id: string) => {
    const updated = await removeSchedule(id);
    setSchedules(updated);
  };

  const handleAddSchedule = async () => {
    if (!newScheduleTime.trim()) {
      Alert.alert('Hora Requerida', 'Ingresa la hora en formato 24 horas (HH:MM), por ejemplo 09:30');
      return;
    }
    try {
      const updated = await addSchedule(newScheduleTime, newScheduleLabel);
      setSchedules(updated);
      setNewScheduleTime('');
      setNewScheduleLabel('');
    } catch (err: any) {
      Alert.alert('Aviso', err.message);
    }
  };

  const handleAddPreset = async (time: string, label: string) => {
    try {
      const updated = await addSchedule(time, label);
      setSchedules(updated);
    } catch (err: any) {
      Alert.alert('Aviso', err.message);
    }
  };

  const testConnection = async (targetUrl: string) => {
    setPinging(true);
    const start = Date.now();
    try {
      const res = await fetch(`${targetUrl.trim().replace(/\/+$/, '')}/health`, {
        signal: AbortSignal.timeout(6000),
      });
      const latency = Date.now() - start;
      setPingResult({ ok: res.ok, latency });
    } catch {
      setPingResult({ ok: false });
    } finally {
      setPinging(false);
    }
  };

  const handleSaveUrl = async () => {
    const vUrl = validateUrl(scraperUrl);
    if (!vUrl.valid) {
      Alert.alert('URL Inválida', vUrl.error);
      return;
    }
    const cleanUrl = scraperUrl.trim().replace(/\/+$/, '');
    setSavingUrl(true);
    try {
      await saveScraperUrl(cleanUrl);
      await testConnection(cleanUrl);
      Alert.alert('Configuración Actualizada', 'La URL del mini-scraper fue guardada.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingUrl(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await scheduleLocalNotification(
        'Alerta STJ: Exp. 18/2026',
        'Acuerdo publicado en Sala / Mesa Civil. Replicado al reloj.',
        { test: true }
      );
      Alert.alert('Alerta Emitida', 'Notificación local emitida correctamente. Verifica tu Smartwatch.');
    } catch (err: any) {
      console.error('Error al emitir notificación de prueba:', err);
      Alert.alert('Error', err.message || 'No se pudo emitir la notificación.');
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const summary = await syncActiveCasesWithScraper();
      await loadSettings();

      if (summary.errors.length > 0) {
        Alert.alert(
          'Sincronización con Advertencias',
          `Revisados: ${summary.casesChecked}\nNuevos: ${summary.newAgreements}\nModificados: ${summary.modifiedAgreements}\n\nDetalles:\n${summary.errors.join('\n')}`
        );
      } else {
        Alert.alert(
          'Sincronización Exitosa',
          `Expedientes revisados: ${summary.casesChecked}\nAcuerdos nuevos: ${summary.newAgreements}\nAcuerdos modificados: ${summary.modifiedAgreements}`
        );
      }
    } catch (err: any) {
      Alert.alert('Error de Sincronización', err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Configuración y Estado" subtitle="Arquitectura Local-First" />

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Architecture & DB Metrics */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="server-outline" size={16} color="#0284C7" />
            <Text style={styles.cardTitle}>Persistencia Local (SQLite 3)</Text>
          </View>
          <Text style={styles.cardDesc}>
            Esquema relacional local idéntico al motor de escritorio con soporte para revisiones y hash determinista.
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.casesCount}</Text>
              <Text style={styles.statLabel}>Expedientes</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.agreementsCount}</Text>
              <Text style={styles.statLabel}>Acuerdos en SQLite</Text>
            </View>
          </View>
        </View>

        {/* Cloud Mini-Scraper (Render) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="cloud-done-outline" size={16} color="#0284C7" />
            <Text style={styles.cardTitle}>Mini-Scraper en la Nube (Render)</Text>
            {pinging ? (
              <ActivityIndicator size="small" color="#0284C7" style={{ marginLeft: 'auto' }} />
            ) : pingResult?.ok ? (
              <Badge variant="success" style={{ marginLeft: 'auto' }}>
                En línea {pingResult.latency ? `(${pingResult.latency} ms)` : ''}
              </Badge>
            ) : (
              <Badge variant="danger" style={{ marginLeft: 'auto' }}>
                Desconectado
              </Badge>
            )}
          </View>
          <Text style={styles.cardDesc}>
            Endpoint centralizado que ejecuta peticiones al STJ Sonora con tasa regulada de 1,200 ms.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>URL DEL SERVICIO</Text>
            <TextInput
              style={[styles.input, styles.monoText]}
              placeholder="https://stj-miniscraper.onrender.com"
              placeholderTextColor="#94A3B8"
              value={scraperUrl}
              onChangeText={setScraperUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.rowButtons}>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => testConnection(scraperUrl)}
              disabled={pinging}
            >
              <Ionicons name="wifi-outline" size={14} color="#334155" />
              <Text style={styles.btnSecondaryText}>Probar Conexión</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleSaveUrl}
              disabled={savingUrl}
            >
              <Ionicons name="save-outline" size={14} color="#FFFFFF" />
              <Text style={styles.btnPrimaryText}>Guardar URL</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Smartwatch & Push Notifications */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="watch-outline" size={16} color="#0284C7" />
            <Text style={styles.cardTitle}>Smartwatch y Notificaciones</Text>
          </View>
          <Text style={styles.cardDesc}>
            Las notificaciones emitidas por el sistema en Android se replican automáticamente al smartwatch vía Notification Bridge.
          </Text>

          {pushToken ? (
            <View style={styles.tokenBox}>
              <Text style={styles.tokenLabel}>Expo Push Token:</Text>
              <Text style={styles.tokenValue} numberOfLines={1}>
                {pushToken}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.btnSecondaryWide}
            onPress={handleTestNotification}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={16} color="#0284C7" />
            <Text style={styles.btnSecondaryWideText}>Emitir Alerta de Prueba al Smartwatch</Text>
          </TouchableOpacity>
        </View>

        {/* Automatic Query Schedules */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={16} color="#0284C7" />
            <Text style={styles.cardTitle}>Horarios de Consulta Automática</Text>
            <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: autoSyncEnabled ? '#059669' : '#64748B' }}>
                {autoSyncEnabled ? 'ACTIVO' : 'PAUSADO'}
              </Text>
              <Switch
                value={autoSyncEnabled}
                onValueChange={handleToggleAutoSync}
                thumbColor={autoSyncEnabled ? '#0284C7' : '#94A3B8'}
                trackColor={{ false: '#E2E8F0', true: '#BAE6FD' }}
              />
            </View>
          </View>
          <Text style={styles.cardDesc}>
            Ejecuta la revisión en horarios programados y en segundo plano (Android WorkManager) aun con la app cerrada. Los acuerdos nuevos se guardan en SQLite y se transmiten directo a tu smartwatch.
          </Text>

          {/* Quick Preset Buttons */}
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.fieldLabel}>HORARIOS SUGERIDOS STJ</Text>
            <View style={styles.presetRow}>
              {[
                { time: '08:30', label: 'Apertura' },
                { time: '12:00', label: 'Mediodía' },
                { time: '15:30', label: 'Vespertino' },
                { time: '18:00', label: 'Cierre' },
              ].map((p) => {
                const alreadyAdded = schedules.some((s) => s.time === p.time);
                return (
                  <TouchableOpacity
                    key={p.time}
                    style={[styles.presetChip, alreadyAdded && styles.presetChipDisabled]}
                    onPress={() => handleAddPreset(p.time, p.label)}
                    disabled={alreadyAdded}
                  >
                    <Ionicons
                      name={alreadyAdded ? 'checkmark' : 'add'}
                      size={12}
                      color={alreadyAdded ? '#94A3B8' : '#0284C7'}
                    />
                    <Text style={[styles.presetChipText, alreadyAdded && styles.presetChipTextDisabled]}>
                      {p.time}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Schedules List */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>HORARIOS PROGRAMADOS ({schedules.length})</Text>
            {schedules.length === 0 ? (
              <View style={styles.emptyScheduleBox}>
                <Text style={styles.emptyScheduleText}>No hay horarios configurados. Agrega uno abajo.</Text>
              </View>
            ) : (
              schedules.map((item) => (
                <View key={item.id} style={styles.scheduleRow}>
                  <View style={styles.scheduleTimeBadge}>
                    <Ionicons name="time" size={14} color={item.enabled ? '#0284C7' : '#94A3B8'} />
                    <Text
                      style={[
                        styles.scheduleTimeText,
                        !item.enabled && { color: '#94A3B8', textDecorationLine: 'line-through' },
                      ]}
                    >
                      {item.time}
                    </Text>
                  </View>
                  <Text style={styles.scheduleLabelText} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                    <Switch
                      value={item.enabled}
                      onValueChange={() => handleToggleScheduleItem(item.id, item.enabled)}
                      thumbColor={item.enabled ? '#0284C7' : '#CBD5E1'}
                      trackColor={{ false: '#E2E8F0', true: '#BAE6FD' }}
                    />
                    <TouchableOpacity
                      onPress={() => handleDeleteSchedule(item.id)}
                      style={styles.deleteScheduleBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Add Custom Schedule Form */}
          <View style={styles.addScheduleCard}>
            <Text style={styles.fieldLabel}>AGREGAR HORARIO PERSONALIZADO</Text>
            <View style={styles.addScheduleForm}>
              <TextInput
                style={[styles.input, styles.monoText, { width: 80, textAlign: 'center' }]}
                placeholder="14:30"
                placeholderTextColor="#94A3B8"
                value={newScheduleTime}
                onChangeText={setNewScheduleTime}
                maxLength={5}
                keyboardType="numbers-and-punctuation"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Etiqueta (ej. Turno Extra)"
                placeholderTextColor="#94A3B8"
                value={newScheduleLabel}
                onChangeText={setNewScheduleLabel}
                maxLength={30}
              />
              <TouchableOpacity style={styles.addScheduleBtn} onPress={handleAddSchedule} activeOpacity={0.8}>
                <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                <Text style={styles.addScheduleBtnText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Last run status info */}
          {lastSyncInfo.timestamp && (
            <View style={styles.lastSyncBox}>
              <Ionicons name="information-circle-outline" size={14} color="#64748B" />
              <Text style={styles.lastSyncText}>
                Última consulta: {new Date(lastSyncInfo.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                {lastSyncInfo.summary
                  ? ` · ${lastSyncInfo.summary.newAgreements} nuevos, ${lastSyncInfo.summary.modifiedAgreements} modif.`
                  : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Force Manual Sync */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="sync-outline" size={16} color="#059669" />
            <Text style={styles.cardTitle}>Sincronización Manual STJ</Text>
          </View>
          <Text style={styles.cardDesc}>
            Envía el lote de expedientes activos a Render para consultar el tribunal y actualizar la base de datos SQLite.
          </Text>

          <TouchableOpacity
            style={styles.syncBtn}
            onPress={handleManualSync}
            disabled={syncing}
            activeOpacity={0.8}
          >
            {syncing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="flash-outline" size={16} color="#FFFFFF" />
                <Text style={styles.syncBtnText}>Consultar STJ Ahora</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 14,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0284C7',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  fieldGroup: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingVertical: 9,
  },
  btnSecondaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#0284C7',
    borderRadius: 6,
    paddingVertical: 9,
  },
  btnPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tokenBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  tokenLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  tokenValue: {
    fontSize: 10,
    color: '#0284C7',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  btnSecondaryWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 6,
    paddingVertical: 10,
  },
  btnSecondaryWideText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669', // emerald-600
    borderRadius: 6,
    paddingVertical: 11,
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  presetChipDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  presetChipTextDisabled: {
    color: '#94A3B8',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
    gap: 8,
  },
  scheduleTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scheduleTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  scheduleLabelText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
    fontWeight: '500',
  },
  deleteScheduleBtn: {
    padding: 4,
  },
  emptyScheduleBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyScheduleText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  addScheduleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 6,
  },
  addScheduleForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284C7',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addScheduleBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  lastSyncBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
  },
  lastSyncText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '500',
  },
});
