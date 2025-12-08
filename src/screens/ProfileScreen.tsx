import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  User,
  MapPin,
  CreditCard,
  Package,
  Heart,
  Bell,
  Lock,
  HelpCircle,
  ChevronRight,
  LogOut,
  X,
  Trash2,
  Plus,
} from 'lucide-react-native';
import { useAuth } from '../hooks/useAuth';
import { useSavedCards } from '../hooks/useSavedCards';
import api from '../services/api';

// Card brand colors for display
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

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated, logout, refreshUser } = useAuth();
  const { savedCards, removeCard, isLoading: isLoadingCards } = useSavedCards();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCardsModal, setShowCardsModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const openEditModal = () => {
    setFullName(user?.fullName || '');
    setPhone(user?.phone || '');
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Erro', 'O nome é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      await api.patch('/users/me', {
        fullName: fullName.trim(),
        phone: phone.trim() || null,
      });
      await refreshUser();
      setShowEditModal(false);
      Alert.alert('Sucesso', 'Perfil atualizado!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Erro', error?.response?.data?.message || 'Erro ao atualizar perfil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleDeleteCard = (cardId: string, lastFourDigits: string) => {
    Alert.alert(
      'Remover cartão',
      `Tem certeza que deseja remover o cartão terminando em ${lastFourDigits}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            await removeCard(cardId);
          },
        },
      ]
    );
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <User size={64} color="#ccc" />
        </View>
        <Text style={styles.emptyTitle}>Faça login</Text>
        <Text style={styles.emptySubtitle}>
          Entre na sua conta para ver seu perfil
        </Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>Fazer login</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.registerButtonText}>Criar conta</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.fullName?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.fullName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conta</Text>

        <TouchableOpacity style={styles.menuItem} onPress={openEditModal}>
          <View style={styles.menuIconContainer}>
            <User size={20} color="#666" />
          </View>
          <Text style={styles.menuText}>Editar perfil</Text>
          <ChevronRight size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('Addresses')}
        >
          <View style={styles.menuIconContainer}>
            <MapPin size={20} color="#666" />
          </View>
          <Text style={styles.menuText}>Endereços</Text>
          <ChevronRight size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setShowCardsModal(true)}>
          <View style={styles.menuIconContainer}>
            <CreditCard size={20} color="#666" />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuText}>Formas de pagamento</Text>
            {savedCards.length > 0 && (
              <Text style={styles.menuSubtext}>{savedCards.length} cartão(ões) salvo(s)</Text>
            )}
          </View>
          <ChevronRight size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pedidos</Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('Orders')}
        >
          <View style={styles.menuIconContainer}>
            <Package size={20} color="#666" />
          </View>
          <Text style={styles.menuText}>Meus pedidos</Text>
          <ChevronRight size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconContainer}>
            <Heart size={20} color="#666" />
          </View>
          <Text style={styles.menuText}>Favoritos</Text>
          <ChevronRight size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configurações</Text>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconContainer}>
            <Bell size={20} color="#666" />
          </View>
          <Text style={styles.menuText}>Notificações</Text>
          <ChevronRight size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconContainer}>
            <Lock size={20} color="#666" />
          </View>
          <Text style={styles.menuText}>Privacidade</Text>
          <ChevronRight size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconContainer}>
            <HelpCircle size={20} color="#666" />
          </View>
          <Text style={styles.menuText}>Ajuda</Text>
          <ChevronRight size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <LogOut size={20} color="#dc2626" />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>FoodApp v1.0.0</Text>
      </View>

      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar perfil</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.modalCloseButton}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nome completo *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Seu nome"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Telefone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={user?.email}
                  editable={false}
                />
                <Text style={styles.inputHint}>O email não pode ser alterado</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.buttonDisabled]}
              onPress={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Salvar alterações</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cards Modal */}
      <Modal
        visible={showCardsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCardsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cardsModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Formas de pagamento</Text>
              <TouchableOpacity onPress={() => setShowCardsModal(false)} style={styles.modalCloseButton}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.cardsScrollView}>
              {isLoadingCards ? (
                <View style={styles.cardsLoadingContainer}>
                  <ActivityIndicator size="large" color="#f97316" />
                </View>
              ) : savedCards.length === 0 ? (
                <View style={styles.emptyCardsContainer}>
                  <CreditCard size={48} color="#ccc" />
                  <Text style={styles.emptyCardsTitle}>Nenhum cartão salvo</Text>
                  <Text style={styles.emptyCardsSubtitle}>
                    Adicione um cartão para agilizar suas compras
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.cardsSectionTitle}>Seus cartões</Text>
                  {savedCards.map((card) => {
                    const brandColor = getCardBrandColor(card.brand);
                    return (
                      <View key={card.id} style={styles.savedCardItem}>
                        <View style={styles.savedCardLeft}>
                          <View style={[styles.cardIconPlaceholder, { backgroundColor: brandColor + '15' }]}>
                            <CreditCard size={20} color={brandColor} />
                          </View>
                          <View style={styles.savedCardInfo}>
                            <Text style={styles.savedCardBrand}>
                              {card.brand} • {card.type === 'credit' ? 'Crédito' : 'Débito'}
                            </Text>
                            <Text style={styles.savedCardDigits}>•••• {card.lastFourDigits}</Text>
                            <Text style={styles.savedCardHolder}>{card.cardholderName}</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.deleteCardButton}
                          onPress={() => handleDeleteCard(card.id, card.lastFourDigits)}
                        >
                          <Trash2 size={20} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.addCardButton}
              onPress={() => {
                setShowCardsModal(false);
                navigation.navigate('AddCard');
              }}
            >
              <Plus size={20} color="#fff" />
              <Text style={styles.addCardButtonText}>Adicionar novo cartão</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  loginButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  registerButton: {
    paddingHorizontal: 48,
    paddingVertical: 14,
  },
  registerButtonText: {
    color: '#f97316',
    fontWeight: '600',
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  logoutButton: {
    flexDirection: 'row',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#999',
    fontSize: 12,
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
    maxHeight: '80%',
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
  inputHint: {
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
  menuTextContainer: {
    flex: 1,
  },
  menuSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  // Cards Modal styles
  cardsModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  cardsScrollView: {
    padding: 20,
    maxHeight: 400,
  },
  cardsLoadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyCardsContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyCardsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyCardsSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  cardsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  savedCardItem: {
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
  savedCardBrand: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  savedCardDigits: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  savedCardHolder: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  deleteCardButton: {
    padding: 8,
  },
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f97316',
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
