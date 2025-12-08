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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, CreditCard, Lock, Check, Zap } from 'lucide-react-native';
import { useSavedCards, CardDataToSave } from '../hooks/useSavedCards';
import { StripeCardForm } from '../components/StripeCardForm';

type CardMode = 'select' | 'stripe' | 'mercadopago';

// Card brand detection
function getCardBrand(cardNumber: string): string {
  const number = cardNumber.replace(/\s/g, '');

  if (/^4/.test(number)) return 'Visa';
  if (/^5[1-5]/.test(number)) return 'Mastercard';
  if (/^3[47]/.test(number)) return 'Amex';
  if (/^6(?:011|5)/.test(number)) return 'Discover';
  if (/^(?:2131|1800|35)/.test(number)) return 'JCB';
  if (/^3(?:0[0-5]|[68])/.test(number)) return 'Diners';
  if (/^(636368|636369|438935|504175|451416|636297|5067|4576|4011)/.test(number)) return 'Elo';
  if (/^(606282|3841)/.test(number)) return 'Hipercard';

  return 'Cartao';
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

// Format CPF
function formatCPF(value: string): string {
  const v = value.replace(/\D/g, '');
  if (v.length <= 3) return v;
  if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
  if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
  return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9, 11)}`;
}

export function AddCardScreen() {
  const navigation = useNavigation<any>();
  const { saveCard, loadSavedCards } = useSavedCards();

  const [mode, setMode] = useState<CardMode>('select');
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [expiration, setExpiration] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [cpf, setCpf] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Refs for focus
  const nameRef = useRef<TextInput>(null);
  const expirationRef = useRef<TextInput>(null);
  const cvvRef = useRef<TextInput>(null);
  const cpfRef = useRef<TextInput>(null);

  const handleCardNumberChange = (value: string) => {
    const formatted = formatCardNumber(value);
    setCardNumber(formatted);

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
      if (cleaned.length >= 3) {
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

  const validate = (): boolean => {
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
      newErrors.cpf = 'CPF invalido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveCardMP = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      const [month, year] = expiration.split('/');

      const cardData: CardDataToSave = {
        cardNumber: cardNumber.replace(/\s/g, ''),
        cardholderName: cardholderName.toUpperCase(),
        expirationMonth: month,
        expirationYear: year.length === 2 ? `20${year}` : year,
        securityCode,
        identificationType: 'CPF',
        identificationNumber: cpf.replace(/\D/g, ''),
      };

      await saveCard(cardData);

      Alert.alert(
        'Cartao salvo!',
        'Seu cartao foi adicionado com sucesso via Mercado Pago.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error saving card:', error);
      Alert.alert('Erro', error?.message || 'Nao foi possivel salvar o cartao. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStripeSuccess = async () => {
    await loadSavedCards();
    navigation.goBack();
  };

  const cardBrand = getCardBrand(cardNumber);

  // Show Stripe form
  if (mode === 'stripe') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => setMode('select')}>
            <ArrowLeft size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Adicionar cartao (Stripe)</Text>
          <View style={styles.headerSpacer} />
        </View>
        <StripeCardForm
          onSuccess={handleStripeSuccess}
          onCancel={() => setMode('select')}
        />
      </SafeAreaView>
    );
  }

  // Show selection screen
  if (mode === 'select') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Adicionar cartao</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.selectContent}>
          <Text style={styles.selectTitle}>Como deseja adicionar seu cartao?</Text>
          <Text style={styles.selectSubtitle}>
            Escolha o metodo de salvamento do cartao
          </Text>

          {/* Stripe Option - Recommended */}
          <TouchableOpacity
            style={[styles.optionCard, styles.optionCardStripe]}
            onPress={() => setMode('stripe')}
          >
            <View style={styles.optionHeader}>
              <View style={styles.optionIconStripe}>
                <Zap size={24} color="#fff" />
              </View>
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>Recomendado</Text>
              </View>
            </View>
            <Text style={styles.optionTitle}>Stripe - Pagamento 1-clique</Text>
            <Text style={styles.optionDescription}>
              Apos salvar, pague apenas com 1 clique, sem precisar digitar o CVV novamente!
            </Text>
            <View style={styles.optionFeatures}>
              <View style={styles.featureItem}>
                <Check size={16} color="#50A773" />
                <Text style={styles.featureText}>Pagamento instantaneo</Text>
              </View>
              <View style={styles.featureItem}>
                <Check size={16} color="#50A773" />
                <Text style={styles.featureText}>Sem CVV nas proximas compras</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Mercado Pago Option */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => setMode('mercadopago')}
          >
            <View style={styles.optionIconMP}>
              <CreditCard size={24} color="#fff" />
            </View>
            <Text style={styles.optionTitle}>Mercado Pago</Text>
            <Text style={styles.optionDescription}>
              Metodo tradicional - sera necessario digitar o CVV a cada compra
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Mercado Pago form (mode === 'mercadopago')
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => setMode('select')}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Adicionar cartao (MP)</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Card Preview */}
          <View style={styles.cardPreview}>
            <View style={styles.cardPreviewTop}>
              <CreditCard size={24} color="#fff" />
              <Text style={styles.cardPreviewBrand}>{cardBrand}</Text>
            </View>
            <Text style={styles.cardPreviewNumber}>
              {cardNumber || '**** **** **** ****'}
            </Text>
            <View style={styles.cardPreviewBottom}>
              <View>
                <Text style={styles.cardPreviewLabel}>TITULAR</Text>
                <Text style={styles.cardPreviewValue}>
                  {cardholderName || 'NOME NO CARTAO'}
                </Text>
              </View>
              <View>
                <Text style={styles.cardPreviewLabel}>VALIDADE</Text>
                <Text style={styles.cardPreviewValue}>{expiration || 'MM/AA'}</Text>
              </View>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Card Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Numero do cartao</Text>
              <TextInput
                style={[styles.input, errors.cardNumber && styles.inputError]}
                placeholder="0000 0000 0000 0000"
                placeholderTextColor="#999"
                value={cardNumber}
                onChangeText={handleCardNumberChange}
                keyboardType="numeric"
                maxLength={19}
                returnKeyType="next"
                onSubmitEditing={() => nameRef.current?.focus()}
              />
              {errors.cardNumber && <Text style={styles.errorText}>{errors.cardNumber}</Text>}
            </View>

            {/* Cardholder Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome impresso no cartao</Text>
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
              {errors.cardholderName && (
                <Text style={styles.errorText}>{errors.cardholderName}</Text>
              )}
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
                {errors.securityCode && (
                  <Text style={styles.errorText}>{errors.securityCode}</Text>
                )}
              </View>
            </View>

            {/* CPF */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>CPF do titular</Text>
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
            </View>
          </View>

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Lock size={16} color="#666" />
            <Text style={styles.securityText}>
              Seus dados sao armazenados de forma segura via Mercado Pago
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.buttonDisabled]}
          onPress={handleSaveCardMP}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Salvar cartao</Text>
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
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
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
  // Selection screen styles
  selectContent: {
    flex: 1,
    padding: 20,
  },
  selectTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  selectSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  optionCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardStripe: {
    backgroundColor: '#f0f0ff',
    borderColor: '#6772E5',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionIconStripe: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6772E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIconMP: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00AEEF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  recommendedBadge: {
    backgroundColor: '#50A773',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  recommendedText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  optionFeatures: {
    marginTop: 12,
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: '#333',
  },
  // Form styles
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  cardPreview: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    aspectRatio: 1.6,
  },
  cardPreviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardPreviewBrand: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cardPreviewNumber: {
    fontSize: 20,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: 2,
    marginBottom: 24,
  },
  cardPreviewBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardPreviewLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  cardPreviewValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  form: {
    marginBottom: 16,
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
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  securityText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#EA1D2C',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
