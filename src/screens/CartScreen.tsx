import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trash2, Plus, Minus, Pencil, Tag, ShoppingBag } from 'lucide-react-native';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';

export function CartScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuth();
  const { items, restaurant, updateQuantity, clearCart, subtotal, deliveryFee, total } = useCart();

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    navigation.navigate('Checkout');
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleAddMoreItems = () => {
    if (restaurant) {
      navigation.navigate('Restaurant', { slug: restaurant.slug });
    }
  };

  const itemsCount = items.reduce((acc, item) => acc + item.quantity, 0);

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <ShoppingBag size={64} color="#ccc" />
        </View>
        <Text style={styles.emptyTitle}>Sua sacola está vazia</Text>
        <Text style={styles.emptySubtitle}>
          Adicione itens de um restaurante para começar
        </Text>
        <TouchableOpacity
          style={styles.browseButton}
          onPress={() => navigation.navigate('Main')}
        >
          <Text style={styles.browseButtonText}>Ver restaurantes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.headerBackButton}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sacola</Text>
        <TouchableOpacity onPress={clearCart} style={styles.headerClearButton}>
          <Text style={styles.clearText}>Limpar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Restaurant Card */}
        {restaurant && (
          <TouchableOpacity style={styles.restaurantCard} onPress={handleAddMoreItems}>
            {restaurant.logoUrl && (
              <Image source={{ uri: restaurant.logoUrl }} style={styles.restaurantLogo} />
            )}
            <View style={styles.restaurantInfo}>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
              <Text style={styles.addMoreText}>Adicionar mais itens</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Items Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Itens adicionados</Text>

          {items.map((item) => (
            <View key={item.menuItem.id} style={styles.cartItem}>
              {item.menuItem.imageUrl ? (
                <View style={styles.itemImageContainer}>
                  <Image source={{ uri: item.menuItem.imageUrl }} style={styles.itemImage} />
                  <View style={styles.editBadge}>
                    <Pencil size={12} color="#fff" />
                  </View>
                </View>
              ) : (
                <View style={[styles.itemImageContainer, styles.itemImagePlaceholder]}>
                  <ShoppingBag size={24} color="#ccc" />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>{item.menuItem.name}</Text>
                {item.menuItem.description && (
                  <Text style={styles.itemDescription} numberOfLines={1}>
                    {item.menuItem.description}
                  </Text>
                )}
                <Text style={styles.itemPrice}>
                  R$ {(Number(item.menuItem.price) * item.quantity).toFixed(2).replace('.', ',')}
                </Text>
              </View>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                >
                  {item.quantity === 1 ? (
                    <Trash2 size={18} color="#EA1D2C" />
                  ) : (
                    <Minus size={18} color="#EA1D2C" />
                  )}
                </TouchableOpacity>
                <Text style={styles.quantity}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                >
                  <Plus size={18} color="#EA1D2C" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Add More Items Link */}
        <TouchableOpacity style={styles.addMoreLink} onPress={handleAddMoreItems}>
          <Text style={styles.addMoreLinkText}>Adicionar mais itens</Text>
        </TouchableOpacity>

        {/* Coupon Section */}
        <TouchableOpacity style={styles.couponSection}>
          <View style={styles.couponLeft}>
            <Tag size={20} color="#3E3E3E" />
            <View style={styles.couponInfo}>
              <Text style={styles.couponTitle}>Cupom</Text>
              <Text style={styles.couponSubtitle}>Adicionar cupom de desconto</Text>
            </View>
          </View>
          <Text style={styles.couponAction}>Adicionar</Text>
        </TouchableOpacity>

        {/* Summary Section */}
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

          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              R$ {total.toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerLabel}>Total com a entrega</Text>
          <Text style={styles.footerTotal}>
            R$ {total.toFixed(2).replace('.', ',')}
            <Text style={styles.footerItems}> / {itemsCount} {itemsCount === 1 ? 'item' : 'itens'}</Text>
          </Text>
        </View>
        <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
          <Text style={styles.checkoutButtonText}>
            {isAuthenticated ? 'Continuar' : 'Fazer login'}
          </Text>
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
  headerClearButton: {
    padding: 8,
    minWidth: 60,
  },
  clearText: {
    fontSize: 14,
    color: '#EA1D2C',
    fontWeight: '500',
    textAlign: 'right',
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
    color: '#3E3E3E',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: '#EA1D2C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
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
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3E3E3E',
    marginBottom: 16,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  itemImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EA1D2C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#EA1D2C',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  quantityButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantity: {
    marginHorizontal: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#3E3E3E',
    minWidth: 24,
    textAlign: 'center',
  },
  addMoreLink: {
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 8,
    borderBottomColor: '#f5f5f5',
  },
  addMoreLinkText: {
    fontSize: 14,
    color: '#EA1D2C',
    fontWeight: '500',
  },
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
  },
  couponInfo: {
    marginLeft: 12,
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
  },
  summarySection: {
    padding: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3E3E3E',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#3E3E3E',
  },
  freeDelivery: {
    color: '#50A773',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3E3E3E',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3E3E3E',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  footerInfo: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 12,
    color: '#666',
  },
  footerTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3E3E3E',
  },
  footerItems: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#666',
  },
  checkoutButton: {
    backgroundColor: '#EA1D2C',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
