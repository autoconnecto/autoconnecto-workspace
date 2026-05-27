# One-time setup: `autoconnecto/community`

## 1. Create the GitHub repo

1. GitHub → **autoconnecto** org → **New repository**
2. Name: **`community`**
3. Public, no template required
4. Push this folder:

```bash
cd community
git init
git add .
git commit -m "chore: community hub (Discord + Discussions)"
git branch -M main
git remote add origin https://github.com/autoconnecto/community.git
git push -u origin main
```

## 2. Enable Discussions

Repo → **Settings** → **General** → Features → enable **Discussions**.

Suggested categories (create in Discussions → gear icon):

| Category | Format | Purpose |
|----------|--------|---------|
| **Announcements** | Announcement | Releases, events (Team posts only) |
| **Show and tell** | Show and tell | Projects & demos |
| **Q&A** | Question / Answer | How-to |
| **Ideas** | Open discussion | Feature ideas |
| **General** | Open discussion | Everything else |

Mark **Announcements** as announcements-only for maintainers.

## 3. Discord

Follow [docs/discord-setup.md](./docs/discord-setup.md).

Update `README.md` invite link: replace `REPLACE_WITH_INVITE`.

## 4. Link from product surfaces (when ready)

| Place | Link |
|-------|------|
| Website footer | `https://github.com/autoconnecto/community` + Discord invite |
| Docs nav | Community → Discussions + Discord |
| App Help menu | Same |

## 5. Your weekly routine

[docs/solo-maintainer-playbook.md](./docs/solo-maintainer-playbook.md)

## 6. Optional: org profile README

Add `profile/README.md` in a repo named `.github` under the org to show community links on https://github.com/autoconnecto — optional polish.
