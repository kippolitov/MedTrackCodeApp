# Power Platform Skills for Claude Code

A collection of domain skills that give [Claude Code](https://claude.ai/claude-code) deep knowledge of the Microsoft Power Platform. Drop these into your project's `.claude/skills/` directory and Claude Code can plan, build, deploy, and test Power Apps, Dataverse schemas, plugins, PCF controls, and more.

Built and battle-tested while creating the [MDA Template](https://github.com/DanielKerridge/MDATemplate-PowerPlatform) project.

## Skills

| Skill | What It Does |
|---|---|
| **plan-with-team** | Spawns an Agent Team (Data Architect, UX Designer, The Skeptic) to collaboratively plan your app before any code is written |
| **dataverse-web-api** | Creates Dataverse schema (tables, columns, relationships, views, forms, option sets) via the Web API |
| **power-apps-code-apps** | Builds Code App frontends with React/Vue/TS using the @microsoft/power-apps SDK |
| **dataverse-web-resources** | Creates and deploys web resources — JS form scripts, HTML dashboards, ribbon commands |
| **dataverse-plugins** | Develops and registers C# Dataverse plugins for server-side business logic |
| **pcf-controls** | Builds PowerApps Component Framework controls — field, dataset, and React virtual controls |
| **code-review** | Deep code audit that finds dead wiring, silent failures, placeholders, and bloated files |
| **visual-qa** | AI-powered visual testing — walks through the app, records actions, sends to Gemini for review |
| **record-screen** | Records Chrome browser tab sessions to video for demos and documentation |

## Installation

1. Copy the skill folders into your project:
   ```bash
   git clone https://github.com/DanielKerridge/claude-code-power-platform-skills.git
   mkdir -p .claude/skills
   cp -r claude-code-power-platform-skills/* .claude/skills/
   ```

2. Add a `CLAUDE.md` to your project root that references the skills (see the [MDA Template CLAUDE.md](https://github.com/DanielKerridge/MDATemplate-PowerPlatform/blob/master/CLAUDE.md) for an example).

3. Start Claude Code in your project — the skills load automatically.

## How It Works

Each skill folder contains:
- **`SKILL.md`** — The main prompt that teaches Claude Code the domain knowledge, patterns, and rules
- **`resources/`** — Reference docs, decision guides, templates, and checklists the skill consults

When you ask Claude Code to do something that matches a skill's triggers (e.g., "create a Dataverse table", "plan my app", "build a PCF control"), the relevant skill loads automatically and guides the work.

## Workflow

The recommended order for building a Power Platform app:

1. **Plan** (`plan-with-team`) — Three specialists debate your design
2. **Schema** (`dataverse-web-api`) — Create tables, columns, relationships, views, forms
3. **Frontend** (`power-apps-code-apps`) — Build the Code App UI
4. **Server logic** (`dataverse-plugins`) — Add plugins for business rules
5. **Controls** (`pcf-controls`) — Build custom PCF controls if needed
6. **Web resources** (`dataverse-web-resources`) — Add form scripts, dashboards
7. **Review** (`code-review`) — Audit for dead code, missing wiring, security issues
8. **Test** (`visual-qa`) — Walk through the app with AI-powered visual testing

## License

MIT
