import { CanvasMap } from "./canvas-map";

export default class StaticCanvasMap {
  constructor(parameters) {
    this.map = new CanvasMap(parameters);
  }

  init() {
    this.map.init();
  }

  paint() {
    this.map.paint();
  }
}
