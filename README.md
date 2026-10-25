# REGLO

CSR and QHSE compliance platform.

## Repository structure

- `api/`: backend (Symfony + API Platform)
- `web/`: frontend (Next.js)
- `data-service/`: data service (Python / FastAPI)

## Requirements

- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)
- `make` (optional, shortcuts for the Docker commands)
- Node.js 22 (only to run the Playwright end-to-end tests on your machine)

On Windows, use Git Bash.

## Getting started

```
git clone git@github.com:reglo-app/reglo.git
cd reglo
cp .env.example .env
make up
```

The first start takes a few minutes (dependencies are installed in the containers).

| Service | URL |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:8000 (health check: `/health`) |
| Mailpit (test emails) | http://localhost:8025 |
| PostgreSQL | localhost:5432 |

Without `make`, use `docker compose up -d` instead.

## Common commands

Run `make help` to list everything.

| Command | Description |
|---|---|
| `make up` / `make down` | Start / stop all services |
| `make logs` | Follow the logs |
| `make test` | Run the API and web unit tests |
| `make lint` | Run PHP-CS-Fixer, PHPStan, Prettier and ESLint |
| `make api-shell` / `make web-shell` | Open a shell in a container |

End-to-end tests (Playwright) run on your machine:

```
cd web
npm ci
npx playwright install chromium
npm run test:e2e
```

## Authentication

The API uses opaque access tokens (valid 1 hour, `app.access_token_ttl` in `api/config/services.yaml`). Only a SHA-256 hash of each token is stored in the database.

Apply the migrations, then create an account (the password is asked, 12 characters minimum):

```
docker compose exec api php bin/console doctrine:migrations:migrate
docker compose exec api php bin/console app:user:create jeanne.martin@example.com
```

Log in, then send the token in the `Authorization` header:

```
curl -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "jeanne.martin@example.com", "password": "..."}'
# {"token": "..."}

curl http://localhost:8000/api/auth/me -H 'Authorization: Bearer <token>'
# {"id": "1", "email": "...", "firstName": null, "lastName": null, "role": "member", "organization": null}

curl -X POST http://localhost:8000/api/auth/logout -H 'Authorization: Bearer <token>'
# 204: the token no longer works
```

Every `/api` route requires a token, except `/api/auth/login` and `/api/docs`. `/health` is public. The e-mail is case-insensitive. Wrong credentials always return the same generic message.

In the web app, only the Next.js server calls the API (server components and actions, through `API_INTERNAL_URL`): the browser never does. The token is kept in an `HttpOnly` cookie and sent by the server as `Authorization: Bearer`. When the API refuses it (expired or revoked), `/session-expired` deletes the cookie and opens the login page.

### Mock data
Features whose API endpoints do not exist yet still use the data of `web/src/lib/api/mocks.ts`. `API_MOCKS` (see `.env.example`) lists them; by default `dashboard,domains,news`, while the signed-in user (`me`) comes from the API. It is read by the server at runtime. The Playwright tests start their own server with `API_MOCKS=all` on port 3100.

`make test-api` creates and migrates the test database (`reglo_test`) before running PHPUnit.

## Database

PostgreSQL 16, one separate database per environment. The schema only changes through Doctrine migrations (run automatically on each deployment, by hand in local).

- **Local**: open `localhost:5432` with any client (DBeaver, pgAdmin...), user `reglo`, password `reglo`, database `reglo`.
- **Pre-production and production**: https://db.reglo.site (Adminer, password-protected, pick the database in the login form). Setup and access: [deploy/adminer/README.md](deploy/adminer/README.md). The databases themselves have no public port.

## Editor setup (VS Code)

Install the "**EditorConfig**" VS Code extension. It applies the project's indentation (4 spaces) automatically.

## Contributing

Branches, pull requests and commit convention are described in [CONTRIBUTING.md](CONTRIBUTING.md).

## Continuous integration

Every pull request runs the `API checks` and `Web checks` workflows. Both must pass before merging.
