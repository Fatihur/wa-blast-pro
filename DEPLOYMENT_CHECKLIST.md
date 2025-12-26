# ✅ Deployment Checklist - Pre & Post Deployment

## 📋 Pre-Deployment Checklist

### Server Preparation
- [ ] VPS/Server provisioned (min 2GB RAM, 2 CPU cores)
- [ ] Ubuntu 20.04+ installed
- [ ] Root/sudo access confirmed
- [ ] SSH access working
- [ ] Firewall configured (ports 80, 443, 22 open)
- [ ] Domain DNS configured (A record pointing to server IP)
- [ ] Domain propagated (check with `nslookup yourdomain.com`)

### Software Installation
- [ ] aaPanel installed and accessible
- [ ] Docker installed (`docker --version`)
- [ ] Docker Compose installed (`docker-compose --version`)
- [ ] Nginx installed (via aaPanel or system)
- [ ] MySQL 8.0+ available
- [ ] Redis available
- [ ] Git installed
- [ ] Certbot installed (for SSL)

### Project Setup
- [ ] Project repository accessible
- [ ] `.env` file created from `.env.production.example`
- [ ] All secrets generated (JWT, passwords, etc.)
- [ ] All passwords changed from defaults
- [ ] Environment variables verified
- [ ] `docker-compose.yml` updated with production values
- [ ] Dockerfile reviewed
- [ ] `.dockerignore` configured

### Database Preparation
- [ ] MySQL root password set
- [ ] Database user created
- [ ] Database permissions granted
- [ ] Schema SQL file ready
- [ ] Backup of existing data (if migration)

### Security Configuration
- [ ] Strong passwords generated (min 20 chars)
- [ ] JWT secrets generated (64+ chars)
- [ ] SSH key authentication enabled
- [ ] Password authentication disabled (optional but recommended)
- [ ] Firewall rules configured
- [ ] Fail2ban installed (optional)
- [ ] SELinux/AppArmor configured (if applicable)

### Frontend Build
- [ ] Frontend built (`npm run build`)
- [ ] Build artifacts verified (`dist/` folder)
- [ ] API URL configured for production
- [ ] Socket.IO URL configured
- [ ] Environment-specific configs updated

### CI/CD Setup (if using)
- [ ] GitHub Actions workflow configured
- [ ] SSH deploy key generated
- [ ] Public key added to server
- [ ] Private key added to GitHub secrets
- [ ] All GitHub secrets configured
- [ ] Workflow tested

### Backup Strategy
- [ ] Backup script created
- [ ] Backup location configured
- [ ] Backup schedule set (cron)
- [ ] Restore procedure documented
- [ ] Backup tested

---

## 🚀 Deployment Steps

### Phase 1: Initial Setup
- [ ] Clone repository to `/www/wwwroot/wa-blast-pro`
- [ ] Set directory permissions (`chown -R www:www`)
- [ ] Copy and configure `.env` file
- [ ] Verify all files present

### Phase 2: Docker Build
- [ ] Run `docker-compose build`
- [ ] Verify build completes without errors
- [ ] Check Docker images created (`docker images`)

### Phase 3: Start Services
- [ ] Run `docker-compose up -d`
- [ ] Check containers status (`docker-compose ps`)
- [ ] Verify all containers running
- [ ] Check logs for errors (`docker-compose logs`)

### Phase 4: Database Initialization
- [ ] Access MySQL container
- [ ] Verify database created
- [ ] Verify tables created (12 tables)
- [ ] Test database connection

### Phase 5: Nginx Configuration
- [ ] Add site in aaPanel
- [ ] Configure reverse proxy
- [ ] Test Nginx config (`nginx -t`)
- [ ] Reload Nginx

### Phase 6: SSL Certificate
- [ ] Request Let's Encrypt certificate
- [ ] Verify certificate installed
- [ ] Test HTTPS access
- [ ] Enable HTTPS redirect

### Phase 7: Verification
- [ ] Test HTTP → HTTPS redirect
- [ ] Test API health endpoint
- [ ] Test frontend loads
- [ ] Test registration
- [ ] Test login
- [ ] Test all major features

---

## ✅ Post-Deployment Verification

### Infrastructure Tests

