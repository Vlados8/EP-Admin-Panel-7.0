import { io } from 'socket.io-client';

const getSocketUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
    // Remove /api/v1 or any trailing path to get the base origin
    return apiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
};

const SOCKET_URL = getSocketUrl();

class SocketService {
    constructor() {
        this.socket = null;
    }

    connect() {
        if (this.socket) return;
        
        const token = localStorage.getItem('token');
        if (!token) return;

        this.socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000
        });

        this.socket.on('connect', () => {
            console.log('Connected to WebSocket server:', this.socket.id);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket server');
        });

        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    on(event, callback) {
        if (!this.socket) this.connect();
        if (this.socket) {
            this.socket.on(event, callback);
        }
    }

    off(event, callback) {
        if (this.socket) {
            this.socket.off(event, callback);
        }
    }

    emit(event, data) {
        if (!this.socket) this.connect();
        if (this.socket) {
            this.socket.emit(event, data);
        }
    }
}

const socketService = new SocketService();
export default socketService;
