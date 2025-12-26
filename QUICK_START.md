# 🚀 Quick Start Guide - WA-Blast-Pro

## Prerequisites
- Node.js 20+ installed
- MySQL 8.0+ installed (or use Docker)
- Git installed

---

## 🎯 Option 1: Quick Start (Development)

### 1. Clone & Install
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Configure Environment
```bash
cd server
cp .env.example .env

# IMPORTANT: Edit .env file and set:
# - JWT_SECRET (generate with: openssl rand -base64 64)
# - JWT_REFRESH_SECRET (generate with: openssl rand -base64 64)
# - PASSWORD_PEPPER (generate with: openssl rand -base64 32)
# - Database credentials
```

### 3. Initialize Database
```bash
cd server
npm run db:init
```

### 4. Start Development Servers
```bash
# Terminal 1: Backend
cd server
npm run dev

# Terminal 2: Frontend  
npm run dev
```

### 5. Access Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/api/health

---

## 🐳 Option 2: Docker (Recommended for Production-like Setup)

### 1. Clone Project
```bash
git clone <your-repo>
cd wa-blast-pro
```

### 2. Create Environment File
```bash
# Create .env file in project root
cp server/.env.example .env

# Edit .env and set:
JWT_SECRET=<generate-secure-secret>
JWT_REFRESH_SECRET=<generate-secure-secret>
PASSWORD_PEPPER=<generate-secure-secret>
DB_PASSWORD=securepassword123
ALLOWED_ORIGINS=http://localhost:5173
```

### 3. Start with Docker Compose
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 4. Initialize Database (First time only)
```bash
# Access MySQL container
docker-compose exec mysql mysql -u root -p

# Run initialization script (or use db:init script)
```

### 5. Access Application
- Application: http://localhost:3001
- Health Check: http://localhost:3001/api/health

---

## 🧪 Running Tests

```bash
cd server

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run unit tests only
npm run test:unit
```

---

## 🔐 Security Setup (IMPORTANT!)

### Generate Secure Secrets
```bash
# For Linux/Mac
openssl rand -base64 64  # JWT_SECRET
openssl rand -base64 64  # JWT_REFRESH_SECRET
openssl rand -base64 32  # PASSWORD_PEPPER

# For Windows (PowerShell)
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Update .env File
```env
JWT_SECRET=<your-generated-secret>
JWT_REFRESH_SECRET=<your-generated-refresh-secret>
PASSWORD_PEPPER=<your-generated-pepper>
```

---

## 📊 Monitoring

### Check Application Health
```bash
curl http://localhost:3001/api/health
```

### View Logs
```bash
# Docker
docker-compose logs -f app

# Development
cd server
tail -f logs/combined.log
tail -f logs/error.log
```

---

## 🛠️ Common Commands

### Development
```bash
# Start frontend dev server
npm run dev

# Start backend dev server  
cd server && npm run dev

# Run both (if you have concurrently installed)
npm run dev:all
```

### Build
```bash
# Build frontend
npm run build

# Build backend
cd server && npm run build
```

### Database
```bash
# Initialize/reset database
cd server && npm run db:init

# Check schema
cd server && npm run check-schema
```

### Docker
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Rebuild images
docker-compose build

# View logs
docker-compose logs -f [service-name]

# Access MySQL
docker-compose exec mysql mysql -u root -p

# Access Redis CLI
docker-compose exec redis redis-cli
```

---

## 🔍 Troubleshooting

### Database Connection Issues
```bash
# Check MySQL is running
docker-compose ps mysql
# or
mysql -u root -p -e "SELECT 1"

# Check database exists
mysql -u root -p -e "SHOW DATABASES"
```

### Port Already in Use
```bash
# Check what's using port 3001
# Windows
netstat -ano | findstr :3001

# Linux/Mac
lsof -i :3001

# Kill the process or change PORT in .env
```

### WhatsApp Connection Issues
1. Make sure you have Google Chrome installed (required by whatsapp-web.js)
2. Check WhatsApp session directory has proper permissions
3. Clear session data: `rm -rf server/wa-session/*`
4. Try connecting again

### Docker Issues
```bash
# Remove all containers and volumes
docker-compose down -v

# Rebuild from scratch
docker-compose build --no-cache

# Check Docker logs
docker-compose logs app
```

---

## 📚 Next Steps

1. ✅ Read `IMPROVEMENTS.md` for security enhancements
2. ✅ Set up CI/CD pipeline (see `.github/workflows/ci-cd.yml`)
3. ✅ Configure monitoring and alerting
4. ✅ Set up automated backups
5. ✅ Review security checklist in `IMPROVEMENTS.md`
6. ✅ Add more tests to increase coverage
7. ✅ Set up Redis caching for better performance

---

## 🆘 Getting Help

### Check Logs
```bash
# Application logs
cd server/logs
tail -f combined.log

# Error logs only
tail -f error.log
```

### Health Check
```bash
curl http://localhost:3001/api/health | jq
```

### Debug Mode
```bash
# Set log level to debug in .env
LOG_LEVEL=debug

# Restart application
```

---

## 🎉 You're Ready!

The application should now be running with:
- ✅ Enhanced security
- ✅ Rate limiting
- ✅ Structured logging
- ✅ Error handling
- ✅ Health checks
- ✅ Docker support
- ✅ Testing infrastructure

Happy coding! 🚀
