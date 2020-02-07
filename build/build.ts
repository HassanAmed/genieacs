/**
 * Copyright 2013-2019  GenieACS Inc.
 *
 * This file is part of GenieACS.
 *
 * GenieACS is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * GenieACS is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with GenieACS.  If not, see <http://www.gnu.org/licenses/>.
 */

 /**
  * @description This is build script to build the project
  */
import * as path from "path";
import * as fs from "fs";
import { promisify } from "util";
import { rollup, WarningHandler } from "rollup";
import rollupReplace from "rollup-plugin-replace";
import rollupJson from "rollup-plugin-json";
import typescript from "rollup-plugin-typescript";
import { terser } from "rollup-plugin-terser";
import webpack from "webpack";
import postcss from "postcss";
import postcssImport from "postcss-import";
import postcssPresetEnv from "postcss-preset-env";
import cssnano from "cssnano";
import SVGO from "svgo";
import * as xmlParser from "../lib/xml-parser";
/**
 * @description If mode is set in environment get it otherwise set it to production.
 */
const MODE = process.env["NODE_ENV"] || "production";

const BUILD_METADATA = new Date()
  .toISOString()
  .split(".")[0]
  .replace(/[^0-9]/g, "");

const INPUT_DIR = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.resolve(__dirname, "../dist");

const externals = [
  "path",
  "fs",
  "cluster",
  "os",
  "tls",
  "http",
  "https",
  "zlib",
  "crypto",
  "util",
  "mongodb",
  "vm",
  "later",
  "parsimmon",
  "seedrandom",
  "querystring",
  "child_process",
  "dgram",
  "url",
  "iconv-lite",
  "koa",
  "koa-router",
  "koa-compress",
  "koa-bodyparser",
  "koa-jwt",
  "koa-static",
  "jsonwebtoken",
  "stream",
  "mithril",
  "parsimmon",
  "yaml",
  "codemirror",
  "codemirror/mode/javascript/javascript",
  "codemirror/mode/yaml/yaml",
  "ipaddr.js"
];
/**
 * @description Delete the provided dir in path
 * @param dirPath directory path
 */
function rmDirSync(dirPath): void {
  if (!fs.existsSync(dirPath)) return;
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = `${dirPath}/${file}`;
    if (fs.statSync(filePath).isFile()) fs.unlinkSync(filePath);
    else rmDirSync(filePath);
  }
  fs.rmdirSync(dirPath);
}
/**
 * @description Delete any previous dev dependencies
 * @param deps dependencies
 */
function stripDevDeps(deps): void {
  if (!deps["dependencies"]) return;
  for (const [k, v] of Object.entries(deps["dependencies"])) {
    if (v["dev"]) delete deps["dependencies"][k];
    else stripDevDeps(v);
  }
  if (!Object.keys(deps["dependencies"]).length) delete deps["dependencies"];
}
/**
 * @description Fn to convert xml To string
 * @param xml 
 */
function xmlTostring(xml): string {
  const children = [];
  for (const c of xml.children || []) children.push(xmlTostring(c));

  return xml.name === "root" && xml.bodyIndex === 0
    ? children.join("")
    : `<${xml.name} ${xml.attrs}>${children.join("")}</${xml.name}>`;
}
/**
 * @description Fn to generate symbol from svg string
 */
function generateSymbol(id: string, svgStr: string): string {
  const xml = xmlParser.parseXml(svgStr);
  const svg = xml.children[0];
  const svgAttrs = xmlParser.parseAttrs(svg.attrs);
  let viewBox = "";
  for (const a of svgAttrs) {
    if (a.name === "viewBox") {
      viewBox = `viewBox="${a.value}"`;
      break;
    }
  }
  const symbolBody = xml.children[0].children
    .map(c => {
      return xmlTostring(c);
    })
    .join("");
  return `<symbol id="icon-${id}" ${viewBox}>${symbolBody}</symbol>`;
}
/**
 * @description Initialize building by removing old directories making new layout adding pkg.json etc
 */
