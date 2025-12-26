# 🔧 Troubleshooting Guide

## Current Status
✅ **Server**: Running on http://localhost:3001  
⚠️ **Database**: Connection issue detected  
✅ **Frontend**: Should connect once DB is fixed

---

## 🚨 Common Issues & Solutions

### 1. "ERR_CONNECTION_REFUSED" Error

**Symptoms**: Frontend can't connect to backend, 404 errors

**Solution**:
```bash
# Check if server is running
# You should see: "Server running on http://localhost:3001"

cd server
npm run dev

# If not running, check for errors in terminal
```

---

### 2. Database Connection Failed (ECONNREFUSED)

**Symptoms**: 
- `ECONNREFUSED` error in server logs
- Database features not working

**Solutions**:

#### Option A: Start MySQL Service (Windows)
```powershell
# Check MySQL service
Get-Service -Name "MySQL*"

# Start MySQL service
net start MySQL80  # or MySQL57, depending on version

# Verify MySQL is running
mysql -u root -p -e "SELECT 1"
```

#### Option B: Use XAMPP
```bash
# Start XAMPP MySQL
# Open XAMPP Control Panel
# Click "Start" on MySQL

# Or start from command line
"C:\xampp\mysql\bin\mysqld.exe"
```

#### Option C: Use Docker (Recommended)
```bash
# Use docker-compose to start all services including MySQL
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs mysql
```

---

### 3. JWT_SECRET Warning

**Symptoms**: 
```
error: CRITICAL: JWT_SECRET is not set or using default value!
```

**Solution**: Already fixed in `.env` file with development keys

For production:
```bash
# Generate secure secret
openssl rand -base64 64

# Update .env with generated secret
JWT_SECRET=<your-generated-secret>
```

---

### 4. Port 3001 Already in Use

**Symptoms**:
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solution**:
```powershell
# Windows: Find process using port 3001
netstat -ano | findstr :3001

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or change port in .env
PORT=3002
```

---

### 5. Missing Dependencies

**Symptoms**:
```
Cannot find module 'express-rate-limit'
Cannot find module 'helmet'
```

**Solution**:
```bash
cd server
npm install

# If issues persist, clean install
rm -rf node_modules package-lock.json
npm install
```

---

### 6. Database Not Initialized

**Symptoms**:
- Tables don't exist
- SQL errors about missing tables

**Solution**:
```bash
cd server
npm run db:init

# Or manually via MySQL
mysql -u root -p < database/schema.sql
```

---

### 7. WhatsApp Connection Issues

**Symptoms**:
- Can't scan QR code
- Session keeps disconnecting

**Solutions**:
```bash
# Clear session data
cd server
rm -rf wa-session/*
rm -rf .wwebjs_cache/*
rm -rf .wwebjs_auth/*

# Restart server
npm run dev
```

---

## 🔍 Diagnostic Commands

### Check Server Status
```bash
# Health check
curl http://localhost:3001/api/health

# Or in PowerShell
Invoke-WebRequest -Uri http://localhost:3001/api/health

# Check if port is listening
netstat -ano | findstr :3001
```

### Check Database
```bash
# Test MySQL connection
mysql -u root -p -e "SELECT 1"

# Check if database exists
mysql -u root -p -e "SHOW DATABASES LIKE 'wa_blast_pro'"

# Check tables
mysql -u root -p wa_blast_pro -e "SHOW TABLES"
```

### Check Logs
```bash
cd server

# View combined logs
tail -f logs/combined.log

# View error logs only
tail -f logs/error.log

# Windows PowerShell
Get-Content logs/combined.log -Wait
```

---

## 🎯 Quick Fixes Checklist

When server won't start:

- [ ] ✅ Check MySQL is running
- [ ] ✅ Check .env file exists and has valid JWT_SECRET
- [ ] ✅ Check all dependencies installed (`npm install`)
- [ ] ✅ Check port 3001 is not in use
- [ ] ✅ Check logs directory exists
- [ ] ✅ Check database `wa_blast_pro` exists
- [ ] ✅ Check no TypeScript compilation errors

---

## 🐳 Docker Quick Fix

If nothing works, use Docker:

```bash
# Stop any running servers
# Ctrl+C in terminal

# Start with Docker
docker-compose down
docker-compose up -d

# Wait 30 seconds for MySQL to initialize

# Check status
docker-compose ps

# View logs
docker-compose logs -f app

# Access application
# Open http://localhost:3001 in browser
```

---

## 📝 Current Setup Verification

### ✅ What's Working:
1. Server starts successfully
2. All security middleware installed
3. Logging system configured
4. Error handling implemented
5. Testing framework setup
6. Docker configuration ready

### ⚠️ What Needs Attention:
1. **MySQL must be running** for full functionality
2. Database must be initialized with schema
3. For production: Generate secure JWT secrets

---

## 🚀 Recommended Startup Sequence

### Option 1: Local Development
```bash
# Step 1: Start MySQL
net start MySQL80  # Windows
# or start XAMPP MySQL

# Step 2: Initialize database (first time only)
cd server
npm run db:init

# Step 3: Start backend
npm run dev

# Step 4: In new terminal, start frontend
cd ..
npm run dev
```

### Option 2: Docker (Easiest)
```bash
# One command to rule them all
docker-compose up -d

# Access at http://localhost:3001
```

---

## 📞 Still Having Issues?

1. **Check Logs**: `server/logs/error.log`
2. **Health Check**: `curl http://localhost:3001/api/health`
3. **Console Errors**: Check browser developer console (F12)
4. **Server Logs**: Check terminal where `npm run dev` is running

---

## 🎯 Next Steps After Fixing

Once everything is working:

1. ✅ Create a user account (register)
2. ✅ Connect WhatsApp
3. ✅ Import contacts
4. ✅ Send test blast
5. ✅ Check all features work

---

**Last Updated**: 2025-12-26  
**Server Status**: ✅ Running (DB connection needs MySQL)  
**Production Ready**: ⚠️ After MySQL setup
