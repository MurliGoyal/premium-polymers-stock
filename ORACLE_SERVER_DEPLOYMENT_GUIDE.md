# Premium Polymers Deployment Guide for an Existing Oracle Server

This guide explains how to deploy this app on an Oracle Cloud VM that already hosts another project.

The guide is written for beginners and assumes:

- your Oracle server is a Linux VM, usually Ubuntu
- you can SSH into the server
- you use WinSCP on Windows to access the server files
- you already host at least one other app on the same server
- you want the safest and simplest deployment path

The recommended approach in this repo is:

1. run this app with Docker Compose
2. keep PostgreSQL private
3. expose the app through Nginx on a separate subdomain
4. use HTTPS with Let's Encrypt
5. use Git as the main way to deploy and update code
6. use WinSCP to view and edit server files when needed

This is the best fit for an existing server because it keeps this project isolated from the other hosted app.

---

## 1. What You Are Deploying

This project is:

- a Next.js 16 app
- using Prisma
- using PostgreSQL
- using NextAuth credentials login
- expecting these required environment variables:
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`

Important repo facts:

- the app starts with `pnpm start`
- the database schema is applied with `pnpm db:push`
- demo data is inserted with `pnpm db:seed`
- this repo does **not** currently use Prisma migrations for deployment

That last point matters:

- on a fresh database, `pnpm db:push` is fine
- on a database with real data, always back up first before schema changes

---

## 2. Recommended Architecture

Use this layout:

```text
Internet
  ->
DNS for stocks.yourdomain.com
  ->
Nginx on Oracle server
  ->
127.0.0.1:3001
  ->
Docker container running this Next.js app
  ->
