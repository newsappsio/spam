export default function(canvas, callback) {
  let image = new Image();

  image.onload = callback;
  image.src = canvas.node().toDataURL();
  return image;
}
