// UI Manager - Handles all UI interactions and updates

import { UI_CONFIG } from './config.js';

export class UIManager {
  constructor() {
    this.elements = {
      // Auth elements
      loginBtn: document.getElementById('login-btn'),
      logoutBtn: document.getElementById('logout-btn'),
      authStatus: document.getElementById('auth-status'),

      // Filter elements
      stateFilters: document.getElementById('state-filters'),
      cityFilters: document.getElementById('city-filters'),
      cityFilterGroup: document.getElementById('city-filter-group'),
      assigneeFilters: document.getElementById('assignee-filters'),
      assigneeFilterGroup: document.getElementById('assignee-filter-group'),
      refreshBtn: document.getElementById('refresh-btn'),

      // Task list elements
      taskList: document.getElementById('task-list'),
      taskCount: document.getElementById('task-count'),

      // Loading overlay
      loadingOverlay: document.getElementById('loading-overlay'),
      loadingMessage: document.getElementById('loading-message'),
      progressBar: document.getElementById('progress-bar'),
      progressFill: document.getElementById('progress-fill'),
      progressText: document.getElementById('progress-text'),

      // Top progress bar (for non-blocking operations)
      topProgressBar: document.getElementById('top-progress-bar'),
      topProgressText: document.getElementById('top-progress-text'),
      topProgressFill: document.getElementById('top-progress-fill'),

      // Toast container
      toastContainer: document.getElementById('toast-container'),

      // Task details modal
      taskDetailsModal: document.getElementById('task-details-modal'),
      taskDetailsTitle: document.getElementById('task-details-title'),
      taskDetailsBody: document.getElementById('task-details-body'),
      taskDetailsClose: document.getElementById('task-details-close')
    };

    this.selectedStates = new Set();
    this.selectedCities = new Set();
    this.selectedAssignees = new Set();

    // Store details for failed geocode tasks
    this.failedGeocodeDetails = new Map();

    // Setup task details modal close handlers
    this.setupTaskDetailsModal();
  }

  /**
   * Update authentication status UI
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {string} userName - Optional user name to display
   */
  updateAuthStatus(isAuthenticated, userName = null) {
    if (isAuthenticated) {
      this.elements.authStatus.textContent = userName ? `Connected as ${userName}` : 'Connected';
      this.elements.authStatus.classList.add('connected');
      this.elements.loginBtn.style.display = 'none';
      this.elements.logoutBtn.style.display = 'inline-block';
    } else {
      this.elements.authStatus.textContent = 'Not connected';
      this.elements.authStatus.classList.remove('connected');
      this.elements.loginBtn.style.display = 'inline-block';
      this.elements.logoutBtn.style.display = 'none';
    }
  }

  /**
   * Populate state filter checkboxes
   * @param {Array<string>} states - Array of state codes
   * @param {Object} counts - Optional map of state code to task count
   */
  populateStateFilters(states, counts = null) {
    this.elements.stateFilters.innerHTML = '';

    if (states.length === 0) {
      this.elements.stateFilters.innerHTML = '<p class="placeholder-text">No states found</p>';
      return;
    }

    // Add "Select All" checkbox
    const selectAllCheckbox = this.createCheckbox(
      'state-select-all',
      'Select All',
      (checked) => this.handleSelectAllStates(checked, states)
    );
    selectAllCheckbox.style.fontWeight = 'bold';
    selectAllCheckbox.style.borderBottom = '1px solid #ddd';
    selectAllCheckbox.style.paddingBottom = '8px';
    selectAllCheckbox.style.marginBottom = '8px';
    this.elements.stateFilters.appendChild(selectAllCheckbox);

    states.forEach(stateCode => {
      const count = counts ? counts[stateCode] || 0 : null;
      const label = count !== null ? `${stateCode} (${count})` : stateCode;
      const disabled = count === 0;

      const checkbox = this.createCheckbox(
        `state-${stateCode}`,
        label,
        (checked) => this.handleStateFilterChange(stateCode, checked),
        disabled
      );

      // Preserve checked state if this state was previously selected
      const input = checkbox.querySelector('input');
      if (this.selectedStates.has(stateCode)) {
        input.checked = true;
      }

      this.elements.stateFilters.appendChild(checkbox);
    });
  }