PostgreSQL container or existing PostgreSQL server
```

Why this is recommended:

- your existing hosted project stays separate
- this app gets its own container and its own database
- Nginx can route traffic by domain name
- the app port does not need to be public

Recommended domain style:

- `stocks.yourdomain.com`

Avoid path-based deployment like:

- `yourdomain.com/stocks`

A separate subdomain is much easier with Next.js and NextAuth.

---

## 3. Before You Start

Prepare these things first:

- your server public IP
- SSH access to the Oracle server
- a domain or subdomain you control
- `sudo` access on the server
- a decision about database location:
  - easier: dedicated PostgreSQL container for this app
  - alternative: reuse an existing PostgreSQL server, but create a separate database and user

Also decide where the code will come from:

- best: clone from GitHub with Git
- avoid manual zip uploads for normal deployment

Also prepare these Windows-side tools:

- WinSCP
- Git installed on your computer
- either built-in Windows SSH or PuTTY

Why this guide is Git-first:

- future updates become much easier
- you can run `git pull` instead of uploading files every time
- the server stays cleaner and more predictable
- you reduce the chance of missing a file during updates

---

## 4. Important Production Warnings for This Repo

Read this before deploying.

### 4.1 Demo seed users

The current seed script creates demo users such as:

- `admin@premiumpolymers.com`
- password: `admin123`

Do **not** expose that to the internet as-is.

Recommended production-safe options:

1. edit `prisma/seed.ts` before seeding and replace the demo users with your real users and strong passwords
2. or seed once in a private environment, then immediately change all seeded credentials before public access

If you skip seeding entirely, you must still create at least one admin user manually in PostgreSQL, otherwise you cannot log in.

### 4.2 Fresh database vs existing database

If this is a brand new deployment with a new empty database:

- `pnpm db:push` is the correct first step

If this app will point to a database that already contains data:

- back it up before every schema change
- do not treat `db:push` casually

### 4.3 This app now requires production env vars

In production, the app will fail early if these are missing:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

That is intentional and good for production.

---

## 5. Check What Is Already Running on the Server

SSH into the server:

```bash
ssh ubuntu@YOUR_SERVER_IP
```

If your server user is not `ubuntu`, replace it with the correct username.

Now inspect the current server state:

```bash
whoami
pwd
uname -m
docker ps
sudo ss -tulpn
```

What to look for:

- `uname -m`
  - `x86_64` means AMD/Intel
  - `aarch64` means ARM, common on Oracle Ampere
- `docker ps`
  - shows whether Docker is already being used for your other app
- `sudo ss -tulpn`
  - shows which ports are already in use

Pay special attention to:

- `80` for HTTP
- `443` for HTTPS
- `3000`, `3001`, `3002` or similar app ports
- `5432` for PostgreSQL

If another app already uses port `3001`, choose a different port for this app such as `3002`.

### 5.1 How to use WinSCP in this deployment

In this guide:

- Git is used to deploy and update the application code
- Docker Compose is used to run the app
- WinSCP is used to access files on the server in a visual way

Use WinSCP for:

- connecting to the server with SFTP
- browsing folders like `/opt/premium-polymers/app`
- editing files like:
  - `.env.production`
  - `docker-compose.yml`
  - `Dockerfile`
- downloading backups from `/opt/premium-polymers/backups`

Do **not** use WinSCP as your normal code deployment method.

For code, use Git:

- first deploy: `git clone`
- later deploys: `git pull`

### 5.2 Suggested Windows workflow

Use your tools like this:

1. WinSCP
   - for file access and editing deployment files
2. Terminal
   - for Git, Docker, Nginx, and Certbot commands

If WinSCP offers an integrated terminal or `Open in PuTTY`, that is fine to use. Otherwise use PowerShell, Windows Terminal, or PuTTY separately.

### 5.3 WinSCP connection settings

In WinSCP, use:

- File protocol: `SFTP`
- Host name: `YOUR_SERVER_IP` or your hostname
- Port number: `22`
- User name: your Linux user, often `ubuntu`
- Password or private key: whichever your server uses

After login, bookmark this folder:

- `/opt/premium-polymers`

---

## 6. Decide Your Final URL

Use a dedicated subdomain for this app.

Example:

- app: `stocks.example.com`
- existing app: `erp.example.com`

Set the DNS record first:

- create an `A` record for `stocks.example.com`
- point it to your Oracle server public IP

You can verify DNS later with:

```bash
nslookup stocks.example.com
```

The result should point to your Oracle server IP.

---

## 7. Install Docker and Docker Compose

If Docker is already installed, verify it:

```bash
docker --version
docker compose version
```

If Docker is **not** installed, use these commands on Ubuntu:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

What this does:

- installs Docker Engine
- installs the Docker Compose plugin
- allows your current user to run Docker without `sudo`

---

## 8. Create a Folder for This Project

Keep every app on the server in its own folder.

Create a deployment directory:

```bash
sudo mkdir -p /opt/premium-polymers
sudo chown -R $USER:$USER /opt/premium-polymers
cd /opt/premium-polymers
```

Recommended structure:

```text
/opt/premium-polymers/
  app/
  backups/
