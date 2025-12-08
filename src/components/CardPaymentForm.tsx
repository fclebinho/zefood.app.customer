import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { CreditCard, Lock } from 'lucide-react-native';

interface CardData {
  cardNumber: string;
  cardholderName: string;
  expirationMonth: string;
  expirationYear: string;
  securityCode: string;
  identificationType: string;
  identificationNumber: string;
}

// Provider types
export type CardProvider = 'MERCADOPAGO' | 'STRIPE';

// Cartao salvo via MP Customer API ou Stripe
export interface SavedCard {
  id: string;
  provider: CardProvider;
  mpCardId?: string;
  stripePaymentMethodId?: string;
  lastFourDigits: string;
  expirationMonth: number;
  expirationYear: number;
  cardholderName: string;
  brand: string;
  isDefault: boolean;
}

interface CardPaymentFormProps {
  amount: number;
  onSubmit: (cardData: CardData) => Promise<void>;
  onSubmitWithSavedCard: (savedCardId: string, securityCode: string) => Promise<void>;
  onSubmitWithStripeCard: (savedCardId: string) => Promise<void>; // Stripe 1-click (no CVV)
  onCancel: () => void;
  onDeleteCard?: (cardId: string) => Promise<void>;
  isLoading?: boolean;
  savedCards?: SavedCard[];
  userCpf?: string;
  preselectedCard?: SavedCard; // Card already selected in PaymentMethodsModal
}

// Card brand detection
function getCardBrand(cardNumber: string): string {
  const number = cardNumber.replace(/\s/g, '');

  if (/^4/.test(number)) return 'visa';
  if (/^5[1-5]/.test(number)) return 'mastercard';
  if (/^3[47]/.test(number)) return 'amex';
  if (/^6(?:011|5)/.test(number)) return 'discover';
  if (/^(?:2131|1800|35)/.test(number)) return 'jcb';
  if (/^3(?:0[0-5]|[68])/.test(number)) return 'diners';
  if (/^(636368|636369|438935|504175|451416|636297|5067|4576|4011)/.test(number)) return 'elo';
  if (/^(606282|3841)/.test(number)) return 'hipercard';

  return 'unknown';
}

// Format card number with spaces
function formatCardNumber(value: string): string {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  const matches = v.match(/\d{4,16}/g);
  const match = (matches && matches[0]) || '';
  const parts = [];

  for (let i = 0, len = match.length; i < len; i += 4) {
    parts.push(match.substring(i, i + 4));
  }

  if (parts.length) {
    return parts.join(' ');
  } else {
    return value;
  }
}

// Format expiration date
function formatExpiration(value: string): string {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  if (v.length >= 2) {
    return v.substring(0, 2) + '/' + v.substring(2, 4);
  }
  return v;
}

