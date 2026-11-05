// Fixed spots for the NTU scene, kept free of three.js so tests can load them.
// World frame: metres, x east and z south of 103.6825 E, 1.3475 N (see tools/ntu/build_campus.py).

/** The illustrative S-Lab room, inside the Academic Block North massing (ABN-02b-11 is the sourced part). */
export const ROOM = { x0: -86, x1: -58, z0: 112, z1: 125, h: 3.2, glass: -77.5, door: [-63.1, -62.0] };

/**
 * Where the guided day stands and walks, checked against the campus grid and by eye: across the
 * road from Graduate Hall 1, the lane between ABN and the College of Computing and Data Science,
 * and the open square outside the North Spine food court (not under its canopy).
 */
export const SPOTS = {
  hall: { stand: [478, -950], face: [505, -905] },
  walkToStop: [466, -946],
  runFrom: [452, -937.5],
  abn: { from: [-52, 130.5], door: [-74.5, 129.8], face: [-80, 128], facade: [-76, 40, 120] },
  foodCourt: { stand: [-256.3, 79.5], face: [-270.3, 55.3] },
};
