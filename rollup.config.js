import { terser } from "rollup-plugin-terser";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import buble from "@rollup/plugin-buble";
import filesize from "rollup-plugin-filesize";
import * as meta from "./package.json";

const plugins = [
  resolve(),
  commonjs({
    sourceMap: false
  }),
  buble(),
  filesize()
];

const config = {
  input: "index.js",
  external: Object.keys(meta.dependencies || {}),
  output: {
    file: "dist/spam.js",
    globals: {
      d3: "d3",
      rbush: "RBush"
    },
    format: "umd",
    name: "spam"
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
