# 🔧 Panduan Troubleshooting

## 📋 Daftar Isi

1. [Masalah Container](#masalah-container)
2. [Masalah Database](#masalah-database)
3. [Masalah Nginx & SSL](#masalah-nginx--ssl)
4. [Masalah WhatsApp](#masalah-whatsapp)
5. [Masalah Performa](#masalah-performa)
6. [Masalah Network](#masalah-network)
7. [Perintah Diagnostic](#perintah-diagnostic)

---

## Masalah Container

### Container Tidak Mau Start

**Gejala**: Container exit setelah start

**Diagnostic**:
```bash
# Cek logs container
docker-compose logs app

# Cek status
docker-compose ps

# Cek resource
docker stats
```

**Solusi**:

**1. Port Sudah Digunakan**
```bash
# Cek port 3001
netstat -tlnp | grep 3001

# Jika ada, kill process
kill -9 <PID>

# Atau ganti port di .env
PORT=3002
```

**2. Permission Issues**
```bash
# Fix permissions
chown -R www:www /www/wwwroot/wa-blast-pro

# Cek permission wa-session folder
ls -la /www/wwwroot/wa-blast-pro/server/wa-session
chmod -R 755 /www/wwwroot/wa-blast-pro/server/wa-session
```

**3. Environment Variables Salah**
```bash
# Verifikasi .env file ada
ls -la /www/wwwroot/wa-blast-pro/server/.env

# Cek isi .env
cat /www/wwwroot/wa-blast-pro/server/.env

# Pastikan semua variable terisi
```

**4. Rebuild dari Awal**
```bash
# Stop dan remove semua
docker-compose down -v

# Clean Docker
docker system prune -af

# Rebuild
docker-compose build --no-cache
docker-compose up -d
```

---

### Container Terus Restart

**Gejala**: Container restart loop

**Diagnostic**:
```bash
# Cek restart count
docker ps -a

# Cek logs untuk error
docker-compose logs --tail=100 app
```

**Solusi**:

**1. Database Connection Failed**
```bash
# Verifikasi MySQL running
docker-compose ps mysql

# Cek DB credentials di .env
DB_HOST=mysql
DB_USER=wa_blast_user
DB_PASSWORD=<password_yang_benar>

# Restart MySQL
docker-compose restart mysql
```

**2. Out of Memory**
```bash
# Cek memory usage
free -h
docker stats

# Tambah memory limit di docker-compose.yml
deploy:
  resources:
    limits:
      memory: 1G
```

**3. Missing Dependencies**
```bash
# Rebuild dengan dependencies
docker-compose build --no-cache app
docker-compose up -d
```

---

## Masalah Database

### Database Connection Failed

**Gejala**: `ECONNREFUSED` atau `ER_ACCESS_DENIED_ERROR`

**Diagnostic**:
```bash
# Tes koneksi MySQL
docker exec -it wa-blast-mysql mysql -u root -p

# Cek user dan permissions
SHOW GRANTS FOR 'wa_blast_user'@'%';
```

**Solusi**:

**1. User Tidak Ada atau Permission Salah**
```sql
-- Login sebagai root
mysql -u root -p

-- Buat user jika belum ada
CREATE USER IF NOT EXISTS 'wa_blast_user'@'%' IDENTIFIED BY 'PASSWORD_ANDA';

-- Berikan permissions
GRANT ALL PRIVILEGES ON wa_blast_pro.* TO 'wa_blast_user'@'%';
FLUSH PRIVILEGES;
```

**2. Password Salah di .env**
```bash
# Verifikasi password di .env match dengan database
nano /www/wwwroot/wa-blast-pro/server/.env

# Update DB_PASSWORD
DB_PASSWORD=password_yang_benar
```

**3. Database Belum Ada**
```sql
-- Cek databases
SHOW DATABASES;

-- Buat database jika belum ada
CREATE DATABASE IF NOT EXISTS wa_blast_pro;
```

---

### Tables Tidak Ada

**Gejala**: Error `Table 'wa_blast_pro.users' doesn't exist`

**Solusi**:

**1. Jalankan Schema SQL**
```bash
# Copy schema ke container
docker cp server/database/schema.sql wa-blast-mysql:/tmp/

# Jalankan schema
docker exec -it wa-blast-mysql mysql -u root -p wa_blast_pro < /tmp/schema.sql
```

**2. Atau Manual via MySQL**
```bash
docker exec -it wa-blast-mysql mysql -u root -p

USE wa_blast_pro;
SOURCE /docker-entrypoint-initdb.d/schema.sql;
SHOW TABLES;
```

---

## Masalah Nginx & SSL

### 502 Bad Gateway

**Gejala**: Nginx menampilkan 502 error

**Diagnostic**:
```bash
# Cek Nginx logs
tail -f /var/log/nginx/error.log

# Cek apakah app running
curl http://localhost:3001/api/health

# Cek Nginx config
nginx -t
```

**Solusi**:

**1. App Tidak Running**
```bash
# Start app
docker-compose up -d app

# Verifikasi app listening
netstat -tlnp | grep 3001
```

**2. Nginx Config Salah**
```bash
# Tes config
nginx -t

# Jika error, fix config di:
nano /www/wwwroot/server_config/vhost/domain-anda.com.conf

# Reload nginx
systemctl reload nginx
```

**3. Firewall Blocking**
```bash
# Allow port
ufw allow 80
ufw allow 443

# Cek status
ufw status
```

---

### SSL Certificate Error

**Gejala**: Browser menampilkan SSL warning

**Diagnostic**:
```bash
# Cek certificate
openssl s_client -connect domain-anda.com:443

# Cek expiry
echo | openssl s_client -servername domain-anda.com -connect domain-anda.com:443 2>/dev/null | openssl x509 -noout -dates
```

**Solusi**:

**1. Certificate Expired**
```bash
# Renew manual
certbot renew --force-renewal

# Atau via aaPanel
# Website → Domain → SSL → Renew
```

**2. Wrong Domain**
```bash
# Generate ulang untuk domain yang benar
certbot certonly --nginx -d domain-anda.com -d www.domain-anda.com
```

**3. Certificate Path Salah di Nginx**
```nginx
# Edit nginx config
ssl_certificate /path/to/correct/fullchain.pem;
ssl_certificate_key /path/to/correct/privkey.pem;
```

---

## Masalah WhatsApp

### QR Code Tidak Muncul

**Gejala**: Loading terus, QR tidak tampil

**Diagnostic**:
```bash
# Cek logs app untuk WhatsApp initialization
docker-compose logs -f app | grep -i whatsapp

# Cek apakah ada session lama
ls -la /www/wwwroot/wa-blast-pro/server/wa-session/
```

**Solusi**:

**1. Session Lama Blocking**
```bash
# Stop app
docker-compose stop app

# Clean sessions
rm -rf /www/wwwroot/wa-blast-pro/server/wa-session/*
rm -rf /www/wwwroot/wa-blast-pro/server/.wwebjs_cache/*

# Restart
docker-compose start app
```

**2. Chromium Download Gagal**
```bash
# Cek logs untuk download errors
docker-compose logs app | grep -i chromium

# Cek disk space
df -h

# Jika space cukup, tunggu lebih lama (bisa 60+ detik first time)
```

**3. Multiple Node Processes**
```bash
# Cek running processes
ps aux | grep node

# Kill all node
pkill -f node

# Restart single instance
docker-compose restart app
```

---

### WhatsApp Disconnect Terus

**Gejala**: Connection established tapi cepat disconnect

**Solusi**:

**1. Session Corrupt**
```bash
# Logout dan clear session
docker-compose exec app rm -rf /app/wa-session/*
docker-compose restart app
```

**2. Memory Insufficient**
```bash
# Cek memory
free -h

# Increase Docker memory limit
# Edit docker-compose.yml
deploy:
  resources:
    limits:
      memory: 2G
```

**3. Network Issues**
```bash
# Cek network connectivity
ping 8.8.8.8

# Check DNS
nslookup web.whatsapp.com

# Restart networking
systemctl restart networking
```

---

## Masalah Performa

### Response Time Lambat

**Gejala**: API response > 1 detik

**Diagnostic**:
```bash
# Test response time
curl -o /dev/null -s -w 'Total: %{time_total}s\n' https://domain-anda.com/api/health

# Cek load
top
htop
```

**Solusi**:

**1. Database Queries Lambat**
```sql
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;

-- Check slow queries
SELECT * FROM mysql.slow_log;

-- Add indexes
CREATE INDEX idx_user_id ON contacts(user_id);
CREATE INDEX idx_status ON blast_jobs(status);
```

**2. Memory Swap**
```bash
# Cek swap usage
free -h

# Disable swap (jika tidak perlu)
swapoff -a

# Increase RAM
# Upgrade VPS plan
```

**3. CPU Bottleneck**
```bash
# Cek CPU usage
top

# Scale horizontal (multiple instances)
# Atau vertical (upgrade CPU)
```

---

### High Memory Usage

**Gejala**: Memory > 80%

**Diagnostic**:
```bash
# Cek memory per container
docker stats

# Cek system memory
free -h
```

**Solusi**:

**1. Memory Leak di App**
```bash
# Restart app
docker-compose restart app

# Monitor untuk leak
docker stats app
```

**2. Batas Memory Terlalu Tinggi**
```yaml
# Edit docker-compose.yml
deploy:
  resources:
    limits:
      memory: 1G  # Adjust sesuai kebutuhan
```

**3. Redis Memory**
```bash
# Set maxmemory di Redis
docker exec -it wa-blast-redis redis-cli -a PASSWORD

CONFIG SET maxmemory 256mb
CONFIG SET maxmemory-policy allkeys-lru
```

---

## Masalah Network

### Can't Access From Internet

**Gejala**: Site tidak bisa diakses dari luar

**Diagnostic**:
```bash
# Tes dari luar
curl -I https://domain-anda.com

# Cek DNS
nslookup domain-anda.com

# Cek firewall
ufw status
```

**Solusi**:

**1. DNS Belum Propagasi**
```bash
# Tunggu propagasi (bisa 24-48 jam)
# Cek propagasi: https://www.whatsmydns.net/

# Atau flush DNS lokal
ipconfig /flushdns  # Windows
sudo systemd-resolve --flush-caches  # Linux
```

**2. Firewall Blocking**
```bash
# Open ports
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload
```

**3. CloudFlare/CDN Issues**
```bash
# Jika pakai CloudFlare, pastikan:
# - DNS proxied (orange cloud)
# - SSL/TLS mode: Full
# - Always Use HTTPS: On
```

---

### Socket.IO Connection Failed

**Gejala**: WebSocket tidak connect

**Diagnostic**:
```javascript
// Browser console
console.log(window.socket?.connected);
```

**Solusi**:

**1. Nginx WebSocket Config**
```nginx
# Pastikan ada di nginx config
location /socket.io {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

**2. CORS Issue**
```bash
# Update ALLOWED_ORIGINS di .env
ALLOWED_ORIGINS=https://domain-anda.com,https://www.domain-anda.com
```

**3. CloudFlare WebSocket**
```bash
# Di CloudFlare dashboard:
# Network → WebSockets → Enable
```

---

## Perintah Diagnostic

### Diagnostic Lengkap

```bash
#!/bin/bash
echo "=== WA-Blast-Pro Diagnostic ==="
echo ""

echo "1. Docker Status:"
docker-compose ps
echo ""

echo "2. Disk Space:"
df -h | grep -E '^/dev|Filesystem'
echo ""

echo "3. Memory Usage:"
free -h
echo ""

echo "4. CPU Load:"
uptime
echo ""

echo "5. App Health:"
curl -s http://localhost:3001/api/health | jq
echo ""

echo "6. Database Connection:"
docker exec wa-blast-mysql mysqladmin -u root -p ping
echo ""

echo "7. Recent Logs (last 20 lines):"
docker-compose logs --tail=20 app
echo ""

echo "8. Nginx Status:"
systemctl status nginx | grep -E 'Active|Loaded'
echo ""

echo "9. Network Ports:"
netstat -tlnp | grep -E '3001|3306|6379|80|443'
echo ""

echo "10. SSL Certificate:"
echo | openssl s_client -servername domain-anda.com -connect domain-anda.com:443 2>/dev/null | openssl x509 -noout -dates
```

**Simpan sebagai** `/root/diagnose.sh` dan jalankan:
```bash
chmod +x /root/diagnose.sh
/root/diagnose.sh
```

---

### Quick Health Check

```bash
# One-liner health check
curl -s http://localhost:3001/api/health | jq '.status' && docker-compose ps && free -h | grep Mem
```

---

## 🆘 Masih Bermasalah?

Jika semua solusi di atas tidak berhasil:

1. **Kumpulkan Info**:
   ```bash
   # Run diagnostic
   /root/diagnose.sh > /tmp/diagnostic.txt
   
   # Kumpulkan logs
   docker-compose logs > /tmp/app_logs.txt
   tail -100 /var/log/nginx/error.log > /tmp/nginx_error.log
   ```

2. **Cek GitHub Issues**: Lihat apakah ada yang mengalami masalah serupa

3. **Buat Issue Baru**: Dengan melampirkan:
   - Output diagnostic
   - Logs yang relevan
   - Langkah-langkah untuk reproduce masalah
   - Environment details (OS, Docker version, dll)

---

## 📞 Kontak Support

- **GitHub Issues**: [Repository Anda]/issues
- **Email**: support@domain-anda.com
- **Forum**: aaPanel Community Forum

---

**Terakhir Diupdate**: 26 Desember 2025