  /**
   * Populate city filter checkboxes
   * @param {Array<string>} cities - Array of city names
   */
  populateCityFilters(cities) {
    this.elements.cityFilters.innerHTML = '';

    if (cities.length === 0) {
      this.elements.cityFilterGroup.style.display = 'none';
      return;
    }

    this.elements.cityFilterGroup.style.display = 'block';

    cities.forEach(cityName => {
      const checkbox = this.createCheckbox(
        `city-${cityName.replace(/\s+/g, '-')}`,
        cityName,
        (checked) => this.handleCityFilterChange(cityName, checked)
      );
      this.elements.cityFilters.appendChild(checkbox);
    });
  }

  /**
   * Populate assignee (photographer) filter checkboxes
   * @param {Array<string>} assignees - Array of assignee names
   * @param {Object} counts - Optional map of assignee name to task count
   */
  populateAssigneeFilters(assignees, counts = null) {
    this.elements.assigneeFilters.innerHTML = '';

    if (assignees.length === 0) {
      this.elements.assigneeFilters.innerHTML = '<p class="placeholder-text">No photographers</p>';
      return;
    }

    // Add "Select All" checkbox
    const selectAllCheckbox = this.createCheckbox(
      'assignee-select-all',
      'Select All',
      (checked) => this.handleSelectAllAssignees(checked, assignees)
    );
    selectAllCheckbox.style.fontWeight = 'bold';
    selectAllCheckbox.style.borderBottom = '1px solid #ddd';
    selectAllCheckbox.style.paddingBottom = '8px';
    selectAllCheckbox.style.marginBottom = '8px';
    this.elements.assigneeFilters.appendChild(selectAllCheckbox);

    assignees.forEach(assigneeName => {
      const count = counts ? counts[assigneeName] || 0 : null;
      const label = count !== null ? `${assigneeName} (${count})` : assigneeName;
      const disabled = count === 0;

      const checkbox = this.createCheckbox(
        `assignee-${assigneeName.replace(/\s+/g, '-')}`,
        label,
        (checked) => this.handleAssigneeFilterChange(assigneeName, checked),
        disabled
      );

      // Preserve checked state if this assignee was previously selected
      const input = checkbox.querySelector('input');
      if (this.selectedAssignees.has(assigneeName)) {
        input.checked = true;
      }

      this.elements.assigneeFilters.appendChild(checkbox);
    });
  }

  /**
   * Create a checkbox element
   * @param {string} id - Checkbox ID
   * @param {string} label - Checkbox label
   * @param {Function} onChange - Change event handler
   * @param {boolean} disabled - Whether checkbox is disabled
   * @returns {HTMLElement} Checkbox container element
   */
  createCheckbox(id, label, onChange, disabled = false) {
    const container = document.createElement('div');
    container.className = 'filter-checkbox';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.disabled = disabled;
    input.addEventListener('change', (e) => onChange(e.target.checked));

    const labelEl = document.createElement('label');
    labelEl.htmlFor = id;
    labelEl.textContent = label;
    if (disabled) {
      labelEl.style.opacity = '0.5';
      labelEl.style.cursor = 'not-allowed';
    }

    container.appendChild(input);
    container.appendChild(labelEl);

    return container;
  }

  /**
   * Handle state filter change
   * @param {string} stateCode - State code
   * @param {boolean} checked - Whether checkbox is checked
   */
  handleStateFilterChange(stateCode, checked) {
    if (checked) {
      this.selectedStates.add(stateCode);
    } else {
      this.selectedStates.delete(stateCode);
    }

    // Update "Select All" checkbox state
    this.updateSelectAllStateCheckbox();

    // Trigger custom event for state filter change
    this.dispatchFilterChangeEvent();
  }

