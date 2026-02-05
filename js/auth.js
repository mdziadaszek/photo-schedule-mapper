// Authentication Manager - Personal Access Token (PAT) for Asana

import { CACHE_CONFIG } from './config.js';

export class AuthManager {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;

    // Load existing token from localStorage
    this.loadToken();
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} True if user has a valid access token
   */
  isAuthenticated() {
    if (!this.accessToken) {
      return false;
    }

    // Check if token is expired
    if (this.tokenExpiry && Date.now() > this.tokenExpiry) {
      this.clearToken();
      return false;
    }

    return true;
  }

  /**
   * Get the current access token
   * @returns {string|null} Access token or null if not authenticated
   */
  getAccessToken() {
    if (this.isAuthenticated()) {
      return this.accessToken;
    }
    return null;
  }

  /**
   * Set Personal Access Token (PAT)
   * @param {string} pat - Personal Access Token from Asana
   */
  setPersonalAccessToken(pat) {
    if (!pat || typeof pat !== 'string') {
      throw new Error('Invalid Personal Access Token');
    }

    this.accessToken = pat.trim();
    // PATs don't expire, so set a far future date (1 year)
    this.tokenExpiry = Date.now() + (365 * 24 * 60 * 60 * 1000);

    // Save to localStorage
    this.saveToken();
  }

  /**
   * Logout user and clear tokens
   */
  logout() {
    this.clearToken();
  }

  /**
   * Save token to localStorage
   */
  saveToken() {
    if (this.accessToken) {
      localStorage.setItem(CACHE_CONFIG.keys.accessToken, this.accessToken);
    }
    if (this.tokenExpiry) {
      localStorage.setItem(CACHE_CONFIG.keys.tokenExpiry, this.tokenExpiry.toString());
    }
  }

  /**
   * Load token from localStorage
   */
  loadToken() {
    this.accessToken = localStorage.getItem(CACHE_CONFIG.keys.accessToken);
    const expiry = localStorage.getItem(CACHE_CONFIG.keys.tokenExpiry);
    this.tokenExpiry = expiry ? parseInt(expiry, 10) : null;
  }

  /**
   * Clear token from memory and localStorage
   */
  clearToken() {
    this.accessToken = null;
    this.tokenExpiry = null;

    localStorage.removeItem(CACHE_CONFIG.keys.accessToken);
    localStorage.removeItem(CACHE_CONFIG.keys.refreshToken);
    localStorage.removeItem(CACHE_CONFIG.keys.tokenExpiry);
  }
}

export default AuthManager;
