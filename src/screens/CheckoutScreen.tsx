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
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  ChevronRight,
  ShoppingCart,
  CreditCard,
  QrCode,
  Tag,
  Copy,
  Check,
  Clock,
  X
} from 'lucide-react-native';
import { useCart } from '../hooks/useCart';
import { useAddress } from '../hooks/useAddress';
import { useSavedCards, SavedCard, CardDataToSave, PaymentPreference, PaymentMethod } from '../hooks/useSavedCards';
import { useAuth } from '../hooks/useAuth';
import api, { orderService } from '../services/api';
import { Address } from '../types';
import { CardPaymentForm, SavedCard as CardPaymentSavedCard } from '../components/CardPaymentForm';
import { PaymentMethodsModal } from '../components/PaymentMethodsModal';

interface CardData {
  cardNumber: string;
  cardholderName: string;
  expirationMonth: string;
  expirationYear: string;
  securityCode: string;
  identificationType: string;
  identificationNumber: string;
}

interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  icon: string;
  available: boolean;
}

// Helper function to render payment icon based on method type
const renderPaymentIcon = (method: PaymentMethod, size: number = 24, color: string = '#333') => {
  switch (method) {
    case 'PIX':
      return <QrCode size={size} color={color} />;
    case 'CREDIT_CARD':
    case 'DEBIT_CARD':
      return <CreditCard size={size} color={color} />;
    default:
      return <CreditCard size={size} color={color} />;
  }
};

interface PixData {
  pixQrCode: string;
  pixCode: string;
}

