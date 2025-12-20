import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import api, { WS_URL } from '../services/api';

interface DriverLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: Date;
}

interface TrackingData {
  orderId: string;
  status: string;
  driver: {
    id: string;
    name: string;
    phone?: string;
    vehicleType?: string;
    vehiclePlate?: string;
    location: {
      latitude: number;
      longitude: number;
      lastUpdate: Date;
    } | null;
  } | null;
  restaurant: {
    id: string;
    name: string;
    address: string;
  };
  deliveryAddress: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
  } | null;
  estimatedDelivery?: Date;
}

interface UseOrderTrackingProps {
  orderId: string | null;
}

export function useOrderTracking({ orderId }: UseOrderTrackingProps) {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const orderIdRef = useRef<string | null>(orderId);
  const hasConnectedRef = useRef(false);

  // Keep orderIdRef updated
  useEffect(() => {
    orderIdRef.current = orderId;
  }, [orderId]);

  // Fetch tracking data via REST API as fallback
  const fetchTrackingData = useCallback(async () => {
    const currentOrderId = orderIdRef.current;
    if (!currentOrderId) return;

    try {
      console.log('[useOrderTracking] Fetching tracking data via REST for:', currentOrderId);
      const response = await api.get(`/tracking/order/${currentOrderId}`);
      const data = response.data;

      setTrackingData(data);
      setError(null);

      // Set initial driver location if available
      if (data.driver?.location) {
        setDriverLocation({
          driverId: data.driver.id,
          latitude: data.driver.location.latitude,
          longitude: data.driver.location.longitude,
          timestamp: new Date(data.driver.location.lastUpdate),
        });
      }
    } catch (err: any) {
      console.error('[useOrderTracking] Error fetching tracking data:', err);
      if (err.response?.status === 401) {
        setError('Sessão expirada. Faça login novamente.');
      } else {
        setError(err.response?.data?.message || 'Erro ao carregar rastreamento');
      }
    }
  }, []);

  // Main socket connection effect - runs only once per orderId
  useEffect(() => {
    if (!orderId) return;

    // Prevent duplicate connections
    if (hasConnectedRef.current && socketRef.current?.connected) {
      console.log('[useOrderTracking] Already connected, skipping');
      return;
    }

    console.log('[useOrderTracking] Connecting to WebSocket at:', `${WS_URL}/tracking`);

    const connectSocket = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');

        const socket = io(`${WS_URL}/tracking`, {
          transports: ['websocket', 'polling'],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
        });

        socketRef.current = socket;
        hasConnectedRef.current = true;

        socket.on('connect', () => {
          console.log('[useOrderTracking] WebSocket connected, socket id:', socket.id);
          setIsConnected(true);
          setError(null);

          const currentOrderId = orderIdRef.current;
          if (currentOrderId) {
            // Subscribe to order tracking
            console.log('[useOrderTracking] Subscribing to order:', currentOrderId);
            socket.emit('subscribeToOrder', currentOrderId);

            // Get initial tracking data via socket with callback
            socket.emit('getOrderTracking', currentOrderId, (response: any) => {
              console.log('[useOrderTracking] Got tracking data from socket:', response);
              if (response?.data) {
                setTrackingData(response.data);
                if (response.data.driver?.location) {
                  setDriverLocation({
                    driverId: response.data.driver.id,
                    latitude: response.data.driver.location.latitude,
                    longitude: response.data.driver.location.longitude,
                    timestamp: new Date(response.data.driver.location.lastUpdate),
                  });
                }
              }
            });
          }
        });

        socket.on('disconnect', (reason) => {
          console.log('[useOrderTracking] WebSocket disconnected, reason:', reason);
          setIsConnected(false);
        });

        socket.on('connect_error', (err: any) => {
          console.error('[useOrderTracking] Connection error:', err.message);
          // Fallback to REST API
          fetchTrackingData();
        });

        socket.on('error', (err: any) => {
          console.error('[useOrderTracking] Socket error:', err);
          setError('Erro de conexão');
        });

        // Handle driver location updates (real-time)
        socket.on('driverLocation', (data: DriverLocation & { orderId: string }) => {
          const currentOrderId = orderIdRef.current;
          console.log('[useOrderTracking] Driver location update:', data.orderId, data.latitude, data.longitude);
          if (data.orderId === currentOrderId) {
            setDriverLocation({
              driverId: data.driverId,
              latitude: data.latitude,
              longitude: data.longitude,
              heading: data.heading,
              speed: data.speed,
              timestamp: new Date(data.timestamp),
            });
          }
        });

        // Handle tracking data updates (event-based)
        socket.on('orderTracking', (data: { data: TrackingData }) => {
          console.log('[useOrderTracking] Tracking data update:', data);
          if (data.data) {
            setTrackingData(data.data);
            if (data.data.driver?.location) {
              setDriverLocation({
                driverId: data.data.driver.id,
                latitude: data.data.driver.location.latitude,
                longitude: data.data.driver.location.longitude,
                timestamp: new Date(data.data.driver.location.lastUpdate),
              });
            }
          }
        });

        // Handle order status updates
        socket.on('orderStatusUpdate', (data: { orderId: string; status: string }) => {
          const currentOrderId = orderIdRef.current;
          console.log('[useOrderTracking] Order status update:', data.orderId, data.status);
          if (data.orderId === currentOrderId) {
            setTrackingData((prev) =>
              prev ? { ...prev, status: data.status } : null
            );
          }
        });

        // Handle driver arrived notification
        socket.on('driverArrived', (data: { orderId: string; location: string }) => {
          console.log(`[useOrderTracking] Driver arrived at ${data.location}`);
        });

      } catch (err) {
        console.error('[useOrderTracking] Failed to connect tracking socket:', err);
        setError('Falha ao conectar');
        // Fallback to REST API
        fetchTrackingData();
      }
    };

    // First fetch via REST API for immediate data
    fetchTrackingData();
    // Then connect socket for real-time updates
    connectSocket();

    // Cleanup on unmount or orderId change
    return () => {
      console.log('[useOrderTracking] Cleaning up socket connection');
      if (socketRef.current) {
        const currentOrderId = orderIdRef.current;
        if (currentOrderId) {
          socketRef.current.emit('unsubscribeFromOrder', currentOrderId);
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      hasConnectedRef.current = false;
      setIsConnected(false);
    };
  }, [orderId, fetchTrackingData]);

  // Refresh tracking data
  const refresh = useCallback(() => {
    const currentOrderId = orderIdRef.current;
    if (socketRef.current?.connected && currentOrderId) {
      socketRef.current.emit('getOrderTracking', currentOrderId, (response: any) => {
        if (response?.data) {
          setTrackingData(response.data);
        }
      });
    } else {
      fetchTrackingData();
    }
  }, [fetchTrackingData]);

  return {
    trackingData,
    driverLocation,
    isConnected,
    error,
    refresh,
  };
}
