# 🔄 Panduan CI/CD Otomatis - GitHub Actions

## Gambaran Umum
Otomatis deploy ke server Anda setiap kali push ke branch `main`.

---

## Langkah 1: Generate SSH Key

**Di komputer lokal Anda**:
```bash
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy"
# Simpan ke: github_deploy_key
# Tanpa passphrase (tekan Enter saja)

# Lihat private key
cat github_deploy_key
# Copy seluruh isi

# Lihat public key
cat github_deploy_key.pub
# Copy ini juga
```

---

## Langkah 2: Tambah Public Key ke Server

**SSH ke server Anda**:
```bash
ssh root@ip-server-anda

# Tambah public key
nano ~/.ssh/authorized_keys
# Paste public key dari github_deploy_key.pub
# Save dan exit

# Set permissions
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

**Tes key**:
```bash
# Dari komputer lokal
ssh -i github_deploy_key root@ip-server-anda
# Harus login tanpa password
```

---

## Langkah 3: Konfigurasi GitHub Secrets

1. Pergi ke repository GitHub Anda
2. **Settings** → **Secrets and variables** → **Actions**
3. Klik **New repository secret**

Tambahkan secrets berikut:

### SERVER_HOST
```
Value: ip-server-anda
# Atau domain: domain-anda.com
```

### SERVER_USER
```
Value: root
```

### SSH_PRIVATE_KEY
```
Value: [paste seluruh private key dari github_deploy_key]

-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAACFwAAAAdzc2gtcn
... (semua baris)
-----END OPENSSH PRIVATE KEY-----
```

### SSH_PORT
```
Value: 22
# Atau port SSH custom Anda
```

### DOCKER_USERNAME (optional)
```
Value: username-dockerhub-anda
# Hanya jika push ke Docker Hub
```

### DOCKER_PASSWORD (optional)
```
Value: token-dockerhub-anda
# Hanya jika push ke Docker Hub
```

---

## Langkah 4: Update Workflow File

File workflow sudah ada di `.github/workflows/ci-cd.yml`.

**Update bagian deploy script**:
```yaml
# ... konten yang ada ...

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    
    steps:
      - name: Deploy ke production
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: ${{ secrets.SSH_PORT }}
          script: |
            cd /www/wwwroot/wa-blast-pro
            git pull origin main
            docker-compose build --no-cache app
            docker-compose up -d
            docker system prune -f
            echo "Deployment selesai pada $(date)"
      
      - name: Health check
        run: |
          sleep 10
          curl -f https://domain-anda.com/api/health || exit 1
      
      - name: Notifikasi sukses
        if: success()
        run: echo "✅ Deployment berhasil!"
```

---

## Langkah 5: Setup Deploy Key untuk Git Pull

**Di server, izinkan git pull**:
```bash
cd /www/wwwroot/wa-blast-pro

# Konfigurasi git
git config --global user.name "GitHub Actions"
git config --global user.email "actions@github.com"

# Tes git pull
git pull origin main
# Harus berhasil tanpa minta credentials
```

**Jika pakai private repo**, tambah deploy key:
```bash
# Di server, generate key
ssh-keygen -t rsa -b 4096 -C "server-git-access"
cat ~/.ssh/id_rsa.pub

# Copy output
```

Kemudian:
1. GitHub repo → **Settings** → **Deploy keys**
2. **Add deploy key**
3. Paste public key
4. Centang "Allow write access" jika perlu
5. **Add key**

---

## Langkah 6: Tes Deployment

**Buat perubahan test**:
```bash
# Edit file
echo "// CI/CD test" >> README.md

# Commit dan push
git add .
git commit -m "test: deployment CI/CD"
git push origin main
```

**Pantau workflow**:
1. Pergi ke GitHub → Tab **Actions**
2. Anda akan melihat workflow berjalan
3. Klik untuk melihat progress

**Alur yang diharapkan**:
```
✅ Lint & Type Check
✅ Run Tests  
✅ Build Application
✅ Security Scan
✅ Build Docker Image
✅ Deploy to Production
   → SSH ke server
   → Git pull
   → Docker rebuild
   → Docker restart
   → Health check
✅ Deployment berhasil!
```

---

## Langkah 7: Verifikasi Deployment

**Di server**:
```bash
# Cek containers
docker ps

# Lihat logs deploy
docker-compose logs -f app

# Tes health
curl http://localhost:3001/api/health
```

**Di website**:
1. Kunjungi domain Anda
2. Refresh halaman (Ctrl+F5)
3. Cek apakah perubahan sudah live

---

## 🎯 Strategi Deployment

### Opsi 1: Direct Deploy (Saat Ini)
- Git pull → Rebuild → Restart
- **Kelebihan**: Simpel, cepat
- **Kekurangan**: Downtime singkat (~30s)

### Opsi 2: Blue-Green Deployment
```yaml
# Di workflow file:
script: |
  cd /www/wwwroot/wa-blast-pro
  git pull origin main
  
  # Build image baru dengan tag
  docker-compose build app
  docker tag wa-blast-pro_app:latest wa-blast-pro_app:blue
  
  # Start blue (versi baru)
  docker run -d --name app-blue wa-blast-pro_app:blue
  
  # Health check
  sleep 10
  curl -f http://localhost:3002/api/health
  
  # Switch traffic (update nginx)
  # Stop old green, start blue
  docker stop app-green
  docker rename app-blue app-green
