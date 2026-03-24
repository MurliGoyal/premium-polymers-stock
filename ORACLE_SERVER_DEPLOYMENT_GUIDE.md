# Premium Polymers Oracle Server Deployment Guide

Port: `3001`  
Method: Git clone over SSH  
Stack: Docker Compose (`app` + `postgres`)

This setup intentionally uses host port `3001` so it can live on the same Oracle VM as another project already using port `3000`.

## 1. Architecture

```text
Browser --> Oracle public IP:3001 --> app container:3001 --> postgres container:5432
```

Key points:

- Keep this app on `3001`.
- Do not expose PostgreSQL (`5432`) to the internet.
- The app image already includes `prisma` and `tsx`, so database setup commands can run inside the app container.

## 2. Prerequisites

- An Oracle Cloud VM running Ubuntu or another Linux distribution.
- SSH access to the VM.
- Git installed or permission to install it.
- Docker Engine and Docker Compose plugin installed or permission to install them.
- Your GitHub repository URL.
- Oracle Cloud ingress rule for TCP `3001`.

## 3. SSH Into the Server

```bash
ssh ubuntu@YOUR_SERVER_IP
```

All commands below are meant to be run inside that SSH session.

## 4. Install Docker and Git

Check first:

```bash
docker --version
docker compose version
git --version
```

If Git is missing:

```bash
sudo apt update
sudo apt install -y git
```

If Docker is missing:

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

sudo usermod -aG docker "$USER"
newgrp docker
```

## 5. Clone the Repository

```bash
sudo mkdir -p /opt/premium-polymers
sudo mkdir -p /opt/premium-polymers/backups
sudo chown -R "$USER:$USER" /opt/premium-polymers

