
// pt is [x,y] and ring is [[x,y], [x,y],..]
function inRing(pt, ring) {
  let isInside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    const intersect =
      yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

// Copied from turf.inside
// TODO use turf inside as a dependency?
export default function(pt, polygon) {
  let polys = polygon.geometry.coordinates;
  // normalize to multipolygon
  if (polygon.geometry.type === "Polygon") polys = [polys];

  let insidePoly = false;
  let i = 0;
  while (i < polys.length && !insidePoly) {
    // check if it is in the outer ring first
    if (inRing(pt, polys[i][0])) {
      let inHole = false;
      let k = 1;
      // check for the point in any of the holes
      while (k < polys[i].length && !inHole) {
        if (inRing(pt, polys[i][k])) {
          inHole = true;
        }
        k++;
      }
      if (!inHole) insidePoly = true;
    }
    i++;
  }
  return insidePoly;
}
