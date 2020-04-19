const { join } = require("path");
const { readFileSync, writeFileSync, existsSync } = require("fs");
const { parseStringPromise, Builder } = require("xml2js");
const { resizeImage, ensureDir, toFullHexadecimal } = require("./common");
const getAppPath = (root = process.cwd()) => join(root, "android", "app");
const getMainPath = (root = process.cwd()) =>
  join(getAppPath(root), "src", "main");
const getManifestPath = (root = process.cwd()) =>
  join(getMainPath(root), "AndroidManifest.xml");

const addPermission = async (permissionName, path = process.cwd()) => {
  const manifestPath = getManifestPath(path);
  const src = readFileSync(manifestPath, { encoding: "utf8" });
  const o = await parseStringPromise(src);
  const manifest = o["manifest"];
  if (!manifest["uses-permission"]) manifest["uses-permission"] = [];
  const permissions = manifest["uses-permission"];
  if (
    !permissions.some(
      ({ $: { ["android:name"]: name } }) => name === permissionName
    )
  ) {
    permissions.push({ $: { ["android:name"]: permissionName } });
  }
  const out = new Builder().buildObject(o);
  writeFileSync(manifestPath, out);
  return true;
};
const removePermission = async (permissionName, path = process.cwd()) => {
  const manifestPath = getManifestPath(path);
  const src = readFileSync(manifestPath, { encoding: "utf8" });
  const o = await parseStringPromise(src);
  const manifest = o["manifest"];
  if (!manifest["uses-permission"]) return;
  manifest["uses-permission"] = manifest["uses-permission"].filter(
    ({ $: { ["android:name"]: name } }) => name === permissionName
  );
  const out = new Builder().buildObject(o);
  writeFileSync(manifestPath, out);
  return true;
};
const listPermissions = async (path = process.cwd()) => {
  const manifestPath = getManifestPath(path);
  const src = readFileSync(manifestPath, { encoding: "utf8" });
  const o = await parseStringPromise(src);
  const manifest = o["manifest"];
  if (!manifest["uses-permission"]) return [];
  return manifest["uses-permission"].map(
    ({ $: { ["android:name"]: name } }) => name
  );
};
const setFeature = async (
  feature,
  options = { "android:required": "false" },
  path = process.cwd()
) => {
  const manifestPath = getManifestPath(path);
  const src = readFileSync(manifestPath, { encoding: "utf8" });
  const o = await parseStringPromise(src);
  const manifest = o["manifest"];
  if (!manifest["uses-feature"]) manifest["uses-feature"] = [];
  manifest["uses-feature"] = manifest["uses-feature"].filter(
    ({ $: { ["android:name"]: an } = {} }) => feature !== an
  );
  manifest["uses-feature"].push({
    $: {
      ["android:name"]: feature,
      ...options,
    },
  });
  const out = new Builder().buildObject(o);
  writeFileSync(manifestPath, out);
  return true;
};
const removeFeature = async (feature, path = process.cwd()) => {
  const manifestPath = getManifestPath(path);
  const src = readFileSync(manifestPath, { encoding: "utf8" });
  const o = await parseStringPromise(src);
  const manifest = o["manifest"];
  if (!manifest["uses-feature"]) return;
  manifest["uses-feature"] = manifest["uses-feature"].filter(
    ({ $: { ["android:name"]: an } }) => feature !== an
  );
  const out = new Builder().buildObject(o);
  writeFileSync(manifestPath, out);
  return true;
};
const listFeatures = async (path = process.cwd()) => {
  const manifestPath = getManifestPath(path);
  const src = readFileSync(manifestPath, { encoding: "utf8" });
  const o = await parseStringPromise(src);
  const manifest = o["manifest"];
  if (!manifest["uses-feature"]) return [];
  return manifest["uses-feature"].map(
    ({ $: { ["android:name"]: name, ...options } }) => ({
      name,
      options,
    })
  );
};
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

const setValue = async (
  set,
  type,
  key,
  value,
  isNight = false,
  root = process.cwd()
) => {
  if (typeof isNight === "string") {
    root = isNight;
    isNight = false;
  }
  const path = join(getValuesPath(root, isNight), `${type}.xml`);
  if (!existsSync(path)) throw "There is no file at path " + filePath;
  //read the xml
  const xml = readFileSync(path, { encoding: "utf8" });
  const o = await parseStringPromise(xml);
  o.resources[set] = (o.resources[set] || []).filter(
    ({ $: { name } }) => name !== key
  );
  o.resources[set].push({ $: { name: key }, _: value });
  const out = await new Builder().buildObject(o);
  writeFileSync(path, out);
  return true;
};
const removeValue = async (
  set,
  type,
  key,
  isNight = false,
  root = process.cwd()
) => {
  if (typeof isNight === "string") {
    path = isNight;
    isNight = false;
  }
  const path = join(getValuesPath(root, isNight), `${type}.xml`);
  if (!existsSync(path)) throw "There is no file at path " + filePath;
  //read the xml
  const xml = readFileSync(path, { encoding: "utf8" });
  const o = await parseStringPromise(xml);
  o.resources[set] = (o.resources[set] || []).filter(
    ({ $: { name } }) => name !== key
  );
  const out = await new Builder().buildObject(o);
  writeFileSync(path, out);
  return true;
};
const listValues = async (set, type, isNight = false, root = process.cwd()) => {
  if (typeof isNight === "string") {
    path = isNight;
    isNight = false;
  }
  const path = join(getValuesPath(root, isNight), `${type}.xml`);
  if (!existsSync(path)) throw "There is no file at path " + filePath;
  //read the xml
  const xml = readFileSync(path, { encoding: "utf8" });
  const o = await parseStringPromise(xml);
  return (o.resources[set] = (
    o.resources[set] || []
  ).map(({ $: { name: key }, _: value }) => ({ key, value })));
};

const setString = async (key, value, root = process.cwd()) =>
  setValue("strings", "string", key, value, root);
const setColor = async (key, value, isNight = false, root = process.cwd()) =>
  setValue("colors", "color", key, value, isNight, root);
const removeString = async (key, root = process.cwd()) =>
  removeValue("strings", "string", key, root);
const removeColor = async (key, isNight = false, root = process.cwd()) =>
  removeValue("colors", "color", key, isNight, root);
const listStrings = async (key, root = process.cwd()) =>
  listValues("strings", "string", key, root);
const listColors = async (isNight = false, root = process.cwd()) =>
  listValues("colors", "color", isNight, root);
module.exports = {
  makeImageAsset,
  makeColorAsset,
  getDrawablePath,
  getValuesPath,
  getAppPath,
  getMainPath,
  getResPath,
  getManifestPath,
  addPermission,
  removePermission,
  listPermissions,
  setFeature,
  removeFeature,
  listFeatures,
  setValue,
  setString,
  setColor,
  removeValue,
  listValues,
  removeString,
  removeColor,
  listColors,
  listStrings,
};
