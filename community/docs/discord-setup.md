# Discord setup (community-first)

One-time setup checklist. Replace `REPLACE_WITH_INVITE` everywhere after creating a permanent invite.

## 1. Create the server

- Name: **Autoconnecto Community**
- Icon: app logo from [www.autoconnecto.in](https://www.autoconnecto.in)
- Verification: **Medium** (recommended) to reduce spam

## 2. Roles (minimal)

| Role | Purpose |
|------|---------|
| `@everyone` | Default; read announcements, post in community channels |
| `@Builder` | Optional; assigned manually or via reaction role in `#start-here` |
| `@Team` | You (and future hires); distinct color, mod permissions |

## 3. Channel layout

```
📌 START
  #start-here          ← pins: rules, links, how to ask
  #announcements       ← read-only (Team only)

👋 COMMUNITY
  #introductions
  #showcase            ← primary: shipped projects & demos
  #build-logs          ← WIP, experiments, daily updates

🔧 BUILD
  #help                ← support (template below)
  #integrations        ← LoRa, ChirpStack, webhooks, MQTT
  #feature-ideas

💬 OFF-TOPIC (optional)
  #general
```

**Do not** create 20 channels at launch. Add more only when a topic repeats weekly.

## 4. Pin in `#start-here`

Copy from [discord/pinned-start-here.md](../discord/pinned-start-here.md).

## 5. Bot (pick one)

**Carl-bot** or **Dyno** — free tier is enough.

Configure:

| Trigger | Action |
|---------|--------|
| Message contains `pricing` or `plans` | Reply with pricing links (see [discord/auto-replies.md](../discord/auto-replies.md)) |
| New message in `#help` | Optional: auto-create thread titled from first line |

Reaction roles in `#start-here`:

- 🛠️ → `@Builder`
- 📡 → `@Integrations` (optional custom role)

## 6. Permanent invite

Server settings → Invites → create **never expires**, no max uses → put URL in:

- This repo `README.md`
- Website footer (when ready)
- Docs nav (when ready)

## 7. GitHub link

Server widget or `#start-here`:  
https://github.com/autoconnecto/community/discussions