```

Create the parent folder and the backup folder:

```bash
mkdir -p /opt/premium-polymers/backups
```

Do not manually create `/opt/premium-polymers/app` yet.

Git will create that folder during `git clone`.

---

## 9. Clone the Code with Git

This guide uses Git as the official deployment method.

That means:

- first deployment uses `git clone`
- future deployments use `git pull`

Avoid using WinSCP to upload the whole source code every time. That makes future updates messy and increases the chance of missing files.

### 9.1 Install Git on the server

If Git is already installed:

```bash
git --version
```

If it is not installed:

```bash
sudo apt update
sudo apt install -y git
git --version
```

### 9.2 If your repository is public

Use HTTPS clone:

```bash
cd /opt/premium-polymers
git clone YOUR_REPOSITORY_URL app
cd app
```

Example:

```bash
git clone https://github.com/your-user/premium-polymers.git app
cd app
```

### 9.3 If your repository is private

The best long-term option is an SSH deploy key.

Generate a key on the server:

```bash
ssh-keygen -t ed25519 -C "premium-polymers-deploy"
```

Press Enter through the prompts. For a deployment key, leaving the passphrase empty is common.

Show the public key:

```bash
cat ~/.ssh/id_ed25519.pub
```

Copy the output and add it to GitHub:

1. open your repository on GitHub
2. go to `Settings`
3. go to `Deploy keys`
4. click `Add deploy key`
5. paste the public key

Then test the SSH connection:

```bash
ssh -T git@github.com
```

Then clone the repo:

```bash
cd /opt/premium-polymers
git clone git@github.com:your-user/premium-polymers.git app
cd app
```

### 9.4 Verify the clone

Run:

```bash
pwd
git remote -v
git branch
ls
```

You should see:

- the repo in `/opt/premium-polymers/app`
- a valid Git remote
- files like:
  - `package.json`
  - `pnpm-lock.yaml`
  - `prisma/`
  - `src/`

### 9.5 What to do in WinSCP after cloning

After the repo is cloned with Git:

1. open WinSCP
2. connect to the server
3. browse to `/opt/premium-polymers/app`
4. verify that the repo files are present

From this point onward:

- use terminal for `git pull`
- use WinSCP to edit deployment files and download backups

---

## 10. Create the Production Docker Files

This repo now includes starter deployment files:

- `Dockerfile`
- `.dockerignore`
- `docker-compose.example.yml`
- `.env.production.example`

You can create these files in either of two ways:

- use `nano` in the terminal
- use WinSCP's editor if you are more comfortable editing files visually

For beginners, WinSCP is often easier for these deployment files.

You should end up with these deployment files in the project root:

- `docker-compose.yml`
- `.env.production`

### 10.1 Review `Dockerfile`

This file already exists in the repo. Verify it:

```bash
cat Dockerfile
```

Why this Dockerfile is simple:

- it installs dependencies
- copies the full app
- builds the app
- starts Next.js in production mode
- it also keeps Prisma CLI available in the container, which is useful for `db:push` and `db:seed`

### 10.2 Review `.dockerignore`

This file also already exists in the repo:

```bash
cat .dockerignore
```

Why this matters:

- it keeps secrets out of the Docker build context
- it makes builds faster
- it prevents copying local junk into the image

### 10.3 Create `docker-compose.yml`

Create the file:

```bash
cp docker-compose.example.yml docker-compose.yml
```

Then open it and edit the values you want to customize:

```bash
nano docker-compose.yml
```

Very important:

- `127.0.0.1:3001:3000` means the app is only exposed on localhost
- Nginx on the same server will forward public traffic to it
- PostgreSQL is **not** publicly exposed

This is safer than publishing `3001:3000` to the whole internet.

---

## 11. Create the Production Environment File

Create the file:

```bash
cp .env.production.example .env.production
```

Then open and edit the values:

```bash
nano .env.production
```

Explanation:

- `DATABASE_URL`
  - points the app to the `postgres` service in Docker Compose
- `NEXTAUTH_SECRET`
  - used to sign login sessions
- `NEXTAUTH_URL`
  - must be the final public HTTPS URL
- `NEXT_PUBLIC_APP_LOCALE`
  - optional app display locale
- `NEXT_PUBLIC_APP_TIME_ZONE`
  - optional app timezone
- `NODE_ENV=production`
  - ensures production behavior

Generate a strong secret:

```bash
openssl rand -hex 32
```

Then paste the output into `NEXTAUTH_SECRET`.

Example:

```env
NEXTAUTH_SECRET=9f7b0e0d4d0e1d7f9d9c9f5a33df2f52d9e9b8c44f9c7d1e1f8a4c0b1f3d2a7c
```

If you prefer not to use `nano`, create or edit `.env.production` in WinSCP. That is a good use of WinSCP because this file is server-specific and usually should not be committed to Git.

---

## 12. If You Already Have PostgreSQL on the Server

If your existing project already uses PostgreSQL and you want to reuse that PostgreSQL server, you can.

Do this safely:

1. create a **new database**
2. create a **new database user**
3. give that user access only to this app's database
4. do **not** reuse the same database and user as another app

In that case:

- remove the `postgres` service from `docker-compose.yml`
- change `DATABASE_URL` to point to your existing PostgreSQL server

Example `DATABASE_URL` for an existing host PostgreSQL:

```env
DATABASE_URL=postgresql://premium_polymers:YOUR_PASSWORD@YOUR_DB_HOST:5432/premium_polymers
```

If PostgreSQL is running directly on the same Oracle host:

```env
DATABASE_URL=postgresql://premium_polymers:YOUR_PASSWORD@host.docker.internal:5432/premium_polymers
```

On Linux, `host.docker.internal` may not always be available by default. If that does not work, use the host machine IP or keep the dedicated Postgres container approach from this guide.

If you are a beginner, use the dedicated Postgres container. It is simpler.

---

## 13. Edit the Seed Script Before Production

This step matters.

Open the seed file:

```bash
nano prisma/seed.ts
```

Find the current demo users. They include passwords based on:

```ts
const passwordHash = await bcrypt.hash("admin123", 12);
```

For a public deployment, you should do one of these:

### Safer approach

Replace the demo emails and password with your real accounts before first seed.

### Quick approach

Seed as-is, log in immediately, and then rotate credentials before public release.

The safer approach is better.

If you have a team, also consider reducing the number of pre-created accounts to only what you really need.

---

## 14. Build and Start the Containers

Now move into the project directory:

```bash
cd /opt/premium-polymers/app
```

Build the image:

```bash
docker compose build
```

Start only PostgreSQL first:

```bash
docker compose up -d postgres
```

Check that PostgreSQL is healthy:

```bash
docker compose ps
docker compose logs postgres
```

Now generate Prisma client inside the container:

```bash
docker compose run --rm app pnpm db:generate
```

Apply the schema:

```bash
docker compose run --rm app pnpm db:push
```

Seed initial data:

```bash
docker compose run --rm app pnpm db:seed
```

Then start the app:

```bash
docker compose up -d app
```

Check status:

```bash
docker compose ps
docker compose logs app
```

You want to see the app container running without crashing.

At this stage, the app should be reachable only from the server itself on:

- `http://127.0.0.1:3001`

