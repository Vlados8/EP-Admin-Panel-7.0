import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunk for login
export const login = createAsyncThunk(
    'auth/login',
    async (credentials, { rejectWithValue }) => {
        try {
            const response = await api.post('/auth/login', credentials);
            return response.data; // should contain { token, data: { user } }
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Login failed. Please check your credentials.');
        }
    }
);

export const loginSubcontractor = createAsyncThunk(
    'auth/loginSubcontractor',
    async (credentials, { rejectWithValue }) => {
        try {
            const response = await api.post('/auth/subcontractor/login', credentials);
            return response.data; // should contain { token, data: { user } }
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Login fehlgeschlagen. Bitte überprüfen Sie Ihre Daten.');
        }
    }
);

const initialState = {
    user: JSON.parse(localStorage.getItem('user')) || null,
    token: localStorage.getItem('token') || null,
    isAuthenticated: !!localStorage.getItem('token'),
    isLoading: false,
    error: null,
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
            state.error = null;
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        },
        clearError: (state) => {
            state.error = null;
        },
        updateUser: (state, action) => {
            state.user = { ...state.user, ...action.payload };
            localStorage.setItem('user', JSON.stringify(state.user));
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(login.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(login.fulfilled, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = true;
                state.token = action.payload.token;
                state.user = action.payload.data.user;

                localStorage.setItem('token', action.payload.token);
                localStorage.setItem('user', JSON.stringify(action.payload.data.user));
            })
            .addCase(login.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            })
            .addCase(loginSubcontractor.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(loginSubcontractor.fulfilled, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = true;
                state.token = action.payload.token;
                state.user = action.payload.data.user;

                localStorage.setItem('token', action.payload.token);
                localStorage.setItem('user', JSON.stringify(action.payload.data.user));
            })
            .addCase(loginSubcontractor.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            });
    }
});

export const { logout, clearError, updateUser } = authSlice.actions;

export default authSlice.reducer;
