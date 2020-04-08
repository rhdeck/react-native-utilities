const { join } = require("path");
const { readFileSync, writeFileSync, existsSync } = require("fs");
const { parseStringPromise, Builder } = require("xml2js");
const { resizeImage, ensureDir, toFullHexadecimal } = require("./common");
const getAppPath = (root = process.cwd()) => join(root, "android", "app");
const getMainPath = (root = process.cwd()) =>
  join(getAppPath(root), "src", "main");
const getManifestPath = (root = process.cwd()) =>
  join(getMainPath(root), "AndroidManifest.xml");
const getResPath = (root = process.cwd()) => join(getMainPath(root), "res");
const sizes = {
  xxxhdpi: 4,
  xxhdpi: 3,
  xhdpi: 2,
  hdpi: 1.5,
  mdpi: 1,
};
const pathWithScale = (path, isNight = false, scale) => {
  const p = [path, isNight && "night", scale && scale.length && scale]
    .filter(Boolean)
    .join("-");
  return p;
};
const makeImageAsset = async ({
  sourcePath,
  root,
  targetBase,
  height = 100,
  width = 100,
  isNight = false,
}) => {
  await Promise.all(
    Object.entries(sizes).map(async ([label, scale]) => {
      const targetDir = ensureDir(getDrawablePath(root, label, isNight));
      return resizeImage({
        source: sourcePath,
        target: join(targetDir, targetBase),
        width: width * scale,
        height: height * scale,
      });
    })
  );
};
const makeColorAsset = async ({ root, isNight = false, name, colorString }) => {
  const colorsPath = join(
    ensureDir(getValuesPath(root, isNight)),
    "colors.xml"
  );
  const hex = toFullHexadecimal(colorString);
  const o = await (existsSync(colorsPath)
    ? parseStringPromise(readFileSync(colorsPath, { encoding: "utf8" }))
    : { resources: { color: [] } });
  //look for color with my name
  if (!o.resources) o.resources = { color: [] };
  if (!o.resources.color) o.resources.color = [];
  const c = o.resources.color.find(
    ({ $: { name: myName } }) => name === myName
  );
  if (c) c._ = hex;
  else o.resources.color.push({ $: { name }, _: hex });
  const builder = new Builder();
  writeFileSync(colorsPath, builder.buildObject(o));
  return true;
};
const getDrawablePath = (root = process.cwd(), scale, isNight = false) =>
  ensureDir(join(getResPath(root), pathWithScale("drawable", isNight, scale)));
const getValuesPath = (root = process.cwd(), isNight = false) =>
  ensureDir(join(getResPath(root), pathWithScale("values", isNight)));

module.exports = {
  makeImageAsset,
  makeColorAsset,
  getDrawablePath,
  getValuesPath,
  getAppPath,
  getMainPath,
  getResPath,
  getManifestPath,
};
