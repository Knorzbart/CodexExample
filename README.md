# Live CMS Example

A React + Express example site with:

- MongoDB-backed homepage content, site copy, and theme settings
- admin login and CMS editing tools
- live updates across open tabs with Server-Sent Events plus periodic refresh fallback
- Docker packaging
- Kubernetes manifests for a single-node k3s deployment
- GitHub Actions CI/CD using a self-hosted runner on the server

## Local development

1. Install dependencies:

   ```bash
   npm install
   npm --prefix client install
   ```

2. Start MongoDB locally, then create a local `.env` from `.env.example`.

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173`

Default demo login: `admin / admin`

## Quality checks

```bash
npm run lint
npm run test
npm run build
npm run docker:build
```

## Docker

The app image expects these runtime variables:

- `PORT`
- `MONGODB_URI`
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

## Kubernetes

The repository contains:

- `k8s/namespace.yaml`
- `k8s/mongodb.yaml`
- `k8s/app.yaml`
- `k8s/ingress.yaml`

`scripts/deploy-k8s.sh` builds the image on the server, imports it into k3s, refreshes the Kubernetes secret from `/opt/codexexample/cluster-secrets.env`, and rolls out the app.

## Server bootstrap

`scripts/bootstrap-server.sh` installs Docker, k3s, the GitHub Actions runner, and the initial server-side secrets file.

Required environment variable before running it:

- `RUNNER_REGISTRATION_TOKEN`

Optional environment variables:

- `GH_OWNER`
- `GH_REPO`
- `RUNNER_LABELS`
- `RUNNER_VERSION`

## CI/CD

GitHub Actions workflow:

- `.github/workflows/ci-cd.yml`

Flow:

1. GitHub-hosted runner performs lint, tests, build, and Docker build.
2. Pushes to `main` trigger the self-hosted runner on the server.
3. The self-hosted runner executes `scripts/deploy-k8s.sh` and redeploys k3s locally.
