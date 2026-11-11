# Retro Racer - tiny local web server (no installs needed).
# Serves this folder at http://localhost:8080/ and opens the browser.
# Close this window to stop the server.
param(
  [int]$Port = 8080,
  [switch]$NoBrowser
)

$root = [IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path)).TrimEnd('\') + '\'
$prefix = "http://localhost:$Port/"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.md'   = 'text/plain; charset=utf-8'
  '.png'  = 'image/png'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.wav'  = 'audio/wav'
  '.mp3'  = 'audio/mpeg'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Could not start the server on port $Port." -ForegroundColor Red
  Write-Host "It may already be running - try opening $prefix in your browser." -ForegroundColor Yellow
  Write-Host $_.Exception.Message
  if (-not $NoBrowser) { Start-Process $prefix; Start-Sleep -Seconds 8 }
  exit 1
}

$Host.UI.RawUI.WindowTitle = "Retro Racer server - $prefix"
Write-Host ""
Write-Host "  RETRO RACER is running at $prefix" -ForegroundColor Green
Write-Host "  Close this window to stop the game server." -ForegroundColor Gray
Write-Host ""
if (-not $NoBrowser) { Start-Process $prefix }

while ($listener.IsListening) {
  try { $context = $listener.GetContext() } catch { break }
  $request = $context.Request
  $response = $context.Response
  try {
    $rel = [Uri]::UnescapeDataString($request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '') { $rel = 'index.html' }
    $full = [IO.Path]::GetFullPath((Join-Path $root $rel))
    if ($full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($full)
      $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
      if ($mime.ContainsKey($ext)) { $response.ContentType = $mime[$ext] } else { $response.ContentType = 'application/octet-stream' }
      $response.StatusCode = 200
    } else {
      $bytes = [Text.Encoding]::UTF8.GetBytes('Not found')
      $response.ContentType = 'text/plain; charset=utf-8'
      $response.StatusCode = 404
    }
    $response.Headers.Add('Cache-Control', 'no-cache')
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    Write-Host "Request error: $($_.Exception.Message)" -ForegroundColor DarkYellow
  } finally {
    $response.Close()
  }
}
$listener.Close()
