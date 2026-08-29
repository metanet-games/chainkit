// chainscape — turn placed BSV blocks into a contiguous 2-D biome map.
//
// Given blocks laid on a grid (each a {gx,gy,height,hash}), chainscape generates a seamless
// tiled terrain: every block's parcel is a value-noise biome field seeded from its block hash
// (via chainseed), and adjacent parcels are blended along corner-anchored seams (a Coons
// patch) so the world is continuous and — critically — STABLE as the chain grows: a new block
// appended at the frontier never changes the terrain of blocks already placed. Geography is a
// function of chain structure alone, so anyone with the same blocks derives the identical map.
//
// Layout and terrain are separate concerns: `spiralCells` is the current Ulam-spiral placement
// (height -> position, distance from centre ~ chain age); `makeGrid` is the terrain generator
// and is layout-agnostic (it only reads gx,gy,height,hash off whatever cells you hand it).
//
// See CHAINSCAPE-SPEC.md for the model; randomness comes entirely from ./chainseed.mjs.

import { seed } from "@metanet-games/chainseed";

// N = parcel resolution (tiles per side); BAND = seam blend width; AMP = seam wobble amplitude.
export const N = 64, BAND = Math.round(N * 0.12), AMP = 0.14;

// ---- deterministic smooth value-noise field from a block hash ----
// All randomness enters through chainseed: the block hash is the beacon, the coordinate
// path is the domain-separator. `unit8` reproduces the exact 1-byte/255 quantisation the
// world was originally baked with, so the generated terrain is unchanged.
function lattice(hash, salt, size) {
  const s = seed(hash);
  const g = [];
  for (let j=0;j<=size;j++){g[j]=[];for(let i=0;i<=size;i++)g[j][i]=s.unit8(`${salt}:${i}:${j}`);}
  return (u,v)=>{const fx=u*size,fy=v*size,x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(x0+1,size),y1=Math.min(y0+1,size),tx=fx-x0,ty=fy-y0,sx=tx*tx*(3-2*tx),sy=ty*ty*(3-2*ty),a=g[y0][x0],b=g[y0][x1],c=g[y1][x0],d=g[y1][x1];return (a+(b-a)*sx)+((c+(d-c)*sx)-(a+(b-a)*sx))*sy;};
}
const field = (hash,salt)=>{const lo=lattice(hash,salt+"lo",5),hi=lattice(hash,salt+"hi",14);return (u,v)=>lo(u,v)*0.7+hi(u,v)*0.3;};
// 1-D centred noise along a seam, seeded by a key hash + salt (both neighbours pass the same)
function lat1(key,salt,size){const s=seed(key);const g=[];for(let j=0;j<=size;j++)g[j]=s.unit8(`${salt}:${j}`);
  return t=>{const fy=t*size,y0=Math.floor(fy),y1=Math.min(y0+1,size),ty=fy-y0,sy=ty*ty*(3-2*ty);return g[y0]+(g[y1]-g[y0])*sy;};}
const enoise=(key,salt)=>{const lo=lat1(key,salt+"lo",5),hi=lat1(key,salt+"hi",14);return t=>(lo(t)*0.7+hi(t)*0.3)-0.5;};
const bump=t=>4*t*(1-t), cl=v=>Math.max(0,Math.min(1,v)), ss=w=>w*w*(3-2*w);
function biomeIdx(e,m){
  if(e<0.30)return 0; if(e<0.37)return 1; if(e<0.41)return 2;
  if(e>0.84)return 11; if(e>0.72)return 10; if(e>0.63)return m<0.4?9:6;
  if(m<0.28)return 3; if(m<0.42)return 4; if(m<0.62)return 5; if(m<0.80)return 6; return e<0.46?8:7;
}

// ---- Ulam spiral: index (= block height) -> [gx,gy]. gy increases SOUTH (screen-down). ----
export function spiralCells(count){
  const cells=[[0,0]]; let x=0,y=0,dx=1,dy=0,seg=1,steps=0,turns=0;
  while(cells.length<count){ x+=dx;y+=dy;cells.push([x,y]);
    if(++steps===seg){steps=0;[dx,dy]=[-dy,dx];if(++turns%2===0)seg++;} }
  return cells;
}