async function init(): Promise<void> {
  // Delete any old output directory
  rmDirSync(OUTPUT_DIR);

  // Create output directory layout
  fs.mkdirSync(OUTPUT_DIR);
  fs.mkdirSync(OUTPUT_DIR + "/bin");
  fs.mkdirSync(OUTPUT_DIR + "/public");
  fs.mkdirSync(OUTPUT_DIR + "/tools");

  // Create package.json
  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve(INPUT_DIR, "package.json")).toString()
  );
  delete packageJson["devDependencies"];
  packageJson["scripts"] = {
    install: packageJson["scripts"].install,
    configure: packageJson["scripts"].configure
  };
  packageJson["version"] = `${packageJson["version"]}+${BUILD_METADATA}`;
  fs.writeFileSync(
    path.resolve(OUTPUT_DIR, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );

  // Create npm-shrinkwrap.json
  const npmShrinkwrapJson = JSON.parse(
    fs.readFileSync(path.resolve(INPUT_DIR, "npm-shrinkwrap.json")).toString()
  );
  npmShrinkwrapJson["version"] = packageJson["version"];
  stripDevDeps(npmShrinkwrapJson);
  fs.writeFileSync(
    path.resolve(OUTPUT_DIR, "npm-shrinkwrap.json"),
    JSON.stringify(npmShrinkwrapJson, null, 2)
  );
}
/**
 * @description Copying static files
 */
async function copyStatic(): Promise<void> {
  const files = [
    "LICENSE",
    "README.md",
    "CHANGELOG.md",
    "public/logo.svg",
    "public/favicon.png"
  ];

  for (const file of files) {
    fs.copyFileSync(
      path.resolve(INPUT_DIR, file),
      path.resolve(OUTPUT_DIR, file)
    );
  }
}
/**
 * @description Fn to generate css from css files on given path
 */
async function generateCss(): Promise<void> {
  const cssInPath = path.resolve(INPUT_DIR, "ui/css/app.css");
  const cssOutPath = path.resolve(OUTPUT_DIR, "public/app.css");
  const cssIn = fs.readFileSync(cssInPath);
  const cssOut = await postcss([
    postcssImport,
    postcssPresetEnv({
      stage: 3,
      features: {
        "nesting-rules": true,
        "color-mod-function": true
      }
    }),
    cssnano
  ]).process(cssIn, { from: cssInPath, to: cssOutPath });
  fs.writeFileSync(cssOutPath, cssOut.css);
}
/**
 * @description Generate build tools 
 */
async function generateToolsJs(): Promise<void> {
  for (const bin of ["dump-data-model"]) {
    const inputFile = path.resolve(INPUT_DIR, `tools/${bin}`);
    const outputFile = path.resolve(OUTPUT_DIR, `tools/${bin}`);
    const bundle = await rollup({
      input: inputFile,
      external: externals,
      acorn: {
        allowHashBang: true
      },
      plugins: [
        rollupReplace({
          delimiters: ["", ""],
          "#!/usr/bin/env -S node -r esm -r ts-node/register/transpile-only": ""
        }),
        typescript({
          tsconfig: "./tsconfig.json",
          include: [`tools/${bin}`, "lib/**/*.ts"]
        }),
        MODE === "production" ? terser() : null
      ]
    });

    await bundle.write({
      format: "cjs",
      preferConst: true,
      sourcemap: "inline",
      sourcemapExcludeSources: true,
      banner: "#!/usr/bin/env node",
      file: outputFile
    });

    // Mark as executable
    const mode = fs.statSync(outputFile).mode;
    fs.chmodSync(outputFile, mode | 73);
  }
}
/**
 * @description Create binaries for all services
 */
