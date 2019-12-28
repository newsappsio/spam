import * as d3 from "d3";

import translatePoint from "./util/translate-point";
import paintFeature from "./util/paint-feature";
import createRTrees from "./util/create-r-trees";

// TODO use turf inside as a dependency?
// Copied from turf.inside
function inside(pt, polygon) {
  var polys = polygon.geometry.coordinates;
  // normalize to multipolygon
  if (polygon.geometry.type === "Polygon") polys = [polys];

  var insidePoly = false;
  var i = 0;
  while (i < polys.length && !insidePoly) {
    // check if it is in the outer ring first
    if (inRing(pt, polys[i][0])) {
      var inHole = false;
      var k = 1;
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

// pt is [x,y] and ring is [[x,y], [x,y],..]
function inRing(pt, ring) {
  var isInside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var xi = ring[i][0],
      yi = ring[i][1];
    var xj = ring[j][0],
      yj = ring[j][1];
    var intersect =
      yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

function maxBounds(one, two) {
  var bounds = two;
  bounds[0][0] = Math.min(one[0][0], two[0][0]);
  bounds[0][1] = Math.min(one[0][1], two[0][1]);
  bounds[1][0] = Math.max(one[1][0], two[1][0]);
  bounds[1][1] = Math.max(one[1][1], two[1][1]);
  return bounds;
}

function paintBackgroundElement(element, parameters) {
  if (!element.static) return;
  element.static.prepaint && element.static.prepaint(parameters);
  if (element.static.paintfeature) {
    for (var j in element.features.features) {
      paintFeature(element, element.features.features[j], parameters);
    }
  }
  element.static.postpaint && element.static.postpaint(parameters);
}

function extend(extension, obj) {
  var newObj = {};
  // FIXME this is a bit hacky? Can't we just mutate the original obj? (can't bc projection)
  for (var elem in obj) {
    newObj[elem] = obj[elem];
  }
  for (var elem in extension) {
    if (!newObj.hasOwnProperty(elem)) newObj[elem] = extension[elem];
  }
  return newObj;
}

function CanvasMap(parameters) {
  var settings = extend(
      {
        width: d3
          .select(parameters.element)
          .node()
          .getBoundingClientRect().width,
        ratio: 1,
        area: 0,
        scale: 1,
        projectedScale: 1,
        translate: [0, 0],
        background: null,
        backgroundScale: 1,
        backgroundTranslate: [0, 0],
        map: this
      },
      parameters
    ),
    simplify = d3.geoTransform({
      point: function(x, y, z) {
        if (!z || z >= settings.area) {
          this.stream.point(x, y);
        }
      }
    }),
    canvas = null,
    context = null;

  if (!parameters.hasOwnProperty("projection")) {
    var b = [
      [Infinity, Infinity],
      [-Infinity, -Infinity]
    ];
    for (var i in settings.data) {
      b = maxBounds(b, d3.geoBounds(settings.data[i].features));
    }
    settings.projection = d3
      .geoMercator()
      .scale(1)
      .center([(b[1][0] + b[0][0]) / 2, (b[1][1] + b[0][1]) / 2]);
  }
  var dataPath = d3.geoPath().projection({
    stream: function(s) {
      if (settings.projection)
        return simplify.stream(settings.projection.stream(s));
      return simplify.stream(s);
    }
  });
  var b = [
    [Infinity, Infinity],
    [-Infinity, -Infinity]
  ];
  for (var i in settings.data) {
    b = maxBounds(b, dataPath.bounds(settings.data[i].features));
  }

  var dx = b[1][0] - b[0][0],
    dy = b[1][1] - b[0][1];

  if (!settings.projection) {
    settings.projectedScale = settings.width / b[1][0];
  }

  if (!parameters.hasOwnProperty("projection")) {
    settings.height = settings.height || Math.ceil((dy * settings.width) / dx);
    settings.projection
      .scale(0.9 * (settings.width / dx))
      .translate([settings.width / 2, settings.height / 2]);
  } else if (!settings.projected) {
    settings.height = Math.ceil(b[1][1] * settings.projectedScale);
  } else if (!settings.height) {
    settings.height = Math.ceil(dy / 0.9);
  }
  d3.select(settings.parameters).attr("height", settings.height);

  function init() {
    canvas = d3.select(settings.element).append("canvas");
    context = canvas.node().getContext("2d");

    var devicePixelRatio = window.devicePixelRatio || 1,
      backingStoreRatio =
        context.webkitBackingStorePixelRatio ||
        context.mozBackingStorePixelRatio ||
        context.msBackingStorePixelRatio ||
        context.oBackingStorePixelRatio ||
        context.backingStorePixelRatio ||
        1;

    settings.ratio =
      (devicePixelRatio / backingStoreRatio) * settings.projectedScale;
    settings.area = 1 / settings.ratio;
    if (settings.projection)
      settings.area = settings.area / settings.projection.scale() / 25;

    canvas.attr(
      "width",
      (settings.width / settings.projectedScale) * settings.ratio
    );
    canvas.attr(
      "height",
      (settings.height / settings.projectedScale) * settings.ratio
    );
    canvas.style("width", settings.width + "px");
    canvas.style("height", settings.height + "px");
    context.lineJoin = "round";
    context.lineCap = "round";

    dataPath.context(context);
    context.clearRect(
      0,
      0,
      settings.width * settings.ratio,
      settings.height * settings.ratio
    );
    context.save();
    context.scale(settings.ratio, settings.ratio);

    var hasHover = false,
      hasClick = false;
    for (var i in settings.data) {
      var element = settings.data[i];

      hasHover = hasHover || (element.events && element.events.hover);
      hasClick = hasClick || (element.events && element.events.click);
    }

    // Only compute rtrees if we need it for event handling
    if (hasHover || hasClick) {
      createRTrees(settings.data, dataPath);
    }

    settings.background = new Image();
    settings.backgroundScale = settings.scale;
    settings.backgroundTranslate = settings.translate;
    var parameters = {
      path: dataPath,
      context: context,
      scale: settings.scale,
      translate: settings.translate,
      width: settings.width,
      height: settings.height,
      map: settings.map,
      projection: settings.projection,
      projectedScale: settings.projectedScale
    };
    var callback = function() {
      context.restore();

      hasClick && canvas.on("click", click);
      hasHover && canvas.on("mousemove", hover).on("mouseleave", hoverLeave);

      paint(); // For dynamic paints
    };

    for (var i in settings.data) {
      var element = settings.data[i];
      paintBackgroundElement(element, parameters);
    }
    settings.background.onload = callback;
    settings.background.src = canvas.node().toDataURL();

    //Prevent another call to the init method
    this.init = function() {};
  }

  function paint() {
    context.save();
    context.scale(
      settings.scale * settings.ratio,
      settings.scale * settings.ratio
    );
    context.translate(settings.translate[0], settings.translate[1]);

    context.clearRect(
      -settings.translate[0],
      -settings.translate[1],
      (settings.width * settings.ratio) / settings.projectedScale,
      (settings.height * settings.ratio) / settings.projectedScale
    );

    context.rect(
      -settings.translate[0],
      -settings.translate[1],
      settings.width / settings.scale / settings.projectedScale,
      settings.height / settings.scale / settings.projectedScale
    );
    context.clip();

    // FIXME this needs a way for the callback to use the lookupTree?
    var parameters = {
      path: dataPath,
      context: dataPath.context(),
      scale: settings.scale,
      translate: settings.translate,
      width: settings.width,
      height: settings.height,
      map: settings.map,
      projection: settings.projection,
      projectedScale: settings.projectedScale
    };

    settings.area = 1 / settings.scale / settings.ratio;
    if (settings.projection)
      settings.area = settings.area / settings.projection.scale() / 25;

    for (var i in settings.data) {
      var element = settings.data[i];
      if (element.dynamic && element.dynamic.prepaint)
        element.dynamic.prepaint(parameters, element.hoverElement);
    }

    context.drawImage(
      settings.background,
      0,
      0,
      (settings.width * settings.ratio) / settings.projectedScale,
      (settings.height * settings.ratio) / settings.projectedScale,
      -settings.backgroundTranslate[0],
      -settings.backgroundTranslate[1],
      settings.width / settings.backgroundScale / settings.projectedScale,
      settings.height / settings.backgroundScale / settings.projectedScale
    );

    for (var i in settings.data) {
      var element = settings.data[i];
      if (element.dynamic && element.dynamic.postpaint)
        element.dynamic.postpaint(parameters, element.hoverElement);
    }

    context.restore();
  }

  function click() {
    var point = translatePoint(
        d3.mouse(this),
        settings.scale * settings.projectedScale,
        settings.translate
      ),
      topojsonPoint = settings.projection
        ? settings.projection.invert(point)
        : point;

    var parameters = {
      scale: settings.scale,
      translate: settings.translate,
      width: settings.width,
      height: settings.height,
      map: settings.map,
      projection: settings.projection,
      projectedScale: settings.projectedScale
    };
    for (var i in settings.data) {
      var element = settings.data[i];
      if (!element.events || !element.events.click) continue;

      var lookup = element.lookupTree.search({
        minX: point[0],
        minY: point[1],
        maxX: point[0],
        maxY: point[1]
      });
      var isInside = false;
      for (var j in lookup) {
        var feature = lookup[j].polygon;
        if (inside(topojsonPoint, feature)) {
          element.events.click(parameters, feature);
          isInside = true;
        }
      }
      isInside || element.events.click(parameters, null);
    }
  }

  function hoverLeave() {
    var parameters = {
      scale: settings.scale,
      translate: settings.translate,
      width: settings.width,
      height: settings.height,
      map: settings.map,
      projection: settings.projection,
      projectedScale: settings.projectedScale
    };
    for (var i in settings.data) {
      var element = settings.data[i];
      if (!element.events || !element.events.hover) continue;
      element.hoverElement = false;
      element.events.hover(parameters, null);
    }
  }

  function hover() {
    var point = translatePoint(
        d3.mouse(this),
        settings.scale * settings.projectedScale,
        settings.translate
      ),
      parameters = {
        scale: settings.scale,
        translate: settings.translate,
        width: settings.width,
        height: settings.height,
        map: settings.map,
        projection: settings.projection,
        projectedScale: settings.projectedScale
      },
      topojsonPoint = settings.projection
        ? settings.projection.invert(point)
        : point;

    for (var i in settings.data) {
      var element = settings.data[i];
      if (
        !element.events ||
        !element.events.hover ||
        (element.hoverElement && inside(topojsonPoint, element.hoverElement))
      ) {
        continue;
      }
      element.hoverElement = false;
      var lookup = element.lookupTree.search({
        minX: point[0],
        minY: point[1],
        maxX: point[0],
        maxY: point[1]
      });
      for (var j in lookup) {
        var feature = lookup[j].polygon;
        if (inside(topojsonPoint, feature)) {
          element.hoverElement = feature;
          break;
        }
      }
      element.events.hover(parameters, element.hoverElement);
    }
  }

  this.init = init;
  this.paint = paint;
  this.settings = function() {
    return settings;
  };
}

export { CanvasMap };
