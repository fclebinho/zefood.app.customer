import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { restaurantService } from '../services/api';
import { useCart } from '../hooks/useCart';
import { Restaurant, MenuCategory, MenuItem } from '../types';
import { CartBar } from '../components/CartBar';

export function RestaurantScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { slug } = route.params;
  const { addItem, items, restaurant: cartRestaurant } = useCart();
  const [restaurant, setRestaurant] = useState<Restaurant & { menuCategories: MenuCategory[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRestaurant();
  }, [slug]);

  const loadRestaurant = async () => {
    try {
      const data = await restaurantService.getBySlug(slug);
      setRestaurant(data);
    } catch (error) {
      console.error('Error loading restaurant:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = (item: MenuItem) => {
    if (!restaurant) return;

    if (cartRestaurant && cartRestaurant.id !== restaurant.id) {
      Alert.alert(
        'Limpar carrinho?',
        'Você tem itens de outro restaurante no carrinho. Deseja limpar e adicionar este item?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Limpar', onPress: () => addItem(item, restaurant) },
        ]
      );
      return;
    }

    addItem(item, restaurant);
  };

  const getItemQuantity = (itemId: string) => {
    const cartItem = items.find((i) => i.menuItem.id === itemId);
    return cartItem?.quantity || 0;
  };

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View style={styles.loader}>
        <Text>Restaurante não encontrado</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent}>
        {restaurant.coverUrl && (
          <Image source={{ uri: restaurant.coverUrl }} style={styles.cover} />
        )}

        <View style={styles.header}>
          <Text style={styles.name}>{restaurant.name}</Text>
          <Text style={styles.category}>
            {restaurant.categories.map((c) => c.category.name).join(', ')}
          </Text>
          {restaurant.description && (
            <Text style={styles.description}>{restaurant.description}</Text>
          )}

          <View style={styles.stats}>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>★ {Number(restaurant.rating).toFixed(1)}</Text>
            </View>
            <Text style={styles.statText}>{restaurant.avgPrepTime} min</Text>
            <Text style={styles.statText}>
              {Number(restaurant.deliveryFee) === 0
                ? 'Grátis'
                : `R$ ${Number(restaurant.deliveryFee).toFixed(2).replace('.', ',')}`}
            </Text>
          </View>

          {!restaurant.isOpen && (
            <View style={styles.closedBadge}>
              <Text style={styles.closedText}>Restaurante fechado</Text>
            </View>
          )}
        </View>

        {restaurant.menuCategories?.map((category) => (
          <View key={category.id} style={styles.menuCategory}>
            <Text style={styles.categoryTitle}>{category.name}</Text>
            {category.description && (
              <Text style={styles.categoryDescription}>{category.description}</Text>
            )}

            {category.items.map((item) => {
              const quantity = getItemQuantity(item.id);
              return (
                <View key={item.id} style={styles.menuItem}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.description && (
                      <Text style={styles.itemDescription} numberOfLines={2}>
                        {item.description}
                      </Text>
                    )}
                    <View style={styles.itemFooter}>
                      <Text style={styles.itemPrice}>
                        R$ {Number(item.price).toFixed(2).replace('.', ',')}
                      </Text>
                      {restaurant.isOpen && (
                        <TouchableOpacity
                          style={styles.addButton}
                          onPress={() => handleAddItem(item)}
                        >
                          <Text style={styles.addButtonText}>
                            {quantity > 0 ? `+ (${quantity})` : 'Adicionar'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  {item.imageUrl && (
                    <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
                  )}
                </View>
              );
            })}
          </View>
        ))}

        <View style={{ height: 20 }} />
      </ScrollView>
      <CartBar withSafeArea />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cover: {
    width: '100%',
    height: 200,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  category: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  ratingBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  ratingText: {
    color: '#16a34a',
    fontWeight: '600',
  },
  statText: {
    color: '#666',
    fontSize: 14,
    marginRight: 12,
  },
  closedBadge: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  closedText: {
    color: '#dc2626',
    fontWeight: '600',
    textAlign: 'center',
  },
  menuCategory: {
    padding: 20,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f97316',
  },
  addButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
});
