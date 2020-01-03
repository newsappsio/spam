import { terser } from "rollup-plugin-terser";
import resolve from "@rollup/plugin-node-resolve";
import buble from "@rollup/plugin-buble";
import filesize from "rollup-plugin-filesize";
import * as meta from "./package.json";

const plugins = [resolve(), buble(), filesize()];

const config = {
  input: "index.js",
  external: Object.keys(meta.dependencies || {}).filter(key =>
    /^d3-/.test(key)
  ),
  output: {
    name: "Spam",
    format: "umd",
    file: "dist/spam.js",
    globals: Object.assign(
      {},
      ...Object.keys(meta.dependencies || {})
        .filter(key => /^d3-/.test(key))
        .map(key => ({ [key]: "d3" }))
    )
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
