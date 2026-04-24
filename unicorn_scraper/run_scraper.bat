@echo off
title Unicorn Auctions Scraper
cd /d "%~dp0"
echo.
echo  Unicorn Auctions Whiskey Bargain Scraper
echo  ==========================================
echo.
python scraper.py --now
echo.
echo  Done! Press any key to close.
pause > nul