  /**
   * Handle city filter change
   * @param {string} cityName - City name
   * @param {boolean} checked - Whether checkbox is checked
   */
  handleCityFilterChange(cityName, checked) {
    if (checked) {
      this.selectedCities.add(cityName);
    } else {
      this.selectedCities.delete(cityName);
    }

    // Trigger custom event for city filter change
    this.dispatchFilterChangeEvent();
  }

  /**
   * Handle assignee filter change
   * @param {string} assigneeName - Assignee name
   * @param {boolean} checked - Whether checkbox is checked
   */
  handleAssigneeFilterChange(assigneeName, checked) {
    if (checked) {
      this.selectedAssignees.add(assigneeName);
    } else {
      this.selectedAssignees.delete(assigneeName);
    }

    // Update "Select All" checkbox state
    this.updateSelectAllAssigneeCheckbox();

    // Trigger custom event for assignee filter change
    this.dispatchFilterChangeEvent();
  }

  /**
   * Handle "Select All" for states
   * @param {boolean} checked - Whether checkbox is checked
   * @param {Array<string>} states - Array of all state codes
   */
  handleSelectAllStates(checked, states) {
    states.forEach(stateCode => {
      const checkbox = document.getElementById(`state-${stateCode}`);
      if (checkbox) {
        checkbox.checked = checked;
        if (checked) {
          this.selectedStates.add(stateCode);
        } else {
          this.selectedStates.delete(stateCode);
        }
      }
    });

    // Trigger custom event for filter change
    this.dispatchFilterChangeEvent();
  }

  /**
   * Handle "Select All" for assignees
   * @param {boolean} checked - Whether checkbox is checked
   * @param {Array<string>} assignees - Array of all assignee names
   */
  handleSelectAllAssignees(checked, assignees) {
    assignees.forEach(assigneeName => {
      const checkbox = document.getElementById(`assignee-${assigneeName.replace(/\s+/g, '-')}`);
      if (checkbox) {
        checkbox.checked = checked;
        if (checked) {
          this.selectedAssignees.add(assigneeName);
        } else {
          this.selectedAssignees.delete(assigneeName);
        }
      }
    });

    // Trigger custom event for filter change
    this.dispatchFilterChangeEvent();
  }