export function CheckoutScreen() {
  const navigation = useNavigation<any>();
  const { items, restaurant, subtotal, deliveryFee, total, clearCart } = useCart();
  const { addresses, selectedAddress, selectAddress } = useAddress();
  const { savedCards, saveCard, loadSavedCards, paymentPreference, savePaymentPreference, getPreferredCard } = useSavedCards();
  const { user } = useAuth();
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('PIX');
  const [selectedSavedCard, setSelectedSavedCard] = useState<SavedCard | null>(null);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingCardDataForSave, setPendingCardDataForSave] = useState<CardData | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([
    { value: 'PIX', label: 'Pix', icon: '💠', available: true },
    { value: 'CREDIT_CARD', label: 'Cartão de crédito', icon: '💳', available: true },
    { value: 'DEBIT_CARD', label: 'Cartão de débito', icon: '💳', available: true },
  ]);

  // Load available payment methods
  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        const response = await api.get('/payments/available-methods');
        console.log('[CheckoutScreen] Payment methods from API:', response.data);
        // Only update if we get valid data
        if (response.data?.methods && Array.isArray(response.data.methods) && response.data.methods.length > 0) {
          setPaymentMethods(response.data.methods);
        }
      } catch (error) {
        console.error('Error loading payment methods:', error);
        // Keep default payment methods on error
      }
    };
    loadPaymentMethods();
  }, []);

  // Load saved payment preference
  useEffect(() => {
    if (!preferenceLoaded && paymentPreference) {
      console.log('[CheckoutScreen] Loading saved payment preference:', paymentPreference);
      setSelectedPayment(paymentPreference.method);

      // If there's a saved card preference, find and select it
      if (paymentPreference.savedCardId && savedCards.length > 0) {
        const preferredCard = savedCards.find(c => c.id === paymentPreference.savedCardId);
        if (preferredCard) {
          setSelectedSavedCard(preferredCard);
          console.log('[CheckoutScreen] Selected preferred card:', preferredCard.lastFourDigits);
        }
      }
      setPreferenceLoaded(true);
    }
  }, [paymentPreference, savedCards, preferenceLoaded]);

  const handleAddressSelect = (address: Address) => {
    selectAddress(address);
    setShowAddressModal(false);
  };

  // Handle payment method selection from modal
  const handlePaymentMethodSelect = (method: PaymentMethod, savedCard?: SavedCard) => {
    setSelectedPayment(method);
    setSelectedSavedCard(savedCard || null);

    // Save the preference for next time
    const preference: PaymentPreference = {
      method,
      savedCardId: savedCard?.id,
    };
    savePaymentPreference(preference);
    console.log('[CheckoutScreen] Saved payment preference:', preference);
  };

  // Get display info for selected payment method
  const getPaymentDisplayInfo = () => {
    if (selectedSavedCard) {
      return {
        paymentType: selectedSavedCard.type === 'credit' ? 'CREDIT_CARD' as PaymentMethod : 'DEBIT_CARD' as PaymentMethod,
        label: `${selectedSavedCard.brand} •••• ${selectedSavedCard.lastFourDigits}`,
        description: selectedSavedCard.type === 'credit' ? 'Cartão de crédito' : 'Cartão de débito',
      };
    }
    const method = paymentMethods.find((m) => m.value === selectedPayment);
    return {
      paymentType: selectedPayment,
      label: method?.label || 'Selecione',
      description: selectedPayment === 'PIX' ? 'Pagamento instantâneo' :
                   selectedPayment === 'CREDIT_CARD' ? 'Pague com cartão de crédito' :
                   selectedPayment === 'DEBIT_CARD' ? 'Pague com cartão de débito' : '',
    };
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
        <View style={styles.emptyIconContainer}>
          <ShoppingCart size={64} color="#ccc" />
        </View>
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
        // If user has selected a saved card, we still need to show the form to get CVV
        // For security reasons, CVV is never stored
        setIsLoading(false);
        setPendingOrder(order);
        setShowCardForm(true);
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

  // Handle card payment submission (new card)
  const handleCardPayment = async (cardData: CardData) => {
    if (!pendingOrder) {
      Alert.alert('Erro', 'Pedido nao encontrado');
      return;
    }

    setIsLoading(true);
    try {
      const paymentData = {
        orderId: pendingOrder.id,
        method: selectedPayment,
        cardData: {
          cardNumber: cardData.cardNumber.replace(/\s/g, ''),
          cardholderName: cardData.cardholderName,
          expirationMonth: cardData.expirationMonth,
          expirationYear: cardData.expirationYear,
          securityCode: cardData.securityCode,
          identificationType: cardData.identificationType,
          identificationNumber: cardData.identificationNumber.replace(/\D/g, ''),
        },
      };

      console.log('Processing card payment:', JSON.stringify({ ...paymentData, cardData: '***' }, null, 2));
      const response = await api.post('/payments/process', paymentData);
      console.log('Payment response:', response.data);

      // Guardar dados do cartao para possivel salvamento
      setPendingCardDataForSave(cardData);

      setShowCardForm(false);
      setPendingOrder(null);
      setIsLoading(false);
      clearCart();

      // Perguntar se quer salvar o cartao
      Alert.alert(
        'Pagamento aprovado!',
        `Seu pedido #${pendingOrder?.orderNumber || 'N/A'} foi confirmado.\n\nDeseja salvar este cartao para compras futuras?`,
        [
          {
            text: 'Nao',
            style: 'cancel',
            onPress: () => {
              setPendingCardDataForSave(null);
              navigation.navigate('Main', { screen: 'Orders' });
            },
          },
          {
            text: 'Salvar',
            onPress: async () => {
              try {
                const cardToSave: CardDataToSave = {
                  cardNumber: cardData.cardNumber.replace(/\s/g, ''),
                  cardholderName: cardData.cardholderName.toUpperCase(),
                  expirationMonth: cardData.expirationMonth,
                  expirationYear: cardData.expirationYear,
                  securityCode: cardData.securityCode,
                  identificationType: cardData.identificationType,
                  identificationNumber: cardData.identificationNumber.replace(/\D/g, ''),
                };
                console.log('[CheckoutScreen] Saving card via MP Customer API...');
                await saveCard(cardToSave);
                console.log('[CheckoutScreen] Card saved successfully');
                Alert.alert('Cartao salvo!', 'Seu cartao foi salvo com sucesso.');
              } catch (error: any) {
                console.error('[CheckoutScreen] Error saving card:', error);
                Alert.alert('Erro', error?.message || 'Nao foi possivel salvar o cartao.');
              }
              setPendingCardDataForSave(null);
              navigation.navigate('Main', { screen: 'Orders' });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Card payment error:', error);
      setIsLoading(false);
      const errorMessage = error?.response?.data?.message || error?.message || 'Erro ao processar pagamento';
      Alert.alert('Erro no pagamento', errorMessage);
    }
  };

  // Handle payment with saved card (only CVV needed)
  const handleSavedCardPayment = async (savedCardId: string, securityCode: string) => {
    if (!pendingOrder) {
      Alert.alert('Erro', 'Pedido nao encontrado');
      return;
    }

    setIsLoading(true);
    try {
      const paymentData = {
        orderId: pendingOrder.id,
        method: selectedPayment,
        savedCardId,
        securityCode,
      };

      console.log('Processing saved card payment:', JSON.stringify({ ...paymentData, securityCode: '***' }, null, 2));
      const response = await api.post('/payments/process', paymentData);
      console.log('Payment response:', response.data);

      setShowCardForm(false);
      setPendingOrder(null);
      setIsLoading(false);
      clearCart();

      Alert.alert(
        'Pagamento aprovado!',
        `Seu pedido #${pendingOrder?.orderNumber || 'N/A'} foi confirmado.`,
        [
          {
            text: 'Ver pedidos',
            onPress: () => navigation.navigate('Main', { screen: 'Orders' }),
          },
        ]
      );
    } catch (error: any) {
      console.error('Saved card payment error:', error);
      setIsLoading(false);
      const errorMessage = error?.response?.data?.message || error?.message || 'Erro ao processar pagamento';
      Alert.alert('Erro no pagamento', errorMessage);
    }
  };

  // Handle payment with Stripe saved card (1-click, NO CVV needed!)
  const handleStripeCardPayment = async (savedCardId: string) => {
    if (!pendingOrder) {
      Alert.alert('Erro', 'Pedido nao encontrado');
      return;
    }

    setIsLoading(true);
    try {
      const paymentData = {
        orderId: pendingOrder.id,
        method: selectedPayment,
        savedCardId,
        // Note: No securityCode for Stripe!
      };

      console.log('Processing Stripe 1-click payment:', JSON.stringify(paymentData, null, 2));
      const response = await api.post('/payments/process', paymentData);
      console.log('Payment response:', response.data);

      setShowCardForm(false);
      setPendingOrder(null);
      setIsLoading(false);
      clearCart();

      Alert.alert(
        'Pagamento aprovado!',
        `Seu pedido #${pendingOrder?.orderNumber || 'N/A'} foi confirmado.\n\nPagamento processado com 1 clique via Stripe!`,
        [
          {
            text: 'Ver pedidos',
            onPress: () => navigation.navigate('Main', { screen: 'Orders' }),
          },
        ]
      );
    } catch (error: any) {
      console.error('Stripe card payment error:', error);
      setIsLoading(false);
      const errorMessage = error?.response?.data?.message || error?.message || 'Erro ao processar pagamento';
      Alert.alert('Erro no pagamento', errorMessage);
    }
  };

  // Helper function to detect card brand
  const getCardBrand = (cardNumber: string): string => {
    const number = cardNumber.replace(/\s/g, '');
    if (/^4/.test(number)) return 'Visa';
    if (/^5[1-5]/.test(number)) return 'Mastercard';
    if (/^3[47]/.test(number)) return 'Amex';
    if (/^(636368|636369|438935|504175|451416|636297|5067|4576|4011)/.test(number)) return 'Elo';
    if (/^(606282|3841)/.test(number)) return 'Hipercard';
    return 'Cartão';
  };

  // Handle card form cancel
  const handleCardCancel = () => {
    setShowCardForm(false);
    setPendingOrder(null);
  };

  // Show card payment form
  if (showCardForm && pendingOrder) {
    // CPF do usuario e usado como sugestao, mas pode ser alterado no formulario
    const userCpf = user?.customer?.cpf;

    // Converter selectedSavedCard para o formato esperado pelo CardPaymentForm
    const preselectedCard: CardPaymentSavedCard | undefined = selectedSavedCard ? {
      id: selectedSavedCard.id,
      provider: selectedSavedCard.provider,
      mpCardId: selectedSavedCard.mpCardId,
      stripePaymentMethodId: selectedSavedCard.stripePaymentMethodId,
      lastFourDigits: selectedSavedCard.lastFourDigits,
      expirationMonth: selectedSavedCard.expirationMonth,
      expirationYear: selectedSavedCard.expirationYear,
      cardholderName: selectedSavedCard.cardholderName,
      brand: selectedSavedCard.brand,
      isDefault: selectedSavedCard.isDefault,
    } : undefined;

    return (
      <SafeAreaView style={styles.container}>
        <CardPaymentForm
          amount={total}
          onSubmit={handleCardPayment}
          onSubmitWithSavedCard={handleSavedCardPayment}
          onSubmitWithStripeCard={handleStripeCardPayment}
          onCancel={handleCardCancel}
          isLoading={isLoading}
          userCpf={userCpf}
          preselectedCard={preselectedCard}
        />
      </SafeAreaView>
    );
  }

  // Show Pix QR Code screen
  if (pixData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBackButton}
            onPress={() => {
              setPixData(null);
              setOrderId(null);
            }}
          >
            <ArrowLeft size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pagamento Pix</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.pixContainer}>
          <View style={styles.pixHeader}>
            <View style={styles.pixIconContainer}>
              <QrCode size={48} color="#00A859" />
            </View>
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
            {copied ? (
              <View style={styles.copyButtonContent}>
                <Check size={20} color="#fff" />
                <Text style={styles.copyButtonText}>Copiado!</Text>
              </View>
            ) : (
              <View style={styles.copyButtonContent}>
                <Copy size={20} color="#fff" />
                <Text style={styles.copyButtonText}>Copiar código Pix</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.timerWarning}>
            <View style={styles.timerContent}>
              <Clock size={16} color="#d97706" />
              <Text style={styles.timerText}>O código expira em 30 minutos</Text>
            </View>
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

        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sacola</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Restaurant Info */}
        {restaurant && (
          <TouchableOpacity
            style={styles.restaurantCard}
            onPress={() => navigation.navigate('Restaurant', { slug: restaurant.slug })}
          >
            {restaurant.logoUrl && (
              <Image source={{ uri: restaurant.logoUrl }} style={styles.restaurantLogo} />
            )}
            <View style={styles.restaurantInfo}>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
              <Text style={styles.addMoreText}>Adicionar mais itens</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Payment Section - iFood style */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentSectionTitle}>Pagamento pelo app</Text>

          <TouchableOpacity
            style={styles.paymentCard}
            onPress={() => setShowPaymentModal(true)}
          >
            <View style={styles.paymentCardLeft}>
              <View style={styles.paymentCardIconContainer}>
                {renderPaymentIcon(getPaymentDisplayInfo().paymentType, 24, '#333')}
              </View>
              <View style={styles.paymentCardInfo}>
                <Text style={styles.paymentCardLabel}>
                  {getPaymentDisplayInfo().label}
                </Text>
                <Text style={styles.paymentCardDescription}>
                  {getPaymentDisplayInfo().description}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Payment Methods Modal */}
        <PaymentMethodsModal
          visible={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          selectedPayment={selectedPayment}
          onSelectPayment={handlePaymentMethodSelect}
          paymentMethods={paymentMethods}
          savedCards={savedCards}
          selectedSavedCard={selectedSavedCard}
          onAddNewCard={() => {
            setShowPaymentModal(false);
            navigation.navigate('AddCard');
          }}
        />

        {/* Coupon Section */}
        <TouchableOpacity style={styles.couponSection}>
          <View style={styles.couponLeft}>
            <View style={styles.couponIconContainer}>
              <Tag size={20} color="#666" />
            </View>
            <View style={styles.couponInfo}>
              <Text style={styles.couponTitle}>Cupom</Text>
              <Text style={styles.couponSubtitle}>Adicionar cupom de desconto</Text>
            </View>
          </View>
          <Text style={styles.couponAction}>Adicionar</Text>
        </TouchableOpacity>

        {/* Delivery Address */}
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
                <TouchableOpacity onPress={() => setShowAddressModal(false)} style={styles.modalCloseButton}>
                  <X size={24} color="#666" />
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
                      <Check size={20} color="#f97316" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        </Modal>

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

        {/* Order Summary - iFood style */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Resumo de valores</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              R$ {subtotal.toFixed(2).replace('.', ',')}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxa de entrega</Text>
            <Text style={[styles.summaryValue, deliveryFee === 0 && styles.freeDelivery]}>
              {deliveryFee === 0 ? 'Grátis' : `R$ ${deliveryFee.toFixed(2).replace('.', ',')}`}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.serviceFeeRow}>
              <Text style={styles.summaryLabel}>Taxa de serviço</Text>
              <TouchableOpacity style={styles.infoButton}>
                <Text style={styles.infoIcon}>?</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.summaryValue}>R$ 0,99</Text>
          </View>

          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              R$ {(total + 0.99).toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </View>

        {/* Items List */}
        <View style={styles.itemsSection}>
          <Text style={styles.itemsSectionTitle}>Itens do pedido</Text>
          {items.map((item) => (
            <View key={item.menuItem.id} style={styles.orderItem}>
              <View style={styles.orderItemLeft}>
                <Text style={styles.orderItemQty}>{item.quantity}x</Text>
                <Text style={styles.orderItemName}>{item.menuItem.name}</Text>
              </View>
              <Text style={styles.orderItemPrice}>
                R$ {(Number(item.menuItem.price) * item.quantity).toFixed(2).replace('.', ',')}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Footer - iFood style */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.placeOrderButton, isLoading && styles.buttonDisabled]}
          onPress={handlePlaceOrder}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.placeOrderText}>
              Revisar pedido • R$ {(total + 0.99).toFixed(2).replace('.', ',')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerBackButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 40,
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
  emptyIconContainer: {
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
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  placeOrderButton: {
    backgroundColor: '#EA1D2C',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  placeOrderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  modalCloseButton: {
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
  pixIconContainer: {
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
  copyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  timerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  // Restaurant Card styles (iFood style)
  restaurantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 8,
    borderBottomColor: '#f5f5f5',
  },
  restaurantLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3E3E3E',
  },
  addMoreText: {
    fontSize: 14,
    color: '#EA1D2C',
    marginTop: 2,
  },
  // Payment Section styles (iFood style)
  paymentSection: {
    padding: 16,
    borderBottomWidth: 8,
    borderBottomColor: '#f5f5f5',
  },
  paymentSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 12,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  paymentCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentCardIconContainer: {
    marginRight: 12,
  },
  paymentCardInfo: {
    flex: 1,
  },
  paymentCardLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3E3E3E',
  },
  paymentCardDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  // Coupon Section styles (iFood style)
  couponSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 8,
    borderBottomColor: '#f5f5f5',
  },
  couponLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  couponIconContainer: {
    marginRight: 12,
  },
  couponInfo: {
    flex: 1,
  },
  couponTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3E3E3E',
  },
  couponSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  couponAction: {
    fontSize: 14,
    color: '#EA1D2C',
    fontWeight: '500',
    marginLeft: 12,
  },
  // Summary Section styles (iFood style)
  summarySection: {
    padding: 16,
    borderBottomWidth: 8,
    borderBottomColor: '#f5f5f5',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3E3E3E',
    marginBottom: 16,
  },
  freeDelivery: {
    color: '#50A773',
  },
  serviceFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoButton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  infoIcon: {
    fontSize: 10,
    color: '#666',
    fontWeight: 'bold',
  },
  // Items Section styles
  itemsSection: {
    padding: 16,
  },
  itemsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  orderItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  orderItemQty: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
    minWidth: 24,
  },
  orderItemName: {
    fontSize: 14,
    color: '#3E3E3E',
    flex: 1,
  },
  orderItemPrice: {
    fontSize: 14,
    color: '#3E3E3E',
  },
});