cd /opt/premium-polymers
git clone https://github.com/yourusername/yourrepo.git app
cd /opt/premium-polymers/app
ls -la
```

If you use a private repository, authenticate with your GitHub PAT when prompted.

## 6. Create `.env.production`

```bash
cp .env.production.example .env.production
nano .env.production
```

Set at least these values:

```env
DATABASE_URL=postgresql://premium_polymers:CHANGE_THIS_DB_PASSWORD@postgres:5432/premium_polymers
NEXTAUTH_SECRET=CHANGE_THIS_NEXTAUTH_SECRET
NEXTAUTH_URL=http://YOUR_SERVER_IP:3001
NEXT_PUBLIC_APP_LOCALE=en-IN
NEXT_PUBLIC_APP_TIME_ZONE=Asia/Kolkata
NODE_ENV=production
```

Replace:

- `CHANGE_THIS_DB_PASSWORD` with a strong password.
- `CHANGE_THIS_NEXTAUTH_SECRET` with the output of `openssl rand -hex 32`.
- `YOUR_SERVER_IP` with your Oracle VM public IP.

## 7. Review `docker-compose.yml`

```bash
nano docker-compose.yml
```

Use this structure:

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
    volumes:
      - ./.env.production:/app/.env.production:ro
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
      POSTGRES_PASSWORD: CHANGE_THIS_DB_PASSWORD
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

Important:

- `POSTGRES_PASSWORD` must exactly match the password inside `DATABASE_URL`.
- Keep the host mapping as `3001:3001` unless you intentionally want a different public port.
- The read-only `.env.production` mount lets Prisma CLI commands such as `prisma db push` read the production database URL inside one-off `docker compose run` containers.

## 8. Build the App Image

Normal build:

```bash
docker compose build app
```

If you previously built an older broken image or you changed the Dockerfile, rebuild without cache:

```bash
docker compose build --no-cache app
```

The fixed image should no longer fail with `prisma: not found`.

## 9. Start PostgreSQL First

```bash
docker compose up -d postgres
docker compose ps
```

Wait until `premium-polymers-db` shows `healthy`.

## 10. Initialize the Database

Create tables:

```bash
docker compose run --rm app prisma db push
```

Seed demo data:

```bash
docker compose run --rm app tsx prisma/seed.ts
```

Notes:

- `prisma generate` is already handled during the image build.
- The seed creates demo users such as `manager@premiumpolymers.com` with password `admin123`. Change those passwords immediately after first login.

## 11. Start the App

```bash
docker compose up -d app
docker compose ps
docker compose logs --tail=100 app
```

## 12. Verify the App

From the server:

```bash
curl http://localhost:3001/login
```

From your browser:

```text
http://YOUR_SERVER_IP:3001
```

Demo login:

- Email: `manager@premiumpolymers.com`
- Password: `admin123`

## 13. Open Oracle and OS Firewalls

Oracle Cloud:

- Add an ingress rule allowing TCP `3001`.
- Keep `5432` closed publicly.

Ubuntu firewall example:

```bash
sudo ufw allow 3001/tcp
sudo ufw reload
```

If your instance uses iptables instead of UFW:

```bash
sudo iptables -I INPUT -p tcp --dport 3001 -j ACCEPT
```

## 14. Updating the App Later

```bash
cd /opt/premium-polymers/app
git status
git pull --ff-only
docker compose build app
docker compose up -d app
```

If `prisma/schema.prisma` changed:

```bash
docker compose run --rm app prisma db push
```

Then verify:

```bash
docker compose logs --tail=100 app
```

If `git pull --ff-only` fails because the server has local tracked changes, inspect them with `git status` before deciding whether to stash or discard them.

## 15. Back Up the Database

Create a backup:

```bash
cd /opt/premium-polymers/app
docker compose exec -T postgres pg_dump -U premium_polymers premium_polymers > /opt/premium-polymers/backups/backup_$(date +%F_%H-%M-%S).sql
```

Restore from a backup:

```bash
cat /opt/premium-polymers/backups/backup_FILE.sql | docker compose exec -T postgres psql -U premium_polymers -d premium_polymers
```

## 16. Useful Commands

```bash
docker compose ps
docker compose logs -f app
docker compose logs postgres
docker compose restart app
docker compose stop
docker compose down
docker compose exec app sh
docker compose exec postgres psql -U premium_polymers -d premium_polymers
```

## 17. Troubleshooting

### Build fails with `prisma: not found`

Cause:

- You are building from an older checkout or cached image layers.

Fix:

```bash
cd /opt/premium-polymers/app
git pull --ff-only
docker compose build --no-cache app
```

### `DATABASE_URL is not configured`

Cause:

- `.env.production` is missing or incomplete.

Fix:

```bash
cd /opt/premium-polymers/app
ls -la .env.production
grep DATABASE_URL .env.production
docker compose restart app
```

### Database connection fails

Cause:

- PostgreSQL is not healthy yet, or the password in `docker-compose.yml` does not match the password in `DATABASE_URL`.

Fix:

```bash
docker compose ps
docker compose logs postgres
```

Then confirm the password matches in both places.

### Login redirects loop or sessions fail

Cause:

- `NEXTAUTH_URL` does not match the actual URL being used.

Fix:

- If you access the app by IP and port, use `http://YOUR_SERVER_IP:3001`.
- If you move behind a domain and HTTPS later, change it to `https://your-domain`.

Then restart the app:

```bash
docker compose up -d app
```

### Port `3001` is already in use

Check:

```bash
sudo ss -ltnp | grep 3001
```

If another service is using `3001`, either stop that service or change the host side of the port mapping in `docker-compose.yml`, for example:

```yaml
ports:
  - "3002:3001"
```

If you do that, also update `NEXTAUTH_URL` to `http://YOUR_SERVER_IP:3002`.

## 18. Optional: Nginx Reverse Proxy and HTTPS

If you later want a domain name, keep the app listening on port `3001` internally and proxy to it with Nginx.

Install Nginx:

```bash
sudo apt update
sudo apt install -y nginx
```

Create a site file:

```bash
sudo nano /etc/nginx/sites-available/premium-polymers
```

Example config:

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

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/premium-polymers /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Add HTTPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d stocks.yourdomain.com
```

Then update `.env.production`:

```env
NEXTAUTH_URL=https://stocks.yourdomain.com
```

And restart:

```bash
docker compose up -d app
```

## 19. Security Checklist

- `NEXTAUTH_SECRET` is random and not the example value.
- Database password is strong.
- Demo passwords are changed after first login.
- Oracle Cloud exposes `3001` and `22`, not `5432`.
- Backups are stored outside the container and tested.
