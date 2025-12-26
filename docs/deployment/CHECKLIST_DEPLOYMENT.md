# ✅ Checklist Deployment - Sebelum & Sesudah Deploy

## 📋 Checklist Pra-Deployment

### Persiapan Server
- [ ] VPS/Server sudah disiapkan (min 2GB RAM, 2 CPU cores)
- [ ] Ubuntu 20.04+ terinstall
- [ ] Akses root/sudo dikonfirmasi
- [ ] Akses SSH berfungsi
- [ ] Firewall dikonfigurasi (port 80, 443, 22 terbuka)
- [ ] Domain DNS dikonfigurasi (A record mengarah ke IP server)
- [ ] Domain sudah terpropagasi (`nslookup domain-anda.com`)

### Instalasi Software
- [ ] aaPanel terinstall dan bisa diakses
- [ ] Docker terinstall (`docker --version`)
- [ ] Docker Compose terinstall (`docker-compose --version`)
- [ ] Nginx terinstall (via aaPanel atau system)
- [ ] MySQL 8.0+ tersedia
- [ ] Redis tersedia
- [ ] Git terinstall
- [ ] Certbot terinstall (untuk SSL)

### Setup Project
- [ ] Repository project bisa diakses
- [ ] File `.env` dibuat dari `.env.production.example`
- [ ] Semua secrets sudah digenerate (JWT, passwords, dll)
- [ ] Semua password diganti dari default
- [ ] Environment variables terverifikasi
- [ ] `docker-compose.yml` diupdate dengan nilai production
- [ ] Dockerfile sudah direview
- [ ] `.dockerignore` dikonfigurasi

### Persiapan Database
- [ ] MySQL root password sudah diset
- [ ] Database user sudah dibuat
- [ ] Database permissions sudah diberikan
- [ ] File schema SQL siap
- [ ] Backup data existing (jika migrasi)

### Konfigurasi Keamanan
- [ ] Password kuat sudah digenerate (min 20 karakter)
- [ ] JWT secrets digenerate (64+ karakter)
- [ ] SSH key authentication enabled
- [ ] Password authentication disabled (optional tapi recommended)
- [ ] Firewall rules dikonfigurasi
- [ ] Fail2ban terinstall (optional)
- [ ] SELinux/AppArmor dikonfigurasi (jika applicable)

### Build Frontend
- [ ] Frontend sudah di-build (`npm run build`)
- [ ] Build artifacts terverifikasi (folder `dist/`)
- [ ] API URL dikonfigurasi untuk production
- [ ] Socket.IO URL dikonfigurasi
- [ ] Config environment-specific sudah diupdate

### Setup CI/CD (jika digunakan)
- [ ] GitHub Actions workflow dikonfigurasi
- [ ] SSH deploy key sudah digenerate
- [ ] Public key ditambahkan ke server
- [ ] Private key ditambahkan ke GitHub secrets
- [ ] Semua GitHub secrets dikonfigurasi
- [ ] Workflow sudah dites

### Strategi Backup
- [ ] Backup script sudah dibuat
- [ ] Lokasi backup dikonfigurasi
- [ ] Schedule backup diset (cron)
- [ ] Prosedur restore sudah didokumentasikan
- [ ] Backup sudah dites

---

## 🚀 Langkah-Langkah Deployment

### Fase 1: Setup Awal
- [ ] Clone repository ke `/www/wwwroot/wa-blast-pro`
- [ ] Set directory permissions (`chown -R www:www`)
- [ ] Copy dan konfigurasi file `.env`
- [ ] Verifikasi semua file ada

### Fase 2: Build Docker
- [ ] Jalankan `docker-compose build`
- [ ] Verifikasi build selesai tanpa error
- [ ] Cek Docker images dibuat (`docker images`)

### Fase 3: Start Services
- [ ] Jalankan `docker-compose up -d`
- [ ] Cek status containers (`docker-compose ps`)
- [ ] Verifikasi semua containers running
- [ ] Cek logs untuk errors (`docker-compose logs`)

### Fase 4: Inisialisasi Database
- [ ] Akses MySQL container
- [ ] Verifikasi database dibuat
- [ ] Verifikasi tables dibuat (12 tables)
- [ ] Tes koneksi database

### Fase 5: Konfigurasi Nginx
- [ ] Tambah site di aaPanel
- [ ] Konfigurasi reverse proxy
- [ ] Tes config Nginx (`nginx -t`)
- [ ] Reload Nginx

### Fase 6: SSL Certificate
- [ ] Request Let's Encrypt certificate
- [ ] Verifikasi certificate terinstall
- [ ] Tes akses HTTPS
- [ ] Enable redirect HTTPS

### Fase 7: Verifikasi
- [ ] Tes redirect HTTP → HTTPS
- [ ] Tes endpoint API health
- [ ] Tes frontend loading
- [ ] Tes registrasi
- [ ] Tes login
- [ ] Tes semua fitur utama

---

## ✅ Verifikasi Pasca-Deployment

### Tes Infrastructure