  /**
   * Dispatch filter change event
   */
  dispatchFilterChangeEvent() {
    const event = new CustomEvent('filter-changed', {
      detail: {
        selectedStates: Array.from(this.selectedStates),
        selectedCities: Array.from(this.selectedCities),
        selectedAssignees: Array.from(this.selectedAssignees)
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * Update "Select All" state checkbox based on individual selections
   */
  updateSelectAllStateCheckbox() {
    const selectAllCheckbox = document.getElementById('state-select-all');
    if (!selectAllCheckbox) return;

    // Count total state checkboxes (only enabled ones)
    const allStateCheckboxes = this.elements.stateFilters.querySelectorAll('input[type="checkbox"][id^="state-"]:not(#state-select-all):not(:disabled)');
    const allChecked = allStateCheckboxes.length > 0 &&
                       Array.from(allStateCheckboxes).every(cb => cb.checked);

    selectAllCheckbox.checked = allChecked;
  }

  /**
   * Update "Select All" assignee checkbox based on individual selections
   */
  updateSelectAllAssigneeCheckbox() {
    const selectAllCheckbox = document.getElementById('assignee-select-all');
    if (!selectAllCheckbox) return;

    // Count total assignee checkboxes (only enabled ones)
    const allAssigneeCheckboxes = this.elements.assigneeFilters.querySelectorAll('input[type="checkbox"][id^="assignee-"]:not(#assignee-select-all):not(:disabled)');
    const allChecked = allAssigneeCheckboxes.length > 0 &&
                       Array.from(allAssigneeCheckboxes).every(cb => cb.checked);

    selectAllCheckbox.checked = allChecked;
  }

  /**
   * Programmatically select all states
   * @param {Array<string>} states - Array of state codes to select
   */
  selectAllStates(states) {
    states.forEach(stateCode => {
      const checkbox = document.getElementById(`state-${stateCode}`);
      if (checkbox) {
        checkbox.checked = true;
        this.selectedStates.add(stateCode);
      }
    });

    // Use a small timeout to ensure checkboxes are rendered before updating
    setTimeout(() => {
      // Update "Select All" checkbox based on actual state
      this.updateSelectAllStateCheckbox();
    }, 0);

    // Trigger custom event for filter change
    this.dispatchFilterChangeEvent();
  }

  /**
   * Programmatically select all assignees
   * @param {Array<string>} assignees - Array of assignee names to select
   */
  selectAllAssignees(assignees) {
    assignees.forEach(assigneeName => {
      const checkbox = document.getElementById(`assignee-${assigneeName.replace(/\s+/g, '-')}`);
      if (checkbox) {
        checkbox.checked = true;
        this.selectedAssignees.add(assigneeName);
      }
    });

    // Use a small timeout to ensure checkboxes are rendered before updating
    setTimeout(() => {
      // Update "Select All" checkbox based on actual state
      this.updateSelectAllAssigneeCheckbox();
    }, 0);

    // Trigger custom event for filter change
    this.dispatchFilterChangeEvent();
  }

  /**
   * Programmatically select a specific assignee
   * @param {string} assigneeName - Assignee name to select
   */
  selectAssignee(assigneeName) {
    if (!assigneeName) return;

    const checkbox = document.getElementById(`assignee-${assigneeName.replace(/\s+/g, '-')}`);
    if (checkbox) {
      checkbox.checked = true;
      this.selectedAssignees.add(assigneeName);

      // Update "Select All" checkbox state
      this.updateSelectAllAssigneeCheckbox();

      // Trigger custom event for filter change
      this.dispatchFilterChangeEvent();
    }
  }

  /**
   * Get currently selected filters
   * @returns {Object} Object with selectedStates, selectedCities, and selectedAssignees arrays
   */
  getSelectedFilters() {
    return {
      selectedStates: Array.from(this.selectedStates),
      selectedCities: Array.from(this.selectedCities),
      selectedAssignees: Array.from(this.selectedAssignees)
    };
  }

  /**
   * Display task list
   * @param {Array} tasks - Array of task objects with display info
   */
  displayTaskList(tasks) {
    this.elements.taskList.innerHTML = '';
    this.elements.taskCount.textContent = `(${tasks.length})`;

    if (tasks.length === 0) {
      this.elements.taskList.innerHTML = '<p class="placeholder-text">No tasks match the selected filters</p>';
      return;
    }

    tasks.forEach(taskInfo => {
      const taskItem = document.createElement('div');
      taskItem.className = 'task-item';
      taskItem.dataset.taskGid = taskInfo.task.gid;

      const title = document.createElement('div');
      title.className = 'task-item-title';
      title.textContent = taskInfo.task.name;

      const property = document.createElement('div');
      property.className = 'task-item-property';
      property.textContent = taskInfo.projectName;

      taskItem.appendChild(title);
      taskItem.appendChild(property);

      // Click handler - show details modal for failed geocodes, or highlight marker for successful ones
      taskItem.addEventListener('click', () => {
        // Check if this task failed geocoding
        if (this.failedGeocodeDetails.has(taskInfo.task.gid)) {
          // Show details modal for failed geocode
          this.showTaskDetails(taskInfo.task.gid);
        } else {
          // Highlight marker on map for successful geocode
          this.selectTaskItem(taskInfo.task.gid);
          // Dispatch event for map to highlight marker
          const event = new CustomEvent('task-item-clicked', {
            detail: { taskGid: taskInfo.task.gid }
          });
          document.dispatchEvent(event);
        }
      });

      this.elements.taskList.appendChild(taskItem);
    });
  }

  /**
   * Highlight a task item in the list
   * @param {string} taskGid - Task GID to highlight
   */
  selectTaskItem(taskGid) {
    // Remove selection from all items
    const allItems = this.elements.taskList.querySelectorAll('.task-item');
    allItems.forEach(item => item.classList.remove('selected'));

    // Add selection to clicked item
    const selectedItem = this.elements.taskList.querySelector(`[data-task-gid="${taskGid}"]`);
    if (selectedItem) {
      selectedItem.classList.add('selected');
      selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Mark a task with geocode failure indicator
   * @param {string} taskGid - Task GID that failed to geocode
   * @param {Object} taskDetails - Task details (task, projectName, address, contact)
   */
  markTaskGeocodeFailed(taskGid, taskDetails = null) {
    const taskItem = this.elements.taskList.querySelector(`[data-task-gid="${taskGid}"]`);
    if (taskItem) {
      // Store task details for later display
      if (taskDetails) {
        this.failedGeocodeDetails.set(taskGid, taskDetails);
      }

      // Add a warning indicator
      if (!taskItem.querySelector('.geocode-warning')) {
        const warning = document.createElement('span');
        warning.className = 'geocode-warning';
        warning.textContent = '⚠ Failed to geocode - Click to view details';
        warning.title = 'This address could not be found on the map. Click to see details.';
        taskItem.appendChild(warning);
        taskItem.classList.add('geocode-failed');
      }
    }
  }

  /**
   * Clear all geocode failure indicators
   */
  clearGeocodeFailures() {
    const warnings = this.elements.taskList.querySelectorAll('.geocode-warning');
    warnings.forEach(warning => warning.remove());

    const failedItems = this.elements.taskList.querySelectorAll('.geocode-failed');
    failedItems.forEach(item => item.classList.remove('geocode-failed'));

    // Clear stored details
    this.failedGeocodeDetails.clear();
  }

  /**
   * Setup task details modal event handlers
   */
  setupTaskDetailsModal() {
    // Close button
    this.elements.taskDetailsClose.addEventListener('click', () => {
      this.hideTaskDetails();
    });

    // Click outside modal to close
    this.elements.taskDetailsModal.addEventListener('click', (e) => {
      if (e.target === this.elements.taskDetailsModal) {
        this.hideTaskDetails();
      }
    });

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.elements.taskDetailsModal.style.display === 'flex') {
        this.hideTaskDetails();
      }
    });
  }

  /**
   * Show task details modal for a failed geocode task
   * @param {string} taskGid - Task GID
   */
  showTaskDetails(taskGid) {
    const details = this.failedGeocodeDetails.get(taskGid);
    if (!details) {
      return;
    }

    const { task, projectName, address, contact } = details;

    // Build the modal content
    let html = `
      <div class="task-details-warning">
        <strong>⚠ Geocoding Failed</strong>
        <p>This address could not be found on the map. Please verify the address is correct.</p>
      </div>

      <p><strong>Property:</strong><br>${projectName}</p>

      <p><strong>Task:</strong><br>${task.name}</p>

      <p><strong>Photographer:</strong><br>${task.assignee?.name || 'Unassigned'}</p>

      <p><strong>Address:</strong><br>${address || 'No address found'}</p>
    `;

    if (contact.phone || contact.email) {
      html += `<p><strong>Contact:</strong><br>`;
      if (contact.phone) {
        html += `Phone: ${contact.phone}<br>`;
      }
      if (contact.email) {
        html += `Email: <a href="mailto:${contact.email}">${contact.email}</a>`;
      }
      html += `</p>`;
    }

    html += `
      <p>
        <a href="https://app.asana.com/0/0/${task.gid}" target="_blank" style="color: var(--primary-color);">
          Open in Asana →
        </a>
      </p>
    `;

    this.elements.taskDetailsBody.innerHTML = html;
    this.elements.taskDetailsModal.style.display = 'flex';
  }

  /**
   * Hide task details modal
   */
  hideTaskDetails() {
    this.elements.taskDetailsModal.style.display = 'none';
  }

  /**
   * Show loading overlay
   * @param {string} message - Loading message to display
   */
  showLoading(message = 'Loading...') {
    this.elements.loadingMessage.textContent = message;
    this.elements.progressBar.style.display = 'none';
    this.elements.progressText.style.display = 'none';
    this.elements.loadingOverlay.style.display = 'flex';
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    this.elements.loadingOverlay.style.display = 'none';
  }

  /**
   * Update progress bar
   * @param {number} current - Current progress
   * @param {number} total - Total items
   * @param {string} message - Optional progress message
   */
  updateProgress(current, total, message = null) {
    const percentage = Math.round((current / total) * 100);

    this.elements.progressBar.style.display = 'block';
    this.elements.progressFill.style.width = `${percentage}%`;

    if (message) {
      this.elements.progressText.textContent = message;
    } else {
      this.elements.progressText.textContent = `Processing ${current} of ${total}`;
    }

    this.elements.progressText.style.display = 'block';
  }

  /**
   * Show top progress bar (non-blocking, for geocoding)
   * @param {string} message - Progress message to display
   */
  showTopProgressBar(message = 'Processing...') {
    this.elements.topProgressText.textContent = message;
    this.elements.topProgressFill.style.width = '0%';
    this.elements.topProgressBar.style.display = 'block';
  }

  /**
   * Hide top progress bar
   */
  hideTopProgressBar() {
    this.elements.topProgressBar.style.display = 'none';
  }

  /**
   * Update top progress bar
   * @param {number} current - Current progress
   * @param {number} total - Total items
   * @param {string} message - Optional progress message
   */
  updateTopProgress(current, total, message = null) {
    const percentage = Math.round((current / total) * 100);
    this.elements.topProgressFill.style.width = `${percentage}%`;

    if (message) {
      this.elements.topProgressText.textContent = message;
    } else {
      this.elements.topProgressText.textContent = `Geocoding ${current} of ${total} addresses...`;
    }
  }

  /**
   * Show toast notification
   * @param {string} message - Message to display
   * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
   * @param {number} duration - Duration in milliseconds (default from config)
   */
  showToast(message, type = 'info', duration = UI_CONFIG.toastDuration) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const messageEl = document.createElement('span');
    messageEl.className = 'toast-message';
    messageEl.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      this.removeToast(toast);
    });

    toast.appendChild(messageEl);
    toast.appendChild(closeBtn);

    this.elements.toastContainer.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
      this.removeToast(toast);
    }, duration);
  }

  /**
   * Remove toast notification
   * @param {HTMLElement} toast - Toast element to remove
   */
  removeToast(toast) {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  /**
   * Show success toast
   * @param {string} message - Success message
   */
  showSuccess(message) {
    this.showToast(message, 'success');
  }

  /**
   * Show error toast
   * @param {string} message - Error message
   */
  showError(message) {
    this.showToast(message, 'error', 7000); // Longer duration for errors
  }

  /**
   * Show warning toast
   * @param {string} message - Warning message
   */
  showWarning(message) {
    this.showToast(message, 'warning');
  }

  /**
   * Show login prompt
   */
  showLoginPrompt() {
    this.elements.taskList.innerHTML = '<p class="placeholder-text">Please connect to Asana to view your photo shoot tasks</p>';
    this.elements.stateFilters.innerHTML = '<p class="placeholder-text">Connect to Asana first</p>';
  }

  /**
   * Clear all filters
   */
  clearFilters() {
    this.selectedStates.clear();
    this.selectedCities.clear();

    // Uncheck all checkboxes
    const allCheckboxes = document.querySelectorAll('.filter-checkbox input[type="checkbox"]');
    allCheckboxes.forEach(checkbox => {
      checkbox.checked = false;
    });

    this.elements.cityFilterGroup.style.display = 'none';
  }

  /**
   * Disable UI controls
   * @param {boolean} disabled - Whether to disable controls
   */
  setControlsDisabled(disabled) {
    this.elements.refreshBtn.disabled = disabled;

    const allCheckboxes = document.querySelectorAll('.filter-checkbox input[type="checkbox"]');
    allCheckboxes.forEach(checkbox => {
      checkbox.disabled = disabled;
    });
  }
}

export default UIManager;
