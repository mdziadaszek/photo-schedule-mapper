// Geocoder - Converts addresses to lat/lon coordinates using PHP backend with LocationIQ
// Server-side caching for fast, shared results across all users

export class Geocoder {
  constructor() {
    // PHP backend endpoint (relative to app directory)
    this.apiUrl = './api/geocode.php';
  }

  /**
   * Geocode a single address to lat/lon coordinates
   * @param {string} address - Address to geocode
   * @returns {Promise<Object|null>} Object with lat, lon, display_name or null if not found
   */
  async geocode(address) {
    if (!address || typeof address !== 'string') {
      return null;
    }

    // Call batch method with single address
    const results = await this.geocodeBatch([address]);
    const normalized = address.trim().toLowerCase();

    return results[normalized] || null;
  }

  /**
   * Batch geocode multiple addresses (primary method)
   * @param {Array<string>} addresses - Array of addresses to geocode
   * @returns {Promise<Object>} Object mapping normalized addresses to {lat, lon, display_name} or null
   */
  async geocodeBatch(addresses) {
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return {};
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ addresses })
      });

      if (!response.ok) {
        throw new Error(`Geocoding API returned status ${response.status}`);
      }

      const data = await response.json();

      if (!data || !data.results) {
        console.error('Invalid response from geocoding API:', data);
        return {};
      }

      // Log stats if available
      if (data.stats) {
        console.log('Geocoding stats:', data.stats);
      }

      return data.results;

    } catch (error) {
      console.error('Batch geocoding failed:', error);
      return {};
    }
  }

  /**
   * Get cache statistics from server
   * @returns {Promise<Object>} Cache stats from server
   */
  async getCacheStats() {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ addresses: [] }) // Empty request to get stats only
      });

      if (response.ok) {
        const data = await response.json();
        return data.stats || {};
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error);
    }

    return {};
  }

  /**
   * Clear cache (placeholder - cache is server-side now)
   * User would need server access to clear cache
   */
  clearCache() {
    console.warn('Cache is now server-side. Contact server admin to clear cache.');
  }

  /**
   * Check if geocoder is currently processing (always false for server-side)
   * @returns {boolean} False (server handles processing)
   */
  isGeocoding() {
    return false;
  }

  /**
   * Get number of pending requests (always 0 for server-side)
   * @returns {number} 0 (server handles queue)
   */
  getQueueLength() {
    return 0;
  }
}

export default Geocoder;
