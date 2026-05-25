# Mobile app — workspace submodule

## Canonical repository

| Item | Value |
|------|--------|
| **GitHub** | https://github.com/autoconnecto/autoconnecto-mobile |
| **Workspace path** | `autoconnecto-mobile/` |
| **Releases / APK** | https://github.com/autoconnecto/autoconnecto-mobile/releases/latest |

## Clone the full workspace

```bash
git clone --recurse-submodules https://github.com/autoconnecto/autoconnecto-workspace.git
cd autoconnecto-workspace
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

## Work on mobile only

```bash
cd autoconnecto-mobile
git checkout main
git pull origin main
```

Commit and push from **inside** `autoconnecto-mobile/` (the mobile repo). Then bump the workspace pointer:

```bash
cd ..   # workspace root
git add autoconnecto-mobile
git commit -m "chore(workspace): bump autoconnecto-mobile submodule"
git push origin main
```

## Version alignment

Release tags (e.g. `v1.2.8`) are created on the mobile repo separately, same as backend/frontend/docs/sdk/website. The workspace records the gitlink commit after each release.
