# Geocoding API - Server Setup Instructions

This lightweight PHP backend provides server-side geocode caching for the Asana Photography Scheduler.

## Benefits

- **Fast loading**: Instant results after first geocode (shared cache across all users)
- **Free**: LocationIQ free tier (5,000 requests/day)
- **Simple**: No database, just JSON file cache
- **Perfect for PoC demos**: Professional experience, no 10-minute waits

## Prerequisites

- PHP 7.0+ with JSON support
- Apache web server (already configured)
- Write permissions for cache directory

## Setup Instructions

### 1. Get LocationIQ API Key

1. Visit [https://locationiq.com/](https://locationiq.com/)
2. Sign up for a free account
3. Go to Dashboard → Access Tokens
4. Copy your API key

### 2. Configure API Key

Edit `config.php` and replace `YOUR_API_KEY_HERE` with your actual API key:

```php
define('CONFIG', [
    'locationiq_api_key' => 'pk.abc123...', // Your actual key here
    'cache_file' => __DIR__ . '/cache/geocode.json',
    'cache_expiry_days' => 365
]);
```

### 3. Create Cache Directory

On your server, run:

```bash
cd /var/htdocs/photography-scheduler/api
mkdir -p cache
chmod 777 cache
touch cache/geocode.json
chmod 666 cache/geocode.json
```

### 4. Test the API

Test from command line:

```bash
curl -X POST http://localhost/photography-scheduler/api/geocode.php \
  -H "Content-Type: application/json" \
  -d '{"addresses":["1600 Amphitheatre Parkway, Mountain View, CA"]}'
```

Expected response:
```json
{
  "results": {
    "1600 amphitheatre parkway, mountain view, ca": {
      "lat": 37.422,
      "lon": -122.084,
      "display_name": "Google, ..."
    }
  },
  "stats": {
    "total_requested": 1,
    "from_cache": 0,
    "newly_geocoded": 1
  }
}
```

### 5. Verify Cache File

Check that the cache was created:

```bash
cat /var/htdocs/photography-scheduler/api/cache/geocode.json
```

You should see the cached address with coordinates.

### 6. Apache Configuration (Optional)

If the API isn't accessible, ensure your Apache VirtualHost allows access to the API directory:

```apache
<Directory /var/htdocs/photography-scheduler/api>
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted
</Directory>
```

Reload Apache:
```bash
sudo systemctl reload apache2
```

## Usage from Frontend

The frontend automatically calls this API:

```javascript
// Batch geocode multiple addresses
const response = await fetch('/api/geocode.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    addresses: ['123 Main St', '456 Oak Ave']
  })
});

const data = await response.json();
// data.results['123 main st'] = {lat, lon, display_name}
```

## Performance

- **Cached requests**: <100ms (instant)
- **Uncached requests**: ~500ms each (due to 0.5s rate limiting)
- **Batch 600 addresses**: ~2-3 minutes on first load, instant thereafter
- **All users share cache**: No localStorage, works across browsers/devices

## Troubleshooting

### "Invalid request" error
- Check that you're sending POST requests with JSON body
- Verify Content-Type header is set to `application/json`

### "LocationIQ API call failed"
- Verify API key is correct in `config.php`
- Check that you haven't exceeded the free tier (5,000 req/day)
- Check error logs: `tail -f /var/log/apache2/error.log`

### Cache not saving
- Check directory permissions: `chmod 777 cache/`
- Check file permissions: `chmod 666 cache/geocode.json`
- Verify PHP has write access: `ls -la cache/`

### Empty results
- Check that addresses are valid US addresses
- LocationIQ may not find very new or rural addresses
- Failed geocodes are cached as `null` to avoid repeated lookups

## API Endpoint

### POST /api/geocode.php

**Request:**
```json
{
  "addresses": [
    "123 Main St, New York, NY",
    "456 Oak Ave, Los Angeles, CA"
  ]
}
```

**Response:**
```json
{
  "results": {
    "123 main st, new york, ny": {
      "lat": 40.7128,
      "lon": -74.0060,
      "display_name": "123 Main Street, Manhattan, New York, ..."
    },
    "456 oak ave, los angeles, ca": {
      "lat": 34.0522,
      "lon": -118.2437,
      "display_name": "456 Oak Avenue, Los Angeles, California, ..."
    }
  },
  "stats": {
    "total_requested": 2,
    "from_cache": 0,
    "newly_geocoded": 2
  }
}
```

## Cache Management

### View cache statistics
```bash
# Count cached addresses
jq 'length' /var/htdocs/photography-scheduler/api/cache/geocode.json

# See all cached addresses
cat /var/htdocs/photography-scheduler/api/cache/geocode.json
```

### Clear cache
```bash
rm /var/htdocs/photography-scheduler/api/cache/geocode.json
touch /var/htdocs/photography-scheduler/api/cache/geocode.json
chmod 666 /var/htdocs/photography-scheduler/api/cache/geocode.json
```

### Backup cache
```bash
cp /var/htdocs/photography-scheduler/api/cache/geocode.json \
   /var/htdocs/photography-scheduler/api/cache/geocode.backup.json
```

## Cost

- **LocationIQ Free Tier**: 5,000 requests/day (150,000/month)
- **Storage**: ~100KB for 600 addresses
- **PHP Memory**: <1MB per request
- **Total Cost**: $0/month ✅

## Security

- ✅ PAT authentication stays in browser (not sent to PHP)
- ✅ LocationIQ API key stored server-side (not exposed to browser)
- ⚠️ No authentication on geocode endpoint (public)
  - Acceptable for PoC demo
  - For production: Add rate limiting per IP

## Support

For issues or questions, check:
1. Apache error logs: `tail -f /var/log/apache2/error.log`
2. PHP error logs: `tail -f /var/log/php/error.log`
3. LocationIQ dashboard: https://locationiq.com/dashboard
