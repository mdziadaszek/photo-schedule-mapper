<?php
/**
 * Clear Failed Geocode Entries
 *
 * This script removes only the failed (null) geocode results from the cache,
 * while preserving all successful geocodes. Failed addresses will be retried
 * on the next geocoding request.
 *
 * Usage:
 *   php clear-failures.php
 */

require_once 'config.php';

$cacheFile = CONFIG['cache_file'];

// Check if cache file exists
if (!file_exists($cacheFile)) {
    echo "Cache file not found: $cacheFile\n";
    echo "Nothing to clear.\n";
    exit(0);
}

// Load cache
$cacheContents = file_get_contents($cacheFile);
if (!$cacheContents) {
    echo "Cache file is empty.\n";
    exit(0);
}

$cache = json_decode($cacheContents, true);
if (!$cache || !is_array($cache)) {
    echo "Invalid cache format.\n";
    exit(1);
}

// Count entries before filtering
$totalBefore = count($cache);
$failureCount = 0;
$successCount = 0;

foreach ($cache as $address => $entry) {
    if (isset($entry['result']) && $entry['result'] === null) {
        $failureCount++;
    } else {
        $successCount++;
    }
}

echo "Cache Statistics:\n";
echo "  Total entries: $totalBefore\n";
echo "  Successful geocodes: $successCount\n";
echo "  Failed geocodes: $failureCount\n";
echo "\n";

if ($failureCount === 0) {
    echo "No failures found in cache. Nothing to clear.\n";
    exit(0);
}

// Create backup before modifying
$backupFile = $cacheFile . '.backup.' . date('Y-m-d_H-i-s');
if (copy($cacheFile, $backupFile)) {
    echo "Backup created: $backupFile\n";
} else {
    echo "Warning: Could not create backup file.\n";
    echo "Continue anyway? (y/n): ";
    $handle = fopen("php://stdin", "r");
    $line = fgets($handle);
    if (trim(strtolower($line)) !== 'y') {
        echo "Aborted.\n";
        exit(0);
    }
}

// Filter out failed entries (where result is null)
$cleanedCache = array_filter($cache, function($entry) {
    return isset($entry['result']) && $entry['result'] !== null;
});

// Save cleaned cache
$json = json_encode($cleanedCache, JSON_PRETTY_PRINT);
if (file_put_contents($cacheFile, $json) === false) {
    echo "Error: Failed to write to cache file.\n";
    exit(1);
}

$totalAfter = count($cleanedCache);

echo "\nResults:\n";
echo "  Removed $failureCount failed entries\n";
echo "  Kept $totalAfter successful entries\n";
echo "  Cache file updated successfully!\n";
echo "\n";
echo "Failed addresses will be retried on the next geocoding request.\n";
