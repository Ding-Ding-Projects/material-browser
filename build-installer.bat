@echo off
setlocal
call "%~dp0build.bat" -Component All
if errorlevel 1 exit /b %errorlevel%
pushd "%~dp0apps\desktop"
call npm.cmd run make
set "BUILD_RESULT=%errorlevel%"
popd
exit /b %BUILD_RESULT%
