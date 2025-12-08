import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { X, ChevronRight, CreditCard, Wallet, Plus, QrCode } from 'lucide-react-native';
import { SavedCard } from '../hooks/useSavedCards';

type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH';

interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  icon: string;
  description?: string;
  available: boolean;
}

interface PaymentMethodsModalProps {
  visible: boolean;
  onClose: () => void;
  selectedPayment: PaymentMethod;
  onSelectPayment: (method: PaymentMethod, savedCard?: SavedCard) => void;
  paymentMethods: PaymentMethodOption[];
  savedCards?: SavedCard[];
  selectedSavedCard?: SavedCard | null;
  onAddNewCard?: () => void;
}

type TabType = 'app' | 'delivery';

// Cores das bandeiras de cartão para mostrar no placeholder
const CARD_BRAND_COLORS: Record<string, string> = {
  visa: '#1A1F71',
  mastercard: '#EB001B',
  elo: '#FFCB05',
  amex: '#006FCF',
  hipercard: '#822124',
  diners: '#004A97',
  discover: '#FF6000',
  jcb: '#0B7A3F',
};

const getCardBrandColor = (brand: string): string => {
  const normalizedBrand = brand.toLowerCase();
  return CARD_BRAND_COLORS[normalizedBrand] || '#666';
};

// Helper function to render payment icon based on method type
const renderPaymentMethodIcon = (methodValue: PaymentMethod, size: number = 24, color: string = '#333') => {
  switch (methodValue) {
    case 'PIX':
      return <QrCode size={size} color={color} />;
    case 'CREDIT_CARD':
    case 'DEBIT_CARD':
      return <CreditCard size={size} color={color} />;
    default:
      return <CreditCard size={size} color={color} />;
  }
};

