#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${RUNNER_REGISTRATION_TOKEN:-}" ]]; then
  echo "RUNNER_REGISTRATION_TOKEN is required." >&2
  exit 1
fi

GH_OWNER="${GH_OWNER:-Knorzbart}"
GH_REPO="${GH_REPO:-CodexExample}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,linux,x64,codexexample}"
RUNNER_VERSION="${RUNNER_VERSION:-2.330.0}"
RUNNER_DIR="/opt/actions-runner"
SECRETS_DIR="/opt/codexexample"
SECRETS_FILE="${SECRETS_DIR}/cluster-secrets.env"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl gnupg docker.io jq

systemctl disable --now nginx || true
systemctl disable --now live-cms-example || true

curl -sfL https://get.k3s.io | sh -
systemctl enable --now docker
usermod -aG docker root || true
mkdir -p "${SECRETS_DIR}"

if [[ ! -f "$SECRETS_FILE" ]]; then
  cat > "$SECRETS_FILE" <<EOF
MONGO_ROOT_USERNAME=codexadmin
MONGO_ROOT_PASSWORD=$(openssl rand -hex 24)
ADMIN_USER=admin
ADMIN_PASSWORD=admin
SESSION_SECRET=$(openssl rand -hex 32)
EOF
  chmod 600 "$SECRETS_FILE"
fi

mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [[ ! -f "actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" ]]; then
  curl -fsSL -o "actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  tar xzf "actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
fi

./bin/installdependencies.sh || true

./config.sh \
  --unattended \
  --url "https://github.com/${GH_OWNER}/${GH_REPO}" \
  --token "$RUNNER_REGISTRATION_TOKEN" \
  --labels "$RUNNER_LABELS" \
  --name "$(hostname)-codexexample" \
  --work "_work" \
  --replace

./svc.sh install root
./svc.sh start

chmod 644 /etc/rancher/k3s/k3s.yaml
kubectl get nodes
