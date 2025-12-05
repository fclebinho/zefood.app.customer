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

  useEffect(() => {
    // Create socket connection
    const socket = io(`${API_URL}/orders`, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');

      // Join order room if orderId is provided
      if (orderId) {
        socket.emit('joinOrder', orderId);
      }
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    // Listen for order status updates
    socket.on('orderStatusUpdate', (data: OrderStatusUpdate) => {
      console.log('Order status update:', data.orderId, data.status);
      onOrderStatusUpdate?.(data);
    });

    // Cleanup on unmount
    return () => {
      if (orderId) {
        socket.emit('leaveOrder', orderId);
      }
      socket.disconnect();
    };
  }, [orderId, onOrderStatusUpdate]);

  const joinOrder = useCallback((id: string) => {
    socketRef.current?.emit('joinOrder', id);
  }, []);

  const leaveOrder = useCallback((id: string) => {
    socketRef.current?.emit('leaveOrder', id);
  }, []);

  return {
    socket: socketRef.current,
    joinOrder,
    leaveOrder,
  };
}
