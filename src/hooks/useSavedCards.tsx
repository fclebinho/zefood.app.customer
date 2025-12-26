import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { useAuth } from './useAuth';

// Storage keys
const PAYMENT_PREFERENCE_KEY = '@zefood:payment_preference';

// Provider type matching backend
export type CardProvider = 'MERCADOPAGO' | 'STRIPE';

// Interface que corresponde ao backend SavedCardDto
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

// Interface para dados do cartao ao salvar
export interface CardDataToSave {
  cardNumber: string;
  cardholderName: string;
  expirationMonth: string;
  expirationYear: string;
  securityCode: string;
  identificationType: string;
  identificationNumber: string;
}

// Payment method types
export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH';

// Payment preference stored locally
export interface PaymentPreference {
  method: PaymentMethod;
  savedCardId?: string; // If a specific saved card was selected
}

interface SavedCardsContextData {
  savedCards: SavedCard[];
  isLoading: boolean;
  error: string | null;
  loadSavedCards: () => Promise<void>;
  saveCard: (cardData: CardDataToSave) => Promise<SavedCard>;
  deleteCard: (cardId: string) => Promise<void>;
  setDefaultCard: (cardId: string) => Promise<void>;
  getDefaultCard: () => SavedCard | undefined;
  // Payment preference
  paymentPreference: PaymentPreference | null;
  savePaymentPreference: (preference: PaymentPreference) => Promise<void>;
  getPreferredCard: () => SavedCard | undefined;
}

const SavedCardsContext = createContext<SavedCardsContextData>({} as SavedCardsContextData);

export function SavedCardsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentPreference, setPaymentPreference] = useState<PaymentPreference | null>(null);

  // Carregar preferencia de pagamento do AsyncStorage
  const loadPaymentPreference = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(PAYMENT_PREFERENCE_KEY);
      if (stored) {
        const preference = JSON.parse(stored) as PaymentPreference;
        console.log('[useSavedCards] Loaded payment preference:', preference);
        setPaymentPreference(preference);
      }
    } catch (err) {
      console.error('[useSavedCards] Error loading payment preference:', err);
    }
  }, []);

  // Salvar preferencia de pagamento
  const savePaymentPreference = useCallback(async (preference: PaymentPreference) => {
    try {
      await AsyncStorage.setItem(PAYMENT_PREFERENCE_KEY, JSON.stringify(preference));
      setPaymentPreference(preference);
      console.log('[useSavedCards] Saved payment preference:', preference);
    } catch (err) {
      console.error('[useSavedCards] Error saving payment preference:', err);
    }
  }, []);

  // Obter cartao preferido (baseado na preferencia salva)
  const getPreferredCard = useCallback(() => {
    if (!paymentPreference?.savedCardId) {
      return undefined;
    }
    return savedCards.find((card) => card.id === paymentPreference.savedCardId);
  }, [paymentPreference, savedCards]);

  // Carregar cartoes salvos do backend
  const loadSavedCards = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/payments/cards');
      console.log('[useSavedCards] Loaded cards from backend:', response.data);
      setSavedCards(response.data || []);
    } catch (err: any) {
      console.error('[useSavedCards] Error loading saved cards:', err);
      // Se for erro 401, usuario nao esta logado - nao e um erro real
      if (err?.response?.status !== 401) {
        setError('Erro ao carregar cartoes salvos');
      }
      setSavedCards([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carregar cartoes e preferencia ao iniciar (apenas se autenticado)
  useEffect(() => {
    if (isAuthenticated) {
      loadSavedCards();
    } else {
      setSavedCards([]);
      setIsLoading(false);
    }
    loadPaymentPreference();
  }, [isAuthenticated, loadSavedCards, loadPaymentPreference]);

  // Salvar novo cartao via MP Customer API
  const saveCard = async (cardData: CardDataToSave): Promise<SavedCard> => {
    try {
      console.log('[useSavedCards] Saving card to backend...');
      const response = await api.post('/payments/cards', { cardData });
      console.log('[useSavedCards] Card saved:', response.data);

      // Adicionar ao estado local
      setSavedCards((prev) => [...prev, response.data]);

      return response.data;
    } catch (err: any) {
      console.error('[useSavedCards] Error saving card:', err);
      const errorMessage = err?.response?.data?.message || 'Erro ao salvar cartao';
      throw new Error(errorMessage);
    }
  };

  // Remover cartao
  const deleteCard = async (cardId: string): Promise<void> => {
    try {
      console.log('[useSavedCards] Deleting card:', cardId);
      await api.delete(`/payments/cards/${cardId}`);

      // Remover do estado local
      setSavedCards((prev) => {
        const updated = prev.filter((card) => card.id !== cardId);
        // Se removeu o cartao padrao, definir outro como padrao localmente
        if (updated.length > 0 && !updated.some((c) => c.isDefault)) {
          updated[0].isDefault = true;
        }
        return updated;
      });
    } catch (err: any) {
      console.error('[useSavedCards] Error deleting card:', err);
      const errorMessage = err?.response?.data?.message || 'Erro ao remover cartao';
      throw new Error(errorMessage);
    }
  };

  // Definir cartao como padrao
  const setDefaultCard = async (cardId: string): Promise<void> => {
    try {
      console.log('[useSavedCards] Setting default card:', cardId);
      await api.patch(`/payments/cards/${cardId}/default`);

      // Atualizar estado local
      setSavedCards((prev) =>
        prev.map((card) => ({
          ...card,
          isDefault: card.id === cardId,
        }))
      );
    } catch (err: any) {
      console.error('[useSavedCards] Error setting default card:', err);
      const errorMessage = err?.response?.data?.message || 'Erro ao definir cartao padrao';
      throw new Error(errorMessage);
    }
  };

  // Obter cartao padrao
  const getDefaultCard = () => {
    return savedCards.find((card) => card.isDefault);
  };

  return (
    <SavedCardsContext.Provider
      value={{
        savedCards,
        isLoading,
        error,
        loadSavedCards,
        saveCard,
        deleteCard,
        setDefaultCard,
        getDefaultCard,
        // Payment preference
        paymentPreference,
        savePaymentPreference,
        getPreferredCard,
      }}
    >
      {children}
    </SavedCardsContext.Provider>
  );
}

export function useSavedCards() {
  const context = useContext(SavedCardsContext);
  if (!context) {
    throw new Error('useSavedCards must be used within a SavedCardsProvider');
  }
  return context;
}