async function generateBackendJs(): Promise<void> {
  for (const bin of [
    "genieacs-cwmp",
    "genieacs-ext",
    "genieacs-nbi",
    "genieacs-fs",
    "genieacs-ui"
  ]) {
    const inputFile = path.resolve(INPUT_DIR, `bin/${bin}`);
    const outputFile = path.resolve(OUTPUT_DIR, `bin/${bin}`);
    const bundle = await rollup({
      input: inputFile,
      external: externals,
      acorn: {
        allowHashBang: true
      },
      treeshake: {
        propertyReadSideEffects: false,
        pureExternalModules: true
      },
      plugins: [
        rollupReplace({
          delimiters: ["", ""],
          "#!/usr/bin/env -S node -r esm -r ts-node/register/transpile-only": ""
        }),
        rollupJson({ preferConst: true }),
        {
          resolveId: (importee, importer) => {
            if (importee.endsWith("/package.json")) {
              const p = path.resolve(path.dirname(importer), importee);
              if (p === path.resolve(INPUT_DIR, "package.json"))
                return path.resolve(OUTPUT_DIR, "package.json");
            }
            return null;
          }
        },
        typescript({
          tsconfig: "./tsconfig.json",
          include: [`bin/${bin}`, "lib/**/*.ts"]
        }),
        MODE === "production" ? terser() : null
      ]
    });

    await bundle.write({
      format: "cjs",
      preferConst: true,
      sourcemap: "inline",
      sourcemapExcludeSources: true,
      banner: "#!/usr/bin/env node",
      file: outputFile
    });

    // Mark as executable
    const mode = fs.statSync(outputFile).mode;
    fs.chmodSync(outputFile, mode | 73);
  }
}
/**
 * @description Generate frontend from files in UI folder
 * (app.ts files uses all ui files to create frontend)
 */
async function generateFrontendJs(): Promise<void> {
  const inputFile = path.resolve(INPUT_DIR, "ui/app.ts");
  const outputFile = path.resolve(OUTPUT_DIR, "public/app.js");

  const bundle = await rollup({
    input: inputFile,
    external: externals,
    plugins: [
      rollupJson({ preferConst: true }),
      typescript({ tsconfig: "./tsconfig.json" })
    ],
    inlineDynamicImports: true,
    treeshake: {
      propertyReadSideEffects: false,
      pureExternalModules: true
    },
    onwarn: ((warning, warn) => {
      // Ignore circular dependency warnings
      if (warning.code !== "CIRCULAR_DEPENDENCY") warn(warning);
    }) as WarningHandler
  });

  await bundle.write({
    preferConst: true,
    format: "esm",
    sourcemap: "inline",
    sourcemapExcludeSources: true,
    file: outputFile
  });

  const webpackConf = {
    mode: MODE,
    entry: outputFile,
    resolve: {
      aliasFields: ["module"]
    },
    devtool: "nosources-source-map",
    module: {
      rules: [
        {
          test: /\.js$/,
          use: ["source-map-loader"],
          enforce: "pre"
        }
      ]
    },
    output: {
      path: path.resolve(OUTPUT_DIR, "public"),
      filename: "app.js"
    }
  };

  const stats = await promisify(webpack)(webpackConf);
  process.stdout.write(stats.toString({ colors: true }) + "\n");
}
/**
 * @description Generate icons sprite (A single image containing all icons)
 */
async function generateIconsSprite(): Promise<void> {
  const svgo = new SVGO({ plugins: [{ removeViewBox: false }] });
  const symbols = [];
  const iconsDir = path.resolve(INPUT_DIR, "ui/icons");
  for (const file of fs.readdirSync(iconsDir)) {
    const id = path.parse(file).name;
    const filePath = path.join(iconsDir, file);
    const { data } = await svgo.optimize(fs.readFileSync(filePath).toString());
    symbols.push(generateSymbol(id, data));
  }
  fs.writeFileSync(
    path.resolve(OUTPUT_DIR, "public/icons.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join("")}</svg>`
  );
}
/**
 * @description Build everything by generating all components of platform
 */
init()
  .then(() => {
    Promise.all([
      copyStatic(),
      generateCss(),
      generateIconsSprite(),
      generateToolsJs(),
      generateBackendJs(),
      generateFrontendJs()
    ])
      .then(() => {})
      .catch(err => {
        process.stderr.write(err.stack + "\n");
      });
  })
  .catch(err => {
    process.stderr.write(err.stack + "\n");
  });
