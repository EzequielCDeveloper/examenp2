import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Badge } from '../components/Badge';
import { AddCaseModal } from './AddCaseModal';
import { EditCaseModal } from './EditCaseModal';
import { getAllCases, toggleCaseTrack, setCaseStatus, deleteCase } from '../services/db';
import { sanitizeSearch } from '../utils/validation';
import { CaseRecord } from '../types/database';

export const CasesScreen: React.FC = () => {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<'active' | 'archived'>('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCase, setEditingCase] = useState<CaseRecord | null>(null);

  const fetchCases = useCallback(async () => {
    try {
      const data = await getAllCases();
      setCases(data);
    } catch (err) {
      console.error('Error fetching cases from SQLite:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCases();
  };

  const activeCount = cases.filter((c) => c.status === 'active').length;
  const archivedCount = cases.filter((c) => c.status === 'archived').length;

  const handleToggleTrack = async (item: CaseRecord) => {
    const newTrack = item.track_enabled === 1 ? false : true;
    try {
      await toggleCaseTrack(item.id, newTrack);
      setCases((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, track_enabled: newTrack ? 1 : 0 } : c))
      );
    } catch (err) {
      Alert.alert('Error', 'No se pudo actualizar el estado de monitoreo en SQLite.');
    }
  };

  const handleToggleArchiveQuick = (item: CaseRecord) => {
    const isCurrentlyArchived = item.status === 'archived';
    const actionLabel = isCurrentlyArchived ? 'Restaurar' : 'Archivar';

    Alert.alert(
      `${actionLabel} Expediente`,
      isCurrentlyArchived
        ? `¿Deseas restaurar "${item.alias}" a la lista de expedientes activos?`
        : `¿Deseas archivar "${item.alias}"? Se pausará el monitoreo pero se conservarán sus acuerdos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: actionLabel,
          onPress: async () => {
            try {
              await setCaseStatus(item.id, isCurrentlyArchived ? 'active' : 'archived');
              await fetchCases();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteQuick = (item: CaseRecord) => {
    Alert.alert(
      'Eliminar Expediente',
      `¿Deseas eliminar permanentemente "${item.alias}" y todos sus acuerdos registrados? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCase(item.id);
              await fetchCases();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const filteredCases = cases.filter(
    (c) =>
      c.status === statusTab &&
      (c.alias.toLowerCase().includes(search.toLowerCase()) ||
        c.expediente_num.includes(search) ||
        c.tribunal_nombre.toLowerCase().includes(search.toLowerCase()))
  );

  const formatLastChecked = (isoDate: string | null) => {
    if (!isoDate) return 'Sin revisiones aún';
    try {
      const d = new Date(isoDate);
      return d.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  };

  const renderItem = ({ item }: { item: CaseRecord }) => {
    const isTracked = item.track_enabled === 1;
    const isArchived = item.status === 'archived';

    return (
      <View style={[styles.card, isArchived && styles.cardArchived]}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.aliasRow}>
              <Text style={styles.caseAlias} numberOfLines={1}>
                {item.alias}
              </Text>
              {item.bis > 0 && <Badge variant="warning">Bis {item.bis}</Badge>}
              {isArchived && <Badge variant="neutral">Archivado</Badge>}
            </View>
            <Text style={styles.caseNumber}>
              Exp. {item.expediente_num}/{item.expediente_anio} · {item.tipo_asunto}
            </Text>
          </View>

          {!isArchived && (
            <View style={styles.switchCol}>
              <Switch
                value={isTracked}
                onValueChange={() => handleToggleTrack(item)}
                trackColor={{ false: '#CBD5E1', true: '#BAE6FD' }}
                thumbColor={isTracked ? '#0284C7' : '#94A3B8'}
              />
              <Text style={[styles.switchLabel, { color: isTracked ? '#0284C7' : '#94A3B8' }]}>
                {isTracked ? 'Activo' : 'Pausado'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.courtRow}>
          <Ionicons name="business-outline" size={13} color="#64748B" />
          <Text style={styles.courtName} numberOfLines={2}>
            {item.tribunal_nombre} ({item.ciudad})
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.lastCheckWrapper}>
            <Ionicons name="time-outline" size={12} color="#94A3B8" />
            <Text style={styles.metaText}>
              {isArchived ? 'Monitoreo detenido' : `Revisado: ${formatLastChecked(item.last_checked_at)}`}
            </Text>
          </View>

          <View style={styles.rightActionsRow}>
            {!isArchived && item.last_error_code ? (
              <Badge variant="danger">Error STJ</Badge>
            ) : !isArchived && isTracked ? (
              <Badge variant="success">Monitoreando</Badge>
            ) : null}

            {isArchived ? (
              <>
                <TouchableOpacity
                  style={styles.restoreBtn}
                  onPress={() => handleToggleArchiveQuick(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-undo-outline" size={13} color="#059669" />
                  <Text style={styles.restoreBtnText}>Restaurar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteQuickBtn}
                  onPress={() => handleDeleteQuick(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={13} color="#DC2626" />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.archiveQuickBtn}
                onPress={() => handleToggleArchiveQuick(item)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="archive-outline" size={13} color="#64748B" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => setEditingCase(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={13} color="#0284C7" />
              <Text style={styles.editBtnText}>Editar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Directorio de Expedientes"
        subtitle={`${cases.length} expedientes indexados`}
        onRefresh={onRefresh}
        isRefreshing={refreshing}
      />

      {/* Action and Search Bar */}
      <View style={styles.searchBar}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={15} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por alias, número o tribunal..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={(t) => setSearch(sanitizeSearch(t, 80))}
            maxLength={80}
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs Bar (Activos / Archivados) */}
      <View style={styles.filterBar}>
        <View style={styles.tabGroup}>
          <TouchableOpacity
            style={[styles.tab, statusTab === 'active' && styles.tabActive]}
            onPress={() => setStatusTab('active')}
          >
            <Text style={[styles.tabText, statusTab === 'active' && styles.tabTextActive]}>
              Activos ({activeCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, statusTab === 'archived' && styles.tabActive]}
            onPress={() => setStatusTab('archived')}
          >
            <Text style={[styles.tabText, statusTab === 'archived' && styles.tabTextActive]}>
              Archivados ({archivedCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Cases List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={styles.loadingText}>Consultando SQLite...</Text>
        </View>
      ) : filteredCases.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="folder-open-outline" size={28} color="#0284C7" />
          </View>
          <Text style={styles.emptyTitle}>
            {search ? 'Sin coincidencias' : 'Directorio Vacío'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {search
              ? 'No se encontró ningún expediente que coincida con la búsqueda.'
              : 'Agrega tu primer expediente para iniciar el monitoreo de acuerdos.'}
          </Text>
          <TouchableOpacity
            style={styles.emptyAddBtn}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.emptyAddBtnText}>Registrar Expediente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredCases}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0284C7']} />
          }
        />
      )}

      {/* Modal to Register Case */}
      <AddCaseModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchCases}
      />

      {/* Modal to Edit Case */}
      <EditCaseModal
        visible={editingCase !== null}
        caseItem={editingCase}
        onClose={() => setEditingCase(null)}
        onSuccess={fetchCases}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // slate-50
  },
  searchBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
    alignItems: 'center',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284C7', // sky-600
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  listContainer: {
    padding: 12,
    gap: 10,
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
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  aliasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  caseAlias: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  caseNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  switchCol: {
    alignItems: 'center',
    marginLeft: 8,
  },
  switchLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: -2,
    letterSpacing: 0.2,
  },
  courtRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 10,
  },
  courtName: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  lastCheckWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 13,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  filterBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  cardArchived: {
    opacity: 0.88,
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  restoreBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  deleteQuickBtn: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  archiveQuickBtn: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
});
