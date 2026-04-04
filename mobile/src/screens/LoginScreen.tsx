import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  Image, 
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ScreenLayout } from '../components/ScreenLayout';
import { GlassCard } from '../components/GlassCard';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const { login, isLoading } = useAuth();
  
  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Bitte Email und Passwort eingeben.');
      return;
    }

    try {
      setErrorMsg('');
      Keyboard.dismiss();
      await login(email, password);
    } catch (err: any) {
      console.error('[Login] Error:', err);
      
      let message = 'Anmeldung fehlgeschlagen. Bitte Anmeldedaten überprüfen.';
      
      if (err.message === 'Network Error') {
        message = 'Keine Verbindung zum Server. Bitte Internetverbindung и IP-Adresse prüfen.';
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      }
      
      setErrorMsg(message);
    }
  };

  return (
    <ScreenLayout scroll={false} padding={false}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          className="flex-1"
        >
          <View className="flex-1 items-center justify-center p-8">
            <View className="items-center mb-10">
              <Image 
                source={require('../../assets/logo-white.png')} 
                style={{ width: 140, height: 140, resizeMode: 'contain' }} 
              />
              <Text className="text-3xl font-bold text-white mt-4 uppercase tracking-widest">
                Empire Premium
              </Text>
              <View className="h-1 w-20 bg-brand-blue mt-2 rounded-full" />
            </View>

            <GlassCard className="w-full max-w-sm p-6">
              <Text className="text-white text-lg font-bold mb-6 text-center">
                Anmelden
              </Text>

              {errorMsg ? (
                <View className="bg-red-500/20 p-3 rounded-xl mb-4 border border-red-500/50">
                  <Text className="text-red-200 text-sm text-center font-medium">{errorMsg}</Text>
                </View>
              ) : null}

              <View className="mb-4">
                <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Email
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email Adresse"
                  placeholderTextColor="#6B7280"
                  className="bg-white/10 border border-white/10 rounded-xl px-4 py-4 text-white"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              <View className="mb-8">
                <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Passwort
                </Text>
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Passwort"
                  placeholderTextColor="#6B7280"
                  secureTextEntry
                  className="bg-white/10 border border-white/10 rounded-xl px-4 py-4 text-white"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
              </View>

              <TouchableOpacity
                onPress={handleLogin}
                disabled={isLoading}
                className={`w-full bg-brand-blue py-4 rounded-xl flex-row justify-center items-center shadow-lg shadow-blue-500/30 ${
                  isLoading ? 'opacity-70' : ''
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-base uppercase tracking-widest">
                    Anmelden
                  </Text>
                )}
              </TouchableOpacity>
            </GlassCard>

            <Text className="text-gray-500 mt-10 text-xs uppercase tracking-widest font-semibold text-center leading-5">
              Empire Premium Bau Management{"\n"}v1.0.0
            </Text>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </ScreenLayout>
  );
}
