const jimp = require("jimp");
const { existsSync, mkdirSync, writeFileSync, readFileSync } = require("fs");
const ensureDir = (dir) => {
  if (!existsSync(dir)) mkdirSync(dir);
  return dir;
};
const toFullHexadecimal = (hex) => {
  const prefixed = hex[0] === "#" ? hex : `#${hex}`;
  const up = prefixed.toUpperCase();
  return up.length === 4
    ? "#" + up[1] + up[1] + up[2] + up[2] + up[3] + up[3]
    : up;
};
const resizeImage = async ({ source, target, width, height }) => {
  if (!height) height = width;
  if (!source || !width)
    throw "Bad arguments: " + JSON.stringify({ source, width });
  if (!target) target = source;
  const image = await jimp.read(source);
  await image.cover(width, height);
  await image.writeAsync(target);
};
const getAppJsonPath = (root = process.cwd()) => {
  const appJsonPath = join(root, "app.json");
  return appJsonPath;
};
const getApp = (root = process.cwd()) => {
  const appJsonPath = getAppJsonPath(root);
  const appJson = readFileSync(appJsonPath, "utf-8");
  return JSON.parse(appJson);
};
const getDisplayName = (root = process.cwd()) => {
  const { display } = getApp(root);
};
const setDisplayName = (newName, root = process.cwd()) => {
  const o = getApp(root);
  o.displayName = newName;
  writeFileSync(getAppJsonPath(), JSON.parse(o, null, 2));
};
const getProjectName = (root = process.cwd()) => {
  try {
    const { name } = getApp(root);
    if (!name) throw new Error("Invalid projectPath");
    return name;
  } catch (e) {
    console.warn(e);
    throw new Error("invalid appJson");
  }
};
const setProjectName = (newName, root = process.cwd()) => {
  const o = getApp(root);
  o.name = newName;
  writeFileSync(getAppJsonPath(), JSON.parse(o, null, 2));
};
module.exports = {
  resizeImage,
  ensureDir,
  toFullHexadecimal,
  getProjectName,
  getApp,
  getAppJsonPath,
  getDisplayName,
  setDisplayName,
  setProjectName,
};
