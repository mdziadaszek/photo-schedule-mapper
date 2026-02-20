// Configuration constants for the Asana Photography Scheduler application

export const CONFIG = {
  // Asana API Configuration
  asana: {
    apiBaseUrl: 'https://app.asana.com/api/1.0'
  },

  // Geocoding Service Configuration
  geocoding: {
    service: 'nominatim',
    baseUrl: 'https://nominatim.openstreetmap.org',
    searchEndpoint: '/search',
    rateLimit: 1100, // milliseconds between requests (1.1 seconds for safety)
    // IMPORTANT: Update this with your actual contact email before deployment
    userAgent: 'AsanaPhotoScheduler/1.0 (contact@example.com)',
    format: 'json',
    limit: 1 // number of results to return per query
  },

  // Map Configuration
  map: {
    // Default center: Center of USA (roughly Kansas)
    defaultCenter: [39.8283, -98.5795],
    defaultZoom: 4,
    // OpenStreetMap tile layer
    tileLayer: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    },
    // Photographer color mapping
    photographerColors: {
      'Rodney': '#9b59b6',  // Purple
      // Add more photographers and colors as needed
      'default': '#3388ff'   // Default blue
    }
  },

  // Cache Configuration
  cache: {
    // How long to keep geocoded addresses cached (30 days in milliseconds)
    geocodeExpiry: 30 * 24 * 60 * 60 * 1000,
    // How long to keep task data cached (5 minutes in milliseconds)
    taskRefreshInterval: 5 * 60 * 1000,
    // How long before retrying a previously failed geocode (24 hours)
    geocodeRetryInterval: 24 * 60 * 60 * 1000,
    // LocalStorage keys
    keys: {
      geocodeCache: 'asana_scheduler_geocode_cache',
      accessToken: 'asana_scheduler_access_token',
      refreshToken: 'asana_scheduler_refresh_token',
      tokenExpiry: 'asana_scheduler_token_expiry',
      lastRefresh: 'asana_scheduler_last_refresh',
      taskCache: 'asana_tasks_cache',
      geocodeFailures: 'asana_geocode_failures'
    }
  },

  // Task Filtering Configuration
  tasks: {
    // Photography project GID (contains all photo shoot tasks)
    photographyProjectGid: '91935077196422',
    // Task name must contain this text (case-insensitive)
    nameFilter: 'Schedule Photo Shoot',
    // Tasks assigned to this user will be excluded
    excludeAssignee: 'Photography Coordinator',
    // Only fetch incomplete tasks
    completedSince: 'now' // Asana API parameter for incomplete tasks
  },

  // Tag Configuration
  tags: {
    // State tag prefix
    statePrefix: 'State - ',
    // City tags for California
    californiaCities: [
      'Bakersfield',
      'Fresno',
      'Los Angeles',
      'San Diego',
      'San Francisco'
    ],
    // City tags for Texas
    texasCities: [
      'Amarillo',
      'Austin',
      'Brownsville',
      'Corpus Christi',
      'Dallas',
      'El Paso',
      'Houston',
      'Midland',
      'San Antonio',
      'Texarkana'
    ],
    // Map state codes to city lists
    stateCityMap: {
      'CA': 'californiaCities',
      'TX': 'texasCities'
    }
  },

  // UI Configuration
  ui: {
    // Toast notification duration (milliseconds)
    toastDuration: 5000,
    // Loading spinner delay before showing (milliseconds)
    loadingDelay: 300,
    // Debounce delay for filter changes (milliseconds)
    filterDebounce: 300
  }
};

// Export individual config sections for convenience
export const ASANA_CONFIG = CONFIG.asana;
export const GEOCODING_CONFIG = CONFIG.geocoding;
export const MAP_CONFIG = CONFIG.map;
export const CACHE_CONFIG = CONFIG.cache;
export const TASK_CONFIG = CONFIG.tasks;
export const TAG_CONFIG = CONFIG.tags;
export const UI_CONFIG = CONFIG.ui;

export default CONFIG;
