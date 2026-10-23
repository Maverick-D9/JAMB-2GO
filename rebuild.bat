@echo off
title JAMB-2-GO Royal Rebuild + Auto Start
echo.
echo 👑 ROYAL REBUILD STARTING...
echo Path: %CD%
echo.

echo [1/3] Installing backend...
call npm install
if errorlevel 1 (
  echo ❌ Backend install failed!
  pause
  exit /b 1
)

echo.
echo [2/3] Installing frontend...
cd client
call npm install
if errorlevel 1 (
  echo ❌ Frontend install failed!
  pause
  exit /b 1
)
cd ..

echo.
echo [3/3] Building frontend (vite build)...
cd client
call npm run build
if errorlevel 1 (
  echo ❌ Build failed!
  pause
  exit /b 1
)
cd ..

echo.
echo 🧹 Cleaning broken attempts...
node -e "const fs=require('fs'); const paths=['cbt-results.json','cbt_results.json','server/cbt-results.json']; paths.forEach(p=>{ if(fs.existsSync(p)){ let d=JSON.parse(fs.readFileSync(p,'utf8')); let c=d.filter(r=>r.questionsSnapshot&&Object.keys(r.questionsSnapshot).length>0); if(c.length!==d.length){ fs.writeFileSync(p,JSON.stringify(c,null,2)); console.log('Cleaned '+(d.length-c.length)+' in '+p); } } })"

echo.
echo ✅ REBUILD DONE!
echo.
echo Starting dev servers...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
echo.
call npm run dev

pause