```

### Opsi 3: Rolling Update
Gunakan Docker Swarm atau Kubernetes untuk zero-downtime.

---

## 🔔 Notifikasi

### Tambah Notifikasi Slack

**Tambah ke workflow**:
```yaml
- name: Notifikasi Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Deployment ${{ job.status }}'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

**Setup**:
1. Slack → Apps → Incoming Webhooks
2. Buat webhook
3. Copy webhook URL
4. Tambah ke GitHub secrets sebagai `SLACK_WEBHOOK`

### Tambah Notifikasi Email

**Tambah ke workflow**:
```yaml
- name: Kirim email
  if: failure()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: 'Deployment Gagal!'
    to: email-anda@domain.com
    from: GitHub Actions
    body: Deployment gagal. Cek logs.
```

---

## 📊 Monitoring Deployments

### Lihat Riwayat Deployment
```bash
# Di server
cd /www/wwwroot/wa-blast-pro

# Lihat git log
git log --oneline -10

# Lihat riwayat restart container
docker ps -a

# Lihat deployment logs
tail -f /var/log/wa_blast_deploy.log
```

### Buat Deployment Log
```bash
# Tambah ke deploy script di workflow:
script: |
  cd /www/wwwroot/wa-blast-pro
  echo "[$(date)] Deployment dimulai" >> /var/log/wa_blast_deploy.log
  git pull origin main
  docker-compose build app
  docker-compose up -d
  echo "[$(date)] Deployment selesai" >> /var/log/wa_blast_deploy.log
```

---

## 🛡️ Best Practices Keamanan

### 1. Gunakan Deploy Tokens
Daripada SSH keys, gunakan GitHub deploy tokens:
```bash
# Generate token: GitHub → Settings → Developer settings → Personal access tokens
# Tambah ke server:
git remote set-url origin https://TOKEN@github.com/USER/REPO.git
```

### 2. Batasi Akses SSH Key
```bash
# Di server, batasi key untuk command spesifik
nano ~/.ssh/authorized_keys

# Tambahkan di awal key:
command="/usr/local/bin/deploy.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding ssh-rsa AAAA...
```

### 3. Gunakan Enkripsi Secrets
- Jangan commit secrets ke git
- Gunakan GitHub encrypted secrets
- Rotasi secrets secara berkala

### 4. Audit Deployments
```bash
# Log semua deployments
script: |
  echo "Deployed by: $GITHUB_ACTOR at $(date)" >> /var/log/deployments.log
  echo "Commit: $GITHUB_SHA" >> /var/log/deployments.log
```

---

## 🧪 Testing CI/CD

### Tes Workflow Lokal
```bash
# Install act (https://github.com/nektos/act)
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Jalankan workflow lokal
act push

# Jalankan job spesifik
act -j deploy
```

### Dry Run Deployment
```bash
# Di workflow, tambah:
- name: Dry run
  run: echo "Akan deploy ke ${{ secrets.SERVER_HOST }}"
  if: github.event_name == 'pull_request'
```

---

## 📝 Checklist Deployment

Sebelum enable auto-deploy:
- [ ] SSH key berfungsi
- [ ] Semua GitHub secrets terkonfigurasi
- [ ] Git pull berfungsi di server
- [ ] Docker build berfungsi
- [ ] Health check endpoint merespon
- [ ] Rencana rollback siap
- [ ] Monitoring setup
- [ ] Backup sebelum deploy
- [ ] Notifikasi dikonfigurasi
- [ ] Tes manual dulu

---

## 🆘 Troubleshooting

### Workflow gagal di step SSH
```bash
# Cek format SSH key
# Pastikan seluruh key tercopy termasuk BEGIN/END
# Cek server firewall allow SSH
# Tes SSH manual: ssh -i key root@server
```

### Git pull gagal
```bash
# Di server:
git config credential.helper store
git pull  # Masukkan credentials sekali

# Atau gunakan deploy key (lihat Langkah 5)
```

### Docker build gagal
```bash
# Cek disk space
df -h

# Clean Docker
docker system prune -a

# Cek Docker logs
docker-compose logs
```

### Health check gagal
```bash
# Tambah timeout lebih lama
- name: Health check
  run: |
    sleep 30  # Tunggu lebih lama
    curl -f https://domain-anda.com/api/health
```

---

## 🎯 Langkah Selanjutnya

1. ✅ Tes deployment manual dulu
2. ✅ Enable workflow
3. ✅ Buat test commit
4. ✅ Pantau tab Actions
5. ✅ Verifikasi deployment
6. ✅ Setup notifikasi
7. ✅ Dokumentasi proses rollback
8. ✅ Latih tim tentang workflow

---

## 📚 Resources

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [SSH Action](https://github.com/appleboy/ssh-action)

---

**Status**: ✅ Siap Deploy  
**Waktu Deployment**: ~2 menit  
**Downtime**: ~30 detik
