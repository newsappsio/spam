import { interpolateNumber } from "d3-interpolate";
import { transition } from "d3-transition";
import { easeLinear } from "d3-ease";
import { select } from "d3-selection";
import { geoTransform, geoPath } from "d3-geo";

import nearEqual from "./util/near-equal";
import translatePoint from "./util/translate-point";
import createRTrees from "./util/create-r-trees";
import PartialPainter from "./util/partial-painter";
import ImageCache from "./util/image-cache";

import { CanvasMap } from "./canvas-map";

export default class ZoomableCanvasMap {
  constructor(parameters) {
    const simplify = geoTransform({
      point: function(x, y, z) {
        if (!z || z >= area) this.stream.point(x, y);
      }
    });

    this.map = new CanvasMap(parameters);
    this.area = 0;
    this.canvas = null;
    this.context = null;

    this.settings = this.map.settings;
    this.dataPath = geoPath().projection({
      stream: s => {
        if (this.settings.projection)
          return simplify.stream(this.settings.projection.stream(s));
        return simplify.stream(s);
      }
    });

    this.imageCache = new ImageCache({
      width: this.settings.width,
      height: this.settings.height
    });

    this.busy = false;

    this.settings.map = this;
    this.settings.zoomScale = this.settings.zoomScale || 0.5;
  }

  init() {
    this.map.init();

    this.canvas = select(this.settings.element).append("canvas");
    this.context = this.canvas.node().getContext("2d");
    this.area = 1 / this.settings.ratio;

    if (this.settings.projection)
      this.area = this.area / this.settings.projection.scale() / 25;

    this.canvas.attr(
      "width",
      (this.settings.width * this.settings.ratio) / this.settings.projectedScale
    );

    this.canvas.attr(
      "height",
      (this.settings.height * this.settings.ratio) /
        this.settings.projectedScale
    );

    this.canvas.style("width", this.settings.width + "px");
    this.canvas.style("height", this.settings.height + "px");
    this.canvas.style("display", "none");
    this.context.lineJoin = "round";
    this.context.lineCap = "round";

    this.dataPath.context(this.context);

    this.imageCache.addImage({
      image: this.settings.background,
      scale: this.settings.scale,
      translate: this.settings.translate
    });

    createRTrees(this.settings.data, this.dataPath);
  }

  paint() {
    this.map.paint();
  }

  zoom(d) {
    if (!d) {
      this.scaleZoom(1, [0, 0]);
      return;
    }

    const bounds = this.dataPath.bounds(d);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const bx = (bounds[0][0] + bounds[1][0]) / 2;
    const by = (bounds[0][1] + bounds[1][1]) / 2;

    const scale =
      (this.settings.zoomScale / this.settings.projectedScale) *
      Math.min(this.settings.width / dx, this.settings.height / dy);

    const translate = [
      -bx + this.settings.width / this.settings.projectedScale / scale / 2,
      -by + this.settings.height / this.settings.projectedScale / scale / 2
    ];

    this.scaleZoom(scale, translate);
  }

  scaleZoom(scale, translate) {
    // We can just mutex with a standard variable, because JS is single threaded, yay!
    // The mutex is needed not to start multiple d3 transitions.
    if (this.busy) {
      return;
    }

    this.busy = true;

    if (
      nearEqual(scale, this.settings.scale) &&
      nearEqual(translate[0], this.settings.translate[0]) &&
      nearEqual(translate[1], this.settings.translate[1])
    ) {
      scale = 1;
      translate = [0, 0];
    }
    if (
      scale == 1 &&
      this.settings.scale == 1 &&
      !translate[0] &&
      !translate[1] &&
      !this.settings.translate[0] &&
      !this.settings.translate[1]
    ) {
      this.busy = false;
      return;
    }

    this.area = 1 / scale / this.settings.ratio;
    if (this.settings.projection)
      this.area = this.area / this.settings.projection.scale() / 25;

    this.context.save();
    this.context.scale(
      scale * this.settings.ratio,
      scale * this.settings.ratio
    );
    this.context.translate(translate[0], translate[1]);
    this.context.clearRect(
      -translate[0],
      -translate[1],
      (this.settings.width * this.settings.ratio) /
        this.settings.projectedScale,
      (this.settings.height * this.settings.ratio) /
        this.settings.projectedScale
    );

    const parameters = {
      path: this.dataPath,
      context: this.context,
      scale: scale,
      projectedScale: this.settings.projectedScale,
      translate: translate,
      width: this.settings.width,
      height: this.settings.height,
      map: this.settings.map,
      projection: this.settings.projection,
      projectedScale: this.settings.projectedScale
    };

    const image = this.imageCache.getImage({
      scale: scale,
      translate: translate
    });

    if (!image) {
      this.partialPainter = new PartialPainter(this.settings.data, parameters);
    }

    const translatedOne = translatePoint(
        [this.settings.width, this.settings.height],
        scale,
        translate
      ),
      translatedTwo = translatePoint(
        [this.settings.width, this.settings.height],
        this.settings.scale,
        this.settings.translate
      );

    const bbox = [
      Math.min(-translate[0], -this.settings.translate[0]),
      Math.min(-translate[1], -this.settings.translate[1]),
      Math.max(translatedOne[0], translatedTwo[0]),
      Math.max(translatedOne[1], translatedTwo[1])
    ];

    const zoomImage = this.imageCache.getFittingImage(bbox);

    if (zoomImage) {
      this.settings.background = zoomImage.image;
      this.settings.backgroundScale = zoomImage.scale;
      this.settings.backgroundTranslate = zoomImage.translate;
    }

    transition()
      .duration(300)
      .ease(easeLinear)
      .tween("zoom", () => {
        const i = interpolateNumber(this.settings.scale, scale);
        const oldTranslate = this.settings.translate;
        const oldScale = this.settings.scale;

        return t => {
          this.settings.scale = i(t);
          this.settings.translate = [
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

          this.map.paint();
          !image && this.partialPainter.renderNext();
        };
      })
      .on("end", () => {
        this.settings.scale = scale;
        this.settings.translate = translate;

        if (image) {
          this.context.restore();
          this.settings.background = image.image;
          this.settings.backgroundScale = image.scale;
          this.settings.backgroundTranslate = image.translate;
          this.map.paint();
        } else {
          this.map.paint();
          this.partialPainter.finish();

          const background = new Image();

          background.onload = () => {
            this.context.restore();
            this.imageCache.addImage({
              image: background,
              scale: scale,
              translate: translate
            });

            this.settings.background = background;
            this.settings.backgroundScale = scale;
            this.settings.backgroundTranslate = translate;
            this.map.paint();
          };

          // TODO there is a function to get the image data from the context, is that faster?
          // TODO use getImageData/putImageData, because it's faster?
          background.src = this.canvas.node().toDataURL();
        }

        this.busy = false;
      });
  }
}
