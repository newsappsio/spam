import RBush from "rbush";

function createRTree(element, dataPath) {
  element.lookupTree = new RBush(4);
  var elements = [];

  for (var j in element.features.features) {
    var bounds = dataPath.bounds(element.features.features[j]);
    elements.push({
      minX: Math.floor(bounds[0][0]),
      minY: Math.floor(bounds[0][1]),
      maxX: Math.ceil(bounds[1][0]),
      maxY: Math.ceil(bounds[1][1]),
      polygon: element.features.features[j]
    });
  }
  element.lookupTree.load(elements);
}

export default function(data, dataPath) {
  for (var i in data) {
    data[i].lookupTree || createRTree(data[i], dataPath);
  }
}
