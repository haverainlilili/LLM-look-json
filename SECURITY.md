# Security notes

## Temporary dependency exception

Reviewed: 2026-07-22

Review again by: 2026-08-05, or earlier when Next/Miniflare support `sharp >=0.35.0`.

`npm audit` currently reports `GHSA-f88m-g3jw-g9cj` through `sharp@0.34.5`.
The installed package is required transitively by both Next and Miniflare:

- Next 16.2.11 declares `sharp ^0.34.5`.
- Miniflare 4.20260721.0 declares `sharp 0.34.5`.
- `npm audit fix --force` proposes downgrading Next to 14.2.35, which is not a
  compatible or safe remediation for this project.

The affected native image-processing path is not used by the current app:
there are no `next/image` or direct `sharp` imports, dataset media URLs are not
fetched automatically, and the deployed Worker delegates image transforms to
the Cloudflare Images binding. Miniflare's local emulation must remain bound to
trusted development machines and must not be exposed publicly.

The unrelated `fast-uri` advisory was remediated by updating the lockfile to
`fast-uri@3.1.4`. Remove this exception as soon as the upstream dependency ranges
permit a supported `sharp` release, then rerun the full test and audit suite.
