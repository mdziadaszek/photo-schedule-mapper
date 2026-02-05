# Deployment Guide - Asana Photography Scheduler

This guide will help you deploy the app to your Apache server with the new PHP backend for server-side geocode caching.

## What Changed

✅ **PHP backend** added for geocoding (`api/geocode.php`)
✅ **LocationIQ API** replaces Nominatim (faster, more reliable)
✅ **Server-side cache** shared across all users (instant loading for demos)
✅ **Batch geocoding** - all addresses in one request
✅ **PAT authentication** still in JavaScript (unchanged)

## Prerequisites Checklist

- [ ] Apache web server running
- [ ] PHP 7.0+ installed
- [ ] LocationIQ API key (free account: https://locationiq.com/)
- [ ] Write permissions for cache directory

## Step-by-Step Deployment

### 1. Upload Files to Server

Upload the entire `asana-scheduler` directory to your server:

```bash
# From your local machine
scp -r c:\Users\mdziadaszek\source\repos\asana-scheduler/* \
  user@your-server:/var/htdocs/photography-scheduler/
```

Or use FTP/SFTP client (FileZilla, WinSCP, etc.)

### 2. Get LocationIQ API Key

**✅ ALREADY DONE** - Your API key is already in `api/config.php`

If you need to get a new key:
1. Visit https://locationiq.com/
2. Sign up (free)
3. Dashboard → Access Tokens
4. Copy API key to `api/config.php`

### 3. Create Cache Directory

SSH into your server and run:

```bash
cd /var/htdocs/photography-scheduler/api
mkdir -p cache
chmod 777 cache
touch cache/geocode.json
chmod 666 cache/geocode.json
```

### 4. Test PHP Endpoint

From your server, test the geocoding API:

```bash
curl -X POST http://localhost/photography-scheduler/api/geocode.php \
  -H "Content-Type: application/json" \
  -d '{"addresses":["1600 Amphitheatre Parkway, Mountain View, CA"]}'
```

**Expected output:**
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

**If you get an error:**
- Check PHP is installed: `php --version`
- Check file permissions: `ls -la api/cache/`
- Check Apache error log: `tail -f /var/log/apache2/error.log`

### 5. Verify Cache File Created

```bash
cat /var/htdocs/photography-scheduler/api/cache/geocode.json
```

You should see the cached address with coordinates.

### 6. Configure Apache (if needed)

Your existing Apache Alias should work:

```apache
Alias /photography-scheduler /var/htdocs/photography-scheduler

<Directory /var/htdocs/photography-scheduler>
    Options -Indexes +FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>

# Ensure API directory is accessible
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

### 7. Test from Browser

1. Open http://michaeldziadaszek.com/photography-scheduler/
2. Enter your Asana PAT (client-side auth unchanged)
3. Select filters → Apply
4. **Open browser DevTools** (F12) → Network tab
5. You should see:
   - POST request to `/api/geocode.php`
   - Response with `results` and `stats`
   - Tasks load quickly (batch geocoded)

### 8. Verify Multi-User Cache Sharing

1. Open in **incognito mode** or different browser
2. Enter PAT and apply filters
3. Should load **instantly** (using server cache)
4. ✅ This proves cache is shared across users!

## Performance Comparison

### Before (Nominatim + localStorage)
- First load: ~10 minutes (600 addresses × 1.1 sec)
- Each new user: ~10 minutes (no shared cache)
- Demo experience: ❌ Long waits

### After (LocationIQ + PHP cache)
- First load: ~2-3 minutes (LocationIQ 2x faster)
- All subsequent users: **~2-3 seconds** (shared cache)
- Demo experience: ✅ Professional, instant

## Troubleshooting

### "Connection refused" or 404 errors

Check Apache is serving the files:
```bash
curl http://localhost/photography-scheduler/
```

If 404, verify Alias in Apache config:
```bash
grep -r "photography-scheduler" /etc/apache2/
```

### "Invalid request" from geocode.php

Check request format:
```bash
curl -v -X POST http://localhost/photography-scheduler/api/geocode.php \
  -H "Content-Type: application/json" \
  -d '{"addresses":["test"]}'
```

### "LocationIQ API key not configured"

Edit `api/config.php` and verify API key is set:
```php
'locationiq_api_key' => 'pk.6c6815515034151ea69e789fa3378f1b',  // Your key
```

### Cache not saving

Check permissions:
```bash
ls -la /var/htdocs/photography-scheduler/api/cache/
```

Should show:
```
drwxrwxrwx  cache/
-rw-rw-rw-  geocode.json
```

Fix if needed:
```bash
chmod 777 /var/htdocs/photography-scheduler/api/cache
chmod 666 /var/htdocs/photography-scheduler/api/cache/geocode.json
```

### No results returned

Check LocationIQ API status:
```bash
curl "https://us1.locationiq.com/v1/search.php?key=YOUR_KEY&q=New+York&format=json"
```

If rate limited (>5,000 req/day):
- Wait until tomorrow
- Or upgrade LocationIQ account
- Or implement queue on server

### Apache logs showing errors

```bash
tail -f /var/log/apache2/error.log
tail -f /var/log/apache2/access.log
```

## Post-Deployment Checklist

- [ ] PHP endpoint returns geocoded results
- [ ] Cache file is created and populated
- [ ] Frontend loads and authenticates
- [ ] Tasks display on map quickly
- [ ] Second user/browser loads instantly (shared cache)
- [ ] Failed geocodes show warning in task list

## Cache Management

### View cache statistics

```bash
# Count cached addresses
jq 'length' /var/htdocs/photography-scheduler/api/cache/geocode.json

# Show all cached addresses
cat /var/htdocs/photography-scheduler/api/cache/geocode.json | jq 'keys'
```

### Backup cache

```bash
cp /var/htdocs/photography-scheduler/api/cache/geocode.json \
   /var/htdocs/photography-scheduler/api/cache/geocode.backup.json
```

### Clear cache (if needed)

```bash
rm /var/htdocs/photography-scheduler/api/cache/geocode.json
echo '{}' > /var/htdocs/photography-scheduler/api/cache/geocode.json
chmod 666 /var/htdocs/photography-scheduler/api/cache/geocode.json
```

## Files Changed

### New Files
- `api/geocode.php` - PHP geocoding endpoint
- `api/config.php` - LocationIQ API key config
- `api/.gitignore` - Ignore config and cache
- `api/README.md` - API documentation

### Modified Files
- `js/geocoder.js` - Now calls PHP backend (simplified from 300 to 120 lines)
- `js/app.js` - Uses batch geocoding instead of sequential

### Unchanged Files (No deployment changes needed)
- `js/auth.js` - PAT authentication (client-side)
- `js/asana-client.js` - Asana API calls (client-side)
- `js/ui.js`, `js/map.js`, `js/config.js` - No changes
- `index.html`, `css/styles.css` - No changes

## Cost

- **LocationIQ Free Tier**: 5,000 requests/day (150,000/month)
- **Your usage**: ~600 initial geocodes, then ~5-10/day for new tasks
- **Storage**: ~100KB cache file
- **Total**: **$0/month** ✅

## Security Notes

✅ PAT stays in browser (not sent to PHP)
✅ LocationIQ API key server-side (not exposed to browser)
✅ Cache file world-readable (addresses are not sensitive)
⚠️ No authentication on geocode endpoint (acceptable for PoC)

For production, consider:
- Rate limiting per IP (prevent abuse)
- HTTPS (Let's Encrypt)
- Cache file in non-web-accessible directory

## Rollback Plan

If issues arise, rollback is easy:

1. Replace `js/geocoder.js` with old version (from git)
2. Replace `js/app.js` with old version (from git)
3. Remove `api/` directory
4. App will work with old Nominatim + localStorage

## Demo Talking Points

When showing this to your buddy's company:

1. **Speed**: "Watch how fast this loads - all users share the same geocoded cache"
2. **Scalability**: "Once addresses are geocoded once, everyone gets instant results"
3. **Cost**: "This runs on LocationIQ's free tier - 5,000 requests per day, zero cost"
4. **User Experience**: "No 10-minute waits, professional loading experience"
5. **Architecture**: "Lightweight PHP backend, no database needed, just a JSON cache file"

## Support

If you run into issues:
1. Check Apache error logs: `tail -f /var/log/apache2/error.log`
2. Check PHP errors: `tail -f /var/log/php/error.log` (if enabled)
3. Test geocoding API directly: See step 4 above
4. Verify file permissions: Step 3 above

## Success! 🎉

Once deployed, you'll have:
- ✅ Instant loading for all users (shared cache)
- ✅ Professional demo experience
- ✅ Free geocoding with LocationIQ
- ✅ Simple, maintainable architecture
- ✅ Perfect proof-of-concept for your buddy's company

Visit http://michaeldziadaszek.com/photography-scheduler/ and enjoy the speed! 🚀