Test it from the server:

```bash
curl http://127.0.0.1:3001/login
```

If you get HTML back, the app is running.

---

## 15. Install and Configure Nginx

If Nginx is already installed because another app is using it, skip the install command and only add a new site config.

If Nginx is not installed:

```bash
sudo apt update
sudo apt install -y nginx
```

Create a new Nginx site:

```bash
sudo nano /etc/nginx/sites-available/premium-polymers
```

Paste this:

```nginx
server {
    listen 80;
    server_name stocks.example.com;

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

Replace:

- `stocks.example.com`

with your real domain.

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/premium-polymers /etc/nginx/sites-enabled/premium-polymers
```

Test the config:

```bash
sudo nginx -t
```

If the test passes, reload Nginx:

```bash
sudo systemctl reload nginx
```

---

## 16. Enable HTTPS with Let's Encrypt

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Request a certificate:

```bash
sudo certbot --nginx -d stocks.example.com
```

Follow the prompts.

Choose the redirect option when asked so HTTP is automatically redirected to HTTPS.

After that, test the renewal timer:

```bash
sudo systemctl status certbot.timer
```

You should now be able to open:

- `https://stocks.example.com/login`

---

## 17. Open the Correct Firewall Rules

You need to handle both:

- Oracle Cloud network rules
- Linux firewall rules on the server, if enabled

### 17.1 Oracle Cloud security rules

In Oracle Cloud, open inbound traffic for:

- TCP 22 for SSH
- TCP 80 for HTTP
- TCP 443 for HTTPS

You do **not** need to open:

- `3001`
- `5432`

Those should stay private.

### 17.2 Ubuntu firewall

If `ufw` is active, allow:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

Again, do not open `3001` or `5432` to the public internet.

---

## 18. First Login and Post-Deploy Checklist

Once the app is live:

1. open `https://stocks.example.com/login`
2. log in with the admin account you created or seeded
3. verify the main pages load
4. verify transfers, materials, and dashboard render correctly

After first login, do these checks:

- login works
- notifications open
- dashboard loads charts
- warehouses page loads
- add material form works
- transfer page works
- history pages work

