const jimp = require("jimp");
const { existsSync, mkdirSync } = require("fs");
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
  if (!source || !width)
    throw "Bad arguments: " + JSON.stringify({ source, width });
  if (!target) target = source;
  const image = await jimp.read(source);
  await image.cover(width, height);
  await image.writeAsync(target);
};
module.exports = { resizeImage, ensureDir, toFullHexadecimal };
