function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export function getRequiredServerEnv(name: string) {
  const value = readEnv(name);

  if (value) {
    return value;
  }

  throw new Error(`${name} is not configured.`);
}

export function getAppUrl() {
  const configuredUrl = readEnv("NEXTAUTH_URL");

  if (configuredUrl) {
    try {
      return new URL(configuredUrl);
    } catch {
      throw new Error("NEXTAUTH_URL must be a valid absolute URL.");
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXTAUTH_URL is required in production.");
  }

  return new URL("http://localhost:3000");
}
