import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Badge } from '../components/Badge';
import { AgreementDetailModal } from './AgreementDetailModal';
import { getAgreements, toggleAgreementRead, markAllAgreementsRead } from '../services/db';
import { syncActiveCasesWithScraper } from '../services/scraperApi';
import { AgreementRecord } from '../types/database';
import { sanitizeSearch } from '../utils/validation';

export const InboxScreen: React.FC = () => {
  const [agreements, setAgreements] = useState<AgreementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAgreement, setSelectedAgreement] = useState<AgreementRecord | null>(null);

  const loadAgreements = useCallback(async () => {
    try {
      const data = await getAgreements(onlyUnread);
      setAgreements(data);
    } catch (err) {
      console.error('Error loading agreements from SQLite:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onlyUnread]);

  useEffect(() => {
    loadAgreements();
  }, [loadAgreements]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncActiveCasesWithScraper();
    } catch (e) {
      console.warn('Scraper sync warning:', e);
    }
    await loadAgreements();
  };

  const handleToggleRead = async (agreement: AgreementRecord) => {
    try {
      const isCurrentlyRead = agreement.read_at !== null;
      await toggleAgreementRead(agreement.id, !isCurrentlyRead);
      await loadAgreements();

      if (selectedAgreement && selectedAgreement.id === agreement.id) {
        setSelectedAgreement((prev) =>
          prev ? { ...prev, read_at: isCurrentlyRead ? null : new Date().toISOString() } : null
        );
      }
    } catch (err) {
      console.error('Error toggling read status in SQLite:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAgreementsRead();
      await loadAgreements();
    } catch (err) {
      console.error('Error marking all as read in SQLite:', err);
    }
  };

  const filteredAgreements = agreements.filter((a) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (a.case_alias && a.case_alias.toLowerCase().includes(term)) ||
      (a.case_expediente_num && a.case_expediente_num.includes(term)) ||
      (a.case_tribunal_nombre && a.case_tribunal_nombre.toLowerCase().includes(term)) ||
      a.sintesis.toLowerCase().includes(term) ||
      a.id_detalle.includes(term)
    );
  });

  const unreadCount = agreements.filter((a) => !a.read_at).length;

  const renderItem = ({ item }: { item: AgreementRecord }) => {
    const isUnread = !item.read_at;

    return (
      <TouchableOpacity
        style={[styles.card, isUnread ? styles.cardUnread : styles.cardRead]}
        onPress={() => setSelectedAgreement(item)}
        activeOpacity={0.7}
      >
        {/* Top Badges & Identification Row */}
        <View style={styles.cardTopRow}>
          <View style={styles.cardBadgesGroup}>
            {isUnread ? (
              <Badge variant="info">Nuevo</Badge>
            ) : (
              <Badge variant="neutral">Leído</Badge>
            )}

            {item.is_modified === 1 && <Badge variant="warning">Modificado</Badge>}

            {item.acumulado ? (
              <Badge variant="warning">Acum: {item.acumulado}</Badge>
            ) : null}

            <Text style={styles.caseAlias} numberOfLines={1}>
              {item.case_alias || 'Sin alias'}
            </Text>
            <Text style={styles.dotSeparator}>·</Text>
            <Text style={styles.caseNum}>
              Exp. {item.case_expediente_num}/{item.case_expediente_anio}
            </Text>
          </View>

          <Text style={styles.cardDate}>{item.fecha_publicacion}</Text>
        </View>

        {/* Court & Secretary Row */}
        <View style={styles.courtRow}>
          <Ionicons name="business-outline" size={13} color="#64748B" />
          <Text style={styles.courtText} numberOfLines={1}>
            {item.case_tribunal_nombre || 'Juzgado'}
            {item.secretaria ? ` · Sec. ${item.secretaria}` : ''}
          </Text>
          <Text style={styles.folioTag}>#{item.id_detalle}</Text>
        </View>

        {/* Parties if available */}
        {item.partes ? (
          <View style={styles.partesRow}>
            <Ionicons name="people-outline" size={12} color="#64748B" />
            <Text style={styles.partesText} numberOfLines={1}>
              {item.partes}
            </Text>
          </View>
        ) : null}

        {/* Synthesis */}
        <Text style={styles.sintesisText} numberOfLines={3}>
          {item.sintesis}
        </Text>

        {/* Card Footer Actions */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.toggleReadBtn}
            onPress={(e) => {
              handleToggleRead(item);
            }}
          >
            <Ionicons
              name={isUnread ? 'checkmark-circle-outline' : 'ellipse-outline'}
              size={14}
              color={isUnread ? '#0284C7' : '#64748B'}
            />
            <Text style={[styles.toggleReadText, isUnread && { color: '#0284C7' }]}>
              {isUnread ? 'Marcar leído' : 'Desmarcar'}
            </Text>
          </TouchableOpacity>

          <View style={styles.viewDetailLink}>
            <Text style={styles.viewDetailText}>Ver resolución</Text>
            <Ionicons name="chevron-forward" size={13} color="#0284C7" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Bandeja de Acuerdos"
        subtitle="STJ Sonora · Local SQLite"
        unreadCount={unreadCount}
        onRefresh={onRefresh}
        isRefreshing={refreshing}
      />

      {/* Search Input Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={15} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por alias, expediente, síntesis o folio..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={(t) => setSearch(sanitizeSearch(t, 80))}
            maxLength={80}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs Bar */}
      <View style={styles.filterBar}>
        <View style={styles.tabGroup}>
          <TouchableOpacity
            style={[styles.tab, onlyUnread && styles.tabActive]}
            onPress={() => setOnlyUnread(true)}
          >
            <Text style={[styles.tabText, onlyUnread && styles.tabTextActive]}>
              No Leídos {unreadCount > 0 ? `(${unreadCount})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, !onlyUnread && styles.tabActive]}
            onPress={() => setOnlyUnread(false)}
          >
            <Text style={[styles.tabText, !onlyUnread && styles.tabTextActive]}>
              Historial Completo
            </Text>
          </TouchableOpacity>
        </View>

        {unreadCount > 0 && onlyUnread && (
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllBtn}>
            <Text style={styles.markAllBtnText}>Marcar todos</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content Feed */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={styles.loadingText}>Leyendo base de datos SQLite...</Text>
        </View>
      ) : filteredAgreements.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="checkmark-done" size={28} color="#0284C7" />
          </View>
          <Text style={styles.emptyTitle}>
            {search ? 'Sin resultados para la búsqueda' : onlyUnread ? '¡Estás al día!' : 'No hay acuerdos registrados'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {search
              ? 'Intenta con otro término o número de expediente.'
              : onlyUnread
              ? 'No tienes acuerdos judiciales pendientes de revisión.'
              : 'Registra expedientes y pulsa refrescar para consultar STJ.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAgreements}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0284C7']} />
          }
        />
      )}

      {/* Detail Modal */}
      <AgreementDetailModal
        agreement={selectedAgreement}
        visible={selectedAgreement !== null}
        onClose={() => setSelectedAgreement(null)}
        onToggleRead={handleToggleRead}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // slate-50
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9', // slate-100
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    padding: 2,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  markAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markAllBtnText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
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
  cardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: '#0EA5E9', // sky-500
    backgroundColor: '#FAFCFF',
  },
  cardRead: {
    backgroundColor: '#FFFFFF',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardBadgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  caseAlias: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  dotSeparator: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  caseNum: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#475569',
  },
  cardDate: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  courtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  courtText: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
  folioTag: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#94A3B8',
  },
  partesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  partesText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
  },
  sintesisText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 19,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  toggleReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: '#F8FAFC',
  },
  toggleReadText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  viewDetailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailText: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
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
  },
});