#### 1. Health Server
```bash
# Cek resource sistem
free -h
df -h
top

# Harus ada:
# - Minimal 500MB free RAM
# - Minimal 5GB free disk space
# - CPU usage < 80%
```

#### 2. Status Docker
```bash
docker-compose ps

# Semua containers harus menunjukkan:
# STATE: Up
```

#### 3. Logs Container
```bash
docker-compose logs app | tail -50

# Harus terlihat:
# ✅ Database connected successfully
# ✅ Server running on http://localhost:3001
# ✅ Tidak ada pesan error
```

#### 4. Koneksi Database
```bash
docker exec -it wa-blast-mysql mysql -u root -p

mysql> SHOW DATABASES;
mysql> USE wa_blast_pro;
mysql> SHOW TABLES;
mysql> SELECT COUNT(*) FROM users;
```

Output yang diharapkan:
```
+-------------------+
| Database          |
+-------------------+
| wa_blast_pro      |
+-------------------+

Tables_in_wa_blast_pro:
- users
- contacts
- groups
- blast_jobs
- ... (12 total)
```

#### 5. Koneksi Redis
```bash
docker exec -it wa-blast-redis redis-cli -a PASSWORD_REDIS_ANDA

127.0.0.1:6379> PING
# Expected: PONG

127.0.0.1:6379> INFO server
# Harus menunjukkan versi Redis dan uptime
```

### Tes Aplikasi

#### 6. Health Check
```bash
curl -I http://localhost:3001/api/health

# Expected:
# HTTP/1.1 200 OK
```

```bash
curl http://localhost:3001/api/health

# Expected JSON:
{
  "status": "ok",
  "timestamp": "2025-12-26T...",
  "uptime": 123.45,
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "memory": {...}
  }
}
```

#### 7. Akses Frontend
```bash
curl -I https://domain-anda.com

# Expected:
# HTTP/2 200
# Content-Type: text/html
```

Buka di browser:
```
https://domain-anda.com
```

Harus terlihat:
- ✅ Halaman login loading
- ✅ Tidak ada error console (F12)
- ✅ Gembok HTTPS di browser
- ✅ SSL certificate valid

#### 8. API Endpoints
```bash
# Tes registrasi
curl -X POST https://domain-anda.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "name": "Test User"
  }'

# Expected: Response sukses dengan data user
```

```bash
# Tes login
curl -X POST https://domain-anda.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'

# Expected: Sukses dengan JWT token
```

#### 9. Koneksi Socket.IO
Buka browser console (F12) di situs Anda:
```javascript
// Harus terlihat:
Socket connected: [socket-id]
```

#### 10. Koneksi WhatsApp
1. Navigasi ke halaman Connection
2. Klik "Connect WhatsApp"
3. Tunggu 30-90 detik
4. Verifikasi QR code muncul
5. Scan dengan ponsel
6. Verifikasi koneksi berhasil

### Tes Keamanan

#### 11. Grade SSL/TLS
```bash
# Cek konfigurasi SSL
openssl s_client -connect domain-anda.com:443 -tls1_2

# Atau gunakan tool online:
# https://www.ssllabs.com/ssltest/analyze.html?d=domain-anda.com
```

Grade yang diharapkan: A atau A+

#### 12. Security Headers
```bash
curl -I https://domain-anda.com

# Harus termasuk:
# Strict-Transport-Security: max-age=...
# X-Content-Type-Options: nosniff
# X-Frame-Options: SAMEORIGIN
# X-XSS-Protection: 1; mode=block
```

#### 13. Rate Limiting
```bash
# Tes rate limit
for i in {1..10}; do
  curl -X POST https://domain-anda.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test","password":"test"}'
done

# Setelah 5 percobaan, harus muncul:
# HTTP/1.1 429 Too Many Requests
```

#### 14. CORS Policy
```bash
curl -I -X OPTIONS https://domain-anda.com/api/health \
  -H "Origin: https://situs-jahat.com"

# Harus reject atau hanya allow origin yang dikonfigurasi
```

### Tes Performa

#### 15. Response Time
```bash
curl -o /dev/null -s -w 'Total: %{time_total}s\n' https://domain-anda.com/api/health

# Harus < 1 detik
```

#### 16. Load Test
```bash
# Install apache bench jika perlu
apt-get install apache2-utils

# Tes 100 requests, 10 concurrent
ab -n 100 -c 10 https://domain-anda.com/api/health

# Cek:
# - Failed requests: 0
# - Requests per second: > 50
```

#### 17. Penggunaan Memory
```bash
docker stats --no-stream

# Cek penggunaan memory:
# - Container app: < 500MB saat load normal
# - MySQL: < 1GB
# - Redis: < 256MB
```

### Tes Monitoring

#### 18. File Log
```bash
# Cek file log ada dan sedang ditulis
ls -lh /www/wwwroot/wa-blast-pro/server/logs/

# Harus terlihat:
# - combined.log (timestamp terbaru)
# - error.log (timestamp terbaru)
# - access.log (jika dikonfigurasi)

# Cek isi log
tail -f /www/wwwroot/wa-blast-pro/server/logs/combined.log
# Harus terlihat aktivitas terbaru
```

