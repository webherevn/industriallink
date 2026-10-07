$path = "C:\Users\hi\.cursor\projects\c-Users-hi-Projects-industriallink\agent-transcripts\886c5266-6b97-44b1-9d8f-813f6b519f99\886c5266-6b97-44b1-9d8f-813f6b519f99.jsonl"
Get-Content $path | ForEach-Object {
  try {
    $obj = $_ | ConvertFrom-Json
    $text = ""
    if ($obj.message.content -is [string]) { $text = $obj.message.content }
    elseif ($obj.message.content.text) { $text = $obj.message.content.text -join " " }
    elseif ($obj.message.content.result) { $text = "[TOOL RESULT] " + ($obj.message.content.result -join " ") }
    elseif ($obj.message.content.output) { $text = "[OUTPUT] " + $obj.message.content.output }
    if ($text -and $text.Length -gt 30) {
      Write-Host "=== $($obj.role) ==="
      Write-Host ($text.Substring(0, [Math]::Min(400, $text.Length)))
      Write-Host ""
    }
  } catch {}
}