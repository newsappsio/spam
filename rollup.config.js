import { terser } from "rollup-plugin-terser";
import resolve from "@rollup/plugin-node-resolve";
import buble from "@rollup/plugin-buble";
import filesize from "rollup-plugin-filesize";
import * as meta from "./package.json";

const plugins = [resolve(), buble(), filesize()];

const config = {
  input: "index.js",
  external: "d3",
  output: {
    name: "Spam",
    format: "umd",
    file: "dist/spam.js",
    globals: {
      d3: "d3",
      rbush: "RBush"
    }
  },
  plugins
};

export default [
  config,
  {
    ...config,
    output: {
      ...config.output,
      file: `dist/spam.min.js`
    },
    plugins: [...config.plugins, terser()]
  }
];
