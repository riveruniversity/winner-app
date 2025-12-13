# Multi-App Docker Architecture Evaluation

## Current Setup Analysis

### Services Inventory

| Service | Location | Port Binding | Network | Containerized |
|---------|----------|--------------|---------|---------------|
| Nginx (reverse proxy) | /opt/elestio/nginx | host mode (80, 443) | host | Yes |
| Pretix (ticketing) | /opt/app | 172.17.0.1:27712 | app_default | Yes |
| Pretix-cron | /opt/app | - | app_default | Yes |
| PostgreSQL | /opt/app | 172.17.0.1:59313 | app_default | Yes |
| Redis | /opt/app | internal | app_default | Yes |
| pgAdmin | /opt/app | 172.17.0.1:42511 | app_default | Yes |
| Winner App | /srv/win | 0.0.0.0:3001 | win_default | Yes |
| Reports App | - | 0.0.0.0:8888 | - | **No** (bare python3) |
| Altar App | - | 0.0.0.0:8889 | - | **No** (bare python3) |

### Current Architecture Diagram

```
                    Internet
                        │
                    ┌───▼───┐
                    │ Nginx │  (host network mode)
                    │:80/443│
                    └───┬───┘
         ┌──────────────┼──────────────┬──────────────┐
         │              │              │              │
    ┌────▼────┐    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
    │ Pretix  │    │ Winner  │   │ Reports │   │  Altar  │
    │:27712   │    │ :3001   │   │ :8888   │   │ :8889   │
    │(Docker) │    │(Docker) │   │(bare)   │   │(bare)   │
    └────┬────┘    └─────────┘   └─────────┘   └─────────┘
         │
    ┌────▼────┐
    │Postgres │
    │ Redis   │
    └─────────┘
```

---

## Evaluation: Current Approach

### What's Working Well

1. **Separate docker-compose files per app** - Each app (`/opt/app`, `/srv/win`) has its own compose file, allowing independent deployments
2. **Nginx in host mode** - Simplifies routing; can reach all services via localhost/172.17.0.1
3. **Binding to Docker bridge IP (172.17.0.1)** - Pretix services are only accessible from host, not exposed to internet directly
4. **Separate networks** - `app_default` and `win_default` provide isolation between app stacks

### Issues & Risks

1. **Bare Python processes (8888, 8889)** - Not managed by Docker, no auto-restart, no resource limits, harder to maintain
2. **Port 3001 exposed on 0.0.0.0** - Winner app is accessible directly, bypassing nginx (security concern)
3. **No shared network** - Apps can't communicate directly; all traffic goes through host
4. **Manual SSL management** - Certs mounted from host rather than using nginx-auto-ssl's built-in ACME

---

## Recommended Approaches

### Option A: Keep Current Pattern (Minimal Changes)

**Best for**: Stability, minimal disruption

Changes:
- [ ] Containerize Reports and Altar apps
- [ ] Change winner-app port binding from `0.0.0.0:3001` to `127.0.0.1:3001`
- [ ] Keep separate docker-compose files per app

Pros:
- Minimal changes to working system
- Each team/app stays independent

Cons:
- No inter-service communication without going through host

---

### Option B: Unified Docker Network (Recommended)

**Best for**: Better security, easier service discovery

Changes:
- [ ] Create a shared external network: `docker network create shared-proxy`
- [ ] Connect nginx + all apps to `shared-proxy`
- [ ] Use container names for routing (e.g., `proxy_pass http://winner-app:3001`)
- [ ] Remove host port bindings for internal services
- [ ] Containerize Reports and Altar apps

Architecture:
```
docker network create shared-proxy

# Each docker-compose.yml adds:
networks:
  shared-proxy:
    external: true
  default:  # keep for internal services like redis
```

Nginx config changes:
```nginx
# Instead of: proxy_pass http://172.17.0.1:27712
proxy_pass http://app-pretix-1:80

# Instead of: proxy_pass http://localhost:3001
proxy_pass http://winner-app:3001
```

Pros:
- No port conflicts
- DNS-based service discovery
- Better security (no exposed ports)
- Nginx can use container names

Cons:
- Requires nginx to join the shared network (currently in host mode)
- Migration effort

---

### Option C: Single docker-compose (Monolithic)

**Best for**: Simpler deployments, single team

Changes:
- [ ] Move all services into one docker-compose.yml at `/opt/app`
- [ ] Use profiles to separate concerns

Example:
```yaml
services:
  nginx:
    profiles: [core]
  pretix:
    profiles: [core, ticketing]
  winner-app:
    profiles: [core, winner]
  reports:
    profiles: [reports]
```

Deploy specific profiles: `docker compose --profile ticketing up -d`

Pros:
- Single source of truth
- Easier to reason about dependencies
- Shared networks by default

Cons:
- Tight coupling
- Single point of failure for config
- Harder for multiple teams

---

## Immediate Action Items (Security)

1. **Fix winner-app port exposure**:
   ```yaml
   # Change from:
   ports:
     - "3001:3001"
   # To:
   ports:
     - "127.0.0.1:3001:3001"
   ```

2. **Containerize Python services** - Reports (8888) and Altar (8889) running as bare processes

---

## Recommendation

**Go with Option B (Unified Docker Network)** for the following reasons:

1. Most secure - no unnecessary port exposure
2. Scalable - easy to add new services
3. Maintains separation of docker-compose files (independent deployments)
4. Better service discovery using container names
5. Nginx stays in control of all external traffic

---

## Next Steps

- [ ] Review and approve approach
- [ ] Containerize bare Python apps (Reports, Altar)
- [ ] Create shared-proxy network
- [ ] Update docker-compose files to join shared network
- [ ] Update nginx configs to use container names
- [ ] Test routing
- [ ] Remove direct port bindings
