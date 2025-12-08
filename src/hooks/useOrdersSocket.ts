import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../services/api';

interface OrderStatusUpdate {
  orderId: string;
  status: string;
  order: any;
}

interface UseOrdersSocketOptions {
  orderId?: string;
  onOrderStatusUpdate?: (data: OrderStatusUpdate) => void;
}

export function useOrdersSocket({
  orderId,
  onOrderStatusUpdate,
}: UseOrdersSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const onOrderStatusUpdateRef = useRef(onOrderStatusUpdate);
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  // Keep the callback ref updated without triggering reconnection
  useEffect(() => {
    onOrderStatusUpdateRef.current = onOrderStatusUpdate;
  }, [onOrderStatusUpdate]);

  useEffect(() => {
    // Create socket connection only once
    const socket = io(`${API_URL}/orders`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[useOrdersSocket] WebSocket connected, socket id:', socket.id);

      // Rejoin all rooms after reconnection
      joinedRoomsRef.current.forEach((roomId) => {
        console.log('[useOrdersSocket] Rejoining room after connect:', roomId);
        socket.emit('joinOrder', roomId);
      });

      // Join order room if orderId is provided
      if (orderId) {
        console.log('[useOrdersSocket] Joining initial order room:', orderId);
        socket.emit('joinOrder', orderId);
        joinedRoomsRef.current.add(orderId);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[useOrdersSocket] WebSocket disconnected, reason:', reason);
    });

    socket.on('connect_error', (error) => {
      console.log('[useOrdersSocket] Connection error:', error.message);
    });

    // Listen for order status updates - use ref to avoid stale closure
    socket.on('orderStatusUpdate', (data: OrderStatusUpdate) => {
      console.log('[useOrdersSocket] Order status update received:', data.orderId, data.status);
      onOrderStatusUpdateRef.current?.(data);
    });

    // Cleanup on unmount only
    return () => {
      console.log('[useOrdersSocket] Cleaning up socket connection');
      joinedRoomsRef.current.forEach((roomId) => {
        socket.emit('leaveOrder', roomId);
      });
      joinedRoomsRef.current.clear();
      socket.disconnect();
    };
  }, []); // Empty dependency array - socket is created only once

  // Handle orderId changes separately
  useEffect(() => {
    if (!orderId || !socketRef.current?.connected) return;

    if (!joinedRoomsRef.current.has(orderId)) {
      console.log('[useOrdersSocket] Joining order room:', orderId);
      socketRef.current.emit('joinOrder', orderId);
      joinedRoomsRef.current.add(orderId);
    }

    return () => {
      if (orderId && socketRef.current?.connected) {
        console.log('[useOrdersSocket] Leaving order room:', orderId);
        socketRef.current.emit('leaveOrder', orderId);
        joinedRoomsRef.current.delete(orderId);
      }
    };
  }, [orderId]);

  const joinOrder = useCallback((id: string) => {
    if (socketRef.current?.connected && !joinedRoomsRef.current.has(id)) {
      console.log('[useOrdersSocket] joinOrder called for:', id);
      socketRef.current.emit('joinOrder', id);
      joinedRoomsRef.current.add(id);
    }
  }, []);

  const leaveOrder = useCallback((id: string) => {
    if (socketRef.current?.connected && joinedRoomsRef.current.has(id)) {
      console.log('[useOrdersSocket] leaveOrder called for:', id);
      socketRef.current.emit('leaveOrder', id);
      joinedRoomsRef.current.delete(id);
    }
  }, []);

  const isConnected = useCallback(() => {
    return socketRef.current?.connected ?? false;
  }, []);

  return {
    socket: socketRef.current,
    joinOrder,
    leaveOrder,
    isConnected,
  };
}
