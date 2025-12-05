import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  UtensilsCrossed,
  ShoppingCart,
  Coffee,
  Pill,
  Tag,
  Zap,
  Salad,
  Cake,
  Bell,
  ChevronDown,
  MapPin,
  Heart,
  Star,
  Check,
  X,
  Ticket,
} from 'lucide-react-native';
import { restaurantService } from '../services/api';
import { Restaurant, Category, PaginatedResponse, Address } from '../types';
import { useAddress } from '../hooks/useAddress';
import { useAuth } from '../hooks/useAuth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BANNERS = [
  {
    id: '1',
    title: 'Cupom de R$ 10',
    subtitle: 'nos seus queridinhos',
    backgroundColor: '#EA1D2C',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300',
  },
  {
    id: '2',
    title: 'Frete Grátis',
    subtitle: 'em pedidos acima de R$ 30',
    backgroundColor: '#50A773',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300',
  },
  {
    id: '3',
    title: '50% OFF',
    subtitle: 'em pratos selecionados',
    backgroundColor: '#F7A922',
    image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=300',
  },
];

const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
  restaurants: UtensilsCrossed,
  markets: ShoppingCart,
  drinks: Coffee,
  pharmacy: Pill,
  promotions: Tag,
  express: Zap,
  healthy: Salad,
  desserts: Cake,
};

