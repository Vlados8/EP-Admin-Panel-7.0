import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';
import { 
  MessageCircle, 
  FileText, 
  CheckSquare as SquareCheck, 
  Briefcase, 
  Mail 
} from 'lucide-react-native';

import LoginScreen from './screens/LoginScreen';
import ChatListScreen from './screens/ChatListScreen';
import ChatDetailScreen from './screens/ChatDetailScreen';
import NotesScreen from './screens/NotesScreen';
import TasksScreen from './screens/TasksScreen';
import ProjectsScreen from './screens/ProjectsScreen';
import EmailScreen from './screens/EmailScreen';
import ProjectDetailScreen from './screens/ProjectDetailScreen';
import TaskDetailScreen from './screens/TaskDetailScreen';
import EmailDetailScreen from './screens/EmailDetailScreen';
import NotificationSettingsScreen from './screens/NotificationSettingsScreen';
import { useAuth } from './context/AuthContext';
import { registerForPushNotificationsAsync } from './services/pushNotificationHelper';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          paddingBottom: 10,
          paddingTop: 10,
          height: 70,
          backgroundColor: '#0a0a0c',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
        },
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Chat') return <MessageCircle size={size} color={color} />;
          if (route.name === 'Notizen') return <FileText size={size} color={color} />;
          if (route.name === 'Aufgaben') return <SquareCheck size={size} color={color} />;
          if (route.name === 'Projekte') return <Briefcase size={size} color={color} />;
          if (route.name === 'E-Mail') return <Mail size={size} color={color} />;
          return null;
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: 'bold',
          paddingBottom: 5,
        },
      })}
    >
      <Tab.Screen name="Chat" component={ChatListScreen} />
      <Tab.Screen name="Projekte" component={ProjectsScreen} />
      <Tab.Screen name="Aufgaben" component={TasksScreen} />
      <Tab.Screen name="Notizen" component={NotesScreen} />
      <Tab.Screen name="E-Mail" component={EmailScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync();
    }
  }, [user]);

  if (isLoading && !user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0c' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
            <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
            <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
            <Stack.Screen name="EmailDetail" component={EmailDetailScreen} />
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
