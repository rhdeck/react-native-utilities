const { join } = require("path");
const { readFileSync, writeFileSync, existsSync } = require("fs");
const { parseStringPromise, Builder } = require("xml2js");
const { resizeImage, ensureDir, toFullHexadecimal } = require("./common");
const getAndroidPath = (root = process.cwd()) => join(root, "android");
const getGradlePropertiesPath = (root = process.cwd()) =>
  join(getAndroidPath(root), "gradle.properties");
const getGradleProperties = (root = process.cwd()) => {
  const text = readFileSync(getGradlePropertiesPath(root), {
    encoding: "utf8",
  });
  const o = text.split("\n").reduce((o, line) => {
    const [key, value] = line.split("=", 2);
    return { ...o, [key]: value };
  }, {});
  return o;
};
const setGradleProperty = (key, value, root = process.cwd()) => {
  const o = getGradleProperties(root);
  o[key] = value;
  writeGradleProperties(o);
  return true;
};
const removeGradleProperty = (key, root = process.cwd()) => {
  const o = getGradleProperties(root);
  delete o[key];
  writeGradleProperties(o);
  return true;
};
const writeGradleProperties = (o, root = process.cwd()) => {
  writeFileSync(
    getGradlePropertiesPath(root),
    Object.entries(o)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")
  );
};
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
  if (typeof set === "undefined") throw "value is required";
  if (typeof type === "undefined") throw "type is required";
  if (typeof key === "undefined") throw "key is required";
  if (typeof value === "undefined") throw "value is required";
  console.log("starting setvalue", set, type, key, value);
  if (typeof isNight === "string") {
    root = isNight;
    isNight = false;
  }
  console.log("iam about to do that join");
  const path = join(getValuesPath(root, isNight), `${set}.xml`);
  console.log("This is my path", path);
  if (!existsSync(path)) throw "There is no file at path " + path;

  //read the xml
  const xml = readFileSync(path, { encoding: "utf8" });
  const o = await parseStringPromise(xml);
  o.resources[type] = (o.resources[type] || []).filter(
    ({ $: { name } }) => name !== key
  );
  o.resources[type].push({ $: { name: key }, _: value });
  console.log(JSON.stringify(o, null, 2));
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
  if (typeof set === "undefined") throw "value is required";
  if (typeof type === "undefined") throw "type is required";
  if (typeof key === "undefined") throw "key is required";

  if (typeof isNight === "string") {
    path = isNight;
    isNight = false;
  }
  const path = join(getValuesPath(root, isNight), `${set}.xml`);
  if (!existsSync(path)) throw "There is no file at path " + path;
  //read the xml
  const xml = readFileSync(path, { encoding: "utf8" });
  const o = await parseStringPromise(xml);
  o.resources[type] = (o.resources[type] || []).filter(
    ({ $: { name } }) => name !== key
  );
  const out = await new Builder().buildObject(o);
  writeFileSync(path, out);
  return true;
};
const listValues = async (set, type, isNight = false, root = process.cwd()) => {
  if (typeof set === "undefined") throw "value is required";
  if (typeof type === "undefined") throw "type is required";

  if (typeof isNight === "string") {
    path = isNight;
    isNight = false;
  }
  const path = join(getValuesPath(root, isNight), `${set}.xml`);
  if (!existsSync(path)) throw "There is no file at path " + path;
  //read the xml
  const xml = readFileSync(path, { encoding: "utf8" });
  const o = await parseStringPromise(xml);
  return (o.resources[type] = (
    o.resources[type] || []
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
  getGradleProperties,
  setGradleProperty,
  removeGradleProperty,
};
