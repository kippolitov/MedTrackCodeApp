# Power Apps Template - starter

An opinionated **Vite + TypeScript + React** starter template for building Power Apps code apps.

Designed for common app scenarios, easy extensibility, and minimal setup.

---

## Highlights
- **Modern tooling** - Vite, TypeScript, and React
- **Out-of-box styling** - Tailwind, shadcn/ui components, and theming out of the box
- **Batteries included** - Curated libraries pre-wired for common scenarios
- **Standard patterns** - Industry standard patterns and practices
- **Agent friendly** - Optimized for use with coding agents
---

## Pre-installed libraries
- [Tailwind CSS](https://tailwindcss.com/) - utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - pre-installed UI components
- [React Router](https://reactrouter.com/) - pages, routing
- [Zustand](https://zustand.docs.pmnd.rs/) - state management
- [Tanstack Query](https://tanstack.com/query/latest) - data fetching, state management
- [Tanstack Table](https://tanstack.com/table/latest) - interactive tables, datagrids
- [Lucide](https://lucide.dev/) - icons

---

## CI/CD

Build, test, and deployment run on **GitHub Actions** (no Azure DevOps dependency):

- **`.github/workflows/ci.yml`** — runs on every PR to `main` and every push to `main`: install,
  lint, type-check + build, test, secret scan ([gitleaks](https://github.com/gitleaks/gitleaks)),
  and workflow lint ([actionlint](https://github.com/rhysd/actionlint)). This is the required
  status check that gates merging.
- **`.github/workflows/deploy-dev.yml`** — auto-deploys the app + Dataverse schema to the **dev**
  Power Platform environment on every merge to `main`.
- **`.github/workflows/promote-prod.yml`** — manually triggered promotion of a dev-validated
  release to **production**, gated by required reviewer approval on the `production` GitHub
  Environment.
- **`.github/workflows/deploy.reusable.yml`** — the shared deploy job both of the above call:
  authenticates via a Power Platform service principal, imports the Dataverse solution
  (`solution/`), pushes the Code App, and — only when explicitly opted in via the `migrate_data`
  workflow input — runs the opt-in operational data migration (`data/`). See
  `specs/003-github-actions-cicd/quickstart.md` for the full validation checklist and
  `specs/003-github-actions-cicd/contracts/` for the detailed workflow contracts.

Environment/app identifiers and credentials are never committed — see `power.config.template.json`
and `scripts/ci/render-power-config.ps1`.
