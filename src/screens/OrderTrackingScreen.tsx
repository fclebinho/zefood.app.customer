import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  ScrollView,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { ArrowLeft, Check, AlertTriangle, Phone, User } from 'lucide-react-native';
import { useOrderTracking } from '../hooks/useOrderTracking';

const { width } = Dimensions.get('window');

const statusLabels: Record<string, string> = {
  PENDING: 'Aguardando confirmacao',
  CONFIRMED: 'Pedido confirmado',
  PREPARING: 'Preparando seu pedido',
  READY: 'Pronto para retirada',
  PICKED_UP: 'Entregador retirou o pedido',
  IN_TRANSIT: 'Pedido a caminho',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

const statusSteps = [
  'CONFIRMED',
  'PREPARING',
  'READY',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
];

export function OrderTrackingScreen({ route, navigation }: any) {
  const { orderId } = route.params;
  const { trackingData, driverLocation, isConnected, error, refresh } = useOrderTracking({
    orderId,
  });

  const getCurrentStep = () => {
    if (!trackingData) return 0;
    const index = statusSteps.indexOf(trackingData.status);
    return index >= 0 ? index : 0;
  };

  const callDriver = () => {
    if (trackingData?.driver?.phone) {
      Linking.openURL(`tel:${trackingData.driver.phone}`);
    }
  };

  const openInMaps = () => {
    if (driverLocation) {
      const url = `https://www.google.com/maps/search/?api=1&query=${driverLocation.latitude},${driverLocation.longitude}`;
      Linking.openURL(url);
    }
  };

  const formatAddress = (address: any) => {
    if (!address) return 'Endereco nao disponivel';
    return `${address.street}, ${address.number}${address.complement ? ` - ${address.complement}` : ''}, ${address.neighborhood}`;
  };

  // Generate map HTML using Leaflet (OpenStreetMap)
  const mapHtml = useMemo(() => {
    if (!driverLocation) return '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { width: 100%; height: 100vh; }
          .driver-marker {
            background: #EA1D2C;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map').setView([${driverLocation.latitude}, ${driverLocation.longitude}], 16);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
          }).addTo(map);

          var driverIcon = L.divIcon({
            className: 'driver-marker',
            html: '<div style="font-size: 24px; text-align: center; line-height: 40px;">🛵</div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          });

          var marker = L.marker([${driverLocation.latitude}, ${driverLocation.longitude}], { icon: driverIcon }).addTo(map);
          marker.bindPopup('Entregador').openPopup();
        </script>
      </body>
      </html>
    `;
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  if (!orderId) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Pedido nao encontrado</Text>
      </View>
    );
  }

  if (!trackingData && !error) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#EA1D2C" />
        <Text style={styles.loadingText}>Carregando rastreamento...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIconContainer}>
          <AlertTriangle size={48} color="#f59e0b" />
        </View>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showMap = trackingData?.status &&
    ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(trackingData.status) &&
    driverLocation;

  return (
    <View style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Acompanhar Pedido</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContent}>
        {/* Status Header */}
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>
            {statusLabels[trackingData?.status || 'PENDING']}
          </Text>
          {!isConnected && (
            <View style={styles.connectionStatus}>
              <Text style={styles.connectionText}>Reconectando...</Text>
            </View>
          )}
        </View>

      {/* Progress Steps */}
      <View style={styles.progressContainer}>
        {statusSteps.map((status, index) => {
          const currentStep = getCurrentStep();
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <View key={status} style={styles.stepContainer}>
              <View
                style={[
                  styles.stepCircle,
                  isCompleted && styles.stepCompleted,
                  isCurrent && styles.stepCurrent,
                ]}
              >
                {isCompleted ? (
                  <Check size={16} color="#fff" strokeWidth={3} />
                ) : (
                  <Text style={[styles.stepNumber, isCurrent && styles.stepNumberCurrent]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              {index < statusSteps.length - 1 && (
                <View
                  style={[
                    styles.stepLine,
                    isCompleted && styles.stepLineCompleted,
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* Map */}
      {showMap && (
        <View style={styles.mapSection}>
          <View style={styles.mapContainer}>
            <WebView
              style={styles.map}
              source={{ html: mapHtml }}
              scrollEnabled={false}
              javaScriptEnabled={true}
            />
          </View>
          <View style={styles.mapInfo}>
            <Text style={styles.lastUpdate}>
              Atualizado: {new Date(driverLocation!.timestamp).toLocaleTimeString('pt-BR')}
            </Text>
            <TouchableOpacity style={styles.openMapsButton} onPress={openInMaps}>
              <Text style={styles.openMapsButtonText}>Abrir no Maps</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Driver Info */}
      {trackingData?.driver && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Entregador</Text>
          <View style={styles.driverCard}>
            <View style={styles.driverInfo}>
              <View style={styles.driverAvatar}>
                <User size={24} color="#fff" />
              </View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{trackingData.driver.name}</Text>
                {trackingData.driver.vehicleType && (
                  <Text style={styles.driverVehicle}>
                    {trackingData.driver.vehicleType} - {trackingData.driver.vehiclePlate}
                  </Text>
                )}
              </View>
            </View>
            {trackingData.driver.phone && (
              <TouchableOpacity style={styles.callButton} onPress={callDriver}>
                <View style={styles.callButtonContent}>
                  <Phone size={16} color="#fff" />
                  <Text style={styles.callButtonText}>Ligar</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Restaurant Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Restaurante</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{trackingData?.restaurant.name}</Text>
          <Text style={styles.infoSubtitle}>{trackingData?.restaurant.address}</Text>
        </View>
      </View>

      {/* Delivery Address */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Endereco de entrega</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoSubtitle}>
            {formatAddress(trackingData?.deliveryAddress)}
          </Text>
        </View>
      </View>

      {/* Order Number */}
      <View style={styles.section}>
        <View style={styles.orderNumberContainer}>
          <Text style={styles.orderNumberLabel}>Pedido</Text>
          <Text style={styles.orderNumber}>#{orderId.slice(-6).toUpperCase()}</Text>
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EA1D2C',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorIconContainer: {
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#EA1D2C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  statusHeader: {
    backgroundColor: '#EA1D2C',
    padding: 20,
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  connectionStatus: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
  },
  connectionText: {
    fontSize: 12,
    color: '#fff',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCompleted: {
    backgroundColor: '#22c55e',
  },
  stepCurrent: {
    backgroundColor: '#EA1D2C',
  },
  stepNumber: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  stepNumberCurrent: {
    color: '#fff',
  },
  stepLine: {
    width: 24,
    height: 3,
    backgroundColor: '#e5e5e5',
    marginHorizontal: 4,
  },
  stepLineCompleted: {
    backgroundColor: '#22c55e',
  },
  mapSection: {
    margin: 16,
  },
  mapContainer: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  map: {
    flex: 1,
  },
  mapInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  lastUpdate: {
    color: '#666',
    fontSize: 12,
  },
  openMapsButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  openMapsButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  driverCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EA1D2C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverDetails: {
    marginLeft: 12,
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  driverVehicle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  callButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  callButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  orderNumberContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumberLabel: {
    fontSize: 14,
    color: '#666',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EA1D2C',
  },
});
