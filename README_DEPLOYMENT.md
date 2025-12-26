# 📦 WA-Blast-Pro - Panduan Deployment

Dokumentasi lengkap deployment dengan aaPanel dan Docker dalam Bahasa Indonesia.

---

## 📚 Dokumentasi Deployment

Semua panduan deployment tersedia di folder `docs/deployment/`:

```
docs/deployment/
├── README.md                      # Index panduan (mulai dari sini!)
├── PANDUAN_LENGKAP.md            # Panduan detail step-by-step
├── DEPLOY_CEPAT.md               # Quick start 15 menit
├── CICD_OTOMATIS.md              # Setup CI/CD dengan GitHub Actions
├── CHECKLIST_DEPLOYMENT.md       # Daftar periksa lengkap
├── TROUBLESHOOTING.md            # Solusi masalah umum
├── env.production.example        # Template environment production
└── docker-compose.prod.yml       # Docker config untuk production
```

---

## 🚀 Mulai Deploy

### Untuk Pemula (Waktu: 3-4 jam)
```bash
# Baca panduan lengkap
cd docs/deployment
cat PANDUAN_LENGKAP.md

# Ikuti step-by-step dengan checklist
cat CHECKLIST_DEPLOYMENT.md
```

### Untuk Yang Berpengalaman (Waktu: 15-30 menit)
```bash
# Quick start
cd docs/deployment
cat DEPLOY_CEPAT.md

# Copy-paste commands dan go!
```

---

## 📖 Quick Links

- **[Mulai Dari Sini](docs/deployment/README.md)** - Index dokumentasi
- **[Panduan Lengkap](docs/deployment/PANDUAN_LENGKAP.md)** - Detail deployment
- **[Deploy Cepat](docs/deployment/DEPLOY_CEPAT.md)** - 15 menit setup
- **[CI/CD Setup](docs/deployment/CICD_OTOMATIS.md)** - Auto deployment
- **[Checklist](docs/deployment/CHECKLIST_DEPLOYMENT.md)** - Daftar periksa
- **[Troubleshooting](docs/deployment/TROUBLESHOOTING.md)** - Solusi masalah

---

## 🎯 Kebutuhan

- **Server**: VPS Ubuntu 20.04+ (min 2GB RAM)
- **Domain**: Nama domain + DNS configured
- **Akses**: SSH root access
- **Tools**: aaPanel, Docker, Git

**Estimasi Biaya**: Rp 50.000 - 200.000/bulan

---

## ⚡ Quick Start

```bash
# 1. Install aaPanel
wget -O install.sh http://www.aapanel.com/script/install-ubuntu_6.0_en.sh && sudo bash install.sh

# 2. Install Docker
curl -fsSL https://get.docker.com | sh

# 3. Clone project
cd /www/wwwroot
git clone https://github.com/YOUR_USERNAME/wa-blast-pro.git
cd wa-blast-pro

# 4. Setup environment
cd server
cp .env.example .env
nano .env  # Update dengan values Anda

# 5. Deploy
cd ..
docker-compose up -d

# 6. Setup domain & SSL via aaPanel
# 7. Done! Visit https://domain-anda.com
```

**Detail lengkap**: Lihat [docs/deployment/DEPLOY_CEPAT.md](docs/deployment/DEPLOY_CEPAT.md)

---

## 📊 Struktur Project

```
wa-blast-pro/
├── docs/
│   └── deployment/           # 📁 Semua dokumentasi deployment di sini
├── server/                   # Backend (Node.js + Express)
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   └── database/
├── components/               # Frontend components
├── services/                 # Frontend services
├── Dockerfile                # Multi-stage build config
├── docker-compose.yml        # Docker config development/simple
└── docker-compose.prod.yml   # Docker config production (di docs/deployment/)
```

---

## 🔐 Keamanan

Sebelum deploy ke production:

- [ ] Generate JWT secrets yang kuat (64+ karakter)
- [ ] Ganti semua password default
- [ ] Enable HTTPS dan force redirect
- [ ] Konfigurasi firewall (UFW)
- [ ] Setup backup otomatis
- [ ] Enable monitoring

**Detail**: [docs/deployment/PANDUAN_LENGKAP.md#keamanan](docs/deployment/PANDUAN_LENGKAP.md)

---

## 🆘 Butuh Bantuan?

1. **Cek dokumentasi**: [docs/deployment/](docs/deployment/)
2. **Troubleshooting**: [docs/deployment/TROUBLESHOOTING.md](docs/deployment/TROUBLESHOOTING.md)
3. **GitHub Issues**: Buat issue dengan detail masalah
4. **Community**: aaPanel Forum, Docker Indonesia

---

## 📞 Support

- **Email**: support@domain-anda.com
- **GitHub**: https://github.com/YOUR_USERNAME/wa-blast-pro
- **Dokumentasi**: [docs/deployment/](docs/deployment/)

---

## 🎉 Ready to Deploy?

Semua dokumentasi sudah lengkap dan siap digunakan!

**Mulai sekarang**: [docs/deployment/README.md](docs/deployment/README.md)

---

**Status**: ✅ Siap Production  
**Dokumentasi**: ✅ Lengkap dalam Bahasa Indonesia  
**Versi**: 1.0.0
