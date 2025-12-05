import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  Clipboard,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../hooks/useCart';
import { useAddress } from '../hooks/useAddress';
import api, { orderService } from '../services/api';
import { Address } from '../types';

type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH';

interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  icon: string;
  available: boolean;
}

interface PixData {
  pixQrCode: string;
  pixCode: string;
}

export function CheckoutScreen() {
  const navigation = useNavigation<any>();
  const { items, restaurant, subtotal, deliveryFee, total, clearCart } = useCart();
  const { addresses, selectedAddress, selectAddress } = useAddress();
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('PIX');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([
    { value: 'PIX', label: 'Pix', icon: '💠', available: true },
    { value: 'CREDIT_CARD', label: 'Cartão de crédito', icon: '💳', available: true },
    { value: 'DEBIT_CARD', label: 'Cartão de débito', icon: '💳', available: true },
    { value: 'CASH', label: 'Dinheiro', icon: '💵', available: true },
  ]);

  // Load available payment methods
  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        const response = await api.get('/payments/available-methods');
        setPaymentMethods(response.data.methods);
      } catch (error) {
        console.error('Error loading payment methods:', error);
      }
    };
    loadPaymentMethods();
  }, []);

  const handleAddressSelect = (address: Address) => {
    selectAddress(address);
    setShowAddressModal(false);
  };

  // Poll for payment status when waiting for Pix
  useEffect(() => {
    if (!pixData || !orderId) return;

    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/orders/${orderId}`);
        if (response.data.paymentStatus === 'PAID') {
          clearInterval(interval);
          clearCart();
          Alert.alert('Pagamento Confirmado!', 'Seu pedido está sendo preparado.');
          navigation.navigate('Main', { screen: 'Orders' });
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pixData, orderId]);

  // Se não houver itens no carrinho, voltar para a tela anterior
  if (!items || items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyTitle}>Carrinho vazio</Text>
        <Text style={styles.emptySubtitle}>
          Adicione itens ao carrinho antes de finalizar o pedido
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const copyPixCode = () => {
    if (pixData?.pixCode) {
      Clipboard.setString(pixData.pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      Alert.alert('Erro', 'Selecione um endereço de entrega');
      return;
    }

    if (!restaurant) {
      Alert.alert('Erro', 'Restaurante não encontrado');
      return;
    }

    setIsLoading(true);
    try {
      const orderData = {
        restaurantId: restaurant.id,
        items: items.map((item) => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity,
        })),
        paymentMethod: selectedPayment,
        notes: notes || undefined,
        deliveryAddress: {
          street: selectedAddress.street,
          number: selectedAddress.number,
          complement: selectedAddress.complement || undefined,
          neighborhood: selectedAddress.neighborhood,
          city: selectedAddress.city,
          state: selectedAddress.state,
          zipCode: selectedAddress.zipCode,
        },
      };

      console.log('Creating order with data:', JSON.stringify(orderData, null, 2));
      const order = await orderService.create(orderData);
      console.log('Order created:', order);

      setOrderId(order.id);

      // Handle payment based on method
      if (selectedPayment === 'PIX') {
        // Generate Pix QR Code
        const pixResponse = await api.post(`/payments/pix/${order.id}`);
        setPixData({
          pixQrCode: pixResponse.data.pixQrCode,
          pixCode: pixResponse.data.pixCode,
        });
      } else if (selectedPayment === 'CREDIT_CARD' || selectedPayment === 'DEBIT_CARD') {
        // Process card payment
        try {
          const processResponse = await api.post('/payments/process', {
            orderId: order.id,
            method: selectedPayment,
          });

          setIsLoading(false);
          clearCart();
          Alert.alert(
            'Pagamento aprovado!',
            `Seu pedido #${order?.orderNumber || 'N/A'} foi confirmado.`,
            [
              {
                text: 'Ver pedidos',
                onPress: () => navigation.navigate('Main', { screen: 'Orders' }),
              },
            ]
          );
          return;
        } catch (paymentError: any) {
          console.error('Payment error:', paymentError);
          setIsLoading(false);
          const errorMsg = paymentError?.response?.data?.message || 'Erro no pagamento';
          Alert.alert('Pagamento indisponível', errorMsg);
          return;
        }
      } else {
        // Cash payment - just confirm order
        setIsLoading(false);
        clearCart();
        Alert.alert(
          'Pedido realizado!',
          `Seu pedido #${order?.orderNumber || 'N/A'} foi enviado para o restaurante.`,
          [
            {
              text: 'Ver pedidos',
              onPress: () => navigation.navigate('Main', { screen: 'Orders' }),
            },
          ]
        );
        return;
      }
    } catch (error: any) {
      console.error('Order creation error:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Erro ao criar pedido';
      Alert.alert('Erro', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Show Pix QR Code screen
  if (pixData) {
    return (
      <View style={styles.container}>
        <View style={styles.pixContainer}>
          <View style={styles.pixHeader}>
            <Text style={styles.pixIcon}>💠</Text>
            <Text style={styles.pixTitle}>Pague com Pix</Text>
            <Text style={styles.pixSubtitle}>Escaneie o QR Code ou copie o código</Text>
          </View>

          {pixData.pixQrCode && (
            <View style={styles.qrContainer}>
              <Image
                source={{ uri: pixData.pixQrCode }}
                style={styles.qrCode}
                resizeMode="contain"
              />
            </View>
          )}

          <TouchableOpacity style={styles.copyButton} onPress={copyPixCode}>
            <Text style={styles.copyButtonText}>
              {copied ? '✓ Copiado!' : '📋 Copiar código Pix'}
            </Text>
          </TouchableOpacity>

          <View style={styles.timerWarning}>
            <Text style={styles.timerText}>⏱️ O código expira em 30 minutos</Text>
          </View>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Valor a pagar</Text>
            <Text style={styles.amountValue}>
              R$ {total.toFixed(2).replace('.', ',')}
            </Text>
          </View>

          <View style={styles.statusContainer}>
            <ActivityIndicator size="small" color="#666" />
            <Text style={styles.statusText}>Aguardando pagamento...</Text>
          </View>

          <TouchableOpacity
            style={styles.cancelPixButton}
            onPress={() => {
              setPixData(null);
              setOrderId(null);
            }}
          >
            <Text style={styles.cancelPixText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Endereço de entrega</Text>

          <TouchableOpacity
            style={styles.addressPreview}
            onPress={() => setShowAddressModal(true)}
          >
            {selectedAddress ? (
              <View style={styles.addressPreviewContent}>
                <View style={styles.addressPreviewInfo}>
                  <Text style={styles.addressPreviewStreet}>
                    {selectedAddress.street}, {selectedAddress.number}
                  </Text>
                  {selectedAddress.complement && (
                    <Text style={styles.addressPreviewComplement}>
                      {selectedAddress.complement}
                    </Text>
                  )}
                  <Text style={styles.addressPreviewDetails}>
                    {selectedAddress.neighborhood}, {selectedAddress.city} - {selectedAddress.state}
                  </Text>
                  <Text style={styles.addressPreviewZip}>CEP: {selectedAddress.zipCode}</Text>
                </View>
                <Text style={styles.changeText}>Alterar</Text>
              </View>
            ) : (
              <View style={styles.addressPreviewEmpty}>
                <Text style={styles.addressPreviewEmptyText}>
                  Toque para selecionar um endereço
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Modal
          visible={showAddressModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddressModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Selecione o endereço</Text>
                <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {addresses.length === 0 ? (
                <View style={styles.emptyAddresses}>
                  <Text style={styles.emptyAddressesText}>Nenhum endereço cadastrado</Text>
                </View>
              ) : (
                addresses.map((address) => (
                  <TouchableOpacity
                    key={address.id}
                    style={[
                      styles.addressOption,
                      selectedAddress?.id === address.id && styles.addressOptionSelected,
                    ]}
                    onPress={() => handleAddressSelect(address)}
                  >
                    <View style={styles.addressOptionContent}>
                      <Text style={styles.addressOptionStreet}>
                        {address.street}, {address.number}
                      </Text>
                      <Text style={styles.addressOptionDetails}>
                        {address.neighborhood}, {address.city} - {address.state}
                      </Text>
                      {address.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Padrão</Text>
                        </View>
                      )}
                    </View>
                    {selectedAddress?.id === address.id && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        </Modal>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Forma de pagamento</Text>

          {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.value}
              style={[
                styles.paymentOption,
                selectedPayment === method.value && styles.paymentOptionSelected,
                !method.available && styles.paymentOptionDisabled,
              ]}
              onPress={() => {
                if (method.available) {
                  setSelectedPayment(method.value);
                } else {
                  Alert.alert(
                    'Indisponível',
                    'Este método de pagamento não está disponível no momento.'
                  );
                }
              }}
            >
              <Text style={[styles.paymentIcon, !method.available && styles.paymentIconDisabled]}>
                {method.icon}
              </Text>
              <View style={styles.paymentLabelContainer}>
                <Text style={[styles.paymentLabel, !method.available && styles.paymentLabelDisabled]}>
                  {method.label}
                </Text>
                {!method.available && (
                  <Text style={styles.paymentUnavailableText}>Indisponível</Text>
                )}
              </View>
              <View
                style={[
                  styles.radio,
                  selectedPayment === method.value && method.available && styles.radioSelected,
                  !method.available && styles.radioDisabled,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Observações</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Ex: Sem cebola, ponto da carne, etc"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo do pedido</Text>

          {items.map((item) => (
            <View key={item.menuItem.id} style={styles.summaryItem}>
              <Text style={styles.summaryItemName}>
                {item.quantity}x {item.menuItem.name}
              </Text>
              <Text style={styles.summaryItemPrice}>
                R$ {(Number(item.menuItem.price) * item.quantity).toFixed(2).replace('.', ',')}
              </Text>
            </View>
          ))}

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              R$ {subtotal.toFixed(2).replace('.', ',')}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxa de entrega</Text>
            <Text style={styles.summaryValue}>
              {deliveryFee === 0 ? 'Grátis' : `R$ ${deliveryFee.toFixed(2).replace('.', ',')}`}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              R$ {total.toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.placeOrderButton, isLoading && styles.buttonDisabled]}
          onPress={handlePlaceOrder}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.placeOrderText}>Finalizar pedido</Text>
              <Text style={styles.placeOrderTotal}>
                R$ {total.toFixed(2).replace('.', ',')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 8,
  },
  paymentOptionSelected: {
    borderColor: '#EA1D2C',
    backgroundColor: '#FFF5F5',
  },
  paymentOptionDisabled: {
    backgroundColor: '#f5f5f5',
    opacity: 0.7,
  },
  paymentIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  paymentIconDisabled: {
    opacity: 0.5,
  },
  paymentLabelContainer: {
    flex: 1,
  },
  paymentLabel: {
    fontSize: 16,
    color: '#333',
  },
  paymentLabelDisabled: {
    color: '#999',
  },
  paymentUnavailableText: {
    fontSize: 12,
    color: '#EA1D2C',
    marginTop: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  radioDisabled: {
    borderColor: '#ccc',
    backgroundColor: '#eee',
  },
  radioSelected: {
    borderColor: '#EA1D2C',
    backgroundColor: '#EA1D2C',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryItemName: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  summaryItemPrice: {
    fontSize: 14,
    color: '#333',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  placeOrderButton: {
    backgroundColor: '#f97316',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  placeOrderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeOrderTotal: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addressPreview: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  addressPreviewContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  addressPreviewInfo: {
    flex: 1,
  },
  addressPreviewStreet: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  addressPreviewComplement: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  addressPreviewDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  addressPreviewZip: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  changeText: {
    fontSize: 14,
    color: '#f97316',
    fontWeight: '600',
  },
  addressPreviewEmpty: {
    padding: 8,
  },
  addressPreviewEmptyText: {
    fontSize: 16,
    color: '#666',
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
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalClose: {
    fontSize: 20,
    color: '#666',
    padding: 4,
  },
  emptyAddresses: {
    padding: 20,
    alignItems: 'center',
  },
  emptyAddressesText: {
    fontSize: 16,
    color: '#666',
  },
  addressOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 12,
  },
  addressOptionSelected: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  addressOptionContent: {
    flex: 1,
  },
  addressOptionStreet: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  addressOptionDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  defaultBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  defaultBadgeText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#f97316',
    fontWeight: 'bold',
  },
  // Pix styles
  pixContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pixHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  pixIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  pixTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  pixSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrCode: {
    width: 220,
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  copyButton: {
    backgroundColor: '#f97316',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  timerWarning: {
    backgroundColor: '#fffbeb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 14,
    color: '#d97706',
  },
  amountBox: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
  },
  amountValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  cancelPixButton: {
    marginTop: 20,
    padding: 12,
  },
  cancelPixText: {
    fontSize: 16,
    color: '#666',
  },
});
