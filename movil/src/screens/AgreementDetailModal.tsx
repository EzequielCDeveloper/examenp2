import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ToastAndroid,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgreementRecord } from '../types/database';
import { Badge } from '../components/Badge';

interface AgreementDetailModalProps {
  agreement: AgreementRecord | null;
  visible: boolean;
  onClose: () => void;
  onToggleRead: (agreement: AgreementRecord) => void;
}

export const AgreementDetailModal: React.FC<AgreementDetailModalProps> = ({
  agreement,
  visible,
  onClose,
  onToggleRead,
}) => {
  const insets = useSafeAreaInsets();
  if (!agreement) return null;

  const isUnread = agreement.read_at === null || agreement.read_at === undefined;

  const showCopyFeedback = (label: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(`${label} copiado al portapapeles`, ToastAndroid.SHORT);
    } else {
      Alert.alert('Copiado', `${label} copiado al portapapeles`);
    }
  };

  const copySynthesis = () => {
    showCopyFeedback('Síntesis');
  };

  const copyFullResolution = () => {
    showCopyFeedback('Texto de resolución');
  };

  const copyAll = () => {
    showCopyFeedback('Expediente completo');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="document-text-outline" size={18} color="#0284C7" />
              <Text style={styles.headerTitle} numberOfLines={1}>
                Detalle Integral del Acuerdo
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Subheader Badges */}
          <View style={styles.badgeRow}>
            {isUnread ? (
              <Badge variant="info">Nuevo / No leído</Badge>
            ) : (
              <Badge variant="neutral">Leído</Badge>
            )}
            {agreement.is_modified === 1 && <Badge variant="warning">Modificado</Badge>}
            {agreement.acumulado ? (
              <Badge variant="warning">Acumulado: {agreement.acumulado}</Badge>
            ) : null}
            <Text style={styles.folioText}>Folio #{agreement.id_detalle}</Text>
          </View>

          {/* Scrollable Body */}
          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Metadata Grid */}
            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <View style={styles.metaLabelRow}>
                  <Ionicons name="business-outline" size={13} color="#64748B" />
                  <Text style={styles.metaLabel}>TRIBUNAL / ÓRGANO</Text>
                </View>
                <Text style={styles.metaValue}>{agreement.case_tribunal_nombre || 'No disponible'}</Text>
              </View>

              <View style={styles.metaItem}>
                <View style={styles.metaLabelRow}>
                  <Ionicons name="bookmark-outline" size={13} color="#64748B" />
                  <Text style={styles.metaLabel}>EXPEDIENTE Y ALIAS</Text>
                </View>
                <Text style={styles.metaValueHighlight}>
                  Exp. {agreement.case_expediente_num}/{agreement.case_expediente_anio}
                  {agreement.case_alias ? ` · ${agreement.case_alias}` : ''}
                </Text>
              </View>

              <View style={styles.rowTwoCols}>
                <View style={[styles.metaItem, { flex: 1 }]}>
                  <View style={styles.metaLabelRow}>
                    <Ionicons name="calendar-outline" size={13} color="#64748B" />
                    <Text style={styles.metaLabel}>PUBLICACIÓN</Text>
                  </View>
                  <Text style={styles.metaValue}>{agreement.fecha_publicacion}</Text>
                </View>

                {agreement.secretaria ? (
                  <View style={[styles.metaItem, { flex: 1 }]}>
                    <View style={styles.metaLabelRow}>
                      <Ionicons name="layers-outline" size={13} color="#64748B" />
                      <Text style={styles.metaLabel}>SECRETARÍA</Text>
                    </View>
                    <Text style={styles.metaValue} numberOfLines={1}>
                      {agreement.secretaria}
                    </Text>
                  </View>
                ) : null}
              </View>

              {agreement.partes ? (
                <View style={styles.metaItem}>
                  <View style={styles.metaLabelRow}>
                    <Ionicons name="people-outline" size={13} color="#64748B" />
                    <Text style={styles.metaLabel}>PARTES PROCESALES</Text>
                  </View>
                  <Text style={styles.metaValue}>{agreement.partes}</Text>
                </View>
              ) : null}

              {agreement.cuadernillo ? (
                <View style={styles.metaItem}>
                  <View style={styles.metaLabelRow}>
                    <Ionicons name="folder-outline" size={13} color="#64748B" />
                    <Text style={styles.metaLabel}>CUADERNILLO</Text>
                  </View>
                  <Text style={styles.metaValue}>{agreement.cuadernillo}</Text>
                </View>
              ) : null}
            </View>

            {/* Sintesis Section */}
            <View style={styles.sectionBox}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>SÍNTESIS DEL ACUERDO</Text>
                <TouchableOpacity onPress={copySynthesis} style={styles.copySmallBtn}>
                  <Ionicons name="copy-outline" size={13} color="#0284C7" />
                  <Text style={styles.copySmallText}>Copiar</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sintesisBody}>{agreement.sintesis}</Text>
            </View>

            {/* Full Resolution Text Section */}
            {agreement.texto_completo ? (
              <View style={styles.sectionBox}>
                <View style={styles.sectionHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.sectionTitle}>RESOLUCIÓN / TEXTO ÍNTEGRO</Text>
                    <Text style={styles.charCount}>({agreement.texto_completo.length} car.)</Text>
                  </View>
                  <TouchableOpacity onPress={copyFullResolution} style={styles.copySmallBtn}>
                    <Ionicons name="copy-outline" size={13} color="#0284C7" />
                    <Text style={styles.copySmallText}>Copiar</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.codeContainer}>
                  <Text style={styles.codeText}>{agreement.texto_completo}</Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer Action Bar */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <TouchableOpacity style={styles.btnSecondary} onPress={copyAll} activeOpacity={0.7}>
              <Ionicons name="copy-outline" size={16} color="#334155" />
              <Text style={styles.btnSecondaryText}>Copiar Resumen</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.btnPrimary,
                isUnread ? { backgroundColor: '#0284C7' } : { backgroundColor: '#475569' },
              ]}
              onPress={() => onToggleRead(agreement)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isUnread ? 'checkmark-circle-outline' : 'ellipse-outline'}
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.btnPrimaryText}>
                {isUnread ? 'Marcar como Leído' : 'Desmarcar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)', // slate-900 with opacity
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '92%',
    minHeight: '65%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0', // slate-200
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  folioText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#64748B',
    marginLeft: 'auto',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  metaGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    gap: 10,
  },
  metaItem: {},
  metaLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
  },
  metaValueHighlight: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionBox: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  charCount: {
    fontSize: 10,
    color: '#94A3B8',
  },
  copySmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  copySmallText: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
  },
  sintesisBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 13,
    lineHeight: 20,
    color: '#0F172A',
  },
  codeContainer: {
    backgroundColor: '#0F172A', // slate-900
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  codeText: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footer: {
    flexDirection: 'row',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
    backgroundColor: '#F8FAFC',
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 11,
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  btnPrimary: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 11,
  },
  btnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