const QUICK_CATEGORIES = [
  { id: 'restaurants', name: 'Restaurantes', color: '#FEF3E2', iconColor: '#EA580C' },
  { id: 'markets', name: 'Mercados', color: '#E8F5E9', iconColor: '#16A34A' },
  { id: 'drinks', name: 'Bebidas', color: '#E3F2FD', iconColor: '#2563EB', isNew: true },
  { id: 'pharmacy', name: 'Farmácias', color: '#FCE4EC', iconColor: '#DB2777' },
  { id: 'promotions', name: 'Promoções', color: '#FFF3E0', iconColor: '#EA580C', isNew: true },
  { id: 'express', name: 'Express', color: '#F3E5F5', iconColor: '#9333EA' },
  { id: 'healthy', name: 'Saudável', color: '#E8F5E9', iconColor: '#16A34A' },
  { id: 'desserts', name: 'Sobremesas', color: '#FFEBEE', iconColor: '#DC2626' },
];

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated } = useAuth();
  const { addresses, selectedAddress, selectAddress, isLoading: addressLoading } = useAddress();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [activeBanner, setActiveBanner] = useState(0);
  const bannerScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadCategories();
    loadRestaurants();
  }, []);

  // Auto-scroll banners
  useEffect(() => {
    const timer = setInterval(() => {
      const nextBanner = (activeBanner + 1) % BANNERS.length;
      setActiveBanner(nextBanner);
      bannerScrollRef.current?.scrollTo({ x: nextBanner * (SCREEN_WIDTH - 40), animated: true });
    }, 4000);
    return () => clearInterval(timer);
  }, [activeBanner]);

  const loadCategories = async () => {
    try {
      const data = await restaurantService.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadRestaurants = async () => {
    setIsLoading(true);
    try {
      const data: PaginatedResponse<Restaurant> = await restaurantService.getAll({});
      setRestaurants(data.data);
    } catch (error) {
      console.error('Error loading restaurants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddressSelect = (address: Address) => {
    selectAddress(address);
    setShowAddressModal(false);
  };

  const renderQuickCategory = ({ item, index }: { item: typeof QUICK_CATEGORIES[0]; index: number }) => {
    const IconComponent = CATEGORY_ICONS[item.id] || UtensilsCrossed;
    return (
      <TouchableOpacity
        style={[styles.quickCategoryItem, { backgroundColor: item.color }]}
        onPress={() => navigation.navigate('Search', { category: item.id })}
      >
        {item.isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>Novo</Text>
          </View>
        )}
        <IconComponent size={28} color={item.iconColor} strokeWidth={2} />
        <Text style={styles.quickCategoryName}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  const renderRestaurant = ({ item }: { item: Restaurant }) => (
    <TouchableOpacity
      style={styles.restaurantCard}
      onPress={() => navigation.navigate('Restaurant', { slug: item.slug })}
    >
      <Image
        source={{ uri: item.logoUrl || item.coverUrl }}
        style={styles.restaurantLogo}
      />
      <View style={styles.restaurantInfo}>
        <Text style={styles.restaurantName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.restaurantMeta}>
          <Star size={12} color="#F7A922" fill="#F7A922" />
          <Text style={styles.ratingText}>{Number(item.rating).toFixed(1)}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{item.avgPrepTime}-{item.avgPrepTime + 10} min</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={[styles.metaText, Number(item.deliveryFee) === 0 && styles.freeDelivery]}>
            {Number(item.deliveryFee) === 0 ? 'Grátis' : `R$ ${Number(item.deliveryFee).toFixed(2).replace('.', ',')}`}
          </Text>
        </View>
        {Number(item.deliveryFee) === 0 && (
          <View style={styles.promoTag}>
            <Tag size={12} color="#50A773" />
            <Text style={styles.promoTagText}>R$ 4 off</Text>
          </View>
        )}
      </View>
      <TouchableOpacity style={styles.favoriteButton}>
        <Heart size={20} color="#ccc" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderBanner = (banner: typeof BANNERS[0], index: number) => (
    <View
      key={banner.id}
      style={[styles.bannerCard, { backgroundColor: banner.backgroundColor }]}
    >
      <View style={styles.bannerContent}>
        <Text style={styles.bannerTitle}>{banner.title}</Text>
        <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text>
      </View>
      <Image source={{ uri: banner.image }} style={styles.bannerImage} />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.addressButton}
          onPress={() => setShowAddressModal(true)}
        >
          <MapPin size={16} color="#EA1D2C" />
          <Text style={styles.addressText} numberOfLines={1}>
            {selectedAddress
              ? `${selectedAddress.street}, ${selectedAddress.number}`
              : 'Selecione um endereço'}
          </Text>
          <ChevronDown size={16} color="#EA1D2C" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.notificationButton}>
          <Bell size={24} color="#3E3E3E" />
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>3</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Greeting */}
      <View style={styles.greetingContainer}>
        <Text style={styles.greeting}>
          Olá, {(user?.customer?.fullName || user?.fullName)?.split(' ')[0] || 'Visitante'}
        </Text>
        <TouchableOpacity style={styles.couponButton}>
          <Ticket size={14} color="#B23AFD" />
          <Text style={styles.couponText}>Cupons até R$ 10</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Quick Categories Grid */}
        <View style={styles.quickCategoriesContainer}>
          <FlatList
            data={QUICK_CATEGORIES}
            renderItem={renderQuickCategory}
            keyExtractor={(item) => item.id}
            numColumns={4}
            scrollEnabled={false}
            columnWrapperStyle={styles.quickCategoryRow}
          />
        </View>

        {/* Banners Carousel */}
        <View style={styles.bannersContainer}>
          <ScrollView
            ref={bannerScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 40));
              setActiveBanner(index);
            }}
          >
            {BANNERS.map(renderBanner)}
          </ScrollView>
          <View style={styles.bannerDots}>
            {BANNERS.map((_, index) => (
              <View
                key={index}
                style={[styles.bannerDot, activeBanner === index && styles.bannerDotActive]}
              />
            ))}
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterButtonText}>Ordenar</Text>
            <Text style={styles.filterArrow}>▼</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterButton, styles.filterButtonActive]}>
            <Text style={[styles.filterButtonText, styles.filterButtonTextActive]}>Entrega Grátis</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterButtonText}>Vale-refeição</Text>
            <Text style={styles.filterArrow}>▼</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterButtonText}>Distância</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Restaurants List */}
        <View style={styles.restaurantsSection}>
          <Text style={styles.sectionTitle}>Lojas</Text>
          {isLoading ? (
            <ActivityIndicator size="large" color="#EA1D2C" style={styles.loader} />
          ) : (
            restaurants.map((restaurant) => (
              <View key={restaurant.id}>
                {renderRestaurant({ item: restaurant })}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Address Modal */}
      <Modal
        visible={showAddressModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecione o endereço</Text>
              <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {addressLoading ? (
              <ActivityIndicator size="large" color="#EA1D2C" style={{ padding: 20 }} />
            ) : addresses.length === 0 ? (
              <View style={styles.emptyAddresses}>
                <MapPin size={48} color="#ccc" />
                <Text style={styles.emptyAddressesText}>Nenhum endereço cadastrado</Text>
                <TouchableOpacity
                  style={styles.addAddressButton}
                  onPress={() => {
                    setShowAddressModal(false);
                    navigation.navigate('Addresses');
                  }}
                >
                  <Text style={styles.addAddressButtonText}>Adicionar endereço</Text>
                </TouchableOpacity>
              </View>
            ) : (
              addresses.map((address) => (
                <TouchableOpacity
                  key={address.id}
                  style={[
                    styles.addressOption,
                    selectedAddress?.id === address.id && styles.addressOptionSelected,
                  ]}
                  onPress={() => handleAddressSelect(address)}
                >
                  <View style={styles.addressOptionIcon}>
                    <MapPin size={20} color="#EA1D2C" />
                  </View>
                  <View style={styles.addressOptionContent}>
                    <Text style={styles.addressOptionStreet}>
                      {address.street}, {address.number}
                    </Text>
                    <Text style={styles.addressOptionDetails}>
                      {address.neighborhood}, {address.city} - {address.state}
                    </Text>
                    {address.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Padrão</Text>
                      </View>
                    )}
                  </View>
                  {selectedAddress?.id === address.id && (
                    <Check size={18} color="#EA1D2C" strokeWidth={3} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </Modal>
    </View>
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
    paddingTop: 60,
    paddingBottom: 12,
  },
  addressButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3E3E3E',
    marginRight: 4,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EA1D2C',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  greetingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '300',
    color: '#3E3E3E',
  },
  couponButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B23AFD',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  couponText: {
    fontSize: 12,
    color: '#B23AFD',
    fontWeight: '500',
  },
  quickCategoriesContainer: {
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  quickCategoryRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  quickCategoryItem: {
    width: (SCREEN_WIDTH - 48) / 4,
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  quickCategoryName: {
    fontSize: 11,
    color: '#3E3E3E',
    textAlign: 'center',
  },
  newBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EA1D2C',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  bannersContainer: {
    marginBottom: 16,
    paddingLeft: 16,
  },
  bannerCard: {
    width: SCREEN_WIDTH - 40,
    height: 160,
    borderRadius: 12,
    marginRight: 12,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  bannerContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#fff',
    marginTop: 4,
  },
  bannerImage: {
    width: 120,
    height: '100%',
  },
  bannerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ddd',
    marginHorizontal: 3,
  },
  bannerDotActive: {
    backgroundColor: '#3E3E3E',
    width: 18,
  },
  filtersContainer: {
    marginBottom: 16,
  },
  filtersContent: {
    paddingHorizontal: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#FFEBEE',
    borderColor: '#EA1D2C',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#3E3E3E',
  },
  filterButtonTextActive: {
    color: '#EA1D2C',
    fontWeight: '500',
  },
  filterArrow: {
    fontSize: 8,
    color: '#666',
    marginLeft: 4,
  },
  restaurantsSection: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3E3E3E',
    marginBottom: 16,
  },
  loader: {
    paddingVertical: 40,
  },
  restaurantCard: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  restaurantLogo: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  restaurantInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 4,
  },
  restaurantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
  },
  metaDot: {
    fontSize: 12,
    color: '#ccc',
    marginHorizontal: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  freeDelivery: {
    color: '#50A773',
    fontWeight: '500',
  },
  promoTag: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promoTagText: {
    fontSize: 12,
    color: '#50A773',
  },
  favoriteButton: {
    padding: 8,
    justifyContent: 'center',
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
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3E3E3E',
  },
  emptyAddresses: {
    padding: 40,
    alignItems: 'center',
  },
  emptyAddressesText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  addAddressButton: {
    backgroundColor: '#EA1D2C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addAddressButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  addressOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 12,
  },
  addressOptionSelected: {
    borderColor: '#EA1D2C',
    backgroundColor: '#FFF5F5',
  },
  addressOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addressOptionContent: {
    flex: 1,
  },
  addressOptionStreet: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3E3E3E',
  },
  addressOptionDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  defaultBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  defaultBadgeText: {
    fontSize: 11,
    color: '#50A773',
    fontWeight: '600',
  },
});
