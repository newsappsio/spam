export default function(one, two) {
  const bounds = two;
  bounds[0][0] = Math.min(one[0][0], two[0][0]);
  bounds[0][1] = Math.min(one[0][1], two[0][1]);
  bounds[1][0] = Math.max(one[1][0], two[1][0]);
  bounds[1][1] = Math.max(one[1][1], two[1][1]);
  return bounds;
}