#### 1. Server Health
```bash
# Check system resources
free -h
df -h
top

# Should have:
# - At least 500MB free RAM
# - At least 5GB free disk space
# - CPU usage < 80%
```

#### 2. Docker Status
```bash
docker-compose ps

# All containers should show:
# STATE: Up
```

#### 3. Container Logs
```bash
docker-compose logs app | tail -50

# Should see:
# ✅ Database connected successfully
# ✅ Server running on http://localhost:3001
# ✅ No error messages
```

#### 4. Database Connection
```bash
docker exec -it wa-blast-mysql mysql -u root -p

mysql> SHOW DATABASES;
mysql> USE wa_blast_pro;
mysql> SHOW TABLES;
mysql> SELECT COUNT(*) FROM users;
```

Expected output:
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

#### 5. Redis Connection
```bash
docker exec -it wa-blast-redis redis-cli -a YOUR_REDIS_PASSWORD

127.0.0.1:6379> PING
# Expected: PONG

127.0.0.1:6379> INFO server
# Should show Redis version and uptime
```

### Application Tests

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

#### 7. Frontend Access
```bash
curl -I https://yourdomain.com

# Expected:
# HTTP/2 200
# Content-Type: text/html
```

Open in browser:
```
https://yourdomain.com
```

Should see:
- ✅ Login page loads
- ✅ No console errors (F12)
- ✅ HTTPS padlock in browser
- ✅ SSL certificate valid

#### 8. API Endpoints
```bash
# Test registration
curl -X POST https://yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "name": "Test User"
  }'

# Expected: Success response with user data
```

```bash
# Test login
curl -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'

# Expected: Success with JWT token
```

#### 9. Socket.IO Connection
Open browser console (F12) on your site:
```javascript
// Should see:
Socket connected: [socket-id]
```

#### 10. WhatsApp Connection
1. Navigate to Connection page
2. Click "Connect WhatsApp"
3. Wait 30-90 seconds
4. Verify QR code appears
5. Scan with phone
6. Verify connection successful

### Security Tests

#### 11. SSL/TLS Grade
```bash
# Check SSL configuration
openssl s_client -connect yourdomain.com:443 -tls1_2

# Or use online tool:
# https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com
```

Expected Grade: A or A+

#### 12. Security Headers
```bash
curl -I https://yourdomain.com

# Should include:
# Strict-Transport-Security: max-age=...
# X-Content-Type-Options: nosniff
# X-Frame-Options: SAMEORIGIN
# X-XSS-Protection: 1; mode=block
```

#### 13. Rate Limiting
```bash
# Test rate limit
for i in {1..10}; do
  curl -X POST https://yourdomain.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test","password":"test"}'
done

# After 5 attempts, should see:
# HTTP/1.1 429 Too Many Requests
```

#### 14. CORS Policy
```bash
curl -I -X OPTIONS https://yourdomain.com/api/health \
  -H "Origin: https://malicious-site.com"

# Should reject or only allow configured origins
```

### Performance Tests

#### 15. Response Time
```bash
curl -o /dev/null -s -w 'Total: %{time_total}s\n' https://yourdomain.com/api/health

# Should be < 1 second
```

#### 16. Load Test
```bash
# Install apache bench if needed
apt-get install apache2-utils

# Test 100 requests, 10 concurrent
ab -n 100 -c 10 https://yourdomain.com/api/health

# Check:
# - Failed requests: 0
# - Requests per second: > 50
```

#### 17. Memory Usage
```bash
docker stats --no-stream

# Check memory usage:
# - App container: < 500MB under normal load
# - MySQL: < 1GB
# - Redis: < 256MB
```

### Monitoring Tests

#### 18. Log Files
```bash
# Check log files exist and are being written
ls -lh /www/wwwroot/wa-blast-pro/server/logs/

# Should see:
# - combined.log (recent timestamp)
# - error.log (recent timestamp)
# - access.log (if configured)

# Check log content
tail -f /www/wwwroot/wa-blast-pro/server/logs/combined.log
# Should see recent activity
```

#### 19. Log Rotation
```bash
# Check logrotate config
cat /etc/logrotate.d/wa-blast

# Test logrotate
logrotate -d /etc/logrotate.d/wa-blast
```

