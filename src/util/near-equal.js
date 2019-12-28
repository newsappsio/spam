var epsilon = 0.5;

export default function(a, b) {
  return Math.abs(a - b) < epsilon;
}
