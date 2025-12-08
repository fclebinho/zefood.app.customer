import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { CardField, useConfirmSetupIntent } from '@stripe/stripe-react-native';
import { CreditCard, Lock, CheckCircle } from 'lucide-react-native';
import api from '../services/api';

interface StripeCardFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function StripeCardForm({ onSuccess, onCancel }: StripeCardFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);

  const { confirmSetupIntent } = useConfirmSetupIntent();

  // Get SetupIntent from backend when component mounts
  useEffect(() => {
    fetchSetupIntent();
  }, []);

  const fetchSetupIntent = async () => {
    try {
      setIsInitializing(true);
      const response = await api.post('/payments/stripe/setup-intent');
      setClientSecret(response.data.clientSecret);
    } catch (error: any) {
      console.error('Error fetching SetupIntent:', error);
      Alert.alert(
        'Erro',
        error?.response?.data?.message || 'Nao foi possivel inicializar o salvamento do cartao.',
        [{ text: 'OK', onPress: onCancel }]
      );
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSaveCard = async () => {
    if (!clientSecret) {
      Alert.alert('Erro', 'SetupIntent nao inicializado');
      return;
    }

    if (!cardComplete) {
      Alert.alert('Erro', 'Por favor, preencha todos os dados do cartao');
      return;
    }

    setIsLoading(true);

    try {
      // Confirm the SetupIntent with Stripe.js
      const { setupIntent, error } = await confirmSetupIntent(clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        console.error('Stripe error:', error);
        Alert.alert('Erro', error.message || 'Erro ao processar cartao');
        setIsLoading(false);
        return;
      }

      if (setupIntent?.paymentMethodId) {
        // Save the card reference to our backend
        await api.post('/payments/stripe/confirm-card', {
          paymentMethodId: setupIntent.paymentMethodId,
        });

        Alert.alert(
          'Cartao salvo!',
          'Seu cartao foi salvo com sucesso. Agora voce pode pagar com 1 clique, sem precisar digitar o CVV!',
          [{ text: 'OK', onPress: onSuccess }]
        );
      }
    } catch (error: any) {
      console.error('Error saving card:', error);
      Alert.alert(
        'Erro',
        error?.response?.data?.message || 'Erro ao salvar cartao. Tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#EA1D2C" />
          <Text style={styles.loadingText}>Preparando...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <CreditCard size={32} color="#6772E5" />
            <Text style={styles.title}>Adicionar Cartao (Stripe)</Text>
            <Text style={styles.subtitle}>Pagamentos 1-clique sem CVV</Text>
          </View>

          <View style={styles.stripeInfo}>
            <CheckCircle size={18} color="#50A773" />
            <Text style={styles.stripeInfoText}>
              Cartoes salvos via Stripe permitem pagamento com 1 clique, sem precisar digitar o CVV novamente!
            </Text>
          </View>

          <View style={styles.cardFieldContainer}>
            <Text style={styles.label}>Dados do Cartao</Text>
            <CardField
              postalCodeEnabled={false}
              placeholders={{
                number: '4242 4242 4242 4242',
                expiration: 'MM/AA',
                cvc: 'CVC',
              }}
              cardStyle={cardStyles}
              style={styles.cardField}
              onCardChange={(cardDetails) => {
                setCardComplete(cardDetails.complete);
              }}
            />
            <Text style={styles.hint}>
              Numero do cartao, validade e codigo de seguranca
            </Text>
          </View>

          <View style={styles.securityNotice}>
            <Lock size={16} color="#666" />
            <Text style={styles.securityText}>
              Seus dados sao criptografados e processados de forma segura pela Stripe
            </Text>
          </View>

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
                (!cardComplete || isLoading) && styles.buttonDisabled,
              ]}
              onPress={handleSaveCard}
              disabled={!cardComplete || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Salvar Cartao</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Extra space for keyboard */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const cardStyles = {
  backgroundColor: '#f5f5f5',
  textColor: '#333333',
  fontSize: 16,
  placeholderColor: '#999999',
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#e0e0e0',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
    color: '#6772E5',
    marginTop: 4,
  },
  stripeInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f9f0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  stripeInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  cardFieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  cardField: {
    width: '100%',
    height: 50,
    marginVertical: 8,
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    gap: 8,
  },
  securityText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
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
    backgroundColor: '#6772E5',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
