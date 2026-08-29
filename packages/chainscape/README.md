# @metanet-games/chainscape

Turn placed BSV blocks into a contiguous, deterministic 2-D biome map.

Each block becomes a parcel of terrain seeded from its block hash (via
[chainseed](../chainseed)); adjacent parcels are stitched into one seamless world. The stitching
guarantees that **appending a new block never alters terrain already generated** — the map only
grows outward. Same blocks in, same world out, on any machine, with no server.

```js
import { spiralCells, makeGrid } from "@metanet-games/chainscape";

// place blocks (height -> grid position); Ulam spiral is the built-in layout
const pos = spiralCells(cells.length);
const cellMap = new Map(cells.map((c, i) =>
  [`${pos[i][0]},${pos[i][1]}`, { ...c, gx: pos[i][0], gy: pos[i][1] }]));

const gridFor = makeGrid(cellMap, new Map());
const biomeGrid = gridFor(someCell);   // N×N grid of biome indices
```

Placement and terrain are separate concerns — `makeGrid` only reads `{gx,gy,height,hash}`, so
you can swap the spiral for another layout.

Emits a biome-index grid; what the biomes *mean* (walkable, minable, spawns) is your game's job.

See [SPEC.md](./SPEC.md) for the model, the seam-stability guarantee, and the floating-point
determinism caveat for cross-language ports.

MIT © metanet.games
