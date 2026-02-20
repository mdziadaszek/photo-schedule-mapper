<?php
/**
 * Asana Photography Scheduler - Geocoding API
 * Lightweight PHP endpoint for geocoding with server-side caching
 * Uses LocationIQ free tier API
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use POST.']);
    exit;
}

require_once 'config.php';

// Load cache from file
$cacheFile = CONFIG['cache_file'];
$cache = [];

if (file_exists($cacheFile)) {
    $cacheContents = file_get_contents($cacheFile);
    if ($cacheContents) {
        $cache = json_decode($cacheContents, true) ?: [];
    }
}

// Get addresses from request
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['addresses'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request. Expected JSON with "addresses" array.']);
    exit;
}

$addresses = $input['addresses'];

if (!is_array($addresses)) {
    http_response_code(400);
    echo json_encode(['error' => '"addresses" must be an array.']);
    exit;
}

// Optional list of addresses to force-retry even if cached as null (failed before)
$forceAddresses = [];
if (isset($input['force_addresses']) && is_array($input['force_addresses'])) {
    $forceAddresses = array_map(fn($a) => strtolower(trim($a)), $input['force_addresses']);
}

$results = [];
$newlyCached = 0;

foreach ($addresses as $address) {
    if (empty($address) || !is_string($address)) {
        continue;
    }

    $normalized = strtolower(trim($address));

    // Check cache first — skip null-cache only for forced retry addresses
    if (isset($cache[$normalized])) {
        $cached = $cache[$normalized];
        $isForced = in_array($normalized, $forceAddresses) && $cached['result'] === null;

        if (!$isForced) {
            // Use cache (both successful results and non-forced null results)
            $expirySeconds = CONFIG['cache_expiry_days'] * 86400;
            if (time() - $cached['timestamp'] < $expirySeconds) {
                $results[$normalized] = $cached['result'];
                continue;
            }
        }
        // Fall through: forced null retry, or cache expired
    }

    // Geocode with LocationIQ
    $apiKey = CONFIG['locationiq_api_key'];

    if (empty($apiKey) || $apiKey === 'YOUR_API_KEY_HERE') {
        // No API key configured - return error
        $results[$normalized] = null;
        error_log('LocationIQ API key not configured');
        continue;
    }

    $url = 'https://us1.locationiq.com/v1/search.php?' . http_build_query([
        'key' => $apiKey,
        'q' => $address,
        'format' => 'json',
        'limit' => '1'
    ]);

    // Use file_get_contents with error handling
    $context = stream_context_create([
        'http' => [
            'timeout' => 10,  // 10 second timeout
            'ignore_errors' => true
        ]
    ]);

    $response = @file_get_contents($url, false, $context);

    if ($response === false) {
        // API call failed - cache null to avoid repeated failures
        $cache[$normalized] = [
            'result' => null,
            'timestamp' => time()
        ];
        $results[$normalized] = null;
        $newlyCached++;
        error_log("LocationIQ API call failed for address: $address");
        continue;
    }

    $data = json_decode($response, true);

    if (!empty($data) && isset($data[0]['lat']) && isset($data[0]['lon'])) {
        // Successful geocoding
        $result = [
            'lat' => floatval($data[0]['lat']),
            'lon' => floatval($data[0]['lon']),
            'display_name' => $data[0]['display_name'] ?? $address
        ];

        // Cache the result
        $cache[$normalized] = [
            'result' => $result,
            'timestamp' => time()
        ];

        $results[$normalized] = $result;
        $newlyCached++;
    } else {
        // Geocoding returned no results - cache null to avoid repeated lookups
        $cache[$normalized] = [
            'result' => null,
            'timestamp' => time()
        ];
        $results[$normalized] = null;
        $newlyCached++;
    }

    // Respect LocationIQ rate limit (2 req/sec = 0.5 seconds between requests)
    usleep(500000); // 0.5 seconds
}

// Save cache if any new results were added
if ($newlyCached > 0) {
    $cacheDir = dirname($cacheFile);

    // Create cache directory if it doesn't exist
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0777, true);
    }

    // Save cache with pretty print for debugging
    file_put_contents($cacheFile, json_encode($cache, JSON_PRETTY_PRINT));
}

// Return results
echo json_encode([
    'results' => $results,
    'stats' => [
        'total_requested' => count($addresses),
        'from_cache' => count($addresses) - $newlyCached,
        'newly_geocoded' => $newlyCached
    ]
]);