#### 20. Backup Verification
```bash
# Check backup files
ls -lh /root/backups/wa-blast/

# Should see recent backups:
# - db_YYYYMMDD_HHMMSS.sql
# - sessions_YYYYMMDD_HHMMSS.tar.gz
# - env_YYYYMMDD_HHMMSS.backup

# Test restore
mysql -u root -p wa_blast_pro_test < /root/backups/wa-blast/db_latest.sql
```

---

## 📊 Performance Benchmarks

After deployment, record these metrics:

| Metric | Target | Actual |
|--------|--------|--------|
| Page load time | < 3s | _____ |
| API response time | < 500ms | _____ |
| Database query time | < 100ms | _____ |
| Memory usage (app) | < 500MB | _____ |
| Memory usage (total) | < 1.5GB | _____ |
| Disk usage | < 10GB | _____ |
| CPU usage (idle) | < 20% | _____ |
| SSL Grade | A+ | _____ |
| Uptime (first week) | 99.9% | _____ |

---

## 🔍 Common Issues & Solutions

### Issue: Container keeps restarting
```bash
docker-compose logs app
# Check for:
# - Database connection errors → Verify DB_PASSWORD
# - Port conflicts → Change PORT in .env
# - Missing secrets → Check .env file
```

### Issue: Can't access site
```bash
# Check Nginx
nginx -t
systemctl status nginx

# Check firewall
ufw status
ufw allow 80
ufw allow 443

# Check DNS
nslookup yourdomain.com
```

### Issue: SSL certificate fails
```bash
# Check DNS first
dig yourdomain.com

# Check port 80 accessible
curl http://yourdomain.com

# Try manual certbot
certbot certonly --nginx -d yourdomain.com
```

### Issue: Database connection fails
```bash
# Check MySQL container
docker-compose ps mysql

# Check credentials
docker exec -it wa-blast-mysql mysql -u root -p

# Recreate database
docker-compose down
docker volume rm wa-blast-pro_mysql_data
docker-compose up -d
```

---

## 📝 Post-Deployment Tasks

### Immediate (Day 1)
- [ ] Monitor error logs for first hour
- [ ] Test all critical features
- [ ] Verify backups running
- [ ] Check performance metrics
- [ ] Update documentation with server details
- [ ] Share access with team
- [ ] Setup monitoring alerts

### Short Term (Week 1)
- [ ] Monitor uptime
- [ ] Review error logs daily
- [ ] Check disk space
- [ ] Verify backup integrity
- [ ] Performance tuning if needed
- [ ] User acceptance testing
- [ ] Fix any reported issues

### Medium Term (Month 1)
- [ ] Review security logs
- [ ] Update dependencies
- [ ] Optimize database queries
- [ ] Review and adjust resource limits
- [ ] Plan scaling strategy
- [ ] Document lessons learned
- [ ] Schedule regular maintenance

### Long Term (Ongoing)
- [ ] Monthly security audits
- [ ] Quarterly dependency updates
- [ ] Bi-annual password rotation
- [ ] Annual SSL certificate renewal (auto)
- [ ] Capacity planning reviews
- [ ] Disaster recovery drills

---

## 📞 Emergency Contacts

Document these for your team:

- **Server IP**: _______________
- **Domain**: _______________
- **aaPanel URL**: _______________
- **GitHub Repo**: _______________
- **Server Provider**: _______________
- **DNS Provider**: _______________
- **Emergency Contact**: _______________
- **Backup Location**: _______________

---

## 🎯 Success Criteria

Deployment is considered successful when:

- ✅ All containers running without restart
- ✅ Application accessible via HTTPS
- ✅ SSL certificate valid (A+ grade)
- ✅ All API endpoints responding
- ✅ Database queries working
- ✅ Can register and login
- ✅ Can connect WhatsApp
- ✅ No critical errors in logs
- ✅ Backups configured and tested
- ✅ Monitoring setup and alerting
- ✅ Team can access and use system
- ✅ Performance meets targets

---

**Deployment Date**: _________________
**Deployed By**: _________________
**Version**: _________________
**Status**: ⬜ Pending | ⬜ In Progress | ⬜ Complete | ⬜ Issues

**Sign Off**:
- Technical Lead: _________________ Date: _______
- Project Manager: _________________ Date: _______
- QA: _________________ Date: _______
