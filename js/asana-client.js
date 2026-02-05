// Asana API Client Wrapper - Using REST API directly (no SDK needed!)

import { TASK_CONFIG, TAG_CONFIG } from './config.js';
import { AddressParser } from './address-parser.js';

export class AsanaClient {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseUrl = 'https://app.asana.com/api/1.0';
    this.addressParser = new AddressParser();
  }

  /**
   * Make a request to Asana API
   * @param {string} endpoint - API endpoint (e.g., '/users/me')
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} API response data
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.errors?.[0]?.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  }

  /**
   * Get the current user's workspaces
   * @returns {Promise<Array>} List of workspaces
   */
  async getWorkspaces() {
    try {
      return await this.request('/workspaces');
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      throw new Error('Failed to fetch workspaces from Asana');
    }
  }

  /**
   * Get the current authenticated user
   * @returns {Promise<Object>} User object
   */
  async getCurrentUser() {
    try {
      return await this.request('/users/me');
    } catch (error) {
      console.error('Error fetching current user:', error);
      throw new Error('Failed to fetch user information');
    }
  }

  /**
   * Get all projects in a workspace with pagination
   * @param {string} workspaceGid - Workspace GID
   * @returns {Promise<Array>} List of all projects
   */
  async getProjects(workspaceGid) {
    const allProjects = [];
    let offset = null;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        workspace: workspaceGid,
        archived: 'false',
        limit: '100'
      });

      if (offset) {
        params.append('offset', offset);
      }

      try {
        const url = `${this.baseUrl}/projects?${params}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.status}`);
        }

        const data = await response.json();
        allProjects.push(...data.data);

        // Check if there are more pages
        if (data.next_page && data.next_page.offset) {
          offset = data.next_page.offset;
        } else {
          hasMore = false;
        }
      } catch (error) {
        console.error('Error fetching projects with pagination:', error);
        hasMore = false;
      }
    }

    return allProjects;
  }

  /**
   * Fetch all tasks from a project with pagination
   * @param {string} projectGid - Project GID
   * @param {string} optFields - Fields to fetch
   * @returns {Promise<Array>} All tasks from the project
   */
  async getAllTasksFromProject(projectGid, optFields) {
    const allTasks = [];
    let offset = null;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        project: projectGid,
        opt_fields: optFields,
        completed_since: 'now',
        limit: '100'
      });

      if (offset) {
        params.append('offset', offset);
      }

      try {
        const url = `${this.baseUrl}/tasks?${params}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch tasks: ${response.status}`);
        }

        const data = await response.json();
        allTasks.push(...data.data);

        // Check if there are more pages
        if (data.next_page && data.next_page.offset) {
          offset = data.next_page.offset;
        } else {
          hasMore = false;
        }
      } catch (error) {
        console.error(`Error fetching tasks with pagination:`, error);
        hasMore = false;
      }
    }

    return allTasks;
  }

  /**
   * Fetch all photo shoot tasks from the Photography project
   * @param {string} workspaceGid - Workspace GID (not used when project GID is configured)
   * @returns {Promise<Array>} Array of filtered tasks
   */
  async getPhotoShootTasks(workspaceGid) {
    try {
      console.log('Fetching photo shoot tasks from Photography project...');

      const optFields = [
        'gid',
        'name',
        'notes',
        'completed',
        'assignee.name',
        'tags.name',
        'custom_fields.name',
        'custom_fields.text_value',
        'custom_fields.display_value',
        'projects.name',
        'projects.gid'
      ].join(',');

      // Use configured Photography project GID directly
      const photographyProjectGid = TASK_CONFIG.photographyProjectGid;
      console.log(`Using Photography project GID: ${photographyProjectGid}`);

      // Fetch all incomplete tasks from Photography project
      const allTasks = await this.getAllTasksFromProject(photographyProjectGid, optFields);
      console.log(`Total tasks in Photography project: ${allTasks.length}`);

      // Filter for "Schedule Photo Shoot" tasks
      const filteredTasks = allTasks.filter(task => {
        // Must contain "Schedule Photo Shoot" in name
        if (!task.name || !task.name.toLowerCase().includes(TASK_CONFIG.nameFilter.toLowerCase())) {
          return false;
        }

        // Must have an assignee (exclude unassigned tasks)
        if (!task.assignee || !task.assignee.name) {
          return false;
        }

        // Must NOT be assigned to Photography Coordinator
        if (task.assignee.name === TASK_CONFIG.excludeAssignee) {
          return false;
        }

        return true;
      });

      console.log(`Filtered tasks (Schedule Photo Shoot): ${filteredTasks.length}`);

      return filteredTasks;

    } catch (error) {
      console.error('Error fetching photo shoot tasks:', error);
      throw new Error('Failed to fetch tasks from Asana');
    }
  }

  /**
   * Get address from task (custom field or description)
   * @param {Object} task - Asana task object
   * @returns {string|null} Address string or null if not found
   */
  getTaskAddress(task) {
    // Check custom fields first (PRIMARY source)
    if (task.custom_fields && Array.isArray(task.custom_fields)) {
      const addressField = task.custom_fields.find(
        field => field.name && field.name.toLowerCase() === 'address'
      );

      if (addressField) {
        // Try text_value first, then display_value
        const address = addressField.text_value || addressField.display_value;
        if (address && address.trim()) {
          return address.trim();
        }
      }
    }

    // Fallback to parsing task description/notes
    if (task.notes && task.notes.trim()) {
      const parsedAddress = this.addressParser.parse(task.notes);
      if (parsedAddress) {
        return parsedAddress;
      }
    }

    return null;
  }

  /**
   * Extract unique state tags from tasks
   * @param {Array} tasks - Array of tasks
   * @returns {Array<string>} Sorted array of state codes (e.g., ['CA', 'TX', 'FL'])
   */
  extractStateTags(tasks) {
    const stateSet = new Set();

    tasks.forEach(task => {
      if (task.tags && Array.isArray(task.tags)) {
        task.tags.forEach(tag => {
          if (tag.name && tag.name.startsWith(TAG_CONFIG.statePrefix)) {
            // Extract state code (e.g., "State - CA" -> "CA")
            const stateCode = tag.name.substring(TAG_CONFIG.statePrefix.length).trim();
            if (stateCode) {
              stateSet.add(stateCode);
            }
          }
        });
      }
    });

    return Array.from(stateSet).sort();
  }

  /**
   * Extract city tags for a specific state
   * @param {Array} tasks - Array of tasks
   * @param {string} stateCode - State code (e.g., 'CA', 'TX')
   * @returns {Array<string>} Sorted array of city names
   */
  extractCityTags(tasks, stateCode) {
    // Get the list of valid cities for this state
    const cityListKey = TAG_CONFIG.stateCityMap[stateCode];
    if (!cityListKey) {
      return []; // State doesn't have city-level tags
    }

    const validCities = TAG_CONFIG[cityListKey];
    if (!validCities || !Array.isArray(validCities)) {
      return [];
    }

    const citySet = new Set();

    tasks.forEach(task => {
      if (task.tags && Array.isArray(task.tags)) {
        // Check if task has the state tag
        const hasStateTag = task.tags.some(
          tag => tag.name === `${TAG_CONFIG.statePrefix}${stateCode}`
        );

        if (hasStateTag) {
          // Extract city tags that are in the valid list for this state
          task.tags.forEach(tag => {
            if (tag.name && validCities.includes(tag.name)) {
              citySet.add(tag.name);
            }
          });
        }
      }
    });

    return Array.from(citySet).sort();
  }

  /**
   * Extract unique assignees (photographers) from tasks
   * @param {Array} tasks - Array of tasks
   * @returns {Array<string>} Sorted array of assignee names
   */
  extractAssignees(tasks) {
    const assigneeSet = new Set();

    tasks.forEach(task => {
      if (task.assignee && task.assignee.name) {
        assigneeSet.add(task.assignee.name);
      }
    });

    return Array.from(assigneeSet).sort();
  }

  /**
   * Count tasks per state for selected assignees
   * @param {Array} tasks - Array of all tasks
   * @param {Array<string>} selectedAssignees - Selected photographer names (empty = all)
   * @returns {Object} Map of state code to task count
   */
  countTasksByState(tasks, selectedAssignees = []) {
    const stateCounts = {};

    tasks.forEach(task => {
      // If assignees selected, filter by them
      if (selectedAssignees.length > 0) {
        const matchesAssignee = task.assignee && selectedAssignees.includes(task.assignee.name);
        if (!matchesAssignee) {
          return; // Skip this task
        }
      }

      // Extract state tags
      if (task.tags && Array.isArray(task.tags)) {
        task.tags.forEach(tag => {
          if (tag.name && tag.name.startsWith(TAG_CONFIG.statePrefix)) {
            const stateCode = tag.name.substring(TAG_CONFIG.statePrefix.length).trim();
            if (stateCode) {
              stateCounts[stateCode] = (stateCounts[stateCode] || 0) + 1;
            }
          }
        });
      }
    });

    return stateCounts;
  }

  /**
   * Count tasks per assignee for selected states
   * @param {Array} tasks - Array of all tasks
   * @param {Array<string>} selectedStates - Selected state codes (empty = all)
   * @returns {Object} Map of assignee name to task count
   */
  countTasksByAssignee(tasks, selectedStates = []) {
    const assigneeCounts = {};

    tasks.forEach(task => {
      // If states selected, check if task has any of those state tags
      if (selectedStates.length > 0) {
        const hasStateTag = task.tags && task.tags.some(tag => {
          if (!tag.name || !tag.name.startsWith(TAG_CONFIG.statePrefix)) {
            return false;
          }
          const stateCode = tag.name.substring(TAG_CONFIG.statePrefix.length).trim();
          return selectedStates.includes(stateCode);
        });

        if (!hasStateTag) {
          return; // Skip this task
        }
      }

      // Count by assignee
      if (task.assignee && task.assignee.name) {
        const name = task.assignee.name;
        assigneeCounts[name] = (assigneeCounts[name] || 0) + 1;
      }
    });

    return assigneeCounts;
  }

  /**
   * Get project name (property name) for a task
   * @param {Object} task - Asana task object
   * @returns {string} Project name or 'Unknown Property'
   */
  getProjectName(task) {
    if (task.projects && task.projects.length > 0) {
      // Return the first project name
      return task.projects[0].name;
    }
    return 'Unknown Property';
  }

  /**
   * Filter tasks by selected state, city tags, and assignees
   * @param {Array} tasks - Array of all tasks
   * @param {Array<string>} selectedStates - Selected state codes (e.g., ['CA', 'TX'])
   * @param {Array<string>} selectedCities - Selected city names (e.g., ['Los Angeles', 'Austin'])
   * @param {Array<string>} selectedAssignees - Selected assignee names (e.g., ['John Doe', 'Jane Smith'])
   * @returns {Array} Filtered tasks
   */
  filterTasksByTags(tasks, selectedStates = [], selectedCities = [], selectedAssignees = []) {
    // If no filters selected, return empty array
    if (selectedStates.length === 0) {
      return [];
    }

    return tasks.filter(task => {
      if (!task.tags || !Array.isArray(task.tags)) {
        return false;
      }

      // Check if task has any of the selected state tags
      const hasStateTag = task.tags.some(tag => {
        if (!tag.name || !tag.name.startsWith(TAG_CONFIG.statePrefix)) {
          return false;
        }
        const stateCode = tag.name.substring(TAG_CONFIG.statePrefix.length).trim();
        return selectedStates.includes(stateCode);
      });

      if (!hasStateTag) {
        return false;
      }

      // If city filters are selected, check city tags
      if (selectedCities.length > 0) {
        const hasCityTag = task.tags.some(tag =>
          tag.name && selectedCities.includes(tag.name)
        );
        if (!hasCityTag) {
          return false;
        }
      }

      // If assignee filters are selected, check assignee
      if (selectedAssignees.length > 0) {
        const matchesAssignee = task.assignee && selectedAssignees.includes(task.assignee.name);
        if (!matchesAssignee) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Extract contact information from task notes
   * @param {string} notes - Task description/notes
   * @returns {Object} Contact object with phone and email
   */
  extractContact(notes) {
    if (!notes) {
      return { phone: null, email: null };
    }

    // Regex for phone numbers
    // Matches: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890
    const phoneRegex = /(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
    const phoneMatches = notes.match(phoneRegex);

    // Regex for email addresses
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    const emailMatches = notes.match(emailRegex);

    return {
      phone: phoneMatches && phoneMatches.length > 0 ? phoneMatches[0] : null,
      email: emailMatches && emailMatches.length > 0 ? emailMatches[0] : null
    };
  }

  /**
   * Fetch full task details including all custom fields
   * @param {string} taskGid - Task GID
   * @returns {Promise<Object>} Full task object
   */
  async getTaskDetails(taskGid) {
    try {
      const optFields = [
        'gid',
        'name',
        'notes',
        'completed',
        'assignee.name',
        'tags.name',
        'custom_fields.name',
        'custom_fields.text_value',
        'custom_fields.display_value',
        'projects.name',
        'projects.gid',
        'permalink_url'
      ].join(',');

      return await this.request(`/tasks/${taskGid}?opt_fields=${optFields}`);

    } catch (error) {
      console.error(`Error fetching task ${taskGid}:`, error);
      throw new Error('Failed to fetch task details');
    }
  }
}

export default AsanaClient;
