import nearEqual from "./near-equal";

function ImageCache(parameters) {
  var cache = [],
    settings = parameters;

  this.addImage = function(parameters) {
    cache.push(parameters);
  };

  this.getImage = function(parameters) {
    for (var i in cache) {
      var element = cache[i];
      if (
        nearEqual(element.scale, parameters.scale) &&
        nearEqual(element.translate[0], parameters.translate[0]) &&
        nearEqual(element.translate[1], parameters.translate[1])
      )
        return element;
    }
    return null;
  };

  this.getFittingImage = function(bbox) {
    // Auto set scale=1, translate[0, 0] image as default return
    var currentImage = cache.length > 0 ? cache[0] : null;
    for (var i in cache) {
      var image = cache[i],
        imageBB = [
          -image.translate[0],
          -image.translate[1],
          settings.width / image.scale - image.translate[0],
          settings.height / image.scale - image.translate[1]
        ];
      if (
        imageBB[0] <= bbox[0] &&
        imageBB[1] <= bbox[1] &&
        imageBB[2] >= bbox[2] &&
        imageBB[3] >= bbox[3] &&
        (!currentImage || currentImage.scale < image.scale)
      ) {
        currentImage = image;
      }
    }
    return currentImage;
  };
}

export { ImageCache };
