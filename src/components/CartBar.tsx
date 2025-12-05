import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShoppingBag } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../hooks/useCart';

interface CartBarProps {
  withSafeArea?: boolean;
}

export function CartBar({ withSafeArea = false }: CartBarProps) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { items: cartItems, restaurant: cartRestaurant, total: cartTotal } = useCart();

  const cartItemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  if (cartItemsCount === 0) {
    return null;
  }

  const paddingBottom = withSafeArea ? Math.max(insets.bottom, 16) : 12;

  return (
    <TouchableOpacity
      style={[styles.container, { paddingBottom }]}
      onPress={() => navigation.navigate('Cart')}
      activeOpacity={0.95}
    >
      <View style={styles.left}>
        {cartRestaurant?.logoUrl ? (
          <Image source={{ uri: cartRestaurant.logoUrl }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <ShoppingBag size={20} color="#EA1D2C" />
          </View>
        )}
        <View>
          <Text style={styles.label}>Total sem a entrega</Text>
          <Text style={styles.price}>
            R$ {cartTotal.toFixed(2).replace('.', ',')}
            <Text style={styles.items}> / {cartItemsCount} {cartItemsCount === 1 ? 'item' : 'itens'}</Text>
          </Text>
        </View>
      </View>
      <View style={styles.button}>
        <ShoppingBag size={18} color="#fff" />
        <Text style={styles.buttonText}>Ver sacola</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    color: '#666',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3E3E3E',
  },
  items: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#666',
  },
  button: {
    backgroundColor: '#EA1D2C',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