export function PaymentMethodsModal({
  visible,
  onClose,
  selectedPayment,
  onSelectPayment,
  paymentMethods,
  savedCards = [],
  selectedSavedCard,
  onAddNewCard,
}: PaymentMethodsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('app');

  // Debug log
  console.log('[PaymentMethodsModal] Rendering with:', {
    visible,
    savedCardsCount: savedCards.length,
    savedCards: JSON.stringify(savedCards),
    paymentMethodsCount: paymentMethods.length,
    paymentMethods: JSON.stringify(paymentMethods),
    activeTab,
  });

  // Filtra métodos por tipo de pagamento (remove CASH pois não está disponível)
  const appPaymentMethods = paymentMethods.filter(
    (m) => m.value !== 'CASH'
  );
  // Mantém apenas PIX e cartões para entrega (sem CASH)
  const deliveryPaymentMethods = paymentMethods.filter(
    (m) => m.value === 'CREDIT_CARD' || m.value === 'DEBIT_CARD'
  );

  const handleSelectMethod = (method: PaymentMethod, card?: SavedCard) => {
    onSelectPayment(method, card);
    onClose();
  };

  const handleSelectSavedCard = (card: SavedCard) => {
    // Com o novo formato MP, sempre usamos CREDIT_CARD (o tipo é determinado pelo cartão salvo)
    onSelectPayment('CREDIT_CARD' as PaymentMethod, card);
    onClose();
  };

  const renderPaymentOption = (method: PaymentMethodOption, showArrow = false) => {
    const isSelected = selectedPayment === method.value;

    return (
      <TouchableOpacity
        key={method.value}
        style={[
          styles.paymentOption,
          isSelected && styles.paymentOptionSelected,
          !method.available && styles.paymentOptionDisabled,
        ]}
        onPress={() => method.available && handleSelectMethod(method.value)}
        disabled={!method.available}
      >
        <View style={styles.paymentOptionLeft}>
          <View style={styles.paymentIconContainer}>
            {renderPaymentMethodIcon(method.value, 24, method.available ? '#333' : '#999')}
          </View>
          <View style={styles.paymentInfo}>
            <Text
              style={[
                styles.paymentLabel,
                !method.available && styles.paymentLabelDisabled,
              ]}
            >
              {method.label}
            </Text>
            {method.description && (
              <Text style={styles.paymentDescription}>{method.description}</Text>
            )}
            {!method.available && (
              <Text style={styles.unavailableText}>Indisponível</Text>
            )}
          </View>
        </View>
        {showArrow ? (
          <ChevronRight size={20} color="#999" />
        ) : (
          <View
            style={[
              styles.radio,
              isSelected && styles.radioSelected,
              !method.available && styles.radioDisabled,
            ]}
          >
            {isSelected && <View style={styles.radioInner} />}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSavedCard = (card: SavedCard) => {
    const isSelected = selectedSavedCard?.id === card.id;
    const brandColor = getCardBrandColor(card.brand);

    // Formatar nome da bandeira
    const formatBrandName = (brand: string) => {
      const brandMap: Record<string, string> = {
        'visa': 'Visa',
        'master': 'Mastercard',
        'mastercard': 'Mastercard',
        'elo': 'Elo',
        'amex': 'Amex',
        'hipercard': 'Hipercard',
      };
      return brandMap[brand.toLowerCase()] || brand;
    };

    return (
      <TouchableOpacity
        key={card.id}
        style={[styles.savedCardOption, isSelected && styles.savedCardSelected]}
        onPress={() => handleSelectSavedCard(card)}
      >
        <View style={styles.savedCardLeft}>
          <View style={[styles.cardIconPlaceholder, { backgroundColor: brandColor + '15' }]}>
            <CreditCard size={20} color={brandColor} />
          </View>
          <View style={styles.savedCardInfo}>
            <Text style={styles.savedCardName}>
              {formatBrandName(card.brand)} **** {card.lastFourDigits}
            </Text>
            <Text style={styles.savedCardDigits}>{card.cardholderName}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.cardMenuButton}>
          <Text style={styles.cardMenuDots}>•••</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Formas de pagamento</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'app' && styles.tabActive]}
              onPress={() => setActiveTab('app')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'app' && styles.tabTextActive,
                ]}
              >
                PAGUE PELO APP
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'delivery' && styles.tabActive]}
              onPress={() => setActiveTab('delivery')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'delivery' && styles.tabTextActive,
                ]}
              >
                PAGUE NA ENTREGA
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {activeTab === 'app' ? (
              <>
                {/* Carteira / Saldo */}
                <TouchableOpacity style={styles.walletSection}>
                  <View style={styles.walletLeft}>
                    <Wallet size={24} color="#333" />
                    <View style={styles.walletInfo}>
                      <Text style={styles.walletTitle}>Saldo da carteira</Text>
                      <Text style={styles.walletBalance}>R$ 0,00</Text>
                    </View>
                  </View>
                  <View style={styles.walletToggle}>
                    <View style={styles.toggleTrack}>
                      <View style={styles.toggleThumb} />
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Cartões salvos - mostrar primeiro se houver */}
                {savedCards.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Seus cartões</Text>
                    {savedCards.map(renderSavedCard)}
                  </>
                )}

                {/* Outras formas de pagamento */}
                <Text style={styles.sectionTitle}>Outras formas de pagamento</Text>

                {/* Pix */}
                {appPaymentMethods
                  .filter((m) => m.value === 'PIX')
                  .map((method) => renderPaymentOption(method))}
              </>
            ) : (
              <>
                {/* Pagamento na entrega */}
                <Text style={styles.sectionTitle}>Formas de pagamento</Text>

                {/* Dinheiro */}
                {deliveryPaymentMethods
                  .filter((m) => m.value === 'CASH')
                  .map((method) => renderPaymentOption(method))}

                {/* Cartão na entrega */}
                <View style={styles.deliveryCardSection}>
                  <Text style={styles.deliveryCardTitle}>Cartão na entrega</Text>
                  <Text style={styles.deliveryCardDescription}>
                    Pague com cartão de crédito ou débito na máquina do entregador
                  </Text>
                  {deliveryPaymentMethods
                    .filter((m) => m.value === 'CREDIT_CARD' || m.value === 'DEBIT_CARD')
                    .map((method) => renderPaymentOption({
                      ...method,
                      label: method.value === 'CREDIT_CARD' ? 'Crédito na entrega' : 'Débito na entrega',
                    }))}
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer - Adicionar novo cartão */}
          {activeTab === 'app' && onAddNewCard && (
            <TouchableOpacity style={styles.addCardButton} onPress={onAddNewCard}>
              <Plus size={20} color="#fff" />
              <Text style={styles.addCardButtonText}>Adicionar novo cartão</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: 400,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 32,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#EA1D2C',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: '#EA1D2C',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  walletSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 24,
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletInfo: {
    marginLeft: 12,
  },
  walletTitle: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  walletBalance: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  walletToggle: {
    width: 50,
    height: 28,
  },
  toggleTrack: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 8,
  },
  paymentOptionSelected: {
    borderColor: '#EA1D2C',
    backgroundColor: '#FFF5F5',
  },
  paymentOptionDisabled: {
    backgroundColor: '#f9f9f9',
    opacity: 0.7,
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentIconContainer: {
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  paymentLabelDisabled: {
    color: '#999',
  },
  paymentDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  unavailableText: {
    fontSize: 12,
    color: '#EA1D2C',
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#EA1D2C',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EA1D2C',
  },
  radioDisabled: {
    borderColor: '#ccc',
    backgroundColor: '#f5f5f5',
  },
  savedCardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 8,
  },
  savedCardSelected: {
    borderColor: '#EA1D2C',
    backgroundColor: '#FFF5F5',
  },
  savedCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardIconPlaceholder: {
    width: 40,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    marginRight: 12,
  },
  savedCardInfo: {
    flex: 1,
  },
  savedCardName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  savedCardDigits: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  cardMenuButton: {
    padding: 8,
  },
  cardMenuDots: {
    fontSize: 16,
    color: '#999',
    letterSpacing: 2,
  },
  deliveryCardSection: {
    marginTop: 16,
  },
  deliveryCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  deliveryCardDescription: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EA1D2C',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  addCardButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
