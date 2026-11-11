import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UNIDADES_SONORA, TIPOS_ASUNTO, UnidadJudicial, TipoAsunto } from '../data/catalogos';
import { updateCase, deleteCase, setCaseStatus } from '../services/db';
import {
  validateAlias,
  validateExpedienteNum,
  validateExpedienteAnio,
  validateBis,
  sanitizeSearch,
} from '../utils/validation';
import { CaseRecord } from '../types/database';

interface EditCaseModalProps {
  visible: boolean;
  caseItem: CaseRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditCaseModal: React.FC<EditCaseModalProps> = ({
  visible,
  caseItem,
  onClose,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const [alias, setAlias] = useState('');
  const [selectedUnidad, setSelectedUnidad] = useState<UnidadJudicial>(UNIDADES_SONORA[0]);
  const [selectedTipo, setSelectedTipo] = useState<TipoAsunto>(TIPOS_ASUNTO[0]);
  const [expedienteNum, setExpedienteNum] = useState('');
  const [expedienteAnio, setExpedienteAnio] = useState('');
  const [bis, setBis] = useState('0');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Search & picker state for Juzgados
  const [showUnidadPicker, setShowUnidadPicker] = useState(false);
  const [unidadSearch, setUnidadSearch] = useState('');

  useEffect(() => {
    if (caseItem) {
      setAlias(caseItem.alias);
      setExpedienteNum(caseItem.expediente_num);
      setExpedienteAnio(String(caseItem.expediente_anio));
      setBis(String(caseItem.bis || '0'));

      const foundUnidad = UNIDADES_SONORA.find(
        (u) => String(u.idUnidad) === String(caseItem.clave_juzgado)
      );
      if (foundUnidad) setSelectedUnidad(foundUnidad);

      const foundTipo = TIPOS_ASUNTO.find(
        (t) => t.nombre.toLowerCase() === caseItem.tipo_asunto.toLowerCase()
      );
      if (foundTipo) setSelectedTipo(foundTipo);
    }
  }, [caseItem]);

  const filteredUnidades = UNIDADES_SONORA.filter(
    (u) =>
      u.nombre.toLowerCase().includes(unidadSearch.toLowerCase()) ||
      u.municipio.toLowerCase().includes(unidadSearch.toLowerCase())
  );

  const handleSave = async () => {
    if (!caseItem) return;

    const vAlias = validateAlias(alias);
    if (!vAlias.valid) {
      Alert.alert('Alias Inválido', vAlias.error);
      return;
    }
    const vNum = validateExpedienteNum(expedienteNum);
    if (!vNum.valid) {
      Alert.alert('Número Inválido', vNum.error);
      return;
    }
    const vAnio = validateExpedienteAnio(expedienteAnio);
    if (!vAnio.valid) {
      Alert.alert('Año Inválido', vAnio.error);
      return;
    }
    const vBis = validateBis(bis);
    if (!vBis.valid) {
      Alert.alert('Bis Inválido', vBis.error);
      return;
    }

    const anio = parseInt(expedienteAnio.trim(), 10);
    setSaving(true);
    try {
      const providerParams = JSON.stringify({
        id_unidad: String(selectedUnidad.idUnidad),
        id_cat_tipo_asunto: String(selectedTipo.id),
        asunto: expedienteNum.trim(),
        anio: String(anio),
        bis: bis.trim() || '0',
      });

      await updateCase(caseItem.id, {
        alias: alias.trim(),
        expediente_num: expedienteNum.trim(),
        expediente_anio: anio,
        bis: parseInt(bis, 10) || 0,
        clave_juzgado: String(selectedUnidad.idUnidad),
        tribunal_nombre: selectedUnidad.nombre,
        tipo_asunto: selectedTipo.nombre,
        ciudad: selectedUnidad.municipio,
        provider_params: providerParams,
      });

      Alert.alert('Actualizado', 'Expediente actualizado en SQLite local.');
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo actualizar el expediente.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleArchive = () => {
    if (!caseItem) return;
    const isCurrentlyArchived = caseItem.status === 'archived';
    const actionLabel = isCurrentlyArchived ? 'Restaurar' : 'Archivar';

    Alert.alert(
      `${actionLabel} Expediente`,
      isCurrentlyArchived
        ? `¿Deseas restaurar "${caseItem.alias}" a la lista de expedientes activos?`
        : `¿Deseas archivar "${caseItem.alias}"? El monitoreo se pausará automáticamente, pero se conservarán todos sus acuerdos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: actionLabel,
          onPress: async () => {
            try {
              await setCaseStatus(caseItem.id, isCurrentlyArchived ? 'active' : 'archived');
              Alert.alert('Actualizado', `Expediente ${isCurrentlyArchived ? 'restaurado a activos' : 'archivado'}.`);
              onSuccess();
              onClose();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo cambiar el estado del expediente.');
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!caseItem) return;

    Alert.alert(
      'Eliminar Expediente',
      `¿Deseas eliminar "${caseItem.alias}" (Exp. ${caseItem.expediente_num}/${caseItem.expediente_anio}) y todos sus acuerdos registrados? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteCase(caseItem.id);
              Alert.alert('Eliminado', 'Expediente eliminado de SQLite.');
              onSuccess();
              onClose();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo eliminar el expediente.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (!caseItem) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="create-outline" size={18} color="#0284C7" />
              <Text style={styles.title}>Modificar Expediente</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Alias */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>ALIAS DEL ASUNTO / REFERENCIA INTERNA *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Morales vs Banorte"
                placeholderTextColor="#94A3B8"
                value={alias}
                onChangeText={setAlias}
                maxLength={100}
              />
            </View>

            {/* Juzgado Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>ÓRGANO JURISDICCIONAL (STJ SONORA) *</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowUnidadPicker(!showUnidadPicker)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectorText} numberOfLines={2}>
                    {selectedUnidad.nombre}
                  </Text>
                  <Text style={styles.selectorSub}>Distrito: {selectedUnidad.municipio}</Text>
                </View>
                <Ionicons
                  name={showUnidadPicker ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#64748B"
                />
              </TouchableOpacity>

              {showUnidadPicker && (
                <View style={styles.pickerContainer}>
                  <View style={styles.pickerSearch}>
                    <Ionicons name="search" size={14} color="#64748B" style={{ marginRight: 6 }} />
                    <TextInput
                      style={styles.pickerSearchInput}
                      placeholder="Filtrar por ciudad o materia..."
                      placeholderTextColor="#94A3B8"
                      value={unidadSearch}
                      onChangeText={(t) => setUnidadSearch(sanitizeSearch(t, 50))}
                      maxLength={50}
                    />
                  </View>

                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled={true}>
                    {filteredUnidades.map((u) => (
                      <TouchableOpacity
                        key={u.idUnidad}
                        style={[
                          styles.pickerItem,
                          u.idUnidad === selectedUnidad.idUnidad && styles.pickerItemActive,
                        ]}
                        onPress={() => {
                          setSelectedUnidad(u);
                          setShowUnidadPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerItemText,
                            u.idUnidad === selectedUnidad.idUnidad && styles.pickerItemTextActive,
                          ]}
                          numberOfLines={2}
                        >
                          {u.nombre}
                        </Text>
                        <Text style={styles.pickerItemSub}>{u.municipio}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Número, Año y Bis */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                <Text style={styles.label}>NÚMERO *</Text>
                <TextInput
                  style={[styles.input, styles.monoInput]}
                  placeholder="Ej. 18"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={expedienteNum}
                  onChangeText={(t) => setExpedienteNum(t.replace(/[^\d]/g, ''))}
                  maxLength={6}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>AÑO *</Text>
                <TextInput
                  style={[styles.input, styles.monoInput]}
                  placeholder="2026"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={expedienteAnio}
                  onChangeText={(t) => setExpedienteAnio(t.replace(/[^\d]/g, ''))}
                  maxLength={4}
                />
              </View>

              <View style={[styles.fieldGroup, { width: 70 }]}>
                <Text style={styles.label}>BIS</Text>
                <TextInput
                  style={[styles.input, styles.monoInput, { textAlign: 'center' }]}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={bis}
                  onChangeText={(t) => setBis(t.replace(/[^\d]/g, ''))}
                  maxLength={2}
                />
              </View>
            </View>

            {/* Tipo de Asunto */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>TIPO DE ASUNTO</Text>
              <View style={styles.pillsRow}>
                {TIPOS_ASUNTO.map((t) => {
                  const isSelected = selectedTipo.id === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.pill, isSelected && styles.pillActive]}
                      onPress={() => setSelectedTipo(t)}
                    >
                      <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                        {t.nombre}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Danger Zone: Archive and Delete Buttons */}
            <View style={styles.actionsBox}>
              <TouchableOpacity
                style={styles.archiveBtn}
                onPress={handleToggleArchive}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={caseItem.status === 'archived' ? 'arrow-undo-outline' : 'archive-outline'}
                  size={15}
                  color="#475569"
                />
                <Text style={styles.archiveBtnText}>
                  {caseItem.status === 'archived'
                    ? 'Restaurar a Activos'
                    : 'Archivar este expediente'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteCaseBtn}
                onPress={handleDelete}
                disabled={deleting}
                activeOpacity={0.7}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Ionicons name="trash-outline" size={15} color="#DC2626" />
                <Text style={styles.deleteCaseBtnText}>
                  {deleting ? 'Eliminando...' : 'Eliminar permanentemente'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Guardar Cambios</Text>
              )}
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  form: {
    padding: 16,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  monoInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  selector: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  selectorSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  pickerContainer: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  pickerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
  },
  pickerItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  pickerItemActive: {
    backgroundColor: '#E0F2FE',
  },
  pickerItemText: {
    fontSize: 12,
    color: '#334155',
  },
  pickerItemTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  pickerItemSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pillActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  pillText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actionsBox: {
    marginTop: 14,
    gap: 8,
  },
  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 10,
  },
  archiveBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteCaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 8,
    paddingVertical: 10,
  },
  deleteCaseBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
    backgroundColor: '#F8FAFC',
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 13,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#0284C7',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
