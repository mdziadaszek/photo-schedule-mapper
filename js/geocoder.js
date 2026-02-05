// Geocoder - Converts addresses to lat/lon coordinates using Nominatim (OpenStreetMap)
// Implements rate limiting (1 req/sec) and caching

import { GEOCODING_CONFIG, CACHE_CONFIG } from './config.js';

export class Geocoder {
  constructor() {
    this.baseUrl = GEOCODING_CONFIG.baseUrl;
    this.searchEndpoint = GEOCODING_CONFIG.searchEndpoint;
    this.rateLimit = GEOCODING_CONFIG.rateLimit;
    this.userAgent = GEOCODING_CONFIG.userAgent;

    // In-memory cache for this session
    this.cache = new Map();

    // Request queue for rate limiting
    this.requestQueue = [];
    this.isProcessing = false;

    // Load cached geocode results from localStorage
    this.loadCache();
  }

  /**
   * Geocode an address to lat/lon coordinates
   * @param {string} address - Address to geocode
   * @returns {Promise<Object|null>} Object with lat, lon, display_name or null if not found
   */
  async geocode(address) {
    if (!address || typeof address !== 'string') {
      return null;
    }

    // Normalize address for cache key
    const cacheKey = address.trim().toLowerCase();

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);

      // Check if cache entry is expired
      if (cached.timestamp + CACHE_CONFIG.geocodeExpiry > Date.now()) {
        return cached.result;
      } else {
        // Remove expired entry
        this.cache.delete(cacheKey);
      }
    }

    // Add to queue and return promise
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        address,
        cacheKey,
        resolve,
        reject
      });

      // Start processing queue if not already processing
      this.processQueue();
    });
  }

  /**
   * Process the geocoding request queue with rate limiting
   */
  async processQueue() {
    // If already processing or queue is empty, return
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const { address, cacheKey, resolve, reject } = this.requestQueue.shift();

    try {
      // Build search URL
      const searchUrl = this.buildSearchUrl(address);

      // Make request to Nominatim API
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        throw new Error(`Geocoding failed with status ${response.status}`);
      }

      const data = await response.json();

      let result = null;

      if (data && Array.isArray(data) && data.length > 0) {
        // Extract first result
        const firstResult = data[0];
        result = {
          lat: parseFloat(firstResult.lat),
          lon: parseFloat(firstResult.lon),
          display_name: firstResult.display_name
        };
      }

      // Cache the result (even if null, to avoid repeated failed lookups)
      this.cacheResult(cacheKey, result);

      // Resolve promise with result
      resolve(result);

    } catch (error) {
      console.error(`Geocoding error for "${address}":`, error);
      reject(error);

    } finally {
      // Wait for rate limit duration before processing next request
      setTimeout(() => {
        this.isProcessing = false;
        this.processQueue(); // Process next item in queue
      }, this.rateLimit);
    }
  }

  /**
   * Build Nominatim search URL
   * @param {string} address - Address to search
   * @returns {string} Full search URL
   */
  buildSearchUrl(address) {
    const params = new URLSearchParams({
      q: address,
      format: GEOCODING_CONFIG.format,
      limit: GEOCODING_CONFIG.limit.toString()
    });

    return `${this.baseUrl}${this.searchEndpoint}?${params.toString()}`;
  }

  /**
   * Cache a geocoding result
   * @param {string} cacheKey - Cache key (normalized address)
   * @param {Object|null} result - Geocoding result
   */
  cacheResult(cacheKey, result) {
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    // Also save to localStorage (debounced)
    this.scheduleSaveCache();
  }

  /**
   * Schedule saving cache to localStorage (debounced)
   */
  scheduleSaveCache() {
    if (this.saveCacheTimeout) {
      clearTimeout(this.saveCacheTimeout);
    }

    // Save cache after 2 seconds of inactivity
    this.saveCacheTimeout = setTimeout(() => {
      this.saveCache();
    }, 2000);
  }

  /**
   * Load cache from localStorage
   */
  loadCache() {
    try {
      const cachedData = localStorage.getItem(CACHE_CONFIG.keys.geocodeCache);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);

        // Convert array back to Map
        if (Array.isArray(parsed)) {
          this.cache = new Map(parsed);

          // Clean up expired entries
          const now = Date.now();
          for (const [key, value] of this.cache.entries()) {
            if (value.timestamp + CACHE_CONFIG.geocodeExpiry < now) {
              this.cache.delete(key);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading geocode cache:', error);
      this.cache = new Map();
    }
  }

  /**
   * Save cache to localStorage
   */
  saveCache() {
    try {
      // Convert Map to array for JSON serialization
      const cacheArray = Array.from(this.cache.entries());
      localStorage.setItem(CACHE_CONFIG.keys.geocodeCache, JSON.stringify(cacheArray));
    } catch (error) {
      console.error('Error saving geocode cache:', error);
    }
  }

  /**
   * Clear all cached geocoding results
   */
  clearCache() {
    this.cache.clear();
    localStorage.removeItem(CACHE_CONFIG.keys.geocodeCache);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    let validEntries = 0;
    let expiredEntries = 0;
    const now = Date.now();

    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp + CACHE_CONFIG.geocodeExpiry > now) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      total: this.cache.size,
      valid: validEntries,
      expired: expiredEntries
    };
  }

  /**
   * Batch geocode multiple addresses
   * @param {Array<string>} addresses - Array of addresses to geocode
   * @param {Function} onProgress - Progress callback (current, total)
   * @returns {Promise<Array>} Array of geocoding results
   */
  async geocodeBatch(addresses, onProgress = null) {
    const results = [];

    for (let i = 0; i < addresses.length; i++) {
      try {
        const result = await this.geocode(addresses[i]);
        results.push({
          address: addresses[i],
          result: result,
          success: result !== null
        });

        if (onProgress) {
          onProgress(i + 1, addresses.length);
        }
      } catch (error) {
        results.push({
          address: addresses[i],
          result: null,
          success: false,
          error: error.message
        });

        if (onProgress) {
          onProgress(i + 1, addresses.length);
        }
      }
    }

    // Save cache after batch processing
    this.saveCache();

    return results;
  }

  /**
   * Get number of pending requests in queue
   * @returns {number} Queue length
   */
  getQueueLength() {
    return this.requestQueue.length;
  }

  /**
   * Check if geocoder is currently processing
   * @returns {boolean} True if processing
   */
  isGeocoding() {
    return this.isProcessing || this.requestQueue.length > 0;
  }
}

export default Geocoder;