// ---- 2-D seam generation ----
// cellMap: "gx,gy" -> {gx,gy,height,hash,...}. Returns the biome grid for one cell.
export function makeGrid(cellMap, fieldCache){
  const fOf=h=>{ let f=fieldCache.get(h); if(!f){f={e:field(h,"elev"),m:field(h,"moist")};fieldCache.set(h,f);} return f; };
  const cellAt=(x,y)=>cellMap.get(x+","+y);
  // corner anchor at lattice point L=(lx,ly): value the LOWEST-height cell touching L naturally
  // has there (stable as the chain grows — the min-height cell always already exists).
  function anchor(lx,ly){
    const cs=[[lx-1,ly-1],[lx,ly-1],[lx-1,ly],[lx,ly]].map(([x,y])=>cellAt(x,y)).filter(Boolean);
    let mn=cs[0]; for(const c of cs) if(c.height<mn.height) mn=c;
    const f=fOf(mn.hash), lu=lx-mn.gx, lv=ly-mn.gy; // lu,lv in {0,1}
    return {e:f.e(lu,lv), m:f.m(lu,lv)};
  }
  const edgeId=(ax,ay,bx,by)=>{const A=ax+","+ay,B=bx+","+by;return A<B?A+"|"+B:B+"|"+A;};
  // an edge profile: interp between its two corner anchors + shared centred wobble
  function edge(aA,aB,cx,cy,nx,ny){ // corners aA(t=0),aB(t=1); this cell (cx,cy), neighbour (nx,ny)
    const nb=cellAt(nx,ny), me=cellAt(cx,cy);
    let key,salt;
    if(nb){ key = me.height<nb.height?me.hash:nb.hash; salt="seam:"+edgeId(cx,cy,nx,ny); }
    else  { key = me.hash; salt="frontier:"+cx+","+cy+":"+nx+","+ny; }
    const ne=enoise(key,salt+":e"), nm=enoise(key,salt+":m");
    return t=>({ e:aA.e+(aB.e-aA.e)*t + ne(t)*bump(t)*AMP,
                 m:aA.m+(aB.m-aA.m)*t + nm(t)*bump(t)*AMP });
  }

  return function gridFor(cell){
    const {gx,gy,hash}=cell, own=fOf(hash);
    // corners: NW=(gx,gy) top-left, NE=(gx+1,gy), SW=(gx,gy+1), SE=(gx+1,gy+1)  (cv=0 north/top)
    const NW=anchor(gx,gy), NE=anchor(gx+1,gy), SW=anchor(gx,gy+1), SE=anchor(gx+1,gy+1);
    const Nf=edge(NW,NE, gx,gy, gx,gy-1);   // north edge (v=0), u:0->1
    const Sf=edge(SW,SE, gx,gy, gx,gy+1);   // south edge (v=1)
    const Wf=edge(NW,SW, gx,gy, gx-1,gy);   // west edge (u=0), v:0->1
    const Ef=edge(NE,SE, gx,gy, gx+1,gy);   // east edge (u=1)
    const g=[];
    for(let y=0;y<N;y++){ g[y]=[];
      for(let x=0;x<N;x++){
        const uu=x/(N-1), vv=y/(N-1);
        let e=own.e(x/N,y/N), m=own.m(x/N,y/N);
        const d=Math.min(x, N-1-x, y, N-1-y);      // tiles to nearest boundary
        if(d<BAND){
          const w=ss(1-d/BAND);
          const nv=Nf(uu), sv=Sf(uu), wv=Wf(vv), ev=Ef(vv);
          const Fe=(1-uu)*wv.e+uu*ev.e+(1-vv)*nv.e+vv*sv.e-((1-uu)*(1-vv)*NW.e+uu*(1-vv)*NE.e+(1-uu)*vv*SW.e+uu*vv*SE.e);
          const Fm=(1-uu)*wv.m+uu*ev.m+(1-vv)*nv.m+vv*sv.m-((1-uu)*(1-vv)*NW.m+uu*(1-vv)*NE.m+(1-uu)*vv*SW.m+uu*vv*SE.m);
          e=e*(1-w)+Fe*w; m=m*(1-w)+Fm*w;
        }
        g[y][x]=biomeIdx(cl(e),cl(m));
      }
    }
    return g;
  };
}
