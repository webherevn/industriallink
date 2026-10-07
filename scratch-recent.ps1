$path = "C:\Users\hi\.cursor\projects\c-Users-hi-Projects-industriallink\agent-transcripts\886c5266-6b97-44b1-9d8f-813f6b519f99\886c5266-6b97-44b1-9d8f-813f6b519f99.jsonl"
$lines = Get-Content $path
$startIdx = 0
for ($i = $lines.Count - 1; $i -ge 0; $i--) {
  if ($lines[$i] -match "Oct 6, 2026") {
    $startIdx = [Math]::Max(0, $i - 2)
    break
  }
}
Write-Host "From line $startIdx to $($lines.Count - 1)"
for ($i = $startIdx; $i -lt $lines.Count; $i++) {
  try {
    $obj = $lines[$i] | ConvertFrom-Json
    $text = ""
    if ($obj.message.content -is [string]) { $text = $obj.message.content }
    elseif ($obj.message.content.text) { $text = $obj.message.content.text -join " " }
    elseif ($obj.message.content.result) { $text = "[RESULT] " + ($obj.message.content.result -join " ") }
    elseif ($obj.message.content.output) { $text = "[OUT] " + $obj.message.content.output }
    if ($text -and $text.Length -gt 10) {
      Write-Host "=== L$i $($obj.role) ==="
      Write-Host ($text.Substring(0, [Math]::Min(500, $text.Length)))
      Write-Host "---"
    }
  } catch {}
}