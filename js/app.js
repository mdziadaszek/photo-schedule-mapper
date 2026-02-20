// Main Application - Asana Photography Scheduler
// Orchestrates all components: Auth, Asana, Geocoder, Map, UI

import { AuthManager } from './auth.js';
import { AsanaClient } from './asana-client.js';
import { Geocoder } from './geocoder.js';
import { TaskMap } from './map.js';
import { UIManager } from './ui.js';
import { CACHE_CONFIG, UI_CONFIG } from './config.js';

class AsanaSchedulerApp {
  constructor() {
    // Initialize all components
    this.auth = new AuthManager();
    this.ui = new UIManager();
    this.geocoder = new Geocoder();
    this.map = new TaskMap('map');

    // Data storage
    this.asanaClient = null;
    this.allTasks = [];
    this.currentUser = null;
    this.currentWorkspace = null;

    // Debounce timer for filter changes
    this._filterTimer = null;

    // Bind event handlers
    this.setupEventListeners();
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      // Check if user is authenticated
      if (this.auth.isAuthenticated()) {
        await this.onAuthenticated();
      } else {
        this.ui.showLoginPrompt();
        this.ui.updateAuthStatus(false);
      }

    } catch (error) {
      console.error('Initialization error:', error);
      this.ui.showError(error.message || 'Failed to initialize application');
      this.ui.updateAuthStatus(false);
    } finally {
      this.ui.hideLoading();
    }
  }

  /**
   * Setup event listeners for UI interactions
   */
  setupEventListeners() {
    // Login button - show PAT modal
    this.ui.elements.loginBtn.addEventListener('click', () => {
      this.showPATModal();
    });

    // PAT modal submit
    document.getElementById('pat-submit-btn').addEventListener('click', () => {
      this.handlePATSubmit();
    });

    // PAT modal cancel
    document.getElementById('pat-cancel-btn').addEventListener('click', () => {
      this.hidePATModal();
    });

    // PAT input enter key
    document.getElementById('pat-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handlePATSubmit();
      }
    });

    // Logout button
    this.ui.elements.logoutBtn.addEventListener('click', () => {
      this.handleLogout();
    });

    // Refresh button
    this.ui.elements.refreshBtn.addEventListener('click', () => {
      this.handleRefresh();
    });

    // Listen for filter changes (state selection) — debounced
    document.addEventListener('filter-changed', (e) => {
      this.handleFilterStateChange(e.detail);
      clearTimeout(this._filterTimer);
      this._filterTimer = setTimeout(() => this.handleApplyFilters(), UI_CONFIG.filterDebounce);
    });

    // Listen for task item clicks
    document.addEventListener('task-item-clicked', (e) => {
      this.map.selectMarker(e.detail.taskGid);
    });

    // Listen for marker clicks
    document.addEventListener('marker-clicked', (e) => {
      this.ui.selectTaskItem(e.detail.taskGid);
    });

    // Window resize handler for map
    window.addEventListener('resize', () => {
      this.map.invalidateSize();
    });
  }

  /**
   * Show PAT modal
   */
  showPATModal() {
    const modal = document.getElementById('pat-modal');
    const input = document.getElementById('pat-input');
    modal.style.display = 'flex';
    input.value = '';
    input.focus();
  }

  /**
   * Hide PAT modal
   */
  hidePATModal() {
    const modal = document.getElementById('pat-modal');
    modal.style.display = 'none';
  }

  /**
   * Handle PAT submission
   */
  async handlePATSubmit() {
    const input = document.getElementById('pat-input');
    const pat = input.value.trim();

    if (!pat) {
      this.ui.showError('Please enter a Personal Access Token');
      return;
    }

    try {
      this.ui.showLoading('Connecting with Personal Access Token...');
      this.hidePATModal();

      // Set the PAT in auth manager
      this.auth.setPersonalAccessToken(pat);

      // Authenticate
      await this.onAuthenticated();

    } catch (error) {
      console.error('PAT authentication error:', error);
      this.ui.showError(error.message || 'Failed to authenticate with PAT');
      this.auth.clearToken();
      this.showPATModal();
    } finally {
      this.ui.hideLoading();
    }
  }

  /**
   * Handle logout button click
   */
  handleLogout() {
    if (this.currentWorkspace) {
      this._clearTaskCache(this.currentWorkspace.gid);
    }
    localStorage.removeItem(CACHE_CONFIG.keys.geocodeFailures);

    this.auth.logout();
    this.asanaClient = null;
    this.allTasks = [];
    this.currentUser = null;
    this.currentWorkspace = null;

    this.ui.updateAuthStatus(false);
    this.ui.showLoginPrompt();
    this.ui.clearFilters();
    this.map.clearMarkers();

    this.ui.showSuccess('Logged out successfully');
  }

  /**
   * Handle refresh button click — clears task cache for a full fresh fetch
   */
  async handleRefresh() {
    if (!this.auth.isAuthenticated()) {
      this.ui.showError('Please log in first');
      return;
    }

    if (this.currentWorkspace) {
      this._clearTaskCache(this.currentWorkspace.gid);
    }
    await this.loadAsanaData();
  }

  /**
   * Handle apply filters button click
   */
  async handleApplyFilters() {
    const filters = this.ui.getSelectedFilters();

    if (filters.selectedStates.length === 0) {
      this.ui.showWarning('Please select at least one state');
      return;
    }

    await this.applyFilters(filters.selectedStates, filters.selectedCities, filters.selectedAssignees);
  }

  /**
   * Handle filter state change (when state checkboxes change)
   * Update city filters based on selected states and photographer counts
   */
  handleFilterStateChange(filterData) {
    const { selectedStates, selectedAssignees } = filterData;

    if (this.allTasks.length === 0) {
      return;
    }

    // Update city filters for CA/TX states
    const hasCaOrTx = selectedStates.some(state => state === 'CA' || state === 'TX');

    if (hasCaOrTx) {
      // Extract city tags for selected CA/TX states
      let allCities = [];

      if (selectedStates.includes('CA')) {
        const caCities = this.asanaClient.extractCityTags(this.allTasks, 'CA');
        allCities = allCities.concat(caCities);
      }

      if (selectedStates.includes('TX')) {
        const txCities = this.asanaClient.extractCityTags(this.allTasks, 'TX');
        allCities = allCities.concat(txCities);
      }

      // Remove duplicates and sort
      allCities = [...new Set(allCities)].sort();

      this.ui.populateCityFilters(allCities);
    } else {
      // Hide city filters
      this.ui.populateCityFilters([]);
    }

    // Update photographer counts based on selected states
    const assignees = this.asanaClient.extractAssignees(this.allTasks);
    const assigneeCounts = this.asanaClient.countTasksByAssignee(
      this.allTasks,
      Array.from(selectedStates)
    );
    this.ui.populateAssigneeFilters(assignees, assigneeCounts);

    // Update state counts based on selected photographers
    const states = this.asanaClient.extractStateTags(this.allTasks);
    const stateCounts = this.asanaClient.countTasksByState(
      this.allTasks,
      Array.from(selectedAssignees)
    );
    this.ui.populateStateFilters(states, stateCounts);
  }

  /**
   * Called when user is authenticated
   */
  async onAuthenticated() {
    try {
      this.ui.showLoading('Loading Asana data...');

      // Initialize Asana client with access token
      const accessToken = this.auth.getAccessToken();
      this.asanaClient = new AsanaClient(accessToken);

      // Get current user
      this.currentUser = await this.asanaClient.getCurrentUser();
      this.ui.updateAuthStatus(true, this.currentUser.name);

      // Load tasks and filters
      await this.loadAsanaData();

    } catch (error) {
      console.error('Error during authentication:', error);
      this.ui.showError('Failed to load data from Asana. Please try logging in again.');
      this.auth.logout();
      this.ui.updateAuthStatus(false);
    } finally {
      this.ui.hideLoading();
    }
  }

  /**
   * Load tasks and populate filters from Asana.
   * Uses stale-while-revalidate: serve from localStorage cache immediately,
   * then background-refresh from Asana and re-render if anything changed.
   */
  async loadAsanaData() {
    try {
      this.ui.showLoading('Fetching photo shoot tasks from Asana...');
      this.ui.setControlsDisabled(true);

      // Get workspaces (fast — only a handful)
      const workspaces = await this.asanaClient.getWorkspaces();

      if (workspaces.length === 0) {
        throw new Error('No workspaces found');
      }

      this.currentWorkspace = workspaces[0];
      const workspaceGid = this.currentWorkspace.gid;

      // Try to serve from cache first (instant)
      const cached = this._loadTaskCache(workspaceGid);

      if (cached) {
        this.allTasks = cached.tasks;
        await this._populateFiltersAndDisplay();

        // Silently refresh in the background — no await, no blocking UI
        this._backgroundRefreshTasks(workspaceGid, cached.tasks);
      } else {
        // Cold path: full blocking fetch
        this.allTasks = await this.asanaClient.getPhotoShootTasks(workspaceGid);
        this._saveTaskCache(workspaceGid, this.allTasks);
        await this._populateFiltersAndDisplay();
      }

      // Background retry of previously failed geocodes (after a small delay)
      setTimeout(() => this._retryFailedAddresses(), 2000);

    } catch (error) {
      console.error('Error loading Asana data:', error);
      this.ui.showError(`Failed to load tasks: ${error.message}`);
      this.ui.hideLoading();
      this.ui.setControlsDisabled(false);
    }
  }

  /**
   * Populate state/assignee filters and trigger the initial map display.
   * Extracted to avoid duplicating the same block in the cached and cold paths.
   */
  async _populateFiltersAndDisplay() {
    if (this.allTasks.length === 0) {
      this.ui.showWarning('No photo shoot tasks found in your workspace');
      this.ui.populateStateFilters([]);
      this.ui.hideLoading();
      this.ui.setControlsDisabled(false);
      return;
    }

    // Extract and populate state filters
    const stateTags = this.asanaClient.extractStateTags(this.allTasks);
    this.ui.populateStateFilters(stateTags);

    // Extract and populate assignee (photographer) filters
    const assignees = this.asanaClient.extractAssignees(this.allTasks);
    this.ui.populateAssigneeFilters(assignees);

    // Auto-select all states and assignees by default
    this.ui.selectAllStates(stateTags);
    this.ui.selectAllAssignees(assignees);

    this.ui.showSuccess(`Loaded ${this.allTasks.length} photo shoot tasks`);

    // Apply filters to display tasks on map
    this.ui.hideLoading();
    this.ui.setControlsDisabled(false);
    await this.handleApplyFilters();
  }

  /**
   * Silently fetch fresh tasks from Asana and re-render if anything changed.
   * Runs in the background — never blocks or shows loading overlays.
   */
  async _backgroundRefreshTasks(workspaceGid, cachedTasks) {
    try {
      const freshTasks = await this.asanaClient.getPhotoShootTasks(workspaceGid);
      const diff = this._diffTasks(cachedTasks, freshTasks);

      if (!diff.hasChanges) return;

      this.allTasks = freshTasks;
      this._saveTaskCache(workspaceGid, freshTasks);

      // Re-apply current filters — all geocoding is cached, so this is near-instant
      const { selectedStates, selectedCities, selectedAssignees } = this.ui.getSelectedFilters();
      await this.applyFilters(selectedStates, selectedCities, selectedAssignees);

      const parts = [
        diff.added.length    && `${diff.added.length} added`,
        diff.removed.length  && `${diff.removed.length} removed`,
        diff.modified.length && `${diff.modified.length} updated`,
      ].filter(Boolean);
      this.ui.showSuccess(`Tasks refreshed: ${parts.join(', ')}`);

    } catch (e) {
      // Silently ignore — background refresh should never disrupt the user
      console.warn('Background task refresh failed:', e);
    }
  }

  /**
   * Compute a short fingerprint of the fields we care about for change detection.
   */
  _taskFingerprint(task) {
    const address = this.asanaClient.getTaskAddress(task) || '';
    return `${task.name}|${task.completed}|${task.assignee?.name || ''}|${address}`;
  }

  /**
   * Diff two task arrays and return added/removed/modified sets.
   */
  _diffTasks(oldTasks, newTasks) {
    const oldMap = new Map(oldTasks.map(t => [t.gid, this._taskFingerprint(t)]));
    const newMap = new Map(newTasks.map(t => [t.gid, this._taskFingerprint(t)]));
    const added    = newTasks.filter(t => !oldMap.has(t.gid));
    const removed  = oldTasks.filter(t => !newMap.has(t.gid));
    const modified = newTasks.filter(t => oldMap.has(t.gid) && oldMap.get(t.gid) !== newMap.get(t.gid));
    return { added, removed, modified, hasChanges: added.length + removed.length + modified.length > 0 };
  }

  // ─── Task cache helpers ───────────────────────────────────────────────────

  _loadTaskCache(workspaceGid) {
    try {
      const raw = localStorage.getItem(`${CACHE_CONFIG.keys.taskCache}_${workspaceGid}`);
      if (!raw) return null;
      return JSON.parse(raw); // { tasks, timestamp }
    } catch {
      return null;
    }
  }

  _saveTaskCache(workspaceGid, tasks) {
    try {
      localStorage.setItem(
        `${CACHE_CONFIG.keys.taskCache}_${workspaceGid}`,
        JSON.stringify({ tasks, timestamp: Date.now() })
      );
    } catch (e) {
      console.warn('Task cache write failed (localStorage may be full):', e);
    }
  }

  _clearTaskCache(workspaceGid) {
    localStorage.removeItem(`${CACHE_CONFIG.keys.taskCache}_${workspaceGid}`);
  }

  // ─── Geocode failure tracking & retry ────────────────────────────────────

  _storeGeocodeFailure(address) {
    try {
      const key = CACHE_CONFIG.keys.geocodeFailures;
      const map = JSON.parse(localStorage.getItem(key) || '{}');
      if (!map[address]) {
        // Only record on first failure — don't reset the retryAfter if already queued
        map[address] = {
          firstFailed: Date.now(),
          retryAfter: Date.now() + CACHE_CONFIG.geocodeRetryInterval
        };
        localStorage.setItem(key, JSON.stringify(map));
      }
    } catch {}
  }

  _clearGeocodeFailure(address) {
    try {
      const key = CACHE_CONFIG.keys.geocodeFailures;
      const map = JSON.parse(localStorage.getItem(key) || '{}');
      if (map[address]) {
        delete map[address];
        localStorage.setItem(key, JSON.stringify(map));
      }
    } catch {}
  }

  /**
   * Background retry of geocoding failures that are at least 24 h old.
   * Runs silently — only shows a toast if any addresses newly succeed.
   */
  async _retryFailedAddresses() {
    try {
      const key = CACHE_CONFIG.keys.geocodeFailures;
      const map = JSON.parse(localStorage.getItem(key) || '{}');
      const now = Date.now();
      const due = Object.entries(map)
        .filter(([, info]) => info.retryAfter <= now)
        .map(([addr]) => addr);

      if (due.length === 0) return;

      console.log(`Retrying ${due.length} failed geocode(s) in background…`);
      // Pass due addresses as both the batch and the force list so the PHP
      // backend skips the null-cache specifically for these entries.
      const results = await this.geocoder.geocodeBatch(due, due);

      let anySuccess = false;
      for (const address of due) {
        const normalized = address.toLowerCase().trim();
        if (results[normalized]) {
          this._clearGeocodeFailure(address);
          anySuccess = true;
        } else {
          // Retry again in another 24 h
          map[address].retryAfter = now + CACHE_CONFIG.geocodeRetryInterval;
        }
      }

      // Persist updated failure map (only if there are still failures)
      const remaining = Object.keys(map).filter(k => !due.includes(k) || !results[k.toLowerCase().trim()]);
      if (remaining.length > 0) {
        const updated = {};
        for (const addr of remaining) updated[addr] = map[addr];
        localStorage.setItem(key, JSON.stringify(updated));
      } else {
        localStorage.removeItem(key);
      }

      if (anySuccess) {
        // Re-render so newly geocoded addresses get their markers
        const { selectedStates, selectedCities, selectedAssignees } = this.ui.getSelectedFilters();
        await this.applyFilters(selectedStates, selectedCities, selectedAssignees);
        this.ui.showSuccess('Previously failed addresses were geocoded successfully');
      }
    } catch (e) {
      console.warn('Background geocode retry failed:', e);
    }
  }

  /**
   * Apply filters and display tasks on map
   */
  async applyFilters(selectedStates, selectedCities, selectedAssignees = []) {
    try {
      this.ui.showLoading('Filtering tasks...');
      this.ui.setControlsDisabled(true);

      // Filter tasks by tags and assignees
      const filteredTasks = this.asanaClient.filterTasksByTags(
        this.allTasks,
        selectedStates,
        selectedCities,
        selectedAssignees
      );

      if (filteredTasks.length === 0) {
        this.ui.showWarning('No tasks match the selected filters');
        this.map.clearMarkers();
        this.ui.displayTaskList([]);
        return;
      }

      this.ui.showLoading(`Processing ${filteredTasks.length} tasks...`);

      // Clear existing markers
      this.map.clearMarkers();

      // Process each task
      const taskDisplayInfo = [];
      const tasksWithAddresses = [];

      for (const task of filteredTasks) {
        const projectName = this.asanaClient.getProjectName(task);
        const address = this.asanaClient.getTaskAddress(task);

        if (address) {
          tasksWithAddresses.push({
            task,
            projectName,
            address
          });
        }

        // Add to display list even if no address
        taskDisplayInfo.push({
          task,
          projectName,
          address: address || 'No address found'
        });
      }

      // Update task list in sidebar
      this.ui.displayTaskList(taskDisplayInfo);

      if (tasksWithAddresses.length === 0) {
        this.ui.showWarning('No addresses found in filtered tasks');
        return;
      }

      // Hide the full loading overlay before geocoding
      this.ui.hideLoading();

      // Geocode addresses and add markers (using top progress bar)
      this.ui.showTopProgressBar(`Geocoding ${tasksWithAddresses.length} addresses...`);
      await this.geocodeAndDisplayTasks(tasksWithAddresses);

    } catch (error) {
      console.error('Error applying filters:', error);
      this.ui.showError(`Failed to apply filters: ${error.message}`);
    } finally {
      this.ui.hideLoading();
      this.ui.hideTopProgressBar();
      this.ui.setControlsDisabled(false);
    }
  }

  /**
   * Geocode addresses and add markers to map (using batch geocoding).
   * Tracks per-address failures in localStorage for background retry.
   */
  async geocodeAndDisplayTasks(tasksWithAddresses) {
    let successCount = 0;
    let failCount = 0;

    // Clear any previous geocode failure indicators
    this.ui.clearGeocodeFailures();

    // Extract all addresses for batch geocoding
    const addresses = tasksWithAddresses.map(t => t.address);

    // Show progress
    this.ui.showTopProgressBar(`Geocoding ${addresses.length} addresses...`);

    try {
      // Batch geocode all addresses at once (instant if cached)
      const results = await this.geocoder.geocodeBatch(addresses);

      // Add markers for all results
      tasksWithAddresses.forEach(({ task, projectName, address }) => {
        const normalized = address.toLowerCase().trim();
        const coords = results[normalized];

        // Extract contact info
        const contact = this.asanaClient.extractContact(task.notes);

        if (coords) {
          // Clear any stored failure for this address (e.g. fixed in Asana)
          this._clearGeocodeFailure(address);

          // Add marker to map
          this.map.addPropertyMarker(
            task,
            projectName,
            address,
            coords,
            contact
          );
          successCount++;
        } else {
          console.warn(`No geocoding result for address: ${address}`);
          // Record failure for background retry
          this._storeGeocodeFailure(address);
          // Mark task as failed to geocode in the UI with details
          this.ui.markTaskGeocodeFailed(task.gid, {
            task,
            projectName,
            address,
            contact
          });
          failCount++;
        }
      });

      // Fit map to show all markers
      this.map.fitBoundsToMarkers();

      // Show results
      if (successCount > 0) {
        this.ui.showSuccess(
          `Displayed ${successCount} properties on the map` +
          (failCount > 0 ? ` (${failCount} failed to geocode)` : '')
        );
      } else {
        this.ui.showError('Failed to geocode any addresses');
      }

    } catch (error) {
      console.error('Geocoding error:', error);
      this.ui.showError('Failed to geocode addresses. Check console for details.');
    } finally {
      // Hide top progress bar
      this.ui.hideTopProgressBar();
    }
  }

  /**
   * Extract unique tags from all tasks
   */
  extractUniqueTags(tasks) {
    const tagSet = new Set();
    tasks.forEach(task => {
      if (task.tags && Array.isArray(task.tags)) {
        task.tags.forEach(tag => {
          if (tag.name) {
            tagSet.add(tag.name);
          }
        });
      }
    });
    return Array.from(tagSet).sort();
  }
}

// Initialize application
// Note: ES6 modules are deferred by default, so DOM is already loaded
const app = new AsanaSchedulerApp();
app.init();

// Make app available globally for debugging
window.asanaSchedulerApp = app;
