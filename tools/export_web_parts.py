#!/usr/bin/env python3
"""Export the Kurant module (Crown R8) from its CAD build folder to parts.json for build_crown_model.py.

Input:  a Crown build folder (the enclosure project's `build_r7_2.py` output): one STEP file per printed
        part in assembly coordinates (X right as you look at the face, Y toward the back, Z up, mm),
        and `_reference/*.stl` for the board, its components, the paint fill and the bought hardware.
Output: parts.json, a list of {name, kind, shift, v, f}; `shift` is the part's travel in the opened view.

The printed parts are re-tessellated from STEP at web resolution, so flat faces stay a few triangles
and the download stays small.

Usage: python3 tools/export_web_parts.py path/to/build_folder parts.json [sleeve size, default 31_8]
Needs: cadquery, trimesh, numpy
"""
import json
import sys
from pathlib import Path

import cadquery as cq
import numpy as np
import trimesh

PREFIX = "Crown_R7_2_"       # the enclosure scripts kept this file prefix after R7.2
LINEAR, ANGULAR = 0.06, 0.30  # tessellation tolerance: mm, radians

# (name on the site, source, kind, travel when the module opens)
FRONT, LIGHTS, BOARD, COVER = [0, -30, 0], [0, -15, 0], [0, 0, 0], [0, 22, 0]
BODY, SLEEVE, CAP = [0, 38, 0], [0, 48, 0], [0, 58, 0]
PARTS = [
    ("Front", "step:Front", "shell", FRONT),
    ("LensLine", "step:LensLine", "optic", FRONT),
    ("LensLogoBar", "step:LensLogoBar", "optic", FRONT),
    ("LensLogoTip", "step:LensLogoTip", "optic", FRONT),
    ("LensSideL", "step:LensSideL", "optic", FRONT),
    ("LensSideR", "step:LensSideR", "optic", FRONT),
    ("NameFill", "ref:name_fill", "paint", FRONT),
    ("LedCarrierLine", "step:LedCarrierLine", "shell", LIGHTS),
    ("LedCarrierLogoBar", "step:LedCarrierLogoBar", "shell", LIGHTS),
    ("LedCarrierLogoTip", "step:LedCarrierLogoTip", "shell", LIGHTS),
    ("LedCarrierSideL", "step:LedCarrierSideL", "shell", LIGHTS),
    ("LedCarrierSideR", "step:LedCarrierSideR", "shell", LIGHTS),
    ("PCB", "ref:pcb", "pcb", BOARD),
    ("Components", "ref:components", "pcb", BOARD),
    ("Back", "step:Back", "shell", COVER),
    ("LensBackBar", "step:LensBackBar", "optic", COVER),
    ("LensBackTip", "step:LensBackTip", "optic", COVER),
    ("ClipBody", "step:ClipBody", "shell", BODY),
    ("ClipSleeve", "step:ClipSleeve_{sleeve}", "rubber", SLEEVE),
    ("ClipCap", "step:ClipCap", "shell", CAP),
    ("ClipLever", "step:ClipLever", "shell", CAP),
    ("ClipHwBolt", "ref:hw_bolt", "hardware", CAP),
    ("ClipHwNut", "ref:hw_nut", "hardware", CAP),
    ("ClipHwPin", "pin:hw_pin", "hardware", CAP),
    ("ClipHwHinge", "pin:hw_hinge", "hardware", CAP),
]


def from_step(path):
    shape = cq.importers.importStep(str(path)).val()
    verts, tris = shape.tessellate(LINEAR, ANGULAR)
    return np.array([[p.x, p.y, p.z] for p in verts]), np.array(tris, dtype=np.int64)


def from_stl(path):
    m = trimesh.load(str(path), process=True)
    return np.asarray(m.vertices, dtype=np.float64), np.asarray(m.faces, dtype=np.int64)


def pin(path, sections=28):
    """A dowel pin along X, redrawn from its bounding box: the reference STL has 150 facets round it."""
    lo, hi = trimesh.load(str(path), process=True).bounds
    m = trimesh.creation.cylinder(radius=(hi[1] - lo[1]) / 2, height=hi[0] - lo[0], sections=sections)
    m.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0]))
    m.apply_translation((lo + hi) / 2)
    return np.asarray(m.vertices, dtype=np.float64), np.asarray(m.faces, dtype=np.int64)


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    sleeve = sys.argv[3] if len(sys.argv) > 3 else "31_8"
    parts = []
    for name, source, kind, shift in PARTS:
        how, stem = source.split(":")
        stem = stem.format(sleeve=sleeve)
        ref = src / "_reference" / f"{stem}.stl"
        v, f = from_step(src / f"{PREFIX}{stem}.step") if how == "step" else pin(ref) if how == "pin" else from_stl(ref)
        parts.append({"name": name, "kind": kind, "shift": shift,
                      "v": np.round(v, 4).tolist(), "f": f.tolist()})
        print(f"{name:20s} {kind:9s} verts {len(v):6d} tris {len(f):6d}")
    out.write_text(json.dumps(parts, separators=(",", ":")))
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
