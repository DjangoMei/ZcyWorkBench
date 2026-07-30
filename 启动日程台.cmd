@echo off
chcp 65001 > nul
cd /d "%~dp0"
title 我的日程台
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0日程台服务.ps1" -OpenBrowser
if errorlevel 1 (
  echo 日程台启动失败，请把“个人资料库\运行日志”里的错误信息发给我。
  pause
)
