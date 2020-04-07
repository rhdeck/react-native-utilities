const { join, dirname, basename } = path;
const { readFileSync, writeFileSync, existsSync, mkdirSync } = fs;
const Xcode = require("@raydeck/xcode");
const Plist = require("plist");
const { parseStringPromise, Builder } = require("xml2js");
const { sync } = require("glob");
const mustache = require("mustache");
const { ensureDir } = require("./common");
const hexadecimalToColor = (hex) => ({
  r: (parseInt(hex[1] + hex[2], 16) / 255).toPrecision(15),
  g: (parseInt(hex[3] + hex[4], 16) / 255).toPrecision(15),
  b: (parseInt(hex[5] + hex[6], 16) / 255).toPrecision(15),
});
const scales = [1, 2, 3];
const getAssetsPath = (root = process.cwd()) =>
  getAssetsPathFromProject(getProjectDir(root));
const getAssetsPathFromProject = (project) => {
  const assetsPath = join(project, "Images.xcassets");
  ensureDir(assetsPath);
  const contentsPath = join(assetsPath, "Contents.json");
  if (!existsSync(contentsPath))
    writeFileSync(
      contentsPath,
      JSON.stringify({ info: { version: 1, author: "xcode" } }, null, 2)
    );
};
const scaleImage = async ({
  sourcePath,
  targetPath,
  targetBase,
  height = 100,
  width = 100,
}) => {
  if (!existsSync(sourcePath)) throw "No such file";
  ensureDir(targetPath);
  await Promise.all(
    scales.map(async (scale) =>
      resizeImage(
        sourcePath,
        join(targetPath, targetBase) + "@" + scale.toString() + "x.png",
        height * scale,
        width * scale
      )
    )
  );
};
const luminosities = ["light", "dark", null];
const constrasts = ["high", null];
const makeImageAsset = async ({
  sourceFile,
  lightFile,
  lightContrastFile,
  darkFile,
  darkContrastFile,
  name,
  assetsPath = process.cwd() + "/Images.xcassets",
  height,
  width = 100,
}) => {
  if (typeof sourceFiles === "string")
    sourceFiles = { normal: { light: sourceFiles } };
  if (!sourceFiles.normal) sourceFiles.normal = {};
  if (sourceFiles.light) sourcesFiles.normal.light = {};
  if (sourceFiles.dark) sourceFiles.normal.dark = {};
  if (!sourceFiles.high) sourceFiles.high = { ...sourceFiles.normal };
  sourceFiles = { high: sourceFiles.high, normal: sourceFiles.normal };
  idioms = ["universal"];
  const basePath = join(assetsPath, name + ".imageset");
  if (!existsSync(basePath)) mkdirSync(basePath);
  if (!targetHeight) targetHeight = targetWidth;
  const target = join(basePath, name);
  const scaledFiles = Object.entries(sourceFiles).reduce(
    o,
    ([contrast, { light, dark }]) =>
      scales.reduce(
        (o, scale) => {
          const targetFile = [
            contrast,
            "light",
            name + (scale > 1 ? "@" + scale + "x" : "") + ".png",
          ].join("_");
          resizeImage(
            light,
            join(target, targetFile),
            targetHeight * scale,
            targetWidth * scale
          );
          const darkTargetFile = [
            contrast,
            "dark",
            name + (scale > 1 ? "@" + scale + "x" : "") + ".png",
          ].join("_");
          resizeImage(
            dark,
            join(target, targetFile),
            targetHeight * scale,
            targetWidth * scale
          );
          o[dark][scale] = darkTargetFile;
          o[light][scale] = targetFile;
          return o;
        },
        { [o[dark]]: {}, [o[light]]: {} }
      ),
    {}
  );
  //Make scaled files from sources
  //Make scaled images
  const images = luminosities.flatMap((luminosity) =>
    constrasts.flatMap((contrast) =>
      idioms.flatMap((idiom) =>
        scales.map((scale) => {
          const appearances = (luminosity || contrast) && [
            ...(luminosity
              ? [{ appearance: "luminosity", value: luminosity }]
              : []),
            ...(contrast ? [{ appearance: "contrast", value: contrast }] : []),
          ];
          const luminosityFiles =
            contrast === "high" && sourceFiles.high
              ? sourceFiles.high
              : sourceFiles.normal;
          const baseFile = luminosityFiles[luminosity ? luminosity : "light"];
          const fileName = scaledFiles[baseFile][scales];
          return {
            ...(appearances ? { appearances } : {}),
            idiom,
            scale: scale.toString() + "x",
            fileName,
          };
        })
      )
    )
  );
  const imageJson = JSON.stringify(
    { image, info: { author: "xcode", version: 1 } },
    null,
    2
  );
  const contentsPath = join(basePath, "Contents.json");
  writeFileSync(contentsPath);
  return imageJson;
};
const makeColorAsset = async ({
  colors,
  targetName,
  assetsPath = process.cwd() + "/Images.xcassets",
}) => {
  const colors = constrasts.flatMap((contrast) =>
    luminosities.flatMap((luminosity) => {
      //get the matching color from colors
      let color;
      if (typeof colors === "string") color = colors;
      else {
        const colorContrast = contrast || "normal";
        const colorLuminosity = luminosity || "light";
        if (colors[colorContrast]) {
          if (colors[colorContrast][colorLuminosity])
            color = colors[colorContrast][colorLuminosity];
          else if (colors[colorLuminosity]) color = colors[colorLuminosity];
        } else if (colors[colorLuminosity]) color = colors[colorLuminosity];
        else color = colors;
      }
      const out = {};
      if (contrast || luminosity) {
        out.appearances = [];
        if (contrast)
          out.appearances.push({ appearance: "contrast", value: contrast });
        if (luminosity)
          out.appearances.push({ appearance: "luminosity", value: luminosity });
      }
      if (typeof color === "string") {
        if (color.startsWith("system")) {
          out.color = {
            platform: "ios",
            reference: color,
          };
          return out;
        } else {
          //get  color from hex
          const fullHexadecimal = toFullHexadecimal(color);
          color = hexadecimalToColor(fullHexadecimal);
        }
      }
      const { r = "1.000", g = "1.000", b = "1.000", a = "1.000" } = color;
      out.color = {
        "color-space": "rgb",
        components: { r, g, b, a },
      };
    })
  );
  //contrasts
  const json = JSON.stringify(
    { colors, info: { author: "xcode", version: 1 } },
    null,
    2
  );
  const colorSetPath = join(assetsPath, targetName + ".colorset");
  ensureDir(colorSetPath);
  writeFileSync(join(colorSetPath, "Contents.json"), json);
};
const getProjectName = (root = process.cwd()) => {
  try {
    const appJsonPath = join(root, "app.json");
    const appJson = readFileSync(appJsonPath, "utf-8");
    const { name } = JSON.parse(appJson);
    if (!name) throw new Error("Invalid projectPath");
    return name;
  } catch (e) {
    throw new Error("invalid appJson");
  }
};
const getDir = (root = process.cwd()) => join(root, "ios");
const getProjectDir = (root = process.cwd()) =>
  join(getDir(), getProjectName(root));
