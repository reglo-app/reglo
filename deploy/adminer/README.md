# Adminer (databases in the browser)

Adminer gives a web interface to browse the **pre-production** and
**production** databases at https://db.reglo.site, without an SSH tunnel. The
login form has a drop-down to pick the database (`Preprod` or `Prod`).

The databases themselves stay closed: they have no public port and are only
on the `internal` Docker network of their stack. Adminer joins both networks
and is published by Caddy behind a password. It can only connect to the two
databases of the list (`login-servers.php`).

## Security
Whoever gets through Adminer can read the databases, production included. So:
- Caddy asks for a first password (`basic_auth`), Adminer then asks for the
  database login: two passwords, both strong, shared only with the team.
- Log in with the **read-only** database user below, not with the main
  `reglo` user, which can change or delete everything.
- Keep the image version pinned and update it from time to time.

## Setup on the server (once)
1. **Names**: check the names used in `docker-compose.yml` and
   `login-servers.php` (they come from `COMPOSE_PROJECT_NAME` in each
   stack's `.env`):
   ```bash
   docker network ls --filter name=_internal
   ```
   ```bash
   docker ps --filter name=-db- --format '{{.Names}}'
   ```
   Expected: `reglo-preprod_internal`, `reglo-prod_internal`,
   `reglo-preprod-db-1`, `reglo-prod-db-1`.
2. **DNS**: add an `A` record `db.reglo.site` pointing to the server.
3. **Adminer**: copy `docker-compose.yml` and `login-servers.php` from this
   folder to `/srv/reglo-adminer/` on the server, then start it (both stacks
   must be running, so that their networks exist):
   ```bash
   cd /srv/reglo-adminer && docker compose up -d
   ```
4. **Caddy password**: generate the hash of a strong password (replace
   `<caddy-container>` with the name of the Caddy container):
   ```bash
   docker exec -it <caddy-container> caddy hash-password
   ```
5. **Caddy site**: add this block to the Caddyfile, with the hash from step 4,
   then reload Caddy:
   ```
   db.reglo.site {
       basic_auth {
           equipe <hash>
       }
       reverse_proxy adminer:8080
   }
   ```
   ```bash
   docker exec <caddy-container> caddy reload --config /etc/caddy/Caddyfile
   ```
6. **Read-only database user**, in **each** database. Open psql (replace
   `preprod` by `prod` for the second one):
   ```bash
   cd /srv/reglo-preprod && docker compose exec db psql -U reglo reglo
   ```
   then run (choose a strong password, a different one per environment):
   ```sql
   CREATE ROLE lecture LOGIN PASSWORD 'change-me';
   GRANT CONNECT ON DATABASE reglo TO lecture;
   GRANT USAGE ON SCHEMA public TO lecture;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO lecture;
   -- Tables created later by the migrations (run as "reglo") too
   ALTER DEFAULT PRIVILEGES FOR ROLE reglo IN SCHEMA public GRANT SELECT ON TABLES TO lecture;
   ```

## Use
Open https://db.reglo.site, enter the Caddy password, then log in to Adminer:

| Field | Value |
|---|---|
| System | PostgreSQL (fixed by the list) |
| Server | `Preprod` or `Prod` |
| Username | `lecture` |
| Password | the one chosen in step 6 for that environment |
| Database | `reglo` |

## Update after a change in this folder
Copy the changed files to `/srv/reglo-adminer/` again, then:
```bash
cd /srv/reglo-adminer && docker compose up -d --force-recreate
```

## Remove it
```bash
cd /srv/reglo-adminer && docker compose down
```
Then remove the `db.reglo.site` block from the Caddyfile and reload Caddy.
