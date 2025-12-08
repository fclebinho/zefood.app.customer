import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { orderService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Order } from '../types';
import { useOrdersSocket } from '../hooks/useOrdersSocket';

const statusLabels: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Preparando',
  READY: 'Pronto',
  PICKED_UP: 'Retirado',
  IN_TRANSIT: 'Em trânsito',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

const statusColors: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#fef3c7', text: '#d97706' },
  CONFIRMED: { bg: '#dbeafe', text: '#2563eb' },
  PREPARING: { bg: '#e0e7ff', text: '#4f46e5' },
  READY: { bg: '#d1fae5', text: '#059669' },
  PICKED_UP: { bg: '#ede9fe', text: '#7c3aed' },
  IN_TRANSIT: { bg: '#cffafe', text: '#0891b2' },
  OUT_FOR_DELIVERY: { bg: '#cffafe', text: '#0891b2' },
  DELIVERED: { bg: '#dcfce7', text: '#16a34a' },
  CANCELLED: { bg: '#fee2e2', text: '#dc2626' },
};

export function OrdersScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const previousOrderIdsRef = useRef<string[]>([]);

  // Handle order status update from WebSocket
  const handleOrderStatusUpdate = useCallback(
    (data: { orderId: string; status: string; order: any }) => {
      console.log('[OrdersScreen] Received status update:', data.orderId, data.status);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === data.orderId ? { ...o, status: data.status } : o
        )
      );
    },
    []
  );

  // Connect to WebSocket
  const { joinOrder, leaveOrder, isConnected } = useOrdersSocket({
    onOrderStatusUpdate: handleOrderStatusUpdate,
  });

  // Get active order IDs
  const activeOrderIds = orders
    .filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status))
    .map((o) => o.id);

  // Join/leave order rooms when active orders change
  useEffect(() => {
    const previousIds = previousOrderIdsRef.current;
    const currentIds = activeOrderIds;

    // Find new orders to join
    const toJoin = currentIds.filter((id) => !previousIds.includes(id));
    // Find orders to leave
    const toLeave = previousIds.filter((id) => !currentIds.includes(id));

    console.log('[OrdersScreen] Room changes - join:', toJoin, 'leave:', toLeave);

    toJoin.forEach((orderId) => {
      joinOrder(orderId);
    });

    toLeave.forEach((orderId) => {
      leaveOrder(orderId);
    });

    previousOrderIdsRef.current = currentIds;
  }, [activeOrderIds.join(','), joinOrder, leaveOrder]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      previousOrderIdsRef.current.forEach((orderId) => {
        leaveOrder(orderId);
      });
    };
  }, [leaveOrder]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadOrders();
      } else {
        setIsLoading(false);
      }
    }, [isAuthenticated])
  );

  const loadOrders = async () => {
    try {
      const data = await orderService.getMyOrders();
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadOrders();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🔒</Text>
        <Text style={styles.emptyTitle}>Faça login</Text>
        <Text style={styles.emptySubtitle}>
          Entre na sua conta para ver seus pedidos
        </Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>Fazer login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📦</Text>
        <Text style={styles.emptyTitle}>Nenhum pedido</Text>
        <Text style={styles.emptySubtitle}>
          Você ainda não fez nenhum pedido
        </Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.loginButtonText}>Ver restaurantes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isTrackable = (status: string) => {
    return ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(status);
  };

  const handleTrackOrder = (orderId: string) => {
    navigation.navigate('OrderTracking', { orderId });
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const colors = statusColors[item.status] || statusColors.PENDING;
    const canTrack = isTrackable(item.status);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => canTrack ? handleTrackOrder(item.id) : undefined}
      >
        <View style={styles.orderHeader}>
          <Text style={styles.orderNumber}>Pedido #{item.orderNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.statusText, { color: colors.text }]}>
              {statusLabels[item.status]}
            </Text>
          </View>
        </View>

        <Text style={styles.restaurantName}>{item.restaurant?.name}</Text>
        <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>

        <View style={styles.orderItems}>
          {item.items?.slice(0, 2).map((orderItem, index) => (
            <Text key={index} style={styles.orderItemText}>
              {orderItem.quantity}x {orderItem.menuItem?.name || orderItem.name}
            </Text>
          ))}
          {item.items && item.items.length > 2 && (
            <Text style={styles.moreItems}>
              +{item.items.length - 2} item(s)
            </Text>
          )}
        </View>

        <View style={styles.orderFooter}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            R$ {Number(item.total).toFixed(2).replace('.', ',')}
          </Text>
        </View>

        {canTrack && (
          <TouchableOpacity
            style={styles.trackButton}
            onPress={() => handleTrackOrder(item.id)}
          >
            <Text style={styles.trackButtonText}>📍 Acompanhar Entrega</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meus Pedidos</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#f97316']}
            tintColor="#f97316"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 64,
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  list: {
    padding: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  restaurantName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  orderItems: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  orderItemText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  moreItems: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f97316',
  },
  trackButton: {
    backgroundColor: '#f97316',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  trackButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
