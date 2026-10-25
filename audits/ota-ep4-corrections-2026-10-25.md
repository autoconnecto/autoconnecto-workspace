# OTA Ep4 corrections — 25 Oct 2026

Status: local only. Not deployed. Not board-verified.

Code review + static only — not board-verified.

## What changed

1. Soak and the post-update silent watch apply to every wave, including the last wave and a one-device rollout. The rollout stays RUNNING until both have elapsed. Silence fails the device and uses the existing halt rules.
2. Cancel is allowed on RUNNING, PAUSED, or PENDING. Pending and in-progress devices are stopped. UPDATED stays UPDATED. No halt alarm.
3. CANCELLED rollouts can be deleted. A stopped rollout whose package title or a device name starts with `QA ` can also be deleted. Completed and halted production rollouts stay.
4. A named shared-attribute request is no longer skipped for 15 seconds after a snapshot. An initiated row is republished about once a minute. The timeout reason is “download never started”.
5. A boot report of `fw_version` or `sw_version` without a state, when it differs from an UPDATED target, marks that update FAILED and clears the shared target.
6. Manual Halt confirms and does not raise an alarm. Automatic halt still raises a clearable MAJOR alarm and records whether anyone has email alerts on. Signup email alerts stay off unless the new checkbox is ticked.
7. Firmware and software chunks reuse one TLS connection. Chunk size stays 16 KB. Before timing on the QA board: 4 min 18 s to 4 min 47 s for 1.17 MB. No after time is claimed.
8. SDK helpers: `markValidAfterHealthyCheck`, `rollbackIfUnhealthy`, `bootPartitionLabel`, `bootStateName`. Example `OtaHealthCheck_mqtt`. USB flash leaves boot state UNDEFINED. Chip rollback exists only after an OTA install that is PENDING_VERIFY.
9. Rollout detail shows `statusReason`.

## Not in this ship

Other errors the founder still has to correct. No version bump. No deploy.
