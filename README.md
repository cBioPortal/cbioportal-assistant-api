# cBioPortal Assistant API

Standalone chat API microservice for the cBioPortal AI assistant.

## Setup

```bash
cp .env.example .env
# Edit .env with your AWS credentials (AWS_PROFILE or explicit keys)
npm install
```

## Development

```bash
npm run dev          # Start with hot reload (port 3001)
npm run build        # Compile TypeScript
npm start            # Run production build
npm test             # Run tests
```

## Configuration

Edit `config.yaml` for shared settings. Create `config.local.yaml` (gitignored) for local overrides.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | Streaming chat (AI SDK UI Message Stream Protocol) |
| GET | `/health` | Health check |

## Docker

```bash
docker compose up
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_PROFILE` | One of these | AWS profile name |
| `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` | One of these | Explicit AWS credentials |
| `AWS_SESSION_TOKEN` | No | For temporary credentials |
| `MCP_SERVER_AUTH_TOKEN` | No | Bearer token for MCP server |