Security checklist:

- `NEXTAUTH_URL` is the real HTTPS domain
- `NEXTAUTH_SECRET` is long and random
- demo passwords are removed or changed
- PostgreSQL is not public
- app port `3001` is not public
- DNS points to the correct server

---

## 19. Useful Docker Commands

View running containers:

```bash
docker compose ps
```

View app logs:

```bash
docker compose logs -f app
```

View database logs:

```bash
docker compose logs -f postgres
```

Restart only the app:

```bash
docker compose restart app
```

Stop everything:

```bash
docker compose down
```

Start everything again:

```bash
docker compose up -d
```

Rebuild after code changes:

```bash
docker compose build app
docker compose up -d app
```

Open a shell inside the app container:

```bash
docker compose exec app sh
```

Run Prisma commands inside the app container:

```bash
docker compose exec app pnpm db:generate
docker compose exec app pnpm db:push
docker compose exec app pnpm db:seed
```

---

## 20. How to Update the App Later

This is one of the main reasons this guide uses Git.

For future updates, do **not**:

- upload a new zip file
- replace the whole app folder in WinSCP
- drag and drop source code directly into production every time

Instead, update the app with Git.

### 20.1 Standard update flow

```bash
cd /opt/premium-polymers/app
git status
git pull
docker compose build app
docker compose run --rm app pnpm db:generate
docker compose run --rm app pnpm db:push
docker compose up -d app
docker compose logs -f app
```

### 20.2 Safer update flow with a backup first

This is the version you should prefer in real use:

```bash
cd /opt/premium-polymers/app
docker compose exec -T postgres pg_dump -U premium_polymers premium_polymers > /opt/premium-polymers/backups/premium_polymers_$(date +%F_%H-%M-%S).sql
git pull
docker compose build app
docker compose run --rm app pnpm db:generate
docker compose run --rm app pnpm db:push
docker compose up -d app
docker compose logs -f app
```

### 20.3 What each command does

- `git status`
  - shows whether the server has local changes
- `git pull`
  - gets the latest code from GitHub
- `docker compose build app`
  - rebuilds the app image
- `docker compose run --rm app pnpm db:generate`
  - regenerates Prisma client files
- `docker compose run --rm app pnpm db:push`
  - applies schema updates
- `docker compose up -d app`
  - restarts the app container
- `docker compose logs -f app`
  - lets you confirm the new release started correctly

### 20.4 What WinSCP should be used for during updates

WinSCP is still useful during updates, but not for the code deployment itself.

Use WinSCP for:

- checking `.env.production`
- editing server-only deployment files
- downloading database backups
- visually inspecting files after deployment

Do not use WinSCP to overwrite the `src/` folder on each release.

### 20.5 If `git pull` shows local changes

Run:

```bash
cd /opt/premium-polymers/app
git status
```

If the local changes are only deployment files like:

- `.env.production`
- `docker-compose.yml`
- `Dockerfile`

that can be normal.

If the changes are inside app source files like:

- `src/`
- `prisma/`

then someone probably edited production directly. Stop and inspect before doing anything destructive.

Important update rule:

- back up the database before `db:push`

---

## 21. How to Back Up the Database

If you use the Postgres container from this guide:

```bash
cd /opt/premium-polymers/app
docker compose exec -T postgres pg_dump -U premium_polymers premium_polymers > /opt/premium-polymers/backups/premium_polymers_$(date +%F_%H-%M-%S).sql
```

This creates a SQL backup file.

To see the backups:

```bash
ls -lh /opt/premium-polymers/backups
```

Recommended:

- back up before every app update
- back up before every schema change
- copy backups off the server as well

With WinSCP, you can:

1. connect to the server
2. open `/opt/premium-polymers/backups`
3. download the `.sql` backup file to your Windows machine

That gives you a copy outside the server, which is a good habit.

---

## 22. Common Problems and Fixes

### Problem: `NEXTAUTH_URL is required in production`

Cause:

- `.env.production` is missing `NEXTAUTH_URL`

Fix:

- add the correct HTTPS URL
- restart the app container

