@echo off
set PROCESS_PROFILE=WEB
cd /d D:\startup-backup\startup-new\startup\leadsync-backend
npx ts-node --transpile-only src/server.ts
