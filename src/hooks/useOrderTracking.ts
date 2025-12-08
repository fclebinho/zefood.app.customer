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

  // Fetch tracking data via REST API as fallback
  const fetchTrackingData = useCallback(async () => {
    if (!orderId) return;

    try {
      const response = await api.get(`/tracking/order/${orderId}`);
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
      console.error('Error fetching tracking data:', err);
      if (err.response?.status === 401) {
        setError('Sessão expirada. Faça login novamente.');
      } else {
        setError(err.response?.data?.message || 'Erro ao carregar rastreamento');
      }
    }
  }, [orderId]);

  // Connect to tracking socket
  const connect = useCallback(async () => {
    if (!orderId) return;

    try {
      const token = await SecureStore.getItemAsync('token');

      socketRef.current = io(`${WS_URL}/tracking`, {
        transports: ['websocket'],
        auth: { token },
      });

      socketRef.current.on('connect', () => {
        console.log('Tracking socket connected');
        setIsConnected(true);
        setError(null);

        // Subscribe to order tracking
        socketRef.current?.emit('subscribeToOrder', orderId);

        // Get initial tracking data via socket with callback
        socketRef.current?.emit('getOrderTracking', orderId, (response: any) => {
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
      });

      socketRef.current.on('disconnect', () => {
        console.log('Tracking socket disconnected');
        setIsConnected(false);
      });

      socketRef.current.on('connect_error', (err: any) => {
        console.error('Tracking socket connection error:', err);
        // Fallback to REST API
        fetchTrackingData();
      });

      socketRef.current.on('error', (err: any) => {
        console.error('Tracking socket error:', err);
        setError('Erro de conexão');
      });

      // Handle driver location updates (real-time)
      socketRef.current.on('driverLocation', (data: DriverLocation & { orderId: string }) => {
        if (data.orderId === orderId) {
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
      socketRef.current.on('orderTracking', (data: { data: TrackingData }) => {
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
      socketRef.current.on('orderStatusUpdate', (data: { orderId: string; status: string }) => {
        if (data.orderId === orderId) {
          setTrackingData((prev) =>
            prev ? { ...prev, status: data.status } : null
          );
        }
      });

      // Handle driver arrived notification
      socketRef.current.on('driverArrived', (data: { orderId: string; location: string }) => {
        console.log(`Driver arrived at ${data.location}`);
      });

      // Set timeout for initial data - fallback to REST if socket takes too long
      setTimeout(() => {
        if (!trackingData) {
          console.log('Socket timeout, fetching via REST API');
          fetchTrackingData();
        }
      }, 3000);

    } catch (err) {
      console.error('Failed to connect tracking socket:', err);
      setError('Falha ao conectar');
      // Fallback to REST API
      fetchTrackingData();
    }
  }, [orderId, fetchTrackingData]);

  // Disconnect socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      if (orderId) {
        socketRef.current.emit('unsubscribeFromOrder', orderId);
      }
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
  }, [orderId]);

  // Refresh tracking data
  const refresh = useCallback(() => {
    if (socketRef.current?.connected && orderId) {
      socketRef.current.emit('getOrderTracking', orderId, (response: any) => {
        if (response?.data) {
          setTrackingData(response.data);
        }
      });
    } else {
      fetchTrackingData();
    }
  }, [orderId, fetchTrackingData]);

  // Connect when orderId changes
  useEffect(() => {
    if (orderId) {
      // First fetch via REST API for immediate data
      fetchTrackingData();
      // Then connect socket for real-time updates
      connect();
    }

    return () => {
      disconnect();
    };
  }, [orderId, connect, disconnect, fetchTrackingData]);

  return {
    trackingData,
    driverLocation,
    isConnected,
    error,
    refresh,
  };
}
