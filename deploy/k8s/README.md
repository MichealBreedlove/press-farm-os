# Kubernetes manifests (self-host escape hatch)

**Production runs on Vercel.** These manifests exist so Press Farm OS is
never locked in: they run the same Docker image (root `Dockerfile`) on any
Kubernetes cluster (k3s on a VPS, DigitalOcean DOKS, GKE Autopilot) with
the same Supabase project behind it. Nothing here is required for the
normal Vercel deployment — see `docs/production-deployment.md` for when
you'd actually reach for this.

## Layout

| File | What it is |
|------|------------|
| `deployment.yaml` | Deployment (2 replicas, rolling update, liveness/readiness on `/api/health`) + ClusterIP Service |
| `ingress.yaml` | Ingress with cert-manager TLS for pressfarm.io |
| `hpa.yaml` | HorizontalPodAutoscaler, 2–6 replicas on CPU |
| `cronjobs.yaml` | CronJob per `vercel.json` cron entry, calling the same endpoints with `Authorization: Bearer $CRON_SECRET` |
| `secrets.example.yaml` | Template for the `press-farm-env` Secret — copy, fill, never commit the filled copy |

## Deploy

```bash
# 1. Build + push the image (any registry)
docker build -t ghcr.io/michealbreedlove/press-farm-os:$(git rev-parse --short HEAD) \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  --build-arg NEXT_PUBLIC_APP_URL=https://pressfarm.io .
docker push ghcr.io/michealbreedlove/press-farm-os:<tag>

# 2. Create the secret (once), then apply everything
cp secrets.example.yaml secrets.yaml   # fill values; secrets.yaml is gitignored
kubectl apply -f secrets.yaml
kubectl apply -f deployment.yaml -f ingress.yaml -f hpa.yaml -f cronjobs.yaml

# 3. Roll a new version
kubectl set image deployment/press-farm-os web=ghcr.io/michealbreedlove/press-farm-os:<newtag>
kubectl rollout status deployment/press-farm-os
# Instant rollback:
kubectl rollout undo deployment/press-farm-os
```

Prereqs assumed: an ingress controller (nginx) and cert-manager with a
`letsencrypt-prod` ClusterIssuer.
