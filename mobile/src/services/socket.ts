import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { serverDomain } from '../api/client';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  /**
   * Connect to backend Socket.io server using JWT auth token from SecureStore.
   * Optimized for React Native (WebSockets transport, manual connect, robust error handling).
   */
  connect = async (): Promise<void> => {
    if (this.socket?.connected) return;
    
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      console.warn('[Socket] Connection aborted: No auth token found.');
      return;
    }

    this.socket = io(serverDomain, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
      forceNew: true,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected natively:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    // Register any listeners queued before the socket was initialized
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(cb => {
        this.socket?.on(event, cb as any);
      });
    });

    this.socket.connect();
  };

  /**
   * Disconnect the active socket cleanly
   */
  disconnect = (): void => {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('[Socket] Disconnected cleanly');
    }
  };

  /**
   * Listen to socket events
   */
  on = (event: string, callback: Function): void => {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);

    if (this.socket) {
      this.socket.on(event, callback as any);
    }
  };

  /**
   * Stop listening to socket events
   */
  off = (event: string, callback?: Function): void => {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback as any);
      } else {
        this.socket.off(event);
      }
    }

    if (callback) {
      const callbacks = this.listeners.get(event) || [];
      this.listeners.set(event, callbacks.filter(cb => cb !== callback));
    } else {
      this.listeners.delete(event);
    }
  };

  /**
   * Emit socket events
   */
  emit = (event: string, data?: any): void => {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('[Socket] Not connected, event queued or dropped:', event);
    }
  };
}

const socketService = new SocketService();
export default socketService;
