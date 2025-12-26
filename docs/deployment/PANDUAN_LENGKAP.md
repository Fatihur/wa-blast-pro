# 🚀 Panduan Deployment Lengkap - WA-Blast-Pro dengan aaPanel

## 📋 Daftar Isi

1. [Kebutuhan](#kebutuhan)
2. [Setup Server (aaPanel)](#setup-server-aapanel)
3. [Instalasi Docker](#instalasi-docker)
4. [Setup Project](#setup-project)
5. [Konfigurasi Environment](#konfigurasi-environment)
6. [Setup Database](#setup-database)
7. [Deployment Docker](#deployment-docker)
8. [Setup Domain & SSL](#setup-domain--ssl)
9. [CI/CD dengan GitHub Actions](#cicd-dengan-github-actions)
10. [Monitoring & Maintenance](#monitoring--maintenance)
11. [Troubleshooting](#troubleshooting)

---

## Kebutuhan

### Spesifikasi Server
- **OS**: Ubuntu 20.04 LTS atau lebih baru (recommended)
- **RAM**: Minimal 2GB, Rekomendasi 4GB+
- **Storage**: Minimal 20GB SSD
- **CPU**: 2 cores minimum
- **aaPanel**: Versi 6.8 atau lebih baru

### Domain & DNS
- Nama domain (contoh: `wa-blast.domain-anda.com`)
- DNS dikonfigurasi mengarah ke IP server

### Tools yang Dibutuhkan
- SSH client (PuTTY, Terminal, dll)
- Akun GitHub
- Akun Docker Hub (optional)

---

## Setup Server (aaPanel)

### Langkah 1: Install aaPanel

Koneksi ke server via SSH:
```bash
ssh root@ip-server-anda
```

Install aaPanel:
```bash
# Untuk Ubuntu/Debian
URL=https://www.aapanel.com/script/install-ubuntu_6.0_en.sh && sudo bash <(curl -fsSL $URL)

# Untuk CentOS
URL=https://www.aapanel.com/script/install_6.0_en.sh && sudo bash <(curl -fsSL $URL)
```

**Tunggu 5-10 menit** sampai instalasi selesai.

Setelah instalasi, Anda akan melihat:
```
==================================================================
aaPanel default info:
==================================================================
Outer panel address: http://IP_ANDA:7800/xxxxxx
username: xxxxxxx
password: xxxxxxxx
==================================================================
```

**⚠️ PENTING**: Simpan credentials ini!

### Langkah 2: Konfigurasi Awal aaPanel

1. **Akses aaPanel**: Buka `http://IP_ANDA:7800` di browser
2. **Login** dengan credentials dari instalasi
3. **Pilih software**:
   - ✅ Nginx 1.22+
   - ✅ MySQL 8.0
   - ✅ PHP 8.1+ (jika diperlukan untuk project lain)
   - ✅ Redis 7.0+
   - ⚠️ Jangan install Apache (konflik dengan Nginx)

4. **Keamanan**:
   - Pergi ke **Panel** → **Security**
   - Ganti port default (7800 → custom)
   - Ganti username/password default
   - Aktifkan 2FA jika tersedia

---

## Instalasi Docker

### Opsi 1: Via aaPanel (Recommended)

1. **Buka aaPanel** → **App Store**
2. **Cari** "Docker Manager"
3. **Klik Install**
4. **Tunggu** instalasi (~5 menit)
5. **Verifikasi**: App Store → Installed

### Opsi 2: Instalasi Manual

Jika Docker Manager tidak tersedia di aaPanel:

```bash
# SSH ke server
ssh root@ip-server-anda

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Tambah user ke docker group
sudo usermod -aG docker $USER

# Verifikasi instalasi
docker --version
docker-compose --version
```

**Output yang diharapkan**:
```
Docker version 24.0.x
docker-compose version 2.x.x
```

---

## Setup Project

### Langkah 1: Buat Direktori Project

```bash
# SSH ke server
ssh root@ip-server-anda

# Buat direktori project
mkdir -p /www/wwwroot/wa-blast-pro
cd /www/wwwroot/wa-blast-pro

# Set permission yang tepat
chown -R www:www /www/wwwroot/wa-blast-pro
```

### Langkah 2: Clone Repository

**Opsi A: Via Git (Repo Public)**
```bash
cd /www/wwwroot/wa-blast-pro
git clone https://github.com/USERNAME_ANDA/wa-blast-pro.git .
```

**Opsi B: Upload Files (Private/Tanpa Git)**
1. Compress project lokal: `wa-blast-pro.zip`
2. Upload via aaPanel **Files** manager
3. Extract ke `/www/wwwroot/wa-blast-pro/`

**Opsi C: Via SCP/SFTP**
```bash
# Dari komputer lokal
scp -r D:/PROYEK/wa-blast-pro/* root@ip-server-anda:/www/wwwroot/wa-blast-pro/
```

### Langkah 3: Verifikasi Files

```bash
cd /www/wwwroot/wa-blast-pro
ls -la

# Harus ada:
# - Dockerfile
# - docker-compose.yml
# - server/
# - dist/ atau source files
# - package.json
```

---

## Konfigurasi Environment

### Langkah 1: Buat Production .env

```bash
cd /www/wwwroot/wa-blast-pro/server
nano .env
```

**Production .env**:
```env
# MySQL Database
DB_HOST=mysql
DB_PORT=3306
DB_USER=wa_blast_user
DB_PASSWORD=GANTI_PASSWORD_KUAT_ANDA_123!@#
DB_NAME=wa_blast_pro

# Server
PORT=3001
NODE_ENV=production

# JWT Secrets (WAJIB DIGANTI!)
JWT_SECRET=GENERATE_SECRET_64_KARAKTER_DENGAN_OPENSSL
JWT_REFRESH_SECRET=GENERATE_SECRET_64_KARAKTER_LAGI
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
PASSWORD_PEPPER=GENERATE_PEPPER_SECRET_48_KARAKTER

# CORS (Domain Anda)
ALLOWED_ORIGINS=https://domain-anda.com,https://www.domain-anda.com

# Rate Limiting (Production - Ketat)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=logs/

# Security
BCRYPT_ROUNDS=12
HELMET_ENABLED=true
ENABLE_HTTPS=true

# WhatsApp
WA_SESSION_PATH=./wa-session
WA_MAX_SESSIONS=10

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=GANTI_PASSWORD_REDIS_ANDA
```

### Langkah 2: Generate Secrets yang Aman

```bash
# Generate JWT_SECRET
openssl rand -base64 64 | tr -d '\n' && echo

# Generate JWT_REFRESH_SECRET
openssl rand -base64 64 | tr -d '\n' && echo

# Generate PASSWORD_PEPPER
openssl rand -base64 48 | tr -d '\n' && echo

# Copy dan paste ke .env
```

### Langkah 3: Update docker-compose.yml

```bash
cd /www/wwwroot/wa-blast-pro
nano docker-compose.yml
```

**Update dengan password Anda** di bagian:
- MYSQL_ROOT_PASSWORD
- MYSQL_PASSWORD  
- Redis requirepass

---

## Setup Database

Database akan auto-initialize via `schema.sql` di docker-compose.

Jika auto-init gagal, inisialisasi manual:

```bash
# Akses MySQL container
docker exec -it wa-blast-mysql bash

# Login ke MySQL
mysql -u root -p
# Masukkan root password

# Buat database dan user
CREATE DATABASE IF NOT EXISTS wa_blast_pro;
CREATE USER IF NOT EXISTS 'wa_blast_user'@'%' IDENTIFIED BY 'PASSWORD_ANDA';
GRANT ALL PRIVILEGES ON wa_blast_pro.* TO 'wa_blast_user'@'%';
FLUSH PRIVILEGES;
USE wa_blast_pro;

# Jalankan schema
SOURCE /docker-entrypoint-initdb.d/schema.sql;

# Verifikasi
SHOW TABLES;
EXIT;
```

---

## Deployment Docker

### Langkah 1: Build Images

```bash
cd /www/wwwroot/wa-blast-pro

# Build tanpa cache (pertama kali)
docker-compose build --no-cache

# Atau pull dan build
docker-compose build
```

**Output yang diharapkan**:
```
Building app
Step 1/15 : FROM node:18-alpine AS builder
...
Successfully built xxxxx
Successfully tagged wa-blast-pro_app:latest
```

### Langkah 2: Start Services

```bash
# Start semua services
docker-compose up -d

# Cek status
docker-compose ps

# Output yang diharapkan:
# NAME               STATUS              PORTS
# wa-blast-app       Up 30 seconds       0.0.0.0:3001->3001/tcp
# wa-blast-mysql     Up 30 seconds       0.0.0.0:3307->3306/tcp
# wa-blast-redis     Up 30 seconds       0.0.0.0:6380->6379/tcp
```

### Langkah 3: Verifikasi Deployment

```bash
# Cek logs
docker-compose logs -f app

# Harus muncul:
# Database connected successfully
# 🚀 Server running on http://localhost:3001
# Scheduler service started

# Tes health check
curl http://localhost:3001/api/health

# Harus: {"status":"ok",...}
```

---

## Setup Domain & SSL

### Langkah 1: Tambah Website di aaPanel

1. **aaPanel** → **Website** → **Add Site**
2. **Domain**: `domain-anda.com`
3. **Root Directory**: `/www/wwwroot/wa-blast-pro`
4. **PHP Version**: Static/Other (tidak perlu, pakai Node.js)
5. **Klik Submit**

### Langkah 2: Konfigurasi Nginx Reverse Proxy

1. **Website** → Cari domain Anda → **Settings**
2. Tab **Configuration File**
3. **Ganti isi** dengan:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name domain-anda.com www.domain-anda.com;
    
    # Redirect HTTP ke HTTPS (setelah SSL setup)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name domain-anda.com www.domain-anda.com;
    
    # SSL certificates (aaPanel akan tambahkan otomatis)
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Increase timeouts untuk operasi WhatsApp
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    client_max_body_size 50M;
    
    # Root location - serve frontend
    location / {
        root /www/wwwroot/wa-blast-pro/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }
    
    # API proxy ke backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Socket.IO WebSocket proxy
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Health check endpoint
    location /api/health {
        proxy_pass http://localhost:3001/api/health;
        access_log off;
    }
    
    # Static files caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        root /www/wwwroot/wa-blast-pro/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Save** dan **Test Configuration**:
```bash
nginx -t
# Expected: syntax is ok

# Reload Nginx
systemctl reload nginx
```

### Langkah 3: SSL Certificate (Let's Encrypt)

1. **aaPanel** → **Website** → Domain Anda → **SSL**
2. Tab **Let's Encrypt**
3. **Tambah domains**:
   - `domain-anda.com`
   - `www.domain-anda.com`
4. **Centang** "Force HTTPS"
5. **Klik Apply**

**Tunggu 1-2 menit** untuk generate certificate.

**Verifikasi SSL**:
```bash
curl -I https://domain-anda.com
# Harus return 200 OK dengan HTTPS
```

### Langkah 4: Build Frontend untuk Production

```bash
cd /www/wwwroot/wa-blast-pro

# Update API URL di frontend config
nano .env

# Tambahkan:
VITE_API_URL=https://domain-anda.com/api
VITE_SOCKET_URL=https://domain-anda.com

# Build frontend
npm install
npm run build

# Verifikasi folder dist
ls -la dist/
```

### Langkah 5: Tes Full Stack

1. **Buka**: `https://domain-anda.com`
2. **Harus muncul**: Halaman login (SSL padlock di browser)
3. **Register** akun baru
4. **Tes fitur**:
   - Login ✅
   - Dashboard loading ✅
   - Socket.IO connect ✅
   - Bisa connect WhatsApp ✅

---

## Monitoring & Maintenance

### Health Monitoring

**Setup monitoring script**:
```bash
nano /root/monitor_wa_blast.sh
```

```bash
#!/bin/bash

# Health check script untuk WA-Blast-Pro
LOG_FILE="/var/log/wa_blast_health.log"
ALERT_EMAIL="email-anda@domain.com"

check_health() {
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health)
    
    if [ "$response" != "200" ]; then
        echo "[$(date)] ALERT: Health check failed - HTTP $response" >> $LOG_FILE
        
        # Restart services
        cd /www/wwwroot/wa-blast-pro
        docker-compose restart app
        
        # Send email alert (optional)
        echo "WA-Blast health check failed at $(date)" | mail -s "WA-Blast Alert" $ALERT_EMAIL
    else
        echo "[$(date)] OK: Health check passed" >> $LOG_FILE
    fi
}

check_health
```

**Jadikan executable**:
```bash
chmod +x /root/monitor_wa_blast.sh
```

**Tambah ke crontab**:
```bash
crontab -e

# Tambahkan baris:
*/5 * * * * /root/monitor_wa_blast.sh
# Jalan setiap 5 menit
```

### Backup Script

```bash
nano /root/backup_wa_blast.sh
```

```bash
#!/bin/bash

BACKUP_DIR="/root/backups/wa-blast"
DATE=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="/www/wwwroot/wa-blast-pro"

mkdir -p $BACKUP_DIR

# Backup database
docker exec wa-blast-mysql mysqldump -u root -p$MYSQL_ROOT_PASSWORD wa_blast_pro > $BACKUP_DIR/db_$DATE.sql

# Backup sessions
tar -czf $BACKUP_DIR/sessions_$DATE.tar.gz $PROJECT_DIR/server/wa-session

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz $PROJECT_DIR/server/uploads

# Backup env
cp $PROJECT_DIR/server/.env $BACKUP_DIR/env_$DATE.backup

# Simpan hanya 7 hari terakhir
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

**Jadikan executable dan schedule**:
```bash
chmod +x /root/backup_wa_blast.sh

crontab -e
# Tambahkan:
0 2 * * * /root/backup_wa_blast.sh
# Harian jam 2 pagi
```

---

## Troubleshooting

### Issue: Container Tidak Mau Start

```bash
# Cek logs
docker-compose logs app

# Fix umum:
# 1. Port conflict
netstat -tlnp | grep 3001

# 2. Permission issues
chown -R www:www /www/wwwroot/wa-blast-pro

# 3. Rebuild dari awal
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Issue: Database Connection Gagal

```bash
# Cek status MySQL
docker-compose ps mysql

# Akses MySQL
docker exec -it wa-blast-mysql mysql -u root -p

# Verifikasi database ada
SHOW DATABASES;

# Cek user permissions
SELECT user, host FROM mysql.user;
GRANT ALL PRIVILEGES ON wa_blast_pro.* TO 'wa_blast_user'@'%';
FLUSH PRIVILEGES;
```

### Issue: QR WhatsApp Tidak Muncul

```bash
# Akses container app
docker exec -it wa-blast-app sh

# Cek direktori session
ls -la /app/server/wa-session

# Clean sessions
rm -rf /app/server/wa-session/*

# Restart container
docker-compose restart app
```

---

## Perintah Berguna

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart hanya app
docker-compose restart app

# Lihat logs
docker-compose logs -f

# Rebuild setelah perubahan code
git pull && docker-compose up -d --build

# Clean up
docker system prune -a

# Backup database
docker exec wa-blast-mysql mysqldump -u root -p wa_blast_pro > backup.sql

# Restore database
cat backup.sql | docker exec -i wa-blast-mysql mysql -u root -p wa_blast_pro

# Cek penggunaan disk
df -h
docker system df

# Monitor resources
docker stats

# Akses shell app
docker exec -it wa-blast-app sh
```

---

## Security Checklist

- [ ] ✅ Ganti semua password default
- [ ] ✅ SSL certificate terinstall dan auto-renewing
- [ ] ✅ Firewall dikonfigurasi (UFW)
- [ ] ✅ SSH key authentication only (disable password)
- [ ] ✅ Backup rutin terjadwal
- [ ] ✅ Monitoring setup
- [ ] ✅ Rate limiting enabled
- [ ] ✅ Environment secrets aman
- [ ] ✅ Docker containers run as non-root
- [ ] ✅ Nginx security headers configured
- [ ] ✅ Database users punya minimal permissions
- [ ] ✅ Fail2ban installed (optional)
- [ ] ✅ Regular updates scheduled

---

**Status Deployment**: ✅ Siap Production

**Terakhir Diupdate**: 26 Desember 2025

**Versi**: 1.0.0
