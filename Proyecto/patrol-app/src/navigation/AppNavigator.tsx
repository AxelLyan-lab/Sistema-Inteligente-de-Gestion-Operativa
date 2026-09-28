import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import EvidenceScreen from '../screens/EvidenceScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { Colors, Fonts } from '../theme';
import { Feather } from '@expo/vector-icons';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, any> = {
  Inicio: 'home',
  Evidencia: 'file-text',
  Mensajes: 'message-square',
  Perfil: 'user',
};

/**
 * MainTabs — Bottom Navigation con los 4 accesos operativos (Figma)
 */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, size, color }) => {
          const iconName = TAB_ICONS[route.name];
          return (
            <Feather 
              name={iconName} 
              size={size * 0.9} 
              color={color} 
            />
          );
        },
      })}
    >
      {/* 1. Inicio / Mapa */}
      <Tab.Screen
        name="Inicio"
        component={HomeScreen}
        options={{ tabBarLabel: 'Inicio' }}
      />
      {/* 2. Cargar Evidencia */}
      <Tab.Screen
        name="Evidencia"
        component={EvidenceScreen}
        options={{ tabBarLabel: 'Evidencia' }}
      />
      {/* 3. Mensaje Supervisor */}
      <Tab.Screen
        name="Mensajes"
        component={MessagesScreen}
        options={{ tabBarLabel: 'Mensajes' }}
      />
      {/* 4. Perfil Funcionario */}
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Perfil' }}
      />
    </Tab.Navigator>
  );
}

/**
 * AppNavigator — Router principal con AuthStack y MainTabs (Tarea #44)
 * Redirige automáticamente según estado de autenticación
 */
export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <Feather name="shield" size={64} color={Colors.textWhite} />
        <Text style={styles.loaderLabel}>S.I.G.O. Patrol</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // AuthStack — sin sesión activa
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          // MainTabs — con sesión activa
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.tabBar,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 68,
    paddingBottom: 10,
    paddingTop: 6,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  tabLabel: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  loader: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: { fontSize: 64 },
  loaderLabel: {
    color: Colors.textWhite,
    fontSize: Fonts.sizes.xxl,
    fontWeight: '800',
    letterSpacing: 4,
    marginTop: 16,
  },
});
