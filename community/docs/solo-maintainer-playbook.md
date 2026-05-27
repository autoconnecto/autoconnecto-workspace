# Solo maintainer playbook

~30–45 minutes per week keeps Discord + GitHub healthy without burning out.

## Principles

1. **Community first** — celebrate builds in `#showcase` before answering `#help`.
2. **GitHub is the archive** — if you answered it well once, it becomes a Discussion.
3. **Templates beat custom replies** — same structure every time.
4. **Automate FAQs** — pricing, MQTT topics, SDK link (Discord bot or pinned text).

## Weekly rhythm (suggested)

| When | Task | Time |
|------|------|------|
| Mon | Scan `#showcase` + `#introductions`; react/comment on 3 posts | 10 min |
| Wed | `#help` + GitHub Discussions: answer **new** threads only | 20 min |
| Fri | Promote 1 showcase post to GitHub “Show and tell” Discussion | 10 min |
| Monthly | Post roadmap poll in Discussions + pin summary in Discord | 15 min |

## Daily (optional, 5 min)

- Glance `#help` for 🔴 “blocked in production” (see priority below).
- Ignore everything else until Wed if time is tight.

## Priority order

1. **Production down** — tenant cannot ingest / all devices offline.
2. **Paid / enterprise** — email founder@ thread; reply in Discord with ETA.
3. **Showcase** — short encouragement builds culture.
4. **General how-to** — template reply + link to docs.
5. **Feature ideas** — “logged, thanks” + Discussions upvote.

## When someone asks in Discord

1. Ask them to use the help template (pin in `#help`).
2. If novel → answer in thread.
3. If repeated → link existing Discussion.
4. If bug → open issue in **correct product repo** (backend/frontend/sdk), link from Discord.

## Turning answers into assets

After a good `#help` resolution:

```text
[ ] Copy summary to GitHub Discussion (Q&A)
[ ] If doc-worthy → open PR on autoconnecto-docs
[ ] If FAQ → add line to discord/auto-replies.md
```

## What you do **not** owe the community

- 24/7 chat availability
- Custom firmware debugging for non-Autoconnecto hardware
- Free solution architecture for commercial bids (offer call via founder@)

## Metrics that matter (solo-friendly)

- Showcase posts / month
- Discussion threads with ≥1 reply
- Repeat questions (should fall over time if docs improve)
- Discord → signup (ask occasionally in `#introductions`)

## Burnout guardrails

- Batch support on **Wed** only unless production incident.
- Snooze `@everyone` pings except `#announcements`.
- Use GitHub saved replies for common answers.
