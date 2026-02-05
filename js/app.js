// Main Application - Asana Photography Scheduler
// Orchestrates all components: Auth, Asana, Geocoder, Map, UI

import { AuthManager } from './auth.js';
import { AsanaClient } from './asana-client.js';
import { Geocoder } from './geocoder.js';
import { TaskMap } from './map.js';
import { UIManager } from './ui.js';
import { TAG_CONFIG } from './config.js';

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

    // Apply filters button
    this.ui.elements.applyFiltersBtn.addEventListener('click', () => {
      this.handleApplyFilters();
    });

    // Listen for filter changes (state selection)
    document.addEventListener('filter-changed', (e) => {
      this.handleFilterStateChange(e.detail);
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
   * Handle refresh button click
   */
  async handleRefresh() {
    if (!this.auth.isAuthenticated()) {
      this.ui.showError('Please log in first');
      return;
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
   * Update city filters based on selected states
   */
  handleFilterStateChange(filterData) {
    const { selectedStates } = filterData;

    // Determine if CA or TX is selected
    const hasCaOrTx = selectedStates.some(state => state === 'CA' || state === 'TX');

    if (hasCaOrTx && this.allTasks.length > 0) {
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
   * Load tasks and populate filters from Asana
   */
  async loadAsanaData() {
    try {
      this.ui.showLoading('Fetching photo shoot tasks from Asana...');
      this.ui.setControlsDisabled(true);

      // Get workspaces
      const workspaces = await this.asanaClient.getWorkspaces();

      if (workspaces.length === 0) {
        throw new Error('No workspaces found');
      }

      // Use first workspace
      this.currentWorkspace = workspaces[0];

      // Fetch photo shoot tasks
      this.allTasks = await this.asanaClient.getPhotoShootTasks(this.currentWorkspace.gid);

      if (this.allTasks.length === 0) {
        this.ui.showWarning('No photo shoot tasks found in your workspace');
        this.ui.populateStateFilters([]);
        return;
      }

      // Extract and populate state filters
      const stateTags = this.asanaClient.extractStateTags(this.allTasks);
      this.ui.populateStateFilters(stateTags);

      // Extract and populate assignee (photographer) filters
      const assignees = this.asanaClient.extractAssignees(this.allTasks);
      this.ui.populateAssigneeFilters(assignees);

      // Auto-select all states by default
      this.ui.selectAllStates(stateTags);

      // Auto-select current user by default
      this.ui.selectAssignee(this.currentUser.name);

      this.ui.showSuccess(`Loaded ${this.allTasks.length} photo shoot tasks`);

      // Automatically apply the filters to display tasks on map
      this.ui.hideLoading();
      this.ui.setControlsDisabled(false);
      await this.handleApplyFilters();

    } catch (error) {
      console.error('Error loading Asana data:', error);
      this.ui.showError(`Failed to load tasks: ${error.message}`);
      this.ui.hideLoading();
      this.ui.setControlsDisabled(false);
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
   * Geocode addresses and add markers to map
   */
  async geocodeAndDisplayTasks(tasksWithAddresses) {
    let successCount = 0;
    let failCount = 0;

    // Clear any previous geocode failure indicators
    this.ui.clearGeocodeFailures();

    for (let i = 0; i < tasksWithAddresses.length; i++) {
      const { task, projectName, address } = tasksWithAddresses[i];

      // Update top progress bar (non-blocking)
      this.ui.updateTopProgress(
        i + 1,
        tasksWithAddresses.length,
        `Geocoding address ${i + 1} of ${tasksWithAddresses.length}...`
      );

      // Extract contact info (needed for both success and failure)
      const contact = this.asanaClient.extractContact(task.notes);

      try {
        // Geocode address
        const coordinates = await this.geocoder.geocode(address);

        if (coordinates) {
          // Add marker to map
          this.map.addPropertyMarker(
            task,
            projectName,
            address,
            coordinates,
            contact
          );

          successCount++;
        } else {
          console.warn(`No geocoding result for address: ${address}`);
          // Mark task as failed to geocode in the UI with details
          this.ui.markTaskGeocodeFailed(task.gid, {
            task,
            projectName,
            address,
            contact
          });
          failCount++;
        }

      } catch (error) {
        console.error(`Geocoding failed for address "${address}":`, error);
        // Mark task as failed to geocode in the UI with details
        this.ui.markTaskGeocodeFailed(task.gid, {
          task,
          projectName,
          address,
          contact
        });
        failCount++;
      }
    }

    // Fit map to show all markers
    this.map.fitBoundsToMarkers();

    // Hide top progress bar
    this.ui.hideTopProgressBar();

    // Show results
    if (successCount > 0) {
      this.ui.showSuccess(
        `Displayed ${successCount} properties on the map` +
        (failCount > 0 ? ` (${failCount} failed to geocode)` : '')
      );
    } else {
      this.ui.showError('Failed to geocode any addresses');
    }

    // Save geocode cache
    this.geocoder.saveCache();
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

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new AsanaSchedulerApp();
  app.init();

  // Make app available globally for debugging
  window.asanaSchedulerApp = app;
});
