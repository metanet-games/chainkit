# Publishing chainkit to npm

The packages publish under the **`@metanet-games`** npm org (secured). Every `package.json` has
`"publishConfig": { "access": "public" }`, so scoped packages publish **public** with no extra
flags. All packages are Apache-2.0 and free to publish.

> Publishing makes the code public (the tarball is downloadable by anyone). So publishing to npm
> and flipping the GitHub repo public are effectively the **same reveal** — do them together.

## One-time

1. `npm login` — authenticates the CLI (opens a browser). You must be a member/owner of the
   `metanet-games` org, with 2FA enabled.
2. From the repo root: `npm install` (links the workspaces) and `npm test` (all suites green).

## Publish (from the repo root)

Publishing uploads tarballs; it doesn't verify a dependency is already live, so a single pass works:

```sh
npm publish --workspaces
```

`--access public` isn't needed (it's in each `publishConfig`), but adding it is harmless.

If you prefer to go dependency-first (so an installer never hits a missing dep mid-publish), do the
leaf packages, then the rest:

```
# tier 1 — no intra-kit deps
npm publish -w @metanet-games/chainseed -w @metanet-games/chaintag -w @metanet-games/chainclock \
            -w @metanet-games/coinslot -w @metanet-games/satchel
# tier 2 — depend on tier 1
npm publish -w @metanet-games/fairdrop -w @metanet-games/chainscape -w @metanet-games/chainweather \
            -w @metanet-games/rooms -w @metanet-games/highscore
```

Dependency graph: `chainscape`→chainseed · `fairdrop`→chainseed · `chainweather`→chainseed+chainclock ·
`rooms`→chaintag · `highscore`→chaintag. The other five have no intra-kit deps.

## Verify

```sh
npm view @metanet-games/chaintag
npm view @metanet-games/chainseed version
```

## Updating a package later

Bump its `version` (npm refuses to republish an existing version), then `npm publish -w <name>`.
Follow semver: patch for fixes, minor for additive API, major for breaking changes. Because
`chainweather`/`rooms`/etc. depend on `^0.1.0`, a compatible bump of a dependency flows
automatically; a breaking (major) bump means updating the dependents' ranges too.

## Notes

- The umbrella name `chainkit` is only the GitHub repo + brand; there is no unscoped `chainkit`
  npm package to publish (an abandoned stub holds that bare name, and we don't need it).
- `package-lock.json` and `node_modules/` are gitignored and not published; the `files` field in
  each `package.json` keeps published tarballs to `index.mjs` + `SPEC.md`.