### Problem: `NEXTAUTH_SECRET is not configured`

Cause:

- secret missing from env file

Fix:

- generate a new random secret
- add it to `.env.production`
- restart the app container

### Problem: database connection error

Cause:

- wrong `DATABASE_URL`
- Postgres container not healthy
- wrong username/password

Fix:

```bash
docker compose ps
docker compose logs postgres
docker compose exec postgres psql -U premium_polymers -d premium_polymers
```

### Problem: domain opens the wrong app

Cause:

- Nginx server block points to the wrong port
- DNS still points elsewhere

Fix:

- check DNS
- check `/etc/nginx/sites-available/premium-polymers`
- verify `proxy_pass http://127.0.0.1:3001;`

### Problem: blank page or 502 Bad Gateway

Cause:

- app container not running
- Nginx proxy target wrong

Fix:

```bash
docker compose ps
docker compose logs app
curl http://127.0.0.1:3001/login
sudo nginx -t
```

### Problem: certificate issue

Cause:

- DNS not pointed correctly yet
- port 80 blocked in Oracle Cloud or UFW

Fix:

- verify A record
- open 80 and 443
- rerun Certbot

### Problem: I updated files in WinSCP and now `git pull` complains

Cause:

- server files were edited directly and now Git sees local changes

Fix:

- run `git status`
- check which files changed
- if they are deployment-only files, that may be expected
- if they are real source files, inspect them before pulling again

Best practice:

- keep source code changes in your local repo
- use WinSCP mainly for deployment files and backups

---

## 23. If You Do Not Want Docker

Docker is recommended, but you can also deploy directly on the server using:

- Node.js 20+
- pnpm 10+
- PostgreSQL
- Nginx
- PM2 or `systemd`

That approach works, but it is less isolated and easier to break when multiple apps share one server.

Because you already host another project on the same Oracle server, Docker Compose is the cleaner option.

If you want, a second guide can be written later for:

- direct `pnpm build` + `pnpm start`
- PM2 process management
- Nginx reverse proxy without Docker

---

## 24. Recommended Final Deployment Flow

If you want the shortest safe checklist, use this:

1. point `stocks.example.com` to the Oracle server IP
2. install Docker and Compose
3. install Git on the server
4. connect with WinSCP and bookmark `/opt/premium-polymers`
5. clone this repo into `/opt/premium-polymers/app`
6. create `Dockerfile`, `.dockerignore`, `docker-compose.yml`, and `.env.production`
7. edit `prisma/seed.ts` so seeded users are not insecure
8. run:

```bash
cd /opt/premium-polymers/app
docker compose build
docker compose up -d postgres
docker compose run --rm app pnpm db:generate
docker compose run --rm app pnpm db:push
docker compose run --rm app pnpm db:seed
docker compose up -d app
```

9. configure Nginx to proxy `stocks.example.com` to `127.0.0.1:3001`
10. run Certbot for HTTPS
11. test login and dashboard
12. back up the database and download the backup with WinSCP
13. for future releases, use `git pull`

---

## 25. Files You Should End Up With

On the server, this project folder should contain at least:

```text
/opt/premium-polymers/app/
  .git/
  Dockerfile
  .dockerignore
  docker-compose.yml
  .env.production
  package.json
  pnpm-lock.yaml
  prisma/
  src/
```

The `.git/` folder is important because that is what makes future `git pull` updates possible.

---

## 26. Final Advice

For your specific case, where another project is already hosted on the same Oracle server:

- use a separate subdomain
- use a separate Docker Compose stack
- use a separate PostgreSQL database
- bind the app to `127.0.0.1` only
- let Nginx handle public traffic and HTTPS
- use Git as the normal deployment and update method
- use WinSCP as the beginner-friendly file access tool, not the main release process

That keeps this app cleanly separated from the existing project and makes future updates much easier.

If you want, the next step can be:

1. creating the actual `Dockerfile`, `.dockerignore`, and `docker-compose.yml` in this repo
2. or creating an Oracle-specific deployment checklist with your real domain, server IP, and folder names filled in
