# CI and release — AUDIT-20261020-01

## Source of truth

- `deployment.md` — how to ship  
- `CHANGE_MANAGEMENT.md` — Hard gates (FE build before push; DNS SES checklist; audit ≠ release; one intent per ship)  
- `.cursor/rules/release-deploy.mdc` — agent deploy order when founder says deploy  

## Typical release line (vX.Y.Z)

1. Bump package versions → commit → tag → push per repo.  
2. Backend: `ec2-release-deploy.sh vX.Y.Z` (optional `--sync-docs`).  
3. Frontend: push `main` → Actions deploy S3 + CloudFront.  
4. Mobile: tag → Android APK release workflow.  
5. Workspace: pin submodule SHAs + ARCHITECTURE production table.  

## Rollback

Retag / redeploy previous known-good tag via same EC2 script (`deployment.md`). **Code rollback ≠ database restore** (see F-002).

## Hard gates relevant to auditors

- Audit produces findings; it does not deploy.  
- Swagger is exported/checked, not hand-edited.  
- Customer docs are written pages; HTTP generate endpoints refuse.
