const { join } = require("path");
const jimp = require("jimp");
const { join, dirname, basename, includes } = path;
const { readFileSync, writeFileSync, existsSync, mkdirSync } = fs;
const { parseStringPromise, Builder } = require("xml2js");
const { sync } = require("glob");
const mustache = require("mustache");
const getAppPath = (root = process.cwd()) => join(root, "android", "app");
const getMainPath = (root = process.cwd()) =>
  join(getAppPath(root), "src", "main");
const getResPath = (root = process.cwd()) => {
  join(getMainPath(root), "res");
};
const sizes = {
  xxxhdpi: 4,
  xxhdpi: 3,
  xhdpi: 2,
  hdpi: 1.5,
  mdpi: 1,
};
const pathWithScale = (path, isNight = false, scale = "mdpi") =>
  path + isNight ? "-night" : "" + scale ? "-" + scale : "";
const scaleImage = async ({
  sourcePath,
  targetPath,
  targetBase,
  height = 100,
  width = 100,
}) => {
  await Promise.all(
    Object.entries(sizes).map(async ([label, scale]) => {
      const targetDir = join(targetPath, "drawable-" + label);
      ensureDir(targetDir);
      return resizeImage({
        source: sourcePath,
        target: join(targetDir, targetBase),
        width: width * scale,
        height: height * scale,
      });
    })
  );
};
const makeColorAsset = ({ root, isNight = false, name, colorString }) => {};
const makeImageAsset = ({ root, isNight = false, name, height, width }) => {};
const getDrawablePath = (scale = "", isNight = false, root = process.cwd()) =>
  join(getResPath(root), pathWithScale("drawable", isNight, scale));
const getValuesPath = (root = process.cwd(), isNight = false) =>
  join(getResPath(root), pathWithScale("values", isNight));
