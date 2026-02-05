# Asana Photography Scheduler

An interactive map application that visualizes photography shoot locations from Asana tasks. Built for photographers to plan their photo shoot trips at apartment complexes and properties across different states and cities.

## Features

- **Asana OAuth Integration** - Secure authentication with PKCE flow
- **Interactive Map** - Leaflet + OpenStreetMap showing property locations
- **Smart Filtering** - Filter by state tags and city tags (CA/TX)
- **Address Extraction** - Reads from Asana custom field "Address" or parses from task descriptions
- **Geocoding** - Converts addresses to map coordinates with rate limiting and caching
- **Contact Information** - Extracts phone and email from task descriptions
- **Responsive Design** - Works on desktop and mobile devices

## Quick Start

### Prerequisites

- A modern web browser with JavaScript enabled
- An Asana account with photo shoot tasks
- Tasks should:
  - Contain "Schedule Photo Shoot" in the task name
  - Have an "Address" custom field or address in the description
  - Be tagged with state tags (e.g., "State - CA", "State - TX")

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd asana-scheduler
   ```

2. **Serve the files locally**

   You need a local web server to run the application (due to ES6 modules):

   **Option 1: Python**
   ```bash
   python -m http.server 8000
   ```

   **Option 2: Node.js**
   ```bash
   npx http-server -p 8000
   ```

   **Option 3: VS Code Live Server**
   - Install "Live Server" extension
   - Right-click [index.html](index.html) and select "Open with Live Server"

3. **Open in browser**
   ```
   http://localhost:8000
   ```

### Deployment

The application can be deployed to any static hosting service. For full OAuth functionality, you'll need serverless function support.

#### Deploy to Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Set environment variable**
   ```bash
   vercel env add ASANA_CLIENT_SECRET
   ```
   Enter your Asana client secret: `0d3e65078b01aaa96960338bec1d4902`

3. **Deploy**
   ```bash
   vercel --prod
   ```

4. **Update OAuth redirect URI**
   - Go to https://app.asana.com/0/developer-console
   - Update redirect URI to: `https://your-domain.vercel.app/callback`
   - Update in [js/config.js](js/config.js:18):
     ```javascript
     redirectUri: 'https://your-domain.vercel.app/callback'
     ```

#### Deploy to Netlify

1. **Create `netlify.toml`**
   ```toml
   [build]
     publish = "."

   [[redirects]]
     from = "/api/*"
     to = "/.netlify/functions/:splat"
     status = 200

   [functions]
     directory = "api"
   ```

2. **Deploy via Netlify CLI or Dashboard**
   ```bash
   netlify deploy --prod
   ```

3. **Set environment variable in Netlify Dashboard**
   - Go to Site settings > Build & deploy > Environment variables
   - Add `ASANA_CLIENT_SECRET` = `0d3e65078b01aaa96960338bec1d4902`

4. **Update OAuth redirect URI**
   - Update in Asana developer console
   - Update in [js/config.js](js/config.js:18)

## Configuration

### Update Before Deployment

1. **Geocoding User-Agent** ([js/config.js](js/config.js:26))
   ```javascript
   userAgent: 'AsanaPhotoScheduler/1.0 (your-email@example.com)'
   ```
   Replace with your actual contact email.

2. **OAuth Redirect URI** ([js/config.js](js/config.js:18))
   ```javascript
   redirectUri: 'https://your-production-domain.com/callback'
   ```

3. **Asana Developer Console**
   - Go to https://app.asana.com/0/developer-console
   - Update redirect URI to match your deployment

## Project Structure

```
asana-scheduler/
├── index.html              # Main HTML page
├── css/
│   └── styles.css         # All styling
├── js/
│   ├── config.js          # Configuration constants
│   ├── auth.js            # OAuth authentication
│   ├── asana-client.js    # Asana API wrapper
│   ├── address-parser.js  # Address extraction
│   ├── geocoder.js        # Nominatim geocoding
│   ├── map.js             # Leaflet map
│   ├── ui.js              # UI controls
│   └── app.js             # Main orchestrator
├── api/
│   └── oauth-callback.js  # Serverless OAuth function
├── .gitignore
└── README.md
```

## How It Works

### 1. Authentication
- User clicks "Connect to Asana"
- Redirects to Asana OAuth with PKCE challenge
- Asana redirects back with authorization code
- Serverless function exchanges code for access token (secure)
- Token stored in localStorage

