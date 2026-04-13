window.RapidPackConfig = {
  supabaseUrl: 'https://trdfieobkewwjhzxwpxc.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyZGZpZW9ia2V3d2poenh3cHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4ODYyMTAsImV4cCI6MjA4ODQ2MjIxMH0.aU6dMbELmJRAVmdGVqkHwy60Mth8jaGkeaHVjrGqRZk',
  tables: {
    customers: 'clientes',
    activeRoute: 'ruta_activa',
    driverTracking: 'rastreo_chofer',
    driverPositions: 'driver_positions',
    driverCurrentStatus: 'driver_current_status'
  },
  thresholds: {
    confirmDistanceMeters: 20,
    staleDriverMinutes: 3
  },
  defaultCenter: [18.4877, -69.8561],
  driverId: 'chofer1'
};

window.RapidPackUtils = {
  createClient() {
    return supabase.createClient(
      window.RapidPackConfig.supabaseUrl,
      window.RapidPackConfig.supabaseAnonKey
    );
  },

  toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  },

  readLatLng(record) {
    if (!record) return null;

    const lat = this.toNumber(record.lat ?? record.latitude);
    const lng = this.toNumber(record.lng ?? record.longitude);

    if (lat === null || lng === null) return null;
    return { lat, lng };
  },

  haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  formatDistance(meters) {
    if (!Number.isFinite(meters)) return 'Sin distancia';
    if (meters >= 1000) return `A ${(meters / 1000).toFixed(1)} km`;
    return `A ${meters.toFixed(0)} metros`;
  },

  formatLastSeen(value) {
    if (!value) return 'Sin ultima conexion';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sin ultima conexion';

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

    if (diffMinutes < 1) return 'Hace menos de 1 min';
    if (diffMinutes === 1) return 'Hace 1 min';
    return `Hace ${diffMinutes} min`;
  },

  isDriverStale(value) {
    if (!value) return true;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return true;

    const diffMs = Date.now() - date.getTime();
    return diffMs > window.RapidPackConfig.thresholds.staleDriverMinutes * 60000;
  }
};
