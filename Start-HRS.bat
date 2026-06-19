@echo off
REM Launches the Hawaii Revised Statutes searchable site in your browser.
cd /d "%~dp0"
echo Starting local server for the HRS site...
start "" http://localhost:8777/
python -m http.server 8777
