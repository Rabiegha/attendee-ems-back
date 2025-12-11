# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please email us at **security@example.com** instead of using the issue tracker.

## Security Best Practices

### Environment Variables

**Never commit real credentials to Git.** All `.env` files with actual secrets are in `.gitignore`.

Template files (`.env.example`, `.env.docker.example`) should only contain:
- Placeholder values (e.g., `your-password-here`)
- Development/example values that are safe to share publicly

### Secrets to Protect

- Database credentials
- JWT secrets
- SMTP passwords
- API keys (Cloudflare R2, Sentry, etc.)
- OAuth client secrets
- Private keys and certificates

### Before Deploying

1. Generate new secrets for production (never use example/dev secrets)
2. Use environment variables for all sensitive configuration
3. Rotate secrets regularly
4. Use different secrets per environment (dev/staging/prod)

## Known Security Considerations

- All passwords are hashed using bcrypt
- JWT tokens have expiration times
- Refresh tokens are stored hashed in database
- CORS is configured per environment
- Rate limiting should be configured in production
