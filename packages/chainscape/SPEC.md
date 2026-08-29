# chainscape — model (v0.1)

Turn placed BSV blocks into a contiguous, deterministic 2-D biome map. Built on
[chainseed](./CHAINSEED-SPEC.md); reference impl `chainscape.mjs`.

## The idea

Each block becomes a square **parcel** of terrain. The parcel's biome field is derived from
that block's **hash** (through chainseed), so the same block always paints the same land.
Adjacent parcels are stitched along shared seams into one continuous world, and the stitching
is designed so that **appending a new block never alters terrain already generated** — the map
only ever grows outward. Geography is a pure function of chain structure: anyone with the same
blocks derives the identical world, no server, no coordination.

## Two separable layers

1. **Placement** — where block `height` sits on the grid. Current: `spiralCells(count)`, an
   Ulam square spiral (genesis at centre, distance from centre ≈ chain age). Swappable; the
   terrain layer only reads `gx,gy` off each cell.
2. **Terrain** — `makeGrid(cellMap, fieldCache)` → `gridFor(cell)` returning an `N×N` biome
   grid. Layout-agnostic: it consumes `{gx,gy,height,hash}` and neighbour lookups.

## Terrain construction (per parcel)

Two scalar fields per block, **elevation** `e` and **moisture** `m`, each in `[0,1]`:

- **Field** = sum of two chainseed value-noise octaves — low freq (5×5 lattice) at 0.7 + high
  freq (14×14) at 0.3. Lattice values are `chainseed.unit8(hash, "<salt>:i:j")`. Salts:
  `elev` / `moist` (each split into `…lo` / `…hi` octaves).
- **Biome** = `biomeIdx(e,m)` — a fixed 12-class step function over (elevation, moisture);
  see reference. Water/beach at low e; rock/snow at high e; the mid band splits by moisture.

## Seams (why the world is continuous *and* stable)

A parcel blends toward its 4 neighbours within a border band of width `BAND` using a Coons
patch built from:

- **Corner anchors.** At each lattice corner, the field value is taken from the **lowest-height
  block** touching that corner. That block always already exists (heights only grow), so the
  corner value is fixed the moment the corner is first surrounded and never moves.
- **Edge profiles.** Each shared edge is keyed by the **lower-height** of the two blocks it
  divides, with a symmetric salt (`seam:<sortedCellIds>`) both neighbours compute identically,
  plus a centred `bump(t)` wobble (amplitude `AMP`) that vanishes at the corners. Frontier
  edges (no neighbour yet) use the block's own hash and a `frontier:` salt.

Because every shared feature is keyed by the older (lower-height) participant, the newer block
conforms to the older one — never the reverse. That's the whole stability guarantee.

## Determinism boundary

All randomness comes from chainseed; there is no `Math.random`, wall-clock, or iteration-order
dependence in the field math. Given identical blocks (`height`,`hash`,`gx`,`gy`), `gridFor`
returns identical grids on any machine. The one caveat is floating-point: results assume IEEE
754 double arithmetic in the order written (true for JS and most languages); a bit-exact port
must preserve operation order in the Coons blend.

## Params

`N` (parcel resolution, 64), `BAND` (seam width, ~12% of N), `AMP` (seam wobble, 0.14). These
are terrain knobs, not part of the chain contract — changing them re-bakes the look but keeps
the "stable outward growth" property.

## Non-goals

Not a physics/heightmap engine and not gameplay — chainscape emits a biome index grid. What
those biomes *mean* (walkable, minable, spawns) is the game's job (blockland's).

## License & implementation

This specification is free for anyone to implement, in any language, royalty-free — writing it
down is the point. The reference implementation is licensed under Apache-2.0; the specification
itself places no restriction on independent, clean-room implementations.