// Format CPF: 000.000.000-00
function formatCPF(value: string): string {
  const v = value.replace(/\D/g, '');
  if (v.length <= 3) return v;
  if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
  if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
  return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9, 11)}`;
}

function getCardBrandName(brand: string): string {
  switch (brand?.toLowerCase()) {
    case 'visa':
      return 'Visa';
    case 'master':
    case 'mastercard':
      return 'Mastercard';
    case 'amex':
      return 'Amex';
    case 'elo':
      return 'Elo';
    case 'hipercard':
      return 'Hipercard';
    default:
      return brand || '';
  }
}

export function CardPaymentForm({
  amount,
  onSubmit,
  onSubmitWithSavedCard,
  onSubmitWithStripeCard,
  onCancel,
  onDeleteCard,
  isLoading = false,
  savedCards = [],
  userCpf,
  preselectedCard,
}: CardPaymentFormProps) {
  // If a card is preselected (from PaymentMethodsModal), go directly to 'saved' mode
  // Otherwise, go to 'new' mode (no more card selection screen here)
  const [mode, setMode] = useState<'saved' | 'new'>(
    preselectedCard ? 'saved' : 'new'
  );
  const [selectedCard, setSelectedCard] = useState<SavedCard | null>(
    preselectedCard || null
  );

  // New card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [expiration, setExpiration] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [cpf, setCpf] = useState(userCpf ? formatCPF(userCpf) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cardBrand, setCardBrand] = useState('unknown');
  const [saveCard, setSaveCard] = useState(true);

  // Refs for focus
  const nameRef = useRef<TextInput>(null);
  const expirationRef = useRef<TextInput>(null);
  const cvvRef = useRef<TextInput>(null);
  const cpfRef = useRef<TextInput>(null);

  const handleCardNumberChange = (value: string) => {
    const formatted = formatCardNumber(value);
    setCardNumber(formatted);
    setCardBrand(getCardBrand(formatted));

    if (formatted.replace(/\s/g, '').length === 16) {
      nameRef.current?.focus();
    }
  };

  const handleExpirationChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 4) {
      setExpiration(formatExpiration(cleaned));
      if (cleaned.length === 4) {
        cvvRef.current?.focus();
      }
    }
  };

  const handleSecurityCodeChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 4) {
      setSecurityCode(cleaned);
      if (cleaned.length >= 3 && mode === 'new' && !cpf) {
        cpfRef.current?.focus();
      }
    }
  };

  const handleCpfChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      setCpf(formatCPF(cleaned));
    }
  };

  const validateNewCard = (): boolean => {
    const newErrors: Record<string, string> = {};

    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    if (!cleanCardNumber || cleanCardNumber.length < 13) {
      newErrors.cardNumber = 'Numero do cartao invalido';
    }

    if (!cardholderName || cardholderName.length < 3) {
      newErrors.cardholderName = 'Nome invalido';
    }

    const [month, year] = expiration.split('/');
    if (!month || !year || parseInt(month) < 1 || parseInt(month) > 12) {
      newErrors.expiration = 'Data invalida';
    }

    if (!securityCode || securityCode.length < 3) {
      newErrors.securityCode = 'CVV invalido';
    }

    const cleanCpf = cpf.replace(/\D/g, '');
    if (!cleanCpf || cleanCpf.length !== 11) {
      newErrors.cpf = 'CPF do titular invalido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSavedCard = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!securityCode || securityCode.length < 3) {
      newErrors.securityCode = 'CVV invalido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitNewCard = async () => {
    if (!validateNewCard()) return;

    try {
      const [month, year] = expiration.split('/');
      const fullYear = year.length === 2 ? `20${year}` : year;

      const cardData: CardData = {
        cardNumber: cardNumber.replace(/\s/g, ''),
        cardholderName: cardholderName.toUpperCase(),
        expirationMonth: month,
        expirationYear: fullYear,
        securityCode,
        identificationType: 'CPF',
        identificationNumber: cpf.replace(/\D/g, ''),
      };

      console.log('Processing new card payment...');
      await onSubmit(cardData);
    } catch (error: any) {
      console.error('Card payment error:', error);
      Alert.alert(
        'Erro no Pagamento',
        error?.response?.data?.message || error?.message || 'Erro ao processar pagamento. Verifique os dados do cartao.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSubmitSavedCard = async () => {
    if (!selectedCard) return;
    if (!validateSavedCard()) return;

    try {
      console.log('Processing saved card payment...');
      await onSubmitWithSavedCard(selectedCard.id, securityCode);
    } catch (error: any) {
      console.error('Saved card payment error:', error);
      Alert.alert(
        'Erro no Pagamento',
        error?.response?.data?.message || error?.message || 'Erro ao processar pagamento.',
        [{ text: 'OK' }]
      );
    }
  };

  // Handler for Stripe 1-click payment
  const handleSubmitStripeCard = async () => {
    if (!selectedCard) return;

    try {
      console.log('Processing Stripe 1-click payment...');
      await onSubmitWithStripeCard(selectedCard.id);
    } catch (error: any) {
      console.error('Stripe card payment error:', error);
      Alert.alert(
        'Erro no Pagamento',
        error?.response?.data?.message || error?.message || 'Erro ao processar pagamento.',
        [{ text: 'OK' }]
      );
    }
  };

  // Saved card - Stripe (1-click, no CVV) or MP (with CVV)
  if (mode === 'saved' && selectedCard) {
    const isStripe = selectedCard.provider === 'STRIPE';

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <CreditCard size={32} color={isStripe ? '#6772E5' : '#EA1D2C'} />
            <Text style={styles.title}>
              {isStripe ? 'Pagamento 1-clique' : 'Confirme o pagamento'}
            </Text>
            {isStripe && (
              <Text style={styles.subtitleStripe}>Sem necessidade de digitar CVV</Text>
            )}
          </View>

          {/* Selected card info */}
          <View style={[styles.selectedCardBanner, isStripe && styles.selectedCardBannerStripe]}>
            <CreditCard size={28} color={isStripe ? '#6772E5' : '#50A773'} />
            <View style={styles.selectedCardInfo}>
              <Text style={styles.selectedCardBrand}>
                {getCardBrandName(selectedCard.brand)} **** {selectedCard.lastFourDigits}
              </Text>
              <Text style={styles.selectedCardName}>{selectedCard.cardholderName}</Text>
            </View>
            {/* User can change card via PaymentMethodsModal, not here */}
          </View>

          {/* CVV input - only for Mercado Pago cards */}
          {!isStripe && (
            <View style={styles.cvvSection}>
              <Text style={styles.cvvLabel}>Digite o codigo de seguranca (CVV)</Text>
              <TextInput
                style={[styles.cvvInput, errors.securityCode && styles.inputError]}
                placeholder="***"
                placeholderTextColor="#999"
                value={securityCode}
                onChangeText={handleSecurityCodeChange}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
                autoFocus
              />
              {errors.securityCode && (
                <Text style={styles.errorText}>{errors.securityCode}</Text>
              )}
              <Text style={styles.cvvHint}>
                Codigo de 3 ou 4 digitos no verso do cartao
              </Text>
            </View>
          )}

          {/* Stripe 1-click info */}
          {isStripe && (
            <View style={styles.stripeInfoBox}>
              <Text style={styles.stripeInfoTitle}>Pagamento instantaneo</Text>
              <Text style={styles.stripeInfoText}>
                Cartoes salvos via Stripe permitem pagamento com 1 clique,
                sem precisar digitar o CVV novamente!
              </Text>
            </View>
          )}

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Lock size={16} color="#666" />
            <Text style={styles.securityText}>
              Pagamento processado com seguranca via {isStripe ? 'Stripe' : 'Mercado Pago'}
            </Text>
          </View>

          {/* Amount */}
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Valor a pagar</Text>
            <Text style={styles.amountValue}>
              R$ {amount.toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.submitButton,
              isStripe && styles.submitButtonStripe,
              isLoading && styles.buttonDisabled
            ]}
            onPress={isStripe ? handleSubmitStripeCard : handleSubmitSavedCard}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isStripe ? 'Pagar agora' : 'Pagar'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // New card form
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <CreditCard size={32} color="#EA1D2C" />
          <Text style={styles.title}>Dados do cartao</Text>
          <Text style={styles.subtitle}>Suas informacoes estao seguras</Text>
        </View>

        <View style={styles.form}>
          {/* Card Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Numero do cartao</Text>
            <View style={styles.cardInputContainer}>
              <TextInput
                style={[styles.input, styles.cardInput, errors.cardNumber && styles.inputError]}
                placeholder="0000 0000 0000 0000"
                placeholderTextColor="#999"
                value={cardNumber}
                onChangeText={handleCardNumberChange}
                keyboardType="numeric"
                maxLength={19}
                returnKeyType="next"
                onSubmitEditing={() => nameRef.current?.focus()}
              />
              {cardBrand !== 'unknown' && (
                <Text style={styles.cardBrandText}>{getCardBrandName(cardBrand)}</Text>
              )}
            </View>
            {errors.cardNumber && <Text style={styles.errorText}>{errors.cardNumber}</Text>}
          </View>

          {/* Cardholder Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome no cartao</Text>
            <TextInput
              ref={nameRef}
              style={[styles.input, errors.cardholderName && styles.inputError]}
              placeholder="Como esta impresso no cartao"
              placeholderTextColor="#999"
              value={cardholderName}
              onChangeText={setCardholderName}
              autoCapitalize="characters"
              returnKeyType="next"
              onSubmitEditing={() => expirationRef.current?.focus()}
            />
            {errors.cardholderName && <Text style={styles.errorText}>{errors.cardholderName}</Text>}
          </View>

          {/* Expiration and CVV */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Validade</Text>
              <TextInput
                ref={expirationRef}
                style={[styles.input, errors.expiration && styles.inputError]}
                placeholder="MM/AA"
                placeholderTextColor="#999"
                value={expiration}
                onChangeText={handleExpirationChange}
                keyboardType="numeric"
                maxLength={5}
                returnKeyType="next"
                onSubmitEditing={() => cvvRef.current?.focus()}
              />
              {errors.expiration && <Text style={styles.errorText}>{errors.expiration}</Text>}
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>CVV</Text>
              <TextInput
                ref={cvvRef}
                style={[styles.input, errors.securityCode && styles.inputError]}
                placeholder="123"
                placeholderTextColor="#999"
                value={securityCode}
                onChangeText={handleSecurityCodeChange}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
                returnKeyType="next"
                onSubmitEditing={() => cpfRef.current?.focus()}
              />
              {errors.securityCode && <Text style={styles.errorText}>{errors.securityCode}</Text>}
            </View>
          </View>

          {/* CPF */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>CPF do titular do cartao</Text>
            <TextInput
              ref={cpfRef}
              style={[styles.input, errors.cpf && styles.inputError]}
              placeholder="000.000.000-00"
              placeholderTextColor="#999"
              value={cpf}
              onChangeText={handleCpfChange}
              keyboardType="numeric"
              maxLength={14}
              returnKeyType="done"
            />
            {errors.cpf && <Text style={styles.errorText}>{errors.cpf}</Text>}
            <Text style={styles.cpfHint}>
              Informe o CPF do titular do cartao (pode ser diferente do seu)
            </Text>
          </View>

          {/* Save card checkbox */}
          <TouchableOpacity
            style={styles.saveCardOption}
            onPress={() => setSaveCard(!saveCard)}
          >
            <View style={[styles.checkbox, saveCard && styles.checkboxChecked]}>
              {saveCard && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.saveCardText}>Salvar cartao para proximas compras</Text>
          </TouchableOpacity>
        </View>

        {/* Security Notice */}
        <View style={styles.securityNotice}>
          <Lock size={16} color="#666" />
          <Text style={styles.securityText}>
            Pagamento processado com seguranca via Mercado Pago
          </Text>
        </View>

        {/* Amount */}
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Valor a pagar</Text>
          <Text style={styles.amountValue}>
            R$ {amount.toFixed(2).replace('.', ',')}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          disabled={isLoading}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.buttonDisabled]}
          onPress={handleSubmitNewCard}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Pagar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  form: {
    marginBottom: 20,
  },
  inputGroup: {
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
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputError: {
    borderColor: '#EA1D2C',
    backgroundColor: '#FFF5F5',
  },
  cardInputContainer: {
    position: 'relative',
  },
  cardInput: {
    paddingRight: 100,
  },
  cardBrandText: {
    position: 'absolute',
    right: 16,
    top: 16,
    fontSize: 14,
    color: '#666',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    color: '#EA1D2C',
    marginTop: 4,
  },
  cpfHint: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  securityText: {
    fontSize: 12,
    color: '#666',
  },
  amountContainer: {
    backgroundColor: '#FFF5F5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
  },
  amountValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#EA1D2C',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#EA1D2C',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  // Selected card banner
  selectedCardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#50A773',
    gap: 12,
  },
  selectedCardInfo: {
    flex: 1,
  },
  selectedCardBrand: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedCardName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  // CVV section
  cvvSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  cvvLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  cvvInput: {
    width: 120,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    textAlign: 'center',
    letterSpacing: 8,
  },
  cvvHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  // Save card option
  saveCardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#EA1D2C',
    borderColor: '#EA1D2C',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  saveCardText: {
    fontSize: 14,
    color: '#666',
  },
  // Stripe specific styles
  subtitleStripe: {
    fontSize: 14,
    color: '#6772E5',
    marginTop: 4,
  },
  selectedCardBannerStripe: {
    backgroundColor: '#f0f0ff',
    borderColor: '#6772E5',
  },
  submitButtonStripe: {
    backgroundColor: '#6772E5',
  },
  stripeInfoBox: {
    backgroundColor: '#f0f0ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0ff',
  },
  stripeInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6772E5',
    marginBottom: 8,
  },
  stripeInfoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
