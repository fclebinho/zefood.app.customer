import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Address } from '../types';
import { useAuth } from './useAuth';
import api from '../services/api';

interface AddressContextType {
  addresses: Address[];
  selectedAddress: Address | null;
  isLoading: boolean;
  selectAddress: (address: Address) => void;
  loadAddresses: () => Promise<void>;
  addAddress: (address: Omit<Address, 'id'>) => Promise<Address>;
}

const AddressContext = createContext<AddressContextType | undefined>(undefined);

export function AddressProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadAddresses();
    } else {
      setAddresses([]);
      setSelectedAddress(null);
    }
  }, [isAuthenticated]);

  const loadAddresses = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/users/addresses');
      const addressList = response.data || [];
      setAddresses(addressList);

      // Select default address or first one
      const defaultAddress = addressList.find((a: Address) => a.isDefault) || addressList[0];
      if (defaultAddress && !selectedAddress) {
        setSelectedAddress(defaultAddress);
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectAddress = (address: Address) => {
    setSelectedAddress(address);
  };

  const addAddress = async (addressData: Omit<Address, 'id'>): Promise<Address> => {
    const response = await api.post('/users/addresses', addressData);
    const newAddress = response.data;
    setAddresses((prev) => [...prev, newAddress]);
    if (!selectedAddress || addressData.isDefault) {
      setSelectedAddress(newAddress);
    }
    return newAddress;
  };

  return (
    <AddressContext.Provider
      value={{
        addresses,
        selectedAddress,
        isLoading,
        selectAddress,
        loadAddresses,
        addAddress,
      }}
    >
      {children}
    </AddressContext.Provider>
  );
}

export function useAddress() {
  const context = useContext(AddressContext);
  if (context === undefined) {
    throw new Error('useAddress must be used within an AddressProvider');
  }
  return context;
}
