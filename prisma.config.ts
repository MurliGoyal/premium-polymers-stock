import path from 'node:path';
import fs from 'node:fs';
import { defineConfig } from 'prisma/config';

function loadEnvFile(fileName: string) {
  const envPath = path.join(__dirname, fileName);
  if (!fs.existsSync(envPath)) {
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

// Prisma 7 does not auto-load env files. Prefer runtime-provided env vars,
// then fall back to local env files for dev and one-off Docker commands.
loadEnvFile('.env');
loadEnvFile('.env.production');

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  migrations: {
    path: path.join(__dirname, 'prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
