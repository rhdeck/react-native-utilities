const jimp = require("jimp");
const { join, dirname, basename, includes } = require("path");
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require("fs");

const ensureDir = (dir) => existsSync(dir) || mkdirSync(dir);
const toFullHexadecimal = (hex) => {
  const prefixed = hex[0] === "#" ? hex : `#${hex}`;
  const up = prefixed.toUpperCase();

  return up.length === 4
    ? "#" + up[1] + up[1] + up[2] + up[2] + up[3] + up[3]
    : up;
};
const resizeImage = async ({ source, target, width, height }) => {
  if (!height) height = width;
  if (!source || !width) throw "Bad arguments";
  if (!target) target = source;
  const image = await jimp.read(source);
  await image.cover(width, height);
  await image.writeAsync(target);
};
const getTemplate = (name) => {
  const path = join(__dirname, "..", "templates", name);
  return readFileSync(path, { encoding: "utf8" });
};
module.exports = { resizeImage, ensureDir, toFullHexadecimal };
