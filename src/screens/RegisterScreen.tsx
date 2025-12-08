import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';

export function RegisterScreen() {
  const navigation = useNavigation<any>();
  const { register } = useAuth();

  // Step 1: Account info, Step 2: Address
  const [step, setStep] = useState(1);

  // Account fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Format CPF as 000.000.000-00
  const formatCPF = (value: string): string => {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length <= 11) {
      return cleanValue
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return value;
  };

  const handleCpfChange = (value: string) => {
    setCpf(formatCPF(value));
  };

  // Validate CPF
  const isValidCPF = (cpfValue: string): boolean => {
    const cleanCPF = cpfValue.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return false;
    if (/^(\d)\1+$/.test(cleanCPF)) return false; // All same digits

    // CPF validation algorithm
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(10))) return false;

    return true;
  };

  // Address fields
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);

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

  const handleNextStep = () => {
    if (!name || !email || !cpf || !password || !confirmPassword) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios');
      return;
    }

    if (!isValidCPF(cpf)) {
      Alert.alert('Erro', 'CPF inválido');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não conferem');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setStep(2);
  };

  const handleRegister = async () => {
    if (!street || !number || !neighborhood || !city || !state || !zipCode) {
      Alert.alert('Erro', 'Preencha todos os campos de endereço obrigatórios');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        name,
        email,
        password,
        cpf: cpf.replace(/\D/g, ''),
        phone: phone || undefined,
        address: {
          street,
          number,
          complement: complement || undefined,
          neighborhood,
          city,
          state,
          zipCode,
          // latitude/longitude are obtained asynchronously by backend via geocoding
        },
      });
      Alert.alert(
        'Conta criada!',
        'Sua conta foi criada com sucesso.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.message || 'Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <>
      <Text style={styles.title}>Criar conta</Text>
      <Text style={styles.subtitle}>Passo 1 de 2: Dados pessoais</Text>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Nome completo *</Text>
          <TextInput
            style={styles.input}
            placeholder="Seu nome"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>E-mail *</Text>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>CPF *</Text>
          <TextInput
            style={styles.input}
            placeholder="000.000.000-00"
            value={cpf}
            onChangeText={handleCpfChange}
            keyboardType="numeric"
            maxLength={14}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Telefone</Text>
          <TextInput
            style={styles.input}
            placeholder="(11) 99999-9999"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Senha *</Text>
          <TextInput
            style={styles.input}
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirmar senha *</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite a senha novamente"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleNextStep}
        >
          <Text style={styles.buttonText}>Continuar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.linkText}>
            Já tem conta? <Text style={styles.linkTextBold}>Entrar</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={styles.title}>Endereço</Text>
      <Text style={styles.subtitle}>Passo 2 de 2: Onde você quer receber</Text>

      <View style={styles.form}>
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
              keyboardType="numeric"
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

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Criar conta</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => setStep(1)}
        >
          <Text style={styles.linkText}>
            <Text style={styles.linkTextBold}>Voltar</Text> para dados pessoais
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]} />
            <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
            <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]} />
          </View>

          {step === 1 ? renderStep1() : renderStep2()}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ddd',
  },
  progressDotActive: {
    backgroundColor: '#f97316',
  },
  progressLine: {
    width: 60,
    height: 3,
    backgroundColor: '#ddd',
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: '#f97316',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  form: {},
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
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  inputDisabled: {
    backgroundColor: '#e5e5e5',
    color: '#999',
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
    color: '#888',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  linkText: {
    fontSize: 16,
    color: '#666',
  },
  linkTextBold: {
    color: '#f97316',
    fontWeight: '600',
  },
});
