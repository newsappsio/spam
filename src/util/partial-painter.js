import paintFeature from "./paint-feature";

export default function(data, parameters) {
  var index = 0,
    j = 0,
    element = data[index],
    currentLookup = element.lookupTree.search({
      minX: -parameters.translate[0],
      minY: -parameters.translate[1],
      maxX:
        parameters.width / parameters.scale / parameters.projectedScale -
        parameters.translate[0],
      maxY:
        parameters.height / parameters.scale / parameters.projectedScale -
        parameters.translate[1]
    });

  function selectNextIndex() {
    index++;
    while (index < data.length && !data[index].static) {
      index++;
    }
    if (index >= data.length) return false;
    element = data[index];
    currentLookup = element.lookupTree.search({
      minX: -parameters.translate[0],
      minY: -parameters.translate[1],
      maxX:
        parameters.width / parameters.scale / parameters.projectedScale -
        parameters.translate[0],
      maxY:
        parameters.height / parameters.scale / parameters.projectedScale -
        parameters.translate[1]
    });
    j = 0;
    return true;
  }

  this.hasNext = function() {
    return index < data.length && j < currentLookup.length;
  };
  this.renderNext = function() {
    if (!this.hasNext()) return;
    var start = performance.now();
    j >= currentLookup.length && selectNextIndex();

    !j && element.static.prepaint && element.static.prepaint(parameters);

    !element.static.paintfeature && (j = currentLookup.length);

    for (; j != currentLookup.length; ++j) {
      paintFeature(element, currentLookup[j].polygon, parameters);
      if (performance.now() - start > 10) return;
    }
    element.static.postpaint && element.static.postpaint(parameters);
  };
  this.finish = function() {
    if (j < currentLookup.length) {
      if (element.static.paintfeature) {
        for (; j != currentLookup.length; ++j) {
          paintFeature(element, currentLookup[j].polygon, parameters);
        }
      }
      element.static.postpaint && element.static.postpaint(parameters);
    }
    while (selectNextIndex()) {
      element.static.prepaint && element.static.prepaint(parameters);
      if (element.static.paintfeature) {
        for (; j != currentLookup.length; ++j) {
          paintFeature(element, currentLookup[j].polygon, parameters);
        }
      }
      element.static.postpaint && element.static.postpaint(parameters);
    }
  };
}
