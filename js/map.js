// Map Manager - Handles Leaflet map initialization, markers, and popups

import { MAP_CONFIG } from './config.js';

export class TaskMap {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.markers = [];
    this.markerLayer = null;
    this.assigneeColors = {}; // Track assigned colors to avoid repeats
    this.availableColors = [
      '#e74c3c', // Red
      '#3498db', // Blue
      '#2ecc71', // Green
      '#f39c12', // Orange
      '#1abc9c', // Turquoise
      '#e67e22', // Carrot
      '#16a085', // Green Sea
      '#c0392b', // Dark red
      '#8e44ad', // Purple
      '#f1c40f', // Yellow
      '#d35400', // Pumpkin
      '#27ae60', // Nephritis
      '#2980b9', // Belize Hole
      '#8e44ad'  // Wisteria
    ];

    this.initialize();
  }

  /**
   * Initialize the Leaflet map
   */
  initialize() {
    // Define bounds for continental USA
    const usBounds = [
      [24.396308, -125.0],  // Southwest corner (Southern California/Mexico border)
      [49.384358, -66.93457] // Northeast corner (Maine/Canada border)
    ];

    // Create map instance (without attribution control, restricted to US)
    this.map = L.map(this.containerId, {
      attributionControl: false,
      maxBounds: usBounds,
      maxBoundsViscosity: 1.0, // Prevents panning outside bounds
      minZoom: 4 // Prevent zooming out too far
    }).setView(
      MAP_CONFIG.defaultCenter,
      MAP_CONFIG.defaultZoom
    );

    // Add OpenStreetMap tile layer
    L.tileLayer(MAP_CONFIG.tileLayer.url, {
      maxZoom: MAP_CONFIG.tileLayer.maxZoom
    }).addTo(this.map);

    // Create layer group for markers
    this.markerLayer = L.layerGroup().addTo(this.map);

    // Invalidate size after a short delay to ensure proper rendering
    setTimeout(() => {
      this.map.invalidateSize();
    }, 100);
  }

  /**
   * Get color for assignee (photographer)
   * Assigns unique colors to each photographer without repeats
   * @param {string} assigneeName - Assignee name
   * @returns {string} Color hex code
   */
  getColorForAssignee(assigneeName) {
    if (!assigneeName) {
      return MAP_CONFIG.photographerColors.default;
    }

    // Check if assignee has a configured color
    if (MAP_CONFIG.photographerColors[assigneeName]) {
      return MAP_CONFIG.photographerColors[assigneeName];
    }

    // Check if we've already assigned a color to this assignee
    if (this.assigneeColors[assigneeName]) {
      return this.assigneeColors[assigneeName];
    }

    // Get list of already used colors
    const usedColors = new Set(Object.values(this.assigneeColors));

    // Find next available color that hasn't been used
    let color = null;
    for (const availableColor of this.availableColors) {
      if (!usedColors.has(availableColor)) {
        color = availableColor;
        break;
      }
    }

    // If all colors are used, use default
    if (!color) {
      color = MAP_CONFIG.photographerColors.default;
    }

    // Store the assigned color
    this.assigneeColors[assigneeName] = color;

    return color;
  }

  /**
   * Add a property marker to the map
   * @param {Object} task - Asana task object
   * @param {string} projectName - Property/project name
   * @param {string} address - Property address
   * @param {Object} coordinates - Object with lat and lon properties
   * @param {Object} contact - Object with phone and email properties
   * @returns {Object} Leaflet marker object
   */
  addPropertyMarker(task, projectName, address, coordinates, contact = {}) {
    if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lon !== 'number') {
      console.warn(`Invalid coordinates for task ${task.gid}:`, coordinates);
      return null;
    }

    // Get color for assignee
    const color = this.getColorForAssignee(task.assignee?.name);

    // Create custom colored marker icon
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-pin" style="background-color: ${color};"></div>`,
      iconSize: [30, 42],
      iconAnchor: [15, 42],
      popupAnchor: [0, -42]
    });

    // Create marker with custom icon
    const marker = L.marker([coordinates.lat, coordinates.lon], { icon: customIcon });

    // Create popup content
    const popupContent = this.createPopupContent(task, projectName, address, contact);
    marker.bindPopup(popupContent, {
      maxWidth: 300,
      minWidth: 250
    });

    // Add marker to layer
    marker.addTo(this.markerLayer);

    // Store marker with task info
    this.markers.push({
      marker,
      task,
      projectName,
      address,
      coordinates
    });

    // Add click event to highlight task in sidebar
    marker.on('click', () => {
      this.selectMarker(task.gid);
      // Dispatch event for UI to highlight task item
      const event = new CustomEvent('marker-clicked', {
        detail: { taskGid: task.gid }
      });
      document.dispatchEvent(event);
    });

    return marker;
  }

  /**
   * Create HTML content for marker popup
   * @param {Object} task - Asana task object
   * @param {string} projectName - Property/project name
   * @param {string} address - Property address
   * @param {Object} contact - Contact information
   * @returns {string} HTML string for popup
   */
  createPopupContent(task, projectName, address, contact = {}) {
    return `
      <div class="task-popup">
        <h3>${this.escapeHtml(projectName)}</h3>
        <p><strong>Task:</strong> ${this.escapeHtml(task.name)}</p>
        ${task.assignee && task.assignee.name ? `
          <p><strong>Photographer:</strong> ${this.escapeHtml(task.assignee.name)}</p>
        ` : ''}
        <p><strong>Address:</strong><br>${this.escapeHtml(address)}</p>
        ${contact.phone ? `
          <p><strong>Phone:</strong> ${this.escapeHtml(contact.phone)}</p>
        ` : ''}
        ${contact.email ? `
          <p><strong>Email:</strong> ${this.escapeHtml(contact.email)}</p>
        ` : ''}
        <p style="margin-top: 10px;">
          <a href="https://app.asana.com/0/0/${task.gid}"
             target="_blank"
             rel="noopener noreferrer"
             style="color: #2196F3; text-decoration: none; font-weight: 500;">
            Open in Asana →
          </a>
        </p>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Select/highlight a marker (open popup)
   * @param {string} taskGid - Task GID to select
   */
  selectMarker(taskGid) {
    const markerInfo = this.markers.find(m => m.task.gid === taskGid);
    if (markerInfo) {
      // Close all popups
      this.map.closePopup();

      // Open popup for selected marker
      markerInfo.marker.openPopup();

      // Pan to marker
      this.map.panTo(markerInfo.marker.getLatLng(), {
        animate: true,
        duration: 0.5
      });
    }
  }

  /**
   * Clear all markers from the map
   */
  clearMarkers() {
    this.markerLayer.clearLayers();
    this.markers = [];
  }

  /**
   * Fit map bounds to show all markers
   * @param {Object} options - Fit bounds options
   */
  fitBoundsToMarkers(options = {}) {
    if (this.markers.length === 0) {
      // No markers, reset to default view
      this.map.setView(MAP_CONFIG.defaultCenter, MAP_CONFIG.defaultZoom);
      return;
    }

    if (this.markers.length === 1) {
      // Only one marker, center on it with a reasonable zoom
      const coords = this.markers[0].coordinates;
      this.map.setView([coords.lat, coords.lon], 13);
      return;
    }

    // Multiple markers, fit bounds to show all
    const group = L.featureGroup(this.markers.map(m => m.marker));
    this.map.fitBounds(group.getBounds().pad(0.1), {
      maxZoom: 15,
      ...options
    });
  }

  /**
   * Get marker count
   * @returns {number} Number of markers on map
   */
  getMarkerCount() {
    return this.markers.length;
  }

  /**
   * Get marker by task GID
   * @param {string} taskGid - Task GID
   * @returns {Object|null} Marker info or null
   */
  getMarkerByTaskGid(taskGid) {
    return this.markers.find(m => m.task.gid === taskGid) || null;
  }

  /**
   * Update map size (call when container is resized)
   */
  invalidateSize() {
    if (this.map) {
      this.map.invalidateSize();
    }
  }

  /**
   * Set map view to specific coordinates
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {number} zoom - Zoom level
   */
  setView(lat, lon, zoom = 13) {
    if (this.map) {
      this.map.setView([lat, lon], zoom, {
        animate: true
      });
    }
  }

  /**
   * Get current map center
   * @returns {Object} Object with lat and lon
   */
  getCenter() {
    if (this.map) {
      const center = this.map.getCenter();
      return {
        lat: center.lat,
        lon: center.lng
      };
    }
    return null;
  }

  /**
   * Get current zoom level
   * @returns {number} Zoom level
   */
  getZoom() {
    if (this.map) {
      return this.map.getZoom();
    }
    return MAP_CONFIG.defaultZoom;
  }

  /**
   * Add custom marker with options
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {Object} options - Marker options
   * @returns {Object} Leaflet marker
   */
  addCustomMarker(lat, lon, options = {}) {
    const marker = L.marker([lat, lon], options);
    marker.addTo(this.markerLayer);
    return marker;
  }

  /**
   * Remove specific marker
   * @param {Object} marker - Leaflet marker object
   */
  removeMarker(marker) {
    this.markerLayer.removeLayer(marker);
    this.markers = this.markers.filter(m => m.marker !== marker);
  }

  /**
   * Get all markers as GeoJSON
   * @returns {Object} GeoJSON FeatureCollection
   */
  getMarkersAsGeoJSON() {
    const features = this.markers.map(markerInfo => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [markerInfo.coordinates.lon, markerInfo.coordinates.lat]
      },
      properties: {
        taskGid: markerInfo.task.gid,
        taskName: markerInfo.task.name,
        projectName: markerInfo.projectName,
        address: markerInfo.address
      }
    }));

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * Destroy the map instance
   */
  destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.markers = [];
      this.markerLayer = null;
    }
  }
}

export default TaskMap;
