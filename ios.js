const { join, dirname, basename } = require("path");
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require("fs");
const Xcode = require("@raydeck/xcode");
const Plist = require("plist");
const { ensureDir, toFullHexadecimal, resizeImage } = require("./common");
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
  return assetsPath;
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
  return Promise.all(
    scales.map(async (scale) => {
      const targetName =
        targetBase + (scale > 1 ? "@" + scale.toString() + "x" : "") + ".png";
      await resizeImage({
        source: sourcePath,
        target: join(targetPath, targetName),
        height: height * scale,
        width: width * scale,
      });
      return targetName;
    })
  );
};
const luminosities = ["light", "dark", null];
const constrasts = ["high", null];
const makeImageAsset = async ({
  root = process.cwd(),
  lightFile,
  lightContrastFile,
  darkFile,
  darkContrastFile,
  name,
  height,
  width = 100,
}) => {
  if (!height) height = width;
  //Structure into array of sources
  //Strucutre is {normal : { light, dark}, high: { light, dark} }
  const sourceFiles = {
    high: {
      light: lightContrastFile || lightFile,
      dark: darkContrastFile || darkFile || lightContrastFile || lightFile,
    },
    normal: {
      light: lightFile,
      dark: darkFile || lightFile,
    },
  };
  idioms = ["universal"];
  const targetPath = join(getAssetsPath(root), name + ".imageset");
  ensureDir(targetPath);
  const scaleFiles = { high: {}, normal: {} };
  scaleFiles.high.light = await scaleImage({
    sourcePath: sourceFiles.high.light,
    targetPath,
    targetBase: [name, "high", "light"].join("_"),
    height,
    width,
  });
  scaleFiles.high.dark = await scaleImage({
    sourcePath: sourceFiles.high.dark,
    targetPath,
    targetBase: [name, "high", "dark"].join("_"),
    height,
    width,
  });
  scaleFiles.normal.light = await scaleImage({
    sourcePath: sourceFiles.normal.light,
    targetPath,
    targetBase: [name, "normal", "light"].join("_"),
    height,
    width,
  });
  scaleFiles.normal.dark = await scaleImage({
    sourcePath: sourceFiles.normal.dark,
    targetPath,
    targetBase: [name, "normal", "dark"].join("_"),
    height,
    width,
  });

  //Make scaled files from sources
  //Make scaled images
  const images = luminosities.flatMap((luminosity) =>
    constrasts.flatMap((contrast) =>
      idioms.flatMap((idiom) =>
        scales.map((scale, index) => {
          const appearances = (luminosity || contrast) && [
            ...(luminosity
              ? [{ appearance: "luminosity", value: luminosity }]
              : []),
            ...(contrast ? [{ appearance: "contrast", value: contrast }] : []),
          ];
          const fileName =
            scaleFiles[contrast || "normal"][luminosity || "light"][index];
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
    { images, info: { author: "xcode", version: 1 } },
    null,
    2
  );
  const contentsPath = join(targetPath, "Contents.json");
  writeFileSync(contentsPath, imageJson);
};
const makeColorAsset = async ({
  name,
  lightColor,
  darkColor,
  lightContrastColor,
  darkContrastColor,
  root = process.cwd(),
}) => {
  const colors = { high: {}, normal: {} };
  colors.high.light = lightContrastColor || lightColor;
  colors.normal.light = lightColor;
  colors.high.dark =
    darkContrastColor || darkColor || lightContrastColor || lightColor;
  colors.normal.dark = darkColor || lightColor;
  const o = constrasts.flatMap((contrast) =>
    luminosities.flatMap((luminosity) => {
      //get the matching color from colors
      const colorContrast = contrast || "normal";
      const colorLuminosity = luminosity || "light";
      const color = colors[colorContrast][colorLuminosity];
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
    { colors: o, info: { author: "xcode", version: 1 } },
    null,
    2
  );
  const colorSetPath = join(getAssetsPath(root), name + ".colorset");
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
    console.warn(e);
    throw new Error("invalid appJson");
  }
};
const getDir = (root = process.cwd()) => join(root, "ios");
const getProjectDir = (root = process.cwd()) =>
  join(getDir(), getProjectName(root));
const getPBXProj = (root = process.cwd()) =>
  join(getProjectDir(root) + ".xcodeproj", "project.pbxproj");
const addResource = (fileName, root = process.cwd()) =>
  addResourceToProject(fileName, getPBXProj(root));
const addResourceToProject = (fileName, path) => {
  console.log("project path is ", path);
  const project = Xcode.project(path);
  project.parseSync();
  const fp = project.getFirstProject();
  const dir = basename(dirname(fileName));
  const file = project.addResourceFile(join(dir, basename(fileName)), null, fp);
  if (!file) return;
  file.uuid = project.generateUuid();
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
const setPlistValue = (key, value, root = process.cwd()) =>
  setPlistValueToPlist(key, value, getPlistPath(root));
const readPlist = (root = process.cwd()) => {
  const path = getPlistPath(root);
  return readPlistFromPlist(path);
};
const readPlistFromPlist = (path) => {
  const xml = readFileSync(path, { encoding: "utf8" });
  return Plist.parse(xml);
};
const setPlistValueToPlist = (key, value, path) => {
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
  setPlistValue,
  addResource,
  getPBXProj,
  getProjectDir,
  makeColorAsset,
  makeImageAsset,
  getAssetsPath,
  getProjectDir,
  getProjectName,
};
