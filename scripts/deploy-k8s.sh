#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SECRETS_FILE="/opt/codexexample/cluster-secrets.env"

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "Missing secrets file at $SECRETS_FILE" >&2
  exit 1
fi

source "$SECRETS_FILE"

required_vars=(
  MONGO_ROOT_USERNAME
  MONGO_ROOT_PASSWORD
  ADMIN_USER
  ADMIN_PASSWORD
  SESSION_SECRET
)

for variable_name in "${required_vars[@]}"; do
  if [[ -z "${!variable_name:-}" ]]; then
    echo "Missing required secret variable: $variable_name" >&2
    exit 1
  fi
done

MONGODB_URI="mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@mongodb-0.mongodb.codex-example.svc.cluster.local:27017/codexexample?authSource=admin"

cd "$REPO_ROOT"

docker build -t codexexample:latest .
docker save codexexample:latest | k3s ctr images import -

kubectl apply -f k8s/namespace.yaml

kubectl create secret generic codexexample-secrets \
  --namespace codex-example \
  --from-literal=MONGO_ROOT_USERNAME="$MONGO_ROOT_USERNAME" \
  --from-literal=MONGO_ROOT_PASSWORD="$MONGO_ROOT_PASSWORD" \
  --from-literal=MONGODB_URI="$MONGODB_URI" \
  --from-literal=ADMIN_USER="$ADMIN_USER" \
  --from-literal=ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  --from-literal=SESSION_SECRET="$SESSION_SECRET" \
  --dry-run=client \
  -o yaml | kubectl apply -f -

kubectl apply -f k8s/mongodb.yaml
kubectl rollout status statefulset/mongodb -n codex-example --timeout=240s

kubectl apply -f k8s/app.yaml
kubectl apply -f k8s/ingress.yaml
kubectl rollout restart deployment/codexexample-app -n codex-example
kubectl rollout status deployment/codexexample-app -n codex-example --timeout=240s

echo
kubectl get pods,svc,ingress -n codex-example
echo
curl --fail --silent http://127.0.0.1/api/health
echo
