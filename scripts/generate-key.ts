import { SignJWT } from "jose";
import { randomBytes } from "crypto";

const secret = process.env.JWT_SECRET;
if (!secret) {
  process.stderr.write(
    "Error: JWT_SECRET environment variable must be set.\n" +
      "Generate a secret with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n"
  );
  process.exit(1);
}

const days = Number(process.argv[2] ?? "30");
if (!Number.isInteger(days) || days < 1 || days > 365) {
  process.stderr.write(
    "Usage: JWT_SECRET=<secret> npm run generate-key [days]\n" +
      "  days: integer 1–365, default 30\n"
  );
  process.exit(1);
}

const token = await new SignJWT({ jti: randomBytes(16).toString("hex") })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime(`${days}d`)
  .sign(new TextEncoder().encode(secret));

process.stdout.write(token + "\n");
process.stderr.write(`Generated JWT valid for ${days} days. Share via secure channel only.\n`);
