export default function(point, scale, translate) {
  return [point[0] / scale - translate[0], point[1] / scale - translate[1]];
}
