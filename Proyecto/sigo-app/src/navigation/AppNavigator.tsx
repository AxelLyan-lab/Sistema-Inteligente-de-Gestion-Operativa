import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, StatusBar } from 'react-native';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import EvidenceScreen from '../screens/EvidenceScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { Fonts, ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import Icon, { IconName } from '../components/Icon';

import { useMessageBadge } from '../services/messageBadge.service';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, IconName> = {
  Inicio: 'inicio',
  Evidencia: 'evidencia',
  Mensajes: 'mensajes',
  Perfil: 'perfil',
};

/**
 * MainTabs — Bottom Navigation con los 4 accesos operativos (Figma)
 */
function MainTabs() {
  const { Colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { hasUnread } = useMessageBadge();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color }) => (
          <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={TAB_ICONS[route.name]} size={22} color={color} />
            {route.name === 'Mensajes' && hasUnread && (
              <View
                style={{
                  position: 'absolute',
                  top: 1,
                  right: 0,
                  width: 7,
                  height: 7,
                  borderRadius: 3.5,
                  backgroundColor: '#dc2626',
                  borderWidth: 1,
                  borderColor: Colors.tabBar,
                }}
              />
            )}
          </View>
        ),
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
  const { Colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <Icon name="escudo" size={56} color={Colors.textWhite} />
        <Text style={styles.loaderLabel}>S.I.G.O. Patrol</Text>
      </View>
    );
  }

  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: Colors.primary,
      background: Colors.background,
      card: Colors.tabBar,
      text: Colors.textPrimary,
      border: Colors.border,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
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

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    tabBar: {
      backgroundColor: Colors.tabBar,
      borderTopColor: Colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      height: 64,
      paddingBottom: 10,
      paddingTop: 8,
      elevation: 0,
      shadowOpacity: 0,
    },
    tabLabel: {
      fontSize: Fonts.sizes.xs,
      fontWeight: '500',
      letterSpacing: 0.2,
      marginTop: 2,
    },
    loader: {
      flex: 1,
      backgroundColor: Colors.backgroundDark,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loaderLabel: {
      color: Colors.textWhite,
      fontSize: Fonts.sizes.xl,
      fontWeight: '500',
      letterSpacing: 4,
      marginTop: 16,
    },
  });
