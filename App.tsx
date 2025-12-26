import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Home, Search, ClipboardList, User } from 'lucide-react-native';

import { AuthProvider } from './src/hooks/useAuth';
import { CartProvider } from './src/hooks/useCart';
import { AddressProvider } from './src/hooks/useAddress';
import { SavedCardsProvider } from './src/hooks/useSavedCards';
import { CartBar } from './src/components/CartBar';
import api from './src/services/api';

import {
  HomeScreen,
  RestaurantScreen,
  CartScreen,
  LoginScreen,
  RegisterScreen,
  OrdersScreen,
  ProfileScreen,
  CheckoutScreen,
  AddressesScreen,
  OrderTrackingScreen,
} from './src/screens';
import { AddCardScreen } from './src/screens/AddCardScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, React.ComponentType<any>> = {
  Home: Home,
  Search: Search,
  Orders: ClipboardList,
  Profile: User,
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const IconComponent = TAB_ICONS[name] || Home;
  const color = focused ? '#EA1D2C' : '#999';

  return (
    <View style={styles.tabIconContainer}>
      <IconComponent size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
    </View>
  );
}

function ProfileTabIcon({ focused }: { focused: boolean }) {
  const color = focused ? '#EA1D2C' : '#999';

  return (
    <View style={styles.tabIconContainer}>
      <User size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
      <View style={styles.profileBadge}>
        <View style={styles.profileBadgeDot} />
      </View>
    </View>
  );
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  return (
    <View style={styles.customTabBarContainer}>
      <CartBar />
      <View style={styles.tabBar}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
            >
              {route.name === 'Profile' ? (
                <ProfileTabIcon focused={isFocused} />
              ) : (
                <TabIcon name={route.name} focused={isFocused} />
              )}
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function HomeTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Início' }}
      />
      <Tab.Screen
        name="Search"
        component={HomeScreen}
        options={{ tabBarLabel: 'Busca' }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{ tabBarLabel: 'Pedidos' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Perfil' }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTintColor: '#3E3E3E',
        headerShadowVisible: false,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="Main"
        component={HomeTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Restaurant"
        component={RestaurantScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Cart"
        component={CartScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: 'Entrar' }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: 'Criar conta' }}
      />
      <Stack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Addresses"
        component={AddressesScreen}
        options={{ title: 'Meus endereços' }}
      />
      <Stack.Screen
        name="OrderTracking"
        component={OrderTrackingScreen}
        options={{ title: 'Acompanhar Pedido', headerShown: false }}
      />
      <Stack.Screen
        name="AddCard"
        component={AddCardScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  customTabBarContainer: {
    backgroundColor: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingBottom: 8,
    paddingTop: 8,
    height: 65,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    color: '#999',
  },
  tabLabelActive: {
    color: '#EA1D2C',
  },
  tabIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBadge: {
    position: 'absolute',
    top: -2,
    right: -8,
  },
  profileBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EA1D2C',
  },
});

export default function App() {
  const [stripePublishableKey, setStripePublishableKey] = useState<string | null>(null);

  useEffect(() => {
    // Fetch Stripe publishable key from backend
    const fetchStripeKey = async () => {
      try {
        const response = await api.get('/payments/stripe/publishable-key');
        if (response.data?.publishableKey) {
          setStripePublishableKey(response.data.publishableKey);
        }
      } catch (error) {
        console.log('Stripe not configured or error fetching key');
      }
    };
    fetchStripeKey();
  }, []);

  // Render app content - StripeProvider only wraps if key is available
  const appContent = (
    <AuthProvider>
      <AddressProvider>
        <SavedCardsProvider>
          <CartProvider>
            <NavigationContainer>
              <StatusBar style="dark" />
              <AppNavigator />
            </NavigationContainer>
          </CartProvider>
        </SavedCardsProvider>
      </AddressProvider>
    </AuthProvider>
  );

  return (
    <SafeAreaProvider>
      {stripePublishableKey ? (
        <StripeProvider publishableKey={stripePublishableKey}>
          {appContent}
        </StripeProvider>
      ) : (
        appContent
      )}
    </SafeAreaProvider>
  );
}
