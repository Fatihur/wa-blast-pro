# ⚡ Panduan Deploy Cepat - 15 Menit

## Checklist Persiapan
- [ ] VPS/Server Ubuntu 20.04+
- [ ] Akses root
- [ ] Domain sudah dikonfigurasi
- [ ] Akun GitHub

---

## 🚀 Deployment Super Cepat (Copy-Paste)

### Langkah 1: Install aaPanel (5 menit)
```bash
# SSH ke server
ssh root@ip-server-anda

# Install aaPanel
wget -O install.sh http://www.aapanel.com/script/install-ubuntu_6.0_en.sh && sudo bash install.sh

# SIMPAN URL dan kredensial login!
```

### Langkah 2: Install Docker (2 menit)
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verifikasi
docker --version && docker-compose --version
```

### Langkah 3: Clone Project (1 menit)
```bash
# Buat direktori
mkdir -p /www/wwwroot/wa-blast-pro
cd /www/wwwroot/wa-blast-pro

# Clone (ganti dengan repo Anda)
git clone https://github.com/USERNAME_ANDA/wa-blast-pro.git .
```

### Langkah 4: Konfigurasi Environment (2 menit)
```bash
cd server
cp .env.example .env
nano .env

# Update nilai-nilai penting:
# DB_PASSWORD=password_kuat_anda_123
# JWT_SECRET=generate_dengan_openssl
# JWT_REFRESH_SECRET=generate_dengan_openssl
# ALLOWED_ORIGINS=https://domain-anda.com
```

**Generate secrets**:
```bash
# Generate JWT_SECRET
openssl rand -base64 64
# Copy output ke JWT_SECRET

# Generate JWT_REFRESH_SECRET  
openssl rand -base64 64
# Copy output ke JWT_REFRESH_SECRET
```

### Langkah 5: Start Docker (1 menit)
```bash
cd /www/wwwroot/wa-blast-pro

# Build dan start
docker-compose up -d

# Cek status
docker-compose ps

# Lihat logs
docker-compose logs -f
```

### Langkah 6: Konfigurasi Nginx (2 menit)
```bash
# Di web interface aaPanel:
# 1. Website → Add Site
# 2. Domain: domain-anda.com
# 3. Settings → Configuration File
# 4. Paste config dari PANDUAN_LENGKAP.md
# 5. Save dan reload
```

### Langkah 7: Setup SSL (2 menit)
```bash
# Di aaPanel:
# 1. Website → Domain anda → SSL
# 2. Let's Encrypt tab
# 3. Tambahkan domain
# 4. Apply certificate
```

### Langkah 8: Tes (1 menit)
```bash
# Tes health
curl http://localhost:3001/api/health

# Kunjungi site
https://domain-anda.com

# Register akun dan tes!
```

---

## ✅ Checklist Verifikasi

- [ ] aaPanel bisa diakses
- [ ] Container Docker jalan (`docker ps`)
- [ ] Site bisa diakses via HTTPS
- [ ] Bisa register akun
- [ ] Bisa login
- [ ] Dashboard loading
- [ ] Bisa connect WhatsApp
- [ ] QR code muncul

---

## 🆘 Troubleshooting Cepat

### Container tidak mau start
```bash
docker-compose logs app
docker-compose down && docker-compose up -d
```

### Error database
```bash
docker exec -it wa-blast-mysql mysql -u root -p
# Cek apakah database ada
```

### Tidak bisa akses site
```bash
# Cek Nginx
nginx -t
systemctl status nginx

# Cek firewall
ufw allow 80
ufw allow 443
```

---

## 📞 Butuh Panduan Lengkap?
Lihat **PANDUAN_LENGKAP.md** untuk instruksi detail!

---

## 🎯 Perintah Berguna

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart app
docker-compose restart app

# Lihat logs
docker-compose logs -f app

# Update setelah git pull
git pull && docker-compose up -d --build

# Backup database
docker exec wa-blast-mysql mysqldump -u root -p wa_blast_pro > backup.sql

# Clean Docker
docker system prune -f
```

---

## 📊 Estimasi Waktu

```
00:00 → Install aaPanel (5 menit)
00:05 → Install Docker (2 menit)
00:07 → Clone project (1 menit)
00:08 → Setup .env (2 menit)
00:10 → Start Docker (1 menit)
00:11 → Setup Nginx (2 menit)
00:13 → Install SSL (2 menit)
00:15 → Tes aplikasi (1 menit)

Total: 15-20 menit
```

---

## 🔐 Security Checklist

Setelah deploy:
- [ ] Ganti semua password default
- [ ] Generate JWT secrets yang kuat
- [ ] Enable HTTPS redirect
- [ ] Setup firewall
- [ ] Enable fail2ban (optional)
- [ ] Setup backup otomatis
- [ ] Enable monitoring

---

## 🚀 Next Steps

1. ✅ Deploy selesai
2. Setup **CICD_OTOMATIS.md** untuk auto-deploy
3. Gunakan **CHECKLIST_DEPLOYMENT.md** untuk verifikasi
4. Setup monitoring dan backup
5. Dokumentasikan credentials

---

**Status**: ✅ Siap Deploy  
**Waktu**: 15-20 menit  
**Difficulty**: ⭐⭐ Menengah
