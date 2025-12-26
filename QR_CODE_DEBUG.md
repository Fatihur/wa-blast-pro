# 🔍 QR Code Not Showing - Debug Guide

## Problem
QR code stuck on loading, tidak tampil di ConnectionView

## Common Causes & Solutions

### 1. WhatsApp Client Not Initialized
**Check server logs** untuk error messages

**Solution**: Restart WhatsApp session
```bash
# Stop server
Ctrl+C

# Clear WhatsApp cache
cd server
rm -rf wa-session/*
rm -rf .wwebjs_cache/*
rm -rf .wwebjs_auth/*

# Restart server
npm run dev
```

### 2. Socket.IO Connection Issue
**Check browser console** (F12) untuk WebSocket errors

**Solution**: Verify socket connection
```javascript
// Check in browser console:
// Should see socket.io connected message
```

### 3. Chromium Download Issue
WhatsApp-web.js needs Chromium to generate QR

**Check server logs** for:
```
Downloading Chromium...
ERROR: Failed to download Chromium
```

**Solution**: Manual Chromium setup or use system Chrome

### 4. Port/Firewall Blocking
Port 3001 might be blocked

**Test**:
```bash
curl http://localhost:3001/api/whatsapp/status
```

### 5. Session Already Exists
Old session might be blocking new QR

**Solution**: Force logout first
```bash
# Via API or clear session files
rm -rf server/wa-session/*
```

---

## 🔧 Quick Debug Steps

### Step 1: Check Server Logs
Look for these messages in terminal:
```
✅ Good signs:
- "WhatsApp client initializing"
- "QR Code received"
- "Socket.IO client connected"

❌ Bad signs:
- "Failed to initialize"
- "Chromium download error"
- "Timeout waiting"
- Error stack traces
```

### Step 2: Check Browser Console
Open DevTools (F12) and look for:
```
✅ Good:
- "Connected to socket"
- Receiving whatsapp_qr event

❌ Bad:
- WebSocket connection failed
- 404 errors on /socket.io/
- QR event not received
```

### Step 3: Check Network Tab
In browser DevTools > Network:
```
✅ Should see:
- POST /api/whatsapp/connect (200 OK)
- WebSocket upgrade (101 Switching Protocols)
- Socket.IO polling/websocket active

❌ Problems:
- 500 errors
- Connection refused
- Timeout
```

### Step 4: Test API Directly
```bash
# Check if WhatsApp route works
curl -X POST http://localhost:3001/api/whatsapp/connect \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Should return: { "success": true, "message": "..." }
```

---

## 🚀 Quick Fix (Try in Order)

### Fix 1: Clean Restart
```bash
# Terminal 1 - Stop server (Ctrl+C)
cd D:/PROYEK/wa-blast-pro/server

# Clean WhatsApp data
rm -rf wa-session
rm -rf .wwebjs_cache
rm -rf .wwebjs_auth

# Restart
npm run dev
```

### Fix 2: Check Authentication
Make sure you're logged in:
```javascript
// Browser console
localStorage.getItem('authToken')
// Should return a token, not null
```

### Fix 3: Use Pairing Code Instead
If QR keeps failing, try phone number pairing:
```
1. Click "Use Phone Number" option
2. Enter your WhatsApp number
3. Get 8-digit pairing code
4. Enter in WhatsApp app
```

### Fix 4: Check Chrome/Chromium
WhatsApp-web.js requires Chrome/Chromium:
```bash
# Windows - Check if Chrome is installed
where chrome

# Should find Chrome in Program Files
```

---

## 🔍 Advanced Debugging

### Enable Verbose Logging
Add to `server/.env`:
```env
LOG_LEVEL=debug
```

Restart server, you'll see detailed logs.

### Check Session Manager
Add console.logs to debug:
```typescript
// In whatsappSessionManager.ts
session.client.on('qr', async (qr: string) => {
  console.log('🔍 QR Code received, length:', qr.length);
  console.log('🔍 Generating QR image...');
  // ... rest of code
});
```

### Monitor Socket.IO Events
In browser console:
```javascript
// Check if socket is connected
window.socket?.connected

// Listen for QR event manually
window.socket?.on('whatsapp_qr', (data) => {
  console.log('QR received:', data);
});
```

---

## 📊 Expected Flow

### Normal QR Code Flow:
1. ✅ User clicks "Connect WhatsApp"
2. ✅ Frontend sends POST /api/whatsapp/connect
3. ✅ Backend initializes WhatsApp client
4. ✅ Chromium launches (headless)
5. ✅ WhatsApp Web loads
6. ✅ QR code generated
7. ✅ QR emitted via Socket.IO
8. ✅ Frontend receives QR event
9. ✅ QR displays in UI
10. ✅ User scans with phone
11. ✅ Connection established

### If Stuck at Loading:
- ❌ Flow stopped between steps 3-7
- Check server logs for exact error
- Usually Chromium or session issue

---

## 🐛 Common Error Messages

### "Failed to launch browser"
```
Solution: Install Google Chrome
Or set CHROME_PATH in .env
```

### "Timeout waiting for QR"
```
Solution: Clear sessions and retry
rm -rf wa-session/*
```

### "Session already exists"
```
Solution: Disconnect first or clear session
```

### "WebSocket connection failed"
```
Solution: Check if port 3001 is open
Check CORS settings in server
```

---

## 🎯 Most Common Fix

**90% of QR issues solved by:**
```bash
# Stop server (Ctrl+C)
cd server

# Nuclear option - clean everything
rm -rf wa-session
rm -rf .wwebjs_cache
rm -rf .wwebjs_auth
rm -rf node_modules/.cache

# Restart
npm run dev

# Try connecting again
# Wait 30 seconds for Chromium to download if first time
```

---

## 📝 Checklist

Before reporting issue, verify:
- [ ] Server is running without errors
- [ ] You're logged in (have auth token)
- [ ] Socket.IO connected (check console)
- [ ] No 429 rate limit errors (check Network tab)
- [ ] Chrome/Chromium available on system
- [ ] Tried cleaning wa-session directory
- [ ] Waited at least 30 seconds (first-time Chromium download)
- [ ] Checked server logs for errors
- [ ] Checked browser console for errors

---

## 🆘 Still Not Working?

1. **Share Server Logs**
   - Copy last 50 lines from terminal
   - Look for ERROR or WARN messages

2. **Share Browser Console**
   - Open DevTools (F12)
   - Copy any errors in Console tab

3. **Check These Files Exist**
   ```
   server/node_modules/whatsapp-web.js/
   server/wa-session/
   ```

4. **Try Alternative Method**
   - Use pairing code instead of QR
   - More reliable on some systems

---

**Next Step**: Try Fix 1 (Clean Restart) first! 🔄