#### 19. Rotasi Log
```bash
# Cek config logrotate
cat /etc/logrotate.d/wa-blast

# Tes logrotate
logrotate -d /etc/logrotate.d/wa-blast
```

#### 20. Verifikasi Backup
```bash
# Cek file backup
ls -lh /root/backups/wa-blast/

# Harus terlihat backup terbaru:
# - db_YYYYMMDD_HHMMSS.sql
# - sessions_YYYYMMDD_HHMMSS.tar.gz
# - env_YYYYMMDD_HHMMSS.backup

# Tes restore
mysql -u root -p wa_blast_pro_test < /root/backups/wa-blast/db_latest.sql
```

---

## 📊 Benchmark Performa

Setelah deployment, catat metrik ini:

| Metrik | Target | Aktual |
|--------|--------|--------|
| Waktu load halaman | < 3s | _____ |
| Response time API | < 500ms | _____ |
| Waktu query database | < 100ms | _____ |
| Penggunaan memory (app) | < 500MB | _____ |
| Penggunaan memory (total) | < 1.5GB | _____ |
| Penggunaan disk | < 10GB | _____ |
| Penggunaan CPU (idle) | < 20% | _____ |
| Grade SSL | A+ | _____ |
| Uptime (minggu pertama) | 99.9% | _____ |

---

## 🔍 Masalah Umum & Solusi

### Issue: Container Terus Restart
```bash
docker-compose logs app
# Cek untuk:
# - Error koneksi database → Verifikasi DB_PASSWORD
# - Konflik port → Ganti PORT di .env
# - Secrets hilang → Cek file .env
```

### Issue: Tidak Bisa Akses Site
```bash
# Cek Nginx
nginx -t
systemctl status nginx

# Cek firewall
ufw status
ufw allow 80
ufw allow 443

# Cek DNS
nslookup domain-anda.com
```

### Issue: SSL Certificate Gagal
```bash
# Cek DNS dulu
dig domain-anda.com

# Cek port 80 accessible
curl http://domain-anda.com

# Coba manual certbot
certbot certonly --nginx -d domain-anda.com
```

### Issue: Koneksi Database Gagal
```bash
# Cek container MySQL
docker-compose ps mysql

# Cek credentials
docker exec -it wa-blast-mysql mysql -u root -p

# Buat ulang database
docker-compose down
docker volume rm wa-blast-pro_mysql_data
docker-compose up -d
```

---

## 📝 Tugas Pasca-Deployment

### Segera (Hari 1)
- [ ] Monitor error logs selama 1 jam pertama
- [ ] Tes semua fitur penting
- [ ] Verifikasi backup berjalan
- [ ] Cek metrik performa
- [ ] Update dokumentasi dengan detail server
- [ ] Share akses dengan tim
- [ ] Setup alert monitoring

### Jangka Pendek (Minggu 1)
- [ ] Monitor uptime
- [ ] Review error logs harian
- [ ] Cek disk space
- [ ] Verifikasi integritas backup
- [ ] Tuning performa jika perlu
- [ ] User acceptance testing
- [ ] Fix issue yang dilaporkan

### Jangka Menengah (Bulan 1)
- [ ] Review security logs
- [ ] Update dependencies
- [ ] Optimasi query database
- [ ] Review dan adjust resource limits
- [ ] Rencanakan strategi scaling
- [ ] Dokumentasi lessons learned
- [ ] Schedule maintenance rutin

### Jangka Panjang (Berkelanjutan)
- [ ] Audit keamanan bulanan
- [ ] Update dependencies quarterly
- [ ] Rotasi password bi-annually
- [ ] Perpanjangan SSL certificate annual (auto)
- [ ] Review capacity planning
- [ ] Disaster recovery drills

---

## 📞 Kontak Darurat

Dokumentasikan untuk tim Anda:

- **IP Server**: _______________
- **Domain**: _______________
- **URL aaPanel**: _______________
- **Repo GitHub**: _______________
- **Provider Server**: _______________
- **Provider DNS**: _______________
- **Kontak Darurat**: _______________
- **Lokasi Backup**: _______________

---

## 🎯 Kriteria Sukses

Deployment dianggap sukses jika:

- ✅ Semua containers running tanpa restart
- ✅ Aplikasi bisa diakses via HTTPS
- ✅ SSL certificate valid (grade A+)
- ✅ Semua API endpoints merespon
- ✅ Query database berfungsi
- ✅ Bisa register dan login
- ✅ Bisa connect WhatsApp
- ✅ Tidak ada error kritis di logs
- ✅ Backup dikonfigurasi dan dites
- ✅ Monitoring setup dan alerting
- ✅ Tim bisa akses dan gunakan sistem
- ✅ Performa sesuai target

---

**Tanggal Deployment**: _________________
**Deployed Oleh**: _________________
**Versi**: _________________
**Status**: ⬜ Pending | ⬜ In Progress | ⬜ Complete | ⬜ Issues

**Sign Off**:
- Technical Lead: _________________ Tanggal: _______
- Project Manager: _________________ Tanggal: _______
- QA: _________________ Tanggal: _______
