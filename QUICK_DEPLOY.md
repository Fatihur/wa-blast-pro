# ⚡ Quick Deploy Guide - 15 Minutes Setup

## Prerequisites Check
- [ ] VPS/Server with Ubuntu 20.04+
- [ ] Root access
- [ ] Domain name configured
- [ ] GitHub account

---

## 🚀 Super Fast Deployment (Copy-Paste)

### Step 1: Install aaPanel (5 min)
```bash
# SSH to server
ssh root@your-server-ip

# Install aaPanel
wget -O install.sh http://www.aapanel.com/script/install-ubuntu_6.0_en.sh && sudo bash install.sh

# SAVE the login URL and credentials!
```

### Step 2: Install Docker (2 min)
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker --version && docker-compose --version
```

### Step 3: Clone Project (1 min)
```bash
# Create directory
mkdir -p /www/wwwroot/wa-blast-pro
cd /www/wwwroot/wa-blast-pro

# Clone (replace with your repo)
git clone https://github.com/YOUR_USERNAME/wa-blast-pro.git .
```

### Step 4: Configure Environment (2 min)
```bash
cd server
cp .env.example .env
nano .env

# Update these critical values:
# DB_PASSWORD=your_strong_password_123
# JWT_SECRET=generate_with_openssl_rand_base64_64
# JWT_REFRESH_SECRET=generate_with_openssl_rand_base64_64
# ALLOWED_ORIGINS=https://yourdomain.com
```

**Generate secrets**:
```bash
openssl rand -base64 64
# Copy output to JWT_SECRET

openssl rand -base64 64
# Copy output to JWT_REFRESH_SECRET
```

### Step 5: Start Docker (1 min)
```bash
cd /www/wwwroot/wa-blast-pro

# Build and start
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 6: Configure Nginx (2 min)
```bash
# In aaPanel web interface:
# 1. Website → Add Site
# 2. Domain: yourdomain.com
# 3. Settings → Configuration File
# 4. Paste the Nginx config from DEPLOYMENT_GUIDE.md
# 5. Save and reload
```

### Step 7: Setup SSL (2 min)
```bash
# In aaPanel:
# 1. Website → Your domain → SSL
# 2. Let's Encrypt tab
# 3. Add domains
# 4. Apply certificate
```

### Step 8: Test (1 min)
```bash
# Test health
curl http://localhost:3001/api/health

# Visit site
https://yourdomain.com

# Register account and test!
```

---

## ✅ Verification Checklist

- [ ] aaPanel accessible
- [ ] Docker containers running (`docker ps`)
- [ ] Site accessible via HTTPS
- [ ] Can register account
- [ ] Can login
- [ ] Dashboard loads
- [ ] Can connect WhatsApp
- [ ] QR code appears

---

## 🆘 Quick Troubleshooting

### Container won't start
```bash
docker-compose logs app
docker-compose down && docker-compose up -d
```

### Database error
```bash
docker exec -it wa-blast-mysql mysql -u root -p
# Check if database exists
```

### Can't access site
```bash
# Check Nginx
nginx -t
systemctl status nginx

# Check firewall
ufw allow 80
ufw allow 443
```

---

## 📞 Need Full Guide?
See **DEPLOYMENT_GUIDE.md** for detailed instructions!
