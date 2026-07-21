@echo off
echo Launching LLM Bench...
if exist "dist\LLM Bench Setup 0.2.0.exe" (
  "dist\LLM Bench Setup 0.2.0.exe"
) else if exist "dist\LLM Bench 0.2.0.exe" (
  "dist\LLM Bench 0.2.0.exe"
) else (
  echo Executable not found. Checking available files...
  dir dist\*.exe
)
