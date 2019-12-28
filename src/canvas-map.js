import { select, mouse } from "d3-selection";
import { geoTransform, geoPath, geoBounds, geoMercator } from "d3-geo";

import translatePoint from "./util/translate-point";
import paintFeature from "./util/paint-feature";
import createRTrees from "./util/create-r-trees";

// TODO use turf inside as a dependency?
// Copied from turf.inside
function inside(pt, polygon) {
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

function maxBounds(one, two) {
  const bounds = two;
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
    for (const j in element.features.features) {
      paintFeature(element, element.features.features[j], parameters);
    }
  }
  element.static.postpaint && element.static.postpaint(parameters);
}

function extend(extension, obj) {
  const newObj = {};
  // FIXME this is a bit hacky? Can't we just mutate the original obj? (can't bc projection)
  for (const elem in obj) {
    newObj[elem] = obj[elem];
  }
  for (const elem in extension) {
    if (!newObj.hasOwnProperty(elem)) newObj[elem] = extension[elem];
  }
  return newObj;
}

class CanvasMap {
  constructor(parameters) {
    this.settings = extend(
      {
        width: select(parameters.element)
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
    );

    const area = this.settings.area;

    const simplify = geoTransform({
      point: function(x, y, z) {
        if (!z || z >= area) {
          this.stream.point(x, y);
        }
      }
    });

    this.canvas = null;
    this.context = null;

    if (!parameters.hasOwnProperty("projection")) {
      let b = [
        [Infinity, Infinity],
        [-Infinity, -Infinity]
      ];

      for (const i in this.settings.data) {
        b = maxBounds(b, geoBounds(this.settings.data[i].features));
      }

      this.settings.projection = geoMercator()
        .scale(1)
        .center([(b[1][0] + b[0][0]) / 2, (b[1][1] + b[0][1]) / 2]);
    }

    this.dataPath = geoPath().projection({
      stream: s => {
        if (this.settings.projection)
          return simplify.stream(this.settings.projection.stream(s));
        return simplify.stream(s);
      }
    });

    let b = [
      [Infinity, Infinity],
      [-Infinity, -Infinity]
    ];
    for (const i in this.settings.data) {
      b = maxBounds(b, this.dataPath.bounds(this.settings.data[i].features));
    }

    const dx = b[1][0] - b[0][0],
      dy = b[1][1] - b[0][1];

    if (!this.settings.projection) {
      this.settings.projectedScale = this.settings.width / b[1][0];
    }

    if (!parameters.hasOwnProperty("projection")) {
      this.settings.height =
        this.settings.height || Math.ceil((dy * this.settings.width) / dx);
      this.settings.projection
        .scale(0.9 * (this.settings.width / dx))
        .translate([this.settings.width / 2, this.settings.height / 2]);
    } else if (!this.settings.projected) {
      this.settings.height = Math.ceil(b[1][1] * this.settings.projectedScale);
    } else if (!this.settings.height) {
      this.settings.height = Math.ceil(dy / 0.9);
    }
    select(this.settings.parameters).attr("height", this.settings.height);
  }

  init() {
    this.canvas = select(this.settings.element).append("canvas");
    this.context = this.canvas.node().getContext("2d");

    const devicePixelRatio = window.devicePixelRatio || 1,
      backingStoreRatio =
        this.context.webkitBackingStorePixelRatio ||
        this.context.mozBackingStorePixelRatio ||
        this.context.msBackingStorePixelRatio ||
        this.context.oBackingStorePixelRatio ||
        this.context.backingStorePixelRatio ||
        1;

    this.settings.ratio =
      (devicePixelRatio / backingStoreRatio) * this.settings.projectedScale;
    this.settings.area = 1 / this.settings.ratio;
    if (this.settings.projection)
      this.settings.area =
        this.settings.area / this.settings.projection.scale() / 25;

    this.canvas.attr(
      "width",
      (this.settings.width / this.settings.projectedScale) * this.settings.ratio
    );
    this.canvas.attr(
      "height",
      (this.settings.height / this.settings.projectedScale) *
        this.settings.ratio
    );
    this.canvas.style("width", this.settings.width + "px");
    this.canvas.style("height", this.settings.height + "px");
    this.context.lineJoin = "round";
    this.context.lineCap = "round";

    this.dataPath.context(this.context);
    this.context.clearRect(
      0,
      0,
      this.settings.width * this.settings.ratio,
      this.settings.height * this.settings.ratio
    );
    this.context.save();
    this.context.scale(this.settings.ratio, this.settings.ratio);

    let hasHover = false;
    let hasClick = false;
    for (const i in this.settings.data) {
      let element = this.settings.data[i];

      hasHover = hasHover || (element.events && element.events.hover);
      hasClick = hasClick || (element.events && element.events.click);
    }

    // Only compute rtrees if we need it for event handling
    if (hasHover || hasClick) {
      createRTrees(this.settings.data, this.dataPath);
    }

    this.settings.background = new Image();
    this.settings.backgroundScale = this.settings.scale;
    this.settings.backgroundTranslate = this.settings.translate;

    const parameters = {
      path: this.dataPath,
      context: this.context,
      scale: this.settings.scale,
      translate: this.settings.translate,
      width: this.settings.width,
      height: this.settings.height,
      map: this.settings.map,
      projection: this.settings.projection,
      projectedScale: this.settings.projectedScale
    };

    const callback = () => {
      this.context.restore();

      hasClick && this.canvas.on("click", () => this.click(this.canvas));
      hasHover &&
        this.canvas
          .on("mousemove", () => this.hover(this.canvas))
          .on("mouseleave", () => this.hoverLeave(this.canvas));

      this.paint(); // For dynamic paints
    };

    for (const i in this.settings.data) {
      let element = this.settings.data[i];
      paintBackgroundElement(element, parameters);
    }
    this.settings.background.onload = callback;
    this.settings.background.src = this.canvas.node().toDataURL();

    //Prevent another call to the init method
    this.init = function() {};
  }

  paint() {
    this.context.save();
    this.context.scale(
      this.settings.scale * this.settings.ratio,
      this.settings.scale * this.settings.ratio
    );

    this.context.translate(
      this.settings.translate[0],
      this.settings.translate[1]
    );

    this.context.clearRect(
      -this.settings.translate[0],
      -this.settings.translate[1],
      (this.settings.width * this.settings.ratio) /
        this.settings.projectedScale,
      (this.settings.height * this.settings.ratio) /
        this.settings.projectedScale
    );

    this.context.rect(
      -this.settings.translate[0],
      -this.settings.translate[1],
      this.settings.width / this.settings.scale / this.settings.projectedScale,
      this.settings.height / this.settings.scale / this.settings.projectedScale
    );

    this.context.clip();

    // FIXME this needs a way for the callback to use the lookupTree?
    const parameters = {
      path: this.dataPath,
      context: this.dataPath.context(),
      scale: this.settings.scale,
      translate: this.settings.translate,
      width: this.settings.width,
      height: this.settings.height,
      map: this.settings.map,
      projection: this.settings.projection,
      projectedScale: this.settings.projectedScale
    };

    this.settings.area = 1 / this.settings.scale / this.settings.ratio;
    if (this.settings.projection)
      this.settings.area =
        this.settings.area / this.settings.projection.scale() / 25;

    for (const i in this.settings.data) {
      let element = this.settings.data[i];
      if (element.dynamic && element.dynamic.prepaint)
        element.dynamic.prepaint(parameters, element.hoverElement);
    }

    this.context.drawImage(
      this.settings.background,
      0,
      0,
      (this.settings.width * this.settings.ratio) /
        this.settings.projectedScale,
      (this.settings.height * this.settings.ratio) /
        this.settings.projectedScale,
      -this.settings.backgroundTranslate[0],
      -this.settings.backgroundTranslate[1],
      this.settings.width /
        this.settings.backgroundScale /
        this.settings.projectedScale,
      this.settings.height /
        this.settings.backgroundScale /
        this.settings.projectedScale
    );

    for (const i in this.settings.data) {
      let element = this.settings.data[i];
      if (element.dynamic && element.dynamic.postpaint)
        element.dynamic.postpaint(parameters, element.hoverElement);
    }

    this.context.restore();
  }

  click(canvas) {
    const point = translatePoint(
      mouse(canvas.node()),
      this.settings.scale * this.settings.projectedScale,
      this.settings.translate
    );

    const topojsonPoint = this.settings.projection
      ? this.settings.projection.invert(point)
      : point;

    const parameters = {
      scale: this.settings.scale,
      translate: this.settings.translate,
      width: this.settings.width,
      height: this.settings.height,
      map: this.settings.map,
      projection: this.settings.projection,
      projectedScale: this.settings.projectedScale
    };

    for (const i in this.settings.data) {
      let element = this.settings.data[i];
      if (!element.events || !element.events.click) continue;

      const lookup = element.lookupTree.search({
        minX: point[0],
        minY: point[1],
        maxX: point[0],
        maxY: point[1]
      });

      let isInside = false;
      for (const j in lookup) {
        const feature = lookup[j].polygon;
        if (inside(topojsonPoint, feature)) {
          element.events.click(parameters, feature);
          isInside = true;
        }
      }

      isInside || element.events.click(parameters, null);
    }
  }

  hoverLeave() {
    const parameters = {
      scale: this.settings.scale,
      translate: this.settings.translate,
      width: this.settings.width,
      height: this.settings.height,
      map: this.settings.map,
      projection: this.settings.projection,
      projectedScale: this.settings.projectedScale
    };

    for (const i in this.settings.data) {
      let element = this.settings.data[i];
      if (!element.events || !element.events.hover) continue;
      element.hoverElement = false;
      element.events.hover(parameters, null);
    }
  }

  hover(canvas) {
    const point = translatePoint(
      mouse(canvas.node()),
      this.settings.scale * this.settings.projectedScale,
      this.settings.translate
    );

    const parameters = {
      scale: this.settings.scale,
      translate: this.settings.translate,
      width: this.settings.width,
      height: this.settings.height,
      map: this.settings.map,
      projection: this.settings.projection,
      projectedScale: this.settings.projectedScale
    };

    const topojsonPoint = this.settings.projection
      ? this.settings.projection.invert(point)
      : point;

    for (const i in this.settings.data) {
      let element = this.settings.data[i];
      if (
        !element.events ||
        !element.events.hover ||
        (element.hoverElement && inside(topojsonPoint, element.hoverElement))
      ) {
        continue;
      }

      element.hoverElement = false;

      const lookup = element.lookupTree.search({
        minX: point[0],
        minY: point[1],
        maxX: point[0],
        maxY: point[1]
      });

      for (const j in lookup) {
        const feature = lookup[j].polygon;
        if (inside(topojsonPoint, feature)) {
          element.hoverElement = feature;
          break;
        }
      }

      element.events.hover(parameters, element.hoverElement);
    }
  }

  settings() {
    return this.settings;
  }
}

export { CanvasMap };
