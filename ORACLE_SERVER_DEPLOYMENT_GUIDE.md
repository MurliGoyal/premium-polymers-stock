# Premium Polymers — Oracle Server Deployment Guide

> **Port:** `3001` · **Method:** GitHub Clone + SSH terminal · **Stack:** Docker Compose (Next.js + PostgreSQL)

---

## Table of Contents

1. [What You Need Before Starting](#1-what-you-need-before-starting)
2. [Architecture Overview](#2-architecture-overview)
3. [Step 1 — Connect to Your Oracle Server](#3-step-1--connect-to-your-oracle-server)
4. [Step 2 — Install Docker and Git on the Server](#4-step-2--install-docker-and-git-on-the-server)
5. [Step 3 — Clone the Repository from GitHub](#5-step-3--clone-the-repository-from-github)
6. [Step 4 — Create the Production Environment File](#6-step-4--create-the-production-environment-file)
7. [Step 5 — Create docker-compose.yml](#7-step-5--create-docker-composeyml)
8. [Step 6 — Build the Docker Image](#8-step-6--build-the-docker-image)
9. [Step 7 — Start PostgreSQL](#9-step-7--start-postgresql)
10. [Step 8 — Set Up the Database](#10-step-8--set-up-the-database)
11. [Step 9 — Start the App](#11-step-9--start-the-app)
12. [Step 10 — Test It](#12-step-10--test-it)
13. [Step 11 — Open Port 3001 in Oracle Cloud](#13-step-11--open-port-3001-in-oracle-cloud)
14. [Step 12 — Open Linux Firewall](#14-step-12--open-linux-firewall)
15. [Step 13 — Access from Your Browser](#15-step-13--access-from-your-browser)
16. [How to Update the App Later Using GitHub](#16-how-to-update-the-app-later-using-github)
17. [How to Back Up the Database](#17-how-to-back-up-the-database)
18. [Useful Docker Commands](#18-useful-docker-commands)
19. [Troubleshooting](#19-troubleshooting)
20. [Optional — Nginx Reverse Proxy + HTTPS](#20-optional--nginx-reverse-proxy--https)
21. [Production Security Checklist](#21-production-security-checklist)

---

## 1. What You Need Before Starting

| Item | Details |
|------|---------|
| **Oracle Cloud VM** | A running Linux instance (Ubuntu recommended) |
| **SSH access** | Your server's public IP + SSH key or password (using PuTTY or Windows Terminal) |
| **GitHub Repo URL** | e.g., `https://github.com/yourusername/premiumpolymers.git` |
| **GitHub Token** | A GitHub Personal Access Token (classic or fine-grained) with `repo` access |
| **Oracle security rule** | Port `3001` open for inbound TCP (you said this is already done ✅) |

---

## 2. Architecture Overview

```
GitHub Repository                  Oracle Cloud Server
┌─────────────┐                   ┌──────────────────────────────────┐
│             │                   │  /opt/premium-polymers/app/      │
│ Source Code │───── Clone ──────▶│                                  │
│             │    & Pull         │  ┌────────────────────────────┐  │
└─────────────┘                   │  │ Docker Compose             │  │
                                  │  │  ┌──────────┐ ┌─────────┐ │  │
Your Browser                      │  │  │ Next.js  │ │Postgres │ │  │
┌─────────────┐                   │  │  │ App:3001 │─│ DB:5432 │ │  │
│  Browser    │◀──── Port 3001 ──│  │  └──────────┘ └─────────┘ │  │
└─────────────┘                   │  └────────────────────────────┘  │
                                  └──────────────────────────────────┘
```

- Target deployment directory: `/opt/premium-polymers/app`
- The app runs on port **3001** inside Docker
- You access the app from your browser at `http://YOUR_SERVER_IP:3001`

---

## 3. Step 1 — Connect to Your Oracle Server

Open Windows Terminal, PowerShell, or PuTTY on your PC and SSH into your server:

```powershell
ssh ubuntu@YOUR_SERVER_IP
```

> 💡 **Throughout this guide**, every command starting with `$` should be typed in this **SSH terminal** on the server. Do not type the `$` character itself.

---

## 4. Step 2 — Install Docker and Git on the Server

First, check if Docker and Git are already installed:

```bash
docker --version
docker compose version
git --version
```

If everything shows a version number, **skip to Step 3**.

If **Git** is missing:
```bash
sudo apt update
sudo apt install -y git
```

If **Docker** is missing, run these commands:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
newgrp docker
```

---

## 5. Step 3 — Clone the Repository from GitHub

Instead of uploading files manually, we will pull them securely from GitHub.

First, create the deployment root folder:

```bash
sudo mkdir -p /opt/premium-polymers
sudo mkdir -p /opt/premium-polymers/backups
sudo chown -R $USER:$USER /opt/premium-polymers
cd /opt/premium-polymers
```

Now clone your repository into a folder called `app`.

Replace `yourusername` and `yourrepo` below. When prompted for a password, **paste your GitHub Personal Access Token (PAT)**, not your regular GitHub account password.

```bash
git clone https://github.com/yourusername/yourrepo.git app
```

If you want to bake the token into the URL so Git remembers it for future pulls (convenient but slightly less secure on shared servers), you can do:

```bash
git clone https://yourusername:YOUR_GITHUB_TOKEN@github.com/yourusername/yourrepo.git app
```

Verify the files are there:
```bash
cd /opt/premium-polymers/app
ls -la
```

---

## 6. Step 4 — Create the Production Environment File

Still in the SSH terminal inside the `app` folder:

```bash
cp .env.production.example .env.production
nano .env.production
```

Fill in these values:

```env
DATABASE_URL=postgresql://premium_polymers:YOUR_STRONG_DB_PASSWORD@postgres:5432/premium_polymers
NEXTAUTH_SECRET=YOUR_RANDOM_SECRET_HERE
NEXTAUTH_URL=http://YOUR_SERVER_IP:3001
NEXT_PUBLIC_APP_LOCALE=en-IN
NEXT_PUBLIC_APP_TIME_ZONE=Asia/Kolkata
NODE_ENV=production
```

### Replace these placeholders:

| Placeholder | What to Put |
|------------|-------------|
| `YOUR_STRONG_DB_PASSWORD` | A strong password for PostgreSQL (e.g., `Pr3m!um_P0ly2026`) |
| `YOUR_RANDOM_SECRET_HERE` | Generate one by running `openssl rand -hex 32` in the terminal, or type a long random string |
| `YOUR_SERVER_IP` | Your Oracle server's public IP address |

Save and exit `nano`: Press `Ctrl+O`, then `Enter`, then `Ctrl+X`.

---

## 7. Step 5 — Create docker-compose.yml

```bash
cp docker-compose.example.yml docker-compose.yml
nano docker-compose.yml
```

The file should look like this:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: premium-polymers-app
    restart: unless-stopped
    env_file:
      - .env.production
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "3001:3001"

  postgres:
    image: postgres:16
    container_name: premium-polymers-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: premium_polymers
      POSTGRES_USER: premium_polymers
      POSTGRES_PASSWORD: YOUR_STRONG_DB_PASSWORD
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U premium_polymers -d premium_polymers"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - premium-polymers-postgres:/var/lib/postgresql/data

volumes:
  premium-polymers-postgres:
```

### ⚠️ Critical: Match the Password!

The `POSTGRES_PASSWORD` in this file **must match** the password you set in `DATABASE_URL` in `.env.production`.

Save and exit `nano`: Press `Ctrl+O`, then `Enter`, then `Ctrl+X`.

---

## 8. Step 6 — Build the Docker Image

Build the image. This will take **5–15 minutes** the first time.

```bash
docker compose build
```

You will see a lot of output ending with something like:
```
 => exporting to image
 => => naming to docker.io/library/app-app
```

---

## 9. Step 7 — Start PostgreSQL

Start only the database container first:

```bash
docker compose up -d postgres
```

Wait 10 seconds, then verify it's healthy:

```bash
docker compose ps
```

You should see `Up x seconds (healthy)`.

---

## 10. Step 8 — Set Up the Database

Run these commands to create tables and insert demo data:

### Generate Prisma Client
```bash
docker compose run --rm app npx prisma generate
```

### Create Database Tables
```bash
docker compose run --rm app npx prisma db push
```

### Seed Demo Data
```bash
docker compose run --rm app npx tsx prisma/seed.ts
```

> ⚠️ **Important:** The seed creates demo users like `admin@premiumpolymers.com` with password `admin123`. Change these passwords immediately after your first login!

---

## 11. Step 9 — Start the App

```bash
docker compose up -d app
```

Check it's running:
```bash
docker compose ps
docker compose logs app
```

---

## 12. Step 10 — Test It

Test locally from the server terminal:

```bash
curl http://localhost:3001/login
```

If you get HTML back (a wall of text), the app is working! 🎉

---

## 13. Step 11 — Open Port 3001 in Oracle Cloud

You mentioned you've already done this ✅. To verify:
1. Go to Oracle Cloud Console → Networking → Virtual Cloud Networks → Security Lists
2. Ensure there's an Ingress Rule allowing TCP port `3001`.

---

## 14. Step 12 — Open Linux Firewall

Oracle Linux instances often block ports via iptables.

**For Ubuntu:**
```bash
sudo iptables -I INPUT -p tcp --dport 3001 -j ACCEPT
sudo netfilter-persistent save
```

**For Oracle Linux:**
```bash
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

---

## 15. Step 13 — Access from Your Browser

Open your browser and go to:

```
http://YOUR_SERVER_IP:3001
```

Log in with:
- **Email:** `admin@premiumpolymers.com`
- **Password:** `admin123`

---

## 16. How to Update the App Later Using GitHub

When you make changes to your code locally and push them to GitHub, follow these exact steps to update your live server securely and cleanly:

1. **SSH into the server:**
```powershell
ssh ubuntu@YOUR_SERVER_IP
```

2. **Navigate to the project folder:**
```bash
cd /opt/premium-polymers/app
```

3. **Pull the latest code from GitHub:**
```bash
git stash  # Safely stash any local accidental modifications
git pull
```
*(If prompted, enter your GitHub username and Personal Access Token)*

4. **Back up the database (optional but highly recommended):**
```bash
docker compose exec -T postgres pg_dump -U premium_polymers premium_polymers > /opt/premium-polymers/backups/backup_$(date +%F_%H-%M-%S).sql
```

5. **Rebuild the Docker image with the new code:**
```bash
docker compose build app
```

6. **Apply any database schema changes (run this only if you modified `prisma/schema.prisma`):**
```bash
docker compose run --rm app npx prisma db push
```

7. **Restart the app container to run the new code:**
```bash
docker compose up -d app
```

8. **Check the logs to verify it started smoothly:**
```bash
docker compose logs -f app
```
*(Press `Ctrl+C` to close logs)*

### Quick Update Command (Copy-Paste)
For a standard update where you didn't change the database schema, simply run:
```bash
cd /opt/premium-polymers/app && git pull && docker compose build app && docker compose up -d app && docker compose logs -f app
```

---

## 17. How to Back Up the Database

### Create a Backup
```bash
cd /opt/premium-polymers/app
docker compose exec -T postgres pg_dump -U premium_polymers premium_polymers > /opt/premium-polymers/backups/backup_$(date +%F_%H-%M-%S).sql
```

### Download a Backup to Your PC
Use WinSCP (Server File Protocol) or `scp` to download the `.sql` files from `/opt/premium-polymers/backups/` to your local computer for safekeeping.

---

## 18. Useful Docker Commands

| Command | What It Does |
|---------|-------------|
| `docker compose ps` | Show running containers |
| `docker compose logs app` | View app logs |
| `docker compose logs -f app` | Watch app logs in real-time |
| `docker compose logs postgres` | View database logs |
| `docker compose restart app` | Restart the app |
| `docker compose stop` | Stop everything |
| `docker compose start` | Start everything |
| `docker compose down` | Stop & remove containers (data is saved) |
| `docker compose up -d` | Start everything in background |
| `docker compose build app` | Rebuild the app image |
| `docker compose exec app sh` | Open a shell inside the app |

---

## 19. Troubleshooting

### Problem: Docker build fails with "Cannot find module" or missing file error
**Cause:** The files weren't pulled completely from GitHub.
**Fix:** 
```bash
cd /opt/premium-polymers/app
git status
git pull
```

### Problem: `Error: DATABASE_URL is not configured`
**Cause:** The `.env.production` file is missing or doesn't contain `DATABASE_URL`.
**Fix:** Recreate it using `cp .env.production.example .env.production` and fill the variables. Restart: `docker compose restart app`

### Problem: Database connection error / `ECONNREFUSED`
**Cause:** PostgreSQL container is not running or the password doesn't match.
**Fix:** Check that the postgres container shows `(healthy)`. Ensure the `POSTGRES_PASSWORD` in `docker-compose.yml` matches the password in `DATABASE_URL`.

### Problem: Can log in but sessions don't work / redirect loop
**Cause:** `NEXTAUTH_URL` doesn't match the URL you're using in the browser.
**Fix:** Edit `.env.production` and set: `NEXTAUTH_URL=http://YOUR_SERVER_IP:3001`

### Problem: Built-in `git pull` throws an error about local changes
**Cause:** You edited a file directly on the server (like `package.json` or `schema.prisma`).
**Fix:**
```bash
git stash
git pull
```

---

## 20. Optional — Nginx Reverse Proxy + HTTPS

If you want to use a domain name (like `stocks.yourdomain.com`) instead of `IP:3001`, you can set up Nginx.

### Install Nginx

```bash
sudo apt update
sudo apt install -y nginx
```

### Create Site Configuration

```bash
sudo nano /etc/nginx/sites-available/premium-polymers
```

Paste this (replace `stocks.yourdomain.com`):

```nginx
server {
    listen 80;
    server_name stocks.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/premium-polymers /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Add HTTPS with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d stocks.yourdomain.com
```

After HTTPS is set up, update `.env.production`:
```env
NEXTAUTH_URL=https://stocks.yourdomain.com
```

Then restart: `docker compose restart app`

---

## 21. Production Security Checklist

Before allowing public access, verify:

- [ ] `NEXTAUTH_SECRET` is a long random string (not the example value)
- [ ] `NEXTAUTH_URL` matches the URL users will type in their browser
- [ ] Database password is strong (not `CHANGE_THIS_DB_PASSWORD`)
- [ ] Demo user passwords have been changed after first login
- [ ] PostgreSQL port (5432) is NOT exposed to the internet
- [ ] Oracle Cloud security rules only allow port 3001 (and 22 for SSH)
- [ ] Database backup has been taken and downloaded to your PC

---

## Quick Reference Card

```
┌────────────────────────────────────────────────────────┐
│  Premium Polymers — Quick Commands                     │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Update code limits:   git pull                        │
│  Start everything:     docker compose up -d            │
│  Stop everything:      docker compose down             │
│  View app logs:        docker compose logs -f app      │
│  Rebuild after change: docker compose build app        │
│  Restart app:          docker compose up -d app        │
│                                                        │
│  Project location:     /opt/premium-polymers/app/      │
│  Environment file:     .env.production                 │
│  App URL:              http://YOUR_IP:3001             │
│                                                        │
└────────────────────────────────────────────────────────┘
```