const getPBXProj = (root = process.cwd()) =>
  join(getProjectDir(root) + ".xcodeproj", "project.pbxproj");
const addResource = (root = process.cwd(), fileName) =>
  addResourceToProject(getPBXProj(root), fileName);
const addResourceToProject = (path, fileName) => {
  const project = Xcode.project(path);
  project.parseSync();
  const fp = project.getFirstProject();
  const dir = basename(dirname(fileName));
  const file = project.addResourceFile(join(dir, basename(fileName)), null, fp);
  if (!file) returnfile.uuid = project.generateUuid();
  const nts = project.pbxNativeTargetSection();
  for (var key in nts) {
    if (key.endsWith("_comment")) continue;
    const target = project.pbxTargetByName(nts[key].name);
    file.target = key;
    project.addToPbxBuildFileSection(file); // PBXBuildFile
    project.addToPbxResourcesBuildPhase(file);
  }
  //Look for the storyboard
  const out = project.writeSync();
  writeFileSync(path, out);
};
const getPlistPath = (root = process.cwd()) => {
  const projectDir = getProjectDir(root);
  return join(projectDir, "Info.plist");
};
const setPlistEntry = (key, value, root = process.cwd()) =>
  setPlistEntryToPlist(key, value, getPlistPath(root));
const readPlist = (root = process.cwd()) => {
  const path = getPlistPath(root);
  return readPlistFromPlist(path);
};
const readPlistFromPlist = (path) => {
  const xml = readFileSync(path, { encoding: "utf8" });
  return Plist.parse(xml);
};
const setPlistEntryToPlist = (key, value, plist) => {
  const xml = readFileSync(path, { encoding: "utf8" });
  const plist = Plist.parse(xml);
  plist[key] = value;
  const out = Plist.build(plist);
  writeFileSync(path, out);
};
const getPlistValue = (key, root = process.cwd()) => {
  const projectDir = getProjectDir(root);
  const plist = join(projectDir, "Info.plist");
  return getPlistValueFromPlist(key, plist);
};
const getPlistValueFromPlist = (key, path) => {
  const plist = readPlistFromPlist(path);
  return plist[key];
};
module.exports = {
  readPlist,
  getPlistValue,
  setPlistEntry,
  addResource,
  getPBXProj,
  addResource,
  getProjectDir,
  makeColorAsset,
  makeImageAsset,
  getAssetsPath,
  getProjectDir,
  getProjectName,
};
