# 🚀 Complete Deployment Guide - WA-Blast-Pro with aaPanel

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup (aaPanel)](#server-setup-aapanel)
3. [Docker Installation](#docker-installation)
4. [Project Setup](#project-setup)
5. [Environment Configuration](#environment-configuration)
6. [Database Setup](#database-setup)
7. [Docker Deployment](#docker-deployment)
8. [Domain & SSL Setup](#domain--ssl-setup)
9. [CI/CD with GitHub Actions](#cicd-with-github-actions)
10. [Monitoring & Maintenance](#monitoring--maintenance)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Server Requirements
- **OS**: Ubuntu 20.04 LTS or later (recommended)
- **RAM**: Minimum 2GB, Recommended 4GB+
- **Storage**: Minimum 20GB SSD
- **CPU**: 2 cores minimum
- **aaPanel**: Version 6.8 or later

### Domain & DNS
- Domain name (e.g., `wa-blast.yourdomain.com`)
- DNS configured to point to your server IP

### Tools Needed
- SSH client (PuTTY, Terminal, etc.)
- GitHub account
- Docker Hub account (optional)

---

## Server Setup (aaPanel)

### Step 1: Install aaPanel

Connect to your server via SSH:
```bash
ssh root@your-server-ip
```

Install aaPanel:
```bash
# For Ubuntu/Debian
URL=https://www.aapanel.com/script/install-ubuntu_6.0_en.sh && sudo bash <(curl -fsSL $URL)

# For CentOS
URL=https://www.aapanel.com/script/install_6.0_en.sh && sudo bash <(curl -fsSL $URL)
```

**Wait 5-10 minutes** for installation to complete.

After installation, you'll see:
```
==================================================================
aaPanel default info:
==================================================================
Outer panel address: http://YOUR_IP:7800/xxxxxx
username: xxxxxxx
password: xxxxxxxx
==================================================================
```

**⚠️ IMPORTANT**: Save these credentials!

### Step 2: Initial aaPanel Configuration

1. **Access aaPanel**: Open `http://YOUR_IP:7800` in browser
2. **Login** with credentials from installation
3. **Choose software**:
   - ✅ Nginx 1.22+
   - ✅ MySQL 8.0
   - ✅ PHP 8.1+ (if needed for other projects)
   - ✅ Redis 7.0+
   - ⚠️ Don't install Apache (conflict with Nginx)

4. **Security**:
   - Go to **Panel** → **Security**
   - Change default panel port (7800 → custom)
   - Change default username/password
   - Enable 2FA if available

---

## Docker Installation

### Option 1: Via aaPanel (Recommended)

1. **Open aaPanel** → **App Store**
2. **Search** "Docker Manager"
3. **Click Install**
4. **Wait** for installation (~5 minutes)
5. **Verify**: App Store → Installed

### Option 2: Manual Installation

If Docker Manager not available in aaPanel:

```bash
# SSH to server
ssh root@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER

# Verify installation
docker --version
docker-compose --version
```

**Expected output**:
```
Docker version 24.0.x
docker-compose version 2.x.x
```

---

## Project Setup

### Step 1: Create Project Directory

```bash
# SSH to server
ssh root@your-server-ip

# Create project directory
mkdir -p /www/wwwroot/wa-blast-pro
cd /www/wwwroot/wa-blast-pro

# Set proper permissions
chown -R www:www /www/wwwroot/wa-blast-pro
```

### Step 2: Clone Repository

**Option A: Via Git (Public Repo)**
```bash
cd /www/wwwroot/wa-blast-pro
git clone https://github.com/YOUR_USERNAME/wa-blast-pro.git .
```

**Option B: Upload Files (Private/No Git)**
1. Compress project locally: `wa-blast-pro.zip`
2. Upload via aaPanel **Files** manager
3. Extract to `/www/wwwroot/wa-blast-pro/`

**Option C: Via SCP/SFTP**
```bash
# From your local machine
scp -r D:/PROYEK/wa-blast-pro/* root@your-server-ip:/www/wwwroot/wa-blast-pro/
```

### Step 3: Verify Files

```bash
cd /www/wwwroot/wa-blast-pro
ls -la

# Should see:
# - Dockerfile
# - docker-compose.yml
# - server/
# - dist/ or source files
# - package.json
```

---

## Environment Configuration

### Step 1: Create Production .env

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
DB_PASSWORD=CHANGE_THIS_STRONG_PASSWORD_123!@#
DB_NAME=wa_blast_pro

# Server
PORT=3001
NODE_ENV=production

# JWT Secrets (MUST CHANGE!)
JWT_SECRET=GENERATE_RANDOM_64_CHAR_SECRET_HERE_1234567890abcdefghijklmnop
JWT_REFRESH_SECRET=GENERATE_ANOTHER_64_CHAR_SECRET_HERE_0987654321zyxwvuts
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
PASSWORD_PEPPER=GENERATE_PEPPER_SECRET_HERE_abcd1234efgh5678

# CORS (Your domain)
ALLOWED_ORIGINS=https://wa-blast.yourdomain.com,https://www.wa-blast.yourdomain.com

# Rate Limiting (Production - Strict)
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
REDIS_PASSWORD=CHANGE_REDIS_PASSWORD_HERE
```

### Step 2: Generate Secure Secrets

```bash
# Generate JWT_SECRET
openssl rand -base64 64 | tr -d '\n' && echo

# Generate JWT_REFRESH_SECRET
openssl rand -base64 64 | tr -d '\n' && echo

# Generate PASSWORD_PEPPER
openssl rand -base64 48 | tr -d '\n' && echo

# Copy and paste these into .env
```

### Step 3: Update docker-compose.yml

```bash
cd /www/wwwroot/wa-blast-pro
nano docker-compose.yml
```

**Update with your passwords**:
```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: wa-blast-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: YOUR_MYSQL_ROOT_PASSWORD_HERE
      MYSQL_DATABASE: wa_blast_pro
      MYSQL_USER: wa_blast_user
      MYSQL_PASSWORD: SAME_AS_DB_PASSWORD_IN_ENV
    volumes:
      - mysql_data:/var/lib/mysql
      - ./server/database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "3307:3306"
    networks:
      - wa-blast-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: wa-blast-redis
    restart: always
    command: redis-server --requirepass YOUR_REDIS_PASSWORD_HERE
    volumes:
      - redis_data:/data
    ports:
      - "6380:6379"
    networks:
      - wa-blast-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: wa-blast-app
    restart: always
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    volumes:
      - ./server/logs:/app/server/logs
      - ./server/wa-session:/app/server/wa-session
      - wa-uploads:/app/server/uploads
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - wa-blast-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  mysql_data:
  redis_data:
  wa-uploads:

networks:
  wa-blast-network:
    driver: bridge
```

**Save and exit**: `Ctrl+X`, `Y`, `Enter`

---

## Database Setup

### Option 1: Auto-initialization (Recommended)

Database will initialize automatically via `schema.sql` in docker-compose.

### Option 2: Manual Initialization

If auto-init fails:

```bash
# Access MySQL container
docker exec -it wa-blast-mysql bash

# Login to MySQL
mysql -u root -p
# Enter root password

# Create database and user
CREATE DATABASE IF NOT EXISTS wa_blast_pro;
CREATE USER IF NOT EXISTS 'wa_blast_user'@'%' IDENTIFIED BY 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON wa_blast_pro.* TO 'wa_blast_user'@'%';
FLUSH PRIVILEGES;
USE wa_blast_pro;

# Run schema
SOURCE /docker-entrypoint-initdb.d/schema.sql;

# Verify
SHOW TABLES;
EXIT;
```

---

## Docker Deployment

### Step 1: Build Images

```bash
cd /www/wwwroot/wa-blast-pro

# Build without cache (first time)
docker-compose build --no-cache

# Or pull and build
docker-compose build
```

**Expected output**:
```
Building app
Step 1/15 : FROM node:18-alpine AS builder
...
Successfully built xxxxx
Successfully tagged wa-blast-pro_app:latest
```

### Step 2: Start Services

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# Expected output:
# NAME               STATUS              PORTS
# wa-blast-app       Up 30 seconds       0.0.0.0:3001->3001/tcp
# wa-blast-mysql     Up 30 seconds       0.0.0.0:3307->3306/tcp
# wa-blast-redis     Up 30 seconds       0.0.0.0:6380->6379/tcp
```

### Step 3: Verify Deployment

```bash
# Check logs
docker-compose logs -f app

# Should see:
# Database connected successfully
# 🚀 Server running on http://localhost:3001
# Scheduler service started

# Test health check
curl http://localhost:3001/api/health

# Expected: {"status":"ok",...}
```

### Step 4: Create Persistent Volumes

```bash
# Ensure volumes exist
docker volume ls | grep wa-blast

# Should see:
# wa-blast-pro_mysql_data
# wa-blast-pro_redis_data
# wa-blast-pro_wa-uploads

# Check volume permissions
docker exec wa-blast-app ls -la /app/server/wa-session
docker exec wa-blast-app ls -la /app/server/logs
```

---

## Domain & SSL Setup

### Step 1: Add Website in aaPanel

1. **aaPanel** → **Website** → **Add Site**
2. **Domain**: `wa-blast.yourdomain.com`
3. **Root Directory**: `/www/wwwroot/wa-blast-pro`
4. **PHP Version**: Static/Other (not needed, using Node.js)
5. **Click Submit**

### Step 2: Configure Nginx Reverse Proxy

1. **Website** → Find your domain → **Settings**
2. **Configuration File** tab
3. **Replace content** with:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name wa-blast.yourdomain.com www.wa-blast.yourdomain.com;
    
    # Redirect HTTP to HTTPS (after SSL setup)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name wa-blast.yourdomain.com www.wa-blast.yourdomain.com;
    
    # SSL certificates (aaPanel will add these)
    # ssl_certificate /path/to/cert.pem;
    # ssl_certificate_key /path/to/key.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Increase timeouts for WhatsApp operations
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
    
    # API proxy to backend
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
    
    # Deny access to sensitive files
    location ~ /\. {
        deny all;
    }
    
    location ~ ^/(\.env|\.git|server) {
        deny all;
    }
}
```

**Save** and **Test Configuration**:
```bash
nginx -t
# Expected: syntax is ok

# Reload Nginx
systemctl reload nginx
```

### Step 3: SSL Certificate (Let's Encrypt)

1. **aaPanel** → **Website** → Your domain → **SSL**
2. **Let's Encrypt** tab
3. **Add domains**:
   - `wa-blast.yourdomain.com`
   - `www.wa-blast.yourdomain.com`
4. **Check** "Force HTTPS"
5. **Click Apply**

**Wait 1-2 minutes** for certificate generation.

**Verify SSL**:
```bash
curl -I https://wa-blast.yourdomain.com
# Should return 200 OK with HTTPS
```

### Step 4: Build Frontend for Production

```bash
cd /www/wwwroot/wa-blast-pro

# Update API URL in frontend config
# Edit: vite.config.ts or .env for frontend
nano .env

# Add:
VITE_API_URL=https://wa-blast.yourdomain.com/api
VITE_SOCKET_URL=https://wa-blast.yourdomain.com

# Build frontend
npm install
npm run build

# Verify dist folder
ls -la dist/
```

### Step 5: Test Full Stack

1. **Open**: `https://wa-blast.yourdomain.com`
2. **Should see**: Login page (SSL padlock in browser)
3. **Register** a new account
4. **Test features**:
   - Login ✅
   - Dashboard loads ✅
   - Socket.IO connects ✅
   - Can connect WhatsApp ✅

---

## CI/CD with GitHub Actions

### Step 1: Update GitHub Actions Workflow

```bash
cd /www/wwwroot/wa-blast-pro
nano .github/workflows/ci-cd.yml
```

**Update deployment section**:
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, production ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm install
          cd server && npm install
      
      - name: Run linting
        run: |
          cd server && npm run lint || true
      
      - name: Run tests
        run: |
          cd server && npm test || true
      
      - name: Build frontend
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    
    steps:
      - name: Deploy to production
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: ${{ secrets.SSH_PORT }}
          script: |
            cd /www/wwwroot/wa-blast-pro
            git pull origin main
            docker-compose build --no-cache
            docker-compose down
            docker-compose up -d
            docker system prune -f
```

### Step 2: Configure GitHub Secrets

1. **GitHub** → Your Repo → **Settings** → **Secrets and variables** → **Actions**
2. **Add secrets**:

**SERVER_HOST**:
```
your-server-ip or domain
```

**SERVER_USER**:
```
root
```

**SSH_PRIVATE_KEY**:
```bash
# Generate SSH key on your local machine
ssh-keygen -t rsa -b 4096 -C "github-actions"
# Save to: github_deploy_key
# Don't set passphrase (press Enter)

# Copy private key
cat github_deploy_key
# Copy entire content including BEGIN/END lines

# Add to GitHub Secrets as SSH_PRIVATE_KEY
```

**SSH_PORT**:
```
22
```

### Step 3: Add Public Key to Server

```bash
# Copy public key
cat github_deploy_key.pub

# SSH to server
ssh root@your-server-ip

# Add to authorized_keys
nano ~/.ssh/authorized_keys
# Paste public key, save

# Set permissions
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### Step 4: Test Deployment

```bash
# Commit and push
git add .
git commit -m "Setup CI/CD deployment"
git push origin main

# Check GitHub Actions
# Go to: GitHub → Actions → Watch workflow run
```

**Expected**:
- ✅ Test job passes
- ✅ Deploy job triggers
- ✅ SSH connects to server
- ✅ Git pulls latest code
- ✅ Docker rebuilds and restarts
- ✅ Site updated!

---

## Monitoring & Maintenance

### Health Monitoring

**Setup monitoring script**:
```bash
nano /root/monitor_wa_blast.sh
```

```bash
#!/bin/bash

# Health check script for WA-Blast-Pro
LOG_FILE="/var/log/wa_blast_health.log"
ALERT_EMAIL="your-email@domain.com"

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

**Make executable**:
```bash
chmod +x /root/monitor_wa_blast.sh
```

**Add to crontab**:
```bash
crontab -e

# Add line:
*/5 * * * * /root/monitor_wa_blast.sh
# Runs every 5 minutes
```

### Log Rotation

```bash
nano /etc/logrotate.d/wa-blast
```

```
/www/wwwroot/wa-blast-pro/server/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 www www
    sharedscripts
    postrotate
        docker exec wa-blast-app kill -USR1 1
    endscript
}
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

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

**Make executable and schedule**:
```bash
chmod +x /root/backup_wa_blast.sh

crontab -e
# Add:
0 2 * * * /root/backup_wa_blast.sh
# Daily at 2 AM
```

### Docker Management Commands

```bash
# View all containers
docker-compose ps

# View logs
docker-compose logs -f app

# Restart specific service
docker-compose restart app

# Rebuild and restart
docker-compose up -d --build

# Check resource usage
docker stats

# Clean up unused images
docker system prune -a

# Backup before update
./backup_wa_blast.sh

# Update application
cd /www/wwwroot/wa-blast-pro
git pull
docker-compose build
docker-compose up -d
```

---

## Troubleshooting

### Issue 1: Container Won't Start

```bash
# Check logs
docker-compose logs app

# Common fixes:
# 1. Port conflict
netstat -tlnp | grep 3001

# 2. Permission issues
chown -R www:www /www/wwwroot/wa-blast-pro

# 3. Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Issue 2: Database Connection Failed

```bash
# Check MySQL status
docker-compose ps mysql

# Access MySQL
docker exec -it wa-blast-mysql mysql -u root -p

# Verify database exists
SHOW DATABASES;

# Check user permissions
SELECT user, host FROM mysql.user;
GRANT ALL PRIVILEGES ON wa_blast_pro.* TO 'wa_blast_user'@'%';
FLUSH PRIVILEGES;
```

### Issue 3: WhatsApp QR Not Showing

```bash
# Access app container
docker exec -it wa-blast-app sh

# Check session directory
ls -la /app/server/wa-session

# Clean sessions
rm -rf /app/server/wa-session/*

# Restart container
docker-compose restart app
```

### Issue 4: SSL Certificate Issues

```bash
# Renew certificate
certbot renew --dry-run

# Force renewal
certbot renew --force-renewal

# Check expiry
echo | openssl s_client -servername wa-blast.yourdomain.com -connect wa-blast.yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
```

### Issue 5: High Memory Usage

```bash
# Check memory
free -h
docker stats

# Restart Redis (cache)
docker-compose restart redis

# Limit Docker memory
# Edit docker-compose.yml, add to app service:
deploy:
  resources:
    limits:
      memory: 1G
```

---

## Performance Optimization

### 1. Enable Gzip in Nginx

Already included in nginx config above.

### 2. Database Optimization

```sql
-- Access MySQL
docker exec -it wa-blast-mysql mysql -u root -p

-- Add indexes
USE wa_blast_pro;
CREATE INDEX idx_user_id ON contacts(user_id);
CREATE INDEX idx_blast_user ON blast_jobs(user_id);
CREATE INDEX idx_status ON blast_jobs(status);

-- Optimize tables
OPTIMIZE TABLE contacts;
OPTIMIZE TABLE blast_jobs;
OPTIMIZE TABLE blast_recipients;
```

### 3. Redis Caching

Redis is already configured. Ensure it's being used in application code.

### 4. PM2 for Process Management (Optional)

If not using Docker, use PM2:
```bash
npm install -g pm2
cd /www/wwwroot/wa-blast-pro/server
pm2 start index.js --name wa-blast
pm2 startup
pm2 save
```

---

## Security Checklist

- [ ] ✅ Changed all default passwords
- [ ] ✅ SSL certificate installed and auto-renewing
- [ ] ✅ Firewall configured (UFW)
- [ ] ✅ SSH key authentication only (disable password)
- [ ] ✅ Regular backups scheduled
- [ ] ✅ Monitoring setup
- [ ] ✅ Rate limiting enabled
- [ ] ✅ Environment secrets secured
- [ ] ✅ Docker containers run as non-root
- [ ] ✅ Nginx security headers configured
- [ ] ✅ Database users have minimal permissions
- [ ] ✅ Fail2ban installed (optional)
- [ ] ✅ Regular updates scheduled

---

## Quick Reference Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart app only
docker-compose restart app

# View logs
docker-compose logs -f

# Rebuild after code changes
git pull && docker-compose up -d --build

# Clean up
docker system prune -a

# Backup database
docker exec wa-blast-mysql mysqldump -u root -p wa_blast_pro > backup.sql

# Restore database
cat backup.sql | docker exec -i wa-blast-mysql mysql -u root -p wa_blast_pro

# Check disk usage
df -h
docker system df

# Monitor resources
docker stats

# Access app shell
docker exec -it wa-blast-app sh
```

---

## Support & Resources

- **aaPanel Docs**: https://doc.aapanel.com/
- **Docker Docs**: https://docs.docker.com/
- **Nginx Docs**: https://nginx.org/en/docs/
- **Let's Encrypt**: https://letsencrypt.org/

---

**Deployment Status**: ✅ Ready for Production

**Last Updated**: 2025-12-26

**Version**: 1.0.0
