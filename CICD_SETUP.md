# 🔄 CI/CD Setup Guide - GitHub Actions

## Overview
Automatically deploy to your server whenever you push to `main` branch.

---

## Step 1: Generate SSH Key

**On your local machine**:
```bash
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy"
# Save to: github_deploy_key
# No passphrase (just press Enter)

# View private key
cat github_deploy_key
# Copy entire content

# View public key
cat github_deploy_key.pub
# Copy this too
```

---

## Step 2: Add Public Key to Server

**SSH to your server**:
```bash
ssh root@your-server-ip

# Add public key
nano ~/.ssh/authorized_keys
# Paste the public key from github_deploy_key.pub
# Save and exit

# Set permissions
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

**Test the key**:
```bash
# From local machine
ssh -i github_deploy_key root@your-server-ip
# Should login without password
```

---

## Step 3: Configure GitHub Secrets

1. Go to your GitHub repo
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

Add these secrets:

### SERVER_HOST
```
Value: your-server-ip
# Or domain: wa-blast.yourdomain.com
```

### SERVER_USER
```
Value: root
```

### SSH_PRIVATE_KEY
```
Value: [paste entire private key from github_deploy_key]

-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAACFwAAAAdzc2gtcn
... (all lines)
-----END OPENSSH PRIVATE KEY-----
```

### SSH_PORT
```
Value: 22
# Or your custom SSH port
```

### DOCKER_USERNAME (optional)
```
Value: your-dockerhub-username
# Only if pushing to Docker Hub
```

### DOCKER_PASSWORD (optional)
```
Value: your-dockerhub-token
# Only if pushing to Docker Hub
```

---

## Step 4: Update Workflow File

The workflow file is already created at `.github/workflows/ci-cd.yml`.

**Update the deploy script section**:
```yaml
# ... existing content ...

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
            docker-compose build --no-cache app
            docker-compose up -d
            docker system prune -f
            echo "Deployment completed at $(date)"
      
      - name: Health check
        run: |
          sleep 10
          curl -f https://yourdomain.com/api/health || exit 1
      
      - name: Notify success
        if: success()
        run: echo "✅ Deployment successful!"
```

---

## Step 5: Setup Deploy Key for Git Pull

**On server, allow git pull**:
```bash
cd /www/wwwroot/wa-blast-pro

# Configure git
git config --global user.name "GitHub Actions"
git config --global user.email "actions@github.com"

# Test git pull
git pull origin main
# Should work without asking for credentials
```

**If using private repo**, add deploy key:
```bash
# On server, generate key
ssh-keygen -t rsa -b 4096 -C "server-git-access"
cat ~/.ssh/id_rsa.pub

# Copy the output
```

Then:
1. GitHub repo → **Settings** → **Deploy keys**
2. **Add deploy key**
3. Paste the public key
4. Check "Allow write access" if needed
5. **Add key**

---

## Step 6: Test Deployment

**Make a test change**:
```bash
# Edit a file
echo "// CI/CD test" >> README.md

# Commit and push
git add .
git commit -m "test: CI/CD deployment"
git push origin main
```

**Watch the workflow**:
1. Go to GitHub → **Actions** tab
2. You should see the workflow running
3. Click on it to see progress

**Expected flow**:
```
✅ Lint & Type Check
✅ Run Tests  
✅ Build Application
✅ Security Scan
✅ Build Docker Image
✅ Deploy to Production
   → SSH to server
   → Git pull
   → Docker rebuild
   → Docker restart
   → Health check
✅ Deployment successful!
```

---

## Step 7: Verify Deployment

**On server**:
```bash
# Check containers
docker ps

# View deploy logs
docker-compose logs -f app

# Test health
curl http://localhost:3001/api/health
```

**On website**:
1. Visit your domain
2. Refresh page (Ctrl+F5)
3. Check if changes are live

---

## 🎯 Deployment Strategy Options

### Option 1: Direct Deploy (Current)
- Git pull → Rebuild → Restart
- **Pros**: Simple, fast
- **Cons**: Brief downtime (~30s)

### Option 2: Blue-Green Deployment
```yaml
# In workflow file:
script: |
  cd /www/wwwroot/wa-blast-pro
  git pull origin main
  
  # Build new image with tag
  docker-compose build app
  docker tag wa-blast-pro_app:latest wa-blast-pro_app:blue
  
  # Start blue (new version)
  docker run -d --name app-blue wa-blast-pro_app:blue
  
  # Health check
  sleep 10
  curl -f http://localhost:3002/api/health
  
  # Switch traffic (update nginx)
  # Stop old green, start blue
  docker stop app-green
  docker rename app-blue app-green