### 2. Task Fetching
- Fetches all incomplete tasks from workspace
- Filters tasks containing "Schedule Photo Shoot" in name
- Excludes tasks assigned to "Photography Coordinator"
- Extracts unique state and city tags

### 3. Filtering
- User selects state(s) from checkbox list
- If CA or TX selected, city checkboxes appear
- Click "Apply Filters" to process tasks

### 4. Address Processing
- For each filtered task:
  1. Check custom field "Address" (PRIMARY)
  2. If not found, parse task description with regex (FALLBACK)
  3. Geocode address to lat/lon coordinates
  4. Extract contact info (phone/email)
  5. Add marker to map with popup

### 5. Map Display
- Markers show property locations
- Click marker to see details
- Map auto-zooms to fit all markers
- Click task in sidebar to highlight marker

## Task Requirements

Your Asana tasks should follow this structure:

**Task Name:** Must contain "Schedule Photo Shoot"
```
Schedule Photo Shoot - Property Name
```

**Tags:**
- State tag: `State - CA`, `State - TX`, `State - FL`, etc.
- City tag (CA/TX only): `Los Angeles`, `Austin`, etc.

**Custom Field (Recommended):**
- Field name: `Address`
- Value: Full property address

**Description (Fallback):**
```
Address: 123 Main St, Los Angeles, CA 90001
Contact: John Doe
Phone: (555) 123-4567
Email: john@example.com
```

**Assignee:** NOT "Photography Coordinator" (those tasks are excluded)

**Status:** Incomplete (completed tasks are excluded)

## Rate Limits & Caching

### Nominatim (Geocoding)
- **Limit:** 1 request per second
- **Cache:** Results cached in localStorage for 30 days
- **User-Agent:** Required - update in [js/config.js](js/config.js:26)

### Asana API
- **Limit:** 150 requests per minute (unlikely to hit)
- **No cache:** Tasks are fetched fresh each time

## Browser Compatibility

- Chrome 61+ (ES6 modules)
- Firefox 60+
- Safari 11+
- Edge 79+

**Note:** Requires HTTPS in production for Crypto API (PKCE)

## Troubleshooting

### OAuth Issues
- **"Invalid redirect URI"**: Update in Asana developer console
- **"Token exchange failed"**: Check environment variable is set correctly
- **"CSRF attack"**: Clear browser cache and try again

### Geocoding Issues
- **"Rate limit exceeded"**: Wait 1 second between requests (automatic)
- **"No results found"**: Check address format in task
- **"User-Agent error"**: Update User-Agent in [js/config.js](js/config.js:26)

### Map Not Loading
- **Blank map**: Check console for errors, ensure Leaflet CSS/JS loaded
- **Markers not appearing**: Check browser console for geocoding errors
- **Map wrong size**: Refresh page or resize browser window

### No Tasks Found
- **Check task name**: Must contain "Schedule Photo Shoot"
- **Check status**: Must be incomplete
- **Check assignee**: Must NOT be "Photography Coordinator"
- **Check workspace**: Make sure you have access to workspace with tasks

## Development

### File Modifications

**To add new state/city tags:**
Edit [js/config.js](js/config.js:68):
```javascript
tags: {
  californiaCities: ['Bakersfield', 'Fresno', ...],
  texasCities: ['Amarillo', 'Austin', ...],
  // Add new states:
  floridaCities: ['Miami', 'Tampa', ...],
  stateCityMap: {
    'CA': 'californiaCities',
    'TX': 'texasCities',
    'FL': 'floridaCities'
  }
}
```

**To customize map appearance:**
Edit [js/config.js](js/config.js:36) for tile layers:
```javascript
tileLayer: {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  // Or use different tile provider
}
```

**To change address extraction patterns:**
Edit [js/address-parser.js](js/address-parser.js:10)

## Security

- **Client Secret:** NEVER exposed in frontend code
- **OAuth:** PKCE flow prevents authorization code interception
- **Tokens:** Stored in localStorage (consider encryption for production)
- **XSS Protection:** HTML escaped in popups and UI

## Credits

- **Leaflet** - Open-source JavaScript library for interactive maps
- **OpenStreetMap** - Collaborative map data
- **Nominatim** - Free geocoding service by OpenStreetMap Foundation
- **Asana** - Task management platform

## License

MIT License - See LICENSE file for details

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Verify Asana task structure matches requirements
4. Check that OAuth redirect URIs match in all locations

---

**Built for photographers to efficiently plan their photo shoot schedules across properties.**
