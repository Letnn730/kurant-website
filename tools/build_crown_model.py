#!/usr/bin/env python3
"""Build the web model of the Kurant module (Crown R6) for the "Le module, ouvert" section.

Input:  parts.json exported from the CAD (02_FULL_DESIGN): one entry per part with
        name, kind, shift (explode vector, mm), v (vertices, mm) and f (triangles).
Output: assets/model/crown.bin  + assets/model/crown.json (layout of the binary)

Per part the binary holds:
  positions   float32 x3  (mm, assembly coordinates)
  normals     int8    x4  shading normals, split at creases (sharp design edges stay sharp)
  hull        int8    x4  normals averaged over every face at a point (for the outline shell)
  indices     uint16/uint32 triangles
  edges       float32 x6  crease segments (design edges), drawn as lines

Small parts that can't be resolved on a phone screen are left out, as in the R4 animation.
The housing is decimated to keep the download under ~1 MB.

Usage: python3 tools/build_crown_model.py path/to/parts.json
Needs: numpy, fast-simplification (pip install fast-simplification)
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np

SKIP_PREFIX = ("PCBPad_", "PCBInsert_", "PCBWasher_", "PCBSpacer_", "CoverInsert_", "MountInsert_",
               "ClampNut_", "YokeNut_", "LED_")
SKIP_NAMES = {"LightingBoardEnvelope", "OpticalBond_1", "CableGlandWasher", "CableGlandNut"}
TARGET_FACES = {"Housing": 16000}       # decimation targets; other parts are already light
CREASE_DEG = 38.0                       # dihedral angle above which an edge is a design edge
CREASE_DEG_PART = {"Housing": 50.0}     # curved, filleted shell: only its real design edges
SMOOTH_DEG = 38.0                       # faces closer than this share a shading normal

# What each part is called on screen, and its group in the exploded view.
GROUP = [
    ("Housing", "housing"), ("CrownLightGuide", "housing"),
    ("PCBReference", "board"), ("U10", "board"), ("C1IN", "board"),
    ("PCBRetainingRail", "rails"), ("PCBScrew", "rails"),
    ("RearCover", "cover"), ("RearGasket", "cover"), ("CoverScrew", "cover"),
    ("ContinuousMetalYoke", "mount"), ("WingSkin", "mount"), ("MountScrew", "mount"), ("YokeScrew", "mount"),
    ("Clamp", "clamps"), ("BarLiner", "clamps"),
    ("Cable", "cable"),
]


def group_of(name):
    for prefix, g in GROUP:
        if name.startswith(prefix):
            return g
    return "other"


def weld(v, f, tol=1e-4):
    """Merge duplicate vertices (STL-style soups) so edges can be shared."""
    key = np.round(v / tol).astype(np.int64)
    _, first, inverse = np.unique(key, axis=0, return_index=True, return_inverse=True)
    return v[first], inverse.reshape(-1)[f]


def decimate(v, f, target):
    import fast_simplification
    if len(f) <= target:
        return v, f
    v2, f2 = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32),
                                          target_reduction=1 - target / len(f))
    return v2.astype(np.float64), f2.astype(np.int64)


def face_normals(v, f):
    n = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    length = np.linalg.norm(n, axis=1, keepdims=True)
    keep = length[:, 0] > 1e-12
    n[keep] /= length[keep]
    return n, keep


def crease_segments(v, f, fn, deg):
    e = np.sort(np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]]), axis=1)
    owner = np.tile(np.arange(len(f)), 3)
    order = np.lexsort((e[:, 1], e[:, 0]))
    e, owner = e[order], owner[order]
    same = np.all(e[1:] == e[:-1], axis=1)
    crease_cos = np.cos(np.radians(deg))
    segs = []
    i, n = 0, len(e)
    while i < n:
        j = i + 1
        while j < n and same[j - 1]:
            j += 1
        faces = owner[i:j]
        if len(faces) != 2 or float(fn[faces[0]] @ fn[faces[1]]) < crease_cos:
            segs.append(e[i])
        i = j
    segs = np.array(segs, dtype=np.int64).reshape(-1, 2)
    return v[segs].reshape(-1, 6).astype(np.float32) if len(segs) else np.zeros((0, 6), np.float32)


def process(part):
    v = np.asarray(part["v"], dtype=np.float64)
    f = np.asarray(part["f"], dtype=np.int64)
    v, f = weld(v, f)
    deg = CREASE_DEG_PART.get(part["name"], CREASE_DEG)
    target = TARGET_FACES.get(part["name"])
    if target:
        # Design edges come from the full-resolution mesh; only the fill is decimated.
        fn0, ok0 = face_normals(v, f)
        edges = crease_segments(v, f[ok0], fn0[ok0], deg)
        v, f = decimate(v, f, target)
        v, f = weld(v, f)
    fn, ok = face_normals(v, f)
    f, fn = f[ok], fn[ok]
    if not target:
        edges = crease_segments(v, f, fn, deg)

    # Hull normals: area-agnostic average of every incident face at each welded vertex.
    hull = np.zeros_like(v)
    for k in range(3):
        np.add.at(hull, f[:, k], fn)
    hull /= np.maximum(np.linalg.norm(hull, axis=1, keepdims=True), 1e-12)

    # Shading normals split at creases: for each corner, average the incident faces whose
    # normal is within SMOOTH_DEG of this face's normal. Corners with the same (vertex, normal)
    # share one output vertex.
    smooth_cos = np.cos(np.radians(SMOOTH_DEG))
    incident = [[] for _ in range(len(v))]
    for t, tri in enumerate(f):
        for vi in tri:
            incident[vi].append(t)
    out_pos, out_nrm, out_hull, remap = [], [], [], {}
    tris = np.empty_like(f)
    for t, tri in enumerate(f):
        for k, vi in enumerate(tri):
            group = [u for u in incident[vi] if fn[u] @ fn[t] >= smooth_cos]
            nrm = fn[group].sum(axis=0)
            nrm /= max(np.linalg.norm(nrm), 1e-12)
            key = (int(vi), tuple(np.round(nrm * 64).astype(int)))
            idx = remap.get(key)
            if idx is None:
                idx = len(out_pos)
                remap[key] = idx
                out_pos.append(v[vi])
                out_nrm.append(nrm)
                out_hull.append(hull[vi])
            tris[t, k] = idx
    pos = np.array(out_pos, dtype=np.float32)
    nrm = np.array(out_nrm)
    hul = np.array(out_hull)
    return pos, nrm, hul, tris, edges


def i8(normals):
    q = np.clip(np.round(normals * 127), -127, 127).astype(np.int8)
    return np.concatenate([q, np.zeros((len(q), 1), np.int8)], axis=1)


def main():
    src = Path(sys.argv[1])
    out_dir = Path(__file__).resolve().parent.parent / "assets" / "model"
    out_dir.mkdir(parents=True, exist_ok=True)
    parts = json.loads(src.read_text())
    blob = bytearray()
    layout = []

    def put(arr):
        nonlocal blob
        while len(blob) % 4:
            blob.append(0)
        off = len(blob)
        blob += arr.tobytes()
        return off

    for p in parts:
        name = p["name"]
        if name in SKIP_NAMES or name.startswith(SKIP_PREFIX):
            continue
        pos, nrm, hul, tris, edges = process(p)
        idx = tris.astype(np.uint16 if len(pos) < 65536 else np.uint32)
        layout.append({
            "name": name,
            "kind": p["kind"],
            "group": group_of(name),
            "shift": p["shift"],
            "count": int(len(pos)),
            "pos": put(pos), "nrm": put(i8(nrm)), "hull": put(i8(hul)),
            "idx": put(idx), "idxCount": int(idx.size), "idx32": idx.dtype == np.uint32,
            "edges": put(edges), "edgeCount": int(len(edges)),
        })
        print(f"{name:26s} tris {len(tris):6d}  verts {len(pos):6d}  edges {len(edges):5d}")

    (out_dir / "crown.bin").write_bytes(bytes(blob))
    (out_dir / "crown.json").write_text(json.dumps({"version": 1, "units": "mm", "parts": layout}, separators=(",", ":")))
    print(f"crown.bin {len(blob) / 1024:.0f} KB, {len(layout)} parts")


if __name__ == "__main__":
    main()