```

### Option 3: Rolling Update
Use Docker Swarm or Kubernetes for zero-downtime.

---

## 🔔 Notifications

### Add Slack Notifications

**Add to workflow**:
```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Deployment ${{ job.status }}'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

**Setup**:
1. Slack → Apps → Incoming Webhooks
2. Create webhook
3. Copy webhook URL
4. Add to GitHub secrets as `SLACK_WEBHOOK`

### Add Email Notifications

**Add to workflow**:
```yaml
- name: Send email
  if: failure()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: 'Deployment Failed!'
    to: your-email@domain.com
    from: GitHub Actions
    body: Deployment failed. Check logs.
```

---

## 📊 Monitoring Deployments

### View Deployment History
```bash
# On server
cd /www/wwwroot/wa-blast-pro

# View git log
git log --oneline -10

# View container restart history
docker ps -a

# View deployment logs
tail -f /var/log/wa_blast_deploy.log
```

### Create Deployment Log
```bash
# Add to deploy script in workflow:
script: |
  cd /www/wwwroot/wa-blast-pro
  echo "[$(date)] Deployment started" >> /var/log/wa_blast_deploy.log
  git pull origin main
  docker-compose build app
  docker-compose up -d
  echo "[$(date)] Deployment completed" >> /var/log/wa_blast_deploy.log
```

---

## 🛡️ Security Best Practices

### 1. Use Deploy Tokens
Instead of SSH keys, use GitHub deploy tokens:
```bash
# Generate token: GitHub → Settings → Developer settings → Personal access tokens
# Add to server:
git remote set-url origin https://TOKEN@github.com/USER/REPO.git
```

### 2. Limit SSH Key Access
```bash
# On server, restrict key to specific commands
nano ~/.ssh/authorized_keys

# Prepend to key:
command="/usr/local/bin/deploy.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding ssh-rsa AAAA...
```

### 3. Use Secrets Encryption
- Never commit secrets to git
- Use GitHub encrypted secrets
- Rotate secrets regularly

### 4. Audit Deployments
```bash
# Log all deployments
script: |
  echo "Deployed by: $GITHUB_ACTOR at $(date)" >> /var/log/deployments.log
  echo "Commit: $GITHUB_SHA" >> /var/log/deployments.log
```

---

## 🧪 Testing CI/CD

### Test Workflow Locally
```bash
# Install act (https://github.com/nektos/act)
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run workflow locally
act push

# Run specific job
act -j deploy
```

### Dry Run Deployment
```bash
# In workflow, add:
- name: Dry run
  run: echo "Would deploy to ${{ secrets.SERVER_HOST }}"
  if: github.event_name == 'pull_request'
```

---

## 📝 Deployment Checklist

Before enabling auto-deploy:
- [ ] SSH key working
- [ ] All GitHub secrets configured
- [ ] Git pull works on server
- [ ] Docker build works
- [ ] Health check endpoint responding
- [ ] Rollback plan ready
- [ ] Monitoring setup
- [ ] Backup before deploy
- [ ] Notifications configured
- [ ] Tested manually first

---

## 🆘 Troubleshooting

### Workflow fails at SSH step
```bash
# Check SSH key format
# Ensure entire key is copied including BEGIN/END lines
# Check server firewall allows SSH
# Test SSH manually: ssh -i key root@server
```

### Git pull fails
```bash
# On server:
git config credential.helper store
git pull  # Enter credentials once

# Or use deploy key (see Step 5)
```

### Docker build fails
```bash
# Check disk space
df -h

# Clean Docker
docker system prune -a

# Check Docker logs
docker-compose logs
```

### Health check fails
```bash
# Increase timeout
- name: Health check
  run: |
    sleep 30  # Wait longer
    curl -f https://yourdomain.com/api/health
```

---

## 🎯 Next Steps

1. ✅ Test deployment manually first
2. ✅ Enable workflow
3. ✅ Make test commit
4. ✅ Watch Actions tab
5. ✅ Verify deployment
6. ✅ Setup notifications
7. ✅ Document rollback process
8. ✅ Train team on workflow

---

## 📚 Resources

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [SSH Action](https://github.com/appleboy/ssh-action)

---

**Status**: ✅ Ready to Deploy  
**Deployment Time**: ~2 minutes  
**Downtime**: ~30 seconds
