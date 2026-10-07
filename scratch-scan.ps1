$root = "C:\Users\hi\.cursor\projects\c-Users-hi-Projects-industriallink\agent-transcripts"
$files = Get-ChildItem $root -Recurse -Filter "*.jsonl"
$matches = @()
foreach ($f in $files) {
  $lines = Get-Content $f.FullName -TotalCount 100 -ErrorAction SilentlyContinue
  $found = $false
  foreach ($line in $lines) {
    if ($found) { continue }
    try {
      $obj = $line | ConvertFrom-Json -ErrorAction SilentlyContinue
      if (-not $obj) { continue }
      $text = ""
      if ($obj.message.content) {
        if ($obj.message.content -is [string]) { $text = $obj.message.content }
        elseif ($obj.message.content.text) { $text = $obj.message.content.text -join " " }
      }
      if ($text -and $text.Length -gt 20) {
        if ($text -match "Module not found|Cannot find module|Failed to compile|pm2 restart inlink-web|/www/wwwroot/inlink|git reset --hard origin|EADDRINUSE|next start -p 3000|Build error|can.t resolve") {
          $matches += [PSCustomObject]@{
            Date = $f.LastWriteTime.ToString("MM-dd HH:mm")
            File = $f.Name
            Snippet = $text.Substring(0, [Math]::Min(180, $text.Length))
          }
          $found = $true
        }
      }
    } catch {}
  }
}
$matches | Select-Object -First 30 | Format-Table -Wrap -AutoSize