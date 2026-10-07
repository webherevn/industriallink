$root = "C:\Users\hi\.cursor\projects\c-Users-hi-Projects-industriallink\agent-transcripts"
$files = Get-ChildItem $root -Recurse -Filter "*.jsonl"
$results = @()
foreach ($f in $files) {
  $content = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
  if ($content) {
    if ($content -match "Module not found") { $results += "MODULE: $($f.Name)" }
    if ($content -match "Cannot find module") { $results += "CANNOT-FIND: $($f.Name)" }
    if ($content -match "Failed to compile") { $results += "FAILED-COMPILE: $($f.Name)" }
    if ($content -match "pm2 restart inlink-web") { $results += "PM2: $($f.Name)" }
    if ($content -match "git reset --hard origin") { $results += "GIT-RESET: $($f.Name)" }
    if ($content -match "EADDRINUSE") { $results += "EADDRINUSE: $($f.Name)" }
    if ($content -match "Cannot find package") { $results += "CANNOT-FIND-PKG: $($f.Name)" }
  }
}
$results | Sort-Object | Get-Unique | ForEach-Object { $_ }