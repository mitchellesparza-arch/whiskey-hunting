# fix-push-setup.ps1
# Run once from the project root:  .\fix-push-setup.ps1
# Handles: Fix #1 (git mv Public/sw.js -> public/sw.js)
#          Fix #3 (generate VAPID keys -> .env.local)
# ---------------------------------------------------------------

Set-Location $PSScriptRoot

# ── Fix #1 ──────────────────────────────────────────────────────
Write-Host "`n[Fix #1] Renaming Public/sw.js -> public/sw.js via git mv..." -ForegroundColor Cyan

# Two-step rename so git tracks the case-only change on Windows
git mv "Public/sw.js" "sw.js.tmp"
git mv "sw.js.tmp" "public/sw.js"

Write-Host "  Done. Run 'git status' to confirm rename is staged." -ForegroundColor Green

# ── Fix #3 ──────────────────────────────────────────────────────
Write-Host "`n[Fix #3] Generating VAPID keys via node generate-vapid.js..." -ForegroundColor Cyan
node generate-vapid.js

Write-Host "`nAll done! Next steps:" -ForegroundColor Yellow
Write-Host "  1. git add -A && git commit -m 'fix: rename Public/sw.js, add VAPID keys placeholder'"
Write-Host "  2. In Vercel dashboard -> Settings -> Environment Variables, add:"
Write-Host "       VAPID_PUBLIC_KEY"
Write-Host "       VAPID_PRIVATE_KEY"
Write-Host "       VAPID_SUBJECT=mailto:mitchell.esparza@gmail.com"
Write-Host "     (copy the values from .env.local)"
