@echo off
rem MySQL console client with settings from mysql-connection.env
rem Usage: mysql-connect.cmd -Query "SELECT COUNT(*) FROM resources;"
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0mysql-connect.ps1" %*
