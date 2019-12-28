import * as d3 from "d3";

import nearEqual from "./src/near-equal";
import translatePoint from "./src/translate-point";

import { PartialPainter } from "./src/partial-painter";
import { ImageCache } from "./src/image-cache";
import { CanvasMap } from "./src/canvas-map";

function StaticCanvasMap(parameters) {
  var map = new CanvasMap(parameters);

  this.init = function() {
    map.init();
  };
  this.paint = function() {
    map.paint();
  };

  return map;
}

function ZoomableCanvasMap(parameters) {
  var map = new CanvasMap(parameters),
    simplify = d3.geoTransform({
      point: function(x, y, z) {
        if (!z || z >= area) this.stream.point(x, y);
      }
    }),
    area = 0,
    canvas = null,
    context = null,
    settings = map.settings(),
    dataPath = d3.geoPath().projection({
      stream: function(s) {
        if (settings.projection)
          return simplify.stream(settings.projection.stream(s));
        return simplify.stream(s);
      }
    }),
    imageCache = new ImageCache({
      width: settings.width,
      height: settings.height
    }),
    busy = false;

  settings.map = this;
  settings.zoomScale = settings.zoomScale || 0.5;

  this.init = function() {
    map.init();

    canvas = d3.select(settings.element).append("canvas");
    context = canvas.node().getContext("2d");
    area = 1 / settings.ratio;
    if (settings.projection) area = area / settings.projection.scale() / 25;

    canvas.attr(
      "width",
      (settings.width * settings.ratio) / settings.projectedScale
    );
    canvas.attr(
      "height",
      (settings.height * settings.ratio) / settings.projectedScale
    );
    canvas.style("width", settings.width + "px");
    canvas.style("height", settings.height + "px");
    canvas.style("display", "none");
    context.lineJoin = "round";
    context.lineCap = "round";

    dataPath.context(context);

    imageCache.addImage({
      image: settings.background,
      scale: settings.scale,
      translate: settings.translate
    });

    createRTrees(settings.data, dataPath);
  };

  this.paint = function() {
    map.paint();
  };

  function scaleZoom(scale, translate) {
    // We can just mutex with a standard variable, because JS is single threaded, yay!
    // The mutex is needed not to start multiple d3 transitions.
    if (busy) {
      return;
    }
    busy = true;
    if (
      nearEqual(scale, settings.scale) &&
      nearEqual(translate[0], settings.translate[0]) &&
      nearEqual(translate[1], settings.translate[1])
    ) {
      scale = 1;
      translate = [0, 0];
    }
    if (
      scale == 1 &&
      settings.scale == 1 &&
      !translate[0] &&
      !translate[1] &&
      !settings.translate[0] &&
      !settings.translate[1]
    ) {
      busy = false;
      return;
    }
    area = 1 / scale / settings.ratio;
    if (settings.projection) area = area / settings.projection.scale() / 25;

    context.save();
    context.scale(scale * settings.ratio, scale * settings.ratio);
    context.translate(translate[0], translate[1]);
    context.clearRect(
      -translate[0],
      -translate[1],
      (settings.width * settings.ratio) / settings.projectedScale,
      (settings.height * settings.ratio) / settings.projectedScale
    );

    var parameters = {
      path: dataPath,
      context: context,
      scale: scale,
      projectedScale: settings.projectedScale,
      translate: translate,
      width: settings.width,
      height: settings.height,
      map: settings.map,
      projection: settings.projection,
      projectedScale: settings.projectedScale
    };

    var image = imageCache.getImage({
      scale: scale,
      translate: translate
    });
    if (!image) {
      var partialPainter = new PartialPainter(settings.data, parameters);
    }

    var translatedOne = translatePoint(
        [settings.width, settings.height],
        scale,
        translate
      ),
      translatedTwo = translatePoint(
        [settings.width, settings.height],
        settings.scale,
        settings.translate
      );

    var bbox = [
      Math.min(-translate[0], -settings.translate[0]),
      Math.min(-translate[1], -settings.translate[1]),
      Math.max(translatedOne[0], translatedTwo[0]),
      Math.max(translatedOne[1], translatedTwo[1])
    ];

    var zoomImage = imageCache.getFittingImage(bbox);
    if (zoomImage) {
      settings.background = zoomImage.image;
      settings.backgroundScale = zoomImage.scale;
      settings.backgroundTranslate = zoomImage.translate;
    }

    d3.transition()
      .duration(300)
      .ease(d3.easeLinear)
      .tween("zoom", function() {
        var i = d3.interpolateNumber(settings.scale, scale),
          oldTranslate = settings.translate,
          oldScale = settings.scale;
        return function(t) {
          settings.scale = i(t);
          settings.translate = [
            oldTranslate[0] +
              (((translate[0] - oldTranslate[0]) / (scale - oldScale)) *
                (i(t) - oldScale) *
                scale) /
                i(t),
            oldTranslate[1] +
              (((translate[1] - oldTranslate[1]) / (scale - oldScale)) *
                (i(t) - oldScale) *
                scale) /
                i(t)
          ];
          map.paint();
          !image && partialPainter.renderNext();
        };
      })
      .on("end", function() {
        settings.scale = scale;
        settings.translate = translate;

        if (image) {
          context.restore();
          settings.background = image.image;
          settings.backgroundScale = image.scale;
          settings.backgroundTranslate = image.translate;
          map.paint();
        } else {
          map.paint();
          partialPainter.finish();

          var background = new Image();
          background.onload = function() {
            context.restore();
            imageCache.addImage({
              image: background,
              scale: scale,
              translate: translate
            });
            settings.background = background;
            settings.backgroundScale = scale;
            settings.backgroundTranslate = translate;
            map.paint();
          };
          // TODO there is a function to get the image data from the context, is that faster?
          // TODO use getImageData/putImageData, because it's faster?
          background.src = canvas.node().toDataURL();
        }
        busy = false;
      });
  }

  this.zoom = function(d) {
    if (!d) {
      scaleZoom.call(this, 1, [0, 0]);
      return;
    }
    var bounds = dataPath.bounds(d),
      dx = bounds[1][0] - bounds[0][0],
      dy = bounds[1][1] - bounds[0][1],
      bx = (bounds[0][0] + bounds[1][0]) / 2,
      by = (bounds[0][1] + bounds[1][1]) / 2,
      scale =
        (settings.zoomScale / settings.projectedScale) *
        Math.min(settings.width / dx, settings.height / dy),
      translate = [
        -bx + settings.width / settings.projectedScale / scale / 2,
        -by + settings.height / settings.projectedScale / scale / 2
      ];

    scaleZoom.call(this, scale, translate);
  };

  return map;
}

export default { StaticCanvasMap, ZoomableCanvasMap };
