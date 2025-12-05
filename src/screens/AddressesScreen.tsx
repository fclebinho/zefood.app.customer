import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MapPin, X, Plus, Pencil, Trash2, Check } from 'lucide-react-native';
import { useAddress } from '../hooks/useAddress';
import { Address } from '../types';
import api from '../services/api';
import axios from 'axios';

export function AddressesScreen() {
  const navigation = useNavigation<any>();
  const { addresses, selectedAddress, selectAddress, loadAddresses, isLoading } = useAddress();
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  // Form fields
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setIsLoadingCep(true);
    try {
      const response = await axios.get(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
      const data = response.data;

      setStreet(data.street || '');
      setNeighborhood(data.neighborhood || '');
      setCity(data.city || '');
      setState(data.state || '');

      // Store coordinates if available
      if (data.location?.coordinates?.latitude && data.location?.coordinates?.longitude) {
        setLatitude(parseFloat(data.location.coordinates.latitude));
        setLongitude(parseFloat(data.location.coordinates.longitude));
      } else {
        setLatitude(null);
        setLongitude(null);
      }
    } catch (error) {
      console.error('Error fetching CEP:', error);
      Alert.alert('CEP não encontrado', 'Verifique o CEP digitado e tente novamente.');
    } finally {
      setIsLoadingCep(false);
    }
  };

  const handleCepChange = (value: string) => {
    // Format CEP as 00000-000
    const cleanValue = value.replace(/\D/g, '');
    let formattedValue = cleanValue;
    if (cleanValue.length > 5) {
      formattedValue = `${cleanValue.slice(0, 5)}-${cleanValue.slice(5, 8)}`;
    }
    setZipCode(formattedValue);

    // Auto-fetch when CEP is complete
    if (cleanValue.length === 8) {
      fetchAddressByCep(cleanValue);
    }
  };

  const resetForm = () => {
    setStreet('');
    setNumber('');
    setComplement('');
    setNeighborhood('');
    setCity('');
    setState('');
    setZipCode('');
    setLatitude(null);
    setLongitude(null);
    setEditingAddress(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (address: Address) => {
    setEditingAddress(address);
    setStreet(address.street);
    setNumber(address.number);
    setComplement(address.complement || '');
    setNeighborhood(address.neighborhood);
    setCity(address.city);
    setState(address.state);
    setZipCode(address.zipCode);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!street || !number || !neighborhood || !city || !state || !zipCode) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios');
      return;
    }

    setIsSaving(true);
    try {
      const addressData: any = {
        street,
        number: String(number),
        complement: complement && complement.trim() ? complement.trim() : null,
        neighborhood,
        city,
        state,
        zipCode: zipCode.replace(/\D/g, ''),
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      };

      console.log('Sending address data:', JSON.stringify(addressData, null, 2));

      if (editingAddress?.id) {
        await api.patch(`/users/addresses/${editingAddress.id}`, addressData);
      } else {
        await api.post('/users/addresses', addressData);
      }

      await loadAddresses();
      setShowModal(false);
      resetForm();
      Alert.alert('Sucesso', editingAddress ? 'Endereço atualizado!' : 'Endereço adicionado!');
    } catch (error: any) {
      console.error('Error saving address:', error);
      console.error('Error response:', JSON.stringify(error?.response?.data, null, 2));
      const errorMessage = Array.isArray(error?.response?.data?.message)
        ? error.response.data.message.join(', ')
        : error?.response?.data?.message || 'Erro ao salvar endereço';
      Alert.alert('Erro', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (address: Address) => {
    Alert.alert(
      'Excluir endereço',
      'Tem certeza que deseja excluir este endereço?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/users/addresses/${address.id}`);
              await loadAddresses();
              Alert.alert('Sucesso', 'Endereço excluído!');
            } catch (error: any) {
              Alert.alert('Erro', error?.response?.data?.message || 'Erro ao excluir endereço');
            }
          },
        },
      ]
    );
  };

  const handleSelect = (address: Address) => {
    selectAddress(address);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {addresses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MapPin size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Nenhum endereço</Text>
            <Text style={styles.emptySubtitle}>
              Adicione um endereço para receber seus pedidos
            </Text>
          </View>
        ) : (
          addresses.map((address) => {
            const isSelected = selectedAddress?.id === address.id;
            return (
              <TouchableOpacity
                key={address.id}
                style={[
                  styles.addressCard,
                  isSelected && styles.addressCardSelected,
                ]}
                onPress={() => handleSelect(address)}
                activeOpacity={0.7}
              >
                <View style={styles.addressContent}>
                  <View style={[
                    styles.addressIconContainer,
                    isSelected && styles.addressIconContainerSelected,
                  ]}>
                    <MapPin size={20} color={isSelected ? '#fff' : '#666'} />
                  </View>
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressStreet} numberOfLines={1}>
                      {address.street}, {address.number}
                    </Text>
                    {address.complement && (
                      <Text style={styles.addressComplement} numberOfLines={1}>{address.complement}</Text>
                    )}
                    <Text style={styles.addressDetails} numberOfLines={1}>
                      {address.neighborhood}, {address.city} - {address.state}
                    </Text>
                    <Text style={styles.addressZip}>CEP: {address.zipCode}</Text>
                  </View>
                  <View style={[
                    styles.radioButton,
                    isSelected && styles.radioButtonSelected,
                  ]}>
                    {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                  </View>
                </View>

                <View style={styles.addressActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openEditModal(address)}
                  >
                    <Pencil size={16} color="#f97316" />
                    <Text style={styles.actionButtonText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDelete(address)}
                  >
                    <Trash2 size={16} color="#dc2626" />
                    <Text style={styles.deleteButtonText}>Excluir</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
        <Plus size={20} color="#fff" />
        <Text style={styles.addButtonText}>Adicionar endereço</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAddress ? 'Editar endereço' : 'Novo endereço'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseButton}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>CEP *</Text>
                <View style={styles.cepContainer}>
                  <TextInput
                    style={[styles.input, styles.cepInput]}
                    placeholder="00000-000"
                    value={zipCode}
                    onChangeText={handleCepChange}
                    keyboardType="numeric"
                    maxLength={9}
                  />
                  {isLoadingCep && (
                    <ActivityIndicator size="small" color="#f97316" style={styles.cepLoader} />
                  )}
                </View>
                <Text style={styles.cepHint}>Digite o CEP para preencher automaticamente</Text>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputContainer, { flex: 2 }]}>
                  <Text style={styles.label}>Rua *</Text>
                  <TextInput
                    style={[styles.input, isLoadingCep && styles.inputDisabled]}
                    placeholder="Nome da rua"
                    value={street}
                    onChangeText={setStreet}
                    editable={!isLoadingCep}
                  />
                </View>
                <View style={[styles.inputContainer, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.label}>Número *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nº"
                    value={number}
                    onChangeText={setNumber}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Complemento</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Apto, bloco, etc"
                  value={complement}
                  onChangeText={setComplement}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Bairro *</Text>
                <TextInput
                  style={[styles.input, isLoadingCep && styles.inputDisabled]}
                  placeholder="Bairro"
                  value={neighborhood}
                  onChangeText={setNeighborhood}
                  editable={!isLoadingCep}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputContainer, { flex: 2 }]}>
                  <Text style={styles.label}>Cidade *</Text>
                  <TextInput
                    style={[styles.input, isLoadingCep && styles.inputDisabled]}
                    placeholder="Cidade"
                    value={city}
                    onChangeText={setCity}
                    editable={!isLoadingCep}
                  />
                </View>
                <View style={[styles.inputContainer, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.label}>Estado *</Text>
                  <TextInput
                    style={[styles.input, isLoadingCep && styles.inputDisabled]}
                    placeholder="UF"
                    value={state}
                    onChangeText={setState}
                    maxLength={2}
                    autoCapitalize="characters"
                    editable={!isLoadingCep}
                  />
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {editingAddress ? 'Salvar alterações' : 'Adicionar endereço'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#eee',
    marginBottom: 16,
    overflow: 'hidden',
  },
  addressCardSelected: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  addressContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  addressIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addressIconContainerSelected: {
    backgroundColor: '#f97316',
  },
  addressInfo: {
    flex: 1,
  },
  addressStreet: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  addressComplement: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  addressDetails: {
    fontSize: 14,
    color: '#666',
  },
  addressZip: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  radioButtonSelected: {
    borderColor: '#f97316',
    backgroundColor: '#f97316',
  },
  addressActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 12,
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#f97316',
    fontWeight: '500',
  },
  deleteButton: {},
  deleteButtonText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#f97316',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalForm: {
    padding: 20,
  },
  row: {
    flexDirection: 'row',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  cepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cepInput: {
    flex: 1,
  },
  cepLoader: {
    marginLeft: 12,
  },
  cepHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#f97316',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
