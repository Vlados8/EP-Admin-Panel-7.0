import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { serverDomain } from '../api/client';

class SocketService {
    private socket: Socket | null = null;
    private listeners: Map<string, Function[]> = new Map();

    connect = async () => {
        if (this.socket?.connected) return;
        
        const token = await SecureStore.getItemAsync('token');
        if (!token) return;

        this.socket = io(serverDomain, {
            auth: { token },
            transports: ['websocket'],
        });

        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket?.id);
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        // Register queued listeners
        this.listeners.forEach((callbacks, event) => {
            callbacks.forEach(cb => {
                this.socket?.on(event, cb as any);
            });
        });
    };

    disconnect = () => {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    };

    on = (event: string, callback: Function) => {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)?.push(callback);

        if (this.socket) {
            this.socket.on(event, callback as any);
        }
    };

    off = (event: string, callback?: Function) => {
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

    emit = (event: string, data?: any) => {
        if (this.socket?.connected) {
            this.socket.emit(event, data);
        } else {
            console.warn('Socket not connected, cannot emit:', event);
        }
    };
}

const socketService = new SocketService();
export default socketService;
