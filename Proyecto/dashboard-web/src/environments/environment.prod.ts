export const environment = {
  production: true,
  supabaseUrl: '#{SUPABASE_URL}#',
  supabaseKey: '#{SUPABASE_ANON_KEY}#',
  googleMapsApiKey: '#{GOOGLE_MAPS_API_KEY}#',
  apiBaseUrl: '#{API_BASE_URL}#',
  mqttBrokerUrl: '#{MQTT_BROKER_URL}#',
  mqttTopicPrefix: 'sigo',
  mapDefaultCenter: { lat: -33.4569, lng: -70.6483 },
  mapDefaultZoom: 12,
  gpsThrottleMs: 500,
  heatmapWindowHrs: 24,
  heatmapMaxPoints: 5000,
};
