Set-Location "C:\Users\mitch\Documents\Whiskey Hunting"
$ErrorActionPreference = "Stop"

Write-Host "`n=== Step 1: git case-rename Public/sw.js -> public/sw.js ===" -ForegroundColor Cyan
git mv "Public/sw.js" "sw.js.tmp"
git mv "sw.js.tmp" "public/sw.js"
Write-Host "Done." -ForegroundColor Green

Write-Host "`n=== Step 2: Generate VAPID keys ===" -ForegroundColor Cyan
node generate-vapid.js
Write-Host "Done." -ForegroundColor Green

Write-Host "`n=== Step 3: Delete helper scripts ===" -ForegroundColor Cyan
git rm fix-push-setup.ps1
git rm generate-vapid.js
Write-Host "Done." -ForegroundColor Green

Write-Host "`n=== Step 4: Stage and commit ===" -ForegroundColor Cyan
git add -A
git commit -m "fix: rename Public/sw.js to public/ for Vercel case-sensitive FS, add VAPID keys, add SW timeout"
Write-Host "Done." -ForegroundColor Green

Write-Host "`n=== Step 5: Verify ===" -ForegroundColor Cyan
Write-Host "`n-- git log --oneline -3 --" -ForegroundColor Yellow
git log --oneline -3

Write-Host "`n-- .env.local (keys redacted) --" -ForegroundColor Yellow
if (Test-Path ".env.local") {
    Get-Content ".env.local" | ForEach-Object {
        if ($_ -match "^(\w+=)(.+)$") {
            "$($Matches[1])[REDACTED]"
        } else {
            $_
        }
    }
} else {
    Write-Host ".env.local not found!" -ForegroundColor Red
}

Write-Host "`n=== All done! ===" -ForegroundColor Green
