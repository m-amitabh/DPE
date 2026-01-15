"use strict";
var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _a, _b, _c, _t, _n, _r, _e, _c_instances, s_fn, i_fn, _streams, _ended, _aborted, _onFinished, _unpipeEvent, _streamPromises, _hupSig, _emitter, _process, _originalProcessEmit, _originalProcessReallyExit, _sigListeners, _loaded, _SignalExit_instances, processReallyExit_fn, processEmit_fn;
const electron = require("electron");
const node_url = require("node:url");
const path$e = require("node:path");
const log = require("electron-log");
const fs$9 = require("fs/promises");
const path$d = require("path");
const crypto = require("crypto");
const require$$0 = require("os");
const require$$0$1 = require("util");
const require$$0$2 = require("stream");
const require$$0$4 = require("events");
const require$$0$3 = require("fs");
const node_child_process = require("node:child_process");
const node_string_decoder = require("node:string_decoder");
const node_util = require("node:util");
const process$2 = require("node:process");
const tty = require("node:tty");
const require$$0$5 = require("child_process");
const promises = require("node:timers/promises");
const node_os = require("node:os");
const node_events = require("node:events");
const node_v8 = require("node:v8");
const node_fs = require("node:fs");
const node_stream = require("node:stream");
const node_buffer = require("node:buffer");
const promises$1 = require("node:stream/promises");
var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
function _interopNamespaceDefault(e) {
  const n2 = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n2, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n2.default = e;
  return Object.freeze(n2);
}
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs$9);
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path$d);
class JSONStore {
  constructor() {
    this.data = null;
    this.settingsCache = null;
    this.writeDebounceTimer = null;
    this.pendingWrites = /* @__PURE__ */ new Map();
    const userDataPath = electron.app.getPath("userData");
    this.filePath = path$d.join(userDataPath, "projects.json");
    this.backupPath = path$d.join(userDataPath, "projects.json.bak");
    this.tmpPath = path$d.join(userDataPath, "projects.json.tmp");
    this.settingsPath = path$d.join(userDataPath, "settings.json");
    log.info(`JSON Store initialized at: ${this.filePath}`);
  }
  /**
   * Load settings from disk (returns defaults if missing)
   */
  async getSettings() {
    if (this.settingsCache) return this.settingsCache;
    try {
      const content = await fs$9.readFile(this.settingsPath, "utf-8");
      this.settingsCache = JSON.parse(content);
      return this.settingsCache;
    } catch (error2) {
      if (error2.code === "ENOENT") {
        this.settingsCache = {
          scanPaths: [],
          ignoredPatterns: ["node_modules", ".git", "dist"],
          ideCommand: "code {path}",
          terminalCommand: ""
        };
        return this.settingsCache;
      }
      throw error2;
    }
  }
  /**
   * Persist settings to disk
   */
  async setSettings(settings2) {
    this.settingsCache = settings2;
    const content = JSON.stringify(settings2, null, 2);
    await fs$9.writeFile(this.settingsPath, content, "utf-8");
  }
  /**
   * Initialize and load data from disk
   */
  async initialize() {
    try {
      await this.load();
    } catch (error2) {
      log.error("Failed to initialize JSON store:", error2);
      throw error2;
    }
  }
  /**
   * Load projects from disk with backup recovery
   */
  async load() {
    try {
      const fileContent = await fs$9.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(fileContent);
      this.data = this.migrate(parsed);
      log.info(`Loaded ${this.data.projects.length} projects`);
    } catch (error2) {
      if (error2.code === "ENOENT") {
        log.info("No projects.json found, creating new");
        this.data = this.createEmpty();
        await this.flush();
      } else {
        log.warn("Main file corrupt, attempting backup recovery");
        await this.loadBackup();
      }
    }
  }
  /**
   * Load from backup file
   */
  async loadBackup() {
    try {
      const backupContent = await fs$9.readFile(this.backupPath, "utf-8");
      const parsed = JSON.parse(backupContent);
      this.data = this.migrate(parsed);
      log.info("Recovered from backup successfully");
      await this.flush();
    } catch (error2) {
      log.error("Both main and backup files failed, starting fresh");
      this.data = this.createEmpty();
      await this.flush();
    }
  }
  /**
   * Create empty data structure
   */
  createEmpty() {
    return {
      meta: {
        version: 1,
        lastScanAt: (/* @__PURE__ */ new Date()).toISOString(),
        projectCount: 0
      },
      projects: []
    };
  }
  /**
   * Migrate data to current schema version
   */
  migrate(data) {
    var _a2, _b2, _c2;
    const version = ((_a2 = data.meta) == null ? void 0 : _a2.version) || 0;
    if (version < 1) {
      data.projects = (data.projects || []).map((p) => ({
        ...p,
        scanStatus: p.scanStatus || "complete"
      }));
      data.meta = { ...data.meta || {}, version: 1 };
    }
    data.meta = {
      version: 1,
      lastScanAt: ((_b2 = data.meta) == null ? void 0 : _b2.lastScanAt) || (/* @__PURE__ */ new Date()).toISOString(),
      projectCount: ((_c2 = data.projects) == null ? void 0 : _c2.length) || 0,
      ...data.meta
    };
    return data;
  }
  /**
   * Get all projects
   */
  async getAllProjects() {
    var _a2;
    if (!this.data) {
      await this.load();
    }
    return [...((_a2 = this.data) == null ? void 0 : _a2.projects) || []];
  }
  /**
   * Get project by ID
   */
  async getProject(id) {
    var _a2;
    if (!this.data) {
      await this.load();
    }
    return ((_a2 = this.data) == null ? void 0 : _a2.projects.find((p) => p.id === id)) || null;
  }
  /**
   * Add or update project
   */
  async upsertProject(project) {
    if (!this.data) {
      await this.load();
    }
    const index = this.data.projects.findIndex((p) => p.id === project.id);
    if (index >= 0) {
      this.data.projects[index] = project;
    } else {
      this.data.projects.push(project);
    }
    this.data.meta.projectCount = this.data.projects.length;
    this.data.meta.lastScanAt = (/* @__PURE__ */ new Date()).toISOString();
    await this.debouncedWrite();
  }
  /**
   * Update project metadata (partial update)
   */
  async updateProject(id, updates) {
    if (!this.data) {
      await this.load();
    }
    const project = this.data.projects.find((p) => p.id === id);
    if (!project) {
      return null;
    }
    Object.assign(project, updates);
    project.scanStatus = "user-modified";
    await this.debouncedWrite();
    return project;
  }
  /**
   * Delete project
   */
  async deleteProject(id) {
    if (!this.data) {
      await this.load();
    }
    const initialLength = this.data.projects.length;
    this.data.projects = this.data.projects.filter((p) => p.id !== id);
    if (this.data.projects.length < initialLength) {
      this.data.meta.projectCount = this.data.projects.length;
      await this.debouncedWrite();
      return true;
    }
    return false;
  }
  /**
   * Clear all stored projects (resets to empty) and flush to disk
   */
  async clear() {
    this.data = this.createEmpty();
    await this.flush();
  }
  /**
   * Debounced write - batches writes within 500ms
   */
  async debouncedWrite() {
    if (this.writeDebounceTimer) {
      clearTimeout(this.writeDebounceTimer);
    }
    this.writeDebounceTimer = setTimeout(() => {
      this.flush().catch((error2) => {
        log.error("Failed to flush data:", error2);
      });
    }, 500);
  }
  /**
   * Force immediate write to disk with atomic rename
   */
  async flush() {
    if (!this.data) {
      return;
    }
    try {
      const content = JSON.stringify(this.data, null, 2);
      await fs$9.writeFile(this.tmpPath, content, "utf-8");
      try {
        await fs$9.copyFile(this.filePath, this.backupPath);
      } catch (error2) {
        if (error2.code !== "ENOENT") {
          log.warn("Failed to create backup:", error2);
        }
      }
      await fs$9.rename(this.tmpPath, this.filePath);
      log.info("Data flushed to disk successfully");
    } catch (error2) {
      log.error("Failed to flush data to disk:", error2);
      throw error2;
    }
  }
  /**
   * Get data snapshot (for export)
   */
  async export() {
    if (!this.data) {
      await this.load();
    }
    return JSON.parse(JSON.stringify(this.data));
  }
  /**
   * Import data (replaces existing)
   */
  async import(data) {
    this.data = this.migrate(data);
    await this.flush();
    log.info("Data imported successfully");
  }
}
let storeInstance = null;
function getStore() {
  if (!storeInstance) {
    storeInstance = new JSONStore();
  }
  return storeInstance;
}
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var tasks = {};
var utils$k = {};
var array$1 = {};
Object.defineProperty(array$1, "__esModule", { value: true });
array$1.splitWhen = array$1.flatten = void 0;
function flatten(items) {
  return items.reduce((collection, item) => [].concat(collection, item), []);
}
array$1.flatten = flatten;
function splitWhen(items, predicate) {
  const result = [[]];
  let groupIndex = 0;
  for (const item of items) {
    if (predicate(item)) {
      groupIndex++;
      result[groupIndex] = [];
    } else {
      result[groupIndex].push(item);
    }
  }
  return result;
}
array$1.splitWhen = splitWhen;
var errno$1 = {};
Object.defineProperty(errno$1, "__esModule", { value: true });
errno$1.isEnoentCodeError = void 0;
function isEnoentCodeError(error2) {
  return error2.code === "ENOENT";
}
errno$1.isEnoentCodeError = isEnoentCodeError;
var fs$8 = {};
Object.defineProperty(fs$8, "__esModule", { value: true });
fs$8.createDirentFromStats = void 0;
let DirentFromStats$1 = class DirentFromStats {
  constructor(name, stats) {
    this.name = name;
    this.isBlockDevice = stats.isBlockDevice.bind(stats);
    this.isCharacterDevice = stats.isCharacterDevice.bind(stats);
    this.isDirectory = stats.isDirectory.bind(stats);
    this.isFIFO = stats.isFIFO.bind(stats);
    this.isFile = stats.isFile.bind(stats);
    this.isSocket = stats.isSocket.bind(stats);
    this.isSymbolicLink = stats.isSymbolicLink.bind(stats);
  }
};
function createDirentFromStats$1(name, stats) {
  return new DirentFromStats$1(name, stats);
}
fs$8.createDirentFromStats = createDirentFromStats$1;
var path$c = {};
Object.defineProperty(path$c, "__esModule", { value: true });
path$c.convertPosixPathToPattern = path$c.convertWindowsPathToPattern = path$c.convertPathToPattern = path$c.escapePosixPath = path$c.escapeWindowsPath = path$c.escape = path$c.removeLeadingDotSegment = path$c.makeAbsolute = path$c.unixify = void 0;
const os = require$$0;
const path$b = path$d;
const IS_WINDOWS_PLATFORM = os.platform() === "win32";
const LEADING_DOT_SEGMENT_CHARACTERS_COUNT = 2;
const POSIX_UNESCAPED_GLOB_SYMBOLS_RE = /(\\?)([()*?[\]{|}]|^!|[!+@](?=\()|\\(?![!()*+?@[\]{|}]))/g;
const WINDOWS_UNESCAPED_GLOB_SYMBOLS_RE = /(\\?)([()[\]{}]|^!|[!+@](?=\())/g;
const DOS_DEVICE_PATH_RE = /^\\\\([.?])/;
const WINDOWS_BACKSLASHES_RE = /\\(?![!()+@[\]{}])/g;
function unixify(filepath) {
  return filepath.replace(/\\/g, "/");
}
path$c.unixify = unixify;
function makeAbsolute(cwd, filepath) {
  return path$b.resolve(cwd, filepath);
}
path$c.makeAbsolute = makeAbsolute;
function removeLeadingDotSegment(entry2) {
  if (entry2.charAt(0) === ".") {
    const secondCharactery = entry2.charAt(1);
    if (secondCharactery === "/" || secondCharactery === "\\") {
      return entry2.slice(LEADING_DOT_SEGMENT_CHARACTERS_COUNT);
    }
  }
  return entry2;
}
path$c.removeLeadingDotSegment = removeLeadingDotSegment;
path$c.escape = IS_WINDOWS_PLATFORM ? escapeWindowsPath : escapePosixPath;
function escapeWindowsPath(pattern2) {
  return pattern2.replace(WINDOWS_UNESCAPED_GLOB_SYMBOLS_RE, "\\$2");
}
path$c.escapeWindowsPath = escapeWindowsPath;
function escapePosixPath(pattern2) {
  return pattern2.replace(POSIX_UNESCAPED_GLOB_SYMBOLS_RE, "\\$2");
}
path$c.escapePosixPath = escapePosixPath;
path$c.convertPathToPattern = IS_WINDOWS_PLATFORM ? convertWindowsPathToPattern : convertPosixPathToPattern;
function convertWindowsPathToPattern(filepath) {
  return escapeWindowsPath(filepath).replace(DOS_DEVICE_PATH_RE, "//$1").replace(WINDOWS_BACKSLASHES_RE, "/");
}
path$c.convertWindowsPathToPattern = convertWindowsPathToPattern;
function convertPosixPathToPattern(filepath) {
  return escapePosixPath(filepath);
}
path$c.convertPosixPathToPattern = convertPosixPathToPattern;
var pattern$1 = {};
/*!
 * is-extglob <https://github.com/jonschlinkert/is-extglob>
 *
 * Copyright (c) 2014-2016, Jon Schlinkert.
 * Licensed under the MIT License.
 */
var isExtglob$1 = function isExtglob(str) {
  if (typeof str !== "string" || str === "") {
    return false;
  }
  var match;
  while (match = /(\\).|([@?!+*]\(.*\))/g.exec(str)) {
    if (match[2]) return true;
    str = str.slice(match.index + match[0].length);
  }
  return false;
};
/*!
 * is-glob <https://github.com/jonschlinkert/is-glob>
 *
 * Copyright (c) 2014-2017, Jon Schlinkert.
 * Released under the MIT License.
 */
var isExtglob2 = isExtglob$1;
var chars = { "{": "}", "(": ")", "[": "]" };
var strictCheck = function(str) {
  if (str[0] === "!") {
    return true;
  }
  var index = 0;
  var pipeIndex = -2;
  var closeSquareIndex = -2;
  var closeCurlyIndex = -2;
  var closeParenIndex = -2;
  var backSlashIndex = -2;
  while (index < str.length) {
    if (str[index] === "*") {
      return true;
    }
    if (str[index + 1] === "?" && /[\].+)]/.test(str[index])) {
      return true;
    }
    if (closeSquareIndex !== -1 && str[index] === "[" && str[index + 1] !== "]") {
      if (closeSquareIndex < index) {
        closeSquareIndex = str.indexOf("]", index);
      }
      if (closeSquareIndex > index) {
        if (backSlashIndex === -1 || backSlashIndex > closeSquareIndex) {
          return true;
        }
        backSlashIndex = str.indexOf("\\", index);
        if (backSlashIndex === -1 || backSlashIndex > closeSquareIndex) {
          return true;
        }
      }
    }
    if (closeCurlyIndex !== -1 && str[index] === "{" && str[index + 1] !== "}") {
      closeCurlyIndex = str.indexOf("}", index);
      if (closeCurlyIndex > index) {
        backSlashIndex = str.indexOf("\\", index);
        if (backSlashIndex === -1 || backSlashIndex > closeCurlyIndex) {
          return true;
        }
      }
    }
    if (closeParenIndex !== -1 && str[index] === "(" && str[index + 1] === "?" && /[:!=]/.test(str[index + 2]) && str[index + 3] !== ")") {
      closeParenIndex = str.indexOf(")", index);
      if (closeParenIndex > index) {
        backSlashIndex = str.indexOf("\\", index);
        if (backSlashIndex === -1 || backSlashIndex > closeParenIndex) {
          return true;
        }
      }
    }
    if (pipeIndex !== -1 && str[index] === "(" && str[index + 1] !== "|") {
      if (pipeIndex < index) {
        pipeIndex = str.indexOf("|", index);
      }
      if (pipeIndex !== -1 && str[pipeIndex + 1] !== ")") {
        closeParenIndex = str.indexOf(")", pipeIndex);
        if (closeParenIndex > pipeIndex) {
          backSlashIndex = str.indexOf("\\", pipeIndex);
          if (backSlashIndex === -1 || backSlashIndex > closeParenIndex) {
            return true;
          }
        }
      }
    }
    if (str[index] === "\\") {
      var open = str[index + 1];
      index += 2;
      var close = chars[open];
      if (close) {
        var n2 = str.indexOf(close, index);
        if (n2 !== -1) {
          index = n2 + 1;
        }
      }
      if (str[index] === "!") {
        return true;
      }
    } else {
      index++;
    }
  }
  return false;
};
var relaxedCheck = function(str) {
  if (str[0] === "!") {
    return true;
  }
  var index = 0;
  while (index < str.length) {
    if (/[*?{}()[\]]/.test(str[index])) {
      return true;
    }
    if (str[index] === "\\") {
      var open = str[index + 1];
      index += 2;
      var close = chars[open];
      if (close) {
        var n2 = str.indexOf(close, index);
        if (n2 !== -1) {
          index = n2 + 1;
        }
      }
      if (str[index] === "!") {
        return true;
      }
    } else {
      index++;
    }
  }
  return false;
};
var isGlob$1 = function isGlob(str, options) {
  if (typeof str !== "string" || str === "") {
    return false;
  }
  if (isExtglob2(str)) {
    return true;
  }
  var check = strictCheck;
  if (options && options.strict === false) {
    check = relaxedCheck;
  }
  return check(str);
};
var isGlob2 = isGlob$1;
var pathPosixDirname = path$d.posix.dirname;
var isWin32 = require$$0.platform() === "win32";
var slash = "/";
var backslash = /\\/g;
var enclosure = /[\{\[].*[\}\]]$/;
var globby = /(^|[^\\])([\{\[]|\([^\)]+$)/;
var escaped = /\\([\!\*\?\|\[\]\(\)\{\}])/g;
var globParent$1 = function globParent(str, opts) {
  var options = Object.assign({ flipBackslashes: true }, opts);
  if (options.flipBackslashes && isWin32 && str.indexOf(slash) < 0) {
    str = str.replace(backslash, slash);
  }
  if (enclosure.test(str)) {
    str += slash;
  }
  str += "a";
  do {
    str = pathPosixDirname(str);
  } while (isGlob2(str) || globby.test(str));
  return str.replace(escaped, "$1");
};
var utils$j = {};
(function(exports$1) {
  exports$1.isInteger = (num) => {
    if (typeof num === "number") {
      return Number.isInteger(num);
    }
    if (typeof num === "string" && num.trim() !== "") {
      return Number.isInteger(Number(num));
    }
    return false;
  };
  exports$1.find = (node, type) => node.nodes.find((node2) => node2.type === type);
  exports$1.exceedsLimit = (min, max, step = 1, limit) => {
    if (limit === false) return false;
    if (!exports$1.isInteger(min) || !exports$1.isInteger(max)) return false;
    return (Number(max) - Number(min)) / Number(step) >= limit;
  };
  exports$1.escapeNode = (block, n2 = 0, type) => {
    const node = block.nodes[n2];
    if (!node) return;
    if (type && node.type === type || node.type === "open" || node.type === "close") {
      if (node.escaped !== true) {
        node.value = "\\" + node.value;
        node.escaped = true;
      }
    }
  };
  exports$1.encloseBrace = (node) => {
    if (node.type !== "brace") return false;
    if (node.commas >> 0 + node.ranges >> 0 === 0) {
      node.invalid = true;
      return true;
    }
    return false;
  };
  exports$1.isInvalidBrace = (block) => {
    if (block.type !== "brace") return false;
    if (block.invalid === true || block.dollar) return true;
    if (block.commas >> 0 + block.ranges >> 0 === 0) {
      block.invalid = true;
      return true;
    }
    if (block.open !== true || block.close !== true) {
      block.invalid = true;
      return true;
    }
    return false;
  };
  exports$1.isOpenOrClose = (node) => {
    if (node.type === "open" || node.type === "close") {
      return true;
    }
    return node.open === true || node.close === true;
  };
  exports$1.reduce = (nodes) => nodes.reduce((acc, node) => {
    if (node.type === "text") acc.push(node.value);
    if (node.type === "range") node.type = "text";
    return acc;
  }, []);
  exports$1.flatten = (...args) => {
    const result = [];
    const flat = (arr) => {
      for (let i2 = 0; i2 < arr.length; i2++) {
        const ele = arr[i2];
        if (Array.isArray(ele)) {
          flat(ele);
          continue;
        }
        if (ele !== void 0) {
          result.push(ele);
        }
      }
      return result;
    };
    flat(args);
    return result;
  };
})(utils$j);
const utils$i = utils$j;
var stringify$4 = (ast, options = {}) => {
  const stringify2 = (node, parent = {}) => {
    const invalidBlock = options.escapeInvalid && utils$i.isInvalidBrace(parent);
    const invalidNode = node.invalid === true && options.escapeInvalid === true;
    let output = "";
    if (node.value) {
      if ((invalidBlock || invalidNode) && utils$i.isOpenOrClose(node)) {
        return "\\" + node.value;
      }
      return node.value;
    }
    if (node.value) {
      return node.value;
    }
    if (node.nodes) {
      for (const child of node.nodes) {
        output += stringify2(child);
      }
    }
    return output;
  };
  return stringify2(ast);
};
/*!
 * is-number <https://github.com/jonschlinkert/is-number>
 *
 * Copyright (c) 2014-present, Jon Schlinkert.
 * Released under the MIT License.
 */
var isNumber$3 = function(num) {
  if (typeof num === "number") {
    return num - num === 0;
  }
  if (typeof num === "string" && num.trim() !== "") {
    return Number.isFinite ? Number.isFinite(+num) : isFinite(+num);
  }
  return false;
};
/*!
 * to-regex-range <https://github.com/micromatch/to-regex-range>
 *
 * Copyright (c) 2015-present, Jon Schlinkert.
 * Released under the MIT License.
 */
const isNumber$2 = isNumber$3;
const toRegexRange$1 = (min, max, options) => {
  if (isNumber$2(min) === false) {
    throw new TypeError("toRegexRange: expected the first argument to be a number");
  }
  if (max === void 0 || min === max) {
    return String(min);
  }
  if (isNumber$2(max) === false) {
    throw new TypeError("toRegexRange: expected the second argument to be a number.");
  }
  let opts = { relaxZeros: true, ...options };
  if (typeof opts.strictZeros === "boolean") {
    opts.relaxZeros = opts.strictZeros === false;
  }
  let relax = String(opts.relaxZeros);
  let shorthand = String(opts.shorthand);
  let capture = String(opts.capture);
  let wrap = String(opts.wrap);
  let cacheKey = min + ":" + max + "=" + relax + shorthand + capture + wrap;
  if (toRegexRange$1.cache.hasOwnProperty(cacheKey)) {
    return toRegexRange$1.cache[cacheKey].result;
  }
  let a2 = Math.min(min, max);
  let b = Math.max(min, max);
  if (Math.abs(a2 - b) === 1) {
    let result = min + "|" + max;
    if (opts.capture) {
      return `(${result})`;
    }
    if (opts.wrap === false) {
      return result;
    }
    return `(?:${result})`;
  }
  let isPadded = hasPadding(min) || hasPadding(max);
  let state = { min, max, a: a2, b };
  let positives = [];
  let negatives = [];
  if (isPadded) {
    state.isPadded = isPadded;
    state.maxLen = String(state.max).length;
  }
  if (a2 < 0) {
    let newMin = b < 0 ? Math.abs(b) : 1;
    negatives = splitToPatterns(newMin, Math.abs(a2), state, opts);
    a2 = state.a = 0;
  }
  if (b >= 0) {
    positives = splitToPatterns(a2, b, state, opts);
  }
  state.negatives = negatives;
  state.positives = positives;
  state.result = collatePatterns(negatives, positives);
  if (opts.capture === true) {
    state.result = `(${state.result})`;
  } else if (opts.wrap !== false && positives.length + negatives.length > 1) {
    state.result = `(?:${state.result})`;
  }
  toRegexRange$1.cache[cacheKey] = state;
  return state.result;
};
function collatePatterns(neg, pos, options) {
  let onlyNegative = filterPatterns(neg, pos, "-", false) || [];
  let onlyPositive = filterPatterns(pos, neg, "", false) || [];
  let intersected = filterPatterns(neg, pos, "-?", true) || [];
  let subpatterns = onlyNegative.concat(intersected).concat(onlyPositive);
  return subpatterns.join("|");
}
function splitToRanges(min, max) {
  let nines = 1;
  let zeros2 = 1;
  let stop = countNines(min, nines);
  let stops = /* @__PURE__ */ new Set([max]);
  while (min <= stop && stop <= max) {
    stops.add(stop);
    nines += 1;
    stop = countNines(min, nines);
  }
  stop = countZeros(max + 1, zeros2) - 1;
  while (min < stop && stop <= max) {
    stops.add(stop);
    zeros2 += 1;
    stop = countZeros(max + 1, zeros2) - 1;
  }
  stops = [...stops];
  stops.sort(compare);
  return stops;
}
function rangeToPattern(start, stop, options) {
  if (start === stop) {
    return { pattern: start, count: [], digits: 0 };
  }
  let zipped = zip(start, stop);
  let digits = zipped.length;
  let pattern2 = "";
  let count2 = 0;
  for (let i2 = 0; i2 < digits; i2++) {
    let [startDigit, stopDigit] = zipped[i2];
    if (startDigit === stopDigit) {
      pattern2 += startDigit;
    } else if (startDigit !== "0" || stopDigit !== "9") {
      pattern2 += toCharacterClass(startDigit, stopDigit);
    } else {
      count2++;
    }
  }
  if (count2) {
    pattern2 += options.shorthand === true ? "\\d" : "[0-9]";
  }
  return { pattern: pattern2, count: [count2], digits };
}
function splitToPatterns(min, max, tok, options) {
  let ranges = splitToRanges(min, max);
  let tokens = [];
  let start = min;
  let prev;
  for (let i2 = 0; i2 < ranges.length; i2++) {
    let max2 = ranges[i2];
    let obj = rangeToPattern(String(start), String(max2), options);
    let zeros2 = "";
    if (!tok.isPadded && prev && prev.pattern === obj.pattern) {
      if (prev.count.length > 1) {
        prev.count.pop();
      }
      prev.count.push(obj.count[0]);
      prev.string = prev.pattern + toQuantifier(prev.count);
      start = max2 + 1;
      continue;
    }
    if (tok.isPadded) {
      zeros2 = padZeros(max2, tok, options);
    }
    obj.string = zeros2 + obj.pattern + toQuantifier(obj.count);
    tokens.push(obj);
    start = max2 + 1;
    prev = obj;
  }
  return tokens;
}
function filterPatterns(arr, comparison, prefix, intersection, options) {
  let result = [];
  for (let ele of arr) {
    let { string: string2 } = ele;
    if (!intersection && !contains(comparison, "string", string2)) {
      result.push(prefix + string2);
    }
    if (intersection && contains(comparison, "string", string2)) {
      result.push(prefix + string2);
    }
  }
  return result;
}
function zip(a2, b) {
  let arr = [];
  for (let i2 = 0; i2 < a2.length; i2++) arr.push([a2[i2], b[i2]]);
  return arr;
}
function compare(a2, b) {
  return a2 > b ? 1 : b > a2 ? -1 : 0;
}
function contains(arr, key, val) {
  return arr.some((ele) => ele[key] === val);
}
function countNines(min, len) {
  return Number(String(min).slice(0, -len) + "9".repeat(len));
}
function countZeros(integer, zeros2) {
  return integer - integer % Math.pow(10, zeros2);
}
function toQuantifier(digits) {
  let [start = 0, stop = ""] = digits;
  if (stop || start > 1) {
    return `{${start + (stop ? "," + stop : "")}}`;
  }
  return "";
}
function toCharacterClass(a2, b, options) {
  return `[${a2}${b - a2 === 1 ? "" : "-"}${b}]`;
}
function hasPadding(str) {
  return /^-?(0+)\d/.test(str);
}
function padZeros(value, tok, options) {
  if (!tok.isPadded) {
    return value;
  }
  let diff = Math.abs(tok.maxLen - String(value).length);
  let relax = options.relaxZeros !== false;
  switch (diff) {
    case 0:
      return "";
    case 1:
      return relax ? "0?" : "0";
    case 2:
      return relax ? "0{0,2}" : "00";
    default: {
      return relax ? `0{0,${diff}}` : `0{${diff}}`;
    }
  }
}
toRegexRange$1.cache = {};
toRegexRange$1.clearCache = () => toRegexRange$1.cache = {};
var toRegexRange_1 = toRegexRange$1;
/*!
 * fill-range <https://github.com/jonschlinkert/fill-range>
 *
 * Copyright (c) 2014-present, Jon Schlinkert.
 * Licensed under the MIT License.
 */
const util$1 = require$$0$1;
const toRegexRange = toRegexRange_1;
const isObject$3 = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
const transform = (toNumber) => {
  return (value) => toNumber === true ? Number(value) : String(value);
};
const isValidValue = (value) => {
  return typeof value === "number" || typeof value === "string" && value !== "";
};
const isNumber$1 = (num) => Number.isInteger(+num);
const zeros = (input) => {
  let value = `${input}`;
  let index = -1;
  if (value[0] === "-") value = value.slice(1);
  if (value === "0") return false;
  while (value[++index] === "0") ;
  return index > 0;
};
const stringify$3 = (start, end, options) => {
  if (typeof start === "string" || typeof end === "string") {
    return true;
  }
  return options.stringify === true;
};
const pad = (input, maxLength, toNumber) => {
  if (maxLength > 0) {
    let dash = input[0] === "-" ? "-" : "";
    if (dash) input = input.slice(1);
    input = dash + input.padStart(dash ? maxLength - 1 : maxLength, "0");
  }
  if (toNumber === false) {
    return String(input);
  }
  return input;
};
const toMaxLen = (input, maxLength) => {
  let negative = input[0] === "-" ? "-" : "";
  if (negative) {
    input = input.slice(1);
    maxLength--;
  }
  while (input.length < maxLength) input = "0" + input;
  return negative ? "-" + input : input;
};
const toSequence = (parts, options, maxLen) => {
  parts.negatives.sort((a2, b) => a2 < b ? -1 : a2 > b ? 1 : 0);
  parts.positives.sort((a2, b) => a2 < b ? -1 : a2 > b ? 1 : 0);
  let prefix = options.capture ? "" : "?:";
  let positives = "";
  let negatives = "";
  let result;
  if (parts.positives.length) {
    positives = parts.positives.map((v) => toMaxLen(String(v), maxLen)).join("|");
  }
  if (parts.negatives.length) {
    negatives = `-(${prefix}${parts.negatives.map((v) => toMaxLen(String(v), maxLen)).join("|")})`;
  }
  if (positives && negatives) {
    result = `${positives}|${negatives}`;
  } else {
    result = positives || negatives;
  }
  if (options.wrap) {
    return `(${prefix}${result})`;
  }
  return result;
};
const toRange = (a2, b, isNumbers, options) => {
  if (isNumbers) {
    return toRegexRange(a2, b, { wrap: false, ...options });
  }
  let start = String.fromCharCode(a2);
  if (a2 === b) return start;
  let stop = String.fromCharCode(b);
  return `[${start}-${stop}]`;
};
const toRegex = (start, end, options) => {
  if (Array.isArray(start)) {
    let wrap = options.wrap === true;
    let prefix = options.capture ? "" : "?:";
    return wrap ? `(${prefix}${start.join("|")})` : start.join("|");
  }
  return toRegexRange(start, end, options);
};
const rangeError = (...args) => {
  return new RangeError("Invalid range arguments: " + util$1.inspect(...args));
};
const invalidRange = (start, end, options) => {
  if (options.strictRanges === true) throw rangeError([start, end]);
  return [];
};
const invalidStep = (step, options) => {
  if (options.strictRanges === true) {
    throw new TypeError(`Expected step "${step}" to be a number`);
  }
  return [];
};
const fillNumbers = (start, end, step = 1, options = {}) => {
  let a2 = Number(start);
  let b = Number(end);
  if (!Number.isInteger(a2) || !Number.isInteger(b)) {
    if (options.strictRanges === true) throw rangeError([start, end]);
    return [];
  }
  if (a2 === 0) a2 = 0;
  if (b === 0) b = 0;
  let descending = a2 > b;
  let startString = String(start);
  let endString = String(end);
  let stepString = String(step);
  step = Math.max(Math.abs(step), 1);
  let padded = zeros(startString) || zeros(endString) || zeros(stepString);
  let maxLen = padded ? Math.max(startString.length, endString.length, stepString.length) : 0;
  let toNumber = padded === false && stringify$3(start, end, options) === false;
  let format2 = options.transform || transform(toNumber);
  if (options.toRegex && step === 1) {
    return toRange(toMaxLen(start, maxLen), toMaxLen(end, maxLen), true, options);
  }
  let parts = { negatives: [], positives: [] };
  let push = (num) => parts[num < 0 ? "negatives" : "positives"].push(Math.abs(num));
  let range = [];
  let index = 0;
  while (descending ? a2 >= b : a2 <= b) {
    if (options.toRegex === true && step > 1) {
      push(a2);
    } else {
      range.push(pad(format2(a2, index), maxLen, toNumber));
    }
    a2 = descending ? a2 - step : a2 + step;
    index++;
  }
  if (options.toRegex === true) {
    return step > 1 ? toSequence(parts, options, maxLen) : toRegex(range, null, { wrap: false, ...options });
  }
  return range;
};
const fillLetters = (start, end, step = 1, options = {}) => {
  if (!isNumber$1(start) && start.length > 1 || !isNumber$1(end) && end.length > 1) {
    return invalidRange(start, end, options);
  }
  let format2 = options.transform || ((val) => String.fromCharCode(val));
  let a2 = `${start}`.charCodeAt(0);
  let b = `${end}`.charCodeAt(0);
  let descending = a2 > b;
  let min = Math.min(a2, b);
  let max = Math.max(a2, b);
  if (options.toRegex && step === 1) {
    return toRange(min, max, false, options);
  }
  let range = [];
  let index = 0;
  while (descending ? a2 >= b : a2 <= b) {
    range.push(format2(a2, index));
    a2 = descending ? a2 - step : a2 + step;
    index++;
  }
  if (options.toRegex === true) {
    return toRegex(range, null, { wrap: false, options });
  }
  return range;
};
const fill$2 = (start, end, step, options = {}) => {
  if (end == null && isValidValue(start)) {
    return [start];
  }
  if (!isValidValue(start) || !isValidValue(end)) {
    return invalidRange(start, end, options);
  }
  if (typeof step === "function") {
    return fill$2(start, end, 1, { transform: step });
  }
  if (isObject$3(step)) {
    return fill$2(start, end, 0, step);
  }
  let opts = { ...options };
  if (opts.capture === true) opts.wrap = true;
  step = step || opts.step || 1;
  if (!isNumber$1(step)) {
    if (step != null && !isObject$3(step)) return invalidStep(step, opts);
    return fill$2(start, end, 1, step);
  }
  if (isNumber$1(start) && isNumber$1(end)) {
    return fillNumbers(start, end, step, opts);
  }
  return fillLetters(start, end, Math.max(Math.abs(step), 1), opts);
};
var fillRange = fill$2;
const fill$1 = fillRange;
const utils$h = utils$j;
const compile$1 = (ast, options = {}) => {
  const walk2 = (node, parent = {}) => {
    const invalidBlock = utils$h.isInvalidBrace(parent);
    const invalidNode = node.invalid === true && options.escapeInvalid === true;
    const invalid = invalidBlock === true || invalidNode === true;
    const prefix = options.escapeInvalid === true ? "\\" : "";
    let output = "";
    if (node.isOpen === true) {
      return prefix + node.value;
    }
    if (node.isClose === true) {
      console.log("node.isClose", prefix, node.value);
      return prefix + node.value;
    }
    if (node.type === "open") {
      return invalid ? prefix + node.value : "(";
    }
    if (node.type === "close") {
      return invalid ? prefix + node.value : ")";
    }
    if (node.type === "comma") {
      return node.prev.type === "comma" ? "" : invalid ? node.value : "|";
    }
    if (node.value) {
      return node.value;
    }
    if (node.nodes && node.ranges > 0) {
      const args = utils$h.reduce(node.nodes);
      const range = fill$1(...args, { ...options, wrap: false, toRegex: true, strictZeros: true });
      if (range.length !== 0) {
        return args.length > 1 && range.length > 1 ? `(${range})` : range;
      }
    }
    if (node.nodes) {
      for (const child of node.nodes) {
        output += walk2(child, node);
      }
    }
    return output;
  };
  return walk2(ast);
};
var compile_1 = compile$1;
const fill = fillRange;
const stringify$2 = stringify$4;
const utils$g = utils$j;
const append = (queue2 = "", stash = "", enclose = false) => {
  const result = [];
  queue2 = [].concat(queue2);
  stash = [].concat(stash);
  if (!stash.length) return queue2;
  if (!queue2.length) {
    return enclose ? utils$g.flatten(stash).map((ele) => `{${ele}}`) : stash;
  }
  for (const item of queue2) {
    if (Array.isArray(item)) {
      for (const value of item) {
        result.push(append(value, stash, enclose));
      }
    } else {
      for (let ele of stash) {
        if (enclose === true && typeof ele === "string") ele = `{${ele}}`;
        result.push(Array.isArray(ele) ? append(item, ele, enclose) : item + ele);
      }
    }
  }
  return utils$g.flatten(result);
};
const expand$1 = (ast, options = {}) => {
  const rangeLimit = options.rangeLimit === void 0 ? 1e3 : options.rangeLimit;
  const walk2 = (node, parent = {}) => {
    node.queue = [];
    let p = parent;
    let q = parent.queue;
    while (p.type !== "brace" && p.type !== "root" && p.parent) {
      p = p.parent;
      q = p.queue;
    }
    if (node.invalid || node.dollar) {
      q.push(append(q.pop(), stringify$2(node, options)));
      return;
    }
    if (node.type === "brace" && node.invalid !== true && node.nodes.length === 2) {
      q.push(append(q.pop(), ["{}"]));
      return;
    }
    if (node.nodes && node.ranges > 0) {
      const args = utils$g.reduce(node.nodes);
      if (utils$g.exceedsLimit(...args, options.step, rangeLimit)) {
        throw new RangeError("expanded array length exceeds range limit. Use options.rangeLimit to increase or disable the limit.");
      }
      let range = fill(...args, options);
      if (range.length === 0) {
        range = stringify$2(node, options);
      }
      q.push(append(q.pop(), range));
      node.nodes = [];
      return;
    }
    const enclose = utils$g.encloseBrace(node);
    let queue2 = node.queue;
    let block = node;
    while (block.type !== "brace" && block.type !== "root" && block.parent) {
      block = block.parent;
      queue2 = block.queue;
    }
    for (let i2 = 0; i2 < node.nodes.length; i2++) {
      const child = node.nodes[i2];
      if (child.type === "comma" && node.type === "brace") {
        if (i2 === 1) queue2.push("");
        queue2.push("");
        continue;
      }
      if (child.type === "close") {
        q.push(append(q.pop(), queue2, enclose));
        continue;
      }
      if (child.value && child.type !== "open") {
        queue2.push(append(queue2.pop(), child.value));
        continue;
      }
      if (child.nodes) {
        walk2(child, node);
      }
    }
    return queue2;
  };
  return utils$g.flatten(walk2(ast));
};
var expand_1 = expand$1;
var constants$4 = {
  MAX_LENGTH: 1e4,
  CHAR_LEFT_PARENTHESES: "(",
  /* ( */
  CHAR_RIGHT_PARENTHESES: ")",
  /* ) */
  CHAR_BACKSLASH: "\\",
  /* \ */
  CHAR_BACKTICK: "`",
  /* ` */
  CHAR_COMMA: ",",
  /* , */
  CHAR_DOT: ".",
  /* . */
  CHAR_DOUBLE_QUOTE: '"',
  /* " */
  CHAR_LEFT_CURLY_BRACE: "{",
  /* { */
  CHAR_LEFT_SQUARE_BRACKET: "[",
  /* [ */
  CHAR_NO_BREAK_SPACE: " ",
  /* \u00A0 */
  CHAR_RIGHT_CURLY_BRACE: "}",
  /* } */
  CHAR_RIGHT_SQUARE_BRACKET: "]",
  /* ] */
  CHAR_SINGLE_QUOTE: "'",
  /* ' */
  CHAR_ZERO_WIDTH_NOBREAK_SPACE: "\uFEFF"
  /* \uFEFF */
};
const stringify$1 = stringify$4;
const {
  MAX_LENGTH: MAX_LENGTH$1,
  CHAR_BACKSLASH,
  /* \ */
  CHAR_BACKTICK,
  /* ` */
  CHAR_COMMA: CHAR_COMMA$1,
  /* , */
  CHAR_DOT: CHAR_DOT$1,
  /* . */
  CHAR_LEFT_PARENTHESES: CHAR_LEFT_PARENTHESES$1,
  /* ( */
  CHAR_RIGHT_PARENTHESES: CHAR_RIGHT_PARENTHESES$1,
  /* ) */
  CHAR_LEFT_CURLY_BRACE: CHAR_LEFT_CURLY_BRACE$1,
  /* { */
  CHAR_RIGHT_CURLY_BRACE: CHAR_RIGHT_CURLY_BRACE$1,
  /* } */
  CHAR_LEFT_SQUARE_BRACKET: CHAR_LEFT_SQUARE_BRACKET$1,
  /* [ */
  CHAR_RIGHT_SQUARE_BRACKET: CHAR_RIGHT_SQUARE_BRACKET$1,
  /* ] */
  CHAR_DOUBLE_QUOTE,
  /* " */
  CHAR_SINGLE_QUOTE,
  /* ' */
  CHAR_NO_BREAK_SPACE,
  CHAR_ZERO_WIDTH_NOBREAK_SPACE
} = constants$4;
const parse$6 = (input, options = {}) => {
  if (typeof input !== "string") {
    throw new TypeError("Expected a string");
  }
  const opts = options || {};
  const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH$1, opts.maxLength) : MAX_LENGTH$1;
  if (input.length > max) {
    throw new SyntaxError(`Input length (${input.length}), exceeds max characters (${max})`);
  }
  const ast = { type: "root", input, nodes: [] };
  const stack = [ast];
  let block = ast;
  let prev = ast;
  let brackets = 0;
  const length = input.length;
  let index = 0;
  let depth2 = 0;
  let value;
  const advance = () => input[index++];
  const push = (node) => {
    if (node.type === "text" && prev.type === "dot") {
      prev.type = "text";
    }
    if (prev && prev.type === "text" && node.type === "text") {
      prev.value += node.value;
      return;
    }
    block.nodes.push(node);
    node.parent = block;
    node.prev = prev;
    prev = node;
    return node;
  };
  push({ type: "bos" });
  while (index < length) {
    block = stack[stack.length - 1];
    value = advance();
    if (value === CHAR_ZERO_WIDTH_NOBREAK_SPACE || value === CHAR_NO_BREAK_SPACE) {
      continue;
    }
    if (value === CHAR_BACKSLASH) {
      push({ type: "text", value: (options.keepEscaping ? value : "") + advance() });
      continue;
    }
    if (value === CHAR_RIGHT_SQUARE_BRACKET$1) {
      push({ type: "text", value: "\\" + value });
      continue;
    }
    if (value === CHAR_LEFT_SQUARE_BRACKET$1) {
      brackets++;
      let next;
      while (index < length && (next = advance())) {
        value += next;
        if (next === CHAR_LEFT_SQUARE_BRACKET$1) {
          brackets++;
          continue;
        }
        if (next === CHAR_BACKSLASH) {
          value += advance();
          continue;
        }
        if (next === CHAR_RIGHT_SQUARE_BRACKET$1) {
          brackets--;
          if (brackets === 0) {
            break;
          }
        }
      }
      push({ type: "text", value });
      continue;
    }
    if (value === CHAR_LEFT_PARENTHESES$1) {
      block = push({ type: "paren", nodes: [] });
      stack.push(block);
      push({ type: "text", value });
      continue;
    }
    if (value === CHAR_RIGHT_PARENTHESES$1) {
      if (block.type !== "paren") {
        push({ type: "text", value });
        continue;
      }
      block = stack.pop();
      push({ type: "text", value });
      block = stack[stack.length - 1];
      continue;
    }
    if (value === CHAR_DOUBLE_QUOTE || value === CHAR_SINGLE_QUOTE || value === CHAR_BACKTICK) {
      const open = value;
      let next;
      if (options.keepQuotes !== true) {
        value = "";
      }
      while (index < length && (next = advance())) {
        if (next === CHAR_BACKSLASH) {
          value += next + advance();
          continue;
        }
        if (next === open) {
          if (options.keepQuotes === true) value += next;
          break;
        }
        value += next;
      }
      push({ type: "text", value });
      continue;
    }
    if (value === CHAR_LEFT_CURLY_BRACE$1) {
      depth2++;
      const dollar = prev.value && prev.value.slice(-1) === "$" || block.dollar === true;
      const brace = {
        type: "brace",
        open: true,
        close: false,
        dollar,
        depth: depth2,
        commas: 0,
        ranges: 0,
        nodes: []
      };
      block = push(brace);
      stack.push(block);
      push({ type: "open", value });
      continue;
    }
    if (value === CHAR_RIGHT_CURLY_BRACE$1) {
      if (block.type !== "brace") {
        push({ type: "text", value });
        continue;
      }
      const type = "close";
      block = stack.pop();
      block.close = true;
      push({ type, value });
      depth2--;
      block = stack[stack.length - 1];
      continue;
    }
    if (value === CHAR_COMMA$1 && depth2 > 0) {
      if (block.ranges > 0) {
        block.ranges = 0;
        const open = block.nodes.shift();
        block.nodes = [open, { type: "text", value: stringify$1(block) }];
      }
      push({ type: "comma", value });
      block.commas++;
      continue;
    }
    if (value === CHAR_DOT$1 && depth2 > 0 && block.commas === 0) {
      const siblings = block.nodes;
      if (depth2 === 0 || siblings.length === 0) {
        push({ type: "text", value });
        continue;
      }
      if (prev.type === "dot") {
        block.range = [];
        prev.value += value;
        prev.type = "range";
        if (block.nodes.length !== 3 && block.nodes.length !== 5) {
          block.invalid = true;
          block.ranges = 0;
          prev.type = "text";
          continue;
        }
        block.ranges++;
        block.args = [];
        continue;
      }
      if (prev.type === "range") {
        siblings.pop();
        const before = siblings[siblings.length - 1];
        before.value += prev.value + value;
        prev = before;
        block.ranges--;
        continue;
      }
      push({ type: "dot", value });
      continue;
    }
    push({ type: "text", value });
  }
  do {
    block = stack.pop();
    if (block.type !== "root") {
      block.nodes.forEach((node) => {
        if (!node.nodes) {
          if (node.type === "open") node.isOpen = true;
          if (node.type === "close") node.isClose = true;
          if (!node.nodes) node.type = "text";
          node.invalid = true;
        }
      });
      const parent = stack[stack.length - 1];
      const index2 = parent.nodes.indexOf(block);
      parent.nodes.splice(index2, 1, ...block.nodes);
    }
  } while (stack.length > 0);
  push({ type: "eos" });
  return ast;
};
var parse_1$2 = parse$6;
const stringify = stringify$4;
const compile = compile_1;
const expand = expand_1;
const parse$5 = parse_1$2;
const braces$1 = (input, options = {}) => {
  let output = [];
  if (Array.isArray(input)) {
    for (const pattern2 of input) {
      const result = braces$1.create(pattern2, options);
      if (Array.isArray(result)) {
        output.push(...result);
      } else {
        output.push(result);
      }
    }
  } else {
    output = [].concat(braces$1.create(input, options));
  }
  if (options && options.expand === true && options.nodupes === true) {
    output = [...new Set(output)];
  }
  return output;
};
braces$1.parse = (input, options = {}) => parse$5(input, options);
braces$1.stringify = (input, options = {}) => {
  if (typeof input === "string") {
    return stringify(braces$1.parse(input, options), options);
  }
  return stringify(input, options);
};
braces$1.compile = (input, options = {}) => {
  if (typeof input === "string") {
    input = braces$1.parse(input, options);
  }
  return compile(input, options);
};
braces$1.expand = (input, options = {}) => {
  if (typeof input === "string") {
    input = braces$1.parse(input, options);
  }
  let result = expand(input, options);
  if (options.noempty === true) {
    result = result.filter(Boolean);
  }
  if (options.nodupes === true) {
    result = [...new Set(result)];
  }
  return result;
};
braces$1.create = (input, options = {}) => {
  if (input === "" || input.length < 3) {
    return [input];
  }
  return options.expand !== true ? braces$1.compile(input, options) : braces$1.expand(input, options);
};
var braces_1 = braces$1;
var utils$f = {};
const path$a = path$d;
const WIN_SLASH = "\\\\/";
const WIN_NO_SLASH = `[^${WIN_SLASH}]`;
const DOT_LITERAL = "\\.";
const PLUS_LITERAL = "\\+";
const QMARK_LITERAL = "\\?";
const SLASH_LITERAL = "\\/";
const ONE_CHAR = "(?=.)";
const QMARK = "[^/]";
const END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
const START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
const DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
const NO_DOT = `(?!${DOT_LITERAL})`;
const NO_DOTS = `(?!${START_ANCHOR}${DOTS_SLASH})`;
const NO_DOT_SLASH = `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`;
const NO_DOTS_SLASH = `(?!${DOTS_SLASH})`;
const QMARK_NO_DOT = `[^.${SLASH_LITERAL}]`;
const STAR = `${QMARK}*?`;
const POSIX_CHARS = {
  DOT_LITERAL,
  PLUS_LITERAL,
  QMARK_LITERAL,
  SLASH_LITERAL,
  ONE_CHAR,
  QMARK,
  END_ANCHOR,
  DOTS_SLASH,
  NO_DOT,
  NO_DOTS,
  NO_DOT_SLASH,
  NO_DOTS_SLASH,
  QMARK_NO_DOT,
  STAR,
  START_ANCHOR
};
const WINDOWS_CHARS = {
  ...POSIX_CHARS,
  SLASH_LITERAL: `[${WIN_SLASH}]`,
  QMARK: WIN_NO_SLASH,
  STAR: `${WIN_NO_SLASH}*?`,
  DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
  NO_DOT: `(?!${DOT_LITERAL})`,
  NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
  NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
  NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
  QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
  START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
  END_ANCHOR: `(?:[${WIN_SLASH}]|$)`
};
const POSIX_REGEX_SOURCE$1 = {
  alnum: "a-zA-Z0-9",
  alpha: "a-zA-Z",
  ascii: "\\x00-\\x7F",
  blank: " \\t",
  cntrl: "\\x00-\\x1F\\x7F",
  digit: "0-9",
  graph: "\\x21-\\x7E",
  lower: "a-z",
  print: "\\x20-\\x7E ",
  punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
  space: " \\t\\r\\n\\v\\f",
  upper: "A-Z",
  word: "A-Za-z0-9_",
  xdigit: "A-Fa-f0-9"
};
var constants$3 = {
  MAX_LENGTH: 1024 * 64,
  POSIX_REGEX_SOURCE: POSIX_REGEX_SOURCE$1,
  // regular expressions
  REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
  REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
  REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
  REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
  REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
  REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
  // Replace globs with equivalent patterns to reduce parsing time.
  REPLACEMENTS: {
    "***": "*",
    "**/**": "**",
    "**/**/**": "**"
  },
  // Digits
  CHAR_0: 48,
  /* 0 */
  CHAR_9: 57,
  /* 9 */
  // Alphabet chars.
  CHAR_UPPERCASE_A: 65,
  /* A */
  CHAR_LOWERCASE_A: 97,
  /* a */
  CHAR_UPPERCASE_Z: 90,
  /* Z */
  CHAR_LOWERCASE_Z: 122,
  /* z */
  CHAR_LEFT_PARENTHESES: 40,
  /* ( */
  CHAR_RIGHT_PARENTHESES: 41,
  /* ) */
  CHAR_ASTERISK: 42,
  /* * */
  // Non-alphabetic chars.
  CHAR_AMPERSAND: 38,
  /* & */
  CHAR_AT: 64,
  /* @ */
  CHAR_BACKWARD_SLASH: 92,
  /* \ */
  CHAR_CARRIAGE_RETURN: 13,
  /* \r */
  CHAR_CIRCUMFLEX_ACCENT: 94,
  /* ^ */
  CHAR_COLON: 58,
  /* : */
  CHAR_COMMA: 44,
  /* , */
  CHAR_DOT: 46,
  /* . */
  CHAR_DOUBLE_QUOTE: 34,
  /* " */
  CHAR_EQUAL: 61,
  /* = */
  CHAR_EXCLAMATION_MARK: 33,
  /* ! */
  CHAR_FORM_FEED: 12,
  /* \f */
  CHAR_FORWARD_SLASH: 47,
  /* / */
  CHAR_GRAVE_ACCENT: 96,
  /* ` */
  CHAR_HASH: 35,
  /* # */
  CHAR_HYPHEN_MINUS: 45,
  /* - */
  CHAR_LEFT_ANGLE_BRACKET: 60,
  /* < */
  CHAR_LEFT_CURLY_BRACE: 123,
  /* { */
  CHAR_LEFT_SQUARE_BRACKET: 91,
  /* [ */
  CHAR_LINE_FEED: 10,
  /* \n */
  CHAR_NO_BREAK_SPACE: 160,
  /* \u00A0 */
  CHAR_PERCENT: 37,
  /* % */
  CHAR_PLUS: 43,
  /* + */
  CHAR_QUESTION_MARK: 63,
  /* ? */
  CHAR_RIGHT_ANGLE_BRACKET: 62,
  /* > */
  CHAR_RIGHT_CURLY_BRACE: 125,
  /* } */
  CHAR_RIGHT_SQUARE_BRACKET: 93,
  /* ] */
  CHAR_SEMICOLON: 59,
  /* ; */
  CHAR_SINGLE_QUOTE: 39,
  /* ' */
  CHAR_SPACE: 32,
  /*   */
  CHAR_TAB: 9,
  /* \t */
  CHAR_UNDERSCORE: 95,
  /* _ */
  CHAR_VERTICAL_LINE: 124,
  /* | */
  CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
  /* \uFEFF */
  SEP: path$a.sep,
  /**
   * Create EXTGLOB_CHARS
   */
  extglobChars(chars2) {
    return {
      "!": { type: "negate", open: "(?:(?!(?:", close: `))${chars2.STAR})` },
      "?": { type: "qmark", open: "(?:", close: ")?" },
      "+": { type: "plus", open: "(?:", close: ")+" },
      "*": { type: "star", open: "(?:", close: ")*" },
      "@": { type: "at", open: "(?:", close: ")" }
    };
  },
  /**
   * Create GLOB_CHARS
   */
  globChars(win32) {
    return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
  }
};
(function(exports$1) {
  const path2 = path$d;
  const win32 = process.platform === "win32";
  const {
    REGEX_BACKSLASH,
    REGEX_REMOVE_BACKSLASH,
    REGEX_SPECIAL_CHARS,
    REGEX_SPECIAL_CHARS_GLOBAL
  } = constants$3;
  exports$1.isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
  exports$1.hasRegexChars = (str) => REGEX_SPECIAL_CHARS.test(str);
  exports$1.isRegexChar = (str) => str.length === 1 && exports$1.hasRegexChars(str);
  exports$1.escapeRegex = (str) => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1");
  exports$1.toPosixSlashes = (str) => str.replace(REGEX_BACKSLASH, "/");
  exports$1.removeBackslashes = (str) => {
    return str.replace(REGEX_REMOVE_BACKSLASH, (match) => {
      return match === "\\" ? "" : match;
    });
  };
  exports$1.supportsLookbehinds = () => {
    const segs = process.version.slice(1).split(".").map(Number);
    if (segs.length === 3 && segs[0] >= 9 || segs[0] === 8 && segs[1] >= 10) {
      return true;
    }
    return false;
  };
  exports$1.isWindows = (options) => {
    if (options && typeof options.windows === "boolean") {
      return options.windows;
    }
    return win32 === true || path2.sep === "\\";
  };
  exports$1.escapeLast = (input, char, lastIdx) => {
    const idx = input.lastIndexOf(char, lastIdx);
    if (idx === -1) return input;
    if (input[idx - 1] === "\\") return exports$1.escapeLast(input, char, idx - 1);
    return `${input.slice(0, idx)}\\${input.slice(idx)}`;
  };
  exports$1.removePrefix = (input, state = {}) => {
    let output = input;
    if (output.startsWith("./")) {
      output = output.slice(2);
      state.prefix = "./";
    }
    return output;
  };
  exports$1.wrapOutput = (input, state = {}, options = {}) => {
    const prepend = options.contains ? "" : "^";
    const append2 = options.contains ? "" : "$";
    let output = `${prepend}(?:${input})${append2}`;
    if (state.negated === true) {
      output = `(?:^(?!${output}).*$)`;
    }
    return output;
  };
})(utils$f);
const utils$e = utils$f;
const {
  CHAR_ASTERISK,
  /* * */
  CHAR_AT,
  /* @ */
  CHAR_BACKWARD_SLASH,
  /* \ */
  CHAR_COMMA,
  /* , */
  CHAR_DOT,
  /* . */
  CHAR_EXCLAMATION_MARK,
  /* ! */
  CHAR_FORWARD_SLASH,
  /* / */
  CHAR_LEFT_CURLY_BRACE,
  /* { */
  CHAR_LEFT_PARENTHESES,
  /* ( */
  CHAR_LEFT_SQUARE_BRACKET,
  /* [ */
  CHAR_PLUS,
  /* + */
  CHAR_QUESTION_MARK,
  /* ? */
  CHAR_RIGHT_CURLY_BRACE,
  /* } */
  CHAR_RIGHT_PARENTHESES,
  /* ) */
  CHAR_RIGHT_SQUARE_BRACKET
  /* ] */
} = constants$3;
const isPathSeparator = (code) => {
  return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
};
const depth = (token) => {
  if (token.isPrefix !== true) {
    token.depth = token.isGlobstar ? Infinity : 1;
  }
};
const scan$1 = (input, options) => {
  const opts = options || {};
  const length = input.length - 1;
  const scanToEnd = opts.parts === true || opts.scanToEnd === true;
  const slashes = [];
  const tokens = [];
  const parts = [];
  let str = input;
  let index = -1;
  let start = 0;
  let lastIndex = 0;
  let isBrace = false;
  let isBracket = false;
  let isGlob3 = false;
  let isExtglob3 = false;
  let isGlobstar = false;
  let braceEscaped = false;
  let backslashes = false;
  let negated = false;
  let negatedExtglob = false;
  let finished = false;
  let braces2 = 0;
  let prev;
  let code;
  let token = { value: "", depth: 0, isGlob: false };
  const eos = () => index >= length;
  const peek = () => str.charCodeAt(index + 1);
  const advance = () => {
    prev = code;
    return str.charCodeAt(++index);
  };
  while (index < length) {
    code = advance();
    let next;
    if (code === CHAR_BACKWARD_SLASH) {
      backslashes = token.backslashes = true;
      code = advance();
      if (code === CHAR_LEFT_CURLY_BRACE) {
        braceEscaped = true;
      }
      continue;
    }
    if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
      braces2++;
      while (eos() !== true && (code = advance())) {
        if (code === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          advance();
          continue;
        }
        if (code === CHAR_LEFT_CURLY_BRACE) {
          braces2++;
          continue;
        }
        if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
          isBrace = token.isBrace = true;
          isGlob3 = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (braceEscaped !== true && code === CHAR_COMMA) {
          isBrace = token.isBrace = true;
          isGlob3 = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_RIGHT_CURLY_BRACE) {
          braces2--;
          if (braces2 === 0) {
            braceEscaped = false;
            isBrace = token.isBrace = true;
            finished = true;
            break;
          }
        }
      }
      if (scanToEnd === true) {
        continue;
      }
      break;
    }
    if (code === CHAR_FORWARD_SLASH) {
      slashes.push(index);
      tokens.push(token);
      token = { value: "", depth: 0, isGlob: false };
      if (finished === true) continue;
      if (prev === CHAR_DOT && index === start + 1) {
        start += 2;
        continue;
      }
      lastIndex = index + 1;
      continue;
    }
    if (opts.noext !== true) {
      const isExtglobChar = code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK;
      if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES) {
        isGlob3 = token.isGlob = true;
        isExtglob3 = token.isExtglob = true;
        finished = true;
        if (code === CHAR_EXCLAMATION_MARK && index === start) {
          negatedExtglob = true;
        }
        if (scanToEnd === true) {
          while (eos() !== true && (code = advance())) {
            if (code === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              code = advance();
              continue;
            }
            if (code === CHAR_RIGHT_PARENTHESES) {
              isGlob3 = token.isGlob = true;
              finished = true;
              break;
            }
          }
          continue;
        }
        break;
      }
    }
    if (code === CHAR_ASTERISK) {
      if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
      isGlob3 = token.isGlob = true;
      finished = true;
      if (scanToEnd === true) {
        continue;
      }
      break;
    }
    if (code === CHAR_QUESTION_MARK) {
      isGlob3 = token.isGlob = true;
      finished = true;
      if (scanToEnd === true) {
        continue;
      }
      break;
    }
    if (code === CHAR_LEFT_SQUARE_BRACKET) {
      while (eos() !== true && (next = advance())) {
        if (next === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          advance();
          continue;
        }
        if (next === CHAR_RIGHT_SQUARE_BRACKET) {
          isBracket = token.isBracket = true;
          isGlob3 = token.isGlob = true;
          finished = true;
          break;
        }
      }
      if (scanToEnd === true) {
        continue;
      }
      break;
    }
    if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
      negated = token.negated = true;
      start++;
      continue;
    }
    if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
      isGlob3 = token.isGlob = true;
      if (scanToEnd === true) {
        while (eos() !== true && (code = advance())) {
          if (code === CHAR_LEFT_PARENTHESES) {
            backslashes = token.backslashes = true;
            code = advance();
            continue;
          }
          if (code === CHAR_RIGHT_PARENTHESES) {
            finished = true;
            break;
          }
        }
        continue;
      }
      break;
    }
    if (isGlob3 === true) {
      finished = true;
      if (scanToEnd === true) {
        continue;
      }
      break;
    }
  }
  if (opts.noext === true) {
    isExtglob3 = false;
    isGlob3 = false;
  }
  let base = str;
  let prefix = "";
  let glob = "";
  if (start > 0) {
    prefix = str.slice(0, start);
    str = str.slice(start);
    lastIndex -= start;
  }
  if (base && isGlob3 === true && lastIndex > 0) {
    base = str.slice(0, lastIndex);
    glob = str.slice(lastIndex);
  } else if (isGlob3 === true) {
    base = "";
    glob = str;
  } else {
    base = str;
  }
  if (base && base !== "" && base !== "/" && base !== str) {
    if (isPathSeparator(base.charCodeAt(base.length - 1))) {
      base = base.slice(0, -1);
    }
  }
  if (opts.unescape === true) {
    if (glob) glob = utils$e.removeBackslashes(glob);
    if (base && backslashes === true) {
      base = utils$e.removeBackslashes(base);
    }
  }
  const state = {
    prefix,
    input,
    start,
    base,
    glob,
    isBrace,
    isBracket,
    isGlob: isGlob3,
    isExtglob: isExtglob3,
    isGlobstar,
    negated,
    negatedExtglob
  };
  if (opts.tokens === true) {
    state.maxDepth = 0;
    if (!isPathSeparator(code)) {
      tokens.push(token);
    }
    state.tokens = tokens;
  }
  if (opts.parts === true || opts.tokens === true) {
    let prevIndex;
    for (let idx = 0; idx < slashes.length; idx++) {
      const n2 = prevIndex ? prevIndex + 1 : start;
      const i2 = slashes[idx];
      const value = input.slice(n2, i2);
      if (opts.tokens) {
        if (idx === 0 && start !== 0) {
          tokens[idx].isPrefix = true;
          tokens[idx].value = prefix;
        } else {
          tokens[idx].value = value;
        }
        depth(tokens[idx]);
        state.maxDepth += tokens[idx].depth;
      }
      if (idx !== 0 || value !== "") {
        parts.push(value);
      }
      prevIndex = i2;
    }
    if (prevIndex && prevIndex + 1 < input.length) {
      const value = input.slice(prevIndex + 1);
      parts.push(value);
      if (opts.tokens) {
        tokens[tokens.length - 1].value = value;
        depth(tokens[tokens.length - 1]);
        state.maxDepth += tokens[tokens.length - 1].depth;
      }
    }
    state.slashes = slashes;
    state.parts = parts;
  }
  return state;
};
var scan_1 = scan$1;
const constants$2 = constants$3;
const utils$d = utils$f;
const {
  MAX_LENGTH,
  POSIX_REGEX_SOURCE,
  REGEX_NON_SPECIAL_CHARS,
  REGEX_SPECIAL_CHARS_BACKREF,
  REPLACEMENTS
} = constants$2;
const expandRange = (args, options) => {
  if (typeof options.expandRange === "function") {
    return options.expandRange(...args, options);
  }
  args.sort();
  const value = `[${args.join("-")}]`;
  try {
    new RegExp(value);
  } catch (ex) {
    return args.map((v) => utils$d.escapeRegex(v)).join("..");
  }
  return value;
};
const syntaxError = (type, char) => {
  return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
};
const parse$4 = (input, options) => {
  if (typeof input !== "string") {
    throw new TypeError("Expected a string");
  }
  input = REPLACEMENTS[input] || input;
  const opts = { ...options };
  const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
  let len = input.length;
  if (len > max) {
    throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
  }
  const bos = { type: "bos", value: "", output: opts.prepend || "" };
  const tokens = [bos];
  const capture = opts.capture ? "" : "?:";
  const win32 = utils$d.isWindows(options);
  const PLATFORM_CHARS = constants$2.globChars(win32);
  const EXTGLOB_CHARS = constants$2.extglobChars(PLATFORM_CHARS);
  const {
    DOT_LITERAL: DOT_LITERAL2,
    PLUS_LITERAL: PLUS_LITERAL2,
    SLASH_LITERAL: SLASH_LITERAL2,
    ONE_CHAR: ONE_CHAR2,
    DOTS_SLASH: DOTS_SLASH2,
    NO_DOT: NO_DOT2,
    NO_DOT_SLASH: NO_DOT_SLASH2,
    NO_DOTS_SLASH: NO_DOTS_SLASH2,
    QMARK: QMARK2,
    QMARK_NO_DOT: QMARK_NO_DOT2,
    STAR: STAR2,
    START_ANCHOR: START_ANCHOR2
  } = PLATFORM_CHARS;
  const globstar = (opts2) => {
    return `(${capture}(?:(?!${START_ANCHOR2}${opts2.dot ? DOTS_SLASH2 : DOT_LITERAL2}).)*?)`;
  };
  const nodot = opts.dot ? "" : NO_DOT2;
  const qmarkNoDot = opts.dot ? QMARK2 : QMARK_NO_DOT2;
  let star = opts.bash === true ? globstar(opts) : STAR2;
  if (opts.capture) {
    star = `(${star})`;
  }
  if (typeof opts.noext === "boolean") {
    opts.noextglob = opts.noext;
  }
  const state = {
    input,
    index: -1,
    start: 0,
    dot: opts.dot === true,
    consumed: "",
    output: "",
    prefix: "",
    backtrack: false,
    negated: false,
    brackets: 0,
    braces: 0,
    parens: 0,
    quotes: 0,
    globstar: false,
    tokens
  };
  input = utils$d.removePrefix(input, state);
  len = input.length;
  const extglobs = [];
  const braces2 = [];
  const stack = [];
  let prev = bos;
  let value;
  const eos = () => state.index === len - 1;
  const peek = state.peek = (n2 = 1) => input[state.index + n2];
  const advance = state.advance = () => input[++state.index] || "";
  const remaining = () => input.slice(state.index + 1);
  const consume = (value2 = "", num = 0) => {
    state.consumed += value2;
    state.index += num;
  };
  const append2 = (token) => {
    state.output += token.output != null ? token.output : token.value;
    consume(token.value);
  };
  const negate = () => {
    let count2 = 1;
    while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
      advance();
      state.start++;
      count2++;
    }
    if (count2 % 2 === 0) {
      return false;
    }
    state.negated = true;
    state.start++;
    return true;
  };
  const increment2 = (type) => {
    state[type]++;
    stack.push(type);
  };
  const decrement = (type) => {
    state[type]--;
    stack.pop();
  };
  const push = (tok) => {
    if (prev.type === "globstar") {
      const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace");
      const isExtglob3 = tok.extglob === true || extglobs.length && (tok.type === "pipe" || tok.type === "paren");
      if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob3) {
        state.output = state.output.slice(0, -prev.output.length);
        prev.type = "star";
        prev.value = "*";
        prev.output = star;
        state.output += prev.output;
      }
    }
    if (extglobs.length && tok.type !== "paren") {
      extglobs[extglobs.length - 1].inner += tok.value;
    }
    if (tok.value || tok.output) append2(tok);
    if (prev && prev.type === "text" && tok.type === "text") {
      prev.value += tok.value;
      prev.output = (prev.output || "") + tok.value;
      return;
    }
    tok.prev = prev;
    tokens.push(tok);
    prev = tok;
  };
  const extglobOpen = (type, value2) => {
    const token = { ...EXTGLOB_CHARS[value2], conditions: 1, inner: "" };
    token.prev = prev;
    token.parens = state.parens;
    token.output = state.output;
    const output = (opts.capture ? "(" : "") + token.open;
    increment2("parens");
    push({ type, value: value2, output: state.output ? "" : ONE_CHAR2 });
    push({ type: "paren", extglob: true, value: advance(), output });
    extglobs.push(token);
  };
  const extglobClose = (token) => {
    let output = token.close + (opts.capture ? ")" : "");
    let rest;
    if (token.type === "negate") {
      let extglobStar = star;
      if (token.inner && token.inner.length > 1 && token.inner.includes("/")) {
        extglobStar = globstar(opts);
      }
      if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
        output = token.close = `)$))${extglobStar}`;
      }
      if (token.inner.includes("*") && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) {
        const expression = parse$4(rest, { ...options, fastpaths: false }).output;
        output = token.close = `)${expression})${extglobStar})`;
      }
      if (token.prev.type === "bos") {
        state.negatedExtglob = true;
      }
    }
    push({ type: "paren", extglob: true, value, output });
    decrement("parens");
  };
  if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
    let backslashes = false;
    let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars2, first, rest, index) => {
      if (first === "\\") {
        backslashes = true;
        return m;
      }
      if (first === "?") {
        if (esc) {
          return esc + first + (rest ? QMARK2.repeat(rest.length) : "");
        }
        if (index === 0) {
          return qmarkNoDot + (rest ? QMARK2.repeat(rest.length) : "");
        }
        return QMARK2.repeat(chars2.length);
      }
      if (first === ".") {
        return DOT_LITERAL2.repeat(chars2.length);
      }
      if (first === "*") {
        if (esc) {
          return esc + first + (rest ? star : "");
        }
        return star;
      }
      return esc ? m : `\\${m}`;
    });
    if (backslashes === true) {
      if (opts.unescape === true) {
        output = output.replace(/\\/g, "");
      } else {
        output = output.replace(/\\+/g, (m) => {
          return m.length % 2 === 0 ? "\\\\" : m ? "\\" : "";
        });
      }
    }
    if (output === input && opts.contains === true) {
      state.output = input;
      return state;
    }
    state.output = utils$d.wrapOutput(output, state, options);
    return state;
  }
  while (!eos()) {
    value = advance();
    if (value === "\0") {
      continue;
    }
    if (value === "\\") {
      const next = peek();
      if (next === "/" && opts.bash !== true) {
        continue;
      }
      if (next === "." || next === ";") {
        continue;
      }
      if (!next) {
        value += "\\";
        push({ type: "text", value });
        continue;
      }
      const match = /^\\+/.exec(remaining());
      let slashes = 0;
      if (match && match[0].length > 2) {
        slashes = match[0].length;
        state.index += slashes;
        if (slashes % 2 !== 0) {
          value += "\\";
        }
      }
      if (opts.unescape === true) {
        value = advance();
      } else {
        value += advance();
      }
      if (state.brackets === 0) {
        push({ type: "text", value });
        continue;
      }
    }
    if (state.brackets > 0 && (value !== "]" || prev.value === "[" || prev.value === "[^")) {
      if (opts.posix !== false && value === ":") {
        const inner = prev.value.slice(1);
        if (inner.includes("[")) {
          prev.posix = true;
          if (inner.includes(":")) {
            const idx = prev.value.lastIndexOf("[");
            const pre = prev.value.slice(0, idx);
            const rest2 = prev.value.slice(idx + 2);
            const posix = POSIX_REGEX_SOURCE[rest2];
            if (posix) {
              prev.value = pre + posix;
              state.backtrack = true;
              advance();
              if (!bos.output && tokens.indexOf(prev) === 1) {
                bos.output = ONE_CHAR2;
              }
              continue;
            }
          }
        }
      }
      if (value === "[" && peek() !== ":" || value === "-" && peek() === "]") {
        value = `\\${value}`;
      }
      if (value === "]" && (prev.value === "[" || prev.value === "[^")) {
        value = `\\${value}`;
      }
      if (opts.posix === true && value === "!" && prev.value === "[") {
        value = "^";
      }
      prev.value += value;
      append2({ value });
      continue;
    }
    if (state.quotes === 1 && value !== '"') {
      value = utils$d.escapeRegex(value);
      prev.value += value;
      append2({ value });
      continue;
    }
    if (value === '"') {
      state.quotes = state.quotes === 1 ? 0 : 1;
      if (opts.keepQuotes === true) {
        push({ type: "text", value });
      }
      continue;
    }
    if (value === "(") {
      increment2("parens");
      push({ type: "paren", value });
      continue;
    }
    if (value === ")") {
      if (state.parens === 0 && opts.strictBrackets === true) {
        throw new SyntaxError(syntaxError("opening", "("));
      }
      const extglob = extglobs[extglobs.length - 1];
      if (extglob && state.parens === extglob.parens + 1) {
        extglobClose(extglobs.pop());
        continue;
      }
      push({ type: "paren", value, output: state.parens ? ")" : "\\)" });
      decrement("parens");
      continue;
    }
    if (value === "[") {
      if (opts.nobracket === true || !remaining().includes("]")) {
        if (opts.nobracket !== true && opts.strictBrackets === true) {
          throw new SyntaxError(syntaxError("closing", "]"));
        }
        value = `\\${value}`;
      } else {
        increment2("brackets");
      }
      push({ type: "bracket", value });
      continue;
    }
    if (value === "]") {
      if (opts.nobracket === true || prev && prev.type === "bracket" && prev.value.length === 1) {
        push({ type: "text", value, output: `\\${value}` });
        continue;
      }
      if (state.brackets === 0) {
        if (opts.strictBrackets === true) {
          throw new SyntaxError(syntaxError("opening", "["));
        }
        push({ type: "text", value, output: `\\${value}` });
        continue;
      }
      decrement("brackets");
      const prevValue = prev.value.slice(1);
      if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) {
        value = `/${value}`;
      }
      prev.value += value;
      append2({ value });
      if (opts.literalBrackets === false || utils$d.hasRegexChars(prevValue)) {
        continue;
      }
      const escaped2 = utils$d.escapeRegex(prev.value);
      state.output = state.output.slice(0, -prev.value.length);
      if (opts.literalBrackets === true) {
        state.output += escaped2;
        prev.value = escaped2;
        continue;
      }
      prev.value = `(${capture}${escaped2}|${prev.value})`;
      state.output += prev.value;
      continue;
    }
    if (value === "{" && opts.nobrace !== true) {
      increment2("braces");
      const open = {
        type: "brace",
        value,
        output: "(",
        outputIndex: state.output.length,
        tokensIndex: state.tokens.length
      };
      braces2.push(open);
      push(open);
      continue;
    }
    if (value === "}") {
      const brace = braces2[braces2.length - 1];
      if (opts.nobrace === true || !brace) {
        push({ type: "text", value, output: value });
        continue;
      }
      let output = ")";
      if (brace.dots === true) {
        const arr = tokens.slice();
        const range = [];
        for (let i2 = arr.length - 1; i2 >= 0; i2--) {
          tokens.pop();
          if (arr[i2].type === "brace") {
            break;
          }
          if (arr[i2].type !== "dots") {
            range.unshift(arr[i2].value);
          }
        }
        output = expandRange(range, opts);
        state.backtrack = true;
      }
      if (brace.comma !== true && brace.dots !== true) {
        const out2 = state.output.slice(0, brace.outputIndex);
        const toks = state.tokens.slice(brace.tokensIndex);
        brace.value = brace.output = "\\{";
        value = output = "\\}";
        state.output = out2;
        for (const t of toks) {
          state.output += t.output || t.value;
        }
      }
      push({ type: "brace", value, output });
      decrement("braces");
      braces2.pop();
      continue;
    }
    if (value === "|") {
      if (extglobs.length > 0) {
        extglobs[extglobs.length - 1].conditions++;
      }
      push({ type: "text", value });
      continue;
    }
    if (value === ",") {
      let output = value;
      const brace = braces2[braces2.length - 1];
      if (brace && stack[stack.length - 1] === "braces") {
        brace.comma = true;
        output = "|";
      }
      push({ type: "comma", value, output });
      continue;
    }
    if (value === "/") {
      if (prev.type === "dot" && state.index === state.start + 1) {
        state.start = state.index + 1;
        state.consumed = "";
        state.output = "";
        tokens.pop();
        prev = bos;
        continue;
      }
      push({ type: "slash", value, output: SLASH_LITERAL2 });
      continue;
    }
    if (value === ".") {
      if (state.braces > 0 && prev.type === "dot") {
        if (prev.value === ".") prev.output = DOT_LITERAL2;
        const brace = braces2[braces2.length - 1];
        prev.type = "dots";
        prev.output += value;
        prev.value += value;
        brace.dots = true;
        continue;
      }
      if (state.braces + state.parens === 0 && prev.type !== "bos" && prev.type !== "slash") {
        push({ type: "text", value, output: DOT_LITERAL2 });
        continue;
      }
      push({ type: "dot", value, output: DOT_LITERAL2 });
      continue;
    }
    if (value === "?") {
      const isGroup = prev && prev.value === "(";
      if (!isGroup && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
        extglobOpen("qmark", value);
        continue;
      }
      if (prev && prev.type === "paren") {
        const next = peek();
        let output = value;
        if (next === "<" && !utils$d.supportsLookbehinds()) {
          throw new Error("Node.js v10 or higher is required for regex lookbehinds");
        }
        if (prev.value === "(" && !/[!=<:]/.test(next) || next === "<" && !/<([!=]|\w+>)/.test(remaining())) {
          output = `\\${value}`;
        }
        push({ type: "text", value, output });
        continue;
      }
      if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
        push({ type: "qmark", value, output: QMARK_NO_DOT2 });
        continue;
      }
      push({ type: "qmark", value, output: QMARK2 });
      continue;
    }
    if (value === "!") {
      if (opts.noextglob !== true && peek() === "(") {
        if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
          extglobOpen("negate", value);
          continue;
        }
      }
      if (opts.nonegate !== true && state.index === 0) {
        negate();
        continue;
      }
    }
    if (value === "+") {
      if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
        extglobOpen("plus", value);
        continue;
      }
      if (prev && prev.value === "(" || opts.regex === false) {
        push({ type: "plus", value, output: PLUS_LITERAL2 });
        continue;
      }
      if (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace") || state.parens > 0) {
        push({ type: "plus", value });
        continue;
      }
      push({ type: "plus", value: PLUS_LITERAL2 });
      continue;
    }
    if (value === "@") {
      if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
        push({ type: "at", extglob: true, value, output: "" });
        continue;
      }
      push({ type: "text", value });
      continue;
    }
    if (value !== "*") {
      if (value === "$" || value === "^") {
        value = `\\${value}`;
      }
      const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
      if (match) {
        value += match[0];
        state.index += match[0].length;
      }
      push({ type: "text", value });
      continue;
    }
    if (prev && (prev.type === "globstar" || prev.star === true)) {
      prev.type = "star";
      prev.star = true;
      prev.value += value;
      prev.output = star;
      state.backtrack = true;
      state.globstar = true;
      consume(value);
      continue;
    }
    let rest = remaining();
    if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
      extglobOpen("star", value);
      continue;
    }
    if (prev.type === "star") {
      if (opts.noglobstar === true) {
        consume(value);
        continue;
      }
      const prior = prev.prev;
      const before = prior.prev;
      const isStart = prior.type === "slash" || prior.type === "bos";
      const afterStar = before && (before.type === "star" || before.type === "globstar");
      if (opts.bash === true && (!isStart || rest[0] && rest[0] !== "/")) {
        push({ type: "star", value, output: "" });
        continue;
      }
      const isBrace = state.braces > 0 && (prior.type === "comma" || prior.type === "brace");
      const isExtglob3 = extglobs.length && (prior.type === "pipe" || prior.type === "paren");
      if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob3) {
        push({ type: "star", value, output: "" });
        continue;
      }
      while (rest.slice(0, 3) === "/**") {
        const after = input[state.index + 4];
        if (after && after !== "/") {
          break;
        }
        rest = rest.slice(3);
        consume("/**", 3);
      }
      if (prior.type === "bos" && eos()) {
        prev.type = "globstar";
        prev.value += value;
        prev.output = globstar(opts);
        state.output = prev.output;
        state.globstar = true;
        consume(value);
        continue;
      }
      if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && eos()) {
        state.output = state.output.slice(0, -(prior.output + prev.output).length);
        prior.output = `(?:${prior.output}`;
        prev.type = "globstar";
        prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)");
        prev.value += value;
        state.globstar = true;
        state.output += prior.output + prev.output;
        consume(value);
        continue;
      }
      if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
        const end = rest[1] !== void 0 ? "|$" : "";
        state.output = state.output.slice(0, -(prior.output + prev.output).length);
        prior.output = `(?:${prior.output}`;
        prev.type = "globstar";
        prev.output = `${globstar(opts)}${SLASH_LITERAL2}|${SLASH_LITERAL2}${end})`;
        prev.value += value;
        state.output += prior.output + prev.output;
        state.globstar = true;
        consume(value + advance());
        push({ type: "slash", value: "/", output: "" });
        continue;
      }
      if (prior.type === "bos" && rest[0] === "/") {
        prev.type = "globstar";
        prev.value += value;
        prev.output = `(?:^|${SLASH_LITERAL2}|${globstar(opts)}${SLASH_LITERAL2})`;
        state.output = prev.output;
        state.globstar = true;
        consume(value + advance());
        push({ type: "slash", value: "/", output: "" });
        continue;
      }
      state.output = state.output.slice(0, -prev.output.length);
      prev.type = "globstar";
      prev.output = globstar(opts);
      prev.value += value;
      state.output += prev.output;
      state.globstar = true;
      consume(value);
      continue;
    }
    const token = { type: "star", value, output: star };
    if (opts.bash === true) {
      token.output = ".*?";
      if (prev.type === "bos" || prev.type === "slash") {
        token.output = nodot + token.output;
      }
      push(token);
      continue;
    }
    if (prev && (prev.type === "bracket" || prev.type === "paren") && opts.regex === true) {
      token.output = value;
      push(token);
      continue;
    }
    if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
      if (prev.type === "dot") {
        state.output += NO_DOT_SLASH2;
        prev.output += NO_DOT_SLASH2;
      } else if (opts.dot === true) {
        state.output += NO_DOTS_SLASH2;
        prev.output += NO_DOTS_SLASH2;
      } else {
        state.output += nodot;
        prev.output += nodot;
      }
      if (peek() !== "*") {
        state.output += ONE_CHAR2;
        prev.output += ONE_CHAR2;
      }
    }
    push(token);
  }
  while (state.brackets > 0) {
    if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
    state.output = utils$d.escapeLast(state.output, "[");
    decrement("brackets");
  }
  while (state.parens > 0) {
    if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", ")"));
    state.output = utils$d.escapeLast(state.output, "(");
    decrement("parens");
  }
  while (state.braces > 0) {
    if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "}"));
    state.output = utils$d.escapeLast(state.output, "{");
    decrement("braces");
  }
  if (opts.strictSlashes !== true && (prev.type === "star" || prev.type === "bracket")) {
    push({ type: "maybe_slash", value: "", output: `${SLASH_LITERAL2}?` });
  }
  if (state.backtrack === true) {
    state.output = "";
    for (const token of state.tokens) {
      state.output += token.output != null ? token.output : token.value;
      if (token.suffix) {
        state.output += token.suffix;
      }
    }
  }
  return state;
};
parse$4.fastpaths = (input, options) => {
  const opts = { ...options };
  const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
  const len = input.length;
  if (len > max) {
    throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
  }
  input = REPLACEMENTS[input] || input;
  const win32 = utils$d.isWindows(options);
  const {
    DOT_LITERAL: DOT_LITERAL2,
    SLASH_LITERAL: SLASH_LITERAL2,
    ONE_CHAR: ONE_CHAR2,
    DOTS_SLASH: DOTS_SLASH2,
    NO_DOT: NO_DOT2,
    NO_DOTS: NO_DOTS2,
    NO_DOTS_SLASH: NO_DOTS_SLASH2,
    STAR: STAR2,
    START_ANCHOR: START_ANCHOR2
  } = constants$2.globChars(win32);
  const nodot = opts.dot ? NO_DOTS2 : NO_DOT2;
  const slashDot = opts.dot ? NO_DOTS_SLASH2 : NO_DOT2;
  const capture = opts.capture ? "" : "?:";
  const state = { negated: false, prefix: "" };
  let star = opts.bash === true ? ".*?" : STAR2;
  if (opts.capture) {
    star = `(${star})`;
  }
  const globstar = (opts2) => {
    if (opts2.noglobstar === true) return star;
    return `(${capture}(?:(?!${START_ANCHOR2}${opts2.dot ? DOTS_SLASH2 : DOT_LITERAL2}).)*?)`;
  };
  const create = (str) => {
    switch (str) {
      case "*":
        return `${nodot}${ONE_CHAR2}${star}`;
      case ".*":
        return `${DOT_LITERAL2}${ONE_CHAR2}${star}`;
      case "*.*":
        return `${nodot}${star}${DOT_LITERAL2}${ONE_CHAR2}${star}`;
      case "*/*":
        return `${nodot}${star}${SLASH_LITERAL2}${ONE_CHAR2}${slashDot}${star}`;
      case "**":
        return nodot + globstar(opts);
      case "**/*":
        return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL2})?${slashDot}${ONE_CHAR2}${star}`;
      case "**/*.*":
        return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL2})?${slashDot}${star}${DOT_LITERAL2}${ONE_CHAR2}${star}`;
      case "**/.*":
        return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL2})?${DOT_LITERAL2}${ONE_CHAR2}${star}`;
      default: {
        const match = /^(.*?)\.(\w+)$/.exec(str);
        if (!match) return;
        const source2 = create(match[1]);
        if (!source2) return;
        return source2 + DOT_LITERAL2 + match[2];
      }
    }
  };
  const output = utils$d.removePrefix(input, state);
  let source = create(output);
  if (source && opts.strictSlashes !== true) {
    source += `${SLASH_LITERAL2}?`;
  }
  return source;
};
var parse_1$1 = parse$4;
const path$9 = path$d;
const scan = scan_1;
const parse$3 = parse_1$1;
const utils$c = utils$f;
const constants$1 = constants$3;
const isObject$2 = (val) => val && typeof val === "object" && !Array.isArray(val);
const picomatch$2 = (glob, options, returnState = false) => {
  if (Array.isArray(glob)) {
    const fns = glob.map((input) => picomatch$2(input, options, returnState));
    const arrayMatcher = (str) => {
      for (const isMatch of fns) {
        const state2 = isMatch(str);
        if (state2) return state2;
      }
      return false;
    };
    return arrayMatcher;
  }
  const isState = isObject$2(glob) && glob.tokens && glob.input;
  if (glob === "" || typeof glob !== "string" && !isState) {
    throw new TypeError("Expected pattern to be a non-empty string");
  }
  const opts = options || {};
  const posix = utils$c.isWindows(options);
  const regex = isState ? picomatch$2.compileRe(glob, options) : picomatch$2.makeRe(glob, options, false, true);
  const state = regex.state;
  delete regex.state;
  let isIgnored = () => false;
  if (opts.ignore) {
    const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null };
    isIgnored = picomatch$2(opts.ignore, ignoreOpts, returnState);
  }
  const matcher2 = (input, returnObject = false) => {
    const { isMatch, match, output } = picomatch$2.test(input, regex, options, { glob, posix });
    const result = { glob, state, regex, posix, input, output, match, isMatch };
    if (typeof opts.onResult === "function") {
      opts.onResult(result);
    }
    if (isMatch === false) {
      result.isMatch = false;
      return returnObject ? result : false;
    }
    if (isIgnored(input)) {
      if (typeof opts.onIgnore === "function") {
        opts.onIgnore(result);
      }
      result.isMatch = false;
      return returnObject ? result : false;
    }
    if (typeof opts.onMatch === "function") {
      opts.onMatch(result);
    }
    return returnObject ? result : true;
  };
  if (returnState) {
    matcher2.state = state;
  }
  return matcher2;
};
picomatch$2.test = (input, regex, options, { glob, posix } = {}) => {
  if (typeof input !== "string") {
    throw new TypeError("Expected input to be a string");
  }
  if (input === "") {
    return { isMatch: false, output: "" };
  }
  const opts = options || {};
  const format2 = opts.format || (posix ? utils$c.toPosixSlashes : null);
  let match = input === glob;
  let output = match && format2 ? format2(input) : input;
  if (match === false) {
    output = format2 ? format2(input) : input;
    match = output === glob;
  }
  if (match === false || opts.capture === true) {
    if (opts.matchBase === true || opts.basename === true) {
      match = picomatch$2.matchBase(input, regex, options, posix);
    } else {
      match = regex.exec(output);
    }
  }
  return { isMatch: Boolean(match), match, output };
};
picomatch$2.matchBase = (input, glob, options, posix = utils$c.isWindows(options)) => {
  const regex = glob instanceof RegExp ? glob : picomatch$2.makeRe(glob, options);
  return regex.test(path$9.basename(input));
};
picomatch$2.isMatch = (str, patterns, options) => picomatch$2(patterns, options)(str);
picomatch$2.parse = (pattern2, options) => {
  if (Array.isArray(pattern2)) return pattern2.map((p) => picomatch$2.parse(p, options));
  return parse$3(pattern2, { ...options, fastpaths: false });
};
picomatch$2.scan = (input, options) => scan(input, options);
picomatch$2.compileRe = (state, options, returnOutput = false, returnState = false) => {
  if (returnOutput === true) {
    return state.output;
  }
  const opts = options || {};
  const prepend = opts.contains ? "" : "^";
  const append2 = opts.contains ? "" : "$";
  let source = `${prepend}(?:${state.output})${append2}`;
  if (state && state.negated === true) {
    source = `^(?!${source}).*$`;
  }
  const regex = picomatch$2.toRegex(source, options);
  if (returnState === true) {
    regex.state = state;
  }
  return regex;
};
picomatch$2.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
  if (!input || typeof input !== "string") {
    throw new TypeError("Expected a non-empty string");
  }
  let parsed = { negated: false, fastpaths: true };
  if (options.fastpaths !== false && (input[0] === "." || input[0] === "*")) {
    parsed.output = parse$3.fastpaths(input, options);
  }
  if (!parsed.output) {
    parsed = parse$3(input, options);
  }
  return picomatch$2.compileRe(parsed, options, returnOutput, returnState);
};
picomatch$2.toRegex = (source, options) => {
  try {
    const opts = options || {};
    return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""));
  } catch (err) {
    if (options && options.debug === true) throw err;
    return /$^/;
  }
};
picomatch$2.constants = constants$1;
var picomatch_1 = picomatch$2;
var picomatch$1 = picomatch_1;
const util = require$$0$1;
const braces = braces_1;
const picomatch = picomatch$1;
const utils$b = utils$f;
const isEmptyString = (v) => v === "" || v === "./";
const hasBraces = (v) => {
  const index = v.indexOf("{");
  return index > -1 && v.indexOf("}", index) > -1;
};
const micromatch$1 = (list, patterns, options) => {
  patterns = [].concat(patterns);
  list = [].concat(list);
  let omit = /* @__PURE__ */ new Set();
  let keep = /* @__PURE__ */ new Set();
  let items = /* @__PURE__ */ new Set();
  let negatives = 0;
  let onResult = (state) => {
    items.add(state.output);
    if (options && options.onResult) {
      options.onResult(state);
    }
  };
  for (let i2 = 0; i2 < patterns.length; i2++) {
    let isMatch = picomatch(String(patterns[i2]), { ...options, onResult }, true);
    let negated = isMatch.state.negated || isMatch.state.negatedExtglob;
    if (negated) negatives++;
    for (let item of list) {
      let matched = isMatch(item, true);
      let match = negated ? !matched.isMatch : matched.isMatch;
      if (!match) continue;
      if (negated) {
        omit.add(matched.output);
      } else {
        omit.delete(matched.output);
        keep.add(matched.output);
      }
    }
  }
  let result = negatives === patterns.length ? [...items] : [...keep];
  let matches = result.filter((item) => !omit.has(item));
  if (options && matches.length === 0) {
    if (options.failglob === true) {
      throw new Error(`No matches found for "${patterns.join(", ")}"`);
    }
    if (options.nonull === true || options.nullglob === true) {
      return options.unescape ? patterns.map((p) => p.replace(/\\/g, "")) : patterns;
    }
  }
  return matches;
};
micromatch$1.match = micromatch$1;
micromatch$1.matcher = (pattern2, options) => picomatch(pattern2, options);
micromatch$1.isMatch = (str, patterns, options) => picomatch(patterns, options)(str);
micromatch$1.any = micromatch$1.isMatch;
micromatch$1.not = (list, patterns, options = {}) => {
  patterns = [].concat(patterns).map(String);
  let result = /* @__PURE__ */ new Set();
  let items = [];
  let onResult = (state) => {
    if (options.onResult) options.onResult(state);
    items.push(state.output);
  };
  let matches = new Set(micromatch$1(list, patterns, { ...options, onResult }));
  for (let item of items) {
    if (!matches.has(item)) {
      result.add(item);
    }
  }
  return [...result];
};
micromatch$1.contains = (str, pattern2, options) => {
  if (typeof str !== "string") {
    throw new TypeError(`Expected a string: "${util.inspect(str)}"`);
  }
  if (Array.isArray(pattern2)) {
    return pattern2.some((p) => micromatch$1.contains(str, p, options));
  }
  if (typeof pattern2 === "string") {
    if (isEmptyString(str) || isEmptyString(pattern2)) {
      return false;
    }
    if (str.includes(pattern2) || str.startsWith("./") && str.slice(2).includes(pattern2)) {
      return true;
    }
  }
  return micromatch$1.isMatch(str, pattern2, { ...options, contains: true });
};
micromatch$1.matchKeys = (obj, patterns, options) => {
  if (!utils$b.isObject(obj)) {
    throw new TypeError("Expected the first argument to be an object");
  }
  let keys = micromatch$1(Object.keys(obj), patterns, options);
  let res = {};
  for (let key of keys) res[key] = obj[key];
  return res;
};
micromatch$1.some = (list, patterns, options) => {
  let items = [].concat(list);
  for (let pattern2 of [].concat(patterns)) {
    let isMatch = picomatch(String(pattern2), options);
    if (items.some((item) => isMatch(item))) {
      return true;
    }
  }
  return false;
};
micromatch$1.every = (list, patterns, options) => {
  let items = [].concat(list);
  for (let pattern2 of [].concat(patterns)) {
    let isMatch = picomatch(String(pattern2), options);
    if (!items.every((item) => isMatch(item))) {
      return false;
    }
  }
  return true;
};
micromatch$1.all = (str, patterns, options) => {
  if (typeof str !== "string") {
    throw new TypeError(`Expected a string: "${util.inspect(str)}"`);
  }
  return [].concat(patterns).every((p) => picomatch(p, options)(str));
};
micromatch$1.capture = (glob, input, options) => {
  let posix = utils$b.isWindows(options);
  let regex = picomatch.makeRe(String(glob), { ...options, capture: true });
  let match = regex.exec(posix ? utils$b.toPosixSlashes(input) : input);
  if (match) {
    return match.slice(1).map((v) => v === void 0 ? "" : v);
  }
};
micromatch$1.makeRe = (...args) => picomatch.makeRe(...args);
micromatch$1.scan = (...args) => picomatch.scan(...args);
micromatch$1.parse = (patterns, options) => {
  let res = [];
  for (let pattern2 of [].concat(patterns || [])) {
    for (let str of braces(String(pattern2), options)) {
      res.push(picomatch.parse(str, options));
    }
  }
  return res;
};
micromatch$1.braces = (pattern2, options) => {
  if (typeof pattern2 !== "string") throw new TypeError("Expected a string");
  if (options && options.nobrace === true || !hasBraces(pattern2)) {
    return [pattern2];
  }
  return braces(pattern2, options);
};
micromatch$1.braceExpand = (pattern2, options) => {
  if (typeof pattern2 !== "string") throw new TypeError("Expected a string");
  return micromatch$1.braces(pattern2, { ...options, expand: true });
};
micromatch$1.hasBraces = hasBraces;
var micromatch_1 = micromatch$1;
Object.defineProperty(pattern$1, "__esModule", { value: true });
pattern$1.isAbsolute = pattern$1.partitionAbsoluteAndRelative = pattern$1.removeDuplicateSlashes = pattern$1.matchAny = pattern$1.convertPatternsToRe = pattern$1.makeRe = pattern$1.getPatternParts = pattern$1.expandBraceExpansion = pattern$1.expandPatternsWithBraceExpansion = pattern$1.isAffectDepthOfReadingPattern = pattern$1.endsWithSlashGlobStar = pattern$1.hasGlobStar = pattern$1.getBaseDirectory = pattern$1.isPatternRelatedToParentDirectory = pattern$1.getPatternsOutsideCurrentDirectory = pattern$1.getPatternsInsideCurrentDirectory = pattern$1.getPositivePatterns = pattern$1.getNegativePatterns = pattern$1.isPositivePattern = pattern$1.isNegativePattern = pattern$1.convertToNegativePattern = pattern$1.convertToPositivePattern = pattern$1.isDynamicPattern = pattern$1.isStaticPattern = void 0;
const path$8 = path$d;
const globParent2 = globParent$1;
const micromatch = micromatch_1;
const GLOBSTAR = "**";
const ESCAPE_SYMBOL = "\\";
const COMMON_GLOB_SYMBOLS_RE = /[*?]|^!/;
const REGEX_CHARACTER_CLASS_SYMBOLS_RE = /\[[^[]*]/;
const REGEX_GROUP_SYMBOLS_RE = /(?:^|[^!*+?@])\([^(]*\|[^|]*\)/;
const GLOB_EXTENSION_SYMBOLS_RE = /[!*+?@]\([^(]*\)/;
const BRACE_EXPANSION_SEPARATORS_RE = /,|\.\./;
const DOUBLE_SLASH_RE = /(?!^)\/{2,}/g;
function isStaticPattern(pattern2, options = {}) {
  return !isDynamicPattern(pattern2, options);
}
pattern$1.isStaticPattern = isStaticPattern;
function isDynamicPattern(pattern2, options = {}) {
  if (pattern2 === "") {
    return false;
  }
  if (options.caseSensitiveMatch === false || pattern2.includes(ESCAPE_SYMBOL)) {
    return true;
  }
  if (COMMON_GLOB_SYMBOLS_RE.test(pattern2) || REGEX_CHARACTER_CLASS_SYMBOLS_RE.test(pattern2) || REGEX_GROUP_SYMBOLS_RE.test(pattern2)) {
    return true;
  }
  if (options.extglob !== false && GLOB_EXTENSION_SYMBOLS_RE.test(pattern2)) {
    return true;
  }
  if (options.braceExpansion !== false && hasBraceExpansion(pattern2)) {
    return true;
  }
  return false;
}
pattern$1.isDynamicPattern = isDynamicPattern;
function hasBraceExpansion(pattern2) {
  const openingBraceIndex = pattern2.indexOf("{");
  if (openingBraceIndex === -1) {
    return false;
  }
  const closingBraceIndex = pattern2.indexOf("}", openingBraceIndex + 1);
  if (closingBraceIndex === -1) {
    return false;
  }
  const braceContent = pattern2.slice(openingBraceIndex, closingBraceIndex);
  return BRACE_EXPANSION_SEPARATORS_RE.test(braceContent);
}
function convertToPositivePattern(pattern2) {
  return isNegativePattern(pattern2) ? pattern2.slice(1) : pattern2;
}
pattern$1.convertToPositivePattern = convertToPositivePattern;
function convertToNegativePattern(pattern2) {
  return "!" + pattern2;
}
pattern$1.convertToNegativePattern = convertToNegativePattern;
function isNegativePattern(pattern2) {
  return pattern2.startsWith("!") && pattern2[1] !== "(";
}
pattern$1.isNegativePattern = isNegativePattern;
function isPositivePattern(pattern2) {
  return !isNegativePattern(pattern2);
}
pattern$1.isPositivePattern = isPositivePattern;
function getNegativePatterns(patterns) {
  return patterns.filter(isNegativePattern);
}
pattern$1.getNegativePatterns = getNegativePatterns;
function getPositivePatterns$1(patterns) {
  return patterns.filter(isPositivePattern);
}
pattern$1.getPositivePatterns = getPositivePatterns$1;
function getPatternsInsideCurrentDirectory(patterns) {
  return patterns.filter((pattern2) => !isPatternRelatedToParentDirectory(pattern2));
}
pattern$1.getPatternsInsideCurrentDirectory = getPatternsInsideCurrentDirectory;
function getPatternsOutsideCurrentDirectory(patterns) {
  return patterns.filter(isPatternRelatedToParentDirectory);
}
pattern$1.getPatternsOutsideCurrentDirectory = getPatternsOutsideCurrentDirectory;
function isPatternRelatedToParentDirectory(pattern2) {
  return pattern2.startsWith("..") || pattern2.startsWith("./..");
}
pattern$1.isPatternRelatedToParentDirectory = isPatternRelatedToParentDirectory;
function getBaseDirectory(pattern2) {
  return globParent2(pattern2, { flipBackslashes: false });
}
pattern$1.getBaseDirectory = getBaseDirectory;
function hasGlobStar(pattern2) {
  return pattern2.includes(GLOBSTAR);
}
pattern$1.hasGlobStar = hasGlobStar;
function endsWithSlashGlobStar(pattern2) {
  return pattern2.endsWith("/" + GLOBSTAR);
}
pattern$1.endsWithSlashGlobStar = endsWithSlashGlobStar;
function isAffectDepthOfReadingPattern(pattern2) {
  const basename = path$8.basename(pattern2);
  return endsWithSlashGlobStar(pattern2) || isStaticPattern(basename);
}
pattern$1.isAffectDepthOfReadingPattern = isAffectDepthOfReadingPattern;
function expandPatternsWithBraceExpansion(patterns) {
  return patterns.reduce((collection, pattern2) => {
    return collection.concat(expandBraceExpansion(pattern2));
  }, []);
}
pattern$1.expandPatternsWithBraceExpansion = expandPatternsWithBraceExpansion;
function expandBraceExpansion(pattern2) {
  const patterns = micromatch.braces(pattern2, { expand: true, nodupes: true, keepEscaping: true });
  patterns.sort((a2, b) => a2.length - b.length);
  return patterns.filter((pattern3) => pattern3 !== "");
}
pattern$1.expandBraceExpansion = expandBraceExpansion;
function getPatternParts(pattern2, options) {
  let { parts } = micromatch.scan(pattern2, Object.assign(Object.assign({}, options), { parts: true }));
  if (parts.length === 0) {
    parts = [pattern2];
  }
  if (parts[0].startsWith("/")) {
    parts[0] = parts[0].slice(1);
    parts.unshift("");
  }
  return parts;
}
pattern$1.getPatternParts = getPatternParts;
function makeRe(pattern2, options) {
  return micromatch.makeRe(pattern2, options);
}
pattern$1.makeRe = makeRe;
function convertPatternsToRe(patterns, options) {
  return patterns.map((pattern2) => makeRe(pattern2, options));
}
pattern$1.convertPatternsToRe = convertPatternsToRe;
function matchAny(entry2, patternsRe) {
  return patternsRe.some((patternRe) => patternRe.test(entry2));
}
pattern$1.matchAny = matchAny;
function removeDuplicateSlashes(pattern2) {
  return pattern2.replace(DOUBLE_SLASH_RE, "/");
}
pattern$1.removeDuplicateSlashes = removeDuplicateSlashes;
function partitionAbsoluteAndRelative(patterns) {
  const absolute = [];
  const relative = [];
  for (const pattern2 of patterns) {
    if (isAbsolute(pattern2)) {
      absolute.push(pattern2);
    } else {
      relative.push(pattern2);
    }
  }
  return [absolute, relative];
}
pattern$1.partitionAbsoluteAndRelative = partitionAbsoluteAndRelative;
function isAbsolute(pattern2) {
  return path$8.isAbsolute(pattern2);
}
pattern$1.isAbsolute = isAbsolute;
var stream$4 = {};
const Stream = require$$0$2;
const PassThrough = Stream.PassThrough;
const slice = Array.prototype.slice;
var merge2_1 = merge2$1;
function merge2$1() {
  const streamsQueue = [];
  const args = slice.call(arguments);
  let merging = false;
  let options = args[args.length - 1];
  if (options && !Array.isArray(options) && options.pipe == null) {
    args.pop();
  } else {
    options = {};
  }
  const doEnd = options.end !== false;
  const doPipeError = options.pipeError === true;
  if (options.objectMode == null) {
    options.objectMode = true;
  }
  if (options.highWaterMark == null) {
    options.highWaterMark = 64 * 1024;
  }
  const mergedStream = PassThrough(options);
  function addStream() {
    for (let i2 = 0, len = arguments.length; i2 < len; i2++) {
      streamsQueue.push(pauseStreams(arguments[i2], options));
    }
    mergeStream();
    return this;
  }
  function mergeStream() {
    if (merging) {
      return;
    }
    merging = true;
    let streams = streamsQueue.shift();
    if (!streams) {
      process.nextTick(endStream2);
      return;
    }
    if (!Array.isArray(streams)) {
      streams = [streams];
    }
    let pipesCount = streams.length + 1;
    function next() {
      if (--pipesCount > 0) {
        return;
      }
      merging = false;
      mergeStream();
    }
    function pipe(stream2) {
      function onend() {
        stream2.removeListener("merge2UnpipeEnd", onend);
        stream2.removeListener("end", onend);
        if (doPipeError) {
          stream2.removeListener("error", onerror);
        }
        next();
      }
      function onerror(err) {
        mergedStream.emit("error", err);
      }
      if (stream2._readableState.endEmitted) {
        return next();
      }
      stream2.on("merge2UnpipeEnd", onend);
      stream2.on("end", onend);
      if (doPipeError) {
        stream2.on("error", onerror);
      }
      stream2.pipe(mergedStream, { end: false });
      stream2.resume();
    }
    for (let i2 = 0; i2 < streams.length; i2++) {
      pipe(streams[i2]);
    }
    next();
  }
  function endStream2() {
    merging = false;
    mergedStream.emit("queueDrain");
    if (doEnd) {
      mergedStream.end();
    }
  }
  mergedStream.setMaxListeners(0);
  mergedStream.add = addStream;
  mergedStream.on("unpipe", function(stream2) {
    stream2.emit("merge2UnpipeEnd");
  });
  if (args.length) {
    addStream.apply(null, args);
  }
  return mergedStream;
}
function pauseStreams(streams, options) {
  if (!Array.isArray(streams)) {
    if (!streams._readableState && streams.pipe) {
      streams = streams.pipe(PassThrough(options));
    }
    if (!streams._readableState || !streams.pause || !streams.pipe) {
      throw new Error("Only readable stream can be merged.");
    }
    streams.pause();
  } else {
    for (let i2 = 0, len = streams.length; i2 < len; i2++) {
      streams[i2] = pauseStreams(streams[i2], options);
    }
  }
  return streams;
}
Object.defineProperty(stream$4, "__esModule", { value: true });
stream$4.merge = void 0;
const merge2 = merge2_1;
function merge(streams) {
  const mergedStream = merge2(streams);
  streams.forEach((stream2) => {
    stream2.once("error", (error2) => mergedStream.emit("error", error2));
  });
  mergedStream.once("close", () => propagateCloseEventToSources(streams));
  mergedStream.once("end", () => propagateCloseEventToSources(streams));
  return mergedStream;
}
stream$4.merge = merge;
function propagateCloseEventToSources(streams) {
  streams.forEach((stream2) => stream2.emit("close"));
}
var string$1 = {};
Object.defineProperty(string$1, "__esModule", { value: true });
string$1.isEmpty = string$1.isString = void 0;
function isString$1(input) {
  return typeof input === "string";
}
string$1.isString = isString$1;
function isEmpty(input) {
  return input === "";
}
string$1.isEmpty = isEmpty;
Object.defineProperty(utils$k, "__esModule", { value: true });
utils$k.string = utils$k.stream = utils$k.pattern = utils$k.path = utils$k.fs = utils$k.errno = utils$k.array = void 0;
const array = array$1;
utils$k.array = array;
const errno = errno$1;
utils$k.errno = errno;
const fs$7 = fs$8;
utils$k.fs = fs$7;
const path$7 = path$c;
utils$k.path = path$7;
const pattern = pattern$1;
utils$k.pattern = pattern;
const stream$3 = stream$4;
utils$k.stream = stream$3;
const string = string$1;
utils$k.string = string;
Object.defineProperty(tasks, "__esModule", { value: true });
tasks.convertPatternGroupToTask = tasks.convertPatternGroupsToTasks = tasks.groupPatternsByBaseDirectory = tasks.getNegativePatternsAsPositive = tasks.getPositivePatterns = tasks.convertPatternsToTasks = tasks.generate = void 0;
const utils$a = utils$k;
function generate(input, settings2) {
  const patterns = processPatterns(input, settings2);
  const ignore = processPatterns(settings2.ignore, settings2);
  const positivePatterns = getPositivePatterns(patterns);
  const negativePatterns = getNegativePatternsAsPositive(patterns, ignore);
  const staticPatterns = positivePatterns.filter((pattern2) => utils$a.pattern.isStaticPattern(pattern2, settings2));
  const dynamicPatterns = positivePatterns.filter((pattern2) => utils$a.pattern.isDynamicPattern(pattern2, settings2));
  const staticTasks = convertPatternsToTasks(
    staticPatterns,
    negativePatterns,
    /* dynamic */
    false
  );
  const dynamicTasks = convertPatternsToTasks(
    dynamicPatterns,
    negativePatterns,
    /* dynamic */
    true
  );
  return staticTasks.concat(dynamicTasks);
}
tasks.generate = generate;
function processPatterns(input, settings2) {
  let patterns = input;
  if (settings2.braceExpansion) {
    patterns = utils$a.pattern.expandPatternsWithBraceExpansion(patterns);
  }
  if (settings2.baseNameMatch) {
    patterns = patterns.map((pattern2) => pattern2.includes("/") ? pattern2 : `**/${pattern2}`);
  }
  return patterns.map((pattern2) => utils$a.pattern.removeDuplicateSlashes(pattern2));
}
function convertPatternsToTasks(positive, negative, dynamic) {
  const tasks2 = [];
  const patternsOutsideCurrentDirectory = utils$a.pattern.getPatternsOutsideCurrentDirectory(positive);
  const patternsInsideCurrentDirectory = utils$a.pattern.getPatternsInsideCurrentDirectory(positive);
  const outsideCurrentDirectoryGroup = groupPatternsByBaseDirectory(patternsOutsideCurrentDirectory);
  const insideCurrentDirectoryGroup = groupPatternsByBaseDirectory(patternsInsideCurrentDirectory);
  tasks2.push(...convertPatternGroupsToTasks(outsideCurrentDirectoryGroup, negative, dynamic));
  if ("." in insideCurrentDirectoryGroup) {
    tasks2.push(convertPatternGroupToTask(".", patternsInsideCurrentDirectory, negative, dynamic));
  } else {
    tasks2.push(...convertPatternGroupsToTasks(insideCurrentDirectoryGroup, negative, dynamic));
  }
  return tasks2;
}
tasks.convertPatternsToTasks = convertPatternsToTasks;
function getPositivePatterns(patterns) {
  return utils$a.pattern.getPositivePatterns(patterns);
}
tasks.getPositivePatterns = getPositivePatterns;
function getNegativePatternsAsPositive(patterns, ignore) {
  const negative = utils$a.pattern.getNegativePatterns(patterns).concat(ignore);
  const positive = negative.map(utils$a.pattern.convertToPositivePattern);
  return positive;
}
tasks.getNegativePatternsAsPositive = getNegativePatternsAsPositive;
function groupPatternsByBaseDirectory(patterns) {
  const group = {};
  return patterns.reduce((collection, pattern2) => {
    const base = utils$a.pattern.getBaseDirectory(pattern2);
    if (base in collection) {
      collection[base].push(pattern2);
    } else {
      collection[base] = [pattern2];
    }
    return collection;
  }, group);
}
tasks.groupPatternsByBaseDirectory = groupPatternsByBaseDirectory;
function convertPatternGroupsToTasks(positive, negative, dynamic) {
  return Object.keys(positive).map((base) => {
    return convertPatternGroupToTask(base, positive[base], negative, dynamic);
  });
}
tasks.convertPatternGroupsToTasks = convertPatternGroupsToTasks;
function convertPatternGroupToTask(base, positive, negative, dynamic) {
  return {
    dynamic,
    positive,
    negative,
    base,
    patterns: [].concat(positive, negative.map(utils$a.pattern.convertToNegativePattern))
  };
}
tasks.convertPatternGroupToTask = convertPatternGroupToTask;
var async$7 = {};
var async$6 = {};
var out$3 = {};
var async$5 = {};
var async$4 = {};
var out$2 = {};
var async$3 = {};
var out$1 = {};
var async$2 = {};
Object.defineProperty(async$2, "__esModule", { value: true });
async$2.read = void 0;
function read$3(path2, settings2, callback) {
  settings2.fs.lstat(path2, (lstatError, lstat) => {
    if (lstatError !== null) {
      callFailureCallback$2(callback, lstatError);
      return;
    }
    if (!lstat.isSymbolicLink() || !settings2.followSymbolicLink) {
      callSuccessCallback$2(callback, lstat);
      return;
    }
    settings2.fs.stat(path2, (statError, stat2) => {
      if (statError !== null) {
        if (settings2.throwErrorOnBrokenSymbolicLink) {
          callFailureCallback$2(callback, statError);
          return;
        }
        callSuccessCallback$2(callback, lstat);
        return;
      }
      if (settings2.markSymbolicLink) {
        stat2.isSymbolicLink = () => true;
      }
      callSuccessCallback$2(callback, stat2);
    });
  });
}
async$2.read = read$3;
function callFailureCallback$2(callback, error2) {
  callback(error2);
}
function callSuccessCallback$2(callback, result) {
  callback(null, result);
}
var sync$8 = {};
Object.defineProperty(sync$8, "__esModule", { value: true });
sync$8.read = void 0;
function read$2(path2, settings2) {
  const lstat = settings2.fs.lstatSync(path2);
  if (!lstat.isSymbolicLink() || !settings2.followSymbolicLink) {
    return lstat;
  }
  try {
    const stat2 = settings2.fs.statSync(path2);
    if (settings2.markSymbolicLink) {
      stat2.isSymbolicLink = () => true;
    }
    return stat2;
  } catch (error2) {
    if (!settings2.throwErrorOnBrokenSymbolicLink) {
      return lstat;
    }
    throw error2;
  }
}
sync$8.read = read$2;
var settings$3 = {};
var fs$6 = {};
(function(exports$1) {
  Object.defineProperty(exports$1, "__esModule", { value: true });
  exports$1.createFileSystemAdapter = exports$1.FILE_SYSTEM_ADAPTER = void 0;
  const fs2 = require$$0$3;
  exports$1.FILE_SYSTEM_ADAPTER = {
    lstat: fs2.lstat,
    stat: fs2.stat,
    lstatSync: fs2.lstatSync,
    statSync: fs2.statSync
  };
  function createFileSystemAdapter(fsMethods) {
    if (fsMethods === void 0) {
      return exports$1.FILE_SYSTEM_ADAPTER;
    }
    return Object.assign(Object.assign({}, exports$1.FILE_SYSTEM_ADAPTER), fsMethods);
  }
  exports$1.createFileSystemAdapter = createFileSystemAdapter;
})(fs$6);
Object.defineProperty(settings$3, "__esModule", { value: true });
const fs$5 = fs$6;
let Settings$2 = class Settings {
  constructor(_options = {}) {
    this._options = _options;
    this.followSymbolicLink = this._getValue(this._options.followSymbolicLink, true);
    this.fs = fs$5.createFileSystemAdapter(this._options.fs);
    this.markSymbolicLink = this._getValue(this._options.markSymbolicLink, false);
    this.throwErrorOnBrokenSymbolicLink = this._getValue(this._options.throwErrorOnBrokenSymbolicLink, true);
  }
  _getValue(option, value) {
    return option !== null && option !== void 0 ? option : value;
  }
};
settings$3.default = Settings$2;
Object.defineProperty(out$1, "__esModule", { value: true });
out$1.statSync = out$1.stat = out$1.Settings = void 0;
const async$1 = async$2;
const sync$7 = sync$8;
const settings_1$3 = settings$3;
out$1.Settings = settings_1$3.default;
function stat(path2, optionsOrSettingsOrCallback, callback) {
  if (typeof optionsOrSettingsOrCallback === "function") {
    async$1.read(path2, getSettings$2(), optionsOrSettingsOrCallback);
    return;
  }
  async$1.read(path2, getSettings$2(optionsOrSettingsOrCallback), callback);
}
out$1.stat = stat;
function statSync(path2, optionsOrSettings) {
  const settings2 = getSettings$2(optionsOrSettings);
  return sync$7.read(path2, settings2);
}
out$1.statSync = statSync;
function getSettings$2(settingsOrOptions = {}) {
  if (settingsOrOptions instanceof settings_1$3.default) {
    return settingsOrOptions;
  }
  return new settings_1$3.default(settingsOrOptions);
}
/*! queue-microtask. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
let promise;
var queueMicrotask_1 = typeof queueMicrotask === "function" ? queueMicrotask.bind(typeof window !== "undefined" ? window : commonjsGlobal) : (cb) => (promise || (promise = Promise.resolve())).then(cb).catch((err) => setTimeout(() => {
  throw err;
}, 0));
/*! run-parallel. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
var runParallel_1 = runParallel;
const queueMicrotask$1 = queueMicrotask_1;
function runParallel(tasks2, cb) {
  let results, pending, keys;
  let isSync = true;
  if (Array.isArray(tasks2)) {
    results = [];
    pending = tasks2.length;
  } else {
    keys = Object.keys(tasks2);
    results = {};
    pending = keys.length;
  }
  function done(err) {
    function end() {
      if (cb) cb(err, results);
      cb = null;
    }
    if (isSync) queueMicrotask$1(end);
    else end();
  }
  function each(i2, err, result) {
    results[i2] = result;
    if (--pending === 0 || err) {
      done(err);
    }
  }
  if (!pending) {
    done(null);
  } else if (keys) {
    keys.forEach(function(key) {
      tasks2[key](function(err, result) {
        each(key, err, result);
      });
    });
  } else {
    tasks2.forEach(function(task, i2) {
      task(function(err, result) {
        each(i2, err, result);
      });
    });
  }
  isSync = false;
}
var constants = {};
Object.defineProperty(constants, "__esModule", { value: true });
constants.IS_SUPPORT_READDIR_WITH_FILE_TYPES = void 0;
const NODE_PROCESS_VERSION_PARTS = process.versions.node.split(".");
if (NODE_PROCESS_VERSION_PARTS[0] === void 0 || NODE_PROCESS_VERSION_PARTS[1] === void 0) {
  throw new Error(`Unexpected behavior. The 'process.versions.node' variable has invalid value: ${process.versions.node}`);
}
const MAJOR_VERSION = Number.parseInt(NODE_PROCESS_VERSION_PARTS[0], 10);
const MINOR_VERSION = Number.parseInt(NODE_PROCESS_VERSION_PARTS[1], 10);
const SUPPORTED_MAJOR_VERSION = 10;
const SUPPORTED_MINOR_VERSION = 10;
const IS_MATCHED_BY_MAJOR = MAJOR_VERSION > SUPPORTED_MAJOR_VERSION;
const IS_MATCHED_BY_MAJOR_AND_MINOR = MAJOR_VERSION === SUPPORTED_MAJOR_VERSION && MINOR_VERSION >= SUPPORTED_MINOR_VERSION;
constants.IS_SUPPORT_READDIR_WITH_FILE_TYPES = IS_MATCHED_BY_MAJOR || IS_MATCHED_BY_MAJOR_AND_MINOR;
var utils$9 = {};
var fs$4 = {};
Object.defineProperty(fs$4, "__esModule", { value: true });
fs$4.createDirentFromStats = void 0;
class DirentFromStats2 {
  constructor(name, stats) {
    this.name = name;
    this.isBlockDevice = stats.isBlockDevice.bind(stats);
    this.isCharacterDevice = stats.isCharacterDevice.bind(stats);
    this.isDirectory = stats.isDirectory.bind(stats);
    this.isFIFO = stats.isFIFO.bind(stats);
    this.isFile = stats.isFile.bind(stats);
    this.isSocket = stats.isSocket.bind(stats);
    this.isSymbolicLink = stats.isSymbolicLink.bind(stats);
  }
}
function createDirentFromStats(name, stats) {
  return new DirentFromStats2(name, stats);
}
fs$4.createDirentFromStats = createDirentFromStats;
Object.defineProperty(utils$9, "__esModule", { value: true });
utils$9.fs = void 0;
const fs$3 = fs$4;
utils$9.fs = fs$3;
var common$7 = {};
Object.defineProperty(common$7, "__esModule", { value: true });
common$7.joinPathSegments = void 0;
function joinPathSegments$1(a2, b, separator) {
  if (a2.endsWith(separator)) {
    return a2 + b;
  }
  return a2 + separator + b;
}
common$7.joinPathSegments = joinPathSegments$1;
Object.defineProperty(async$3, "__esModule", { value: true });
async$3.readdir = async$3.readdirWithFileTypes = async$3.read = void 0;
const fsStat$5 = out$1;
const rpl = runParallel_1;
const constants_1$1 = constants;
const utils$8 = utils$9;
const common$6 = common$7;
function read$1(directory, settings2, callback) {
  if (!settings2.stats && constants_1$1.IS_SUPPORT_READDIR_WITH_FILE_TYPES) {
    readdirWithFileTypes$1(directory, settings2, callback);
    return;
  }
  readdir$1(directory, settings2, callback);
}
async$3.read = read$1;
function readdirWithFileTypes$1(directory, settings2, callback) {
  settings2.fs.readdir(directory, { withFileTypes: true }, (readdirError, dirents) => {
    if (readdirError !== null) {
      callFailureCallback$1(callback, readdirError);
      return;
    }
    const entries = dirents.map((dirent) => ({
      dirent,
      name: dirent.name,
      path: common$6.joinPathSegments(directory, dirent.name, settings2.pathSegmentSeparator)
    }));
    if (!settings2.followSymbolicLinks) {
      callSuccessCallback$1(callback, entries);
      return;
    }
    const tasks2 = entries.map((entry2) => makeRplTaskEntry(entry2, settings2));
    rpl(tasks2, (rplError, rplEntries) => {
      if (rplError !== null) {
        callFailureCallback$1(callback, rplError);
        return;
      }
      callSuccessCallback$1(callback, rplEntries);
    });
  });
}
async$3.readdirWithFileTypes = readdirWithFileTypes$1;
function makeRplTaskEntry(entry2, settings2) {
  return (done) => {
    if (!entry2.dirent.isSymbolicLink()) {
      done(null, entry2);
      return;
    }
    settings2.fs.stat(entry2.path, (statError, stats) => {
      if (statError !== null) {
        if (settings2.throwErrorOnBrokenSymbolicLink) {
          done(statError);
          return;
        }
        done(null, entry2);
        return;
      }
      entry2.dirent = utils$8.fs.createDirentFromStats(entry2.name, stats);
      done(null, entry2);
    });
  };
}
function readdir$1(directory, settings2, callback) {
  settings2.fs.readdir(directory, (readdirError, names) => {
    if (readdirError !== null) {
      callFailureCallback$1(callback, readdirError);
      return;
    }
    const tasks2 = names.map((name) => {
      const path2 = common$6.joinPathSegments(directory, name, settings2.pathSegmentSeparator);
      return (done) => {
        fsStat$5.stat(path2, settings2.fsStatSettings, (error2, stats) => {
          if (error2 !== null) {
            done(error2);
            return;
          }
          const entry2 = {
            name,
            path: path2,
            dirent: utils$8.fs.createDirentFromStats(name, stats)
          };
          if (settings2.stats) {
            entry2.stats = stats;
          }
          done(null, entry2);
        });
      };
    });
    rpl(tasks2, (rplError, entries) => {
      if (rplError !== null) {
        callFailureCallback$1(callback, rplError);
        return;
      }
      callSuccessCallback$1(callback, entries);
    });
  });
}
async$3.readdir = readdir$1;
function callFailureCallback$1(callback, error2) {
  callback(error2);
}
function callSuccessCallback$1(callback, result) {
  callback(null, result);
}
var sync$6 = {};
Object.defineProperty(sync$6, "__esModule", { value: true });
sync$6.readdir = sync$6.readdirWithFileTypes = sync$6.read = void 0;
const fsStat$4 = out$1;
const constants_1 = constants;
const utils$7 = utils$9;
const common$5 = common$7;
function read(directory, settings2) {
  if (!settings2.stats && constants_1.IS_SUPPORT_READDIR_WITH_FILE_TYPES) {
    return readdirWithFileTypes(directory, settings2);
  }
  return readdir(directory, settings2);
}
sync$6.read = read;
function readdirWithFileTypes(directory, settings2) {
  const dirents = settings2.fs.readdirSync(directory, { withFileTypes: true });
  return dirents.map((dirent) => {
    const entry2 = {
      dirent,
      name: dirent.name,
      path: common$5.joinPathSegments(directory, dirent.name, settings2.pathSegmentSeparator)
    };
    if (entry2.dirent.isSymbolicLink() && settings2.followSymbolicLinks) {
      try {
        const stats = settings2.fs.statSync(entry2.path);
        entry2.dirent = utils$7.fs.createDirentFromStats(entry2.name, stats);
      } catch (error2) {
        if (settings2.throwErrorOnBrokenSymbolicLink) {
          throw error2;
        }
      }
    }
    return entry2;
  });
}
sync$6.readdirWithFileTypes = readdirWithFileTypes;
function readdir(directory, settings2) {
  const names = settings2.fs.readdirSync(directory);
  return names.map((name) => {
    const entryPath = common$5.joinPathSegments(directory, name, settings2.pathSegmentSeparator);
    const stats = fsStat$4.statSync(entryPath, settings2.fsStatSettings);
    const entry2 = {
      name,
      path: entryPath,
      dirent: utils$7.fs.createDirentFromStats(name, stats)
    };
    if (settings2.stats) {
      entry2.stats = stats;
    }
    return entry2;
  });
}
sync$6.readdir = readdir;
var settings$2 = {};
var fs$2 = {};
(function(exports$1) {
  Object.defineProperty(exports$1, "__esModule", { value: true });
  exports$1.createFileSystemAdapter = exports$1.FILE_SYSTEM_ADAPTER = void 0;
  const fs2 = require$$0$3;
  exports$1.FILE_SYSTEM_ADAPTER = {
    lstat: fs2.lstat,
    stat: fs2.stat,
    lstatSync: fs2.lstatSync,
    statSync: fs2.statSync,
    readdir: fs2.readdir,
    readdirSync: fs2.readdirSync
  };
  function createFileSystemAdapter(fsMethods) {
    if (fsMethods === void 0) {
      return exports$1.FILE_SYSTEM_ADAPTER;
    }
    return Object.assign(Object.assign({}, exports$1.FILE_SYSTEM_ADAPTER), fsMethods);
  }
  exports$1.createFileSystemAdapter = createFileSystemAdapter;
})(fs$2);
Object.defineProperty(settings$2, "__esModule", { value: true });
const path$6 = path$d;
const fsStat$3 = out$1;
const fs$1 = fs$2;
let Settings$1 = class Settings2 {
  constructor(_options = {}) {
    this._options = _options;
    this.followSymbolicLinks = this._getValue(this._options.followSymbolicLinks, false);
    this.fs = fs$1.createFileSystemAdapter(this._options.fs);
    this.pathSegmentSeparator = this._getValue(this._options.pathSegmentSeparator, path$6.sep);
    this.stats = this._getValue(this._options.stats, false);
    this.throwErrorOnBrokenSymbolicLink = this._getValue(this._options.throwErrorOnBrokenSymbolicLink, true);
    this.fsStatSettings = new fsStat$3.Settings({
      followSymbolicLink: this.followSymbolicLinks,
      fs: this.fs,
      throwErrorOnBrokenSymbolicLink: this.throwErrorOnBrokenSymbolicLink
    });
  }
  _getValue(option, value) {
    return option !== null && option !== void 0 ? option : value;
  }
};
settings$2.default = Settings$1;
Object.defineProperty(out$2, "__esModule", { value: true });
out$2.Settings = out$2.scandirSync = out$2.scandir = void 0;
const async = async$3;
const sync$5 = sync$6;
const settings_1$2 = settings$2;
out$2.Settings = settings_1$2.default;
function scandir(path2, optionsOrSettingsOrCallback, callback) {
  if (typeof optionsOrSettingsOrCallback === "function") {
    async.read(path2, getSettings$1(), optionsOrSettingsOrCallback);
    return;
  }
  async.read(path2, getSettings$1(optionsOrSettingsOrCallback), callback);
}
out$2.scandir = scandir;
function scandirSync(path2, optionsOrSettings) {
  const settings2 = getSettings$1(optionsOrSettings);
  return sync$5.read(path2, settings2);
}
out$2.scandirSync = scandirSync;
function getSettings$1(settingsOrOptions = {}) {
  if (settingsOrOptions instanceof settings_1$2.default) {
    return settingsOrOptions;
  }
  return new settings_1$2.default(settingsOrOptions);
}
var queue = { exports: {} };
function reusify$1(Constructor) {
  var head = new Constructor();
  var tail = head;
  function get2() {
    var current = head;
    if (current.next) {
      head = current.next;
    } else {
      head = new Constructor();
      tail = head;
    }
    current.next = null;
    return current;
  }
  function release(obj) {
    tail.next = obj;
    tail = obj;
  }
  return {
    get: get2,
    release
  };
}
var reusify_1 = reusify$1;
var reusify = reusify_1;
function fastqueue(context, worker, _concurrency) {
  if (typeof context === "function") {
    _concurrency = worker;
    worker = context;
    context = null;
  }
  if (!(_concurrency >= 1)) {
    throw new Error("fastqueue concurrency must be equal to or greater than 1");
  }
  var cache = reusify(Task);
  var queueHead = null;
  var queueTail = null;
  var _running = 0;
  var errorHandler = null;
  var self2 = {
    push,
    drain: noop$2,
    saturated: noop$2,
    pause,
    paused: false,
    get concurrency() {
      return _concurrency;
    },
    set concurrency(value) {
      if (!(value >= 1)) {
        throw new Error("fastqueue concurrency must be equal to or greater than 1");
      }
      _concurrency = value;
      if (self2.paused) return;
      for (; queueHead && _running < _concurrency; ) {
        _running++;
        release();
      }
    },
    running,
    resume,
    idle,
    length,
    getQueue,
    unshift,
    empty: noop$2,
    kill,
    killAndDrain,
    error: error2,
    abort
  };
  return self2;
  function running() {
    return _running;
  }
  function pause() {
    self2.paused = true;
  }
  function length() {
    var current = queueHead;
    var counter = 0;
    while (current) {
      current = current.next;
      counter++;
    }
    return counter;
  }
  function getQueue() {
    var current = queueHead;
    var tasks2 = [];
    while (current) {
      tasks2.push(current.value);
      current = current.next;
    }
    return tasks2;
  }
  function resume() {
    if (!self2.paused) return;
    self2.paused = false;
    if (queueHead === null) {
      _running++;
      release();
      return;
    }
    for (; queueHead && _running < _concurrency; ) {
      _running++;
      release();
    }
  }
  function idle() {
    return _running === 0 && self2.length() === 0;
  }
  function push(value, done) {
    var current = cache.get();
    current.context = context;
    current.release = release;
    current.value = value;
    current.callback = done || noop$2;
    current.errorHandler = errorHandler;
    if (_running >= _concurrency || self2.paused) {
      if (queueTail) {
        queueTail.next = current;
        queueTail = current;
      } else {
        queueHead = current;
        queueTail = current;
        self2.saturated();
      }
    } else {
      _running++;
      worker.call(context, current.value, current.worked);
    }
  }
  function unshift(value, done) {
    var current = cache.get();
    current.context = context;
    current.release = release;
    current.value = value;
    current.callback = done || noop$2;
    current.errorHandler = errorHandler;
    if (_running >= _concurrency || self2.paused) {
      if (queueHead) {
        current.next = queueHead;
        queueHead = current;
      } else {
        queueHead = current;
        queueTail = current;
        self2.saturated();
      }
    } else {
      _running++;
      worker.call(context, current.value, current.worked);
    }
  }
  function release(holder) {
    if (holder) {
      cache.release(holder);
    }
    var next = queueHead;
    if (next && _running <= _concurrency) {
      if (!self2.paused) {
        if (queueTail === queueHead) {
          queueTail = null;
        }
        queueHead = next.next;
        next.next = null;
        worker.call(context, next.value, next.worked);
        if (queueTail === null) {
          self2.empty();
        }
      } else {
        _running--;
      }
    } else if (--_running === 0) {
      self2.drain();
    }
  }
  function kill() {
    queueHead = null;
    queueTail = null;
    self2.drain = noop$2;
  }
  function killAndDrain() {
    queueHead = null;
    queueTail = null;
    self2.drain();
    self2.drain = noop$2;
  }
  function abort() {
    var current = queueHead;
    queueHead = null;
    queueTail = null;
    while (current) {
      var next = current.next;
      var callback = current.callback;
      var errorHandler2 = current.errorHandler;
      var val = current.value;
      var context2 = current.context;
      current.value = null;
      current.callback = noop$2;
      current.errorHandler = null;
      if (errorHandler2) {
        errorHandler2(new Error("abort"), val);
      }
      callback.call(context2, new Error("abort"));
      current.release(current);
      current = next;
    }
    self2.drain = noop$2;
  }
  function error2(handler) {
    errorHandler = handler;
  }
}
function noop$2() {
}
function Task() {
  this.value = null;
  this.callback = noop$2;
  this.next = null;
  this.release = noop$2;
  this.context = null;
  this.errorHandler = null;
  var self2 = this;
  this.worked = function worked(err, result) {
    var callback = self2.callback;
    var errorHandler = self2.errorHandler;
    var val = self2.value;
    self2.value = null;
    self2.callback = noop$2;
    if (self2.errorHandler) {
      errorHandler(err, val);
    }
    callback.call(self2.context, err, result);
    self2.release(self2);
  };
}
function queueAsPromised(context, worker, _concurrency) {
  if (typeof context === "function") {
    _concurrency = worker;
    worker = context;
    context = null;
  }
  function asyncWrapper(arg, cb) {
    worker.call(this, arg).then(function(res) {
      cb(null, res);
    }, cb);
  }
  var queue2 = fastqueue(context, asyncWrapper, _concurrency);
  var pushCb = queue2.push;
  var unshiftCb = queue2.unshift;
  queue2.push = push;
  queue2.unshift = unshift;
  queue2.drained = drained;
  return queue2;
  function push(value) {
    var p = new Promise(function(resolve, reject) {
      pushCb(value, function(err, result) {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
    p.catch(noop$2);
    return p;
  }
  function unshift(value) {
    var p = new Promise(function(resolve, reject) {
      unshiftCb(value, function(err, result) {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
    p.catch(noop$2);
    return p;
  }
  function drained() {
    var p = new Promise(function(resolve) {
      process.nextTick(function() {
        if (queue2.idle()) {
          resolve();
        } else {
          var previousDrain = queue2.drain;
          queue2.drain = function() {
            if (typeof previousDrain === "function") previousDrain();
            resolve();
            queue2.drain = previousDrain;
          };
        }
      });
    });
    return p;
  }
}
queue.exports = fastqueue;
queue.exports.promise = queueAsPromised;
var queueExports = queue.exports;
var common$4 = {};
Object.defineProperty(common$4, "__esModule", { value: true });
common$4.joinPathSegments = common$4.replacePathSegmentSeparator = common$4.isAppliedFilter = common$4.isFatalError = void 0;
function isFatalError(settings2, error2) {
  if (settings2.errorFilter === null) {
    return true;
  }
  return !settings2.errorFilter(error2);
}
common$4.isFatalError = isFatalError;
function isAppliedFilter(filter, value) {
  return filter === null || filter(value);
}
common$4.isAppliedFilter = isAppliedFilter;
function replacePathSegmentSeparator(filepath, separator) {
  return filepath.split(/[/\\]/).join(separator);
}
common$4.replacePathSegmentSeparator = replacePathSegmentSeparator;
function joinPathSegments(a2, b, separator) {
  if (a2 === "") {
    return b;
  }
  if (a2.endsWith(separator)) {
    return a2 + b;
  }
  return a2 + separator + b;
}
common$4.joinPathSegments = joinPathSegments;
var reader$1 = {};
Object.defineProperty(reader$1, "__esModule", { value: true });
const common$3 = common$4;
let Reader$1 = class Reader {
  constructor(_root, _settings) {
    this._root = _root;
    this._settings = _settings;
    this._root = common$3.replacePathSegmentSeparator(_root, _settings.pathSegmentSeparator);
  }
};
reader$1.default = Reader$1;
Object.defineProperty(async$4, "__esModule", { value: true });
const events_1 = require$$0$4;
const fsScandir$2 = out$2;
const fastq = queueExports;
const common$2 = common$4;
const reader_1$4 = reader$1;
class AsyncReader extends reader_1$4.default {
  constructor(_root, _settings) {
    super(_root, _settings);
    this._settings = _settings;
    this._scandir = fsScandir$2.scandir;
    this._emitter = new events_1.EventEmitter();
    this._queue = fastq(this._worker.bind(this), this._settings.concurrency);
    this._isFatalError = false;
    this._isDestroyed = false;
    this._queue.drain = () => {
      if (!this._isFatalError) {
        this._emitter.emit("end");
      }
    };
  }
  read() {
    this._isFatalError = false;
    this._isDestroyed = false;
    setImmediate(() => {
      this._pushToQueue(this._root, this._settings.basePath);
    });
    return this._emitter;
  }
  get isDestroyed() {
    return this._isDestroyed;
  }
  destroy() {
    if (this._isDestroyed) {
      throw new Error("The reader is already destroyed");
    }
    this._isDestroyed = true;
    this._queue.killAndDrain();
  }
  onEntry(callback) {
    this._emitter.on("entry", callback);
  }
  onError(callback) {
    this._emitter.once("error", callback);
  }
  onEnd(callback) {
    this._emitter.once("end", callback);
  }
  _pushToQueue(directory, base) {
    const queueItem = { directory, base };
    this._queue.push(queueItem, (error2) => {
      if (error2 !== null) {
        this._handleError(error2);
      }
    });
  }
  _worker(item, done) {
    this._scandir(item.directory, this._settings.fsScandirSettings, (error2, entries) => {
      if (error2 !== null) {
        done(error2, void 0);
        return;
      }
      for (const entry2 of entries) {
        this._handleEntry(entry2, item.base);
      }
      done(null, void 0);
    });
  }
  _handleError(error2) {
    if (this._isDestroyed || !common$2.isFatalError(this._settings, error2)) {
      return;
    }
    this._isFatalError = true;
    this._isDestroyed = true;
    this._emitter.emit("error", error2);
  }
  _handleEntry(entry2, base) {
    if (this._isDestroyed || this._isFatalError) {
      return;
    }
    const fullpath = entry2.path;
    if (base !== void 0) {
      entry2.path = common$2.joinPathSegments(base, entry2.name, this._settings.pathSegmentSeparator);
    }
    if (common$2.isAppliedFilter(this._settings.entryFilter, entry2)) {
      this._emitEntry(entry2);
    }
    if (entry2.dirent.isDirectory() && common$2.isAppliedFilter(this._settings.deepFilter, entry2)) {
      this._pushToQueue(fullpath, base === void 0 ? void 0 : entry2.path);
    }
  }
  _emitEntry(entry2) {
    this._emitter.emit("entry", entry2);
  }
}
async$4.default = AsyncReader;
Object.defineProperty(async$5, "__esModule", { value: true });
const async_1$4 = async$4;
class AsyncProvider {
  constructor(_root, _settings) {
    this._root = _root;
    this._settings = _settings;
    this._reader = new async_1$4.default(this._root, this._settings);
    this._storage = [];
  }
  read(callback) {
    this._reader.onError((error2) => {
      callFailureCallback(callback, error2);
    });
    this._reader.onEntry((entry2) => {
      this._storage.push(entry2);
    });
    this._reader.onEnd(() => {
      callSuccessCallback(callback, this._storage);
    });
    this._reader.read();
  }
}
async$5.default = AsyncProvider;
function callFailureCallback(callback, error2) {
  callback(error2);
}
function callSuccessCallback(callback, entries) {
  callback(null, entries);
}
var stream$2 = {};
Object.defineProperty(stream$2, "__esModule", { value: true });
const stream_1$5 = require$$0$2;
const async_1$3 = async$4;
class StreamProvider {
  constructor(_root, _settings) {
    this._root = _root;
    this._settings = _settings;
    this._reader = new async_1$3.default(this._root, this._settings);
    this._stream = new stream_1$5.Readable({
      objectMode: true,
      read: () => {
      },
      destroy: () => {
        if (!this._reader.isDestroyed) {
          this._reader.destroy();
        }
      }
    });
  }
  read() {
    this._reader.onError((error2) => {
      this._stream.emit("error", error2);
    });
    this._reader.onEntry((entry2) => {
      this._stream.push(entry2);
    });
    this._reader.onEnd(() => {
      this._stream.push(null);
    });
    this._reader.read();
    return this._stream;
  }
}
stream$2.default = StreamProvider;
var sync$4 = {};
var sync$3 = {};
Object.defineProperty(sync$3, "__esModule", { value: true });
const fsScandir$1 = out$2;
const common$1 = common$4;
const reader_1$3 = reader$1;
class SyncReader extends reader_1$3.default {
  constructor() {
    super(...arguments);
    this._scandir = fsScandir$1.scandirSync;
    this._storage = [];
    this._queue = /* @__PURE__ */ new Set();
  }
  read() {
    this._pushToQueue(this._root, this._settings.basePath);
    this._handleQueue();
    return this._storage;
  }
  _pushToQueue(directory, base) {
    this._queue.add({ directory, base });
  }
  _handleQueue() {
    for (const item of this._queue.values()) {
      this._handleDirectory(item.directory, item.base);
    }
  }
  _handleDirectory(directory, base) {
    try {
      const entries = this._scandir(directory, this._settings.fsScandirSettings);
      for (const entry2 of entries) {
        this._handleEntry(entry2, base);
      }
    } catch (error2) {
      this._handleError(error2);
    }
  }
  _handleError(error2) {
    if (!common$1.isFatalError(this._settings, error2)) {
      return;
    }
    throw error2;
  }
  _handleEntry(entry2, base) {
    const fullpath = entry2.path;
    if (base !== void 0) {
      entry2.path = common$1.joinPathSegments(base, entry2.name, this._settings.pathSegmentSeparator);
    }
    if (common$1.isAppliedFilter(this._settings.entryFilter, entry2)) {
      this._pushToStorage(entry2);
    }
    if (entry2.dirent.isDirectory() && common$1.isAppliedFilter(this._settings.deepFilter, entry2)) {
      this._pushToQueue(fullpath, base === void 0 ? void 0 : entry2.path);
    }
  }
  _pushToStorage(entry2) {
    this._storage.push(entry2);
  }
}
sync$3.default = SyncReader;
Object.defineProperty(sync$4, "__esModule", { value: true });
const sync_1$3 = sync$3;
class SyncProvider {
  constructor(_root, _settings) {
    this._root = _root;
    this._settings = _settings;
    this._reader = new sync_1$3.default(this._root, this._settings);
  }
  read() {
    return this._reader.read();
  }
}
sync$4.default = SyncProvider;
var settings$1 = {};
Object.defineProperty(settings$1, "__esModule", { value: true });
const path$5 = path$d;
const fsScandir = out$2;
class Settings3 {
  constructor(_options = {}) {
    this._options = _options;
    this.basePath = this._getValue(this._options.basePath, void 0);
    this.concurrency = this._getValue(this._options.concurrency, Number.POSITIVE_INFINITY);
    this.deepFilter = this._getValue(this._options.deepFilter, null);
    this.entryFilter = this._getValue(this._options.entryFilter, null);
    this.errorFilter = this._getValue(this._options.errorFilter, null);
    this.pathSegmentSeparator = this._getValue(this._options.pathSegmentSeparator, path$5.sep);
    this.fsScandirSettings = new fsScandir.Settings({
      followSymbolicLinks: this._options.followSymbolicLinks,
      fs: this._options.fs,
      pathSegmentSeparator: this._options.pathSegmentSeparator,
      stats: this._options.stats,
      throwErrorOnBrokenSymbolicLink: this._options.throwErrorOnBrokenSymbolicLink
    });
  }
  _getValue(option, value) {
    return option !== null && option !== void 0 ? option : value;
  }
}
settings$1.default = Settings3;
Object.defineProperty(out$3, "__esModule", { value: true });
out$3.Settings = out$3.walkStream = out$3.walkSync = out$3.walk = void 0;
const async_1$2 = async$5;
const stream_1$4 = stream$2;
const sync_1$2 = sync$4;
const settings_1$1 = settings$1;
out$3.Settings = settings_1$1.default;
function walk(directory, optionsOrSettingsOrCallback, callback) {
  if (typeof optionsOrSettingsOrCallback === "function") {
    new async_1$2.default(directory, getSettings()).read(optionsOrSettingsOrCallback);
    return;
  }
  new async_1$2.default(directory, getSettings(optionsOrSettingsOrCallback)).read(callback);
}
out$3.walk = walk;
function walkSync(directory, optionsOrSettings) {
  const settings2 = getSettings(optionsOrSettings);
  const provider2 = new sync_1$2.default(directory, settings2);
  return provider2.read();
}
out$3.walkSync = walkSync;
function walkStream(directory, optionsOrSettings) {
  const settings2 = getSettings(optionsOrSettings);
  const provider2 = new stream_1$4.default(directory, settings2);
  return provider2.read();
}
out$3.walkStream = walkStream;
function getSettings(settingsOrOptions = {}) {
  if (settingsOrOptions instanceof settings_1$1.default) {
    return settingsOrOptions;
  }
  return new settings_1$1.default(settingsOrOptions);
}
var reader = {};
Object.defineProperty(reader, "__esModule", { value: true });
const path$4 = path$d;
const fsStat$2 = out$1;
const utils$6 = utils$k;
class Reader2 {
  constructor(_settings) {
    this._settings = _settings;
    this._fsStatSettings = new fsStat$2.Settings({
      followSymbolicLink: this._settings.followSymbolicLinks,
      fs: this._settings.fs,
      throwErrorOnBrokenSymbolicLink: this._settings.followSymbolicLinks
    });
  }
  _getFullEntryPath(filepath) {
    return path$4.resolve(this._settings.cwd, filepath);
  }
  _makeEntry(stats, pattern2) {
    const entry2 = {
      name: pattern2,
      path: pattern2,
      dirent: utils$6.fs.createDirentFromStats(pattern2, stats)
    };
    if (this._settings.stats) {
      entry2.stats = stats;
    }
    return entry2;
  }
  _isFatalError(error2) {
    return !utils$6.errno.isEnoentCodeError(error2) && !this._settings.suppressErrors;
  }
}
reader.default = Reader2;
var stream$1 = {};
Object.defineProperty(stream$1, "__esModule", { value: true });
const stream_1$3 = require$$0$2;
const fsStat$1 = out$1;
const fsWalk$2 = out$3;
const reader_1$2 = reader;
class ReaderStream extends reader_1$2.default {
  constructor() {
    super(...arguments);
    this._walkStream = fsWalk$2.walkStream;
    this._stat = fsStat$1.stat;
  }
  dynamic(root, options) {
    return this._walkStream(root, options);
  }
  static(patterns, options) {
    const filepaths = patterns.map(this._getFullEntryPath, this);
    const stream2 = new stream_1$3.PassThrough({ objectMode: true });
    stream2._write = (index, _enc, done) => {
      return this._getEntry(filepaths[index], patterns[index], options).then((entry2) => {
        if (entry2 !== null && options.entryFilter(entry2)) {
          stream2.push(entry2);
        }
        if (index === filepaths.length - 1) {
          stream2.end();
        }
        done();
      }).catch(done);
    };
    for (let i2 = 0; i2 < filepaths.length; i2++) {
      stream2.write(i2);
    }
    return stream2;
  }
  _getEntry(filepath, pattern2, options) {
    return this._getStat(filepath).then((stats) => this._makeEntry(stats, pattern2)).catch((error2) => {
      if (options.errorFilter(error2)) {
        return null;
      }
      throw error2;
    });
  }
  _getStat(filepath) {
    return new Promise((resolve, reject) => {
      this._stat(filepath, this._fsStatSettings, (error2, stats) => {
        return error2 === null ? resolve(stats) : reject(error2);
      });
    });
  }
}
stream$1.default = ReaderStream;
Object.defineProperty(async$6, "__esModule", { value: true });
const fsWalk$1 = out$3;
const reader_1$1 = reader;
const stream_1$2 = stream$1;
class ReaderAsync extends reader_1$1.default {
  constructor() {
    super(...arguments);
    this._walkAsync = fsWalk$1.walk;
    this._readerStream = new stream_1$2.default(this._settings);
  }
  dynamic(root, options) {
    return new Promise((resolve, reject) => {
      this._walkAsync(root, options, (error2, entries) => {
        if (error2 === null) {
          resolve(entries);
        } else {
          reject(error2);
        }
      });
    });
  }
  async static(patterns, options) {
    const entries = [];
    const stream2 = this._readerStream.static(patterns, options);
    return new Promise((resolve, reject) => {
      stream2.once("error", reject);
      stream2.on("data", (entry2) => entries.push(entry2));
      stream2.once("end", () => resolve(entries));
    });
  }
}
async$6.default = ReaderAsync;
var provider = {};
var deep = {};
var partial = {};
var matcher = {};
Object.defineProperty(matcher, "__esModule", { value: true });
const utils$5 = utils$k;
class Matcher {
  constructor(_patterns, _settings, _micromatchOptions) {
    this._patterns = _patterns;
    this._settings = _settings;
    this._micromatchOptions = _micromatchOptions;
    this._storage = [];
    this._fillStorage();
  }
  _fillStorage() {
    for (const pattern2 of this._patterns) {
      const segments = this._getPatternSegments(pattern2);
      const sections = this._splitSegmentsIntoSections(segments);
      this._storage.push({
        complete: sections.length <= 1,
        pattern: pattern2,
        segments,
        sections
      });
    }
  }
  _getPatternSegments(pattern2) {
    const parts = utils$5.pattern.getPatternParts(pattern2, this._micromatchOptions);
    return parts.map((part) => {
      const dynamic = utils$5.pattern.isDynamicPattern(part, this._settings);
      if (!dynamic) {
        return {
          dynamic: false,
          pattern: part
        };
      }
      return {
        dynamic: true,
        pattern: part,
        patternRe: utils$5.pattern.makeRe(part, this._micromatchOptions)
      };
    });
  }
  _splitSegmentsIntoSections(segments) {
    return utils$5.array.splitWhen(segments, (segment) => segment.dynamic && utils$5.pattern.hasGlobStar(segment.pattern));
  }
}
matcher.default = Matcher;
Object.defineProperty(partial, "__esModule", { value: true });
const matcher_1 = matcher;
class PartialMatcher extends matcher_1.default {
  match(filepath) {
    const parts = filepath.split("/");
    const levels = parts.length;
    const patterns = this._storage.filter((info) => !info.complete || info.segments.length > levels);
    for (const pattern2 of patterns) {
      const section = pattern2.sections[0];
      if (!pattern2.complete && levels > section.length) {
        return true;
      }
      const match = parts.every((part, index) => {
        const segment = pattern2.segments[index];
        if (segment.dynamic && segment.patternRe.test(part)) {
          return true;
        }
        if (!segment.dynamic && segment.pattern === part) {
          return true;
        }
        return false;
      });
      if (match) {
        return true;
      }
    }
    return false;
  }
}
partial.default = PartialMatcher;
Object.defineProperty(deep, "__esModule", { value: true });
const utils$4 = utils$k;
const partial_1 = partial;
class DeepFilter {
  constructor(_settings, _micromatchOptions) {
    this._settings = _settings;
    this._micromatchOptions = _micromatchOptions;
  }
  getFilter(basePath, positive, negative) {
    const matcher2 = this._getMatcher(positive);
    const negativeRe = this._getNegativePatternsRe(negative);
    return (entry2) => this._filter(basePath, entry2, matcher2, negativeRe);
  }
  _getMatcher(patterns) {
    return new partial_1.default(patterns, this._settings, this._micromatchOptions);
  }
  _getNegativePatternsRe(patterns) {
    const affectDepthOfReadingPatterns = patterns.filter(utils$4.pattern.isAffectDepthOfReadingPattern);
    return utils$4.pattern.convertPatternsToRe(affectDepthOfReadingPatterns, this._micromatchOptions);
  }
  _filter(basePath, entry2, matcher2, negativeRe) {
    if (this._isSkippedByDeep(basePath, entry2.path)) {
      return false;
    }
    if (this._isSkippedSymbolicLink(entry2)) {
      return false;
    }
    const filepath = utils$4.path.removeLeadingDotSegment(entry2.path);
    if (this._isSkippedByPositivePatterns(filepath, matcher2)) {
      return false;
    }
    return this._isSkippedByNegativePatterns(filepath, negativeRe);
  }
  _isSkippedByDeep(basePath, entryPath) {
    if (this._settings.deep === Infinity) {
      return false;
    }
    return this._getEntryLevel(basePath, entryPath) >= this._settings.deep;
  }
  _getEntryLevel(basePath, entryPath) {
    const entryPathDepth = entryPath.split("/").length;
    if (basePath === "") {
      return entryPathDepth;
    }
    const basePathDepth = basePath.split("/").length;
    return entryPathDepth - basePathDepth;
  }
  _isSkippedSymbolicLink(entry2) {
    return !this._settings.followSymbolicLinks && entry2.dirent.isSymbolicLink();
  }
  _isSkippedByPositivePatterns(entryPath, matcher2) {
    return !this._settings.baseNameMatch && !matcher2.match(entryPath);
  }
  _isSkippedByNegativePatterns(entryPath, patternsRe) {
    return !utils$4.pattern.matchAny(entryPath, patternsRe);
  }
}
deep.default = DeepFilter;
var entry$1 = {};
Object.defineProperty(entry$1, "__esModule", { value: true });
const utils$3 = utils$k;
class EntryFilter {
  constructor(_settings, _micromatchOptions) {
    this._settings = _settings;
    this._micromatchOptions = _micromatchOptions;
    this.index = /* @__PURE__ */ new Map();
  }
  getFilter(positive, negative) {
    const [absoluteNegative, relativeNegative] = utils$3.pattern.partitionAbsoluteAndRelative(negative);
    const patterns = {
      positive: {
        all: utils$3.pattern.convertPatternsToRe(positive, this._micromatchOptions)
      },
      negative: {
        absolute: utils$3.pattern.convertPatternsToRe(absoluteNegative, Object.assign(Object.assign({}, this._micromatchOptions), { dot: true })),
        relative: utils$3.pattern.convertPatternsToRe(relativeNegative, Object.assign(Object.assign({}, this._micromatchOptions), { dot: true }))
      }
    };
    return (entry2) => this._filter(entry2, patterns);
  }
  _filter(entry2, patterns) {
    const filepath = utils$3.path.removeLeadingDotSegment(entry2.path);
    if (this._settings.unique && this._isDuplicateEntry(filepath)) {
      return false;
    }
    if (this._onlyFileFilter(entry2) || this._onlyDirectoryFilter(entry2)) {
      return false;
    }
    const isMatched = this._isMatchToPatternsSet(filepath, patterns, entry2.dirent.isDirectory());
    if (this._settings.unique && isMatched) {
      this._createIndexRecord(filepath);
    }
    return isMatched;
  }
  _isDuplicateEntry(filepath) {
    return this.index.has(filepath);
  }
  _createIndexRecord(filepath) {
    this.index.set(filepath, void 0);
  }
  _onlyFileFilter(entry2) {
    return this._settings.onlyFiles && !entry2.dirent.isFile();
  }
  _onlyDirectoryFilter(entry2) {
    return this._settings.onlyDirectories && !entry2.dirent.isDirectory();
  }
  _isMatchToPatternsSet(filepath, patterns, isDirectory) {
    const isMatched = this._isMatchToPatterns(filepath, patterns.positive.all, isDirectory);
    if (!isMatched) {
      return false;
    }
    const isMatchedByRelativeNegative = this._isMatchToPatterns(filepath, patterns.negative.relative, isDirectory);
    if (isMatchedByRelativeNegative) {
      return false;
    }
    const isMatchedByAbsoluteNegative = this._isMatchToAbsoluteNegative(filepath, patterns.negative.absolute, isDirectory);
    if (isMatchedByAbsoluteNegative) {
      return false;
    }
    return true;
  }
  _isMatchToAbsoluteNegative(filepath, patternsRe, isDirectory) {
    if (patternsRe.length === 0) {
      return false;
    }
    const fullpath = utils$3.path.makeAbsolute(this._settings.cwd, filepath);
    return this._isMatchToPatterns(fullpath, patternsRe, isDirectory);
  }
  _isMatchToPatterns(filepath, patternsRe, isDirectory) {
    if (patternsRe.length === 0) {
      return false;
    }
    const isMatched = utils$3.pattern.matchAny(filepath, patternsRe);
    if (!isMatched && isDirectory) {
      return utils$3.pattern.matchAny(filepath + "/", patternsRe);
    }
    return isMatched;
  }
}
entry$1.default = EntryFilter;
var error = {};
Object.defineProperty(error, "__esModule", { value: true });
const utils$2 = utils$k;
class ErrorFilter {
  constructor(_settings) {
    this._settings = _settings;
  }
  getFilter() {
    return (error2) => this._isNonFatalError(error2);
  }
  _isNonFatalError(error2) {
    return utils$2.errno.isEnoentCodeError(error2) || this._settings.suppressErrors;
  }
}
error.default = ErrorFilter;
var entry = {};
Object.defineProperty(entry, "__esModule", { value: true });
const utils$1 = utils$k;
class EntryTransformer {
  constructor(_settings) {
    this._settings = _settings;
  }
  getTransformer() {
    return (entry2) => this._transform(entry2);
  }
  _transform(entry2) {
    let filepath = entry2.path;
    if (this._settings.absolute) {
      filepath = utils$1.path.makeAbsolute(this._settings.cwd, filepath);
      filepath = utils$1.path.unixify(filepath);
    }
    if (this._settings.markDirectories && entry2.dirent.isDirectory()) {
      filepath += "/";
    }
    if (!this._settings.objectMode) {
      return filepath;
    }
    return Object.assign(Object.assign({}, entry2), { path: filepath });
  }
}
entry.default = EntryTransformer;
Object.defineProperty(provider, "__esModule", { value: true });
const path$3 = path$d;
const deep_1 = deep;
const entry_1 = entry$1;
const error_1 = error;
const entry_2 = entry;
class Provider {
  constructor(_settings) {
    this._settings = _settings;
    this.errorFilter = new error_1.default(this._settings);
    this.entryFilter = new entry_1.default(this._settings, this._getMicromatchOptions());
    this.deepFilter = new deep_1.default(this._settings, this._getMicromatchOptions());
    this.entryTransformer = new entry_2.default(this._settings);
  }
  _getRootDirectory(task) {
    return path$3.resolve(this._settings.cwd, task.base);
  }
  _getReaderOptions(task) {
    const basePath = task.base === "." ? "" : task.base;
    return {
      basePath,
      pathSegmentSeparator: "/",
      concurrency: this._settings.concurrency,
      deepFilter: this.deepFilter.getFilter(basePath, task.positive, task.negative),
      entryFilter: this.entryFilter.getFilter(task.positive, task.negative),
      errorFilter: this.errorFilter.getFilter(),
      followSymbolicLinks: this._settings.followSymbolicLinks,
      fs: this._settings.fs,
      stats: this._settings.stats,
      throwErrorOnBrokenSymbolicLink: this._settings.throwErrorOnBrokenSymbolicLink,
      transform: this.entryTransformer.getTransformer()
    };
  }
  _getMicromatchOptions() {
    return {
      dot: this._settings.dot,
      matchBase: this._settings.baseNameMatch,
      nobrace: !this._settings.braceExpansion,
      nocase: !this._settings.caseSensitiveMatch,
      noext: !this._settings.extglob,
      noglobstar: !this._settings.globstar,
      posix: true,
      strictSlashes: false
    };
  }
}
provider.default = Provider;
Object.defineProperty(async$7, "__esModule", { value: true });
const async_1$1 = async$6;
const provider_1$2 = provider;
class ProviderAsync extends provider_1$2.default {
  constructor() {
    super(...arguments);
    this._reader = new async_1$1.default(this._settings);
  }
  async read(task) {
    const root = this._getRootDirectory(task);
    const options = this._getReaderOptions(task);
    const entries = await this.api(root, task, options);
    return entries.map((entry2) => options.transform(entry2));
  }
  api(root, task, options) {
    if (task.dynamic) {
      return this._reader.dynamic(root, options);
    }
    return this._reader.static(task.patterns, options);
  }
}
async$7.default = ProviderAsync;
var stream = {};
Object.defineProperty(stream, "__esModule", { value: true });
const stream_1$1 = require$$0$2;
const stream_2 = stream$1;
const provider_1$1 = provider;
class ProviderStream extends provider_1$1.default {
  constructor() {
    super(...arguments);
    this._reader = new stream_2.default(this._settings);
  }
  read(task) {
    const root = this._getRootDirectory(task);
    const options = this._getReaderOptions(task);
    const source = this.api(root, task, options);
    const destination = new stream_1$1.Readable({ objectMode: true, read: () => {
    } });
    source.once("error", (error2) => destination.emit("error", error2)).on("data", (entry2) => destination.emit("data", options.transform(entry2))).once("end", () => destination.emit("end"));
    destination.once("close", () => source.destroy());
    return destination;
  }
  api(root, task, options) {
    if (task.dynamic) {
      return this._reader.dynamic(root, options);
    }
    return this._reader.static(task.patterns, options);
  }
}
stream.default = ProviderStream;
var sync$2 = {};
var sync$1 = {};
Object.defineProperty(sync$1, "__esModule", { value: true });
const fsStat = out$1;
const fsWalk = out$3;
const reader_1 = reader;
class ReaderSync extends reader_1.default {
  constructor() {
    super(...arguments);
    this._walkSync = fsWalk.walkSync;
    this._statSync = fsStat.statSync;
  }
  dynamic(root, options) {
    return this._walkSync(root, options);
  }
  static(patterns, options) {
    const entries = [];
    for (const pattern2 of patterns) {
      const filepath = this._getFullEntryPath(pattern2);
      const entry2 = this._getEntry(filepath, pattern2, options);
      if (entry2 === null || !options.entryFilter(entry2)) {
        continue;
      }
      entries.push(entry2);
    }
    return entries;
  }
  _getEntry(filepath, pattern2, options) {
    try {
      const stats = this._getStat(filepath);
      return this._makeEntry(stats, pattern2);
    } catch (error2) {
      if (options.errorFilter(error2)) {
        return null;
      }
      throw error2;
    }
  }
  _getStat(filepath) {
    return this._statSync(filepath, this._fsStatSettings);
  }
}
sync$1.default = ReaderSync;
Object.defineProperty(sync$2, "__esModule", { value: true });
const sync_1$1 = sync$1;
const provider_1 = provider;
class ProviderSync extends provider_1.default {
  constructor() {
    super(...arguments);
    this._reader = new sync_1$1.default(this._settings);
  }
  read(task) {
    const root = this._getRootDirectory(task);
    const options = this._getReaderOptions(task);
    const entries = this.api(root, task, options);
    return entries.map(options.transform);
  }
  api(root, task, options) {
    if (task.dynamic) {
      return this._reader.dynamic(root, options);
    }
    return this._reader.static(task.patterns, options);
  }
}
sync$2.default = ProviderSync;
var settings = {};
(function(exports$1) {
  Object.defineProperty(exports$1, "__esModule", { value: true });
  exports$1.DEFAULT_FILE_SYSTEM_ADAPTER = void 0;
  const fs2 = require$$0$3;
  const os2 = require$$0;
  const CPU_COUNT = Math.max(os2.cpus().length, 1);
  exports$1.DEFAULT_FILE_SYSTEM_ADAPTER = {
    lstat: fs2.lstat,
    lstatSync: fs2.lstatSync,
    stat: fs2.stat,
    statSync: fs2.statSync,
    readdir: fs2.readdir,
    readdirSync: fs2.readdirSync
  };
  class Settings4 {
    constructor(_options = {}) {
      this._options = _options;
      this.absolute = this._getValue(this._options.absolute, false);
      this.baseNameMatch = this._getValue(this._options.baseNameMatch, false);
      this.braceExpansion = this._getValue(this._options.braceExpansion, true);
      this.caseSensitiveMatch = this._getValue(this._options.caseSensitiveMatch, true);
      this.concurrency = this._getValue(this._options.concurrency, CPU_COUNT);
      this.cwd = this._getValue(this._options.cwd, process.cwd());
      this.deep = this._getValue(this._options.deep, Infinity);
      this.dot = this._getValue(this._options.dot, false);
      this.extglob = this._getValue(this._options.extglob, true);
      this.followSymbolicLinks = this._getValue(this._options.followSymbolicLinks, true);
      this.fs = this._getFileSystemMethods(this._options.fs);
      this.globstar = this._getValue(this._options.globstar, true);
      this.ignore = this._getValue(this._options.ignore, []);
      this.markDirectories = this._getValue(this._options.markDirectories, false);
      this.objectMode = this._getValue(this._options.objectMode, false);
      this.onlyDirectories = this._getValue(this._options.onlyDirectories, false);
      this.onlyFiles = this._getValue(this._options.onlyFiles, true);
      this.stats = this._getValue(this._options.stats, false);
      this.suppressErrors = this._getValue(this._options.suppressErrors, false);
      this.throwErrorOnBrokenSymbolicLink = this._getValue(this._options.throwErrorOnBrokenSymbolicLink, false);
      this.unique = this._getValue(this._options.unique, true);
      if (this.onlyDirectories) {
        this.onlyFiles = false;
      }
      if (this.stats) {
        this.objectMode = true;
      }
      this.ignore = [].concat(this.ignore);
    }
    _getValue(option, value) {
      return option === void 0 ? value : option;
    }
    _getFileSystemMethods(methods = {}) {
      return Object.assign(Object.assign({}, exports$1.DEFAULT_FILE_SYSTEM_ADAPTER), methods);
    }
  }
  exports$1.default = Settings4;
})(settings);
const taskManager = tasks;
const async_1 = async$7;
const stream_1 = stream;
const sync_1 = sync$2;
const settings_1 = settings;
const utils = utils$k;
async function FastGlob(source, options) {
  assertPatternsInput(source);
  const works = getWorks(source, async_1.default, options);
  const result = await Promise.all(works);
  return utils.array.flatten(result);
}
(function(FastGlob2) {
  FastGlob2.glob = FastGlob2;
  FastGlob2.globSync = sync2;
  FastGlob2.globStream = stream2;
  FastGlob2.async = FastGlob2;
  function sync2(source, options) {
    assertPatternsInput(source);
    const works = getWorks(source, sync_1.default, options);
    return utils.array.flatten(works);
  }
  FastGlob2.sync = sync2;
  function stream2(source, options) {
    assertPatternsInput(source);
    const works = getWorks(source, stream_1.default, options);
    return utils.stream.merge(works);
  }
  FastGlob2.stream = stream2;
  function generateTasks(source, options) {
    assertPatternsInput(source);
    const patterns = [].concat(source);
    const settings2 = new settings_1.default(options);
    return taskManager.generate(patterns, settings2);
  }
  FastGlob2.generateTasks = generateTasks;
  function isDynamicPattern2(source, options) {
    assertPatternsInput(source);
    const settings2 = new settings_1.default(options);
    return utils.pattern.isDynamicPattern(source, settings2);
  }
  FastGlob2.isDynamicPattern = isDynamicPattern2;
  function escapePath(source) {
    assertPatternsInput(source);
    return utils.path.escape(source);
  }
  FastGlob2.escapePath = escapePath;
  function convertPathToPattern(source) {
    assertPatternsInput(source);
    return utils.path.convertPathToPattern(source);
  }
  FastGlob2.convertPathToPattern = convertPathToPattern;
  (function(posix) {
    function escapePath2(source) {
      assertPatternsInput(source);
      return utils.path.escapePosixPath(source);
    }
    posix.escapePath = escapePath2;
    function convertPathToPattern2(source) {
      assertPatternsInput(source);
      return utils.path.convertPosixPathToPattern(source);
    }
    posix.convertPathToPattern = convertPathToPattern2;
  })(FastGlob2.posix || (FastGlob2.posix = {}));
  (function(win32) {
    function escapePath2(source) {
      assertPatternsInput(source);
      return utils.path.escapeWindowsPath(source);
    }
    win32.escapePath = escapePath2;
    function convertPathToPattern2(source) {
      assertPatternsInput(source);
      return utils.path.convertWindowsPathToPattern(source);
    }
    win32.convertPathToPattern = convertPathToPattern2;
  })(FastGlob2.win32 || (FastGlob2.win32 = {}));
})(FastGlob || (FastGlob = {}));
function getWorks(source, _Provider, options) {
  const patterns = [].concat(source);
  const settings2 = new settings_1.default(options);
  const tasks2 = taskManager.generate(patterns, settings2);
  const provider2 = new _Provider(settings2);
  return tasks2.map(provider2.read, provider2);
}
function assertPatternsInput(input) {
  const source = [].concat(input);
  const isValidSource = source.every((item) => utils.string.isString(item) && !utils.string.isEmpty(item));
  if (!isValidSource) {
    throw new TypeError("Patterns must be a string (non empty) or an array of strings");
  }
}
var out = FastGlob;
function isPlainObject(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
}
const safeNormalizeFileUrl = (file, name) => {
  const fileString = normalizeFileUrl(normalizeDenoExecPath(file));
  if (typeof fileString !== "string") {
    throw new TypeError(`${name} must be a string or a file URL: ${fileString}.`);
  }
  return fileString;
};
const normalizeDenoExecPath = (file) => isDenoExecPath(file) ? file.toString() : file;
const isDenoExecPath = (file) => typeof file !== "string" && file && Object.getPrototypeOf(file) === String.prototype;
const normalizeFileUrl = (file) => file instanceof URL ? node_url.fileURLToPath(file) : file;
const normalizeParameters = (rawFile, rawArguments = [], rawOptions = {}) => {
  const filePath = safeNormalizeFileUrl(rawFile, "First argument");
  const [commandArguments, options] = isPlainObject(rawArguments) ? [[], rawArguments] : [rawArguments, rawOptions];
  if (!Array.isArray(commandArguments)) {
    throw new TypeError(`Second argument must be either an array of arguments or an options object: ${commandArguments}`);
  }
  if (commandArguments.some((commandArgument) => typeof commandArgument === "object" && commandArgument !== null)) {
    throw new TypeError(`Second argument must be an array of strings: ${commandArguments}`);
  }
  const normalizedArguments = commandArguments.map(String);
  const nullByteArgument = normalizedArguments.find((normalizedArgument) => normalizedArgument.includes("\0"));
  if (nullByteArgument !== void 0) {
    throw new TypeError(`Arguments cannot contain null bytes ("\\0"): ${nullByteArgument}`);
  }
  if (!isPlainObject(options)) {
    throw new TypeError(`Last argument must be an options object: ${options}`);
  }
  return [filePath, normalizedArguments, options];
};
const { toString: objectToString$1 } = Object.prototype;
const isArrayBuffer = (value) => objectToString$1.call(value) === "[object ArrayBuffer]";
const isUint8Array = (value) => objectToString$1.call(value) === "[object Uint8Array]";
const bufferToUint8Array = (buffer) => new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
const textEncoder$1 = new TextEncoder();
const stringToUint8Array = (string2) => textEncoder$1.encode(string2);
const textDecoder = new TextDecoder();
const uint8ArrayToString = (uint8Array) => textDecoder.decode(uint8Array);
const joinToString = (uint8ArraysOrStrings, encoding) => {
  const strings = uint8ArraysToStrings(uint8ArraysOrStrings, encoding);
  return strings.join("");
};
const uint8ArraysToStrings = (uint8ArraysOrStrings, encoding) => {
  if (encoding === "utf8" && uint8ArraysOrStrings.every((uint8ArrayOrString) => typeof uint8ArrayOrString === "string")) {
    return uint8ArraysOrStrings;
  }
  const decoder = new node_string_decoder.StringDecoder(encoding);
  const strings = uint8ArraysOrStrings.map((uint8ArrayOrString) => typeof uint8ArrayOrString === "string" ? stringToUint8Array(uint8ArrayOrString) : uint8ArrayOrString).map((uint8Array) => decoder.write(uint8Array));
  const finalString = decoder.end();
  return finalString === "" ? strings : [...strings, finalString];
};
const joinToUint8Array = (uint8ArraysOrStrings) => {
  if (uint8ArraysOrStrings.length === 1 && isUint8Array(uint8ArraysOrStrings[0])) {
    return uint8ArraysOrStrings[0];
  }
  return concatUint8Arrays(stringsToUint8Arrays(uint8ArraysOrStrings));
};
const stringsToUint8Arrays = (uint8ArraysOrStrings) => uint8ArraysOrStrings.map((uint8ArrayOrString) => typeof uint8ArrayOrString === "string" ? stringToUint8Array(uint8ArrayOrString) : uint8ArrayOrString);
const concatUint8Arrays = (uint8Arrays) => {
  const result = new Uint8Array(getJoinLength(uint8Arrays));
  let index = 0;
  for (const uint8Array of uint8Arrays) {
    result.set(uint8Array, index);
    index += uint8Array.length;
  }
  return result;
};
const getJoinLength = (uint8Arrays) => {
  let joinLength = 0;
  for (const uint8Array of uint8Arrays) {
    joinLength += uint8Array.length;
  }
  return joinLength;
};
const isTemplateString = (templates) => Array.isArray(templates) && Array.isArray(templates.raw);
const parseTemplates = (templates, expressions) => {
  let tokens = [];
  for (const [index, template] of templates.entries()) {
    tokens = parseTemplate({
      templates,
      expressions,
      tokens,
      index,
      template
    });
  }
  if (tokens.length === 0) {
    throw new TypeError("Template script must not be empty");
  }
  const [file, ...commandArguments] = tokens;
  return [file, commandArguments, {}];
};
const parseTemplate = ({ templates, expressions, tokens, index, template }) => {
  if (template === void 0) {
    throw new TypeError(`Invalid backslash sequence: ${templates.raw[index]}`);
  }
  const { nextTokens, leadingWhitespaces, trailingWhitespaces } = splitByWhitespaces(template, templates.raw[index]);
  const newTokens = concatTokens(tokens, nextTokens, leadingWhitespaces);
  if (index === expressions.length) {
    return newTokens;
  }
  const expression = expressions[index];
  const expressionTokens = Array.isArray(expression) ? expression.map((expression2) => parseExpression(expression2)) : [parseExpression(expression)];
  return concatTokens(newTokens, expressionTokens, trailingWhitespaces);
};
const splitByWhitespaces = (template, rawTemplate) => {
  if (rawTemplate.length === 0) {
    return { nextTokens: [], leadingWhitespaces: false, trailingWhitespaces: false };
  }
  const nextTokens = [];
  let templateStart = 0;
  const leadingWhitespaces = DELIMITERS.has(rawTemplate[0]);
  for (let templateIndex = 0, rawIndex = 0; templateIndex < template.length; templateIndex += 1, rawIndex += 1) {
    const rawCharacter = rawTemplate[rawIndex];
    if (DELIMITERS.has(rawCharacter)) {
      if (templateStart !== templateIndex) {
        nextTokens.push(template.slice(templateStart, templateIndex));
      }
      templateStart = templateIndex + 1;
    } else if (rawCharacter === "\\") {
      const nextRawCharacter = rawTemplate[rawIndex + 1];
      if (nextRawCharacter === "\n") {
        templateIndex -= 1;
        rawIndex += 1;
      } else if (nextRawCharacter === "u" && rawTemplate[rawIndex + 2] === "{") {
        rawIndex = rawTemplate.indexOf("}", rawIndex + 3);
      } else {
        rawIndex += ESCAPE_LENGTH[nextRawCharacter] ?? 1;
      }
    }
  }
  const trailingWhitespaces = templateStart === template.length;
  if (!trailingWhitespaces) {
    nextTokens.push(template.slice(templateStart));
  }
  return { nextTokens, leadingWhitespaces, trailingWhitespaces };
};
const DELIMITERS = /* @__PURE__ */ new Set([" ", "	", "\r", "\n"]);
const ESCAPE_LENGTH = { x: 3, u: 5 };
const concatTokens = (tokens, nextTokens, isSeparated) => isSeparated || tokens.length === 0 || nextTokens.length === 0 ? [...tokens, ...nextTokens] : [
  ...tokens.slice(0, -1),
  `${tokens.at(-1)}${nextTokens[0]}`,
  ...nextTokens.slice(1)
];
const parseExpression = (expression) => {
  const typeOfExpression = typeof expression;
  if (typeOfExpression === "string") {
    return expression;
  }
  if (typeOfExpression === "number") {
    return String(expression);
  }
  if (isPlainObject(expression) && ("stdout" in expression || "isMaxBuffer" in expression)) {
    return getSubprocessResult(expression);
  }
  if (expression instanceof node_child_process.ChildProcess || Object.prototype.toString.call(expression) === "[object Promise]") {
    throw new TypeError("Unexpected subprocess in template expression. Please use ${await subprocess} instead of ${subprocess}.");
  }
  throw new TypeError(`Unexpected "${typeOfExpression}" in template expression`);
};
const getSubprocessResult = ({ stdout }) => {
  if (typeof stdout === "string") {
    return stdout;
  }
  if (isUint8Array(stdout)) {
    return uint8ArrayToString(stdout);
  }
  if (stdout === void 0) {
    throw new TypeError(`Missing result.stdout in template expression. This is probably due to the previous subprocess' "stdout" option.`);
  }
  throw new TypeError(`Unexpected "${typeof stdout}" stdout in template expression`);
};
const isStandardStream = (stream2) => STANDARD_STREAMS.includes(stream2);
const STANDARD_STREAMS = [process$2.stdin, process$2.stdout, process$2.stderr];
const STANDARD_STREAMS_ALIASES = ["stdin", "stdout", "stderr"];
const getStreamName = (fdNumber) => STANDARD_STREAMS_ALIASES[fdNumber] ?? `stdio[${fdNumber}]`;
const normalizeFdSpecificOptions = (options) => {
  const optionsCopy = { ...options };
  for (const optionName of FD_SPECIFIC_OPTIONS) {
    optionsCopy[optionName] = normalizeFdSpecificOption(options, optionName);
  }
  return optionsCopy;
};
const normalizeFdSpecificOption = (options, optionName) => {
  const optionBaseArray = Array.from({ length: getStdioLength(options) + 1 });
  const optionArray = normalizeFdSpecificValue(options[optionName], optionBaseArray, optionName);
  return addDefaultValue$1(optionArray, optionName);
};
const getStdioLength = ({ stdio }) => Array.isArray(stdio) ? Math.max(stdio.length, STANDARD_STREAMS_ALIASES.length) : STANDARD_STREAMS_ALIASES.length;
const normalizeFdSpecificValue = (optionValue, optionArray, optionName) => isPlainObject(optionValue) ? normalizeOptionObject(optionValue, optionArray, optionName) : optionArray.fill(optionValue);
const normalizeOptionObject = (optionValue, optionArray, optionName) => {
  for (const fdName of Object.keys(optionValue).sort(compareFdName)) {
    for (const fdNumber of parseFdName(fdName, optionName, optionArray)) {
      optionArray[fdNumber] = optionValue[fdName];
    }
  }
  return optionArray;
};
const compareFdName = (fdNameA, fdNameB) => getFdNameOrder(fdNameA) < getFdNameOrder(fdNameB) ? 1 : -1;
const getFdNameOrder = (fdName) => {
  if (fdName === "stdout" || fdName === "stderr") {
    return 0;
  }
  return fdName === "all" ? 2 : 1;
};
const parseFdName = (fdName, optionName, optionArray) => {
  if (fdName === "ipc") {
    return [optionArray.length - 1];
  }
  const fdNumber = parseFd(fdName);
  if (fdNumber === void 0 || fdNumber === 0) {
    throw new TypeError(`"${optionName}.${fdName}" is invalid.
It must be "${optionName}.stdout", "${optionName}.stderr", "${optionName}.all", "${optionName}.ipc", or "${optionName}.fd3", "${optionName}.fd4" (and so on).`);
  }
  if (fdNumber >= optionArray.length) {
    throw new TypeError(`"${optionName}.${fdName}" is invalid: that file descriptor does not exist.
Please set the "stdio" option to ensure that file descriptor exists.`);
  }
  return fdNumber === "all" ? [1, 2] : [fdNumber];
};
const parseFd = (fdName) => {
  if (fdName === "all") {
    return fdName;
  }
  if (STANDARD_STREAMS_ALIASES.includes(fdName)) {
    return STANDARD_STREAMS_ALIASES.indexOf(fdName);
  }
  const regexpResult = FD_REGEXP.exec(fdName);
  if (regexpResult !== null) {
    return Number(regexpResult[1]);
  }
};
const FD_REGEXP = /^fd(\d+)$/;
const addDefaultValue$1 = (optionArray, optionName) => optionArray.map((optionValue) => optionValue === void 0 ? DEFAULT_OPTIONS[optionName] : optionValue);
const verboseDefault = node_util.debuglog("execa").enabled ? "full" : "none";
const DEFAULT_OPTIONS = {
  lines: false,
  buffer: true,
  maxBuffer: 1e3 * 1e3 * 100,
  verbose: verboseDefault,
  stripFinalNewline: true
};
const FD_SPECIFIC_OPTIONS = ["lines", "buffer", "maxBuffer", "verbose", "stripFinalNewline"];
const getFdSpecificValue = (optionArray, fdNumber) => fdNumber === "ipc" ? optionArray.at(-1) : optionArray[fdNumber];
const isVerbose = ({ verbose }, fdNumber) => getFdVerbose(verbose, fdNumber) !== "none";
const isFullVerbose = ({ verbose }, fdNumber) => !["none", "short"].includes(getFdVerbose(verbose, fdNumber));
const getVerboseFunction = ({ verbose }, fdNumber) => {
  const fdVerbose = getFdVerbose(verbose, fdNumber);
  return isVerboseFunction(fdVerbose) ? fdVerbose : void 0;
};
const getFdVerbose = (verbose, fdNumber) => fdNumber === void 0 ? getFdGenericVerbose(verbose) : getFdSpecificValue(verbose, fdNumber);
const getFdGenericVerbose = (verbose) => verbose.find((fdVerbose) => isVerboseFunction(fdVerbose)) ?? VERBOSE_VALUES.findLast((fdVerbose) => verbose.includes(fdVerbose));
const isVerboseFunction = (fdVerbose) => typeof fdVerbose === "function";
const VERBOSE_VALUES = ["none", "short", "full"];
const joinCommand = (filePath, rawArguments) => {
  const fileAndArguments = [filePath, ...rawArguments];
  const command = fileAndArguments.join(" ");
  const escapedCommand = fileAndArguments.map((fileAndArgument) => quoteString(escapeControlCharacters(fileAndArgument))).join(" ");
  return { command, escapedCommand };
};
const escapeLines = (lines) => node_util.stripVTControlCharacters(lines).split("\n").map((line) => escapeControlCharacters(line)).join("\n");
const escapeControlCharacters = (line) => line.replaceAll(SPECIAL_CHAR_REGEXP, (character) => escapeControlCharacter(character));
const escapeControlCharacter = (character) => {
  const commonEscape = COMMON_ESCAPES[character];
  if (commonEscape !== void 0) {
    return commonEscape;
  }
  const codepoint = character.codePointAt(0);
  const codepointHex = codepoint.toString(16);
  return codepoint <= ASTRAL_START ? `\\u${codepointHex.padStart(4, "0")}` : `\\U${codepointHex}`;
};
const getSpecialCharRegExp = () => {
  try {
    return new RegExp("\\p{Separator}|\\p{Other}", "gu");
  } catch {
    return /[\s\u0000-\u001F\u007F-\u009F\u00AD]/g;
  }
};
const SPECIAL_CHAR_REGEXP = getSpecialCharRegExp();
const COMMON_ESCAPES = {
  " ": " ",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "	": "\\t"
};
const ASTRAL_START = 65535;
const quoteString = (escapedArgument) => {
  if (NO_ESCAPE_REGEXP.test(escapedArgument)) {
    return escapedArgument;
  }
  return process$2.platform === "win32" ? `"${escapedArgument.replaceAll('"', '""')}"` : `'${escapedArgument.replaceAll("'", "'\\''")}'`;
};
const NO_ESCAPE_REGEXP = /^[\w./-]+$/;
function isUnicodeSupported() {
  const { env } = process$2;
  const { TERM, TERM_PROGRAM } = env;
  if (process$2.platform !== "win32") {
    return TERM !== "linux";
  }
  return Boolean(env.WT_SESSION) || Boolean(env.TERMINUS_SUBLIME) || env.ConEmuTask === "{cmd::Cmder}" || TERM_PROGRAM === "Terminus-Sublime" || TERM_PROGRAM === "vscode" || TERM === "xterm-256color" || TERM === "alacritty" || TERM === "rxvt-unicode" || TERM === "rxvt-unicode-256color" || env.TERMINAL_EMULATOR === "JetBrains-JediTerm";
}
const common = {
  circleQuestionMark: "(?)",
  questionMarkPrefix: "(?)",
  square: "█",
  squareDarkShade: "▓",
  squareMediumShade: "▒",
  squareLightShade: "░",
  squareTop: "▀",
  squareBottom: "▄",
  squareLeft: "▌",
  squareRight: "▐",
  squareCenter: "■",
  bullet: "●",
  dot: "․",
  ellipsis: "…",
  pointerSmall: "›",
  triangleUp: "▲",
  triangleUpSmall: "▴",
  triangleDown: "▼",
  triangleDownSmall: "▾",
  triangleLeftSmall: "◂",
  triangleRightSmall: "▸",
  home: "⌂",
  heart: "♥",
  musicNote: "♪",
  musicNoteBeamed: "♫",
  arrowUp: "↑",
  arrowDown: "↓",
  arrowLeft: "←",
  arrowRight: "→",
  arrowLeftRight: "↔",
  arrowUpDown: "↕",
  almostEqual: "≈",
  notEqual: "≠",
  lessOrEqual: "≤",
  greaterOrEqual: "≥",
  identical: "≡",
  infinity: "∞",
  subscriptZero: "₀",
  subscriptOne: "₁",
  subscriptTwo: "₂",
  subscriptThree: "₃",
  subscriptFour: "₄",
  subscriptFive: "₅",
  subscriptSix: "₆",
  subscriptSeven: "₇",
  subscriptEight: "₈",
  subscriptNine: "₉",
  oneHalf: "½",
  oneThird: "⅓",
  oneQuarter: "¼",
  oneFifth: "⅕",
  oneSixth: "⅙",
  oneEighth: "⅛",
  twoThirds: "⅔",
  twoFifths: "⅖",
  threeQuarters: "¾",
  threeFifths: "⅗",
  threeEighths: "⅜",
  fourFifths: "⅘",
  fiveSixths: "⅚",
  fiveEighths: "⅝",
  sevenEighths: "⅞",
  line: "─",
  lineBold: "━",
  lineDouble: "═",
  lineDashed0: "┄",
  lineDashed1: "┅",
  lineDashed2: "┈",
  lineDashed3: "┉",
  lineDashed4: "╌",
  lineDashed5: "╍",
  lineDashed6: "╴",
  lineDashed7: "╶",
  lineDashed8: "╸",
  lineDashed9: "╺",
  lineDashed10: "╼",
  lineDashed11: "╾",
  lineDashed12: "−",
  lineDashed13: "–",
  lineDashed14: "‐",
  lineDashed15: "⁃",
  lineVertical: "│",
  lineVerticalBold: "┃",
  lineVerticalDouble: "║",
  lineVerticalDashed0: "┆",
  lineVerticalDashed1: "┇",
  lineVerticalDashed2: "┊",
  lineVerticalDashed3: "┋",
  lineVerticalDashed4: "╎",
  lineVerticalDashed5: "╏",
  lineVerticalDashed6: "╵",
  lineVerticalDashed7: "╷",
  lineVerticalDashed8: "╹",
  lineVerticalDashed9: "╻",
  lineVerticalDashed10: "╽",
  lineVerticalDashed11: "╿",
  lineDownLeft: "┐",
  lineDownLeftArc: "╮",
  lineDownBoldLeftBold: "┓",
  lineDownBoldLeft: "┒",
  lineDownLeftBold: "┑",
  lineDownDoubleLeftDouble: "╗",
  lineDownDoubleLeft: "╖",
  lineDownLeftDouble: "╕",
  lineDownRight: "┌",
  lineDownRightArc: "╭",
  lineDownBoldRightBold: "┏",
  lineDownBoldRight: "┎",
  lineDownRightBold: "┍",
  lineDownDoubleRightDouble: "╔",
  lineDownDoubleRight: "╓",
  lineDownRightDouble: "╒",
  lineUpLeft: "┘",
  lineUpLeftArc: "╯",
  lineUpBoldLeftBold: "┛",
  lineUpBoldLeft: "┚",
  lineUpLeftBold: "┙",
  lineUpDoubleLeftDouble: "╝",
  lineUpDoubleLeft: "╜",
  lineUpLeftDouble: "╛",
  lineUpRight: "└",
  lineUpRightArc: "╰",
  lineUpBoldRightBold: "┗",
  lineUpBoldRight: "┖",
  lineUpRightBold: "┕",
  lineUpDoubleRightDouble: "╚",
  lineUpDoubleRight: "╙",
  lineUpRightDouble: "╘",
  lineUpDownLeft: "┤",
  lineUpBoldDownBoldLeftBold: "┫",
  lineUpBoldDownBoldLeft: "┨",
  lineUpDownLeftBold: "┥",
  lineUpBoldDownLeftBold: "┩",
  lineUpDownBoldLeftBold: "┪",
  lineUpDownBoldLeft: "┧",
  lineUpBoldDownLeft: "┦",
  lineUpDoubleDownDoubleLeftDouble: "╣",
  lineUpDoubleDownDoubleLeft: "╢",
  lineUpDownLeftDouble: "╡",
  lineUpDownRight: "├",
  lineUpBoldDownBoldRightBold: "┣",
  lineUpBoldDownBoldRight: "┠",
  lineUpDownRightBold: "┝",
  lineUpBoldDownRightBold: "┡",
  lineUpDownBoldRightBold: "┢",
  lineUpDownBoldRight: "┟",
  lineUpBoldDownRight: "┞",
  lineUpDoubleDownDoubleRightDouble: "╠",
  lineUpDoubleDownDoubleRight: "╟",
  lineUpDownRightDouble: "╞",
  lineDownLeftRight: "┬",
  lineDownBoldLeftBoldRightBold: "┳",
  lineDownLeftBoldRightBold: "┯",
  lineDownBoldLeftRight: "┰",
  lineDownBoldLeftBoldRight: "┱",
  lineDownBoldLeftRightBold: "┲",
  lineDownLeftRightBold: "┮",
  lineDownLeftBoldRight: "┭",
  lineDownDoubleLeftDoubleRightDouble: "╦",
  lineDownDoubleLeftRight: "╥",
  lineDownLeftDoubleRightDouble: "╤",
  lineUpLeftRight: "┴",
  lineUpBoldLeftBoldRightBold: "┻",
  lineUpLeftBoldRightBold: "┷",
  lineUpBoldLeftRight: "┸",
  lineUpBoldLeftBoldRight: "┹",
  lineUpBoldLeftRightBold: "┺",
  lineUpLeftRightBold: "┶",
  lineUpLeftBoldRight: "┵",
  lineUpDoubleLeftDoubleRightDouble: "╩",
  lineUpDoubleLeftRight: "╨",
  lineUpLeftDoubleRightDouble: "╧",
  lineUpDownLeftRight: "┼",
  lineUpBoldDownBoldLeftBoldRightBold: "╋",
  lineUpDownBoldLeftBoldRightBold: "╈",
  lineUpBoldDownLeftBoldRightBold: "╇",
  lineUpBoldDownBoldLeftRightBold: "╊",
  lineUpBoldDownBoldLeftBoldRight: "╉",
  lineUpBoldDownLeftRight: "╀",
  lineUpDownBoldLeftRight: "╁",
  lineUpDownLeftBoldRight: "┽",
  lineUpDownLeftRightBold: "┾",
  lineUpBoldDownBoldLeftRight: "╂",
  lineUpDownLeftBoldRightBold: "┿",
  lineUpBoldDownLeftBoldRight: "╃",
  lineUpBoldDownLeftRightBold: "╄",
  lineUpDownBoldLeftBoldRight: "╅",
  lineUpDownBoldLeftRightBold: "╆",
  lineUpDoubleDownDoubleLeftDoubleRightDouble: "╬",
  lineUpDoubleDownDoubleLeftRight: "╫",
  lineUpDownLeftDoubleRightDouble: "╪",
  lineCross: "╳",
  lineBackslash: "╲",
  lineSlash: "╱"
};
const specialMainSymbols = {
  tick: "✔",
  info: "ℹ",
  warning: "⚠",
  cross: "✘",
  squareSmall: "◻",
  squareSmallFilled: "◼",
  circle: "◯",
  circleFilled: "◉",
  circleDotted: "◌",
  circleDouble: "◎",
  circleCircle: "ⓞ",
  circleCross: "ⓧ",
  circlePipe: "Ⓘ",
  radioOn: "◉",
  radioOff: "◯",
  checkboxOn: "☒",
  checkboxOff: "☐",
  checkboxCircleOn: "ⓧ",
  checkboxCircleOff: "Ⓘ",
  pointer: "❯",
  triangleUpOutline: "△",
  triangleLeft: "◀",
  triangleRight: "▶",
  lozenge: "◆",
  lozengeOutline: "◇",
  hamburger: "☰",
  smiley: "㋡",
  mustache: "෴",
  star: "★",
  play: "▶",
  nodejs: "⬢",
  oneSeventh: "⅐",
  oneNinth: "⅑",
  oneTenth: "⅒"
};
const specialFallbackSymbols = {
  tick: "√",
  info: "i",
  warning: "‼",
  cross: "×",
  squareSmall: "□",
  squareSmallFilled: "■",
  circle: "( )",
  circleFilled: "(*)",
  circleDotted: "( )",
  circleDouble: "( )",
  circleCircle: "(○)",
  circleCross: "(×)",
  circlePipe: "(│)",
  radioOn: "(*)",
  radioOff: "( )",
  checkboxOn: "[×]",
  checkboxOff: "[ ]",
  checkboxCircleOn: "(×)",
  checkboxCircleOff: "( )",
  pointer: ">",
  triangleUpOutline: "∆",
  triangleLeft: "◄",
  triangleRight: "►",
  lozenge: "♦",
  lozengeOutline: "◊",
  hamburger: "≡",
  smiley: "☺",
  mustache: "┌─┐",
  star: "✶",
  play: "►",
  nodejs: "♦",
  oneSeventh: "1/7",
  oneNinth: "1/9",
  oneTenth: "1/10"
};
const mainSymbols = { ...common, ...specialMainSymbols };
const fallbackSymbols = { ...common, ...specialFallbackSymbols };
const shouldUseMain = isUnicodeSupported();
const figures = shouldUseMain ? mainSymbols : fallbackSymbols;
const hasColors = ((_c = (_b = (_a = tty == null ? void 0 : tty.WriteStream) == null ? void 0 : _a.prototype) == null ? void 0 : _b.hasColors) == null ? void 0 : _c.call(_b)) ?? false;
const format$1 = (open, close) => {
  if (!hasColors) {
    return (input) => input;
  }
  const openCode = `\x1B[${open}m`;
  const closeCode = `\x1B[${close}m`;
  return (input) => {
    const string2 = input + "";
    let index = string2.indexOf(closeCode);
    if (index === -1) {
      return openCode + string2 + closeCode;
    }
    let result = openCode;
    let lastIndex = 0;
    const reopenOnNestedClose = close === 22;
    const replaceCode = (reopenOnNestedClose ? closeCode : "") + openCode;
    while (index !== -1) {
      result += string2.slice(lastIndex, index) + replaceCode;
      lastIndex = index + closeCode.length;
      index = string2.indexOf(closeCode, lastIndex);
    }
    result += string2.slice(lastIndex) + closeCode;
    return result;
  };
};
const bold = format$1(1, 22);
const gray = format$1(90, 39);
const redBright = format$1(91, 39);
const yellowBright = format$1(93, 39);
const defaultVerboseFunction = ({
  type,
  message,
  timestamp,
  piped,
  commandId,
  result: { failed = false } = {},
  options: { reject = true }
}) => {
  const timestampString = serializeTimestamp(timestamp);
  const icon = ICONS[type]({ failed, reject, piped });
  const color = COLORS[type]({ reject });
  return `${gray(`[${timestampString}]`)} ${gray(`[${commandId}]`)} ${color(icon)} ${color(message)}`;
};
const serializeTimestamp = (timestamp) => `${padField(timestamp.getHours(), 2)}:${padField(timestamp.getMinutes(), 2)}:${padField(timestamp.getSeconds(), 2)}.${padField(timestamp.getMilliseconds(), 3)}`;
const padField = (field, padding) => String(field).padStart(padding, "0");
const getFinalIcon = ({ failed, reject }) => {
  if (!failed) {
    return figures.tick;
  }
  return reject ? figures.cross : figures.warning;
};
const ICONS = {
  command: ({ piped }) => piped ? "|" : "$",
  output: () => " ",
  ipc: () => "*",
  error: getFinalIcon,
  duration: getFinalIcon
};
const identity$1 = (string2) => string2;
const COLORS = {
  command: () => bold,
  output: () => identity$1,
  ipc: () => identity$1,
  error: ({ reject }) => reject ? redBright : yellowBright,
  duration: () => gray
};
const applyVerboseOnLines = (printedLines, verboseInfo, fdNumber) => {
  const verboseFunction = getVerboseFunction(verboseInfo, fdNumber);
  return printedLines.map(({ verboseLine, verboseObject }) => applyVerboseFunction(verboseLine, verboseObject, verboseFunction)).filter((printedLine) => printedLine !== void 0).map((printedLine) => appendNewline(printedLine)).join("");
};
const applyVerboseFunction = (verboseLine, verboseObject, verboseFunction) => {
  if (verboseFunction === void 0) {
    return verboseLine;
  }
  const printedLine = verboseFunction(verboseLine, verboseObject);
  if (typeof printedLine === "string") {
    return printedLine;
  }
};
const appendNewline = (printedLine) => printedLine.endsWith("\n") ? printedLine : `${printedLine}
`;
const verboseLog = ({ type, verboseMessage, fdNumber, verboseInfo, result }) => {
  const verboseObject = getVerboseObject({ type, result, verboseInfo });
  const printedLines = getPrintedLines(verboseMessage, verboseObject);
  const finalLines = applyVerboseOnLines(printedLines, verboseInfo, fdNumber);
  if (finalLines !== "") {
    console.warn(finalLines.slice(0, -1));
  }
};
const getVerboseObject = ({
  type,
  result,
  verboseInfo: { escapedCommand, commandId, rawOptions: { piped = false, ...options } }
}) => ({
  type,
  escapedCommand,
  commandId: `${commandId}`,
  timestamp: /* @__PURE__ */ new Date(),
  piped,
  result,
  options
});
const getPrintedLines = (verboseMessage, verboseObject) => verboseMessage.split("\n").map((message) => getPrintedLine({ ...verboseObject, message }));
const getPrintedLine = (verboseObject) => {
  const verboseLine = defaultVerboseFunction(verboseObject);
  return { verboseLine, verboseObject };
};
const serializeVerboseMessage = (message) => {
  const messageString = typeof message === "string" ? message : node_util.inspect(message);
  const escapedMessage = escapeLines(messageString);
  return escapedMessage.replaceAll("	", " ".repeat(TAB_SIZE));
};
const TAB_SIZE = 2;
const logCommand = (escapedCommand, verboseInfo) => {
  if (!isVerbose(verboseInfo)) {
    return;
  }
  verboseLog({
    type: "command",
    verboseMessage: escapedCommand,
    verboseInfo
  });
};
const getVerboseInfo = (verbose, escapedCommand, rawOptions) => {
  validateVerbose(verbose);
  const commandId = getCommandId(verbose);
  return {
    verbose,
    escapedCommand,
    commandId,
    rawOptions
  };
};
const getCommandId = (verbose) => isVerbose({ verbose }) ? COMMAND_ID++ : void 0;
let COMMAND_ID = 0n;
const validateVerbose = (verbose) => {
  for (const fdVerbose of verbose) {
    if (fdVerbose === false) {
      throw new TypeError(`The "verbose: false" option was renamed to "verbose: 'none'".`);
    }
    if (fdVerbose === true) {
      throw new TypeError(`The "verbose: true" option was renamed to "verbose: 'short'".`);
    }
    if (!VERBOSE_VALUES.includes(fdVerbose) && !isVerboseFunction(fdVerbose)) {
      const allowedValues = VERBOSE_VALUES.map((allowedValue) => `'${allowedValue}'`).join(", ");
      throw new TypeError(`The "verbose" option must not be ${fdVerbose}. Allowed values are: ${allowedValues} or a function.`);
    }
  }
};
const getStartTime = () => process$2.hrtime.bigint();
const getDurationMs = (startTime) => Number(process$2.hrtime.bigint() - startTime) / 1e6;
const handleCommand = (filePath, rawArguments, rawOptions) => {
  const startTime = getStartTime();
  const { command, escapedCommand } = joinCommand(filePath, rawArguments);
  const verbose = normalizeFdSpecificOption(rawOptions, "verbose");
  const verboseInfo = getVerboseInfo(verbose, escapedCommand, { ...rawOptions });
  logCommand(escapedCommand, verboseInfo);
  return {
    command,
    escapedCommand,
    startTime,
    verboseInfo
  };
};
var crossSpawn$1 = { exports: {} };
var windows;
var hasRequiredWindows;
function requireWindows() {
  if (hasRequiredWindows) return windows;
  hasRequiredWindows = 1;
  windows = isexe2;
  isexe2.sync = sync2;
  var fs2 = require$$0$3;
  function checkPathExt(path2, options) {
    var pathext = options.pathExt !== void 0 ? options.pathExt : process.env.PATHEXT;
    if (!pathext) {
      return true;
    }
    pathext = pathext.split(";");
    if (pathext.indexOf("") !== -1) {
      return true;
    }
    for (var i2 = 0; i2 < pathext.length; i2++) {
      var p = pathext[i2].toLowerCase();
      if (p && path2.substr(-p.length).toLowerCase() === p) {
        return true;
      }
    }
    return false;
  }
  function checkStat(stat2, path2, options) {
    if (!stat2.isSymbolicLink() && !stat2.isFile()) {
      return false;
    }
    return checkPathExt(path2, options);
  }
  function isexe2(path2, options, cb) {
    fs2.stat(path2, function(er, stat2) {
      cb(er, er ? false : checkStat(stat2, path2, options));
    });
  }
  function sync2(path2, options) {
    return checkStat(fs2.statSync(path2), path2, options);
  }
  return windows;
}
var mode;
var hasRequiredMode;
function requireMode() {
  if (hasRequiredMode) return mode;
  hasRequiredMode = 1;
  mode = isexe2;
  isexe2.sync = sync2;
  var fs2 = require$$0$3;
  function isexe2(path2, options, cb) {
    fs2.stat(path2, function(er, stat2) {
      cb(er, er ? false : checkStat(stat2, options));
    });
  }
  function sync2(path2, options) {
    return checkStat(fs2.statSync(path2), options);
  }
  function checkStat(stat2, options) {
    return stat2.isFile() && checkMode(stat2, options);
  }
  function checkMode(stat2, options) {
    var mod = stat2.mode;
    var uid = stat2.uid;
    var gid = stat2.gid;
    var myUid = options.uid !== void 0 ? options.uid : process.getuid && process.getuid();
    var myGid = options.gid !== void 0 ? options.gid : process.getgid && process.getgid();
    var u2 = parseInt("100", 8);
    var g = parseInt("010", 8);
    var o2 = parseInt("001", 8);
    var ug = u2 | g;
    var ret = mod & o2 || mod & g && gid === myGid || mod & u2 && uid === myUid || mod & ug && myUid === 0;
    return ret;
  }
  return mode;
}
var core;
if (process.platform === "win32" || commonjsGlobal.TESTING_WINDOWS) {
  core = requireWindows();
} else {
  core = requireMode();
}
var isexe_1 = isexe$1;
isexe$1.sync = sync;
function isexe$1(path2, options, cb) {
  if (typeof options === "function") {
    cb = options;
    options = {};
  }
  if (!cb) {
    if (typeof Promise !== "function") {
      throw new TypeError("callback not provided");
    }
    return new Promise(function(resolve, reject) {
      isexe$1(path2, options || {}, function(er, is) {
        if (er) {
          reject(er);
        } else {
          resolve(is);
        }
      });
    });
  }
  core(path2, options || {}, function(er, is) {
    if (er) {
      if (er.code === "EACCES" || options && options.ignoreErrors) {
        er = null;
        is = false;
      }
    }
    cb(er, is);
  });
}
function sync(path2, options) {
  try {
    return core.sync(path2, options || {});
  } catch (er) {
    if (options && options.ignoreErrors || er.code === "EACCES") {
      return false;
    } else {
      throw er;
    }
  }
}
const isWindows = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys";
const path$2 = path$d;
const COLON = isWindows ? ";" : ":";
const isexe = isexe_1;
const getNotFoundError = (cmd) => Object.assign(new Error(`not found: ${cmd}`), { code: "ENOENT" });
const getPathInfo = (cmd, opt) => {
  const colon = opt.colon || COLON;
  const pathEnv = cmd.match(/\//) || isWindows && cmd.match(/\\/) ? [""] : [
    // windows always checks the cwd first
    ...isWindows ? [process.cwd()] : [],
    ...(opt.path || process.env.PATH || /* istanbul ignore next: very unusual */
    "").split(colon)
  ];
  const pathExtExe = isWindows ? opt.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM" : "";
  const pathExt = isWindows ? pathExtExe.split(colon) : [""];
  if (isWindows) {
    if (cmd.indexOf(".") !== -1 && pathExt[0] !== "")
      pathExt.unshift("");
  }
  return {
    pathEnv,
    pathExt,
    pathExtExe
  };
};
const which$1 = (cmd, opt, cb) => {
  if (typeof opt === "function") {
    cb = opt;
    opt = {};
  }
  if (!opt)
    opt = {};
  const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
  const found = [];
  const step = (i2) => new Promise((resolve, reject) => {
    if (i2 === pathEnv.length)
      return opt.all && found.length ? resolve(found) : reject(getNotFoundError(cmd));
    const ppRaw = pathEnv[i2];
    const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
    const pCmd = path$2.join(pathPart, cmd);
    const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
    resolve(subStep(p, i2, 0));
  });
  const subStep = (p, i2, ii) => new Promise((resolve, reject) => {
    if (ii === pathExt.length)
      return resolve(step(i2 + 1));
    const ext = pathExt[ii];
    isexe(p + ext, { pathExt: pathExtExe }, (er, is) => {
      if (!er && is) {
        if (opt.all)
          found.push(p + ext);
        else
          return resolve(p + ext);
      }
      return resolve(subStep(p, i2, ii + 1));
    });
  });
  return cb ? step(0).then((res) => cb(null, res), cb) : step(0);
};
const whichSync = (cmd, opt) => {
  opt = opt || {};
  const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
  const found = [];
  for (let i2 = 0; i2 < pathEnv.length; i2++) {
    const ppRaw = pathEnv[i2];
    const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
    const pCmd = path$2.join(pathPart, cmd);
    const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
    for (let j = 0; j < pathExt.length; j++) {
      const cur = p + pathExt[j];
      try {
        const is = isexe.sync(cur, { pathExt: pathExtExe });
        if (is) {
          if (opt.all)
            found.push(cur);
          else
            return cur;
        }
      } catch (ex) {
      }
    }
  }
  if (opt.all && found.length)
    return found;
  if (opt.nothrow)
    return null;
  throw getNotFoundError(cmd);
};
var which_1 = which$1;
which$1.sync = whichSync;
var pathKey$2 = { exports: {} };
const pathKey$1 = (options = {}) => {
  const environment = options.env || process.env;
  const platform = options.platform || process.platform;
  if (platform !== "win32") {
    return "PATH";
  }
  return Object.keys(environment).reverse().find((key) => key.toUpperCase() === "PATH") || "Path";
};
pathKey$2.exports = pathKey$1;
pathKey$2.exports.default = pathKey$1;
var pathKeyExports = pathKey$2.exports;
const path$1 = path$d;
const which = which_1;
const getPathKey = pathKeyExports;
function resolveCommandAttempt(parsed, withoutPathExt) {
  const env = parsed.options.env || process.env;
  const cwd = process.cwd();
  const hasCustomCwd = parsed.options.cwd != null;
  const shouldSwitchCwd = hasCustomCwd && process.chdir !== void 0 && !process.chdir.disabled;
  if (shouldSwitchCwd) {
    try {
      process.chdir(parsed.options.cwd);
    } catch (err) {
    }
  }
  let resolved;
  try {
    resolved = which.sync(parsed.command, {
      path: env[getPathKey({ env })],
      pathExt: withoutPathExt ? path$1.delimiter : void 0
    });
  } catch (e) {
  } finally {
    if (shouldSwitchCwd) {
      process.chdir(cwd);
    }
  }
  if (resolved) {
    resolved = path$1.resolve(hasCustomCwd ? parsed.options.cwd : "", resolved);
  }
  return resolved;
}
function resolveCommand$1(parsed) {
  return resolveCommandAttempt(parsed) || resolveCommandAttempt(parsed, true);
}
var resolveCommand_1 = resolveCommand$1;
var _escape = {};
const metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;
function escapeCommand(arg) {
  arg = arg.replace(metaCharsRegExp, "^$1");
  return arg;
}
function escapeArgument(arg, doubleEscapeMetaChars) {
  arg = `${arg}`;
  arg = arg.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
  arg = arg.replace(/(?=(\\+?)?)\1$/, "$1$1");
  arg = `"${arg}"`;
  arg = arg.replace(metaCharsRegExp, "^$1");
  if (doubleEscapeMetaChars) {
    arg = arg.replace(metaCharsRegExp, "^$1");
  }
  return arg;
}
_escape.command = escapeCommand;
_escape.argument = escapeArgument;
var shebangRegex$1 = /^#!(.*)/;
const shebangRegex = shebangRegex$1;
var shebangCommand$1 = (string2 = "") => {
  const match = string2.match(shebangRegex);
  if (!match) {
    return null;
  }
  const [path2, argument] = match[0].replace(/#! ?/, "").split(" ");
  const binary = path2.split("/").pop();
  if (binary === "env") {
    return argument;
  }
  return argument ? `${binary} ${argument}` : binary;
};
const fs = require$$0$3;
const shebangCommand = shebangCommand$1;
function readShebang$1(command) {
  const size = 150;
  const buffer = Buffer.alloc(size);
  let fd;
  try {
    fd = fs.openSync(command, "r");
    fs.readSync(fd, buffer, 0, size, 0);
    fs.closeSync(fd);
  } catch (e) {
  }
  return shebangCommand(buffer.toString());
}
var readShebang_1 = readShebang$1;
const path = path$d;
const resolveCommand = resolveCommand_1;
const escape = _escape;
const readShebang = readShebang_1;
const isWin$1 = process.platform === "win32";
const isExecutableRegExp = /\.(?:com|exe)$/i;
const isCmdShimRegExp = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
function detectShebang(parsed) {
  parsed.file = resolveCommand(parsed);
  const shebang = parsed.file && readShebang(parsed.file);
  if (shebang) {
    parsed.args.unshift(parsed.file);
    parsed.command = shebang;
    return resolveCommand(parsed);
  }
  return parsed.file;
}
function parseNonShell(parsed) {
  if (!isWin$1) {
    return parsed;
  }
  const commandFile = detectShebang(parsed);
  const needsShell = !isExecutableRegExp.test(commandFile);
  if (parsed.options.forceShell || needsShell) {
    const needsDoubleEscapeMetaChars = isCmdShimRegExp.test(commandFile);
    parsed.command = path.normalize(parsed.command);
    parsed.command = escape.command(parsed.command);
    parsed.args = parsed.args.map((arg) => escape.argument(arg, needsDoubleEscapeMetaChars));
    const shellCommand = [parsed.command].concat(parsed.args).join(" ");
    parsed.args = ["/d", "/s", "/c", `"${shellCommand}"`];
    parsed.command = process.env.comspec || "cmd.exe";
    parsed.options.windowsVerbatimArguments = true;
  }
  return parsed;
}
function parse$2(command, args, options) {
  if (args && !Array.isArray(args)) {
    options = args;
    args = null;
  }
  args = args ? args.slice(0) : [];
  options = Object.assign({}, options);
  const parsed = {
    command,
    args,
    options,
    file: void 0,
    original: {
      command,
      args
    }
  };
  return options.shell ? parsed : parseNonShell(parsed);
}
var parse_1 = parse$2;
const isWin = process.platform === "win32";
function notFoundError(original, syscall) {
  return Object.assign(new Error(`${syscall} ${original.command} ENOENT`), {
    code: "ENOENT",
    errno: "ENOENT",
    syscall: `${syscall} ${original.command}`,
    path: original.command,
    spawnargs: original.args
  });
}
function hookChildProcess(cp2, parsed) {
  if (!isWin) {
    return;
  }
  const originalEmit = cp2.emit;
  cp2.emit = function(name, arg1) {
    if (name === "exit") {
      const err = verifyENOENT(arg1, parsed);
      if (err) {
        return originalEmit.call(cp2, "error", err);
      }
    }
    return originalEmit.apply(cp2, arguments);
  };
}
function verifyENOENT(status, parsed) {
  if (isWin && status === 1 && !parsed.file) {
    return notFoundError(parsed.original, "spawn");
  }
  return null;
}
function verifyENOENTSync(status, parsed) {
  if (isWin && status === 1 && !parsed.file) {
    return notFoundError(parsed.original, "spawnSync");
  }
  return null;
}
var enoent$1 = {
  hookChildProcess,
  verifyENOENT,
  verifyENOENTSync,
  notFoundError
};
const cp = require$$0$5;
const parse$1 = parse_1;
const enoent = enoent$1;
function spawn(command, args, options) {
  const parsed = parse$1(command, args, options);
  const spawned = cp.spawn(parsed.command, parsed.args, parsed.options);
  enoent.hookChildProcess(spawned, parsed);
  return spawned;
}
function spawnSync(command, args, options) {
  const parsed = parse$1(command, args, options);
  const result = cp.spawnSync(parsed.command, parsed.args, parsed.options);
  result.error = result.error || enoent.verifyENOENTSync(result.status, parsed);
  return result;
}
crossSpawn$1.exports = spawn;
crossSpawn$1.exports.spawn = spawn;
crossSpawn$1.exports.sync = spawnSync;
crossSpawn$1.exports._parse = parse$1;
crossSpawn$1.exports._enoent = enoent;
var crossSpawnExports = crossSpawn$1.exports;
const crossSpawn = /* @__PURE__ */ getDefaultExportFromCjs(crossSpawnExports);
function pathKey(options = {}) {
  const {
    env = process.env,
    platform = process.platform
  } = options;
  if (platform !== "win32") {
    return "PATH";
  }
  return Object.keys(env).reverse().find((key) => key.toUpperCase() === "PATH") || "Path";
}
node_util.promisify(node_child_process.execFile);
function toPath(urlOrPath) {
  return urlOrPath instanceof URL ? node_url.fileURLToPath(urlOrPath) : urlOrPath;
}
function traversePathUp(startPath) {
  return {
    *[Symbol.iterator]() {
      let currentPath = path$e.resolve(toPath(startPath));
      let previousPath;
      while (previousPath !== currentPath) {
        yield currentPath;
        previousPath = currentPath;
        currentPath = path$e.resolve(currentPath, "..");
      }
    }
  };
}
const npmRunPath = ({
  cwd = process$2.cwd(),
  path: pathOption = process$2.env[pathKey()],
  preferLocal = true,
  execPath = process$2.execPath,
  addExecPath = true
} = {}) => {
  const cwdPath = path$e.resolve(toPath(cwd));
  const result = [];
  const pathParts = pathOption.split(path$e.delimiter);
  if (preferLocal) {
    applyPreferLocal(result, pathParts, cwdPath);
  }
  if (addExecPath) {
    applyExecPath(result, pathParts, execPath, cwdPath);
  }
  return pathOption === "" || pathOption === path$e.delimiter ? `${result.join(path$e.delimiter)}${pathOption}` : [...result, pathOption].join(path$e.delimiter);
};
const applyPreferLocal = (result, pathParts, cwdPath) => {
  for (const directory of traversePathUp(cwdPath)) {
    const pathPart = path$e.join(directory, "node_modules/.bin");
    if (!pathParts.includes(pathPart)) {
      result.push(pathPart);
    }
  }
};
const applyExecPath = (result, pathParts, execPath, cwdPath) => {
  const pathPart = path$e.resolve(cwdPath, toPath(execPath), "..");
  if (!pathParts.includes(pathPart)) {
    result.push(pathPart);
  }
};
const npmRunPathEnv = ({ env = process$2.env, ...options } = {}) => {
  env = { ...env };
  const pathName = pathKey({ env });
  options.path = env[pathName];
  env[pathName] = npmRunPath(options);
  return env;
};
const getFinalError = (originalError, message, isSync) => {
  const ErrorClass = isSync ? ExecaSyncError : ExecaError;
  const options = originalError instanceof DiscardedError ? {} : { cause: originalError };
  return new ErrorClass(message, options);
};
class DiscardedError extends Error {
}
const setErrorName = (ErrorClass, value) => {
  Object.defineProperty(ErrorClass.prototype, "name", {
    value,
    writable: true,
    enumerable: false,
    configurable: true
  });
  Object.defineProperty(ErrorClass.prototype, execaErrorSymbol, {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false
  });
};
const isExecaError = (error2) => isErrorInstance(error2) && execaErrorSymbol in error2;
const execaErrorSymbol = Symbol("isExecaError");
const isErrorInstance = (value) => Object.prototype.toString.call(value) === "[object Error]";
class ExecaError extends Error {
}
setErrorName(ExecaError, ExecaError.name);
class ExecaSyncError extends Error {
}
setErrorName(ExecaSyncError, ExecaSyncError.name);
const getRealtimeSignals = () => {
  const length = SIGRTMAX - SIGRTMIN + 1;
  return Array.from({ length }, getRealtimeSignal);
};
const getRealtimeSignal = (value, index) => ({
  name: `SIGRT${index + 1}`,
  number: SIGRTMIN + index,
  action: "terminate",
  description: "Application-specific signal (realtime)",
  standard: "posix"
});
const SIGRTMIN = 34;
const SIGRTMAX = 64;
const SIGNALS = [
  {
    name: "SIGHUP",
    number: 1,
    action: "terminate",
    description: "Terminal closed",
    standard: "posix"
  },
  {
    name: "SIGINT",
    number: 2,
    action: "terminate",
    description: "User interruption with CTRL-C",
    standard: "ansi"
  },
  {
    name: "SIGQUIT",
    number: 3,
    action: "core",
    description: "User interruption with CTRL-\\",
    standard: "posix"
  },
  {
    name: "SIGILL",
    number: 4,
    action: "core",
    description: "Invalid machine instruction",
    standard: "ansi"
  },
  {
    name: "SIGTRAP",
    number: 5,
    action: "core",
    description: "Debugger breakpoint",
    standard: "posix"
  },
  {
    name: "SIGABRT",
    number: 6,
    action: "core",
    description: "Aborted",
    standard: "ansi"
  },
  {
    name: "SIGIOT",
    number: 6,
    action: "core",
    description: "Aborted",
    standard: "bsd"
  },
  {
    name: "SIGBUS",
    number: 7,
    action: "core",
    description: "Bus error due to misaligned, non-existing address or paging error",
    standard: "bsd"
  },
  {
    name: "SIGEMT",
    number: 7,
    action: "terminate",
    description: "Command should be emulated but is not implemented",
    standard: "other"
  },
  {
    name: "SIGFPE",
    number: 8,
    action: "core",
    description: "Floating point arithmetic error",
    standard: "ansi"
  },
  {
    name: "SIGKILL",
    number: 9,
    action: "terminate",
    description: "Forced termination",
    standard: "posix",
    forced: true
  },
  {
    name: "SIGUSR1",
    number: 10,
    action: "terminate",
    description: "Application-specific signal",
    standard: "posix"
  },
  {
    name: "SIGSEGV",
    number: 11,
    action: "core",
    description: "Segmentation fault",
    standard: "ansi"
  },
  {
    name: "SIGUSR2",
    number: 12,
    action: "terminate",
    description: "Application-specific signal",
    standard: "posix"
  },
  {
    name: "SIGPIPE",
    number: 13,
    action: "terminate",
    description: "Broken pipe or socket",
    standard: "posix"
  },
  {
    name: "SIGALRM",
    number: 14,
    action: "terminate",
    description: "Timeout or timer",
    standard: "posix"
  },
  {
    name: "SIGTERM",
    number: 15,
    action: "terminate",
    description: "Termination",
    standard: "ansi"
  },
  {
    name: "SIGSTKFLT",
    number: 16,
    action: "terminate",
    description: "Stack is empty or overflowed",
    standard: "other"
  },
  {
    name: "SIGCHLD",
    number: 17,
    action: "ignore",
    description: "Child process terminated, paused or unpaused",
    standard: "posix"
  },
  {
    name: "SIGCLD",
    number: 17,
    action: "ignore",
    description: "Child process terminated, paused or unpaused",
    standard: "other"
  },
  {
    name: "SIGCONT",
    number: 18,
    action: "unpause",
    description: "Unpaused",
    standard: "posix",
    forced: true
  },
  {
    name: "SIGSTOP",
    number: 19,
    action: "pause",
    description: "Paused",
    standard: "posix",
    forced: true
  },
  {
    name: "SIGTSTP",
    number: 20,
    action: "pause",
    description: 'Paused using CTRL-Z or "suspend"',
    standard: "posix"
  },
  {
    name: "SIGTTIN",
    number: 21,
    action: "pause",
    description: "Background process cannot read terminal input",
    standard: "posix"
  },
  {
    name: "SIGBREAK",
    number: 21,
    action: "terminate",
    description: "User interruption with CTRL-BREAK",
    standard: "other"
  },
  {
    name: "SIGTTOU",
    number: 22,
    action: "pause",
    description: "Background process cannot write to terminal output",
    standard: "posix"
  },
  {
    name: "SIGURG",
    number: 23,
    action: "ignore",
    description: "Socket received out-of-band data",
    standard: "bsd"
  },
  {
    name: "SIGXCPU",
    number: 24,
    action: "core",
    description: "Process timed out",
    standard: "bsd"
  },
  {
    name: "SIGXFSZ",
    number: 25,
    action: "core",
    description: "File too big",
    standard: "bsd"
  },
  {
    name: "SIGVTALRM",
    number: 26,
    action: "terminate",
    description: "Timeout or timer",
    standard: "bsd"
  },
  {
    name: "SIGPROF",
    number: 27,
    action: "terminate",
    description: "Timeout or timer",
    standard: "bsd"
  },
  {
    name: "SIGWINCH",
    number: 28,
    action: "ignore",
    description: "Terminal window size changed",
    standard: "bsd"
  },
  {
    name: "SIGIO",
    number: 29,
    action: "terminate",
    description: "I/O is available",
    standard: "other"
  },
  {
    name: "SIGPOLL",
    number: 29,
    action: "terminate",
    description: "Watched event",
    standard: "other"
  },
  {
    name: "SIGINFO",
    number: 29,
    action: "ignore",
    description: "Request for process information",
    standard: "other"
  },
  {
    name: "SIGPWR",
    number: 30,
    action: "terminate",
    description: "Device running out of power",
    standard: "systemv"
  },
  {
    name: "SIGSYS",
    number: 31,
    action: "core",
    description: "Invalid system call",
    standard: "other"
  },
  {
    name: "SIGUNUSED",
    number: 31,
    action: "terminate",
    description: "Invalid system call",
    standard: "other"
  }
];
const getSignals = () => {
  const realtimeSignals = getRealtimeSignals();
  const signals2 = [...SIGNALS, ...realtimeSignals].map(normalizeSignal$1);
  return signals2;
};
const normalizeSignal$1 = ({
  name,
  number: defaultNumber,
  description,
  action,
  forced = false,
  standard
}) => {
  const {
    signals: { [name]: constantSignal }
  } = node_os.constants;
  const supported = constantSignal !== void 0;
  const number = supported ? constantSignal : defaultNumber;
  return { name, number, description, supported, action, forced, standard };
};
const getSignalsByName = () => {
  const signals2 = getSignals();
  return Object.fromEntries(signals2.map(getSignalByName));
};
const getSignalByName = ({
  name,
  number,
  description,
  supported,
  action,
  forced,
  standard
}) => [name, { name, number, description, supported, action, forced, standard }];
const signalsByName = getSignalsByName();
const getSignalsByNumber = () => {
  const signals2 = getSignals();
  const length = SIGRTMAX + 1;
  const signalsA = Array.from(
    { length },
    (value, number) => getSignalByNumber(number, signals2)
  );
  return Object.assign({}, ...signalsA);
};
const getSignalByNumber = (number, signals2) => {
  const signal = findSignalByNumber(number, signals2);
  if (signal === void 0) {
    return {};
  }
  const { name, description, supported, action, forced, standard } = signal;
  return {
    [number]: {
      name,
      number,
      description,
      supported,
      action,
      forced,
      standard
    }
  };
};
const findSignalByNumber = (number, signals2) => {
  const signal = signals2.find(({ name }) => node_os.constants.signals[name] === number);
  if (signal !== void 0) {
    return signal;
  }
  return signals2.find((signalA) => signalA.number === number);
};
getSignalsByNumber();
const normalizeKillSignal = (killSignal) => {
  const optionName = "option `killSignal`";
  if (killSignal === 0) {
    throw new TypeError(`Invalid ${optionName}: 0 cannot be used.`);
  }
  return normalizeSignal(killSignal, optionName);
};
const normalizeSignalArgument = (signal) => signal === 0 ? signal : normalizeSignal(signal, "`subprocess.kill()`'s argument");
const normalizeSignal = (signalNameOrInteger, optionName) => {
  if (Number.isInteger(signalNameOrInteger)) {
    return normalizeSignalInteger(signalNameOrInteger, optionName);
  }
  if (typeof signalNameOrInteger === "string") {
    return normalizeSignalName(signalNameOrInteger, optionName);
  }
  throw new TypeError(`Invalid ${optionName} ${String(signalNameOrInteger)}: it must be a string or an integer.
${getAvailableSignals()}`);
};
const normalizeSignalInteger = (signalInteger, optionName) => {
  if (signalsIntegerToName.has(signalInteger)) {
    return signalsIntegerToName.get(signalInteger);
  }
  throw new TypeError(`Invalid ${optionName} ${signalInteger}: this signal integer does not exist.
${getAvailableSignals()}`);
};
const getSignalsIntegerToName = () => new Map(Object.entries(node_os.constants.signals).reverse().map(([signalName, signalInteger]) => [signalInteger, signalName]));
const signalsIntegerToName = getSignalsIntegerToName();
const normalizeSignalName = (signalName, optionName) => {
  if (signalName in node_os.constants.signals) {
    return signalName;
  }
  if (signalName.toUpperCase() in node_os.constants.signals) {
    throw new TypeError(`Invalid ${optionName} '${signalName}': please rename it to '${signalName.toUpperCase()}'.`);
  }
  throw new TypeError(`Invalid ${optionName} '${signalName}': this signal name does not exist.
${getAvailableSignals()}`);
};
const getAvailableSignals = () => `Available signal names: ${getAvailableSignalNames()}.
Available signal numbers: ${getAvailableSignalIntegers()}.`;
const getAvailableSignalNames = () => Object.keys(node_os.constants.signals).sort().map((signalName) => `'${signalName}'`).join(", ");
const getAvailableSignalIntegers = () => [...new Set(Object.values(node_os.constants.signals).sort((signalInteger, signalIntegerTwo) => signalInteger - signalIntegerTwo))].join(", ");
const getSignalDescription = (signal) => signalsByName[signal].description;
const normalizeForceKillAfterDelay = (forceKillAfterDelay) => {
  if (forceKillAfterDelay === false) {
    return forceKillAfterDelay;
  }
  if (forceKillAfterDelay === true) {
    return DEFAULT_FORCE_KILL_TIMEOUT;
  }
  if (!Number.isFinite(forceKillAfterDelay) || forceKillAfterDelay < 0) {
    throw new TypeError(`Expected the \`forceKillAfterDelay\` option to be a non-negative integer, got \`${forceKillAfterDelay}\` (${typeof forceKillAfterDelay})`);
  }
  return forceKillAfterDelay;
};
const DEFAULT_FORCE_KILL_TIMEOUT = 1e3 * 5;
const subprocessKill = ({ kill, options: { forceKillAfterDelay, killSignal }, onInternalError, context, controller }, signalOrError, errorArgument) => {
  const { signal, error: error2 } = parseKillArguments(signalOrError, errorArgument, killSignal);
  emitKillError(error2, onInternalError);
  const killResult = kill(signal);
  setKillTimeout({
    kill,
    signal,
    forceKillAfterDelay,
    killSignal,
    killResult,
    context,
    controller
  });
  return killResult;
};
const parseKillArguments = (signalOrError, errorArgument, killSignal) => {
  const [signal = killSignal, error2] = isErrorInstance(signalOrError) ? [void 0, signalOrError] : [signalOrError, errorArgument];
  if (typeof signal !== "string" && !Number.isInteger(signal)) {
    throw new TypeError(`The first argument must be an error instance or a signal name string/integer: ${String(signal)}`);
  }
  if (error2 !== void 0 && !isErrorInstance(error2)) {
    throw new TypeError(`The second argument is optional. If specified, it must be an error instance: ${error2}`);
  }
  return { signal: normalizeSignalArgument(signal), error: error2 };
};
const emitKillError = (error2, onInternalError) => {
  if (error2 !== void 0) {
    onInternalError.reject(error2);
  }
};
const setKillTimeout = async ({ kill, signal, forceKillAfterDelay, killSignal, killResult, context, controller }) => {
  if (signal === killSignal && killResult) {
    killOnTimeout({
      kill,
      forceKillAfterDelay,
      context,
      controllerSignal: controller.signal
    });
  }
};
const killOnTimeout = async ({ kill, forceKillAfterDelay, context, controllerSignal }) => {
  if (forceKillAfterDelay === false) {
    return;
  }
  try {
    await promises.setTimeout(forceKillAfterDelay, void 0, { signal: controllerSignal });
    if (kill("SIGKILL")) {
      context.isForcefullyTerminated ?? (context.isForcefullyTerminated = true);
    }
  } catch {
  }
};
const onAbortedSignal = async (mainSignal, stopSignal) => {
  if (!mainSignal.aborted) {
    await node_events.once(mainSignal, "abort", { signal: stopSignal });
  }
};
const validateCancelSignal = ({ cancelSignal }) => {
  if (cancelSignal !== void 0 && Object.prototype.toString.call(cancelSignal) !== "[object AbortSignal]") {
    throw new Error(`The \`cancelSignal\` option must be an AbortSignal: ${String(cancelSignal)}`);
  }
};
const throwOnCancel = ({ subprocess, cancelSignal, gracefulCancel, context, controller }) => cancelSignal === void 0 || gracefulCancel ? [] : [terminateOnCancel(subprocess, cancelSignal, context, controller)];
const terminateOnCancel = async (subprocess, cancelSignal, context, { signal }) => {
  await onAbortedSignal(cancelSignal, signal);
  context.terminationReason ?? (context.terminationReason = "cancel");
  subprocess.kill();
  throw cancelSignal.reason;
};
const validateIpcMethod = ({ methodName, isSubprocess, ipc, isConnected: isConnected2 }) => {
  validateIpcOption(methodName, isSubprocess, ipc);
  validateConnection(methodName, isSubprocess, isConnected2);
};
const validateIpcOption = (methodName, isSubprocess, ipc) => {
  if (!ipc) {
    throw new Error(`${getMethodName(methodName, isSubprocess)} can only be used if the \`ipc\` option is \`true\`.`);
  }
};
const validateConnection = (methodName, isSubprocess, isConnected2) => {
  if (!isConnected2) {
    throw new Error(`${getMethodName(methodName, isSubprocess)} cannot be used: the ${getOtherProcessName(isSubprocess)} has already exited or disconnected.`);
  }
};
const throwOnEarlyDisconnect = (isSubprocess) => {
  throw new Error(`${getMethodName("getOneMessage", isSubprocess)} could not complete: the ${getOtherProcessName(isSubprocess)} exited or disconnected.`);
};
const throwOnStrictDeadlockError = (isSubprocess) => {
  throw new Error(`${getMethodName("sendMessage", isSubprocess)} failed: the ${getOtherProcessName(isSubprocess)} is sending a message too, instead of listening to incoming messages.
This can be fixed by both sending a message and listening to incoming messages at the same time:

const [receivedMessage] = await Promise.all([
	${getMethodName("getOneMessage", isSubprocess)},
	${getMethodName("sendMessage", isSubprocess, "message, {strict: true}")},
]);`);
};
const getStrictResponseError = (error2, isSubprocess) => new Error(`${getMethodName("sendMessage", isSubprocess)} failed when sending an acknowledgment response to the ${getOtherProcessName(isSubprocess)}.`, { cause: error2 });
const throwOnMissingStrict = (isSubprocess) => {
  throw new Error(`${getMethodName("sendMessage", isSubprocess)} failed: the ${getOtherProcessName(isSubprocess)} is not listening to incoming messages.`);
};
const throwOnStrictDisconnect = (isSubprocess) => {
  throw new Error(`${getMethodName("sendMessage", isSubprocess)} failed: the ${getOtherProcessName(isSubprocess)} exited without listening to incoming messages.`);
};
const getAbortDisconnectError = () => new Error(`\`cancelSignal\` aborted: the ${getOtherProcessName(true)} disconnected.`);
const throwOnMissingParent = () => {
  throw new Error("`getCancelSignal()` cannot be used without setting the `cancelSignal` subprocess option.");
};
const handleEpipeError = ({ error: error2, methodName, isSubprocess }) => {
  if (error2.code === "EPIPE") {
    throw new Error(`${getMethodName(methodName, isSubprocess)} cannot be used: the ${getOtherProcessName(isSubprocess)} is disconnecting.`, { cause: error2 });
  }
};
const handleSerializationError = ({ error: error2, methodName, isSubprocess, message }) => {
  if (isSerializationError(error2)) {
    throw new Error(`${getMethodName(methodName, isSubprocess)}'s argument type is invalid: the message cannot be serialized: ${String(message)}.`, { cause: error2 });
  }
};
const isSerializationError = ({ code, message }) => SERIALIZATION_ERROR_CODES.has(code) || SERIALIZATION_ERROR_MESSAGES.some((serializationErrorMessage) => message.includes(serializationErrorMessage));
const SERIALIZATION_ERROR_CODES = /* @__PURE__ */ new Set([
  // Message is `undefined`
  "ERR_MISSING_ARGS",
  // Message is a function, a bigint, a symbol
  "ERR_INVALID_ARG_TYPE"
]);
const SERIALIZATION_ERROR_MESSAGES = [
  // Message is a promise or a proxy, with `serialization: 'advanced'`
  "could not be cloned",
  // Message has cycles, with `serialization: 'json'`
  "circular structure",
  // Message has cycles inside toJSON(), with `serialization: 'json'`
  "call stack size exceeded"
];
const getMethodName = (methodName, isSubprocess, parameters = "") => methodName === "cancelSignal" ? "`cancelSignal`'s `controller.abort()`" : `${getNamespaceName(isSubprocess)}${methodName}(${parameters})`;
const getNamespaceName = (isSubprocess) => isSubprocess ? "" : "subprocess.";
const getOtherProcessName = (isSubprocess) => isSubprocess ? "parent process" : "subprocess";
const disconnect = (anyProcess) => {
  if (anyProcess.connected) {
    anyProcess.disconnect();
  }
};
const createDeferred = () => {
  const methods = {};
  const promise2 = new Promise((resolve, reject) => {
    Object.assign(methods, { resolve, reject });
  });
  return Object.assign(promise2, methods);
};
const getToStream = (destination, to = "stdin") => {
  const isWritable = true;
  const { options, fileDescriptors } = SUBPROCESS_OPTIONS.get(destination);
  const fdNumber = getFdNumber(fileDescriptors, to, isWritable);
  const destinationStream = destination.stdio[fdNumber];
  if (destinationStream === null) {
    throw new TypeError(getInvalidStdioOptionMessage(fdNumber, to, options, isWritable));
  }
  return destinationStream;
};
const getFromStream = (source, from = "stdout") => {
  const isWritable = false;
  const { options, fileDescriptors } = SUBPROCESS_OPTIONS.get(source);
  const fdNumber = getFdNumber(fileDescriptors, from, isWritable);
  const sourceStream = fdNumber === "all" ? source.all : source.stdio[fdNumber];
  if (sourceStream === null || sourceStream === void 0) {
    throw new TypeError(getInvalidStdioOptionMessage(fdNumber, from, options, isWritable));
  }
  return sourceStream;
};
const SUBPROCESS_OPTIONS = /* @__PURE__ */ new WeakMap();
const getFdNumber = (fileDescriptors, fdName, isWritable) => {
  const fdNumber = parseFdNumber(fdName, isWritable);
  validateFdNumber(fdNumber, fdName, isWritable, fileDescriptors);
  return fdNumber;
};
const parseFdNumber = (fdName, isWritable) => {
  const fdNumber = parseFd(fdName);
  if (fdNumber !== void 0) {
    return fdNumber;
  }
  const { validOptions, defaultValue } = isWritable ? { validOptions: '"stdin"', defaultValue: "stdin" } : { validOptions: '"stdout", "stderr", "all"', defaultValue: "stdout" };
  throw new TypeError(`"${getOptionName(isWritable)}" must not be "${fdName}".
It must be ${validOptions} or "fd3", "fd4" (and so on).
It is optional and defaults to "${defaultValue}".`);
};
const validateFdNumber = (fdNumber, fdName, isWritable, fileDescriptors) => {
  const fileDescriptor = fileDescriptors[getUsedDescriptor(fdNumber)];
  if (fileDescriptor === void 0) {
    throw new TypeError(`"${getOptionName(isWritable)}" must not be ${fdName}. That file descriptor does not exist.
Please set the "stdio" option to ensure that file descriptor exists.`);
  }
  if (fileDescriptor.direction === "input" && !isWritable) {
    throw new TypeError(`"${getOptionName(isWritable)}" must not be ${fdName}. It must be a readable stream, not writable.`);
  }
  if (fileDescriptor.direction !== "input" && isWritable) {
    throw new TypeError(`"${getOptionName(isWritable)}" must not be ${fdName}. It must be a writable stream, not readable.`);
  }
};
const getInvalidStdioOptionMessage = (fdNumber, fdName, options, isWritable) => {
  if (fdNumber === "all" && !options.all) {
    return `The "all" option must be true to use "from: 'all'".`;
  }
  const { optionName, optionValue } = getInvalidStdioOption(fdNumber, options);
  return `The "${optionName}: ${serializeOptionValue(optionValue)}" option is incompatible with using "${getOptionName(isWritable)}: ${serializeOptionValue(fdName)}".
Please set this option with "pipe" instead.`;
};
const getInvalidStdioOption = (fdNumber, { stdin, stdout, stderr, stdio }) => {
  const usedDescriptor = getUsedDescriptor(fdNumber);
  if (usedDescriptor === 0 && stdin !== void 0) {
    return { optionName: "stdin", optionValue: stdin };
  }
  if (usedDescriptor === 1 && stdout !== void 0) {
    return { optionName: "stdout", optionValue: stdout };
  }
  if (usedDescriptor === 2 && stderr !== void 0) {
    return { optionName: "stderr", optionValue: stderr };
  }
  return { optionName: `stdio[${usedDescriptor}]`, optionValue: stdio[usedDescriptor] };
};
const getUsedDescriptor = (fdNumber) => fdNumber === "all" ? 1 : fdNumber;
const getOptionName = (isWritable) => isWritable ? "to" : "from";
const serializeOptionValue = (value) => {
  if (typeof value === "string") {
    return `'${value}'`;
  }
  return typeof value === "number" ? `${value}` : "Stream";
};
const incrementMaxListeners = (eventEmitter, maxListenersIncrement, signal) => {
  const maxListeners = eventEmitter.getMaxListeners();
  if (maxListeners === 0 || maxListeners === Number.POSITIVE_INFINITY) {
    return;
  }
  eventEmitter.setMaxListeners(maxListeners + maxListenersIncrement);
  node_events.addAbortListener(signal, () => {
    eventEmitter.setMaxListeners(eventEmitter.getMaxListeners() - maxListenersIncrement);
  });
};
const addReference = (channel, reference) => {
  if (reference) {
    addReferenceCount(channel);
  }
};
const addReferenceCount = (channel) => {
  channel.refCounted();
};
const removeReference = (channel, reference) => {
  if (reference) {
    removeReferenceCount(channel);
  }
};
const removeReferenceCount = (channel) => {
  channel.unrefCounted();
};
const undoAddedReferences = (channel, isSubprocess) => {
  if (isSubprocess) {
    removeReferenceCount(channel);
    removeReferenceCount(channel);
  }
};
const redoAddedReferences = (channel, isSubprocess) => {
  if (isSubprocess) {
    addReferenceCount(channel);
    addReferenceCount(channel);
  }
};
const onMessage = async ({ anyProcess, channel, isSubprocess, ipcEmitter }, wrappedMessage) => {
  if (handleStrictResponse(wrappedMessage) || handleAbort(wrappedMessage)) {
    return;
  }
  if (!INCOMING_MESSAGES.has(anyProcess)) {
    INCOMING_MESSAGES.set(anyProcess, []);
  }
  const incomingMessages = INCOMING_MESSAGES.get(anyProcess);
  incomingMessages.push(wrappedMessage);
  if (incomingMessages.length > 1) {
    return;
  }
  while (incomingMessages.length > 0) {
    await waitForOutgoingMessages(anyProcess, ipcEmitter, wrappedMessage);
    await promises.scheduler.yield();
    const message = await handleStrictRequest({
      wrappedMessage: incomingMessages[0],
      anyProcess,
      channel,
      isSubprocess,
      ipcEmitter
    });
    incomingMessages.shift();
    ipcEmitter.emit("message", message);
    ipcEmitter.emit("message:done");
  }
};
const onDisconnect = async ({ anyProcess, channel, isSubprocess, ipcEmitter, boundOnMessage }) => {
  abortOnDisconnect();
  const incomingMessages = INCOMING_MESSAGES.get(anyProcess);
  while ((incomingMessages == null ? void 0 : incomingMessages.length) > 0) {
    await node_events.once(ipcEmitter, "message:done");
  }
  anyProcess.removeListener("message", boundOnMessage);
  redoAddedReferences(channel, isSubprocess);
  ipcEmitter.connected = false;
  ipcEmitter.emit("disconnect");
};
const INCOMING_MESSAGES = /* @__PURE__ */ new WeakMap();
const getIpcEmitter = (anyProcess, channel, isSubprocess) => {
  if (IPC_EMITTERS.has(anyProcess)) {
    return IPC_EMITTERS.get(anyProcess);
  }
  const ipcEmitter = new node_events.EventEmitter();
  ipcEmitter.connected = true;
  IPC_EMITTERS.set(anyProcess, ipcEmitter);
  forwardEvents({
    ipcEmitter,
    anyProcess,
    channel,
    isSubprocess
  });
  return ipcEmitter;
};
const IPC_EMITTERS = /* @__PURE__ */ new WeakMap();
const forwardEvents = ({ ipcEmitter, anyProcess, channel, isSubprocess }) => {
  const boundOnMessage = onMessage.bind(void 0, {
    anyProcess,
    channel,
    isSubprocess,
    ipcEmitter
  });
  anyProcess.on("message", boundOnMessage);
  anyProcess.once("disconnect", onDisconnect.bind(void 0, {
    anyProcess,
    channel,
    isSubprocess,
    ipcEmitter,
    boundOnMessage
  }));
  undoAddedReferences(channel, isSubprocess);
};
const isConnected = (anyProcess) => {
  const ipcEmitter = IPC_EMITTERS.get(anyProcess);
  return ipcEmitter === void 0 ? anyProcess.channel !== null : ipcEmitter.connected;
};
const handleSendStrict = ({ anyProcess, channel, isSubprocess, message, strict }) => {
  if (!strict) {
    return message;
  }
  const ipcEmitter = getIpcEmitter(anyProcess, channel, isSubprocess);
  const hasListeners = hasMessageListeners(anyProcess, ipcEmitter);
  return {
    id: count++,
    type: REQUEST_TYPE,
    message,
    hasListeners
  };
};
let count = 0n;
const validateStrictDeadlock = (outgoingMessages, wrappedMessage) => {
  if ((wrappedMessage == null ? void 0 : wrappedMessage.type) !== REQUEST_TYPE || wrappedMessage.hasListeners) {
    return;
  }
  for (const { id } of outgoingMessages) {
    if (id !== void 0) {
      STRICT_RESPONSES[id].resolve({ isDeadlock: true, hasListeners: false });
    }
  }
};
const handleStrictRequest = async ({ wrappedMessage, anyProcess, channel, isSubprocess, ipcEmitter }) => {
  if ((wrappedMessage == null ? void 0 : wrappedMessage.type) !== REQUEST_TYPE || !anyProcess.connected) {
    return wrappedMessage;
  }
  const { id, message } = wrappedMessage;
  const response = { id, type: RESPONSE_TYPE, message: hasMessageListeners(anyProcess, ipcEmitter) };
  try {
    await sendMessage({
      anyProcess,
      channel,
      isSubprocess,
      ipc: true
    }, response);
  } catch (error2) {
    ipcEmitter.emit("strict:error", error2);
  }
  return message;
};
const handleStrictResponse = (wrappedMessage) => {
  var _a2;
  if ((wrappedMessage == null ? void 0 : wrappedMessage.type) !== RESPONSE_TYPE) {
    return false;
  }
  const { id, message: hasListeners } = wrappedMessage;
  (_a2 = STRICT_RESPONSES[id]) == null ? void 0 : _a2.resolve({ isDeadlock: false, hasListeners });
  return true;
};
const waitForStrictResponse = async (wrappedMessage, anyProcess, isSubprocess) => {
  if ((wrappedMessage == null ? void 0 : wrappedMessage.type) !== REQUEST_TYPE) {
    return;
  }
  const deferred = createDeferred();
  STRICT_RESPONSES[wrappedMessage.id] = deferred;
  const controller = new AbortController();
  try {
    const { isDeadlock, hasListeners } = await Promise.race([
      deferred,
      throwOnDisconnect$1(anyProcess, isSubprocess, controller)
    ]);
    if (isDeadlock) {
      throwOnStrictDeadlockError(isSubprocess);
    }
    if (!hasListeners) {
      throwOnMissingStrict(isSubprocess);
    }
  } finally {
    controller.abort();
    delete STRICT_RESPONSES[wrappedMessage.id];
  }
};
const STRICT_RESPONSES = {};
const throwOnDisconnect$1 = async (anyProcess, isSubprocess, { signal }) => {
  incrementMaxListeners(anyProcess, 1, signal);
  await node_events.once(anyProcess, "disconnect", { signal });
  throwOnStrictDisconnect(isSubprocess);
};
const REQUEST_TYPE = "execa:ipc:request";
const RESPONSE_TYPE = "execa:ipc:response";
const startSendMessage = (anyProcess, wrappedMessage, strict) => {
  if (!OUTGOING_MESSAGES.has(anyProcess)) {
    OUTGOING_MESSAGES.set(anyProcess, /* @__PURE__ */ new Set());
  }
  const outgoingMessages = OUTGOING_MESSAGES.get(anyProcess);
  const onMessageSent = createDeferred();
  const id = strict ? wrappedMessage.id : void 0;
  const outgoingMessage = { onMessageSent, id };
  outgoingMessages.add(outgoingMessage);
  return { outgoingMessages, outgoingMessage };
};
const endSendMessage = ({ outgoingMessages, outgoingMessage }) => {
  outgoingMessages.delete(outgoingMessage);
  outgoingMessage.onMessageSent.resolve();
};
const waitForOutgoingMessages = async (anyProcess, ipcEmitter, wrappedMessage) => {
  var _a2;
  while (!hasMessageListeners(anyProcess, ipcEmitter) && ((_a2 = OUTGOING_MESSAGES.get(anyProcess)) == null ? void 0 : _a2.size) > 0) {
    const outgoingMessages = [...OUTGOING_MESSAGES.get(anyProcess)];
    validateStrictDeadlock(outgoingMessages, wrappedMessage);
    await Promise.all(outgoingMessages.map(({ onMessageSent }) => onMessageSent));
  }
};
const OUTGOING_MESSAGES = /* @__PURE__ */ new WeakMap();
const hasMessageListeners = (anyProcess, ipcEmitter) => ipcEmitter.listenerCount("message") > getMinListenerCount(anyProcess);
const getMinListenerCount = (anyProcess) => SUBPROCESS_OPTIONS.has(anyProcess) && !getFdSpecificValue(SUBPROCESS_OPTIONS.get(anyProcess).options.buffer, "ipc") ? 1 : 0;
const sendMessage = ({ anyProcess, channel, isSubprocess, ipc }, message, { strict = false } = {}) => {
  const methodName = "sendMessage";
  validateIpcMethod({
    methodName,
    isSubprocess,
    ipc,
    isConnected: anyProcess.connected
  });
  return sendMessageAsync({
    anyProcess,
    channel,
    methodName,
    isSubprocess,
    message,
    strict
  });
};
const sendMessageAsync = async ({ anyProcess, channel, methodName, isSubprocess, message, strict }) => {
  const wrappedMessage = handleSendStrict({
    anyProcess,
    channel,
    isSubprocess,
    message,
    strict
  });
  const outgoingMessagesState = startSendMessage(anyProcess, wrappedMessage, strict);
  try {
    await sendOneMessage({
      anyProcess,
      methodName,
      isSubprocess,
      wrappedMessage,
      message
    });
  } catch (error2) {
    disconnect(anyProcess);
    throw error2;
  } finally {
    endSendMessage(outgoingMessagesState);
  }
};
const sendOneMessage = async ({ anyProcess, methodName, isSubprocess, wrappedMessage, message }) => {
  const sendMethod = getSendMethod(anyProcess);
  try {
    await Promise.all([
      waitForStrictResponse(wrappedMessage, anyProcess, isSubprocess),
      sendMethod(wrappedMessage)
    ]);
  } catch (error2) {
    handleEpipeError({ error: error2, methodName, isSubprocess });
    handleSerializationError({
      error: error2,
      methodName,
      isSubprocess,
      message
    });
    throw error2;
  }
};
const getSendMethod = (anyProcess) => {
  if (PROCESS_SEND_METHODS.has(anyProcess)) {
    return PROCESS_SEND_METHODS.get(anyProcess);
  }
  const sendMethod = node_util.promisify(anyProcess.send.bind(anyProcess));
  PROCESS_SEND_METHODS.set(anyProcess, sendMethod);
  return sendMethod;
};
const PROCESS_SEND_METHODS = /* @__PURE__ */ new WeakMap();
const sendAbort = (subprocess, message) => {
  const methodName = "cancelSignal";
  validateConnection(methodName, false, subprocess.connected);
  return sendOneMessage({
    anyProcess: subprocess,
    methodName,
    isSubprocess: false,
    wrappedMessage: { type: GRACEFUL_CANCEL_TYPE, message },
    message
  });
};
const getCancelSignal = async ({ anyProcess, channel, isSubprocess, ipc }) => {
  await startIpc({
    anyProcess,
    channel,
    isSubprocess,
    ipc
  });
  return cancelController.signal;
};
const startIpc = async ({ anyProcess, channel, isSubprocess, ipc }) => {
  if (cancelListening) {
    return;
  }
  cancelListening = true;
  if (!ipc) {
    throwOnMissingParent();
    return;
  }
  if (channel === null) {
    abortOnDisconnect();
    return;
  }
  getIpcEmitter(anyProcess, channel, isSubprocess);
  await promises.scheduler.yield();
};
let cancelListening = false;
const handleAbort = (wrappedMessage) => {
  if ((wrappedMessage == null ? void 0 : wrappedMessage.type) !== GRACEFUL_CANCEL_TYPE) {
    return false;
  }
  cancelController.abort(wrappedMessage.message);
  return true;
};
const GRACEFUL_CANCEL_TYPE = "execa:ipc:cancel";
const abortOnDisconnect = () => {
  cancelController.abort(getAbortDisconnectError());
};
const cancelController = new AbortController();
const validateGracefulCancel = ({ gracefulCancel, cancelSignal, ipc, serialization }) => {
  if (!gracefulCancel) {
    return;
  }
  if (cancelSignal === void 0) {
    throw new Error("The `cancelSignal` option must be defined when setting the `gracefulCancel` option.");
  }
  if (!ipc) {
    throw new Error("The `ipc` option cannot be false when setting the `gracefulCancel` option.");
  }
  if (serialization === "json") {
    throw new Error("The `serialization` option cannot be 'json' when setting the `gracefulCancel` option.");
  }
};
const throwOnGracefulCancel = ({
  subprocess,
  cancelSignal,
  gracefulCancel,
  forceKillAfterDelay,
  context,
  controller
}) => gracefulCancel ? [sendOnAbort({
  subprocess,
  cancelSignal,
  forceKillAfterDelay,
  context,
  controller
})] : [];
const sendOnAbort = async ({ subprocess, cancelSignal, forceKillAfterDelay, context, controller: { signal } }) => {
  await onAbortedSignal(cancelSignal, signal);
  const reason = getReason(cancelSignal);
  await sendAbort(subprocess, reason);
  killOnTimeout({
    kill: subprocess.kill,
    forceKillAfterDelay,
    context,
    controllerSignal: signal
  });
  context.terminationReason ?? (context.terminationReason = "gracefulCancel");
  throw cancelSignal.reason;
};
const getReason = ({ reason }) => {
  if (!(reason instanceof DOMException)) {
    return reason;
  }
  const error2 = new Error(reason.message);
  Object.defineProperty(error2, "stack", {
    value: reason.stack,
    enumerable: false,
    configurable: true,
    writable: true
  });
  return error2;
};
const validateTimeout = ({ timeout }) => {
  if (timeout !== void 0 && (!Number.isFinite(timeout) || timeout < 0)) {
    throw new TypeError(`Expected the \`timeout\` option to be a non-negative integer, got \`${timeout}\` (${typeof timeout})`);
  }
};
const throwOnTimeout = (subprocess, timeout, context, controller) => timeout === 0 || timeout === void 0 ? [] : [killAfterTimeout(subprocess, timeout, context, controller)];
const killAfterTimeout = async (subprocess, timeout, context, { signal }) => {
  await promises.setTimeout(timeout, void 0, { signal });
  context.terminationReason ?? (context.terminationReason = "timeout");
  subprocess.kill();
  throw new DiscardedError();
};
const mapNode = ({ options }) => {
  if (options.node === false) {
    throw new TypeError('The "node" option cannot be false with `execaNode()`.');
  }
  return { options: { ...options, node: true } };
};
const handleNodeOption = (file, commandArguments, {
  node: shouldHandleNode = false,
  nodePath = process$2.execPath,
  nodeOptions = process$2.execArgv.filter((nodeOption) => !nodeOption.startsWith("--inspect")),
  cwd,
  execPath: formerNodePath,
  ...options
}) => {
  if (formerNodePath !== void 0) {
    throw new TypeError('The "execPath" option has been removed. Please use the "nodePath" option instead.');
  }
  const normalizedNodePath = safeNormalizeFileUrl(nodePath, 'The "nodePath" option');
  const resolvedNodePath = path$e.resolve(cwd, normalizedNodePath);
  const newOptions = {
    ...options,
    nodePath: resolvedNodePath,
    node: shouldHandleNode,
    cwd
  };
  if (!shouldHandleNode) {
    return [file, commandArguments, newOptions];
  }
  if (path$e.basename(file, ".exe") === "node") {
    throw new TypeError('When the "node" option is true, the first argument does not need to be "node".');
  }
  return [
    resolvedNodePath,
    [...nodeOptions, file, ...commandArguments],
    { ipc: true, ...newOptions, shell: false }
  ];
};
const validateIpcInputOption = ({ ipcInput, ipc, serialization }) => {
  if (ipcInput === void 0) {
    return;
  }
  if (!ipc) {
    throw new Error("The `ipcInput` option cannot be set unless the `ipc` option is `true`.");
  }
  validateIpcInput[serialization](ipcInput);
};
const validateAdvancedInput = (ipcInput) => {
  try {
    node_v8.serialize(ipcInput);
  } catch (error2) {
    throw new Error("The `ipcInput` option is not serializable with a structured clone.", { cause: error2 });
  }
};
const validateJsonInput = (ipcInput) => {
  try {
    JSON.stringify(ipcInput);
  } catch (error2) {
    throw new Error("The `ipcInput` option is not serializable with JSON.", { cause: error2 });
  }
};
const validateIpcInput = {
  advanced: validateAdvancedInput,
  json: validateJsonInput
};
const sendIpcInput = async (subprocess, ipcInput) => {
  if (ipcInput === void 0) {
    return;
  }
  await subprocess.sendMessage(ipcInput);
};
const validateEncoding = ({ encoding }) => {
  if (ENCODINGS.has(encoding)) {
    return;
  }
  const correctEncoding = getCorrectEncoding(encoding);
  if (correctEncoding !== void 0) {
    throw new TypeError(`Invalid option \`encoding: ${serializeEncoding(encoding)}\`.
Please rename it to ${serializeEncoding(correctEncoding)}.`);
  }
  const correctEncodings = [...ENCODINGS].map((correctEncoding2) => serializeEncoding(correctEncoding2)).join(", ");
  throw new TypeError(`Invalid option \`encoding: ${serializeEncoding(encoding)}\`.
Please rename it to one of: ${correctEncodings}.`);
};
const TEXT_ENCODINGS = /* @__PURE__ */ new Set(["utf8", "utf16le"]);
const BINARY_ENCODINGS = /* @__PURE__ */ new Set(["buffer", "hex", "base64", "base64url", "latin1", "ascii"]);
const ENCODINGS = /* @__PURE__ */ new Set([...TEXT_ENCODINGS, ...BINARY_ENCODINGS]);
const getCorrectEncoding = (encoding) => {
  if (encoding === null) {
    return "buffer";
  }
  if (typeof encoding !== "string") {
    return;
  }
  const lowerEncoding = encoding.toLowerCase();
  if (lowerEncoding in ENCODING_ALIASES) {
    return ENCODING_ALIASES[lowerEncoding];
  }
  if (ENCODINGS.has(lowerEncoding)) {
    return lowerEncoding;
  }
};
const ENCODING_ALIASES = {
  // eslint-disable-next-line unicorn/text-encoding-identifier-case
  "utf-8": "utf8",
  "utf-16le": "utf16le",
  "ucs-2": "utf16le",
  ucs2: "utf16le",
  binary: "latin1"
};
const serializeEncoding = (encoding) => typeof encoding === "string" ? `"${encoding}"` : String(encoding);
const normalizeCwd = (cwd = getDefaultCwd()) => {
  const cwdString = safeNormalizeFileUrl(cwd, 'The "cwd" option');
  return path$e.resolve(cwdString);
};
const getDefaultCwd = () => {
  try {
    return process$2.cwd();
  } catch (error2) {
    error2.message = `The current directory does not exist.
${error2.message}`;
    throw error2;
  }
};
const fixCwdError = (originalMessage, cwd) => {
  if (cwd === getDefaultCwd()) {
    return originalMessage;
  }
  let cwdStat;
  try {
    cwdStat = node_fs.statSync(cwd);
  } catch (error2) {
    return `The "cwd" option is invalid: ${cwd}.
${error2.message}
${originalMessage}`;
  }
  if (!cwdStat.isDirectory()) {
    return `The "cwd" option is not a directory: ${cwd}.
${originalMessage}`;
  }
  return originalMessage;
};
const normalizeOptions = (filePath, rawArguments, rawOptions) => {
  rawOptions.cwd = normalizeCwd(rawOptions.cwd);
  const [processedFile, processedArguments, processedOptions] = handleNodeOption(filePath, rawArguments, rawOptions);
  const { command: file, args: commandArguments, options: initialOptions } = crossSpawn._parse(processedFile, processedArguments, processedOptions);
  const fdOptions = normalizeFdSpecificOptions(initialOptions);
  const options = addDefaultOptions(fdOptions);
  validateTimeout(options);
  validateEncoding(options);
  validateIpcInputOption(options);
  validateCancelSignal(options);
  validateGracefulCancel(options);
  options.shell = normalizeFileUrl(options.shell);
  options.env = getEnv(options);
  options.killSignal = normalizeKillSignal(options.killSignal);
  options.forceKillAfterDelay = normalizeForceKillAfterDelay(options.forceKillAfterDelay);
  options.lines = options.lines.map((lines, fdNumber) => lines && !BINARY_ENCODINGS.has(options.encoding) && options.buffer[fdNumber]);
  if (process$2.platform === "win32" && path$e.basename(file, ".exe") === "cmd") {
    commandArguments.unshift("/q");
  }
  return { file, commandArguments, options };
};
const addDefaultOptions = ({
  extendEnv = true,
  preferLocal = false,
  cwd,
  localDir: localDirectory = cwd,
  encoding = "utf8",
  reject = true,
  cleanup = true,
  all = false,
  windowsHide = true,
  killSignal = "SIGTERM",
  forceKillAfterDelay = true,
  gracefulCancel = false,
  ipcInput,
  ipc = ipcInput !== void 0 || gracefulCancel,
  serialization = "advanced",
  ...options
}) => ({
  ...options,
  extendEnv,
  preferLocal,
  cwd,
  localDirectory,
  encoding,
  reject,
  cleanup,
  all,
  windowsHide,
  killSignal,
  forceKillAfterDelay,
  gracefulCancel,
  ipcInput,
  ipc,
  serialization
});
const getEnv = ({ env: envOption, extendEnv, preferLocal, node, localDirectory, nodePath }) => {
  const env = extendEnv ? { ...process$2.env, ...envOption } : envOption;
  if (preferLocal || node) {
    return npmRunPathEnv({
      env,
      cwd: localDirectory,
      execPath: nodePath,
      preferLocal,
      addExecPath: node
    });
  }
  return env;
};
const concatenateShell = (file, commandArguments, options) => options.shell && commandArguments.length > 0 ? [[file, ...commandArguments].join(" "), [], options] : [file, commandArguments, options];
function stripFinalNewline(input) {
  if (typeof input === "string") {
    return stripFinalNewlineString(input);
  }
  if (!(ArrayBuffer.isView(input) && input.BYTES_PER_ELEMENT === 1)) {
    throw new Error("Input must be a string or a Uint8Array");
  }
  return stripFinalNewlineBinary(input);
}
const stripFinalNewlineString = (input) => input.at(-1) === LF ? input.slice(0, input.at(-2) === CR ? -2 : -1) : input;
const stripFinalNewlineBinary = (input) => input.at(-1) === LF_BINARY ? input.subarray(0, input.at(-2) === CR_BINARY ? -2 : -1) : input;
const LF = "\n";
const LF_BINARY = LF.codePointAt(0);
const CR = "\r";
const CR_BINARY = CR.codePointAt(0);
function isStream(stream2, { checkOpen = true } = {}) {
  return stream2 !== null && typeof stream2 === "object" && (stream2.writable || stream2.readable || !checkOpen || stream2.writable === void 0 && stream2.readable === void 0) && typeof stream2.pipe === "function";
}
function isWritableStream$1(stream2, { checkOpen = true } = {}) {
  return isStream(stream2, { checkOpen }) && (stream2.writable || !checkOpen) && typeof stream2.write === "function" && typeof stream2.end === "function" && typeof stream2.writable === "boolean" && typeof stream2.writableObjectMode === "boolean" && typeof stream2.destroy === "function" && typeof stream2.destroyed === "boolean";
}
function isReadableStream$1(stream2, { checkOpen = true } = {}) {
  return isStream(stream2, { checkOpen }) && (stream2.readable || !checkOpen) && typeof stream2.read === "function" && typeof stream2.readable === "boolean" && typeof stream2.readableObjectMode === "boolean" && typeof stream2.destroy === "function" && typeof stream2.destroyed === "boolean";
}
function isDuplexStream(stream2, options) {
  return isWritableStream$1(stream2, options) && isReadableStream$1(stream2, options);
}
const a = Object.getPrototypeOf(
  Object.getPrototypeOf(
    /* istanbul ignore next */
    async function* () {
    }
  ).prototype
);
class c {
  constructor(e, t) {
    __privateAdd(this, _c_instances);
    __privateAdd(this, _t);
    __privateAdd(this, _n);
    __privateAdd(this, _r, false);
    __privateAdd(this, _e);
    __privateSet(this, _t, e), __privateSet(this, _n, t);
  }
  next() {
    const e = () => __privateMethod(this, _c_instances, s_fn).call(this);
    return __privateSet(this, _e, __privateGet(this, _e) ? __privateGet(this, _e).then(e, e) : e()), __privateGet(this, _e);
  }
  return(e) {
    const t = () => __privateMethod(this, _c_instances, i_fn).call(this, e);
    return __privateGet(this, _e) ? __privateGet(this, _e).then(t, t) : t();
  }
}
_t = new WeakMap();
_n = new WeakMap();
_r = new WeakMap();
_e = new WeakMap();
_c_instances = new WeakSet();
s_fn = async function() {
  if (__privateGet(this, _r))
    return {
      done: true,
      value: void 0
    };
  let e;
  try {
    e = await __privateGet(this, _t).read();
  } catch (t) {
    throw __privateSet(this, _e, void 0), __privateSet(this, _r, true), __privateGet(this, _t).releaseLock(), t;
  }
  return e.done && (__privateSet(this, _e, void 0), __privateSet(this, _r, true), __privateGet(this, _t).releaseLock()), e;
};
i_fn = async function(e) {
  if (__privateGet(this, _r))
    return {
      done: true,
      value: e
    };
  if (__privateSet(this, _r, true), !__privateGet(this, _n)) {
    const t = __privateGet(this, _t).cancel(e);
    return __privateGet(this, _t).releaseLock(), await t, {
      done: true,
      value: e
    };
  }
  return __privateGet(this, _t).releaseLock(), {
    done: true,
    value: e
  };
};
const n = Symbol();
function i() {
  return this[n].next();
}
Object.defineProperty(i, "name", { value: "next" });
function o(r) {
  return this[n].return(r);
}
Object.defineProperty(o, "name", { value: "return" });
const u = Object.create(a, {
  next: {
    enumerable: true,
    configurable: true,
    writable: true,
    value: i
  },
  return: {
    enumerable: true,
    configurable: true,
    writable: true,
    value: o
  }
});
function h({ preventCancel: r = false } = {}) {
  const e = this.getReader(), t = new c(
    e,
    r
  ), s = Object.create(u);
  return s[n] = t, s;
}
const getAsyncIterable = (stream2) => {
  if (isReadableStream$1(stream2, { checkOpen: false }) && nodeImports.on !== void 0) {
    return getStreamIterable(stream2);
  }
  if (typeof (stream2 == null ? void 0 : stream2[Symbol.asyncIterator]) === "function") {
    return stream2;
  }
  if (toString$1.call(stream2) === "[object ReadableStream]") {
    return h.call(stream2);
  }
  throw new TypeError("The first argument must be a Readable, a ReadableStream, or an async iterable.");
};
const { toString: toString$1 } = Object.prototype;
const getStreamIterable = async function* (stream2) {
  const controller = new AbortController();
  const state = {};
  handleStreamEnd(stream2, controller, state);
  try {
    for await (const [chunk] of nodeImports.on(stream2, "data", { signal: controller.signal })) {
      yield chunk;
    }
  } catch (error2) {
    if (state.error !== void 0) {
      throw state.error;
    } else if (!controller.signal.aborted) {
      throw error2;
    }
  } finally {
    stream2.destroy();
  }
};
const handleStreamEnd = async (stream2, controller, state) => {
  try {
    await nodeImports.finished(stream2, {
      cleanup: true,
      readable: true,
      writable: false,
      error: false
    });
  } catch (error2) {
    state.error = error2;
  } finally {
    controller.abort();
  }
};
const nodeImports = {};
const getStreamContents$1 = async (stream2, { init, convertChunk, getSize, truncateChunk, addChunk, getFinalChunk, finalize }, { maxBuffer = Number.POSITIVE_INFINITY } = {}) => {
  const asyncIterable = getAsyncIterable(stream2);
  const state = init();
  state.length = 0;
  try {
    for await (const chunk of asyncIterable) {
      const chunkType = getChunkType(chunk);
      const convertedChunk = convertChunk[chunkType](chunk, state);
      appendChunk({
        convertedChunk,
        state,
        getSize,
        truncateChunk,
        addChunk,
        maxBuffer
      });
    }
    appendFinalChunk({
      state,
      convertChunk,
      getSize,
      truncateChunk,
      addChunk,
      getFinalChunk,
      maxBuffer
    });
    return finalize(state);
  } catch (error2) {
    const normalizedError = typeof error2 === "object" && error2 !== null ? error2 : new Error(error2);
    normalizedError.bufferedData = finalize(state);
    throw normalizedError;
  }
};
const appendFinalChunk = ({ state, getSize, truncateChunk, addChunk, getFinalChunk, maxBuffer }) => {
  const convertedChunk = getFinalChunk(state);
  if (convertedChunk !== void 0) {
    appendChunk({
      convertedChunk,
      state,
      getSize,
      truncateChunk,
      addChunk,
      maxBuffer
    });
  }
};
const appendChunk = ({ convertedChunk, state, getSize, truncateChunk, addChunk, maxBuffer }) => {
  const chunkSize = getSize(convertedChunk);
  const newLength = state.length + chunkSize;
  if (newLength <= maxBuffer) {
    addNewChunk(convertedChunk, state, addChunk, newLength);
    return;
  }
  const truncatedChunk = truncateChunk(convertedChunk, maxBuffer - state.length);
  if (truncatedChunk !== void 0) {
    addNewChunk(truncatedChunk, state, addChunk, maxBuffer);
  }
  throw new MaxBufferError();
};
const addNewChunk = (convertedChunk, state, addChunk, newLength) => {
  state.contents = addChunk(convertedChunk, state, newLength);
  state.length = newLength;
};
const getChunkType = (chunk) => {
  var _a2;
  const typeOfChunk = typeof chunk;
  if (typeOfChunk === "string") {
    return "string";
  }
  if (typeOfChunk !== "object" || chunk === null) {
    return "others";
  }
  if ((_a2 = globalThis.Buffer) == null ? void 0 : _a2.isBuffer(chunk)) {
    return "buffer";
  }
  const prototypeName = objectToString.call(chunk);
  if (prototypeName === "[object ArrayBuffer]") {
    return "arrayBuffer";
  }
  if (prototypeName === "[object DataView]") {
    return "dataView";
  }
  if (Number.isInteger(chunk.byteLength) && Number.isInteger(chunk.byteOffset) && objectToString.call(chunk.buffer) === "[object ArrayBuffer]") {
    return "typedArray";
  }
  return "others";
};
const { toString: objectToString } = Object.prototype;
class MaxBufferError extends Error {
  constructor() {
    super("maxBuffer exceeded");
    __publicField(this, "name", "MaxBufferError");
  }
}
const identity = (value) => value;
const noop$1 = () => void 0;
const getContentsProperty = ({ contents }) => contents;
const throwObjectStream = (chunk) => {
  throw new Error(`Streams in object mode are not supported: ${String(chunk)}`);
};
const getLengthProperty = (convertedChunk) => convertedChunk.length;
async function getStreamAsArray(stream2, options) {
  return getStreamContents$1(stream2, arrayMethods, options);
}
const initArray = () => ({ contents: [] });
const increment = () => 1;
const addArrayChunk = (convertedChunk, { contents }) => {
  contents.push(convertedChunk);
  return contents;
};
const arrayMethods = {
  init: initArray,
  convertChunk: {
    string: identity,
    buffer: identity,
    arrayBuffer: identity,
    dataView: identity,
    typedArray: identity,
    others: identity
  },
  getSize: increment,
  truncateChunk: noop$1,
  addChunk: addArrayChunk,
  getFinalChunk: noop$1,
  finalize: getContentsProperty
};
async function getStreamAsArrayBuffer(stream2, options) {
  return getStreamContents$1(stream2, arrayBufferMethods, options);
}
const initArrayBuffer = () => ({ contents: new ArrayBuffer(0) });
const useTextEncoder = (chunk) => textEncoder.encode(chunk);
const textEncoder = new TextEncoder();
const useUint8Array = (chunk) => new Uint8Array(chunk);
const useUint8ArrayWithOffset = (chunk) => new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
const truncateArrayBufferChunk = (convertedChunk, chunkSize) => convertedChunk.slice(0, chunkSize);
const addArrayBufferChunk = (convertedChunk, { contents, length: previousLength }, length) => {
  const newContents = hasArrayBufferResize() ? resizeArrayBuffer(contents, length) : resizeArrayBufferSlow(contents, length);
  new Uint8Array(newContents).set(convertedChunk, previousLength);
  return newContents;
};
const resizeArrayBufferSlow = (contents, length) => {
  if (length <= contents.byteLength) {
    return contents;
  }
  const arrayBuffer = new ArrayBuffer(getNewContentsLength(length));
  new Uint8Array(arrayBuffer).set(new Uint8Array(contents), 0);
  return arrayBuffer;
};
const resizeArrayBuffer = (contents, length) => {
  if (length <= contents.maxByteLength) {
    contents.resize(length);
    return contents;
  }
  const arrayBuffer = new ArrayBuffer(length, { maxByteLength: getNewContentsLength(length) });
  new Uint8Array(arrayBuffer).set(new Uint8Array(contents), 0);
  return arrayBuffer;
};
const getNewContentsLength = (length) => SCALE_FACTOR ** Math.ceil(Math.log(length) / Math.log(SCALE_FACTOR));
const SCALE_FACTOR = 2;
const finalizeArrayBuffer = ({ contents, length }) => hasArrayBufferResize() ? contents : contents.slice(0, length);
const hasArrayBufferResize = () => "resize" in ArrayBuffer.prototype;
const arrayBufferMethods = {
  init: initArrayBuffer,
  convertChunk: {
    string: useTextEncoder,
    buffer: useUint8Array,
    arrayBuffer: useUint8Array,
    dataView: useUint8ArrayWithOffset,
    typedArray: useUint8ArrayWithOffset,
    others: throwObjectStream
  },
  getSize: getLengthProperty,
  truncateChunk: truncateArrayBufferChunk,
  addChunk: addArrayBufferChunk,
  getFinalChunk: noop$1,
  finalize: finalizeArrayBuffer
};
async function getStreamAsString(stream2, options) {
  return getStreamContents$1(stream2, stringMethods, options);
}
const initString = () => ({ contents: "", textDecoder: new TextDecoder() });
const useTextDecoder = (chunk, { textDecoder: textDecoder2 }) => textDecoder2.decode(chunk, { stream: true });
const addStringChunk = (convertedChunk, { contents }) => contents + convertedChunk;
const truncateStringChunk = (convertedChunk, chunkSize) => convertedChunk.slice(0, chunkSize);
const getFinalStringChunk = ({ textDecoder: textDecoder2 }) => {
  const finalChunk = textDecoder2.decode();
  return finalChunk === "" ? void 0 : finalChunk;
};
const stringMethods = {
  init: initString,
  convertChunk: {
    string: identity,
    buffer: useTextDecoder,
    arrayBuffer: useTextDecoder,
    dataView: useTextDecoder,
    typedArray: useTextDecoder,
    others: throwObjectStream
  },
  getSize: getLengthProperty,
  truncateChunk: truncateStringChunk,
  addChunk: addStringChunk,
  getFinalChunk: getFinalStringChunk,
  finalize: getContentsProperty
};
const handleMaxBuffer = ({ error: error2, stream: stream2, readableObjectMode, lines, encoding, fdNumber }) => {
  if (!(error2 instanceof MaxBufferError)) {
    throw error2;
  }
  if (fdNumber === "all") {
    return error2;
  }
  const unit = getMaxBufferUnit(readableObjectMode, lines, encoding);
  error2.maxBufferInfo = { fdNumber, unit };
  stream2.destroy();
  throw error2;
};
const getMaxBufferUnit = (readableObjectMode, lines, encoding) => {
  if (readableObjectMode) {
    return "objects";
  }
  if (lines) {
    return "lines";
  }
  if (encoding === "buffer") {
    return "bytes";
  }
  return "characters";
};
const checkIpcMaxBuffer = (subprocess, ipcOutput, maxBuffer) => {
  if (ipcOutput.length !== maxBuffer) {
    return;
  }
  const error2 = new MaxBufferError();
  error2.maxBufferInfo = { fdNumber: "ipc" };
  throw error2;
};
const getMaxBufferMessage = (error2, maxBuffer) => {
  const { streamName, threshold, unit } = getMaxBufferInfo(error2, maxBuffer);
  return `Command's ${streamName} was larger than ${threshold} ${unit}`;
};
const getMaxBufferInfo = (error2, maxBuffer) => {
  if ((error2 == null ? void 0 : error2.maxBufferInfo) === void 0) {
    return { streamName: "output", threshold: maxBuffer[1], unit: "bytes" };
  }
  const { maxBufferInfo: { fdNumber, unit } } = error2;
  delete error2.maxBufferInfo;
  const threshold = getFdSpecificValue(maxBuffer, fdNumber);
  if (fdNumber === "ipc") {
    return { streamName: "IPC output", threshold, unit: "messages" };
  }
  return { streamName: getStreamName(fdNumber), threshold, unit };
};
const isMaxBufferSync = (resultError, output, maxBuffer) => (resultError == null ? void 0 : resultError.code) === "ENOBUFS" && output !== null && output.some((result) => result !== null && result.length > getMaxBufferSync(maxBuffer));
const truncateMaxBufferSync = (result, isMaxBuffer, maxBuffer) => {
  if (!isMaxBuffer) {
    return result;
  }
  const maxBufferValue = getMaxBufferSync(maxBuffer);
  return result.length > maxBufferValue ? result.slice(0, maxBufferValue) : result;
};
const getMaxBufferSync = ([, stdoutMaxBuffer]) => stdoutMaxBuffer;
const createMessages = ({
  stdio,
  all,
  ipcOutput,
  originalError,
  signal,
  signalDescription,
  exitCode,
  escapedCommand,
  timedOut,
  isCanceled,
  isGracefullyCanceled,
  isMaxBuffer,
  isForcefullyTerminated,
  forceKillAfterDelay,
  killSignal,
  maxBuffer,
  timeout,
  cwd
}) => {
  const errorCode = originalError == null ? void 0 : originalError.code;
  const prefix = getErrorPrefix({
    originalError,
    timedOut,
    timeout,
    isMaxBuffer,
    maxBuffer,
    errorCode,
    signal,
    signalDescription,
    exitCode,
    isCanceled,
    isGracefullyCanceled,
    isForcefullyTerminated,
    forceKillAfterDelay,
    killSignal
  });
  const originalMessage = getOriginalMessage(originalError, cwd);
  const suffix = originalMessage === void 0 ? "" : `
${originalMessage}`;
  const shortMessage = `${prefix}: ${escapedCommand}${suffix}`;
  const messageStdio = all === void 0 ? [stdio[2], stdio[1]] : [all];
  const message = [
    shortMessage,
    ...messageStdio,
    ...stdio.slice(3),
    ipcOutput.map((ipcMessage) => serializeIpcMessage(ipcMessage)).join("\n")
  ].map((messagePart) => escapeLines(stripFinalNewline(serializeMessagePart(messagePart)))).filter(Boolean).join("\n\n");
  return { originalMessage, shortMessage, message };
};
const getErrorPrefix = ({
  originalError,
  timedOut,
  timeout,
  isMaxBuffer,
  maxBuffer,
  errorCode,
  signal,
  signalDescription,
  exitCode,
  isCanceled,
  isGracefullyCanceled,
  isForcefullyTerminated,
  forceKillAfterDelay,
  killSignal
}) => {
  const forcefulSuffix = getForcefulSuffix(isForcefullyTerminated, forceKillAfterDelay);
  if (timedOut) {
    return `Command timed out after ${timeout} milliseconds${forcefulSuffix}`;
  }
  if (isGracefullyCanceled) {
    if (signal === void 0) {
      return `Command was gracefully canceled with exit code ${exitCode}`;
    }
    return isForcefullyTerminated ? `Command was gracefully canceled${forcefulSuffix}` : `Command was gracefully canceled with ${signal} (${signalDescription})`;
  }
  if (isCanceled) {
    return `Command was canceled${forcefulSuffix}`;
  }
  if (isMaxBuffer) {
    return `${getMaxBufferMessage(originalError, maxBuffer)}${forcefulSuffix}`;
  }
  if (errorCode !== void 0) {
    return `Command failed with ${errorCode}${forcefulSuffix}`;
  }
  if (isForcefullyTerminated) {
    return `Command was killed with ${killSignal} (${getSignalDescription(killSignal)})${forcefulSuffix}`;
  }
  if (signal !== void 0) {
    return `Command was killed with ${signal} (${signalDescription})`;
  }
  if (exitCode !== void 0) {
    return `Command failed with exit code ${exitCode}`;
  }
  return "Command failed";
};
const getForcefulSuffix = (isForcefullyTerminated, forceKillAfterDelay) => isForcefullyTerminated ? ` and was forcefully terminated after ${forceKillAfterDelay} milliseconds` : "";
const getOriginalMessage = (originalError, cwd) => {
  if (originalError instanceof DiscardedError) {
    return;
  }
  const originalMessage = isExecaError(originalError) ? originalError.originalMessage : String((originalError == null ? void 0 : originalError.message) ?? originalError);
  const escapedOriginalMessage = escapeLines(fixCwdError(originalMessage, cwd));
  return escapedOriginalMessage === "" ? void 0 : escapedOriginalMessage;
};
const serializeIpcMessage = (ipcMessage) => typeof ipcMessage === "string" ? ipcMessage : node_util.inspect(ipcMessage);
const serializeMessagePart = (messagePart) => Array.isArray(messagePart) ? messagePart.map((messageItem) => stripFinalNewline(serializeMessageItem(messageItem))).filter(Boolean).join("\n") : serializeMessageItem(messagePart);
const serializeMessageItem = (messageItem) => {
  if (typeof messageItem === "string") {
    return messageItem;
  }
  if (isUint8Array(messageItem)) {
    return uint8ArrayToString(messageItem);
  }
  return "";
};
const makeSuccessResult = ({
  command,
  escapedCommand,
  stdio,
  all,
  ipcOutput,
  options: { cwd },
  startTime
}) => omitUndefinedProperties({
  command,
  escapedCommand,
  cwd,
  durationMs: getDurationMs(startTime),
  failed: false,
  timedOut: false,
  isCanceled: false,
  isGracefullyCanceled: false,
  isTerminated: false,
  isMaxBuffer: false,
  isForcefullyTerminated: false,
  exitCode: 0,
  stdout: stdio[1],
  stderr: stdio[2],
  all,
  stdio,
  ipcOutput,
  pipedFrom: []
});
const makeEarlyError = ({
  error: error2,
  command,
  escapedCommand,
  fileDescriptors,
  options,
  startTime,
  isSync
}) => makeError({
  error: error2,
  command,
  escapedCommand,
  startTime,
  timedOut: false,
  isCanceled: false,
  isGracefullyCanceled: false,
  isMaxBuffer: false,
  isForcefullyTerminated: false,
  stdio: Array.from({ length: fileDescriptors.length }),
  ipcOutput: [],
  options,
  isSync
});
const makeError = ({
  error: originalError,
  command,
  escapedCommand,
  startTime,
  timedOut,
  isCanceled,
  isGracefullyCanceled,
  isMaxBuffer,
  isForcefullyTerminated,
  exitCode: rawExitCode,
  signal: rawSignal,
  stdio,
  all,
  ipcOutput,
  options: {
    timeoutDuration,
    timeout = timeoutDuration,
    forceKillAfterDelay,
    killSignal,
    cwd,
    maxBuffer
  },
  isSync
}) => {
  const { exitCode, signal, signalDescription } = normalizeExitPayload(rawExitCode, rawSignal);
  const { originalMessage, shortMessage, message } = createMessages({
    stdio,
    all,
    ipcOutput,
    originalError,
    signal,
    signalDescription,
    exitCode,
    escapedCommand,
    timedOut,
    isCanceled,
    isGracefullyCanceled,
    isMaxBuffer,
    isForcefullyTerminated,
    forceKillAfterDelay,
    killSignal,
    maxBuffer,
    timeout,
    cwd
  });
  const error2 = getFinalError(originalError, message, isSync);
  Object.assign(error2, getErrorProperties({
    error: error2,
    command,
    escapedCommand,
    startTime,
    timedOut,
    isCanceled,
    isGracefullyCanceled,
    isMaxBuffer,
    isForcefullyTerminated,
    exitCode,
    signal,
    signalDescription,
    stdio,
    all,
    ipcOutput,
    cwd,
    originalMessage,
    shortMessage
  }));
  return error2;
};
const getErrorProperties = ({
  error: error2,
  command,
  escapedCommand,
  startTime,
  timedOut,
  isCanceled,
  isGracefullyCanceled,
  isMaxBuffer,
  isForcefullyTerminated,
  exitCode,
  signal,
  signalDescription,
  stdio,
  all,
  ipcOutput,
  cwd,
  originalMessage,
  shortMessage
}) => {
  var _a2;
  return omitUndefinedProperties({
    shortMessage,
    originalMessage,
    command,
    escapedCommand,
    cwd,
    durationMs: getDurationMs(startTime),
    failed: true,
    timedOut,
    isCanceled,
    isGracefullyCanceled,
    isTerminated: signal !== void 0,
    isMaxBuffer,
    isForcefullyTerminated,
    exitCode,
    signal,
    signalDescription,
    code: (_a2 = error2.cause) == null ? void 0 : _a2.code,
    stdout: stdio[1],
    stderr: stdio[2],
    all,
    stdio,
    ipcOutput,
    pipedFrom: []
  });
};
const omitUndefinedProperties = (result) => Object.fromEntries(Object.entries(result).filter(([, value]) => value !== void 0));
const normalizeExitPayload = (rawExitCode, rawSignal) => {
  const exitCode = rawExitCode === null ? void 0 : rawExitCode;
  const signal = rawSignal === null ? void 0 : rawSignal;
  const signalDescription = signal === void 0 ? void 0 : getSignalDescription(rawSignal);
  return { exitCode, signal, signalDescription };
};
const toZeroIfInfinity = (value) => Number.isFinite(value) ? value : 0;
function parseNumber(milliseconds) {
  return {
    days: Math.trunc(milliseconds / 864e5),
    hours: Math.trunc(milliseconds / 36e5 % 24),
    minutes: Math.trunc(milliseconds / 6e4 % 60),
    seconds: Math.trunc(milliseconds / 1e3 % 60),
    milliseconds: Math.trunc(milliseconds % 1e3),
    microseconds: Math.trunc(toZeroIfInfinity(milliseconds * 1e3) % 1e3),
    nanoseconds: Math.trunc(toZeroIfInfinity(milliseconds * 1e6) % 1e3)
  };
}
function parseBigint(milliseconds) {
  return {
    days: milliseconds / 86400000n,
    hours: milliseconds / 3600000n % 24n,
    minutes: milliseconds / 60000n % 60n,
    seconds: milliseconds / 1000n % 60n,
    milliseconds: milliseconds % 1000n,
    microseconds: 0n,
    nanoseconds: 0n
  };
}
function parseMilliseconds(milliseconds) {
  switch (typeof milliseconds) {
    case "number": {
      if (Number.isFinite(milliseconds)) {
        return parseNumber(milliseconds);
      }
      break;
    }
    case "bigint": {
      return parseBigint(milliseconds);
    }
  }
  throw new TypeError("Expected a finite number or bigint");
}
const isZero = (value) => value === 0 || value === 0n;
const pluralize = (word, count2) => count2 === 1 || count2 === 1n ? word : `${word}s`;
const SECOND_ROUNDING_EPSILON = 1e-7;
const ONE_DAY_IN_MILLISECONDS = 24n * 60n * 60n * 1000n;
function prettyMilliseconds(milliseconds, options) {
  const isBigInt = typeof milliseconds === "bigint";
  if (!isBigInt && !Number.isFinite(milliseconds)) {
    throw new TypeError("Expected a finite number or bigint");
  }
  options = { ...options };
  const sign = milliseconds < 0 ? "-" : "";
  milliseconds = milliseconds < 0 ? -milliseconds : milliseconds;
  if (options.colonNotation) {
    options.compact = false;
    options.formatSubMilliseconds = false;
    options.separateMilliseconds = false;
    options.verbose = false;
  }
  if (options.compact) {
    options.unitCount = 1;
    options.secondsDecimalDigits = 0;
    options.millisecondsDecimalDigits = 0;
  }
  let result = [];
  const floorDecimals = (value, decimalDigits) => {
    const flooredInterimValue = Math.floor(value * 10 ** decimalDigits + SECOND_ROUNDING_EPSILON);
    const flooredValue = Math.round(flooredInterimValue) / 10 ** decimalDigits;
    return flooredValue.toFixed(decimalDigits);
  };
  const add = (value, long, short, valueString) => {
    if ((result.length === 0 || !options.colonNotation) && isZero(value) && !(options.colonNotation && short === "m")) {
      return;
    }
    valueString ?? (valueString = String(value));
    if (options.colonNotation) {
      const wholeDigits = valueString.includes(".") ? valueString.split(".")[0].length : valueString.length;
      const minLength = result.length > 0 ? 2 : 1;
      valueString = "0".repeat(Math.max(0, minLength - wholeDigits)) + valueString;
    } else {
      valueString += options.verbose ? " " + pluralize(long, value) : short;
    }
    result.push(valueString);
  };
  const parsed = parseMilliseconds(milliseconds);
  const days = BigInt(parsed.days);
  if (options.hideYearAndDays) {
    add(BigInt(days) * 24n + BigInt(parsed.hours), "hour", "h");
  } else {
    if (options.hideYear) {
      add(days, "day", "d");
    } else {
      add(days / 365n, "year", "y");
      add(days % 365n, "day", "d");
    }
    add(Number(parsed.hours), "hour", "h");
  }
  add(Number(parsed.minutes), "minute", "m");
  if (!options.hideSeconds) {
    if (options.separateMilliseconds || options.formatSubMilliseconds || !options.colonNotation && milliseconds < 1e3 && !options.subSecondsAsDecimals) {
      const seconds = Number(parsed.seconds);
      const milliseconds2 = Number(parsed.milliseconds);
      const microseconds = Number(parsed.microseconds);
      const nanoseconds = Number(parsed.nanoseconds);
      add(seconds, "second", "s");
      if (options.formatSubMilliseconds) {
        add(milliseconds2, "millisecond", "ms");
        add(microseconds, "microsecond", "µs");
        add(nanoseconds, "nanosecond", "ns");
      } else {
        const millisecondsAndBelow = milliseconds2 + microseconds / 1e3 + nanoseconds / 1e6;
        const millisecondsDecimalDigits = typeof options.millisecondsDecimalDigits === "number" ? options.millisecondsDecimalDigits : 0;
        const roundedMilliseconds = millisecondsAndBelow >= 1 ? Math.round(millisecondsAndBelow) : Math.ceil(millisecondsAndBelow);
        const millisecondsString = millisecondsDecimalDigits ? millisecondsAndBelow.toFixed(millisecondsDecimalDigits) : roundedMilliseconds;
        add(
          Number.parseFloat(millisecondsString),
          "millisecond",
          "ms",
          millisecondsString
        );
      }
    } else {
      const seconds = (isBigInt ? Number(milliseconds % ONE_DAY_IN_MILLISECONDS) : milliseconds) / 1e3 % 60;
      const secondsDecimalDigits = typeof options.secondsDecimalDigits === "number" ? options.secondsDecimalDigits : 1;
      const secondsFixed = floorDecimals(seconds, secondsDecimalDigits);
      const secondsString = options.keepDecimalsOnWholeSeconds ? secondsFixed : secondsFixed.replace(/\.0+$/, "");
      add(Number.parseFloat(secondsString), "second", "s", secondsString);
    }
  }
  if (result.length === 0) {
    return sign + "0" + (options.verbose ? " milliseconds" : "ms");
  }
  const separator = options.colonNotation ? ":" : " ";
  if (typeof options.unitCount === "number") {
    result = result.slice(0, Math.max(options.unitCount, 1));
  }
  return sign + result.join(separator);
}
const logError = (result, verboseInfo) => {
  if (result.failed) {
    verboseLog({
      type: "error",
      verboseMessage: result.shortMessage,
      verboseInfo,
      result
    });
  }
};
const logResult = (result, verboseInfo) => {
  if (!isVerbose(verboseInfo)) {
    return;
  }
  logError(result, verboseInfo);
  logDuration(result, verboseInfo);
};
const logDuration = (result, verboseInfo) => {
  const verboseMessage = `(done in ${prettyMilliseconds(result.durationMs)})`;
  verboseLog({
    type: "duration",
    verboseMessage,
    verboseInfo,
    result
  });
};
const handleResult = (result, verboseInfo, { reject }) => {
  logResult(result, verboseInfo);
  if (result.failed && reject) {
    throw result;
  }
  return result;
};
const getStdioItemType = (value, optionName) => {
  if (isAsyncGenerator(value)) {
    return "asyncGenerator";
  }
  if (isSyncGenerator(value)) {
    return "generator";
  }
  if (isUrl(value)) {
    return "fileUrl";
  }
  if (isFilePathObject(value)) {
    return "filePath";
  }
  if (isWebStream(value)) {
    return "webStream";
  }
  if (isStream(value, { checkOpen: false })) {
    return "native";
  }
  if (isUint8Array(value)) {
    return "uint8Array";
  }
  if (isAsyncIterableObject(value)) {
    return "asyncIterable";
  }
  if (isIterableObject(value)) {
    return "iterable";
  }
  if (isTransformStream(value)) {
    return getTransformStreamType({}, optionName);
  }
  if (isTransformOptions(value)) {
    return getTransformObjectType(value, optionName);
  }
  return "native";
};
const getTransformObjectType = (value, optionName) => {
  if (isDuplexStream(value.transform, { checkOpen: false })) {
    return getDuplexType(value, optionName);
  }
  if (isTransformStream(value.transform)) {
    return getTransformStreamType(value, optionName);
  }
  return getGeneratorObjectType(value, optionName);
};
const getDuplexType = (value, optionName) => {
  validateNonGeneratorType(value, optionName, "Duplex stream");
  return "duplex";
};
const getTransformStreamType = (value, optionName) => {
  validateNonGeneratorType(value, optionName, "web TransformStream");
  return "webTransform";
};
const validateNonGeneratorType = ({ final, binary, objectMode }, optionName, typeName) => {
  checkUndefinedOption(final, `${optionName}.final`, typeName);
  checkUndefinedOption(binary, `${optionName}.binary`, typeName);
  checkBooleanOption(objectMode, `${optionName}.objectMode`);
};
const checkUndefinedOption = (value, optionName, typeName) => {
  if (value !== void 0) {
    throw new TypeError(`The \`${optionName}\` option can only be defined when using a generator, not a ${typeName}.`);
  }
};
const getGeneratorObjectType = ({ transform: transform2, final, binary, objectMode }, optionName) => {
  if (transform2 !== void 0 && !isGenerator(transform2)) {
    throw new TypeError(`The \`${optionName}.transform\` option must be a generator, a Duplex stream or a web TransformStream.`);
  }
  if (isDuplexStream(final, { checkOpen: false })) {
    throw new TypeError(`The \`${optionName}.final\` option must not be a Duplex stream.`);
  }
  if (isTransformStream(final)) {
    throw new TypeError(`The \`${optionName}.final\` option must not be a web TransformStream.`);
  }
  if (final !== void 0 && !isGenerator(final)) {
    throw new TypeError(`The \`${optionName}.final\` option must be a generator.`);
  }
  checkBooleanOption(binary, `${optionName}.binary`);
  checkBooleanOption(objectMode, `${optionName}.objectMode`);
  return isAsyncGenerator(transform2) || isAsyncGenerator(final) ? "asyncGenerator" : "generator";
};
const checkBooleanOption = (value, optionName) => {
  if (value !== void 0 && typeof value !== "boolean") {
    throw new TypeError(`The \`${optionName}\` option must use a boolean.`);
  }
};
const isGenerator = (value) => isAsyncGenerator(value) || isSyncGenerator(value);
const isAsyncGenerator = (value) => Object.prototype.toString.call(value) === "[object AsyncGeneratorFunction]";
const isSyncGenerator = (value) => Object.prototype.toString.call(value) === "[object GeneratorFunction]";
const isTransformOptions = (value) => isPlainObject(value) && (value.transform !== void 0 || value.final !== void 0);
const isUrl = (value) => Object.prototype.toString.call(value) === "[object URL]";
const isRegularUrl = (value) => isUrl(value) && value.protocol !== "file:";
const isFilePathObject = (value) => isPlainObject(value) && Object.keys(value).length > 0 && Object.keys(value).every((key) => FILE_PATH_KEYS.has(key)) && isFilePathString(value.file);
const FILE_PATH_KEYS = /* @__PURE__ */ new Set(["file", "append"]);
const isFilePathString = (file) => typeof file === "string";
const isUnknownStdioString = (type, value) => type === "native" && typeof value === "string" && !KNOWN_STDIO_STRINGS.has(value);
const KNOWN_STDIO_STRINGS = /* @__PURE__ */ new Set(["ipc", "ignore", "inherit", "overlapped", "pipe"]);
const isReadableStream = (value) => Object.prototype.toString.call(value) === "[object ReadableStream]";
const isWritableStream = (value) => Object.prototype.toString.call(value) === "[object WritableStream]";
const isWebStream = (value) => isReadableStream(value) || isWritableStream(value);
const isTransformStream = (value) => isReadableStream(value == null ? void 0 : value.readable) && isWritableStream(value == null ? void 0 : value.writable);
const isAsyncIterableObject = (value) => isObject$1(value) && typeof value[Symbol.asyncIterator] === "function";
const isIterableObject = (value) => isObject$1(value) && typeof value[Symbol.iterator] === "function";
const isObject$1 = (value) => typeof value === "object" && value !== null;
const TRANSFORM_TYPES = /* @__PURE__ */ new Set(["generator", "asyncGenerator", "duplex", "webTransform"]);
const FILE_TYPES = /* @__PURE__ */ new Set(["fileUrl", "filePath", "fileNumber"]);
const SPECIAL_DUPLICATE_TYPES_SYNC = /* @__PURE__ */ new Set(["fileUrl", "filePath"]);
const SPECIAL_DUPLICATE_TYPES = /* @__PURE__ */ new Set([...SPECIAL_DUPLICATE_TYPES_SYNC, "webStream", "nodeStream"]);
const FORBID_DUPLICATE_TYPES = /* @__PURE__ */ new Set(["webTransform", "duplex"]);
const TYPE_TO_MESSAGE = {
  generator: "a generator",
  asyncGenerator: "an async generator",
  fileUrl: "a file URL",
  filePath: "a file path string",
  fileNumber: "a file descriptor number",
  webStream: "a web stream",
  nodeStream: "a Node.js stream",
  webTransform: "a web TransformStream",
  duplex: "a Duplex stream",
  native: "any value",
  iterable: "an iterable",
  asyncIterable: "an async iterable",
  string: "a string",
  uint8Array: "a Uint8Array"
};
const getTransformObjectModes = (objectMode, index, newTransforms, direction) => direction === "output" ? getOutputObjectModes(objectMode, index, newTransforms) : getInputObjectModes(objectMode, index, newTransforms);
const getOutputObjectModes = (objectMode, index, newTransforms) => {
  const writableObjectMode = index !== 0 && newTransforms[index - 1].value.readableObjectMode;
  const readableObjectMode = objectMode ?? writableObjectMode;
  return { writableObjectMode, readableObjectMode };
};
const getInputObjectModes = (objectMode, index, newTransforms) => {
  const writableObjectMode = index === 0 ? objectMode === true : newTransforms[index - 1].value.readableObjectMode;
  const readableObjectMode = index !== newTransforms.length - 1 && (objectMode ?? writableObjectMode);
  return { writableObjectMode, readableObjectMode };
};
const getFdObjectMode = (stdioItems, direction) => {
  const lastTransform = stdioItems.findLast(({ type }) => TRANSFORM_TYPES.has(type));
  if (lastTransform === void 0) {
    return false;
  }
  return direction === "input" ? lastTransform.value.writableObjectMode : lastTransform.value.readableObjectMode;
};
const normalizeTransforms = (stdioItems, optionName, direction, options) => [
  ...stdioItems.filter(({ type }) => !TRANSFORM_TYPES.has(type)),
  ...getTransforms(stdioItems, optionName, direction, options)
];
const getTransforms = (stdioItems, optionName, direction, { encoding }) => {
  const transforms = stdioItems.filter(({ type }) => TRANSFORM_TYPES.has(type));
  const newTransforms = Array.from({ length: transforms.length });
  for (const [index, stdioItem] of Object.entries(transforms)) {
    newTransforms[index] = normalizeTransform({
      stdioItem,
      index: Number(index),
      newTransforms,
      optionName,
      direction,
      encoding
    });
  }
  return sortTransforms(newTransforms, direction);
};
const normalizeTransform = ({ stdioItem, stdioItem: { type }, index, newTransforms, optionName, direction, encoding }) => {
  if (type === "duplex") {
    return normalizeDuplex({ stdioItem, optionName });
  }
  if (type === "webTransform") {
    return normalizeTransformStream({
      stdioItem,
      index,
      newTransforms,
      direction
    });
  }
  return normalizeGenerator({
    stdioItem,
    index,
    newTransforms,
    direction,
    encoding
  });
};
const normalizeDuplex = ({
  stdioItem,
  stdioItem: {
    value: {
      transform: transform2,
      transform: { writableObjectMode, readableObjectMode },
      objectMode = readableObjectMode
    }
  },
  optionName
}) => {
  if (objectMode && !readableObjectMode) {
    throw new TypeError(`The \`${optionName}.objectMode\` option can only be \`true\` if \`new Duplex({objectMode: true})\` is used.`);
  }
  if (!objectMode && readableObjectMode) {
    throw new TypeError(`The \`${optionName}.objectMode\` option cannot be \`false\` if \`new Duplex({objectMode: true})\` is used.`);
  }
  return {
    ...stdioItem,
    value: { transform: transform2, writableObjectMode, readableObjectMode }
  };
};
const normalizeTransformStream = ({ stdioItem, stdioItem: { value }, index, newTransforms, direction }) => {
  const { transform: transform2, objectMode } = isPlainObject(value) ? value : { transform: value };
  const { writableObjectMode, readableObjectMode } = getTransformObjectModes(objectMode, index, newTransforms, direction);
  return {
    ...stdioItem,
    value: { transform: transform2, writableObjectMode, readableObjectMode }
  };
};
const normalizeGenerator = ({ stdioItem, stdioItem: { value }, index, newTransforms, direction, encoding }) => {
  const {
    transform: transform2,
    final,
    binary: binaryOption = false,
    preserveNewlines = false,
    objectMode
  } = isPlainObject(value) ? value : { transform: value };
  const binary = binaryOption || BINARY_ENCODINGS.has(encoding);
  const { writableObjectMode, readableObjectMode } = getTransformObjectModes(objectMode, index, newTransforms, direction);
  return {
    ...stdioItem,
    value: {
      transform: transform2,
      final,
      binary,
      preserveNewlines,
      writableObjectMode,
      readableObjectMode
    }
  };
};
const sortTransforms = (newTransforms, direction) => direction === "input" ? newTransforms.reverse() : newTransforms;
const getStreamDirection = (stdioItems, fdNumber, optionName) => {
  const directions = stdioItems.map((stdioItem) => getStdioItemDirection(stdioItem, fdNumber));
  if (directions.includes("input") && directions.includes("output")) {
    throw new TypeError(`The \`${optionName}\` option must not be an array of both readable and writable values.`);
  }
  return directions.find(Boolean) ?? DEFAULT_DIRECTION;
};
const getStdioItemDirection = ({ type, value }, fdNumber) => KNOWN_DIRECTIONS[fdNumber] ?? guessStreamDirection[type](value);
const KNOWN_DIRECTIONS = ["input", "output", "output"];
const anyDirection = () => void 0;
const alwaysInput = () => "input";
const guessStreamDirection = {
  generator: anyDirection,
  asyncGenerator: anyDirection,
  fileUrl: anyDirection,
  filePath: anyDirection,
  iterable: alwaysInput,
  asyncIterable: alwaysInput,
  uint8Array: alwaysInput,
  webStream: (value) => isWritableStream(value) ? "output" : "input",
  nodeStream(value) {
    if (!isReadableStream$1(value, { checkOpen: false })) {
      return "output";
    }
    return isWritableStream$1(value, { checkOpen: false }) ? void 0 : "input";
  },
  webTransform: anyDirection,
  duplex: anyDirection,
  native(value) {
    const standardStreamDirection = getStandardStreamDirection(value);
    if (standardStreamDirection !== void 0) {
      return standardStreamDirection;
    }
    if (isStream(value, { checkOpen: false })) {
      return guessStreamDirection.nodeStream(value);
    }
  }
};
const getStandardStreamDirection = (value) => {
  if ([0, process$2.stdin].includes(value)) {
    return "input";
  }
  if ([1, 2, process$2.stdout, process$2.stderr].includes(value)) {
    return "output";
  }
};
const DEFAULT_DIRECTION = "output";
const normalizeIpcStdioArray = (stdioArray, ipc) => ipc && !stdioArray.includes("ipc") ? [...stdioArray, "ipc"] : stdioArray;
const normalizeStdioOption = ({ stdio, ipc, buffer, ...options }, verboseInfo, isSync) => {
  const stdioArray = getStdioArray(stdio, options).map((stdioOption, fdNumber) => addDefaultValue(stdioOption, fdNumber));
  return isSync ? normalizeStdioSync(stdioArray, buffer, verboseInfo) : normalizeIpcStdioArray(stdioArray, ipc);
};
const getStdioArray = (stdio, options) => {
  if (stdio === void 0) {
    return STANDARD_STREAMS_ALIASES.map((alias) => options[alias]);
  }
  if (hasAlias(options)) {
    throw new Error(`It's not possible to provide \`stdio\` in combination with one of ${STANDARD_STREAMS_ALIASES.map((alias) => `\`${alias}\``).join(", ")}`);
  }
  if (typeof stdio === "string") {
    return [stdio, stdio, stdio];
  }
  if (!Array.isArray(stdio)) {
    throw new TypeError(`Expected \`stdio\` to be of type \`string\` or \`Array\`, got \`${typeof stdio}\``);
  }
  const length = Math.max(stdio.length, STANDARD_STREAMS_ALIASES.length);
  return Array.from({ length }, (_, fdNumber) => stdio[fdNumber]);
};
const hasAlias = (options) => STANDARD_STREAMS_ALIASES.some((alias) => options[alias] !== void 0);
const addDefaultValue = (stdioOption, fdNumber) => {
  if (Array.isArray(stdioOption)) {
    return stdioOption.map((item) => addDefaultValue(item, fdNumber));
  }
  if (stdioOption === null || stdioOption === void 0) {
    return fdNumber >= STANDARD_STREAMS_ALIASES.length ? "ignore" : "pipe";
  }
  return stdioOption;
};
const normalizeStdioSync = (stdioArray, buffer, verboseInfo) => stdioArray.map((stdioOption, fdNumber) => !buffer[fdNumber] && fdNumber !== 0 && !isFullVerbose(verboseInfo, fdNumber) && isOutputPipeOnly(stdioOption) ? "ignore" : stdioOption);
const isOutputPipeOnly = (stdioOption) => stdioOption === "pipe" || Array.isArray(stdioOption) && stdioOption.every((item) => item === "pipe");
const handleNativeStream = ({ stdioItem, stdioItem: { type }, isStdioArray, fdNumber, direction, isSync }) => {
  if (!isStdioArray || type !== "native") {
    return stdioItem;
  }
  return isSync ? handleNativeStreamSync({ stdioItem, fdNumber, direction }) : handleNativeStreamAsync({ stdioItem, fdNumber });
};
const handleNativeStreamSync = ({ stdioItem, stdioItem: { value, optionName }, fdNumber, direction }) => {
  const targetFd = getTargetFd({
    value,
    optionName,
    fdNumber,
    direction
  });
  if (targetFd !== void 0) {
    return targetFd;
  }
  if (isStream(value, { checkOpen: false })) {
    throw new TypeError(`The \`${optionName}: Stream\` option cannot both be an array and include a stream with synchronous methods.`);
  }
  return stdioItem;
};
const getTargetFd = ({ value, optionName, fdNumber, direction }) => {
  const targetFdNumber = getTargetFdNumber(value, fdNumber);
  if (targetFdNumber === void 0) {
    return;
  }
  if (direction === "output") {
    return { type: "fileNumber", value: targetFdNumber, optionName };
  }
  if (tty.isatty(targetFdNumber)) {
    throw new TypeError(`The \`${optionName}: ${serializeOptionValue(value)}\` option is invalid: it cannot be a TTY with synchronous methods.`);
  }
  return { type: "uint8Array", value: bufferToUint8Array(node_fs.readFileSync(targetFdNumber)), optionName };
};
const getTargetFdNumber = (value, fdNumber) => {
  if (value === "inherit") {
    return fdNumber;
  }
  if (typeof value === "number") {
    return value;
  }
  const standardStreamIndex = STANDARD_STREAMS.indexOf(value);
  if (standardStreamIndex !== -1) {
    return standardStreamIndex;
  }
};
const handleNativeStreamAsync = ({ stdioItem, stdioItem: { value, optionName }, fdNumber }) => {
  if (value === "inherit") {
    return { type: "nodeStream", value: getStandardStream(fdNumber, value, optionName), optionName };
  }
  if (typeof value === "number") {
    return { type: "nodeStream", value: getStandardStream(value, value, optionName), optionName };
  }
  if (isStream(value, { checkOpen: false })) {
    return { type: "nodeStream", value, optionName };
  }
  return stdioItem;
};
const getStandardStream = (fdNumber, value, optionName) => {
  const standardStream = STANDARD_STREAMS[fdNumber];
  if (standardStream === void 0) {
    throw new TypeError(`The \`${optionName}: ${value}\` option is invalid: no such standard stream.`);
  }
  return standardStream;
};
const handleInputOptions = ({ input, inputFile }, fdNumber) => fdNumber === 0 ? [
  ...handleInputOption(input),
  ...handleInputFileOption(inputFile)
] : [];
const handleInputOption = (input) => input === void 0 ? [] : [{
  type: getInputType(input),
  value: input,
  optionName: "input"
}];
const getInputType = (input) => {
  if (isReadableStream$1(input, { checkOpen: false })) {
    return "nodeStream";
  }
  if (typeof input === "string") {
    return "string";
  }
  if (isUint8Array(input)) {
    return "uint8Array";
  }
  throw new Error("The `input` option must be a string, a Uint8Array or a Node.js Readable stream.");
};
const handleInputFileOption = (inputFile) => inputFile === void 0 ? [] : [{
  ...getInputFileType(inputFile),
  optionName: "inputFile"
}];
const getInputFileType = (inputFile) => {
  if (isUrl(inputFile)) {
    return { type: "fileUrl", value: inputFile };
  }
  if (isFilePathString(inputFile)) {
    return { type: "filePath", value: { file: inputFile } };
  }
  throw new Error("The `inputFile` option must be a file path string or a file URL.");
};
const filterDuplicates = (stdioItems) => stdioItems.filter((stdioItemOne, indexOne) => stdioItems.every((stdioItemTwo, indexTwo) => stdioItemOne.value !== stdioItemTwo.value || indexOne >= indexTwo || stdioItemOne.type === "generator" || stdioItemOne.type === "asyncGenerator"));
const getDuplicateStream = ({ stdioItem: { type, value, optionName }, direction, fileDescriptors, isSync }) => {
  const otherStdioItems = getOtherStdioItems(fileDescriptors, type);
  if (otherStdioItems.length === 0) {
    return;
  }
  if (isSync) {
    validateDuplicateStreamSync({
      otherStdioItems,
      type,
      value,
      optionName,
      direction
    });
    return;
  }
  if (SPECIAL_DUPLICATE_TYPES.has(type)) {
    return getDuplicateStreamInstance({
      otherStdioItems,
      type,
      value,
      optionName,
      direction
    });
  }
  if (FORBID_DUPLICATE_TYPES.has(type)) {
    validateDuplicateTransform({
      otherStdioItems,
      type,
      value,
      optionName
    });
  }
};
const getOtherStdioItems = (fileDescriptors, type) => fileDescriptors.flatMap(({ direction, stdioItems }) => stdioItems.filter((stdioItem) => stdioItem.type === type).map((stdioItem) => ({ ...stdioItem, direction })));
const validateDuplicateStreamSync = ({ otherStdioItems, type, value, optionName, direction }) => {
  if (SPECIAL_DUPLICATE_TYPES_SYNC.has(type)) {
    getDuplicateStreamInstance({
      otherStdioItems,
      type,
      value,
      optionName,
      direction
    });
  }
};
const getDuplicateStreamInstance = ({ otherStdioItems, type, value, optionName, direction }) => {
  const duplicateStdioItems = otherStdioItems.filter((stdioItem) => hasSameValue(stdioItem, value));
  if (duplicateStdioItems.length === 0) {
    return;
  }
  const differentStdioItem = duplicateStdioItems.find((stdioItem) => stdioItem.direction !== direction);
  throwOnDuplicateStream(differentStdioItem, optionName, type);
  return direction === "output" ? duplicateStdioItems[0].stream : void 0;
};
const hasSameValue = ({ type, value }, secondValue) => {
  if (type === "filePath") {
    return value.file === secondValue.file;
  }
  if (type === "fileUrl") {
    return value.href === secondValue.href;
  }
  return value === secondValue;
};
const validateDuplicateTransform = ({ otherStdioItems, type, value, optionName }) => {
  const duplicateStdioItem = otherStdioItems.find(({ value: { transform: transform2 } }) => transform2 === value.transform);
  throwOnDuplicateStream(duplicateStdioItem, optionName, type);
};
const throwOnDuplicateStream = (stdioItem, optionName, type) => {
  if (stdioItem !== void 0) {
    throw new TypeError(`The \`${stdioItem.optionName}\` and \`${optionName}\` options must not target ${TYPE_TO_MESSAGE[type]} that is the same.`);
  }
};
const handleStdio = (addProperties2, options, verboseInfo, isSync) => {
  const stdio = normalizeStdioOption(options, verboseInfo, isSync);
  const initialFileDescriptors = stdio.map((stdioOption, fdNumber) => getFileDescriptor({
    stdioOption,
    fdNumber,
    options,
    isSync
  }));
  const fileDescriptors = getFinalFileDescriptors({
    initialFileDescriptors,
    addProperties: addProperties2,
    options,
    isSync
  });
  options.stdio = fileDescriptors.map(({ stdioItems }) => forwardStdio(stdioItems));
  return fileDescriptors;
};
const getFileDescriptor = ({ stdioOption, fdNumber, options, isSync }) => {
  const optionName = getStreamName(fdNumber);
  const { stdioItems: initialStdioItems, isStdioArray } = initializeStdioItems({
    stdioOption,
    fdNumber,
    options,
    optionName
  });
  const direction = getStreamDirection(initialStdioItems, fdNumber, optionName);
  const stdioItems = initialStdioItems.map((stdioItem) => handleNativeStream({
    stdioItem,
    isStdioArray,
    fdNumber,
    direction,
    isSync
  }));
  const normalizedStdioItems = normalizeTransforms(stdioItems, optionName, direction, options);
  const objectMode = getFdObjectMode(normalizedStdioItems, direction);
  validateFileObjectMode(normalizedStdioItems, objectMode);
  return { direction, objectMode, stdioItems: normalizedStdioItems };
};
const initializeStdioItems = ({ stdioOption, fdNumber, options, optionName }) => {
  const values = Array.isArray(stdioOption) ? stdioOption : [stdioOption];
  const initialStdioItems = [
    ...values.map((value) => initializeStdioItem(value, optionName)),
    ...handleInputOptions(options, fdNumber)
  ];
  const stdioItems = filterDuplicates(initialStdioItems);
  const isStdioArray = stdioItems.length > 1;
  validateStdioArray(stdioItems, isStdioArray, optionName);
  validateStreams(stdioItems);
  return { stdioItems, isStdioArray };
};
const initializeStdioItem = (value, optionName) => ({
  type: getStdioItemType(value, optionName),
  value,
  optionName
});
const validateStdioArray = (stdioItems, isStdioArray, optionName) => {
  if (stdioItems.length === 0) {
    throw new TypeError(`The \`${optionName}\` option must not be an empty array.`);
  }
  if (!isStdioArray) {
    return;
  }
  for (const { value, optionName: optionName2 } of stdioItems) {
    if (INVALID_STDIO_ARRAY_OPTIONS.has(value)) {
      throw new Error(`The \`${optionName2}\` option must not include \`${value}\`.`);
    }
  }
};
const INVALID_STDIO_ARRAY_OPTIONS = /* @__PURE__ */ new Set(["ignore", "ipc"]);
const validateStreams = (stdioItems) => {
  for (const stdioItem of stdioItems) {
    validateFileStdio(stdioItem);
  }
};
const validateFileStdio = ({ type, value, optionName }) => {
  if (isRegularUrl(value)) {
    throw new TypeError(`The \`${optionName}: URL\` option must use the \`file:\` scheme.
For example, you can use the \`pathToFileURL()\` method of the \`url\` core module.`);
  }
  if (isUnknownStdioString(type, value)) {
    throw new TypeError(`The \`${optionName}: { file: '...' }\` option must be used instead of \`${optionName}: '...'\`.`);
  }
};
const validateFileObjectMode = (stdioItems, objectMode) => {
  if (!objectMode) {
    return;
  }
  const fileStdioItem = stdioItems.find(({ type }) => FILE_TYPES.has(type));
  if (fileStdioItem !== void 0) {
    throw new TypeError(`The \`${fileStdioItem.optionName}\` option cannot use both files and transforms in objectMode.`);
  }
};
const getFinalFileDescriptors = ({ initialFileDescriptors, addProperties: addProperties2, options, isSync }) => {
  const fileDescriptors = [];
  try {
    for (const fileDescriptor of initialFileDescriptors) {
      fileDescriptors.push(getFinalFileDescriptor({
        fileDescriptor,
        fileDescriptors,
        addProperties: addProperties2,
        options,
        isSync
      }));
    }
    return fileDescriptors;
  } catch (error2) {
    cleanupCustomStreams(fileDescriptors);
    throw error2;
  }
};
const getFinalFileDescriptor = ({
  fileDescriptor: { direction, objectMode, stdioItems },
  fileDescriptors,
  addProperties: addProperties2,
  options,
  isSync
}) => {
  const finalStdioItems = stdioItems.map((stdioItem) => addStreamProperties({
    stdioItem,
    addProperties: addProperties2,
    direction,
    options,
    fileDescriptors,
    isSync
  }));
  return { direction, objectMode, stdioItems: finalStdioItems };
};
const addStreamProperties = ({ stdioItem, addProperties: addProperties2, direction, options, fileDescriptors, isSync }) => {
  const duplicateStream = getDuplicateStream({
    stdioItem,
    direction,
    fileDescriptors,
    isSync
  });
  if (duplicateStream !== void 0) {
    return { ...stdioItem, stream: duplicateStream };
  }
  return {
    ...stdioItem,
    ...addProperties2[direction][stdioItem.type](stdioItem, options)
  };
};
const cleanupCustomStreams = (fileDescriptors) => {
  for (const { stdioItems } of fileDescriptors) {
    for (const { stream: stream2 } of stdioItems) {
      if (stream2 !== void 0 && !isStandardStream(stream2)) {
        stream2.destroy();
      }
    }
  }
};
const forwardStdio = (stdioItems) => {
  if (stdioItems.length > 1) {
    return stdioItems.some(({ value: value2 }) => value2 === "overlapped") ? "overlapped" : "pipe";
  }
  const [{ type, value }] = stdioItems;
  return type === "native" ? value : "pipe";
};
const handleStdioSync = (options, verboseInfo) => handleStdio(addPropertiesSync, options, verboseInfo, true);
const forbiddenIfSync = ({ type, optionName }) => {
  throwInvalidSyncValue(optionName, TYPE_TO_MESSAGE[type]);
};
const forbiddenNativeIfSync = ({ optionName, value }) => {
  if (value === "ipc" || value === "overlapped") {
    throwInvalidSyncValue(optionName, `"${value}"`);
  }
  return {};
};
const throwInvalidSyncValue = (optionName, value) => {
  throw new TypeError(`The \`${optionName}\` option cannot be ${value} with synchronous methods.`);
};
const addProperties$1 = {
  generator() {
  },
  asyncGenerator: forbiddenIfSync,
  webStream: forbiddenIfSync,
  nodeStream: forbiddenIfSync,
  webTransform: forbiddenIfSync,
  duplex: forbiddenIfSync,
  asyncIterable: forbiddenIfSync,
  native: forbiddenNativeIfSync
};
const addPropertiesSync = {
  input: {
    ...addProperties$1,
    fileUrl: ({ value }) => ({ contents: [bufferToUint8Array(node_fs.readFileSync(value))] }),
    filePath: ({ value: { file } }) => ({ contents: [bufferToUint8Array(node_fs.readFileSync(file))] }),
    fileNumber: forbiddenIfSync,
    iterable: ({ value }) => ({ contents: [...value] }),
    string: ({ value }) => ({ contents: [value] }),
    uint8Array: ({ value }) => ({ contents: [value] })
  },
  output: {
    ...addProperties$1,
    fileUrl: ({ value }) => ({ path: value }),
    filePath: ({ value: { file, append: append2 } }) => ({ path: file, append: append2 }),
    fileNumber: ({ value }) => ({ path: value }),
    iterable: forbiddenIfSync,
    string: forbiddenIfSync,
    uint8Array: forbiddenIfSync
  }
};
const stripNewline = (value, { stripFinalNewline: stripFinalNewline$1 }, fdNumber) => getStripFinalNewline(stripFinalNewline$1, fdNumber) && value !== void 0 && !Array.isArray(value) ? stripFinalNewline(value) : value;
const getStripFinalNewline = (stripFinalNewline2, fdNumber) => fdNumber === "all" ? stripFinalNewline2[1] || stripFinalNewline2[2] : stripFinalNewline2[fdNumber];
const getSplitLinesGenerator = (binary, preserveNewlines, skipped, state) => binary || skipped ? void 0 : initializeSplitLines(preserveNewlines, state);
const splitLinesSync = (chunk, preserveNewlines, objectMode) => objectMode ? chunk.flatMap((item) => splitLinesItemSync(item, preserveNewlines)) : splitLinesItemSync(chunk, preserveNewlines);
const splitLinesItemSync = (chunk, preserveNewlines) => {
  const { transform: transform2, final } = initializeSplitLines(preserveNewlines, {});
  return [...transform2(chunk), ...final()];
};
const initializeSplitLines = (preserveNewlines, state) => {
  state.previousChunks = "";
  return {
    transform: splitGenerator.bind(void 0, state, preserveNewlines),
    final: linesFinal.bind(void 0, state)
  };
};
const splitGenerator = function* (state, preserveNewlines, chunk) {
  if (typeof chunk !== "string") {
    yield chunk;
    return;
  }
  let { previousChunks } = state;
  let start = -1;
  for (let end = 0; end < chunk.length; end += 1) {
    if (chunk[end] === "\n") {
      const newlineLength = getNewlineLength(chunk, end, preserveNewlines, state);
      let line = chunk.slice(start + 1, end + 1 - newlineLength);
      if (previousChunks.length > 0) {
        line = concatString(previousChunks, line);
        previousChunks = "";
      }
      yield line;
      start = end;
    }
  }
  if (start !== chunk.length - 1) {
    previousChunks = concatString(previousChunks, chunk.slice(start + 1));
  }
  state.previousChunks = previousChunks;
};
const getNewlineLength = (chunk, end, preserveNewlines, state) => {
  if (preserveNewlines) {
    return 0;
  }
  state.isWindowsNewline = end !== 0 && chunk[end - 1] === "\r";
  return state.isWindowsNewline ? 2 : 1;
};
const linesFinal = function* ({ previousChunks }) {
  if (previousChunks.length > 0) {
    yield previousChunks;
  }
};
const getAppendNewlineGenerator = ({ binary, preserveNewlines, readableObjectMode, state }) => binary || preserveNewlines || readableObjectMode ? void 0 : { transform: appendNewlineGenerator.bind(void 0, state) };
const appendNewlineGenerator = function* ({ isWindowsNewline = false }, chunk) {
  const { unixNewline, windowsNewline, LF: LF2, concatBytes } = typeof chunk === "string" ? linesStringInfo : linesUint8ArrayInfo;
  if (chunk.at(-1) === LF2) {
    yield chunk;
    return;
  }
  const newline = isWindowsNewline ? windowsNewline : unixNewline;
  yield concatBytes(chunk, newline);
};
const concatString = (firstChunk, secondChunk) => `${firstChunk}${secondChunk}`;
const linesStringInfo = {
  windowsNewline: "\r\n",
  unixNewline: "\n",
  LF: "\n",
  concatBytes: concatString
};
const concatUint8Array = (firstChunk, secondChunk) => {
  const chunk = new Uint8Array(firstChunk.length + secondChunk.length);
  chunk.set(firstChunk, 0);
  chunk.set(secondChunk, firstChunk.length);
  return chunk;
};
const linesUint8ArrayInfo = {
  windowsNewline: new Uint8Array([13, 10]),
  unixNewline: new Uint8Array([10]),
  LF: 10,
  concatBytes: concatUint8Array
};
const getValidateTransformInput = (writableObjectMode, optionName) => writableObjectMode ? void 0 : validateStringTransformInput.bind(void 0, optionName);
const validateStringTransformInput = function* (optionName, chunk) {
  if (typeof chunk !== "string" && !isUint8Array(chunk) && !node_buffer.Buffer.isBuffer(chunk)) {
    throw new TypeError(`The \`${optionName}\` option's transform must use "objectMode: true" to receive as input: ${typeof chunk}.`);
  }
  yield chunk;
};
const getValidateTransformReturn = (readableObjectMode, optionName) => readableObjectMode ? validateObjectTransformReturn.bind(void 0, optionName) : validateStringTransformReturn.bind(void 0, optionName);
const validateObjectTransformReturn = function* (optionName, chunk) {
  validateEmptyReturn(optionName, chunk);
  yield chunk;
};
const validateStringTransformReturn = function* (optionName, chunk) {
  validateEmptyReturn(optionName, chunk);
  if (typeof chunk !== "string" && !isUint8Array(chunk)) {
    throw new TypeError(`The \`${optionName}\` option's function must yield a string or an Uint8Array, not ${typeof chunk}.`);
  }
  yield chunk;
};
const validateEmptyReturn = (optionName, chunk) => {
  if (chunk === null || chunk === void 0) {
    throw new TypeError(`The \`${optionName}\` option's function must not call \`yield ${chunk}\`.
Instead, \`yield\` should either be called with a value, or not be called at all. For example:
  if (condition) { yield value; }`);
  }
};
const getEncodingTransformGenerator = (binary, encoding, skipped) => {
  if (skipped) {
    return;
  }
  if (binary) {
    return { transform: encodingUint8ArrayGenerator.bind(void 0, new TextEncoder()) };
  }
  const stringDecoder = new node_string_decoder.StringDecoder(encoding);
  return {
    transform: encodingStringGenerator.bind(void 0, stringDecoder),
    final: encodingStringFinal.bind(void 0, stringDecoder)
  };
};
const encodingUint8ArrayGenerator = function* (textEncoder2, chunk) {
  if (node_buffer.Buffer.isBuffer(chunk)) {
    yield bufferToUint8Array(chunk);
  } else if (typeof chunk === "string") {
    yield textEncoder2.encode(chunk);
  } else {
    yield chunk;
  }
};
const encodingStringGenerator = function* (stringDecoder, chunk) {
  yield isUint8Array(chunk) ? stringDecoder.write(chunk) : chunk;
};
const encodingStringFinal = function* (stringDecoder) {
  const lastChunk = stringDecoder.end();
  if (lastChunk !== "") {
    yield lastChunk;
  }
};
const pushChunks = node_util.callbackify(async (getChunks, state, getChunksArguments, transformStream) => {
  state.currentIterable = getChunks(...getChunksArguments);
  try {
    for await (const chunk of state.currentIterable) {
      transformStream.push(chunk);
    }
  } finally {
    delete state.currentIterable;
  }
});
const transformChunk = async function* (chunk, generators, index) {
  if (index === generators.length) {
    yield chunk;
    return;
  }
  const { transform: transform2 = identityGenerator$1 } = generators[index];
  for await (const transformedChunk of transform2(chunk)) {
    yield* transformChunk(transformedChunk, generators, index + 1);
  }
};
const finalChunks = async function* (generators) {
  for (const [index, { final }] of Object.entries(generators)) {
    yield* generatorFinalChunks(final, Number(index), generators);
  }
};
const generatorFinalChunks = async function* (final, index, generators) {
  if (final === void 0) {
    return;
  }
  for await (const finalChunk of final()) {
    yield* transformChunk(finalChunk, generators, index + 1);
  }
};
const destroyTransform = node_util.callbackify(async ({ currentIterable }, error2) => {
  if (currentIterable !== void 0) {
    await (error2 ? currentIterable.throw(error2) : currentIterable.return());
    return;
  }
  if (error2) {
    throw error2;
  }
});
const identityGenerator$1 = function* (chunk) {
  yield chunk;
};
const pushChunksSync = (getChunksSync, getChunksArguments, transformStream, done) => {
  try {
    for (const chunk of getChunksSync(...getChunksArguments)) {
      transformStream.push(chunk);
    }
    done();
  } catch (error2) {
    done(error2);
  }
};
const runTransformSync = (generators, chunks) => [
  ...chunks.flatMap((chunk) => [...transformChunkSync(chunk, generators, 0)]),
  ...finalChunksSync(generators)
];
const transformChunkSync = function* (chunk, generators, index) {
  if (index === generators.length) {
    yield chunk;
    return;
  }
  const { transform: transform2 = identityGenerator } = generators[index];
  for (const transformedChunk of transform2(chunk)) {
    yield* transformChunkSync(transformedChunk, generators, index + 1);
  }
};
const finalChunksSync = function* (generators) {
  for (const [index, { final }] of Object.entries(generators)) {
    yield* generatorFinalChunksSync(final, Number(index), generators);
  }
};
const generatorFinalChunksSync = function* (final, index, generators) {
  if (final === void 0) {
    return;
  }
  for (const finalChunk of final()) {
    yield* transformChunkSync(finalChunk, generators, index + 1);
  }
};
const identityGenerator = function* (chunk) {
  yield chunk;
};
const generatorToStream = ({
  value,
  value: { transform: transform2, final, writableObjectMode, readableObjectMode },
  optionName
}, { encoding }) => {
  const state = {};
  const generators = addInternalGenerators(value, encoding, optionName);
  const transformAsync = isAsyncGenerator(transform2);
  const finalAsync = isAsyncGenerator(final);
  const transformMethod = transformAsync ? pushChunks.bind(void 0, transformChunk, state) : pushChunksSync.bind(void 0, transformChunkSync);
  const finalMethod = transformAsync || finalAsync ? pushChunks.bind(void 0, finalChunks, state) : pushChunksSync.bind(void 0, finalChunksSync);
  const destroyMethod = transformAsync || finalAsync ? destroyTransform.bind(void 0, state) : void 0;
  const stream2 = new node_stream.Transform({
    writableObjectMode,
    writableHighWaterMark: node_stream.getDefaultHighWaterMark(writableObjectMode),
    readableObjectMode,
    readableHighWaterMark: node_stream.getDefaultHighWaterMark(readableObjectMode),
    transform(chunk, encoding2, done) {
      transformMethod([chunk, generators, 0], this, done);
    },
    flush(done) {
      finalMethod([generators], this, done);
    },
    destroy: destroyMethod
  });
  return { stream: stream2 };
};
const runGeneratorsSync = (chunks, stdioItems, encoding, isInput) => {
  const generators = stdioItems.filter(({ type }) => type === "generator");
  const reversedGenerators = isInput ? generators.reverse() : generators;
  for (const { value, optionName } of reversedGenerators) {
    const generators2 = addInternalGenerators(value, encoding, optionName);
    chunks = runTransformSync(generators2, chunks);
  }
  return chunks;
};
const addInternalGenerators = ({ transform: transform2, final, binary, writableObjectMode, readableObjectMode, preserveNewlines }, encoding, optionName) => {
  const state = {};
  return [
    { transform: getValidateTransformInput(writableObjectMode, optionName) },
    getEncodingTransformGenerator(binary, encoding, writableObjectMode),
    getSplitLinesGenerator(binary, preserveNewlines, writableObjectMode, state),
    { transform: transform2, final },
    { transform: getValidateTransformReturn(readableObjectMode, optionName) },
    getAppendNewlineGenerator({
      binary,
      preserveNewlines,
      readableObjectMode,
      state
    })
  ].filter(Boolean);
};
const addInputOptionsSync = (fileDescriptors, options) => {
  for (const fdNumber of getInputFdNumbers(fileDescriptors)) {
    addInputOptionSync(fileDescriptors, fdNumber, options);
  }
};
const getInputFdNumbers = (fileDescriptors) => new Set(Object.entries(fileDescriptors).filter(([, { direction }]) => direction === "input").map(([fdNumber]) => Number(fdNumber)));
const addInputOptionSync = (fileDescriptors, fdNumber, options) => {
  const { stdioItems } = fileDescriptors[fdNumber];
  const allStdioItems = stdioItems.filter(({ contents }) => contents !== void 0);
  if (allStdioItems.length === 0) {
    return;
  }
  if (fdNumber !== 0) {
    const [{ type, optionName }] = allStdioItems;
    throw new TypeError(`Only the \`stdin\` option, not \`${optionName}\`, can be ${TYPE_TO_MESSAGE[type]} with synchronous methods.`);
  }
  const allContents = allStdioItems.map(({ contents }) => contents);
  const transformedContents = allContents.map((contents) => applySingleInputGeneratorsSync(contents, stdioItems));
  options.input = joinToUint8Array(transformedContents);
};
const applySingleInputGeneratorsSync = (contents, stdioItems) => {
  const newContents = runGeneratorsSync(contents, stdioItems, "utf8", true);
  validateSerializable(newContents);
  return joinToUint8Array(newContents);
};
const validateSerializable = (newContents) => {
  const invalidItem = newContents.find((item) => typeof item !== "string" && !isUint8Array(item));
  if (invalidItem !== void 0) {
    throw new TypeError(`The \`stdin\` option is invalid: when passing objects as input, a transform must be used to serialize them to strings or Uint8Arrays: ${invalidItem}.`);
  }
};
const shouldLogOutput = ({ stdioItems, encoding, verboseInfo, fdNumber }) => fdNumber !== "all" && isFullVerbose(verboseInfo, fdNumber) && !BINARY_ENCODINGS.has(encoding) && fdUsesVerbose(fdNumber) && (stdioItems.some(({ type, value }) => type === "native" && PIPED_STDIO_VALUES.has(value)) || stdioItems.every(({ type }) => TRANSFORM_TYPES.has(type)));
const fdUsesVerbose = (fdNumber) => fdNumber === 1 || fdNumber === 2;
const PIPED_STDIO_VALUES = /* @__PURE__ */ new Set(["pipe", "overlapped"]);
const logLines = async (linesIterable, stream2, fdNumber, verboseInfo) => {
  for await (const line of linesIterable) {
    if (!isPipingStream(stream2)) {
      logLine(line, fdNumber, verboseInfo);
    }
  }
};
const logLinesSync = (linesArray, fdNumber, verboseInfo) => {
  for (const line of linesArray) {
    logLine(line, fdNumber, verboseInfo);
  }
};
const isPipingStream = (stream2) => stream2._readableState.pipes.length > 0;
const logLine = (line, fdNumber, verboseInfo) => {
  const verboseMessage = serializeVerboseMessage(line);
  verboseLog({
    type: "output",
    verboseMessage,
    fdNumber,
    verboseInfo
  });
};
const transformOutputSync = ({ fileDescriptors, syncResult: { output }, options, isMaxBuffer, verboseInfo }) => {
  if (output === null) {
    return { output: Array.from({ length: 3 }) };
  }
  const state = {};
  const outputFiles = /* @__PURE__ */ new Set([]);
  const transformedOutput = output.map((result, fdNumber) => transformOutputResultSync({
    result,
    fileDescriptors,
    fdNumber,
    state,
    outputFiles,
    isMaxBuffer,
    verboseInfo
  }, options));
  return { output: transformedOutput, ...state };
};
const transformOutputResultSync = ({ result, fileDescriptors, fdNumber, state, outputFiles, isMaxBuffer, verboseInfo }, { buffer, encoding, lines, stripFinalNewline: stripFinalNewline2, maxBuffer }) => {
  if (result === null) {
    return;
  }
  const truncatedResult = truncateMaxBufferSync(result, isMaxBuffer, maxBuffer);
  const uint8ArrayResult = bufferToUint8Array(truncatedResult);
  const { stdioItems, objectMode } = fileDescriptors[fdNumber];
  const chunks = runOutputGeneratorsSync([uint8ArrayResult], stdioItems, encoding, state);
  const { serializedResult, finalResult = serializedResult } = serializeChunks({
    chunks,
    objectMode,
    encoding,
    lines,
    stripFinalNewline: stripFinalNewline2,
    fdNumber
  });
  logOutputSync({
    serializedResult,
    fdNumber,
    state,
    verboseInfo,
    encoding,
    stdioItems,
    objectMode
  });
  const returnedResult = buffer[fdNumber] ? finalResult : void 0;
  try {
    if (state.error === void 0) {
      writeToFiles(serializedResult, stdioItems, outputFiles);
    }
    return returnedResult;
  } catch (error2) {
    state.error = error2;
    return returnedResult;
  }
};
const runOutputGeneratorsSync = (chunks, stdioItems, encoding, state) => {
  try {
    return runGeneratorsSync(chunks, stdioItems, encoding, false);
  } catch (error2) {
    state.error = error2;
    return chunks;
  }
};
const serializeChunks = ({ chunks, objectMode, encoding, lines, stripFinalNewline: stripFinalNewline2, fdNumber }) => {
  if (objectMode) {
    return { serializedResult: chunks };
  }
  if (encoding === "buffer") {
    return { serializedResult: joinToUint8Array(chunks) };
  }
  const serializedResult = joinToString(chunks, encoding);
  if (lines[fdNumber]) {
    return { serializedResult, finalResult: splitLinesSync(serializedResult, !stripFinalNewline2[fdNumber], objectMode) };
  }
  return { serializedResult };
};
const logOutputSync = ({ serializedResult, fdNumber, state, verboseInfo, encoding, stdioItems, objectMode }) => {
  if (!shouldLogOutput({
    stdioItems,
    encoding,
    verboseInfo,
    fdNumber
  })) {
    return;
  }
  const linesArray = splitLinesSync(serializedResult, false, objectMode);
  try {
    logLinesSync(linesArray, fdNumber, verboseInfo);
  } catch (error2) {
    state.error ?? (state.error = error2);
  }
};
const writeToFiles = (serializedResult, stdioItems, outputFiles) => {
  for (const { path: path2, append: append2 } of stdioItems.filter(({ type }) => FILE_TYPES.has(type))) {
    const pathString = typeof path2 === "string" ? path2 : path2.toString();
    if (append2 || outputFiles.has(pathString)) {
      node_fs.appendFileSync(path2, serializedResult);
    } else {
      outputFiles.add(pathString);
      node_fs.writeFileSync(path2, serializedResult);
    }
  }
};
const getAllSync = ([, stdout, stderr], options) => {
  if (!options.all) {
    return;
  }
  if (stdout === void 0) {
    return stderr;
  }
  if (stderr === void 0) {
    return stdout;
  }
  if (Array.isArray(stdout)) {
    return Array.isArray(stderr) ? [...stdout, ...stderr] : [...stdout, stripNewline(stderr, options, "all")];
  }
  if (Array.isArray(stderr)) {
    return [stripNewline(stdout, options, "all"), ...stderr];
  }
  if (isUint8Array(stdout) && isUint8Array(stderr)) {
    return concatUint8Arrays([stdout, stderr]);
  }
  return `${stdout}${stderr}`;
};
const waitForExit = async (subprocess, context) => {
  const [exitCode, signal] = await waitForExitOrError(subprocess);
  context.isForcefullyTerminated ?? (context.isForcefullyTerminated = false);
  return [exitCode, signal];
};
const waitForExitOrError = async (subprocess) => {
  const [spawnPayload, exitPayload] = await Promise.allSettled([
    node_events.once(subprocess, "spawn"),
    node_events.once(subprocess, "exit")
  ]);
  if (spawnPayload.status === "rejected") {
    return [];
  }
  return exitPayload.status === "rejected" ? waitForSubprocessExit(subprocess) : exitPayload.value;
};
const waitForSubprocessExit = async (subprocess) => {
  try {
    return await node_events.once(subprocess, "exit");
  } catch {
    return waitForSubprocessExit(subprocess);
  }
};
const waitForSuccessfulExit = async (exitPromise) => {
  const [exitCode, signal] = await exitPromise;
  if (!isSubprocessErrorExit(exitCode, signal) && isFailedExit(exitCode, signal)) {
    throw new DiscardedError();
  }
  return [exitCode, signal];
};
const isSubprocessErrorExit = (exitCode, signal) => exitCode === void 0 && signal === void 0;
const isFailedExit = (exitCode, signal) => exitCode !== 0 || signal !== null;
const getExitResultSync = ({ error: error2, status: exitCode, signal, output }, { maxBuffer }) => {
  const resultError = getResultError(error2, exitCode, signal);
  const timedOut = (resultError == null ? void 0 : resultError.code) === "ETIMEDOUT";
  const isMaxBuffer = isMaxBufferSync(resultError, output, maxBuffer);
  return {
    resultError,
    exitCode,
    signal,
    timedOut,
    isMaxBuffer
  };
};
const getResultError = (error2, exitCode, signal) => {
  if (error2 !== void 0) {
    return error2;
  }
  return isFailedExit(exitCode, signal) ? new DiscardedError() : void 0;
};
const execaCoreSync = (rawFile, rawArguments, rawOptions) => {
  const { file, commandArguments, command, escapedCommand, startTime, verboseInfo, options, fileDescriptors } = handleSyncArguments(rawFile, rawArguments, rawOptions);
  const result = spawnSubprocessSync({
    file,
    commandArguments,
    options,
    command,
    escapedCommand,
    verboseInfo,
    fileDescriptors,
    startTime
  });
  return handleResult(result, verboseInfo, options);
};
const handleSyncArguments = (rawFile, rawArguments, rawOptions) => {
  const { command, escapedCommand, startTime, verboseInfo } = handleCommand(rawFile, rawArguments, rawOptions);
  const syncOptions = normalizeSyncOptions(rawOptions);
  const { file, commandArguments, options } = normalizeOptions(rawFile, rawArguments, syncOptions);
  validateSyncOptions(options);
  const fileDescriptors = handleStdioSync(options, verboseInfo);
  return {
    file,
    commandArguments,
    command,
    escapedCommand,
    startTime,
    verboseInfo,
    options,
    fileDescriptors
  };
};
const normalizeSyncOptions = (options) => options.node && !options.ipc ? { ...options, ipc: false } : options;
const validateSyncOptions = ({ ipc, ipcInput, detached, cancelSignal }) => {
  if (ipcInput) {
    throwInvalidSyncOption("ipcInput");
  }
  if (ipc) {
    throwInvalidSyncOption("ipc: true");
  }
  if (detached) {
    throwInvalidSyncOption("detached: true");
  }
  if (cancelSignal) {
    throwInvalidSyncOption("cancelSignal");
  }
};
const throwInvalidSyncOption = (value) => {
  throw new TypeError(`The "${value}" option cannot be used with synchronous methods.`);
};
const spawnSubprocessSync = ({ file, commandArguments, options, command, escapedCommand, verboseInfo, fileDescriptors, startTime }) => {
  const syncResult = runSubprocessSync({
    file,
    commandArguments,
    options,
    command,
    escapedCommand,
    fileDescriptors,
    startTime
  });
  if (syncResult.failed) {
    return syncResult;
  }
  const { resultError, exitCode, signal, timedOut, isMaxBuffer } = getExitResultSync(syncResult, options);
  const { output, error: error2 = resultError } = transformOutputSync({
    fileDescriptors,
    syncResult,
    options,
    isMaxBuffer,
    verboseInfo
  });
  const stdio = output.map((stdioOutput, fdNumber) => stripNewline(stdioOutput, options, fdNumber));
  const all = stripNewline(getAllSync(output, options), options, "all");
  return getSyncResult({
    error: error2,
    exitCode,
    signal,
    timedOut,
    isMaxBuffer,
    stdio,
    all,
    options,
    command,
    escapedCommand,
    startTime
  });
};
const runSubprocessSync = ({ file, commandArguments, options, command, escapedCommand, fileDescriptors, startTime }) => {
  try {
    addInputOptionsSync(fileDescriptors, options);
    const normalizedOptions = normalizeSpawnSyncOptions(options);
    return node_child_process.spawnSync(...concatenateShell(file, commandArguments, normalizedOptions));
  } catch (error2) {
    return makeEarlyError({
      error: error2,
      command,
      escapedCommand,
      fileDescriptors,
      options,
      startTime,
      isSync: true
    });
  }
};
const normalizeSpawnSyncOptions = ({ encoding, maxBuffer, ...options }) => ({ ...options, encoding: "buffer", maxBuffer: getMaxBufferSync(maxBuffer) });
const getSyncResult = ({ error: error2, exitCode, signal, timedOut, isMaxBuffer, stdio, all, options, command, escapedCommand, startTime }) => error2 === void 0 ? makeSuccessResult({
  command,
  escapedCommand,
  stdio,
  all,
  ipcOutput: [],
  options,
  startTime
}) : makeError({
  error: error2,
  command,
  escapedCommand,
  timedOut,
  isCanceled: false,
  isGracefullyCanceled: false,
  isMaxBuffer,
  isForcefullyTerminated: false,
  exitCode,
  signal,
  stdio,
  all,
  ipcOutput: [],
  options,
  startTime,
  isSync: true
});
const getOneMessage = ({ anyProcess, channel, isSubprocess, ipc }, { reference = true, filter } = {}) => {
  validateIpcMethod({
    methodName: "getOneMessage",
    isSubprocess,
    ipc,
    isConnected: isConnected(anyProcess)
  });
  return getOneMessageAsync({
    anyProcess,
    channel,
    isSubprocess,
    filter,
    reference
  });
};
const getOneMessageAsync = async ({ anyProcess, channel, isSubprocess, filter, reference }) => {
  addReference(channel, reference);
  const ipcEmitter = getIpcEmitter(anyProcess, channel, isSubprocess);
  const controller = new AbortController();
  try {
    return await Promise.race([
      getMessage(ipcEmitter, filter, controller),
      throwOnDisconnect(ipcEmitter, isSubprocess, controller),
      throwOnStrictError(ipcEmitter, isSubprocess, controller)
    ]);
  } catch (error2) {
    disconnect(anyProcess);
    throw error2;
  } finally {
    controller.abort();
    removeReference(channel, reference);
  }
};
const getMessage = async (ipcEmitter, filter, { signal }) => {
  if (filter === void 0) {
    const [message] = await node_events.once(ipcEmitter, "message", { signal });
    return message;
  }
  for await (const [message] of node_events.on(ipcEmitter, "message", { signal })) {
    if (filter(message)) {
      return message;
    }
  }
};
const throwOnDisconnect = async (ipcEmitter, isSubprocess, { signal }) => {
  await node_events.once(ipcEmitter, "disconnect", { signal });
  throwOnEarlyDisconnect(isSubprocess);
};
const throwOnStrictError = async (ipcEmitter, isSubprocess, { signal }) => {
  const [error2] = await node_events.once(ipcEmitter, "strict:error", { signal });
  throw getStrictResponseError(error2, isSubprocess);
};
const getEachMessage = ({ anyProcess, channel, isSubprocess, ipc }, { reference = true } = {}) => loopOnMessages({
  anyProcess,
  channel,
  isSubprocess,
  ipc,
  shouldAwait: !isSubprocess,
  reference
});
const loopOnMessages = ({ anyProcess, channel, isSubprocess, ipc, shouldAwait, reference }) => {
  validateIpcMethod({
    methodName: "getEachMessage",
    isSubprocess,
    ipc,
    isConnected: isConnected(anyProcess)
  });
  addReference(channel, reference);
  const ipcEmitter = getIpcEmitter(anyProcess, channel, isSubprocess);
  const controller = new AbortController();
  const state = {};
  stopOnDisconnect(anyProcess, ipcEmitter, controller);
  abortOnStrictError({
    ipcEmitter,
    isSubprocess,
    controller,
    state
  });
  return iterateOnMessages({
    anyProcess,
    channel,
    ipcEmitter,
    isSubprocess,
    shouldAwait,
    controller,
    state,
    reference
  });
};
const stopOnDisconnect = async (anyProcess, ipcEmitter, controller) => {
  try {
    await node_events.once(ipcEmitter, "disconnect", { signal: controller.signal });
    controller.abort();
  } catch {
  }
};
const abortOnStrictError = async ({ ipcEmitter, isSubprocess, controller, state }) => {
  try {
    const [error2] = await node_events.once(ipcEmitter, "strict:error", { signal: controller.signal });
    state.error = getStrictResponseError(error2, isSubprocess);
    controller.abort();
  } catch {
  }
};
const iterateOnMessages = async function* ({ anyProcess, channel, ipcEmitter, isSubprocess, shouldAwait, controller, state, reference }) {
  try {
    for await (const [message] of node_events.on(ipcEmitter, "message", { signal: controller.signal })) {
      throwIfStrictError(state);
      yield message;
    }
  } catch {
    throwIfStrictError(state);
  } finally {
    controller.abort();
    removeReference(channel, reference);
    if (!isSubprocess) {
      disconnect(anyProcess);
    }
    if (shouldAwait) {
      await anyProcess;
    }
  }
};
const throwIfStrictError = ({ error: error2 }) => {
  if (error2) {
    throw error2;
  }
};
const addIpcMethods = (subprocess, { ipc }) => {
  Object.assign(subprocess, getIpcMethods(subprocess, false, ipc));
};
const getIpcExport = () => {
  const anyProcess = process$2;
  const isSubprocess = true;
  const ipc = process$2.channel !== void 0;
  return {
    ...getIpcMethods(anyProcess, isSubprocess, ipc),
    getCancelSignal: getCancelSignal.bind(void 0, {
      anyProcess,
      channel: anyProcess.channel,
      isSubprocess,
      ipc
    })
  };
};
const getIpcMethods = (anyProcess, isSubprocess, ipc) => ({
  sendMessage: sendMessage.bind(void 0, {
    anyProcess,
    channel: anyProcess.channel,
    isSubprocess,
    ipc
  }),
  getOneMessage: getOneMessage.bind(void 0, {
    anyProcess,
    channel: anyProcess.channel,
    isSubprocess,
    ipc
  }),
  getEachMessage: getEachMessage.bind(void 0, {
    anyProcess,
    channel: anyProcess.channel,
    isSubprocess,
    ipc
  })
});
const handleEarlyError = ({ error: error2, command, escapedCommand, fileDescriptors, options, startTime, verboseInfo }) => {
  cleanupCustomStreams(fileDescriptors);
  const subprocess = new node_child_process.ChildProcess();
  createDummyStreams(subprocess, fileDescriptors);
  Object.assign(subprocess, { readable, writable, duplex });
  const earlyError = makeEarlyError({
    error: error2,
    command,
    escapedCommand,
    fileDescriptors,
    options,
    startTime,
    isSync: false
  });
  const promise2 = handleDummyPromise(earlyError, verboseInfo, options);
  return { subprocess, promise: promise2 };
};
const createDummyStreams = (subprocess, fileDescriptors) => {
  const stdin = createDummyStream();
  const stdout = createDummyStream();
  const stderr = createDummyStream();
  const extraStdio = Array.from({ length: fileDescriptors.length - 3 }, createDummyStream);
  const all = createDummyStream();
  const stdio = [stdin, stdout, stderr, ...extraStdio];
  Object.assign(subprocess, {
    stdin,
    stdout,
    stderr,
    all,
    stdio
  });
};
const createDummyStream = () => {
  const stream2 = new node_stream.PassThrough();
  stream2.end();
  return stream2;
};
const readable = () => new node_stream.Readable({ read() {
} });
const writable = () => new node_stream.Writable({ write() {
} });
const duplex = () => new node_stream.Duplex({ read() {
}, write() {
} });
const handleDummyPromise = async (error2, verboseInfo, options) => handleResult(error2, verboseInfo, options);
const handleStdioAsync = (options, verboseInfo) => handleStdio(addPropertiesAsync, options, verboseInfo, false);
const forbiddenIfAsync = ({ type, optionName }) => {
  throw new TypeError(`The \`${optionName}\` option cannot be ${TYPE_TO_MESSAGE[type]}.`);
};
const addProperties = {
  fileNumber: forbiddenIfAsync,
  generator: generatorToStream,
  asyncGenerator: generatorToStream,
  nodeStream: ({ value }) => ({ stream: value }),
  webTransform({ value: { transform: transform2, writableObjectMode, readableObjectMode } }) {
    const objectMode = writableObjectMode || readableObjectMode;
    const stream2 = node_stream.Duplex.fromWeb(transform2, { objectMode });
    return { stream: stream2 };
  },
  duplex: ({ value: { transform: transform2 } }) => ({ stream: transform2 }),
  native() {
  }
};
const addPropertiesAsync = {
  input: {
    ...addProperties,
    fileUrl: ({ value }) => ({ stream: node_fs.createReadStream(value) }),
    filePath: ({ value: { file } }) => ({ stream: node_fs.createReadStream(file) }),
    webStream: ({ value }) => ({ stream: node_stream.Readable.fromWeb(value) }),
    iterable: ({ value }) => ({ stream: node_stream.Readable.from(value) }),
    asyncIterable: ({ value }) => ({ stream: node_stream.Readable.from(value) }),
    string: ({ value }) => ({ stream: node_stream.Readable.from(value) }),
    uint8Array: ({ value }) => ({ stream: node_stream.Readable.from(node_buffer.Buffer.from(value)) })
  },
  output: {
    ...addProperties,
    fileUrl: ({ value }) => ({ stream: node_fs.createWriteStream(value) }),
    filePath: ({ value: { file, append: append2 } }) => ({ stream: node_fs.createWriteStream(file, append2 ? { flags: "a" } : {}) }),
    webStream: ({ value }) => ({ stream: node_stream.Writable.fromWeb(value) }),
    iterable: forbiddenIfAsync,
    asyncIterable: forbiddenIfAsync,
    string: forbiddenIfAsync,
    uint8Array: forbiddenIfAsync
  }
};
function mergeStreams(streams) {
  if (!Array.isArray(streams)) {
    throw new TypeError(`Expected an array, got \`${typeof streams}\`.`);
  }
  for (const stream2 of streams) {
    validateStream(stream2);
  }
  const objectMode = streams.some(({ readableObjectMode }) => readableObjectMode);
  const highWaterMark = getHighWaterMark(streams, objectMode);
  const passThroughStream = new MergedStream({
    objectMode,
    writableHighWaterMark: highWaterMark,
    readableHighWaterMark: highWaterMark
  });
  for (const stream2 of streams) {
    passThroughStream.add(stream2);
  }
  return passThroughStream;
}
const getHighWaterMark = (streams, objectMode) => {
  if (streams.length === 0) {
    return node_stream.getDefaultHighWaterMark(objectMode);
  }
  const highWaterMarks = streams.filter(({ readableObjectMode }) => readableObjectMode === objectMode).map(({ readableHighWaterMark }) => readableHighWaterMark);
  return Math.max(...highWaterMarks);
};
class MergedStream extends node_stream.PassThrough {
  constructor() {
    super(...arguments);
    __privateAdd(this, _streams, /* @__PURE__ */ new Set([]));
    __privateAdd(this, _ended, /* @__PURE__ */ new Set([]));
    __privateAdd(this, _aborted, /* @__PURE__ */ new Set([]));
    __privateAdd(this, _onFinished);
    __privateAdd(this, _unpipeEvent, Symbol("unpipe"));
    __privateAdd(this, _streamPromises, /* @__PURE__ */ new WeakMap());
  }
  add(stream2) {
    validateStream(stream2);
    if (__privateGet(this, _streams).has(stream2)) {
      return;
    }
    __privateGet(this, _streams).add(stream2);
    __privateGet(this, _onFinished) ?? __privateSet(this, _onFinished, onMergedStreamFinished(this, __privateGet(this, _streams), __privateGet(this, _unpipeEvent)));
    const streamPromise = endWhenStreamsDone({
      passThroughStream: this,
      stream: stream2,
      streams: __privateGet(this, _streams),
      ended: __privateGet(this, _ended),
      aborted: __privateGet(this, _aborted),
      onFinished: __privateGet(this, _onFinished),
      unpipeEvent: __privateGet(this, _unpipeEvent)
    });
    __privateGet(this, _streamPromises).set(stream2, streamPromise);
    stream2.pipe(this, { end: false });
  }
  async remove(stream2) {
    validateStream(stream2);
    if (!__privateGet(this, _streams).has(stream2)) {
      return false;
    }
    const streamPromise = __privateGet(this, _streamPromises).get(stream2);
    if (streamPromise === void 0) {
      return false;
    }
    __privateGet(this, _streamPromises).delete(stream2);
    stream2.unpipe(this);
    await streamPromise;
    return true;
  }
}
_streams = new WeakMap();
_ended = new WeakMap();
_aborted = new WeakMap();
_onFinished = new WeakMap();
_unpipeEvent = new WeakMap();
_streamPromises = new WeakMap();
const onMergedStreamFinished = async (passThroughStream, streams, unpipeEvent) => {
  updateMaxListeners(passThroughStream, PASSTHROUGH_LISTENERS_COUNT);
  const controller = new AbortController();
  try {
    await Promise.race([
      onMergedStreamEnd(passThroughStream, controller),
      onInputStreamsUnpipe(passThroughStream, streams, unpipeEvent, controller)
    ]);
  } finally {
    controller.abort();
    updateMaxListeners(passThroughStream, -PASSTHROUGH_LISTENERS_COUNT);
  }
};
const onMergedStreamEnd = async (passThroughStream, { signal }) => {
  try {
    await promises$1.finished(passThroughStream, { signal, cleanup: true });
  } catch (error2) {
    errorOrAbortStream(passThroughStream, error2);
    throw error2;
  }
};
const onInputStreamsUnpipe = async (passThroughStream, streams, unpipeEvent, { signal }) => {
  for await (const [unpipedStream] of node_events.on(passThroughStream, "unpipe", { signal })) {
    if (streams.has(unpipedStream)) {
      unpipedStream.emit(unpipeEvent);
    }
  }
};
const validateStream = (stream2) => {
  if (typeof (stream2 == null ? void 0 : stream2.pipe) !== "function") {
    throw new TypeError(`Expected a readable stream, got: \`${typeof stream2}\`.`);
  }
};
const endWhenStreamsDone = async ({ passThroughStream, stream: stream2, streams, ended, aborted, onFinished, unpipeEvent }) => {
  updateMaxListeners(passThroughStream, PASSTHROUGH_LISTENERS_PER_STREAM);
  const controller = new AbortController();
  try {
    await Promise.race([
      afterMergedStreamFinished(onFinished, stream2, controller),
      onInputStreamEnd({
        passThroughStream,
        stream: stream2,
        streams,
        ended,
        aborted,
        controller
      }),
      onInputStreamUnpipe({
        stream: stream2,
        streams,
        ended,
        aborted,
        unpipeEvent,
        controller
      })
    ]);
  } finally {
    controller.abort();
    updateMaxListeners(passThroughStream, -PASSTHROUGH_LISTENERS_PER_STREAM);
  }
  if (streams.size > 0 && streams.size === ended.size + aborted.size) {
    if (ended.size === 0 && aborted.size > 0) {
      abortStream(passThroughStream);
    } else {
      endStream(passThroughStream);
    }
  }
};
const afterMergedStreamFinished = async (onFinished, stream2, { signal }) => {
  try {
    await onFinished;
    if (!signal.aborted) {
      abortStream(stream2);
    }
  } catch (error2) {
    if (!signal.aborted) {
      errorOrAbortStream(stream2, error2);
    }
  }
};
const onInputStreamEnd = async ({ passThroughStream, stream: stream2, streams, ended, aborted, controller: { signal } }) => {
  try {
    await promises$1.finished(stream2, {
      signal,
      cleanup: true,
      readable: true,
      writable: false
    });
    if (streams.has(stream2)) {
      ended.add(stream2);
    }
  } catch (error2) {
    if (signal.aborted || !streams.has(stream2)) {
      return;
    }
    if (isAbortError(error2)) {
      aborted.add(stream2);
    } else {
      errorStream(passThroughStream, error2);
    }
  }
};
const onInputStreamUnpipe = async ({ stream: stream2, streams, ended, aborted, unpipeEvent, controller: { signal } }) => {
  await node_events.once(stream2, unpipeEvent, { signal });
  if (!stream2.readable) {
    return node_events.once(signal, "abort", { signal });
  }
  streams.delete(stream2);
  ended.delete(stream2);
  aborted.delete(stream2);
};
const endStream = (stream2) => {
  if (stream2.writable) {
    stream2.end();
  }
};
const errorOrAbortStream = (stream2, error2) => {
  if (isAbortError(error2)) {
    abortStream(stream2);
  } else {
    errorStream(stream2, error2);
  }
};
const isAbortError = (error2) => (error2 == null ? void 0 : error2.code) === "ERR_STREAM_PREMATURE_CLOSE";
const abortStream = (stream2) => {
  if (stream2.readable || stream2.writable) {
    stream2.destroy();
  }
};
const errorStream = (stream2, error2) => {
  if (!stream2.destroyed) {
    stream2.once("error", noop);
    stream2.destroy(error2);
  }
};
const noop = () => {
};
const updateMaxListeners = (passThroughStream, increment2) => {
  const maxListeners = passThroughStream.getMaxListeners();
  if (maxListeners !== 0 && maxListeners !== Number.POSITIVE_INFINITY) {
    passThroughStream.setMaxListeners(maxListeners + increment2);
  }
};
const PASSTHROUGH_LISTENERS_COUNT = 2;
const PASSTHROUGH_LISTENERS_PER_STREAM = 1;
const pipeStreams = (source, destination) => {
  source.pipe(destination);
  onSourceFinish(source, destination);
  onDestinationFinish(source, destination);
};
const onSourceFinish = async (source, destination) => {
  if (isStandardStream(source) || isStandardStream(destination)) {
    return;
  }
  try {
    await promises$1.finished(source, { cleanup: true, readable: true, writable: false });
  } catch {
  }
  endDestinationStream(destination);
};
const endDestinationStream = (destination) => {
  if (destination.writable) {
    destination.end();
  }
};
const onDestinationFinish = async (source, destination) => {
  if (isStandardStream(source) || isStandardStream(destination)) {
    return;
  }
  try {
    await promises$1.finished(destination, { cleanup: true, readable: false, writable: true });
  } catch {
  }
  abortSourceStream(source);
};
const abortSourceStream = (source) => {
  if (source.readable) {
    source.destroy();
  }
};
const pipeOutputAsync = (subprocess, fileDescriptors, controller) => {
  const pipeGroups = /* @__PURE__ */ new Map();
  for (const [fdNumber, { stdioItems, direction }] of Object.entries(fileDescriptors)) {
    for (const { stream: stream2 } of stdioItems.filter(({ type }) => TRANSFORM_TYPES.has(type))) {
      pipeTransform(subprocess, stream2, direction, fdNumber);
    }
    for (const { stream: stream2 } of stdioItems.filter(({ type }) => !TRANSFORM_TYPES.has(type))) {
      pipeStdioItem({
        subprocess,
        stream: stream2,
        direction,
        fdNumber,
        pipeGroups,
        controller
      });
    }
  }
  for (const [outputStream, inputStreams] of pipeGroups.entries()) {
    const inputStream = inputStreams.length === 1 ? inputStreams[0] : mergeStreams(inputStreams);
    pipeStreams(inputStream, outputStream);
  }
};
const pipeTransform = (subprocess, stream2, direction, fdNumber) => {
  if (direction === "output") {
    pipeStreams(subprocess.stdio[fdNumber], stream2);
  } else {
    pipeStreams(stream2, subprocess.stdio[fdNumber]);
  }
  const streamProperty = SUBPROCESS_STREAM_PROPERTIES[fdNumber];
  if (streamProperty !== void 0) {
    subprocess[streamProperty] = stream2;
  }
  subprocess.stdio[fdNumber] = stream2;
};
const SUBPROCESS_STREAM_PROPERTIES = ["stdin", "stdout", "stderr"];
const pipeStdioItem = ({ subprocess, stream: stream2, direction, fdNumber, pipeGroups, controller }) => {
  if (stream2 === void 0) {
    return;
  }
  setStandardStreamMaxListeners(stream2, controller);
  const [inputStream, outputStream] = direction === "output" ? [stream2, subprocess.stdio[fdNumber]] : [subprocess.stdio[fdNumber], stream2];
  const outputStreams = pipeGroups.get(inputStream) ?? [];
  pipeGroups.set(inputStream, [...outputStreams, outputStream]);
};
const setStandardStreamMaxListeners = (stream2, { signal }) => {
  if (isStandardStream(stream2)) {
    incrementMaxListeners(stream2, MAX_LISTENERS_INCREMENT, signal);
  }
};
const MAX_LISTENERS_INCREMENT = 2;
const signals = [];
signals.push("SIGHUP", "SIGINT", "SIGTERM");
if (process.platform !== "win32") {
  signals.push(
    "SIGALRM",
    "SIGABRT",
    "SIGVTALRM",
    "SIGXCPU",
    "SIGXFSZ",
    "SIGUSR2",
    "SIGTRAP",
    "SIGSYS",
    "SIGQUIT",
    "SIGIOT"
    // should detect profiler and enable/disable accordingly.
    // see #21
    // 'SIGPROF'
  );
}
if (process.platform === "linux") {
  signals.push("SIGIO", "SIGPOLL", "SIGPWR", "SIGSTKFLT");
}
const processOk = (process2) => !!process2 && typeof process2 === "object" && typeof process2.removeListener === "function" && typeof process2.emit === "function" && typeof process2.reallyExit === "function" && typeof process2.listeners === "function" && typeof process2.kill === "function" && typeof process2.pid === "number" && typeof process2.on === "function";
const kExitEmitter = Symbol.for("signal-exit emitter");
const global$1 = globalThis;
const ObjectDefineProperty = Object.defineProperty.bind(Object);
class Emitter {
  constructor() {
    __publicField(this, "emitted", {
      afterExit: false,
      exit: false
    });
    __publicField(this, "listeners", {
      afterExit: [],
      exit: []
    });
    __publicField(this, "count", 0);
    __publicField(this, "id", Math.random());
    if (global$1[kExitEmitter]) {
      return global$1[kExitEmitter];
    }
    ObjectDefineProperty(global$1, kExitEmitter, {
      value: this,
      writable: false,
      enumerable: false,
      configurable: false
    });
  }
  on(ev, fn) {
    this.listeners[ev].push(fn);
  }
  removeListener(ev, fn) {
    const list = this.listeners[ev];
    const i2 = list.indexOf(fn);
    if (i2 === -1) {
      return;
    }
    if (i2 === 0 && list.length === 1) {
      list.length = 0;
    } else {
      list.splice(i2, 1);
    }
  }
  emit(ev, code, signal) {
    if (this.emitted[ev]) {
      return false;
    }
    this.emitted[ev] = true;
    let ret = false;
    for (const fn of this.listeners[ev]) {
      ret = fn(code, signal) === true || ret;
    }
    if (ev === "exit") {
      ret = this.emit("afterExit", code, signal) || ret;
    }
    return ret;
  }
}
class SignalExitBase {
}
const signalExitWrap = (handler) => {
  return {
    onExit(cb, opts) {
      return handler.onExit(cb, opts);
    },
    load() {
      return handler.load();
    },
    unload() {
      return handler.unload();
    }
  };
};
class SignalExitFallback extends SignalExitBase {
  onExit() {
    return () => {
    };
  }
  load() {
  }
  unload() {
  }
}
class SignalExit extends SignalExitBase {
  constructor(process2) {
    super();
    __privateAdd(this, _SignalExit_instances);
    // "SIGHUP" throws an `ENOSYS` error on Windows,
    // so use a supported signal instead
    /* c8 ignore start */
    __privateAdd(this, _hupSig, process$1.platform === "win32" ? "SIGINT" : "SIGHUP");
    /* c8 ignore stop */
    __privateAdd(this, _emitter, new Emitter());
    __privateAdd(this, _process);
    __privateAdd(this, _originalProcessEmit);
    __privateAdd(this, _originalProcessReallyExit);
    __privateAdd(this, _sigListeners, {});
    __privateAdd(this, _loaded, false);
    __privateSet(this, _process, process2);
    __privateSet(this, _sigListeners, {});
    for (const sig of signals) {
      __privateGet(this, _sigListeners)[sig] = () => {
        const listeners = __privateGet(this, _process).listeners(sig);
        let { count: count2 } = __privateGet(this, _emitter);
        const p = process2;
        if (typeof p.__signal_exit_emitter__ === "object" && typeof p.__signal_exit_emitter__.count === "number") {
          count2 += p.__signal_exit_emitter__.count;
        }
        if (listeners.length === count2) {
          this.unload();
          const ret = __privateGet(this, _emitter).emit("exit", null, sig);
          const s = sig === "SIGHUP" ? __privateGet(this, _hupSig) : sig;
          if (!ret)
            process2.kill(process2.pid, s);
        }
      };
    }
    __privateSet(this, _originalProcessReallyExit, process2.reallyExit);
    __privateSet(this, _originalProcessEmit, process2.emit);
  }
  onExit(cb, opts) {
    if (!processOk(__privateGet(this, _process))) {
      return () => {
      };
    }
    if (__privateGet(this, _loaded) === false) {
      this.load();
    }
    const ev = (opts == null ? void 0 : opts.alwaysLast) ? "afterExit" : "exit";
    __privateGet(this, _emitter).on(ev, cb);
    return () => {
      __privateGet(this, _emitter).removeListener(ev, cb);
      if (__privateGet(this, _emitter).listeners["exit"].length === 0 && __privateGet(this, _emitter).listeners["afterExit"].length === 0) {
        this.unload();
      }
    };
  }
  load() {
    if (__privateGet(this, _loaded)) {
      return;
    }
    __privateSet(this, _loaded, true);
    __privateGet(this, _emitter).count += 1;
    for (const sig of signals) {
      try {
        const fn = __privateGet(this, _sigListeners)[sig];
        if (fn)
          __privateGet(this, _process).on(sig, fn);
      } catch (_) {
      }
    }
    __privateGet(this, _process).emit = (ev, ...a2) => {
      return __privateMethod(this, _SignalExit_instances, processEmit_fn).call(this, ev, ...a2);
    };
    __privateGet(this, _process).reallyExit = (code) => {
      return __privateMethod(this, _SignalExit_instances, processReallyExit_fn).call(this, code);
    };
  }
  unload() {
    if (!__privateGet(this, _loaded)) {
      return;
    }
    __privateSet(this, _loaded, false);
    signals.forEach((sig) => {
      const listener = __privateGet(this, _sigListeners)[sig];
      if (!listener) {
        throw new Error("Listener not defined for signal: " + sig);
      }
      try {
        __privateGet(this, _process).removeListener(sig, listener);
      } catch (_) {
      }
    });
    __privateGet(this, _process).emit = __privateGet(this, _originalProcessEmit);
    __privateGet(this, _process).reallyExit = __privateGet(this, _originalProcessReallyExit);
    __privateGet(this, _emitter).count -= 1;
  }
}
_hupSig = new WeakMap();
_emitter = new WeakMap();
_process = new WeakMap();
_originalProcessEmit = new WeakMap();
_originalProcessReallyExit = new WeakMap();
_sigListeners = new WeakMap();
_loaded = new WeakMap();
_SignalExit_instances = new WeakSet();
processReallyExit_fn = function(code) {
  if (!processOk(__privateGet(this, _process))) {
    return 0;
  }
  __privateGet(this, _process).exitCode = code || 0;
  __privateGet(this, _emitter).emit("exit", __privateGet(this, _process).exitCode, null);
  return __privateGet(this, _originalProcessReallyExit).call(__privateGet(this, _process), __privateGet(this, _process).exitCode);
};
processEmit_fn = function(ev, ...args) {
  const og = __privateGet(this, _originalProcessEmit);
  if (ev === "exit" && processOk(__privateGet(this, _process))) {
    if (typeof args[0] === "number") {
      __privateGet(this, _process).exitCode = args[0];
    }
    const ret = og.call(__privateGet(this, _process), ev, ...args);
    __privateGet(this, _emitter).emit("exit", __privateGet(this, _process).exitCode, null);
    return ret;
  } else {
    return og.call(__privateGet(this, _process), ev, ...args);
  }
};
const process$1 = globalThis.process;
const {
  /**
   * Called when the process is exiting, whether via signal, explicit
   * exit, or running out of stuff to do.
   *
   * If the global process object is not suitable for instrumentation,
   * then this will be a no-op.
   *
   * Returns a function that may be used to unload signal-exit.
   */
  onExit
} = signalExitWrap(processOk(process$1) ? new SignalExit(process$1) : new SignalExitFallback());
const cleanupOnExit = (subprocess, { cleanup, detached }, { signal }) => {
  if (!cleanup || detached) {
    return;
  }
  const removeExitHandler = onExit(() => {
    subprocess.kill();
  });
  node_events.addAbortListener(signal, () => {
    removeExitHandler();
  });
};
const normalizePipeArguments = ({ source, sourcePromise, boundOptions, createNested }, ...pipeArguments) => {
  const startTime = getStartTime();
  const {
    destination,
    destinationStream,
    destinationError,
    from,
    unpipeSignal
  } = getDestinationStream(boundOptions, createNested, pipeArguments);
  const { sourceStream, sourceError } = getSourceStream(source, from);
  const { options: sourceOptions, fileDescriptors } = SUBPROCESS_OPTIONS.get(source);
  return {
    sourcePromise,
    sourceStream,
    sourceOptions,
    sourceError,
    destination,
    destinationStream,
    destinationError,
    unpipeSignal,
    fileDescriptors,
    startTime
  };
};
const getDestinationStream = (boundOptions, createNested, pipeArguments) => {
  try {
    const {
      destination,
      pipeOptions: { from, to, unpipeSignal } = {}
    } = getDestination(boundOptions, createNested, ...pipeArguments);
    const destinationStream = getToStream(destination, to);
    return {
      destination,
      destinationStream,
      from,
      unpipeSignal
    };
  } catch (error2) {
    return { destinationError: error2 };
  }
};
const getDestination = (boundOptions, createNested, firstArgument, ...pipeArguments) => {
  if (Array.isArray(firstArgument)) {
    const destination = createNested(mapDestinationArguments, boundOptions)(firstArgument, ...pipeArguments);
    return { destination, pipeOptions: boundOptions };
  }
  if (typeof firstArgument === "string" || firstArgument instanceof URL || isDenoExecPath(firstArgument)) {
    if (Object.keys(boundOptions).length > 0) {
      throw new TypeError('Please use .pipe("file", ..., options) or .pipe(execa("file", ..., options)) instead of .pipe(options)("file", ...).');
    }
    const [rawFile, rawArguments, rawOptions] = normalizeParameters(firstArgument, ...pipeArguments);
    const destination = createNested(mapDestinationArguments)(rawFile, rawArguments, rawOptions);
    return { destination, pipeOptions: rawOptions };
  }
  if (SUBPROCESS_OPTIONS.has(firstArgument)) {
    if (Object.keys(boundOptions).length > 0) {
      throw new TypeError("Please use .pipe(options)`command` or .pipe($(options)`command`) instead of .pipe(options)($`command`).");
    }
    return { destination: firstArgument, pipeOptions: pipeArguments[0] };
  }
  throw new TypeError(`The first argument must be a template string, an options object, or an Execa subprocess: ${firstArgument}`);
};
const mapDestinationArguments = ({ options }) => ({ options: { ...options, stdin: "pipe", piped: true } });
const getSourceStream = (source, from) => {
  try {
    const sourceStream = getFromStream(source, from);
    return { sourceStream };
  } catch (error2) {
    return { sourceError: error2 };
  }
};
const handlePipeArgumentsError = ({
  sourceStream,
  sourceError,
  destinationStream,
  destinationError,
  fileDescriptors,
  sourceOptions,
  startTime
}) => {
  const error2 = getPipeArgumentsError({
    sourceStream,
    sourceError,
    destinationStream,
    destinationError
  });
  if (error2 !== void 0) {
    throw createNonCommandError({
      error: error2,
      fileDescriptors,
      sourceOptions,
      startTime
    });
  }
};
const getPipeArgumentsError = ({ sourceStream, sourceError, destinationStream, destinationError }) => {
  if (sourceError !== void 0 && destinationError !== void 0) {
    return destinationError;
  }
  if (destinationError !== void 0) {
    abortSourceStream(sourceStream);
    return destinationError;
  }
  if (sourceError !== void 0) {
    endDestinationStream(destinationStream);
    return sourceError;
  }
};
const createNonCommandError = ({ error: error2, fileDescriptors, sourceOptions, startTime }) => makeEarlyError({
  error: error2,
  command: PIPE_COMMAND_MESSAGE,
  escapedCommand: PIPE_COMMAND_MESSAGE,
  fileDescriptors,
  options: sourceOptions,
  startTime,
  isSync: false
});
const PIPE_COMMAND_MESSAGE = "source.pipe(destination)";
const waitForBothSubprocesses = async (subprocessPromises) => {
  const [
    { status: sourceStatus, reason: sourceReason, value: sourceResult = sourceReason },
    { status: destinationStatus, reason: destinationReason, value: destinationResult = destinationReason }
  ] = await subprocessPromises;
  if (!destinationResult.pipedFrom.includes(sourceResult)) {
    destinationResult.pipedFrom.push(sourceResult);
  }
  if (destinationStatus === "rejected") {
    throw destinationResult;
  }
  if (sourceStatus === "rejected") {
    throw sourceResult;
  }
  return destinationResult;
};
const pipeSubprocessStream = (sourceStream, destinationStream, maxListenersController) => {
  const mergedStream = MERGED_STREAMS.has(destinationStream) ? pipeMoreSubprocessStream(sourceStream, destinationStream) : pipeFirstSubprocessStream(sourceStream, destinationStream);
  incrementMaxListeners(sourceStream, SOURCE_LISTENERS_PER_PIPE, maxListenersController.signal);
  incrementMaxListeners(destinationStream, DESTINATION_LISTENERS_PER_PIPE, maxListenersController.signal);
  cleanupMergedStreamsMap(destinationStream);
  return mergedStream;
};
const pipeFirstSubprocessStream = (sourceStream, destinationStream) => {
  const mergedStream = mergeStreams([sourceStream]);
  pipeStreams(mergedStream, destinationStream);
  MERGED_STREAMS.set(destinationStream, mergedStream);
  return mergedStream;
};
const pipeMoreSubprocessStream = (sourceStream, destinationStream) => {
  const mergedStream = MERGED_STREAMS.get(destinationStream);
  mergedStream.add(sourceStream);
  return mergedStream;
};
const cleanupMergedStreamsMap = async (destinationStream) => {
  try {
    await promises$1.finished(destinationStream, { cleanup: true, readable: false, writable: true });
  } catch {
  }
  MERGED_STREAMS.delete(destinationStream);
};
const MERGED_STREAMS = /* @__PURE__ */ new WeakMap();
const SOURCE_LISTENERS_PER_PIPE = 2;
const DESTINATION_LISTENERS_PER_PIPE = 1;
const unpipeOnAbort = (unpipeSignal, unpipeContext) => unpipeSignal === void 0 ? [] : [unpipeOnSignalAbort(unpipeSignal, unpipeContext)];
const unpipeOnSignalAbort = async (unpipeSignal, { sourceStream, mergedStream, fileDescriptors, sourceOptions, startTime }) => {
  await node_util.aborted(unpipeSignal, sourceStream);
  await mergedStream.remove(sourceStream);
  const error2 = new Error("Pipe canceled by `unpipeSignal` option.");
  throw createNonCommandError({
    error: error2,
    fileDescriptors,
    sourceOptions,
    startTime
  });
};
const pipeToSubprocess = (sourceInfo, ...pipeArguments) => {
  if (isPlainObject(pipeArguments[0])) {
    return pipeToSubprocess.bind(void 0, {
      ...sourceInfo,
      boundOptions: { ...sourceInfo.boundOptions, ...pipeArguments[0] }
    });
  }
  const { destination, ...normalizedInfo } = normalizePipeArguments(sourceInfo, ...pipeArguments);
  const promise2 = handlePipePromise({ ...normalizedInfo, destination });
  promise2.pipe = pipeToSubprocess.bind(void 0, {
    ...sourceInfo,
    source: destination,
    sourcePromise: promise2,
    boundOptions: {}
  });
  return promise2;
};
const handlePipePromise = async ({
  sourcePromise,
  sourceStream,
  sourceOptions,
  sourceError,
  destination,
  destinationStream,
  destinationError,
  unpipeSignal,
  fileDescriptors,
  startTime
}) => {
  const subprocessPromises = getSubprocessPromises(sourcePromise, destination);
  handlePipeArgumentsError({
    sourceStream,
    sourceError,
    destinationStream,
    destinationError,
    fileDescriptors,
    sourceOptions,
    startTime
  });
  const maxListenersController = new AbortController();
  try {
    const mergedStream = pipeSubprocessStream(sourceStream, destinationStream, maxListenersController);
    return await Promise.race([
      waitForBothSubprocesses(subprocessPromises),
      ...unpipeOnAbort(unpipeSignal, {
        sourceStream,
        mergedStream,
        sourceOptions,
        fileDescriptors,
        startTime
      })
    ]);
  } finally {
    maxListenersController.abort();
  }
};
const getSubprocessPromises = (sourcePromise, destination) => Promise.allSettled([sourcePromise, destination]);
const iterateOnSubprocessStream = ({ subprocessStdout, subprocess, binary, shouldEncode, encoding, preserveNewlines }) => {
  const controller = new AbortController();
  stopReadingOnExit(subprocess, controller);
  return iterateOnStream({
    stream: subprocessStdout,
    controller,
    binary,
    shouldEncode: !subprocessStdout.readableObjectMode && shouldEncode,
    encoding,
    shouldSplit: !subprocessStdout.readableObjectMode,
    preserveNewlines
  });
};
const stopReadingOnExit = async (subprocess, controller) => {
  try {
    await subprocess;
  } catch {
  } finally {
    controller.abort();
  }
};
const iterateForResult = ({ stream: stream2, onStreamEnd, lines, encoding, stripFinalNewline: stripFinalNewline2, allMixed }) => {
  const controller = new AbortController();
  stopReadingOnStreamEnd(onStreamEnd, controller, stream2);
  const objectMode = stream2.readableObjectMode && !allMixed;
  return iterateOnStream({
    stream: stream2,
    controller,
    binary: encoding === "buffer",
    shouldEncode: !objectMode,
    encoding,
    shouldSplit: !objectMode && lines,
    preserveNewlines: !stripFinalNewline2
  });
};
const stopReadingOnStreamEnd = async (onStreamEnd, controller, stream2) => {
  try {
    await onStreamEnd;
  } catch {
    stream2.destroy();
  } finally {
    controller.abort();
  }
};
const iterateOnStream = ({ stream: stream2, controller, binary, shouldEncode, encoding, shouldSplit, preserveNewlines }) => {
  const onStdoutChunk = node_events.on(stream2, "data", {
    signal: controller.signal,
    highWaterMark: HIGH_WATER_MARK,
    // Backward compatibility with older name for this option
    // See https://github.com/nodejs/node/pull/52080#discussion_r1525227861
    // @todo Remove after removing support for Node 21
    highWatermark: HIGH_WATER_MARK
  });
  return iterateOnData({
    onStdoutChunk,
    controller,
    binary,
    shouldEncode,
    encoding,
    shouldSplit,
    preserveNewlines
  });
};
const DEFAULT_OBJECT_HIGH_WATER_MARK = node_stream.getDefaultHighWaterMark(true);
const HIGH_WATER_MARK = DEFAULT_OBJECT_HIGH_WATER_MARK;
const iterateOnData = async function* ({ onStdoutChunk, controller, binary, shouldEncode, encoding, shouldSplit, preserveNewlines }) {
  const generators = getGenerators({
    binary,
    shouldEncode,
    encoding,
    shouldSplit,
    preserveNewlines
  });
  try {
    for await (const [chunk] of onStdoutChunk) {
      yield* transformChunkSync(chunk, generators, 0);
    }
  } catch (error2) {
    if (!controller.signal.aborted) {
      throw error2;
    }
  } finally {
    yield* finalChunksSync(generators);
  }
};
const getGenerators = ({ binary, shouldEncode, encoding, shouldSplit, preserveNewlines }) => [
  getEncodingTransformGenerator(binary, encoding, !shouldEncode),
  getSplitLinesGenerator(binary, preserveNewlines, !shouldSplit, {})
].filter(Boolean);
const getStreamOutput = async ({ stream: stream2, onStreamEnd, fdNumber, encoding, buffer, maxBuffer, lines, allMixed, stripFinalNewline: stripFinalNewline2, verboseInfo, streamInfo }) => {
  const logPromise = logOutputAsync({
    stream: stream2,
    onStreamEnd,
    fdNumber,
    encoding,
    allMixed,
    verboseInfo,
    streamInfo
  });
  if (!buffer) {
    await Promise.all([resumeStream(stream2), logPromise]);
    return;
  }
  const stripFinalNewlineValue = getStripFinalNewline(stripFinalNewline2, fdNumber);
  const iterable = iterateForResult({
    stream: stream2,
    onStreamEnd,
    lines,
    encoding,
    stripFinalNewline: stripFinalNewlineValue,
    allMixed
  });
  const [output] = await Promise.all([
    getStreamContents({
      stream: stream2,
      iterable,
      fdNumber,
      encoding,
      maxBuffer,
      lines
    }),
    logPromise
  ]);
  return output;
};
const logOutputAsync = async ({ stream: stream2, onStreamEnd, fdNumber, encoding, allMixed, verboseInfo, streamInfo: { fileDescriptors } }) => {
  var _a2;
  if (!shouldLogOutput({
    stdioItems: (_a2 = fileDescriptors[fdNumber]) == null ? void 0 : _a2.stdioItems,
    encoding,
    verboseInfo,
    fdNumber
  })) {
    return;
  }
  const linesIterable = iterateForResult({
    stream: stream2,
    onStreamEnd,
    lines: true,
    encoding,
    stripFinalNewline: true,
    allMixed
  });
  await logLines(linesIterable, stream2, fdNumber, verboseInfo);
};
const resumeStream = async (stream2) => {
  await promises.setImmediate();
  if (stream2.readableFlowing === null) {
    stream2.resume();
  }
};
const getStreamContents = async ({ stream: stream2, stream: { readableObjectMode }, iterable, fdNumber, encoding, maxBuffer, lines }) => {
  try {
    if (readableObjectMode || lines) {
      return await getStreamAsArray(iterable, { maxBuffer });
    }
    if (encoding === "buffer") {
      return new Uint8Array(await getStreamAsArrayBuffer(iterable, { maxBuffer }));
    }
    return await getStreamAsString(iterable, { maxBuffer });
  } catch (error2) {
    return handleBufferedData(handleMaxBuffer({
      error: error2,
      stream: stream2,
      readableObjectMode,
      lines,
      encoding,
      fdNumber
    }));
  }
};
const getBufferedData = async (streamPromise) => {
  try {
    return await streamPromise;
  } catch (error2) {
    return handleBufferedData(error2);
  }
};
const handleBufferedData = ({ bufferedData }) => isArrayBuffer(bufferedData) ? new Uint8Array(bufferedData) : bufferedData;
const waitForStream = async (stream2, fdNumber, streamInfo, { isSameDirection, stopOnExit = false } = {}) => {
  const state = handleStdinDestroy(stream2, streamInfo);
  const abortController = new AbortController();
  try {
    await Promise.race([
      ...stopOnExit ? [streamInfo.exitPromise] : [],
      promises$1.finished(stream2, { cleanup: true, signal: abortController.signal })
    ]);
  } catch (error2) {
    if (!state.stdinCleanedUp) {
      handleStreamError(error2, fdNumber, streamInfo, isSameDirection);
    }
  } finally {
    abortController.abort();
  }
};
const handleStdinDestroy = (stream2, { originalStreams: [originalStdin], subprocess }) => {
  const state = { stdinCleanedUp: false };
  if (stream2 === originalStdin) {
    spyOnStdinDestroy(stream2, subprocess, state);
  }
  return state;
};
const spyOnStdinDestroy = (subprocessStdin, subprocess, state) => {
  const { _destroy } = subprocessStdin;
  subprocessStdin._destroy = (...destroyArguments) => {
    setStdinCleanedUp(subprocess, state);
    _destroy.call(subprocessStdin, ...destroyArguments);
  };
};
const setStdinCleanedUp = ({ exitCode, signalCode }, state) => {
  if (exitCode !== null || signalCode !== null) {
    state.stdinCleanedUp = true;
  }
};
const handleStreamError = (error2, fdNumber, streamInfo, isSameDirection) => {
  if (!shouldIgnoreStreamError(error2, fdNumber, streamInfo, isSameDirection)) {
    throw error2;
  }
};
const shouldIgnoreStreamError = (error2, fdNumber, streamInfo, isSameDirection = true) => {
  if (streamInfo.propagating) {
    return isStreamEpipe(error2) || isStreamAbort(error2);
  }
  streamInfo.propagating = true;
  return isInputFileDescriptor(streamInfo, fdNumber) === isSameDirection ? isStreamEpipe(error2) : isStreamAbort(error2);
};
const isInputFileDescriptor = ({ fileDescriptors }, fdNumber) => fdNumber !== "all" && fileDescriptors[fdNumber].direction === "input";
const isStreamAbort = (error2) => (error2 == null ? void 0 : error2.code) === "ERR_STREAM_PREMATURE_CLOSE";
const isStreamEpipe = (error2) => (error2 == null ? void 0 : error2.code) === "EPIPE";
const waitForStdioStreams = ({ subprocess, encoding, buffer, maxBuffer, lines, stripFinalNewline: stripFinalNewline2, verboseInfo, streamInfo }) => subprocess.stdio.map((stream2, fdNumber) => waitForSubprocessStream({
  stream: stream2,
  fdNumber,
  encoding,
  buffer: buffer[fdNumber],
  maxBuffer: maxBuffer[fdNumber],
  lines: lines[fdNumber],
  allMixed: false,
  stripFinalNewline: stripFinalNewline2,
  verboseInfo,
  streamInfo
}));
const waitForSubprocessStream = async ({ stream: stream2, fdNumber, encoding, buffer, maxBuffer, lines, allMixed, stripFinalNewline: stripFinalNewline2, verboseInfo, streamInfo }) => {
  if (!stream2) {
    return;
  }
  const onStreamEnd = waitForStream(stream2, fdNumber, streamInfo);
  if (isInputFileDescriptor(streamInfo, fdNumber)) {
    await onStreamEnd;
    return;
  }
  const [output] = await Promise.all([
    getStreamOutput({
      stream: stream2,
      onStreamEnd,
      fdNumber,
      encoding,
      buffer,
      maxBuffer,
      lines,
      allMixed,
      stripFinalNewline: stripFinalNewline2,
      verboseInfo,
      streamInfo
    }),
    onStreamEnd
  ]);
  return output;
};
const makeAllStream = ({ stdout, stderr }, { all }) => all && (stdout || stderr) ? mergeStreams([stdout, stderr].filter(Boolean)) : void 0;
const waitForAllStream = ({ subprocess, encoding, buffer, maxBuffer, lines, stripFinalNewline: stripFinalNewline2, verboseInfo, streamInfo }) => waitForSubprocessStream({
  ...getAllStream(subprocess, buffer),
  fdNumber: "all",
  encoding,
  maxBuffer: maxBuffer[1] + maxBuffer[2],
  lines: lines[1] || lines[2],
  allMixed: getAllMixed(subprocess),
  stripFinalNewline: stripFinalNewline2,
  verboseInfo,
  streamInfo
});
const getAllStream = ({ stdout, stderr, all }, [, bufferStdout, bufferStderr]) => {
  const buffer = bufferStdout || bufferStderr;
  if (!buffer) {
    return { stream: all, buffer };
  }
  if (!bufferStdout) {
    return { stream: stderr, buffer };
  }
  if (!bufferStderr) {
    return { stream: stdout, buffer };
  }
  return { stream: all, buffer };
};
const getAllMixed = ({ all, stdout, stderr }) => all && stdout && stderr && stdout.readableObjectMode !== stderr.readableObjectMode;
const shouldLogIpc = (verboseInfo) => isFullVerbose(verboseInfo, "ipc");
const logIpcOutput = (message, verboseInfo) => {
  const verboseMessage = serializeVerboseMessage(message);
  verboseLog({
    type: "ipc",
    verboseMessage,
    fdNumber: "ipc",
    verboseInfo
  });
};
const waitForIpcOutput = async ({
  subprocess,
  buffer: bufferArray,
  maxBuffer: maxBufferArray,
  ipc,
  ipcOutput,
  verboseInfo
}) => {
  if (!ipc) {
    return ipcOutput;
  }
  const isVerbose2 = shouldLogIpc(verboseInfo);
  const buffer = getFdSpecificValue(bufferArray, "ipc");
  const maxBuffer = getFdSpecificValue(maxBufferArray, "ipc");
  for await (const message of loopOnMessages({
    anyProcess: subprocess,
    channel: subprocess.channel,
    isSubprocess: false,
    ipc,
    shouldAwait: false,
    reference: true
  })) {
    if (buffer) {
      checkIpcMaxBuffer(subprocess, ipcOutput, maxBuffer);
      ipcOutput.push(message);
    }
    if (isVerbose2) {
      logIpcOutput(message, verboseInfo);
    }
  }
  return ipcOutput;
};
const getBufferedIpcOutput = async (ipcOutputPromise, ipcOutput) => {
  await Promise.allSettled([ipcOutputPromise]);
  return ipcOutput;
};
const waitForSubprocessResult = async ({
  subprocess,
  options: {
    encoding,
    buffer,
    maxBuffer,
    lines,
    timeoutDuration: timeout,
    cancelSignal,
    gracefulCancel,
    forceKillAfterDelay,
    stripFinalNewline: stripFinalNewline2,
    ipc,
    ipcInput
  },
  context,
  verboseInfo,
  fileDescriptors,
  originalStreams,
  onInternalError,
  controller
}) => {
  const exitPromise = waitForExit(subprocess, context);
  const streamInfo = {
    originalStreams,
    fileDescriptors,
    subprocess,
    exitPromise,
    propagating: false
  };
  const stdioPromises = waitForStdioStreams({
    subprocess,
    encoding,
    buffer,
    maxBuffer,
    lines,
    stripFinalNewline: stripFinalNewline2,
    verboseInfo,
    streamInfo
  });
  const allPromise = waitForAllStream({
    subprocess,
    encoding,
    buffer,
    maxBuffer,
    lines,
    stripFinalNewline: stripFinalNewline2,
    verboseInfo,
    streamInfo
  });
  const ipcOutput = [];
  const ipcOutputPromise = waitForIpcOutput({
    subprocess,
    buffer,
    maxBuffer,
    ipc,
    ipcOutput,
    verboseInfo
  });
  const originalPromises = waitForOriginalStreams(originalStreams, subprocess, streamInfo);
  const customStreamsEndPromises = waitForCustomStreamsEnd(fileDescriptors, streamInfo);
  try {
    return await Promise.race([
      Promise.all([
        {},
        waitForSuccessfulExit(exitPromise),
        Promise.all(stdioPromises),
        allPromise,
        ipcOutputPromise,
        sendIpcInput(subprocess, ipcInput),
        ...originalPromises,
        ...customStreamsEndPromises
      ]),
      onInternalError,
      throwOnSubprocessError(subprocess, controller),
      ...throwOnTimeout(subprocess, timeout, context, controller),
      ...throwOnCancel({
        subprocess,
        cancelSignal,
        gracefulCancel,
        context,
        controller
      }),
      ...throwOnGracefulCancel({
        subprocess,
        cancelSignal,
        gracefulCancel,
        forceKillAfterDelay,
        context,
        controller
      })
    ]);
  } catch (error2) {
    context.terminationReason ?? (context.terminationReason = "other");
    return Promise.all([
      { error: error2 },
      exitPromise,
      Promise.all(stdioPromises.map((stdioPromise) => getBufferedData(stdioPromise))),
      getBufferedData(allPromise),
      getBufferedIpcOutput(ipcOutputPromise, ipcOutput),
      Promise.allSettled(originalPromises),
      Promise.allSettled(customStreamsEndPromises)
    ]);
  }
};
const waitForOriginalStreams = (originalStreams, subprocess, streamInfo) => originalStreams.map((stream2, fdNumber) => stream2 === subprocess.stdio[fdNumber] ? void 0 : waitForStream(stream2, fdNumber, streamInfo));
const waitForCustomStreamsEnd = (fileDescriptors, streamInfo) => fileDescriptors.flatMap(({ stdioItems }, fdNumber) => stdioItems.filter(({ value, stream: stream2 = value }) => isStream(stream2, { checkOpen: false }) && !isStandardStream(stream2)).map(({ type, value, stream: stream2 = value }) => waitForStream(stream2, fdNumber, streamInfo, {
  isSameDirection: TRANSFORM_TYPES.has(type),
  stopOnExit: type === "native"
})));
const throwOnSubprocessError = async (subprocess, { signal }) => {
  const [error2] = await node_events.once(subprocess, "error", { signal });
  throw error2;
};
const initializeConcurrentStreams = () => ({
  readableDestroy: /* @__PURE__ */ new WeakMap(),
  writableFinal: /* @__PURE__ */ new WeakMap(),
  writableDestroy: /* @__PURE__ */ new WeakMap()
});
const addConcurrentStream = (concurrentStreams, stream2, waitName) => {
  const weakMap = concurrentStreams[waitName];
  if (!weakMap.has(stream2)) {
    weakMap.set(stream2, []);
  }
  const promises2 = weakMap.get(stream2);
  const promise2 = createDeferred();
  promises2.push(promise2);
  const resolve = promise2.resolve.bind(promise2);
  return { resolve, promises: promises2 };
};
const waitForConcurrentStreams = async ({ resolve, promises: promises2 }, subprocess) => {
  resolve();
  const [isSubprocessExit] = await Promise.race([
    Promise.allSettled([true, subprocess]),
    Promise.all([false, ...promises2])
  ]);
  return !isSubprocessExit;
};
const safeWaitForSubprocessStdin = async (subprocessStdin) => {
  if (subprocessStdin === void 0) {
    return;
  }
  try {
    await waitForSubprocessStdin(subprocessStdin);
  } catch {
  }
};
const safeWaitForSubprocessStdout = async (subprocessStdout) => {
  if (subprocessStdout === void 0) {
    return;
  }
  try {
    await waitForSubprocessStdout(subprocessStdout);
  } catch {
  }
};
const waitForSubprocessStdin = async (subprocessStdin) => {
  await promises$1.finished(subprocessStdin, { cleanup: true, readable: false, writable: true });
};
const waitForSubprocessStdout = async (subprocessStdout) => {
  await promises$1.finished(subprocessStdout, { cleanup: true, readable: true, writable: false });
};
const waitForSubprocess = async (subprocess, error2) => {
  await subprocess;
  if (error2) {
    throw error2;
  }
};
const destroyOtherStream = (stream2, isOpen, error2) => {
  if (error2 && !isStreamAbort(error2)) {
    stream2.destroy(error2);
  } else if (isOpen) {
    stream2.destroy();
  }
};
const createReadable = ({ subprocess, concurrentStreams, encoding }, { from, binary: binaryOption = true, preserveNewlines = true } = {}) => {
  const binary = binaryOption || BINARY_ENCODINGS.has(encoding);
  const { subprocessStdout, waitReadableDestroy } = getSubprocessStdout(subprocess, from, concurrentStreams);
  const { readableEncoding, readableObjectMode, readableHighWaterMark } = getReadableOptions(subprocessStdout, binary);
  const { read: read2, onStdoutDataDone } = getReadableMethods({
    subprocessStdout,
    subprocess,
    binary,
    encoding,
    preserveNewlines
  });
  const readable2 = new node_stream.Readable({
    read: read2,
    destroy: node_util.callbackify(onReadableDestroy.bind(void 0, { subprocessStdout, subprocess, waitReadableDestroy })),
    highWaterMark: readableHighWaterMark,
    objectMode: readableObjectMode,
    encoding: readableEncoding
  });
  onStdoutFinished({
    subprocessStdout,
    onStdoutDataDone,
    readable: readable2,
    subprocess
  });
  return readable2;
};
const getSubprocessStdout = (subprocess, from, concurrentStreams) => {
  const subprocessStdout = getFromStream(subprocess, from);
  const waitReadableDestroy = addConcurrentStream(concurrentStreams, subprocessStdout, "readableDestroy");
  return { subprocessStdout, waitReadableDestroy };
};
const getReadableOptions = ({ readableEncoding, readableObjectMode, readableHighWaterMark }, binary) => binary ? { readableEncoding, readableObjectMode, readableHighWaterMark } : { readableEncoding, readableObjectMode: true, readableHighWaterMark: DEFAULT_OBJECT_HIGH_WATER_MARK };
const getReadableMethods = ({ subprocessStdout, subprocess, binary, encoding, preserveNewlines }) => {
  const onStdoutDataDone = createDeferred();
  const onStdoutData = iterateOnSubprocessStream({
    subprocessStdout,
    subprocess,
    binary,
    shouldEncode: !binary,
    encoding,
    preserveNewlines
  });
  return {
    read() {
      onRead(this, onStdoutData, onStdoutDataDone);
    },
    onStdoutDataDone
  };
};
const onRead = async (readable2, onStdoutData, onStdoutDataDone) => {
  try {
    const { value, done } = await onStdoutData.next();
    if (done) {
      onStdoutDataDone.resolve();
    } else {
      readable2.push(value);
    }
  } catch {
  }
};
const onStdoutFinished = async ({ subprocessStdout, onStdoutDataDone, readable: readable2, subprocess, subprocessStdin }) => {
  try {
    await waitForSubprocessStdout(subprocessStdout);
    await subprocess;
    await safeWaitForSubprocessStdin(subprocessStdin);
    await onStdoutDataDone;
    if (readable2.readable) {
      readable2.push(null);
    }
  } catch (error2) {
    await safeWaitForSubprocessStdin(subprocessStdin);
    destroyOtherReadable(readable2, error2);
  }
};
const onReadableDestroy = async ({ subprocessStdout, subprocess, waitReadableDestroy }, error2) => {
  if (await waitForConcurrentStreams(waitReadableDestroy, subprocess)) {
    destroyOtherReadable(subprocessStdout, error2);
    await waitForSubprocess(subprocess, error2);
  }
};
const destroyOtherReadable = (stream2, error2) => {
  destroyOtherStream(stream2, stream2.readable, error2);
};
const createWritable = ({ subprocess, concurrentStreams }, { to } = {}) => {
  const { subprocessStdin, waitWritableFinal, waitWritableDestroy } = getSubprocessStdin(subprocess, to, concurrentStreams);
  const writable2 = new node_stream.Writable({
    ...getWritableMethods(subprocessStdin, subprocess, waitWritableFinal),
    destroy: node_util.callbackify(onWritableDestroy.bind(void 0, {
      subprocessStdin,
      subprocess,
      waitWritableFinal,
      waitWritableDestroy
    })),
    highWaterMark: subprocessStdin.writableHighWaterMark,
    objectMode: subprocessStdin.writableObjectMode
  });
  onStdinFinished(subprocessStdin, writable2);
  return writable2;
};
const getSubprocessStdin = (subprocess, to, concurrentStreams) => {
  const subprocessStdin = getToStream(subprocess, to);
  const waitWritableFinal = addConcurrentStream(concurrentStreams, subprocessStdin, "writableFinal");
  const waitWritableDestroy = addConcurrentStream(concurrentStreams, subprocessStdin, "writableDestroy");
  return { subprocessStdin, waitWritableFinal, waitWritableDestroy };
};
const getWritableMethods = (subprocessStdin, subprocess, waitWritableFinal) => ({
  write: onWrite.bind(void 0, subprocessStdin),
  final: node_util.callbackify(onWritableFinal.bind(void 0, subprocessStdin, subprocess, waitWritableFinal))
});
const onWrite = (subprocessStdin, chunk, encoding, done) => {
  if (subprocessStdin.write(chunk, encoding)) {
    done();
  } else {
    subprocessStdin.once("drain", done);
  }
};
const onWritableFinal = async (subprocessStdin, subprocess, waitWritableFinal) => {
  if (await waitForConcurrentStreams(waitWritableFinal, subprocess)) {
    if (subprocessStdin.writable) {
      subprocessStdin.end();
    }
    await subprocess;
  }
};
const onStdinFinished = async (subprocessStdin, writable2, subprocessStdout) => {
  try {
    await waitForSubprocessStdin(subprocessStdin);
    if (writable2.writable) {
      writable2.end();
    }
  } catch (error2) {
    await safeWaitForSubprocessStdout(subprocessStdout);
    destroyOtherWritable(writable2, error2);
  }
};
const onWritableDestroy = async ({ subprocessStdin, subprocess, waitWritableFinal, waitWritableDestroy }, error2) => {
  await waitForConcurrentStreams(waitWritableFinal, subprocess);
  if (await waitForConcurrentStreams(waitWritableDestroy, subprocess)) {
    destroyOtherWritable(subprocessStdin, error2);
    await waitForSubprocess(subprocess, error2);
  }
};
const destroyOtherWritable = (stream2, error2) => {
  destroyOtherStream(stream2, stream2.writable, error2);
};
const createDuplex = ({ subprocess, concurrentStreams, encoding }, { from, to, binary: binaryOption = true, preserveNewlines = true } = {}) => {
  const binary = binaryOption || BINARY_ENCODINGS.has(encoding);
  const { subprocessStdout, waitReadableDestroy } = getSubprocessStdout(subprocess, from, concurrentStreams);
  const { subprocessStdin, waitWritableFinal, waitWritableDestroy } = getSubprocessStdin(subprocess, to, concurrentStreams);
  const { readableEncoding, readableObjectMode, readableHighWaterMark } = getReadableOptions(subprocessStdout, binary);
  const { read: read2, onStdoutDataDone } = getReadableMethods({
    subprocessStdout,
    subprocess,
    binary,
    encoding,
    preserveNewlines
  });
  const duplex2 = new node_stream.Duplex({
    read: read2,
    ...getWritableMethods(subprocessStdin, subprocess, waitWritableFinal),
    destroy: node_util.callbackify(onDuplexDestroy.bind(void 0, {
      subprocessStdout,
      subprocessStdin,
      subprocess,
      waitReadableDestroy,
      waitWritableFinal,
      waitWritableDestroy
    })),
    readableHighWaterMark,
    writableHighWaterMark: subprocessStdin.writableHighWaterMark,
    readableObjectMode,
    writableObjectMode: subprocessStdin.writableObjectMode,
    encoding: readableEncoding
  });
  onStdoutFinished({
    subprocessStdout,
    onStdoutDataDone,
    readable: duplex2,
    subprocess,
    subprocessStdin
  });
  onStdinFinished(subprocessStdin, duplex2, subprocessStdout);
  return duplex2;
};
const onDuplexDestroy = async ({ subprocessStdout, subprocessStdin, subprocess, waitReadableDestroy, waitWritableFinal, waitWritableDestroy }, error2) => {
  await Promise.all([
    onReadableDestroy({ subprocessStdout, subprocess, waitReadableDestroy }, error2),
    onWritableDestroy({
      subprocessStdin,
      subprocess,
      waitWritableFinal,
      waitWritableDestroy
    }, error2)
  ]);
};
const createIterable = (subprocess, encoding, {
  from,
  binary: binaryOption = false,
  preserveNewlines = false
} = {}) => {
  const binary = binaryOption || BINARY_ENCODINGS.has(encoding);
  const subprocessStdout = getFromStream(subprocess, from);
  const onStdoutData = iterateOnSubprocessStream({
    subprocessStdout,
    subprocess,
    binary,
    shouldEncode: true,
    encoding,
    preserveNewlines
  });
  return iterateOnStdoutData(onStdoutData, subprocessStdout, subprocess);
};
const iterateOnStdoutData = async function* (onStdoutData, subprocessStdout, subprocess) {
  try {
    yield* onStdoutData;
  } finally {
    if (subprocessStdout.readable) {
      subprocessStdout.destroy();
    }
    await subprocess;
  }
};
const addConvertedStreams = (subprocess, { encoding }) => {
  const concurrentStreams = initializeConcurrentStreams();
  subprocess.readable = createReadable.bind(void 0, { subprocess, concurrentStreams, encoding });
  subprocess.writable = createWritable.bind(void 0, { subprocess, concurrentStreams });
  subprocess.duplex = createDuplex.bind(void 0, { subprocess, concurrentStreams, encoding });
  subprocess.iterable = createIterable.bind(void 0, subprocess, encoding);
  subprocess[Symbol.asyncIterator] = createIterable.bind(void 0, subprocess, encoding, {});
};
const mergePromise = (subprocess, promise2) => {
  for (const [property, descriptor] of descriptors) {
    const value = descriptor.value.bind(promise2);
    Reflect.defineProperty(subprocess, property, { ...descriptor, value });
  }
};
const nativePromisePrototype = (async () => {
})().constructor.prototype;
const descriptors = ["then", "catch", "finally"].map((property) => [
  property,
  Reflect.getOwnPropertyDescriptor(nativePromisePrototype, property)
]);
const execaCoreAsync = (rawFile, rawArguments, rawOptions, createNested) => {
  const { file, commandArguments, command, escapedCommand, startTime, verboseInfo, options, fileDescriptors } = handleAsyncArguments(rawFile, rawArguments, rawOptions);
  const { subprocess, promise: promise2 } = spawnSubprocessAsync({
    file,
    commandArguments,
    options,
    startTime,
    verboseInfo,
    command,
    escapedCommand,
    fileDescriptors
  });
  subprocess.pipe = pipeToSubprocess.bind(void 0, {
    source: subprocess,
    sourcePromise: promise2,
    boundOptions: {},
    createNested
  });
  mergePromise(subprocess, promise2);
  SUBPROCESS_OPTIONS.set(subprocess, { options, fileDescriptors });
  return subprocess;
};
const handleAsyncArguments = (rawFile, rawArguments, rawOptions) => {
  const { command, escapedCommand, startTime, verboseInfo } = handleCommand(rawFile, rawArguments, rawOptions);
  const { file, commandArguments, options: normalizedOptions } = normalizeOptions(rawFile, rawArguments, rawOptions);
  const options = handleAsyncOptions(normalizedOptions);
  const fileDescriptors = handleStdioAsync(options, verboseInfo);
  return {
    file,
    commandArguments,
    command,
    escapedCommand,
    startTime,
    verboseInfo,
    options,
    fileDescriptors
  };
};
const handleAsyncOptions = ({ timeout, signal, ...options }) => {
  if (signal !== void 0) {
    throw new TypeError('The "signal" option has been renamed to "cancelSignal" instead.');
  }
  return { ...options, timeoutDuration: timeout };
};
const spawnSubprocessAsync = ({ file, commandArguments, options, startTime, verboseInfo, command, escapedCommand, fileDescriptors }) => {
  let subprocess;
  try {
    subprocess = node_child_process.spawn(...concatenateShell(file, commandArguments, options));
  } catch (error2) {
    return handleEarlyError({
      error: error2,
      command,
      escapedCommand,
      fileDescriptors,
      options,
      startTime,
      verboseInfo
    });
  }
  const controller = new AbortController();
  node_events.setMaxListeners(Number.POSITIVE_INFINITY, controller.signal);
  const originalStreams = [...subprocess.stdio];
  pipeOutputAsync(subprocess, fileDescriptors, controller);
  cleanupOnExit(subprocess, options, controller);
  const context = {};
  const onInternalError = createDeferred();
  subprocess.kill = subprocessKill.bind(void 0, {
    kill: subprocess.kill.bind(subprocess),
    options,
    onInternalError,
    context,
    controller
  });
  subprocess.all = makeAllStream(subprocess, options);
  addConvertedStreams(subprocess, options);
  addIpcMethods(subprocess, options);
  const promise2 = handlePromise({
    subprocess,
    options,
    startTime,
    verboseInfo,
    fileDescriptors,
    originalStreams,
    command,
    escapedCommand,
    context,
    onInternalError,
    controller
  });
  return { subprocess, promise: promise2 };
};
const handlePromise = async ({ subprocess, options, startTime, verboseInfo, fileDescriptors, originalStreams, command, escapedCommand, context, onInternalError, controller }) => {
  const [
    errorInfo,
    [exitCode, signal],
    stdioResults,
    allResult,
    ipcOutput
  ] = await waitForSubprocessResult({
    subprocess,
    options,
    context,
    verboseInfo,
    fileDescriptors,
    originalStreams,
    onInternalError,
    controller
  });
  controller.abort();
  onInternalError.resolve();
  const stdio = stdioResults.map((stdioResult, fdNumber) => stripNewline(stdioResult, options, fdNumber));
  const all = stripNewline(allResult, options, "all");
  const result = getAsyncResult({
    errorInfo,
    exitCode,
    signal,
    stdio,
    all,
    ipcOutput,
    context,
    options,
    command,
    escapedCommand,
    startTime
  });
  return handleResult(result, verboseInfo, options);
};
const getAsyncResult = ({ errorInfo, exitCode, signal, stdio, all, ipcOutput, context, options, command, escapedCommand, startTime }) => "error" in errorInfo ? makeError({
  error: errorInfo.error,
  command,
  escapedCommand,
  timedOut: context.terminationReason === "timeout",
  isCanceled: context.terminationReason === "cancel" || context.terminationReason === "gracefulCancel",
  isGracefullyCanceled: context.terminationReason === "gracefulCancel",
  isMaxBuffer: errorInfo.error instanceof MaxBufferError,
  isForcefullyTerminated: context.isForcefullyTerminated,
  exitCode,
  signal,
  stdio,
  all,
  ipcOutput,
  options,
  startTime,
  isSync: false
}) : makeSuccessResult({
  command,
  escapedCommand,
  stdio,
  all,
  ipcOutput,
  options,
  startTime
});
const mergeOptions = (boundOptions, options) => {
  const newOptions = Object.fromEntries(
    Object.entries(options).map(([optionName, optionValue]) => [
      optionName,
      mergeOption(optionName, boundOptions[optionName], optionValue)
    ])
  );
  return { ...boundOptions, ...newOptions };
};
const mergeOption = (optionName, boundOptionValue, optionValue) => {
  if (DEEP_OPTIONS.has(optionName) && isPlainObject(boundOptionValue) && isPlainObject(optionValue)) {
    return { ...boundOptionValue, ...optionValue };
  }
  return optionValue;
};
const DEEP_OPTIONS = /* @__PURE__ */ new Set(["env", ...FD_SPECIFIC_OPTIONS]);
const createExeca = (mapArguments, boundOptions, deepOptions, setBoundExeca) => {
  const createNested = (mapArguments2, boundOptions2, setBoundExeca2) => createExeca(mapArguments2, boundOptions2, deepOptions, setBoundExeca2);
  const boundExeca = (...execaArguments) => callBoundExeca({
    mapArguments,
    deepOptions,
    boundOptions,
    setBoundExeca,
    createNested
  }, ...execaArguments);
  if (setBoundExeca !== void 0) {
    setBoundExeca(boundExeca, createNested, boundOptions);
  }
  return boundExeca;
};
const callBoundExeca = ({ mapArguments, deepOptions = {}, boundOptions = {}, setBoundExeca, createNested }, firstArgument, ...nextArguments) => {
  if (isPlainObject(firstArgument)) {
    return createNested(mapArguments, mergeOptions(boundOptions, firstArgument), setBoundExeca);
  }
  const { file, commandArguments, options, isSync } = parseArguments({
    mapArguments,
    firstArgument,
    nextArguments,
    deepOptions,
    boundOptions
  });
  return isSync ? execaCoreSync(file, commandArguments, options) : execaCoreAsync(file, commandArguments, options, createNested);
};
const parseArguments = ({ mapArguments, firstArgument, nextArguments, deepOptions, boundOptions }) => {
  const callArguments = isTemplateString(firstArgument) ? parseTemplates(firstArgument, nextArguments) : [firstArgument, ...nextArguments];
  const [initialFile, initialArguments, initialOptions] = normalizeParameters(...callArguments);
  const mergedOptions = mergeOptions(mergeOptions(deepOptions, boundOptions), initialOptions);
  const {
    file = initialFile,
    commandArguments = initialArguments,
    options = mergedOptions,
    isSync = false
  } = mapArguments({ file: initialFile, commandArguments: initialArguments, options: mergedOptions });
  return {
    file,
    commandArguments,
    options,
    isSync
  };
};
const mapCommandAsync = ({ file, commandArguments }) => parseCommand(file, commandArguments);
const mapCommandSync = ({ file, commandArguments }) => ({ ...parseCommand(file, commandArguments), isSync: true });
const parseCommand = (command, unusedArguments) => {
  if (unusedArguments.length > 0) {
    throw new TypeError(`The command and its arguments must be passed as a single string: ${command} ${unusedArguments}.`);
  }
  const [file, ...commandArguments] = parseCommandString(command);
  return { file, commandArguments };
};
const parseCommandString = (command) => {
  if (typeof command !== "string") {
    throw new TypeError(`The command must be a string: ${String(command)}.`);
  }
  const trimmedCommand = command.trim();
  if (trimmedCommand === "") {
    return [];
  }
  const tokens = [];
  for (const token of trimmedCommand.split(SPACES_REGEXP)) {
    const previousToken = tokens.at(-1);
    if (previousToken && previousToken.endsWith("\\")) {
      tokens[tokens.length - 1] = `${previousToken.slice(0, -1)} ${token}`;
    } else {
      tokens.push(token);
    }
  }
  return tokens;
};
const SPACES_REGEXP = / +/g;
const setScriptSync = (boundExeca, createNested, boundOptions) => {
  boundExeca.sync = createNested(mapScriptSync, boundOptions);
  boundExeca.s = boundExeca.sync;
};
const mapScriptAsync = ({ options }) => getScriptOptions(options);
const mapScriptSync = ({ options }) => ({ ...getScriptOptions(options), isSync: true });
const getScriptOptions = (options) => ({ options: { ...getScriptStdinOption(options), ...options } });
const getScriptStdinOption = ({ input, inputFile, stdio }) => input === void 0 && inputFile === void 0 && stdio === void 0 ? { stdin: "inherit" } : {};
const deepScriptOptions = { preferLocal: true };
const execa = createExeca(() => ({}));
createExeca(() => ({ isSync: true }));
createExeca(mapCommandAsync);
createExeca(mapCommandSync);
createExeca(mapNode);
createExeca(mapScriptAsync, {}, deepScriptOptions, setScriptSync);
getIpcExport();
async function isGitRepo(dirPath) {
  try {
    const gitDir = path$d.join(dirPath, ".git");
    const stat2 = await fs$9.stat(gitDir);
    return stat2.isDirectory();
  } catch {
    return false;
  }
}
async function getGitInfo(dirPath, timeout = 1e4) {
  const emptyInfo = {
    isGit: false,
    branch: null,
    lastCommitHash: null,
    remotes: []
  };
  try {
    if (!await isGitRepo(dirPath)) {
      return emptyInfo;
    }
    const [branch, commit, remotes] = await Promise.all([
      getBranch(dirPath, timeout),
      getLastCommit(dirPath, timeout),
      getRemotes(dirPath, timeout)
    ]);
    return {
      isGit: true,
      branch,
      lastCommitHash: commit,
      remotes
    };
  } catch (error2) {
    log.warn(`Failed to get git info for ${dirPath}:`, error2.message);
    return emptyInfo;
  }
}
async function getBranch(dirPath, timeout) {
  try {
    const { stdout } = await execa("git", ["-C", dirPath, "rev-parse", "--abbrev-ref", "HEAD"], {
      timeout,
      reject: false
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
async function getLastCommit(dirPath, timeout) {
  try {
    const { stdout } = await execa("git", ["-C", dirPath, "rev-parse", "HEAD"], {
      timeout,
      reject: false
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
async function getRemotes(dirPath, timeout) {
  try {
    const { stdout } = await execa("git", ["-C", dirPath, "remote", "-v"], {
      timeout,
      reject: false
    });
    if (!stdout) {
      return [];
    }
    const remoteMap = /* @__PURE__ */ new Map();
    const lines = stdout.split("\n");
    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)$/);
      if (match) {
        const [, name, url] = match;
        remoteMap.set(name, url);
      }
    }
    const remotes = [];
    for (const [name, url] of remoteMap.entries()) {
      const parsed = parseRemoteURL(url);
      remotes.push({
        name,
        url,
        ...parsed
      });
    }
    return remotes;
  } catch {
    return [];
  }
}
function parseRemoteURL(url) {
  const sshMatch = url.match(/git@([^:]+):([^/]+)\/(.+?)(\.git)?$/);
  if (sshMatch) {
    const [, host, owner, repo] = sshMatch;
    return {
      provider: getProvider(host),
      owner,
      repo: repo.replace(/\.git$/, "")
    };
  }
  const httpsMatch = url.match(/https?:\/\/([^/]+)\/([^/]+)\/(.+?)(\.git)?$/);
  if (httpsMatch) {
    const [, host, owner, repo] = httpsMatch;
    return {
      provider: getProvider(host),
      owner,
      repo: repo.replace(/\.git$/, "")
    };
  }
  return {};
}
function getProvider(host) {
  const lower = host.toLowerCase();
  if (lower.includes("github")) return "github";
  if (lower.includes("gitlab")) return "gitlab";
  if (lower.includes("bitbucket")) return "bitbucket";
  return void 0;
}
class Scanner {
  constructor(config) {
    this.config = config;
    this.cancelled = false;
  }
  /**
   * Set progress callback
   */
  setProgressCallback(callback) {
    this.onProgress = callback;
  }
  /**
   * Cancel the scan
   */
  cancel() {
    this.cancelled = true;
    log.info("Scan cancelled");
  }
  /**
   * Run the scan
   */
  async scan() {
    const startTime = Date.now();
    const projects = [];
    const errors = [];
    let discovered = 0;
    let processed = 0;
    log.info("Starting scan with paths:", this.config.paths);
    try {
      const candidates = await this.findCandidates();
      discovered = candidates.length;
      log.info(`Found ${discovered} potential projects`);
      for (const candidatePath of candidates) {
        if (this.cancelled) {
          log.info("Scan cancelled by user");
          break;
        }
        try {
          const project = await this.processCandidate(candidatePath);
          if (project) {
            projects.push(project);
          }
          processed++;
          if (processed % 10 === 0 || processed === discovered) {
            this.reportProgress(discovered, processed, candidatePath);
          }
        } catch (error2) {
          log.warn(`Failed to process ${candidatePath}:`, error2.message);
          errors.push({
            path: candidatePath,
            error: error2.message
          });
          processed++;
        }
      }
      const duration = Date.now() - startTime;
      const gitRepos = projects.filter((p) => p.type === "git").length;
      return {
        projects,
        errors,
        stats: {
          totalScanned: processed,
          gitRepos,
          localProjects: projects.length - gitRepos,
          duration
        }
      };
    } catch (error2) {
      log.error("Scan failed:", error2);
      throw error2;
    }
  }
  /**
   * Find all candidate project directories
   */
  async findCandidates() {
    const candidates = /* @__PURE__ */ new Set();
    for (const scanPathEntry of this.config.paths) {
      const scanPath = typeof scanPathEntry === "string" ? scanPathEntry : scanPathEntry.path;
      const includeAsProject = typeof scanPathEntry === "string" ? false : !!scanPathEntry.includeAsProject;
      try {
        await fs$9.access(scanPath);
        const ignoreForGit = (this.config.ignoredPatterns || []).filter((p) => !p.includes(".git"));
        const foundGitDirs = await out.glob("**/.git", {
          cwd: scanPath,
          onlyFiles: false,
          deep: this.config.maxDepth,
          ignore: ignoreForGit,
          absolute: true,
          followSymbolicLinks: false
        });
        for (const gitPath of foundGitDirs) {
          const projectDir = path$d.dirname(gitPath);
          candidates.add(projectDir);
        }
        const childProjectsFound = foundGitDirs.length > 0;
        try {
          const gitStat = await fs$9.stat(path$d.join(scanPath, ".git"));
          if (gitStat && gitStat.isDirectory()) {
            if (includeAsProject || !childProjectsFound) {
              candidates.add(scanPath);
            }
          }
        } catch {
        }
        if (includeAsProject) {
          candidates.add(scanPath);
        } else if (!childProjectsFound) {
          try {
            const readmes = await this.findReadmeFiles(scanPath);
            const lang = await this.detectLanguage(scanPath);
            if (readmes && readmes.length > 0 || lang) {
              candidates.add(scanPath);
            }
          } catch (e) {
          }
        }
      } catch (error2) {
        log.warn(`Failed to scan path ${scanPath}:`, error2.message);
      }
    }
    return Array.from(candidates);
  }
  /**
   * Process a candidate directory into a Project
   */
  async processCandidate(projectPath) {
    var _a2;
    try {
      const stats = await fs$9.stat(projectPath);
      if (!stats.isDirectory()) {
        return null;
      }
      const size = await this.getDirectorySize(projectPath);
      if (size < this.config.minSizeBytes) {
        return null;
      }
      const isGit = await isGitRepo(projectPath);
      const gitInfo = isGit ? await getGitInfo(projectPath) : null;
      const fileCount = await this.countFiles(projectPath);
      const readmeFiles = await this.findReadmeFiles(projectPath);
      const language = await this.detectLanguage(projectPath);
      const provider2 = ((_a2 = gitInfo == null ? void 0 : gitInfo.remotes[0]) == null ? void 0 : _a2.provider) || null;
      const project = {
        id: crypto.randomUUID(),
        name: path$d.basename(projectPath),
        path: projectPath,
        type: isGit ? "git" : "local",
        tags: [],
        importance: 3,
        sizeBytes: size,
        createdAt: stats.birthtime.toISOString(),
        lastModifiedAt: stats.mtime.toISOString(),
        fileCount,
        provider: provider2,
        lastCommitHash: (gitInfo == null ? void 0 : gitInfo.lastCommitHash) || null,
        branch: (gitInfo == null ? void 0 : gitInfo.branch) || null,
        remotes: (gitInfo == null ? void 0 : gitInfo.remotes) || [],
        readmeFiles,
        language,
        scanStatus: "complete",
        lastScannedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      return project;
    } catch (error2) {
      log.warn(`Failed to process candidate ${projectPath}:`, error2);
      return null;
    }
  }
  /**
   * Get approximate directory size (up to 100MB worth of files)
   */
  async getDirectorySize(dirPath) {
    var _a2;
    try {
      const files = await out.glob("**/*", {
        cwd: dirPath,
        onlyFiles: true,
        deep: 3,
        // Don't go too deep for size calculation
        ignore: this.config.ignoredPatterns,
        stats: true
      });
      let totalSize = 0;
      for (const file of files) {
        totalSize += ((_a2 = file.stats) == null ? void 0 : _a2.size) || 0;
        if (totalSize > 1e8) break;
      }
      return totalSize;
    } catch {
      return 0;
    }
  }
  /**
   * Count files in directory
   */
  async countFiles(dirPath) {
    try {
      const files = await out.glob("**/*", {
        cwd: dirPath,
        onlyFiles: true,
        deep: 5,
        ignore: this.config.ignoredPatterns
      });
      return files.length;
    } catch {
      return 0;
    }
  }
  /**
   * Find README files
   */
  async findReadmeFiles(dirPath) {
    try {
      const readmes = await out.glob("**/README*.{md,txt,rst}", {
        cwd: dirPath,
        onlyFiles: true,
        deep: 2,
        caseSensitiveMatch: false
      });
      return readmes;
    } catch {
      return [];
    }
  }
  /**
   * Detect primary programming language
   */
  async detectLanguage(dirPath) {
    try {
      const indicators = {
        typescript: ["tsconfig.json", "package.json"],
        javascript: ["package.json", "yarn.lock"],
        python: ["requirements.txt", "setup.py", "pyproject.toml"],
        rust: ["Cargo.toml"],
        go: ["go.mod", "go.sum"],
        java: ["pom.xml", "build.gradle"],
        ruby: ["Gemfile"],
        php: ["composer.json"],
        csharp: ["*.csproj", "*.sln"],
        swift: ["Package.swift"]
      };
      for (const [lang, patterns] of Object.entries(indicators)) {
        for (const pattern2 of patterns) {
          const found = await out.glob(pattern2, {
            cwd: dirPath,
            deep: 1,
            caseSensitiveMatch: false
          });
          if (found.length > 0) {
            return lang;
          }
        }
      }
      return void 0;
    } catch {
      return void 0;
    }
  }
  /**
   * Report progress
   */
  reportProgress(discovered, processed, currentPath) {
    if (this.onProgress) {
      this.onProgress({
        discovered,
        processed,
        currentPath
      });
    }
  }
}
function isArray(value) {
  return !Array.isArray ? getTag(value) === "[object Array]" : Array.isArray(value);
}
function baseToString(value) {
  if (typeof value == "string") {
    return value;
  }
  let result = value + "";
  return result == "0" && 1 / value == -Infinity ? "-0" : result;
}
function toString(value) {
  return value == null ? "" : baseToString(value);
}
function isString(value) {
  return typeof value === "string";
}
function isNumber(value) {
  return typeof value === "number";
}
function isBoolean(value) {
  return value === true || value === false || isObjectLike(value) && getTag(value) == "[object Boolean]";
}
function isObject(value) {
  return typeof value === "object";
}
function isObjectLike(value) {
  return isObject(value) && value !== null;
}
function isDefined(value) {
  return value !== void 0 && value !== null;
}
function isBlank(value) {
  return !value.trim().length;
}
function getTag(value) {
  return value == null ? value === void 0 ? "[object Undefined]" : "[object Null]" : Object.prototype.toString.call(value);
}
const INCORRECT_INDEX_TYPE = "Incorrect 'index' type";
const LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY = (key) => `Invalid value for key ${key}`;
const PATTERN_LENGTH_TOO_LARGE = (max) => `Pattern length exceeds max of ${max}.`;
const MISSING_KEY_PROPERTY = (name) => `Missing ${name} property in key`;
const INVALID_KEY_WEIGHT_VALUE = (key) => `Property 'weight' in key '${key}' must be a positive integer`;
const hasOwn = Object.prototype.hasOwnProperty;
class KeyStore {
  constructor(keys) {
    this._keys = [];
    this._keyMap = {};
    let totalWeight = 0;
    keys.forEach((key) => {
      let obj = createKey(key);
      this._keys.push(obj);
      this._keyMap[obj.id] = obj;
      totalWeight += obj.weight;
    });
    this._keys.forEach((key) => {
      key.weight /= totalWeight;
    });
  }
  get(keyId) {
    return this._keyMap[keyId];
  }
  keys() {
    return this._keys;
  }
  toJSON() {
    return JSON.stringify(this._keys);
  }
}
function createKey(key) {
  let path2 = null;
  let id = null;
  let src = null;
  let weight = 1;
  let getFn = null;
  if (isString(key) || isArray(key)) {
    src = key;
    path2 = createKeyPath(key);
    id = createKeyId(key);
  } else {
    if (!hasOwn.call(key, "name")) {
      throw new Error(MISSING_KEY_PROPERTY("name"));
    }
    const name = key.name;
    src = name;
    if (hasOwn.call(key, "weight")) {
      weight = key.weight;
      if (weight <= 0) {
        throw new Error(INVALID_KEY_WEIGHT_VALUE(name));
      }
    }
    path2 = createKeyPath(name);
    id = createKeyId(name);
    getFn = key.getFn;
  }
  return { path: path2, id, weight, src, getFn };
}
function createKeyPath(key) {
  return isArray(key) ? key : key.split(".");
}
function createKeyId(key) {
  return isArray(key) ? key.join(".") : key;
}
function get(obj, path2) {
  let list = [];
  let arr = false;
  const deepGet = (obj2, path3, index) => {
    if (!isDefined(obj2)) {
      return;
    }
    if (!path3[index]) {
      list.push(obj2);
    } else {
      let key = path3[index];
      const value = obj2[key];
      if (!isDefined(value)) {
        return;
      }
      if (index === path3.length - 1 && (isString(value) || isNumber(value) || isBoolean(value))) {
        list.push(toString(value));
      } else if (isArray(value)) {
        arr = true;
        for (let i2 = 0, len = value.length; i2 < len; i2 += 1) {
          deepGet(value[i2], path3, index + 1);
        }
      } else if (path3.length) {
        deepGet(value, path3, index + 1);
      }
    }
  };
  deepGet(obj, isString(path2) ? path2.split(".") : path2, 0);
  return arr ? list : list[0];
}
const MatchOptions = {
  // Whether the matches should be included in the result set. When `true`, each record in the result
  // set will include the indices of the matched characters.
  // These can consequently be used for highlighting purposes.
  includeMatches: false,
  // When `true`, the matching function will continue to the end of a search pattern even if
  // a perfect match has already been located in the string.
  findAllMatches: false,
  // Minimum number of characters that must be matched before a result is considered a match
  minMatchCharLength: 1
};
const BasicOptions = {
  // When `true`, the algorithm continues searching to the end of the input even if a perfect
  // match is found before the end of the same input.
  isCaseSensitive: false,
  // When `true`, the algorithm will ignore diacritics (accents) in comparisons
  ignoreDiacritics: false,
  // When true, the matching function will continue to the end of a search pattern even if
  includeScore: false,
  // List of properties that will be searched. This also supports nested properties.
  keys: [],
  // Whether to sort the result list, by score
  shouldSort: true,
  // Default sort function: sort by ascending score, ascending index
  sortFn: (a2, b) => a2.score === b.score ? a2.idx < b.idx ? -1 : 1 : a2.score < b.score ? -1 : 1
};
const FuzzyOptions = {
  // Approximately where in the text is the pattern expected to be found?
  location: 0,
  // At what point does the match algorithm give up. A threshold of '0.0' requires a perfect match
  // (of both letters and location), a threshold of '1.0' would match anything.
  threshold: 0.6,
  // Determines how close the match must be to the fuzzy location (specified above).
  // An exact letter match which is 'distance' characters away from the fuzzy location
  // would score as a complete mismatch. A distance of '0' requires the match be at
  // the exact location specified, a threshold of '1000' would require a perfect match
  // to be within 800 characters of the fuzzy location to be found using a 0.8 threshold.
  distance: 100
};
const AdvancedOptions = {
  // When `true`, it enables the use of unix-like search commands
  useExtendedSearch: false,
  // The get function to use when fetching an object's properties.
  // The default will search nested paths *ie foo.bar.baz*
  getFn: get,
  // When `true`, search will ignore `location` and `distance`, so it won't matter
  // where in the string the pattern appears.
  // More info: https://fusejs.io/concepts/scoring-theory.html#fuzziness-score
  ignoreLocation: false,
  // When `true`, the calculation for the relevance score (used for sorting) will
  // ignore the field-length norm.
  // More info: https://fusejs.io/concepts/scoring-theory.html#field-length-norm
  ignoreFieldNorm: false,
  // The weight to determine how much field length norm effects scoring.
  fieldNormWeight: 1
};
var Config = {
  ...BasicOptions,
  ...MatchOptions,
  ...FuzzyOptions,
  ...AdvancedOptions
};
const SPACE = /[^ ]+/g;
function norm(weight = 1, mantissa = 3) {
  const cache = /* @__PURE__ */ new Map();
  const m = Math.pow(10, mantissa);
  return {
    get(value) {
      const numTokens = value.match(SPACE).length;
      if (cache.has(numTokens)) {
        return cache.get(numTokens);
      }
      const norm2 = 1 / Math.pow(numTokens, 0.5 * weight);
      const n2 = parseFloat(Math.round(norm2 * m) / m);
      cache.set(numTokens, n2);
      return n2;
    },
    clear() {
      cache.clear();
    }
  };
}
class FuseIndex {
  constructor({
    getFn = Config.getFn,
    fieldNormWeight = Config.fieldNormWeight
  } = {}) {
    this.norm = norm(fieldNormWeight, 3);
    this.getFn = getFn;
    this.isCreated = false;
    this.setIndexRecords();
  }
  setSources(docs = []) {
    this.docs = docs;
  }
  setIndexRecords(records = []) {
    this.records = records;
  }
  setKeys(keys = []) {
    this.keys = keys;
    this._keysMap = {};
    keys.forEach((key, idx) => {
      this._keysMap[key.id] = idx;
    });
  }
  create() {
    if (this.isCreated || !this.docs.length) {
      return;
    }
    this.isCreated = true;
    if (isString(this.docs[0])) {
      this.docs.forEach((doc, docIndex) => {
        this._addString(doc, docIndex);
      });
    } else {
      this.docs.forEach((doc, docIndex) => {
        this._addObject(doc, docIndex);
      });
    }
    this.norm.clear();
  }
  // Adds a doc to the end of the index
  add(doc) {
    const idx = this.size();
    if (isString(doc)) {
      this._addString(doc, idx);
    } else {
      this._addObject(doc, idx);
    }
  }
  // Removes the doc at the specified index of the index
  removeAt(idx) {
    this.records.splice(idx, 1);
    for (let i2 = idx, len = this.size(); i2 < len; i2 += 1) {
      this.records[i2].i -= 1;
    }
  }
  getValueForItemAtKeyId(item, keyId) {
    return item[this._keysMap[keyId]];
  }
  size() {
    return this.records.length;
  }
  _addString(doc, docIndex) {
    if (!isDefined(doc) || isBlank(doc)) {
      return;
    }
    let record = {
      v: doc,
      i: docIndex,
      n: this.norm.get(doc)
    };
    this.records.push(record);
  }
  _addObject(doc, docIndex) {
    let record = { i: docIndex, $: {} };
    this.keys.forEach((key, keyIndex) => {
      let value = key.getFn ? key.getFn(doc) : this.getFn(doc, key.path);
      if (!isDefined(value)) {
        return;
      }
      if (isArray(value)) {
        let subRecords = [];
        const stack = [{ nestedArrIndex: -1, value }];
        while (stack.length) {
          const { nestedArrIndex, value: value2 } = stack.pop();
          if (!isDefined(value2)) {
            continue;
          }
          if (isString(value2) && !isBlank(value2)) {
            let subRecord = {
              v: value2,
              i: nestedArrIndex,
              n: this.norm.get(value2)
            };
            subRecords.push(subRecord);
          } else if (isArray(value2)) {
            value2.forEach((item, k) => {
              stack.push({
                nestedArrIndex: k,
                value: item
              });
            });
          } else ;
        }
        record.$[keyIndex] = subRecords;
      } else if (isString(value) && !isBlank(value)) {
        let subRecord = {
          v: value,
          n: this.norm.get(value)
        };
        record.$[keyIndex] = subRecord;
      }
    });
    this.records.push(record);
  }
  toJSON() {
    return {
      keys: this.keys,
      records: this.records
    };
  }
}
function createIndex(keys, docs, { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
  const myIndex = new FuseIndex({ getFn, fieldNormWeight });
  myIndex.setKeys(keys.map(createKey));
  myIndex.setSources(docs);
  myIndex.create();
  return myIndex;
}
function parseIndex(data, { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
  const { keys, records } = data;
  const myIndex = new FuseIndex({ getFn, fieldNormWeight });
  myIndex.setKeys(keys);
  myIndex.setIndexRecords(records);
  return myIndex;
}
function computeScore$1(pattern2, {
  errors = 0,
  currentLocation = 0,
  expectedLocation = 0,
  distance = Config.distance,
  ignoreLocation = Config.ignoreLocation
} = {}) {
  const accuracy = errors / pattern2.length;
  if (ignoreLocation) {
    return accuracy;
  }
  const proximity = Math.abs(expectedLocation - currentLocation);
  if (!distance) {
    return proximity ? 1 : accuracy;
  }
  return accuracy + proximity / distance;
}
function convertMaskToIndices(matchmask = [], minMatchCharLength = Config.minMatchCharLength) {
  let indices = [];
  let start = -1;
  let end = -1;
  let i2 = 0;
  for (let len = matchmask.length; i2 < len; i2 += 1) {
    let match = matchmask[i2];
    if (match && start === -1) {
      start = i2;
    } else if (!match && start !== -1) {
      end = i2 - 1;
      if (end - start + 1 >= minMatchCharLength) {
        indices.push([start, end]);
      }
      start = -1;
    }
  }
  if (matchmask[i2 - 1] && i2 - start >= minMatchCharLength) {
    indices.push([start, i2 - 1]);
  }
  return indices;
}
const MAX_BITS = 32;
function search(text, pattern2, patternAlphabet, {
  location = Config.location,
  distance = Config.distance,
  threshold = Config.threshold,
  findAllMatches = Config.findAllMatches,
  minMatchCharLength = Config.minMatchCharLength,
  includeMatches = Config.includeMatches,
  ignoreLocation = Config.ignoreLocation
} = {}) {
  if (pattern2.length > MAX_BITS) {
    throw new Error(PATTERN_LENGTH_TOO_LARGE(MAX_BITS));
  }
  const patternLen = pattern2.length;
  const textLen = text.length;
  const expectedLocation = Math.max(0, Math.min(location, textLen));
  let currentThreshold = threshold;
  let bestLocation = expectedLocation;
  const computeMatches = minMatchCharLength > 1 || includeMatches;
  const matchMask = computeMatches ? Array(textLen) : [];
  let index;
  while ((index = text.indexOf(pattern2, bestLocation)) > -1) {
    let score = computeScore$1(pattern2, {
      currentLocation: index,
      expectedLocation,
      distance,
      ignoreLocation
    });
    currentThreshold = Math.min(score, currentThreshold);
    bestLocation = index + patternLen;
    if (computeMatches) {
      let i2 = 0;
      while (i2 < patternLen) {
        matchMask[index + i2] = 1;
        i2 += 1;
      }
    }
  }
  bestLocation = -1;
  let lastBitArr = [];
  let finalScore = 1;
  let binMax = patternLen + textLen;
  const mask = 1 << patternLen - 1;
  for (let i2 = 0; i2 < patternLen; i2 += 1) {
    let binMin = 0;
    let binMid = binMax;
    while (binMin < binMid) {
      const score2 = computeScore$1(pattern2, {
        errors: i2,
        currentLocation: expectedLocation + binMid,
        expectedLocation,
        distance,
        ignoreLocation
      });
      if (score2 <= currentThreshold) {
        binMin = binMid;
      } else {
        binMax = binMid;
      }
      binMid = Math.floor((binMax - binMin) / 2 + binMin);
    }
    binMax = binMid;
    let start = Math.max(1, expectedLocation - binMid + 1);
    let finish = findAllMatches ? textLen : Math.min(expectedLocation + binMid, textLen) + patternLen;
    let bitArr = Array(finish + 2);
    bitArr[finish + 1] = (1 << i2) - 1;
    for (let j = finish; j >= start; j -= 1) {
      let currentLocation = j - 1;
      let charMatch = patternAlphabet[text.charAt(currentLocation)];
      if (computeMatches) {
        matchMask[currentLocation] = +!!charMatch;
      }
      bitArr[j] = (bitArr[j + 1] << 1 | 1) & charMatch;
      if (i2) {
        bitArr[j] |= (lastBitArr[j + 1] | lastBitArr[j]) << 1 | 1 | lastBitArr[j + 1];
      }
      if (bitArr[j] & mask) {
        finalScore = computeScore$1(pattern2, {
          errors: i2,
          currentLocation,
          expectedLocation,
          distance,
          ignoreLocation
        });
        if (finalScore <= currentThreshold) {
          currentThreshold = finalScore;
          bestLocation = currentLocation;
          if (bestLocation <= expectedLocation) {
            break;
          }
          start = Math.max(1, 2 * expectedLocation - bestLocation);
        }
      }
    }
    const score = computeScore$1(pattern2, {
      errors: i2 + 1,
      currentLocation: expectedLocation,
      expectedLocation,
      distance,
      ignoreLocation
    });
    if (score > currentThreshold) {
      break;
    }
    lastBitArr = bitArr;
  }
  const result = {
    isMatch: bestLocation >= 0,
    // Count exact matches (those with a score of 0) to be "almost" exact
    score: Math.max(1e-3, finalScore)
  };
  if (computeMatches) {
    const indices = convertMaskToIndices(matchMask, minMatchCharLength);
    if (!indices.length) {
      result.isMatch = false;
    } else if (includeMatches) {
      result.indices = indices;
    }
  }
  return result;
}
function createPatternAlphabet(pattern2) {
  let mask = {};
  for (let i2 = 0, len = pattern2.length; i2 < len; i2 += 1) {
    const char = pattern2.charAt(i2);
    mask[char] = (mask[char] || 0) | 1 << len - i2 - 1;
  }
  return mask;
}
const stripDiacritics = String.prototype.normalize ? (str) => str.normalize("NFD").replace(/[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D3-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C04\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u1885\u1886\u18A9\u1920-\u192B\u1930-\u193B\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ABE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]/g, "") : (str) => str;
class BitapSearch {
  constructor(pattern2, {
    location = Config.location,
    threshold = Config.threshold,
    distance = Config.distance,
    includeMatches = Config.includeMatches,
    findAllMatches = Config.findAllMatches,
    minMatchCharLength = Config.minMatchCharLength,
    isCaseSensitive = Config.isCaseSensitive,
    ignoreDiacritics = Config.ignoreDiacritics,
    ignoreLocation = Config.ignoreLocation
  } = {}) {
    this.options = {
      location,
      threshold,
      distance,
      includeMatches,
      findAllMatches,
      minMatchCharLength,
      isCaseSensitive,
      ignoreDiacritics,
      ignoreLocation
    };
    pattern2 = isCaseSensitive ? pattern2 : pattern2.toLowerCase();
    pattern2 = ignoreDiacritics ? stripDiacritics(pattern2) : pattern2;
    this.pattern = pattern2;
    this.chunks = [];
    if (!this.pattern.length) {
      return;
    }
    const addChunk = (pattern3, startIndex) => {
      this.chunks.push({
        pattern: pattern3,
        alphabet: createPatternAlphabet(pattern3),
        startIndex
      });
    };
    const len = this.pattern.length;
    if (len > MAX_BITS) {
      let i2 = 0;
      const remainder = len % MAX_BITS;
      const end = len - remainder;
      while (i2 < end) {
        addChunk(this.pattern.substr(i2, MAX_BITS), i2);
        i2 += MAX_BITS;
      }
      if (remainder) {
        const startIndex = len - MAX_BITS;
        addChunk(this.pattern.substr(startIndex), startIndex);
      }
    } else {
      addChunk(this.pattern, 0);
    }
  }
  searchIn(text) {
    const { isCaseSensitive, ignoreDiacritics, includeMatches } = this.options;
    text = isCaseSensitive ? text : text.toLowerCase();
    text = ignoreDiacritics ? stripDiacritics(text) : text;
    if (this.pattern === text) {
      let result2 = {
        isMatch: true,
        score: 0
      };
      if (includeMatches) {
        result2.indices = [[0, text.length - 1]];
      }
      return result2;
    }
    const {
      location,
      distance,
      threshold,
      findAllMatches,
      minMatchCharLength,
      ignoreLocation
    } = this.options;
    let allIndices = [];
    let totalScore = 0;
    let hasMatches = false;
    this.chunks.forEach(({ pattern: pattern2, alphabet, startIndex }) => {
      const { isMatch, score, indices } = search(text, pattern2, alphabet, {
        location: location + startIndex,
        distance,
        threshold,
        findAllMatches,
        minMatchCharLength,
        includeMatches,
        ignoreLocation
      });
      if (isMatch) {
        hasMatches = true;
      }
      totalScore += score;
      if (isMatch && indices) {
        allIndices = [...allIndices, ...indices];
      }
    });
    let result = {
      isMatch: hasMatches,
      score: hasMatches ? totalScore / this.chunks.length : 1
    };
    if (hasMatches && includeMatches) {
      result.indices = allIndices;
    }
    return result;
  }
}
class BaseMatch {
  constructor(pattern2) {
    this.pattern = pattern2;
  }
  static isMultiMatch(pattern2) {
    return getMatch(pattern2, this.multiRegex);
  }
  static isSingleMatch(pattern2) {
    return getMatch(pattern2, this.singleRegex);
  }
  search() {
  }
}
function getMatch(pattern2, exp) {
  const matches = pattern2.match(exp);
  return matches ? matches[1] : null;
}
class ExactMatch extends BaseMatch {
  constructor(pattern2) {
    super(pattern2);
  }
  static get type() {
    return "exact";
  }
  static get multiRegex() {
    return /^="(.*)"$/;
  }
  static get singleRegex() {
    return /^=(.*)$/;
  }
  search(text) {
    const isMatch = text === this.pattern;
    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [0, this.pattern.length - 1]
    };
  }
}
class InverseExactMatch extends BaseMatch {
  constructor(pattern2) {
    super(pattern2);
  }
  static get type() {
    return "inverse-exact";
  }
  static get multiRegex() {
    return /^!"(.*)"$/;
  }
  static get singleRegex() {
    return /^!(.*)$/;
  }
  search(text) {
    const index = text.indexOf(this.pattern);
    const isMatch = index === -1;
    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [0, text.length - 1]
    };
  }
}
class PrefixExactMatch extends BaseMatch {
  constructor(pattern2) {
    super(pattern2);
  }
  static get type() {
    return "prefix-exact";
  }
  static get multiRegex() {
    return /^\^"(.*)"$/;
  }
  static get singleRegex() {
    return /^\^(.*)$/;
  }
  search(text) {
    const isMatch = text.startsWith(this.pattern);
    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [0, this.pattern.length - 1]
    };
  }
}
class InversePrefixExactMatch extends BaseMatch {
  constructor(pattern2) {
    super(pattern2);
  }
  static get type() {
    return "inverse-prefix-exact";
  }
  static get multiRegex() {
    return /^!\^"(.*)"$/;
  }
  static get singleRegex() {
    return /^!\^(.*)$/;
  }
  search(text) {
    const isMatch = !text.startsWith(this.pattern);
    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [0, text.length - 1]
    };
  }
}
class SuffixExactMatch extends BaseMatch {
  constructor(pattern2) {
    super(pattern2);
  }
  static get type() {
    return "suffix-exact";
  }
  static get multiRegex() {
    return /^"(.*)"\$$/;
  }
  static get singleRegex() {
    return /^(.*)\$$/;
  }
  search(text) {
    const isMatch = text.endsWith(this.pattern);
    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [text.length - this.pattern.length, text.length - 1]
    };
  }
}
class InverseSuffixExactMatch extends BaseMatch {
  constructor(pattern2) {
    super(pattern2);
  }
  static get type() {
    return "inverse-suffix-exact";
  }
  static get multiRegex() {
    return /^!"(.*)"\$$/;
  }
  static get singleRegex() {
    return /^!(.*)\$$/;
  }
  search(text) {
    const isMatch = !text.endsWith(this.pattern);
    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [0, text.length - 1]
    };
  }
}
class FuzzyMatch extends BaseMatch {
  constructor(pattern2, {
    location = Config.location,
    threshold = Config.threshold,
    distance = Config.distance,
    includeMatches = Config.includeMatches,
    findAllMatches = Config.findAllMatches,
    minMatchCharLength = Config.minMatchCharLength,
    isCaseSensitive = Config.isCaseSensitive,
    ignoreDiacritics = Config.ignoreDiacritics,
    ignoreLocation = Config.ignoreLocation
  } = {}) {
    super(pattern2);
    this._bitapSearch = new BitapSearch(pattern2, {
      location,
      threshold,
      distance,
      includeMatches,
      findAllMatches,
      minMatchCharLength,
      isCaseSensitive,
      ignoreDiacritics,
      ignoreLocation
    });
  }
  static get type() {
    return "fuzzy";
  }
  static get multiRegex() {
    return /^"(.*)"$/;
  }
  static get singleRegex() {
    return /^(.*)$/;
  }
  search(text) {
    return this._bitapSearch.searchIn(text);
  }
}
class IncludeMatch extends BaseMatch {
  constructor(pattern2) {
    super(pattern2);
  }
  static get type() {
    return "include";
  }
  static get multiRegex() {
    return /^'"(.*)"$/;
  }
  static get singleRegex() {
    return /^'(.*)$/;
  }
  search(text) {
    let location = 0;
    let index;
    const indices = [];
    const patternLen = this.pattern.length;
    while ((index = text.indexOf(this.pattern, location)) > -1) {
      location = index + patternLen;
      indices.push([index, location - 1]);
    }
    const isMatch = !!indices.length;
    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices
    };
  }
}
const searchers = [
  ExactMatch,
  IncludeMatch,
  PrefixExactMatch,
  InversePrefixExactMatch,
  InverseSuffixExactMatch,
  SuffixExactMatch,
  InverseExactMatch,
  FuzzyMatch
];
const searchersLen = searchers.length;
const SPACE_RE = / +(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/;
const OR_TOKEN = "|";
function parseQuery(pattern2, options = {}) {
  return pattern2.split(OR_TOKEN).map((item) => {
    let query = item.trim().split(SPACE_RE).filter((item2) => item2 && !!item2.trim());
    let results = [];
    for (let i2 = 0, len = query.length; i2 < len; i2 += 1) {
      const queryItem = query[i2];
      let found = false;
      let idx = -1;
      while (!found && ++idx < searchersLen) {
        const searcher = searchers[idx];
        let token = searcher.isMultiMatch(queryItem);
        if (token) {
          results.push(new searcher(token, options));
          found = true;
        }
      }
      if (found) {
        continue;
      }
      idx = -1;
      while (++idx < searchersLen) {
        const searcher = searchers[idx];
        let token = searcher.isSingleMatch(queryItem);
        if (token) {
          results.push(new searcher(token, options));
          break;
        }
      }
    }
    return results;
  });
}
const MultiMatchSet = /* @__PURE__ */ new Set([FuzzyMatch.type, IncludeMatch.type]);
class ExtendedSearch {
  constructor(pattern2, {
    isCaseSensitive = Config.isCaseSensitive,
    ignoreDiacritics = Config.ignoreDiacritics,
    includeMatches = Config.includeMatches,
    minMatchCharLength = Config.minMatchCharLength,
    ignoreLocation = Config.ignoreLocation,
    findAllMatches = Config.findAllMatches,
    location = Config.location,
    threshold = Config.threshold,
    distance = Config.distance
  } = {}) {
    this.query = null;
    this.options = {
      isCaseSensitive,
      ignoreDiacritics,
      includeMatches,
      minMatchCharLength,
      findAllMatches,
      ignoreLocation,
      location,
      threshold,
      distance
    };
    pattern2 = isCaseSensitive ? pattern2 : pattern2.toLowerCase();
    pattern2 = ignoreDiacritics ? stripDiacritics(pattern2) : pattern2;
    this.pattern = pattern2;
    this.query = parseQuery(this.pattern, this.options);
  }
  static condition(_, options) {
    return options.useExtendedSearch;
  }
  searchIn(text) {
    const query = this.query;
    if (!query) {
      return {
        isMatch: false,
        score: 1
      };
    }
    const { includeMatches, isCaseSensitive, ignoreDiacritics } = this.options;
    text = isCaseSensitive ? text : text.toLowerCase();
    text = ignoreDiacritics ? stripDiacritics(text) : text;
    let numMatches = 0;
    let allIndices = [];
    let totalScore = 0;
    for (let i2 = 0, qLen = query.length; i2 < qLen; i2 += 1) {
      const searchers2 = query[i2];
      allIndices.length = 0;
      numMatches = 0;
      for (let j = 0, pLen = searchers2.length; j < pLen; j += 1) {
        const searcher = searchers2[j];
        const { isMatch, indices, score } = searcher.search(text);
        if (isMatch) {
          numMatches += 1;
          totalScore += score;
          if (includeMatches) {
            const type = searcher.constructor.type;
            if (MultiMatchSet.has(type)) {
              allIndices = [...allIndices, ...indices];
            } else {
              allIndices.push(indices);
            }
          }
        } else {
          totalScore = 0;
          numMatches = 0;
          allIndices.length = 0;
          break;
        }
      }
      if (numMatches) {
        let result = {
          isMatch: true,
          score: totalScore / numMatches
        };
        if (includeMatches) {
          result.indices = allIndices;
        }
        return result;
      }
    }
    return {
      isMatch: false,
      score: 1
    };
  }
}
const registeredSearchers = [];
function register(...args) {
  registeredSearchers.push(...args);
}
function createSearcher(pattern2, options) {
  for (let i2 = 0, len = registeredSearchers.length; i2 < len; i2 += 1) {
    let searcherClass = registeredSearchers[i2];
    if (searcherClass.condition(pattern2, options)) {
      return new searcherClass(pattern2, options);
    }
  }
  return new BitapSearch(pattern2, options);
}
const LogicalOperator = {
  AND: "$and",
  OR: "$or"
};
const KeyType = {
  PATH: "$path",
  PATTERN: "$val"
};
const isExpression = (query) => !!(query[LogicalOperator.AND] || query[LogicalOperator.OR]);
const isPath = (query) => !!query[KeyType.PATH];
const isLeaf = (query) => !isArray(query) && isObject(query) && !isExpression(query);
const convertToExplicit = (query) => ({
  [LogicalOperator.AND]: Object.keys(query).map((key) => ({
    [key]: query[key]
  }))
});
function parse(query, options, { auto = true } = {}) {
  const next = (query2) => {
    let keys = Object.keys(query2);
    const isQueryPath = isPath(query2);
    if (!isQueryPath && keys.length > 1 && !isExpression(query2)) {
      return next(convertToExplicit(query2));
    }
    if (isLeaf(query2)) {
      const key = isQueryPath ? query2[KeyType.PATH] : keys[0];
      const pattern2 = isQueryPath ? query2[KeyType.PATTERN] : query2[key];
      if (!isString(pattern2)) {
        throw new Error(LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY(key));
      }
      const obj = {
        keyId: createKeyId(key),
        pattern: pattern2
      };
      if (auto) {
        obj.searcher = createSearcher(pattern2, options);
      }
      return obj;
    }
    let node = {
      children: [],
      operator: keys[0]
    };
    keys.forEach((key) => {
      const value = query2[key];
      if (isArray(value)) {
        value.forEach((item) => {
          node.children.push(next(item));
        });
      }
    });
    return node;
  };
  if (!isExpression(query)) {
    query = convertToExplicit(query);
  }
  return next(query);
}
function computeScore(results, { ignoreFieldNorm = Config.ignoreFieldNorm }) {
  results.forEach((result) => {
    let totalScore = 1;
    result.matches.forEach(({ key, norm: norm2, score }) => {
      const weight = key ? key.weight : null;
      totalScore *= Math.pow(
        score === 0 && weight ? Number.EPSILON : score,
        (weight || 1) * (ignoreFieldNorm ? 1 : norm2)
      );
    });
    result.score = totalScore;
  });
}
function transformMatches(result, data) {
  const matches = result.matches;
  data.matches = [];
  if (!isDefined(matches)) {
    return;
  }
  matches.forEach((match) => {
    if (!isDefined(match.indices) || !match.indices.length) {
      return;
    }
    const { indices, value } = match;
    let obj = {
      indices,
      value
    };
    if (match.key) {
      obj.key = match.key.src;
    }
    if (match.idx > -1) {
      obj.refIndex = match.idx;
    }
    data.matches.push(obj);
  });
}
function transformScore(result, data) {
  data.score = result.score;
}
function format(results, docs, {
  includeMatches = Config.includeMatches,
  includeScore = Config.includeScore
} = {}) {
  const transformers = [];
  if (includeMatches) transformers.push(transformMatches);
  if (includeScore) transformers.push(transformScore);
  return results.map((result) => {
    const { idx } = result;
    const data = {
      item: docs[idx],
      refIndex: idx
    };
    if (transformers.length) {
      transformers.forEach((transformer) => {
        transformer(result, data);
      });
    }
    return data;
  });
}
class Fuse {
  constructor(docs, options = {}, index) {
    this.options = { ...Config, ...options };
    if (this.options.useExtendedSearch && false) ;
    this._keyStore = new KeyStore(this.options.keys);
    this.setCollection(docs, index);
  }
  setCollection(docs, index) {
    this._docs = docs;
    if (index && !(index instanceof FuseIndex)) {
      throw new Error(INCORRECT_INDEX_TYPE);
    }
    this._myIndex = index || createIndex(this.options.keys, this._docs, {
      getFn: this.options.getFn,
      fieldNormWeight: this.options.fieldNormWeight
    });
  }
  add(doc) {
    if (!isDefined(doc)) {
      return;
    }
    this._docs.push(doc);
    this._myIndex.add(doc);
  }
  remove(predicate = () => false) {
    const results = [];
    for (let i2 = 0, len = this._docs.length; i2 < len; i2 += 1) {
      const doc = this._docs[i2];
      if (predicate(doc, i2)) {
        this.removeAt(i2);
        i2 -= 1;
        len -= 1;
        results.push(doc);
      }
    }
    return results;
  }
  removeAt(idx) {
    this._docs.splice(idx, 1);
    this._myIndex.removeAt(idx);
  }
  getIndex() {
    return this._myIndex;
  }
  search(query, { limit = -1 } = {}) {
    const {
      includeMatches,
      includeScore,
      shouldSort,
      sortFn,
      ignoreFieldNorm
    } = this.options;
    let results = isString(query) ? isString(this._docs[0]) ? this._searchStringList(query) : this._searchObjectList(query) : this._searchLogical(query);
    computeScore(results, { ignoreFieldNorm });
    if (shouldSort) {
      results.sort(sortFn);
    }
    if (isNumber(limit) && limit > -1) {
      results = results.slice(0, limit);
    }
    return format(results, this._docs, {
      includeMatches,
      includeScore
    });
  }
  _searchStringList(query) {
    const searcher = createSearcher(query, this.options);
    const { records } = this._myIndex;
    const results = [];
    records.forEach(({ v: text, i: idx, n: norm2 }) => {
      if (!isDefined(text)) {
        return;
      }
      const { isMatch, score, indices } = searcher.searchIn(text);
      if (isMatch) {
        results.push({
          item: text,
          idx,
          matches: [{ score, value: text, norm: norm2, indices }]
        });
      }
    });
    return results;
  }
  _searchLogical(query) {
    const expression = parse(query, this.options);
    const evaluate = (node, item, idx) => {
      if (!node.children) {
        const { keyId, searcher } = node;
        const matches = this._findMatches({
          key: this._keyStore.get(keyId),
          value: this._myIndex.getValueForItemAtKeyId(item, keyId),
          searcher
        });
        if (matches && matches.length) {
          return [
            {
              idx,
              item,
              matches
            }
          ];
        }
        return [];
      }
      const res = [];
      for (let i2 = 0, len = node.children.length; i2 < len; i2 += 1) {
        const child = node.children[i2];
        const result = evaluate(child, item, idx);
        if (result.length) {
          res.push(...result);
        } else if (node.operator === LogicalOperator.AND) {
          return [];
        }
      }
      return res;
    };
    const records = this._myIndex.records;
    const resultMap = {};
    const results = [];
    records.forEach(({ $: item, i: idx }) => {
      if (isDefined(item)) {
        let expResults = evaluate(expression, item, idx);
        if (expResults.length) {
          if (!resultMap[idx]) {
            resultMap[idx] = { idx, item, matches: [] };
            results.push(resultMap[idx]);
          }
          expResults.forEach(({ matches }) => {
            resultMap[idx].matches.push(...matches);
          });
        }
      }
    });
    return results;
  }
  _searchObjectList(query) {
    const searcher = createSearcher(query, this.options);
    const { keys, records } = this._myIndex;
    const results = [];
    records.forEach(({ $: item, i: idx }) => {
      if (!isDefined(item)) {
        return;
      }
      let matches = [];
      keys.forEach((key, keyIndex) => {
        matches.push(
          ...this._findMatches({
            key,
            value: item[keyIndex],
            searcher
          })
        );
      });
      if (matches.length) {
        results.push({
          idx,
          item,
          matches
        });
      }
    });
    return results;
  }
  _findMatches({ key, value, searcher }) {
    if (!isDefined(value)) {
      return [];
    }
    let matches = [];
    if (isArray(value)) {
      value.forEach(({ v: text, i: idx, n: norm2 }) => {
        if (!isDefined(text)) {
          return;
        }
        const { isMatch, score, indices } = searcher.searchIn(text);
        if (isMatch) {
          matches.push({
            score,
            key,
            value: text,
            idx,
            norm: norm2,
            indices
          });
        }
      });
    } else {
      const { v: text, n: norm2 } = value;
      const { isMatch, score, indices } = searcher.searchIn(text);
      if (isMatch) {
        matches.push({ score, key, value: text, norm: norm2, indices });
      }
    }
    return matches;
  }
}
Fuse.version = "7.1.0";
Fuse.createIndex = createIndex;
Fuse.parseIndex = parseIndex;
Fuse.config = Config;
{
  Fuse.parseQuery = parse;
}
{
  register(ExtendedSearch);
}
class SearchIndexManager {
  constructor() {
    this.fuse = null;
    this.projects = [];
    this.fuseOptions = {
      keys: [
        { name: "name", weight: 0.4 },
        { name: "path", weight: 0.3 },
        { name: "description", weight: 0.2 },
        { name: "tags", weight: 0.1 }
      ],
      threshold: 0.4,
      // 0.0 = perfect match, 1.0 = match anything
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2
    };
  }
  /**
   * Build or rebuild the search index
   */
  buildIndex(projects) {
    const startTime = Date.now();
    this.projects = projects;
    this.fuse = new Fuse(projects, this.fuseOptions);
    const duration = Date.now() - startTime;
    log.info(`Search index built for ${projects.length} projects in ${duration}ms`);
  }
  /**
   * Add a project to the index
   */
  addProject(project) {
    if (!this.fuse) {
      this.buildIndex([project]);
      return;
    }
    this.projects.push(project);
    this.buildIndex(this.projects);
  }
  /**
   * Update a project in the index
   */
  updateProject(project) {
    const index = this.projects.findIndex((p) => p.id === project.id);
    if (index >= 0) {
      this.projects[index] = project;
      this.buildIndex(this.projects);
    } else {
      this.addProject(project);
    }
  }
  /**
   * Remove a project from the index
   */
  removeProject(projectId) {
    this.projects = this.projects.filter((p) => p.id !== projectId);
    if (this.projects.length > 0) {
      this.buildIndex(this.projects);
    } else {
      this.fuse = null;
    }
  }
  /**
   * Search projects
   */
  search(query, limit = 50) {
    if (!this.fuse || !query || query.trim().length === 0) {
      return this.projects.slice(0, limit);
    }
    const results = this.fuse.search(query, { limit });
    return results.map((result) => result.item);
  }
  /**
   * Get all projects with optional filtering and sorting
   */
  getAll(options) {
    let filtered = [...this.projects];
    if (options == null ? void 0 : options.filters) {
      const { type, provider: provider2, tags, importance } = options.filters;
      if (type) {
        filtered = filtered.filter((p) => p.type === type);
      }
      if (provider2) {
        filtered = filtered.filter((p) => p.provider === provider2);
      }
      if (tags && tags.length > 0) {
        filtered = filtered.filter(
          (p) => tags.some((tag) => p.tags.includes(tag))
        );
      }
      if (importance !== void 0) {
        filtered = filtered.filter((p) => p.importance === importance);
      }
    }
    if (options == null ? void 0 : options.sort) {
      const { by, order } = options.sort;
      filtered.sort((a2, b) => {
        let aVal = a2[by];
        let bVal = b[by];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return order === "asc" ? 1 : -1;
        if (bVal == null) return order === "asc" ? -1 : 1;
        if (typeof aVal === "string") {
          const cmp = aVal.localeCompare(bVal);
          return order === "asc" ? cmp : -cmp;
        }
        return order === "asc" ? aVal - bVal : bVal - aVal;
      });
    }
    const page = (options == null ? void 0 : options.page) || 1;
    const pageSize = (options == null ? void 0 : options.pageSize) || 50;
    const start = (page - 1) * pageSize;
    const paginated = filtered.slice(start, start + pageSize);
    return {
      projects: paginated,
      total: filtered.length
    };
  }
  /**
   * Get index stats
   */
  getStats() {
    return {
      projectCount: this.projects.length,
      indexSize: this.fuse ? JSON.stringify(this.fuse.getIndex()).length : 0
    };
  }
}
let searchInstance = null;
function getSearchIndex() {
  if (!searchInstance) {
    searchInstance = new SearchIndexManager();
  }
  return searchInstance;
}
class ScanJobManager {
  constructor() {
    this.currentJob = null;
    this.scanner = null;
    this.progressCallbacks = /* @__PURE__ */ new Set();
  }
  /**
   * Start a new scan
   */
  async startScan(config) {
    if (this.currentJob && this.currentJob.status === "running") {
      this.cancelScan(this.currentJob.id);
    }
    const jobId = crypto.randomUUID();
    log.info(`Starting scan job ${jobId}`);
    this.currentJob = {
      id: jobId,
      status: "running",
      progress: {
        discovered: 0,
        processed: 0,
        currentPath: ""
      },
      startedAt: Date.now()
    };
    this.scanner = new Scanner(config);
    this.scanner.setProgressCallback((progress) => {
      if (this.currentJob && this.currentJob.id === jobId) {
        this.currentJob.progress = progress;
        this.notifyProgress(jobId, progress);
      }
    });
    this.runScan(jobId, this.scanner).catch((error2) => {
      log.error(`Scan job ${jobId} failed:`, error2);
    });
    return jobId;
  }
  /**
   * Run the scan and handle results
   */
  async runScan(jobId, scanner) {
    try {
      const result = await scanner.scan();
      if (!this.currentJob || this.currentJob.id !== jobId) {
        return;
      }
      const store = getStore();
      for (const project of result.projects) {
        await store.upsertProject(project);
      }
      await store.flush();
      const allProjects = await store.getAllProjects();
      const searchIndex = getSearchIndex();
      searchIndex.buildIndex(allProjects);
      this.currentJob.status = "complete";
      this.currentJob.result = result;
      this.currentJob.completedAt = Date.now();
      log.info(`Scan job ${jobId} completed: ${result.projects.length} projects found`);
    } catch (error2) {
      if (!this.currentJob || this.currentJob.id !== jobId) {
        return;
      }
      this.currentJob.status = "error";
      this.currentJob.error = error2.message;
      this.currentJob.completedAt = Date.now();
      log.error(`Scan job ${jobId} error:`, error2);
    }
  }
  /**
   * Cancel a scan
   */
  cancelScan(jobId) {
    if (!this.currentJob || this.currentJob.id !== jobId) {
      return false;
    }
    if (this.currentJob.status !== "running") {
      return false;
    }
    if (this.scanner) {
      this.scanner.cancel();
    }
    this.currentJob.status = "cancelled";
    this.currentJob.completedAt = Date.now();
    log.info(`Scan job ${jobId} cancelled`);
    return true;
  }
  /**
   * Get job status
   */
  getJobStatus(jobId) {
    if (this.currentJob && this.currentJob.id === jobId) {
      return { ...this.currentJob };
    }
    return null;
  }
  /**
   * Register progress callback
   */
  onProgress(callback) {
    this.progressCallbacks.add(callback);
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }
  /**
   * Notify all progress callbacks
   */
  notifyProgress(jobId, progress) {
    for (const callback of this.progressCallbacks) {
      try {
        callback(jobId, progress);
      } catch (error2) {
        log.error("Progress callback error:", error2);
      }
    }
  }
}
let managerInstance = null;
function getScanJobManager() {
  if (!managerInstance) {
    managerInstance = new ScanJobManager();
  }
  return managerInstance;
}
function setupIPCHandlers() {
  const store = getStore();
  function createResponse(success, data, error2, requestId = "") {
    return { success, data, error: error2, requestId };
  }
  electron.ipcMain.handle("project:touchAll", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const timestamp = (params == null ? void 0 : params.timestamp) || (/* @__PURE__ */ new Date()).toISOString();
      const allProjects = await store.getAllProjects();
      let touched = 0;
      for (const p of allProjects) {
        try {
          await store.updateProject(p.id, { lastModifiedAt: timestamp });
          touched++;
        } catch (e) {
          log.warn(`Failed to touch project ${p.id}:`, (e == null ? void 0 : e.message) || e);
        }
      }
      const allWindows = electron.BrowserWindow.getAllWindows();
      for (const win of allWindows) {
        win.webContents.send("projects:touched", { timestamp, touched });
      }
      return createResponse(true, { touched }, void 0, requestId);
    } catch (error2) {
      log.error("Error touching all projects:", error2);
      return createResponse(false, void 0, { code: "INTERNAL_ERROR", message: error2.message }, requestId);
    }
  });
  electron.ipcMain.handle("project:list", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const searchIndex = getSearchIndex();
      const { query, filters, sort, page, pageSize } = params || {};
      let sortObj;
      if (typeof sort === "string" && sort.length > 0) {
        if (sort.startsWith("-")) {
          sortObj = { by: sort.substring(1), order: "desc" };
        } else {
          sortObj = { by: sort, order: "asc" };
        }
      } else if (sort && typeof sort === "object" && (sort.by || sort.order)) {
        sortObj = { by: sort.by, order: sort.order || "asc" };
      }
      let result;
      if (query && query.trim().length > 0) {
        let projects = searchIndex.search(query, pageSize || 50);
        if (sortObj && sortObj.by) {
          projects = projects.slice();
          projects.sort((a2, b) => {
            let aVal = a2[sortObj.by];
            let bVal = b[sortObj.by];
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return sortObj.order === "asc" ? 1 : -1;
            if (bVal == null) return sortObj.order === "asc" ? -1 : 1;
            if (typeof aVal === "string") {
              const cmp = aVal.localeCompare(bVal);
              return sortObj.order === "asc" ? cmp : -cmp;
            }
            return sortObj.order === "asc" ? aVal - bVal : bVal - aVal;
          });
        }
        result = {
          projects,
          total: projects.length,
          page: 1
        };
      } else {
        const searchResult = searchIndex.getAll({
          filters,
          sort: sortObj,
          page,
          pageSize
        });
        result = {
          ...searchResult,
          page: page || 1
        };
      }
      return createResponse(true, result, void 0, requestId);
    } catch (error2) {
      log.error("Error listing projects:", error2);
      return createResponse(
        false,
        void 0,
        {
          code: "INTERNAL_ERROR",
          message: error2.message || "Failed to list projects"
        },
        requestId
      );
    }
  });
  electron.ipcMain.handle("project:get", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { id } = params;
      if (!id) {
        return createResponse(
          false,
          void 0,
          { code: "INVALID_INPUT", message: "Project ID is required" },
          requestId
        );
      }
      const project = await store.getProject(id);
      if (!project) {
        return createResponse(
          false,
          void 0,
          { code: "NOT_FOUND", message: `Project ${id} not found` },
          requestId
        );
      }
      return createResponse(true, { project }, void 0, requestId);
    } catch (error2) {
      log.error("Error getting project:", error2);
      return createResponse(
        false,
        void 0,
        { code: "INTERNAL_ERROR", message: error2.message },
        requestId
      );
    }
  });
  electron.ipcMain.handle("project:update", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { id, updates } = params;
      if (!id || !updates) {
        return createResponse(
          false,
          void 0,
          { code: "INVALID_INPUT", message: "ID and updates are required" },
          requestId
        );
      }
      const project = await store.updateProject(id, updates);
      if (!project) {
        return createResponse(
          false,
          void 0,
          { code: "NOT_FOUND", message: `Project ${id} not found` },
          requestId
        );
      }
      event.sender.send("project:updated", { projectId: id, changes: updates });
      return createResponse(true, { project }, void 0, requestId);
    } catch (error2) {
      log.error("Error updating project:", error2);
      return createResponse(
        false,
        void 0,
        { code: "INTERNAL_ERROR", message: error2.message },
        requestId
      );
    }
  });
  electron.ipcMain.handle("project:delete", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { id } = params;
      if (!id) {
        return createResponse(
          false,
          void 0,
          { code: "INVALID_INPUT", message: "Project ID is required" },
          requestId
        );
      }
      const deleted = await store.deleteProject(id);
      if (deleted) {
        event.sender.send("project:deleted", { projectId: id });
      }
      return createResponse(true, { deleted }, void 0, requestId);
    } catch (error2) {
      log.error("Error deleting project:", error2);
      return createResponse(
        false,
        void 0,
        { code: "INTERNAL_ERROR", message: error2.message },
        requestId
      );
    }
  });
  electron.ipcMain.handle("scan:start", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { paths } = params;
      if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return createResponse(
          false,
          void 0,
          { code: "INVALID_INPUT", message: "Scan paths are required" },
          requestId
        );
      }
      const scanManager = getScanJobManager();
      const jobId = await scanManager.startScan({
        paths,
        ignoredPatterns: [
          "**/node_modules/**",
          "**/.git/**",
          "**/dist/**",
          "**/build/**",
          "**/.next/**",
          "**/target/**",
          "**/.venv/**",
          "**/__pycache__/**"
        ],
        maxDepth: 5,
        minSizeBytes: 0
      });
      scanManager.onProgress((id, progress) => {
        const allWindows = electron.BrowserWindow.getAllWindows();
        for (const window2 of allWindows) {
          window2.webContents.send("scan:progress", {
            jobId: id,
            discovered: progress.discovered,
            processed: progress.processed
          });
        }
      });
      return createResponse(
        true,
        { jobId },
        void 0,
        requestId
      );
    } catch (error2) {
      log.error("Error starting scan:", error2);
      return createResponse(
        false,
        void 0,
        { code: "INTERNAL_ERROR", message: error2.message },
        requestId
      );
    }
  });
  electron.ipcMain.handle("scan:status", async (event, params) => {
    var _a2;
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { jobId } = params;
      if (!jobId) {
        return createResponse(
          false,
          void 0,
          { code: "INVALID_INPUT", message: "Job ID is required" },
          requestId
        );
      }
      const scanManager = getScanJobManager();
      const job = scanManager.getJobStatus(jobId);
      if (!job) {
        return createResponse(
          false,
          void 0,
          { code: "NOT_FOUND", message: `Scan job ${jobId} not found` },
          requestId
        );
      }
      const progress = job.status === "running" ? job.progress.discovered > 0 ? job.progress.processed / job.progress.discovered * 100 : 0 : 100;
      return createResponse(
        true,
        {
          progress,
          status: job.status,
          errors: ((_a2 = job.result) == null ? void 0 : _a2.errors) || []
        },
        void 0,
        requestId
      );
    } catch (error2) {
      log.error("Error getting scan status:", error2);
      return createResponse(
        false,
        void 0,
        { code: "INTERNAL_ERROR", message: error2.message },
        requestId
      );
    }
  });
  electron.ipcMain.handle("scan:cancel", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { jobId } = params;
      if (!jobId) {
        return createResponse(
          false,
          void 0,
          { code: "INVALID_INPUT", message: "Job ID is required" },
          requestId
        );
      }
      const scanManager = getScanJobManager();
      const cancelled = scanManager.cancelScan(jobId);
      return createResponse(
        true,
        { cancelled },
        void 0,
        requestId
      );
    } catch (error2) {
      log.error("Error cancelling scan:", error2);
      return createResponse(
        false,
        void 0,
        { code: "INTERNAL_ERROR", message: error2.message },
        requestId
      );
    }
  });
  electron.ipcMain.handle("file:tree", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { projectId, maxDepth = 3 } = params;
      if (!projectId) {
        return createResponse(
          false,
          void 0,
          { code: "INVALID_INPUT", message: "Project ID is required" },
          requestId
        );
      }
      const project = await store.getProject(projectId);
      if (!project) {
        return createResponse(
          false,
          void 0,
          { code: "NOT_FOUND", message: `Project ${projectId} not found` },
          requestId
        );
      }
      const tree = await buildFileTree(project.path, maxDepth);
      return createResponse(true, { tree }, void 0, requestId);
    } catch (error2) {
      log.error("Error getting file tree:", error2);
      return createResponse(
        false,
        void 0,
        { code: "INTERNAL_ERROR", message: error2.message },
        requestId
      );
    }
  });
  electron.ipcMain.handle("readme:list", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { projectId } = params;
      if (!projectId) {
        return createResponse(
          false,
          void 0,
          { code: "INVALID_INPUT", message: "Project ID is required" },
          requestId
        );
      }
      const project = await store.getProject(projectId);
      if (!project) {
        return createResponse(
          false,
          void 0,
          { code: "NOT_FOUND", message: `Project ${projectId} not found` },
          requestId
        );
      }
      const readmeFiles = project.readmeFiles || [];
      return createResponse(
        true,
        { readmeFiles },
        void 0,
        requestId
      );
    } catch (error2) {
      log.error("Error listing README files:", error2);
      return createResponse(
        false,
        void 0,
        { code: "INTERNAL_ERROR", message: error2.message },
        requestId
      );
    }
  });
  electron.ipcMain.handle("readme:fetch", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { projectId, filePath: relativeFilePath } = params;
      if (!projectId || !relativeFilePath) {
        return createResponse(
          false,
          void 0,
          { code: "INVALID_INPUT", message: "Project ID and file path are required" },
          requestId
        );
      }
      const project = await store.getProject(projectId);
      if (!project) {
        return createResponse(
          false,
          void 0,
          { code: "NOT_FOUND", message: `Project ${projectId} not found` },
          requestId
        );
      }
      const absolutePath = path__namespace.join(project.path, relativeFilePath);
      const normalizedProjectPath = path__namespace.normalize(project.path);
      const normalizedFilePath = path__namespace.normalize(absolutePath);
      if (!normalizedFilePath.startsWith(normalizedProjectPath)) {
        return createResponse(
          false,
          void 0,
          { code: "INVALID_INPUT", message: "File path must be within project directory" },
          requestId
        );
      }
      const content = await fs__namespace.readFile(absolutePath, "utf-8");
      return createResponse(
        true,
        { content, filePath: relativeFilePath },
        void 0,
        requestId
      );
    } catch (error2) {
      log.error("Error fetching README:", error2);
      return createResponse(
        false,
        void 0,
        { code: "INTERNAL_ERROR", message: error2.message },
        requestId
      );
    }
  });
  electron.ipcMain.handle("git:list-branches", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { projectId } = params;
      if (!projectId) {
        return createResponse(false, void 0, { code: "INVALID_INPUT", message: "Project ID is required" }, requestId);
      }
      const project = await store.getProject(projectId);
      if (!project) {
        return createResponse(false, void 0, { code: "NOT_FOUND", message: `Project ${projectId} not found` }, requestId);
      }
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);
      const cmd = `git -C "${project.path}" for-each-ref --format="%(refname:short)" refs/heads`;
      const { stdout } = await execAsync(cmd);
      const branches = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      return createResponse(true, { branches }, void 0, requestId);
    } catch (error2) {
      log.error("Error listing git branches:", error2);
      return createResponse(false, void 0, { code: "INTERNAL_ERROR", message: error2.message }, requestId);
    }
  });
  electron.ipcMain.handle("git:list-commits", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { projectId, limit = 20 } = params || {};
      if (!projectId) {
        return createResponse(false, void 0, { code: "INVALID_INPUT", message: "Project ID is required" }, requestId);
      }
      const project = await store.getProject(projectId);
      if (!project) {
        return createResponse(false, void 0, { code: "NOT_FOUND", message: `Project ${projectId} not found` }, requestId);
      }
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);
      const format2 = "%H|||%an|||%ae|||%ad|||%s";
      const cmd = `git -C "${project.path}" log -n ${Number(limit)} --pretty=format:"${format2}" --date=iso`;
      const { stdout } = await execAsync(cmd);
      const lines = stdout.split(/\r?\n/).filter(Boolean);
      const commits = lines.map((line) => {
        const parts = line.split("|||");
        return {
          hash: parts[0] || "",
          authorName: parts[1] || "",
          authorEmail: parts[2] || "",
          date: parts[3] || "",
          message: parts[4] || ""
        };
      });
      return createResponse(true, { commits }, void 0, requestId);
    } catch (error2) {
      log.error("Error listing recent commits:", error2);
      return createResponse(false, void 0, { code: "INTERNAL_ERROR", message: error2.message }, requestId);
    }
  });
  electron.ipcMain.handle("git:checkout", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { projectId, branch } = params;
      if (!projectId || !branch) {
        return createResponse(false, void 0, { code: "INVALID_INPUT", message: "Project ID and branch are required" }, requestId);
      }
      const project = await store.getProject(projectId);
      if (!project) {
        return createResponse(false, void 0, { code: "NOT_FOUND", message: `Project ${projectId} not found` }, requestId);
      }
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);
      const statusCmd = `git -C "${project.path}" status --porcelain`;
      const { stdout: statusOut } = await execAsync(statusCmd);
      if (statusOut && statusOut.trim().length > 0 && !(params == null ? void 0 : params.force)) {
        return createResponse(
          false,
          void 0,
          { code: "UNCOMMITTED_CHANGES", message: "There are uncommitted changes", details: statusOut },
          requestId
        );
      }
      const cmd = `git -C "${project.path}" checkout "${branch}"`;
      await execAsync(cmd);
      const updated = await store.updateProject(projectId, { branch });
      const allWindows = electron.BrowserWindow.getAllWindows();
      for (const win of allWindows) {
        win.webContents.send("project:updated", { projectId, changes: { branch } });
      }
      return createResponse(true, { branch, project: updated }, void 0, requestId);
    } catch (error2) {
      log.error("Error checking out branch:", error2);
      return createResponse(false, void 0, { code: "INTERNAL_ERROR", message: error2.message }, requestId);
    }
  });
  electron.ipcMain.handle("markdown:list", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { projectId } = params;
      if (!projectId) {
        return createResponse(false, void 0, { code: "INVALID_INPUT", message: "Project ID is required" }, requestId);
      }
      const project = await store.getProject(projectId);
      if (!project) {
        return createResponse(false, void 0, { code: "NOT_FOUND", message: `Project ${projectId} not found` }, requestId);
      }
      const files = await fs__namespace.readdir(project.path);
      const mdFiles = files.filter((f) => f.match(/\.md$/i));
      return createResponse(true, { mdFiles }, void 0, requestId);
    } catch (error2) {
      log.error("Error listing Markdown files:", error2);
      return createResponse(false, void 0, { code: "INTERNAL_ERROR", message: error2.message }, requestId);
    }
  });
  electron.ipcMain.handle("markdown:fetch", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { projectId, filePath: relativeFilePath } = params;
      if (!projectId || !relativeFilePath) {
        return createResponse(false, void 0, { code: "INVALID_INPUT", message: "Project ID and file path are required" }, requestId);
      }
      const project = await store.getProject(projectId);
      if (!project) {
        return createResponse(false, void 0, { code: "NOT_FOUND", message: `Project ${projectId} not found` }, requestId);
      }
      const absolutePath = path__namespace.join(project.path, relativeFilePath);
      const normalizedProjectPath = path__namespace.normalize(project.path);
      const normalizedFilePath = path__namespace.normalize(absolutePath);
      if (!normalizedFilePath.startsWith(normalizedProjectPath)) {
        return createResponse(false, void 0, { code: "INVALID_INPUT", message: "File path must be within project directory" }, requestId);
      }
      const content = await fs__namespace.readFile(absolutePath, "utf-8");
      return createResponse(true, { content, filePath: relativeFilePath }, void 0, requestId);
    } catch (error2) {
      log.error("Error fetching Markdown:", error2);
      return createResponse(false, void 0, { code: "INTERNAL_ERROR", message: error2.message }, requestId);
    }
  });
  electron.ipcMain.handle("dialog:select-folder", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { dialog } = require("electron");
      const win = electron.BrowserWindow.getFocusedWindow();
      const defaultPath = params == null ? void 0 : params.defaultPath;
      const result = await dialog.showOpenDialog(win, {
        title: "Select Folder",
        properties: ["openDirectory", "createDirectory"],
        defaultPath: defaultPath || void 0
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return createResponse(false, void 0, { code: "CANCELLED", message: "No folder selected" }, requestId);
      }
      return createResponse(true, { path: result.filePaths[0] }, void 0, requestId);
    } catch (error2) {
      log.error("Error showing folder dialog:", error2);
      return createResponse(false, void 0, { code: "INTERNAL_ERROR", message: error2.message }, requestId);
    }
  });
  electron.ipcMain.handle("action:open-ide", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { projectPath } = params;
      if (!projectPath) {
        return createResponse(false, void 0, { code: "INVALID_INPUT", message: "Project path is required" }, requestId);
      }
      const store2 = getStore();
      const settings2 = await store2.getSettings();
      let command = settings2.ideCommand;
      if (!command || typeof command !== "string" || !command.includes("{path}")) {
        if (process.platform === "darwin") {
          command = 'open -a "Visual Studio Code" "{path}"';
        } else if (process.platform === "win32") {
          command = 'code "{path}"';
        } else {
          command = 'code "{path}"';
        }
      }
      command = command.replace("{path}", projectPath);
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);
      await execAsync(command);
      return createResponse(true, { opened: true }, void 0, requestId);
    } catch (error2) {
      log.error("Error opening IDE:", error2);
      return createResponse(false, void 0, { code: "INTERNAL_ERROR", message: `Failed to open IDE: ${error2.message}` }, requestId);
    }
  });
  electron.ipcMain.handle("action:open-terminal", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { projectPath } = params;
      if (!projectPath) {
        return createResponse(false, void 0, { code: "INVALID_INPUT", message: "Project path is required" }, requestId);
      }
      const store2 = getStore();
      const settings2 = await store2.getSettings();
      let command = settings2.terminalCommand;
      if (!command || typeof command !== "string" || !command.includes("{path}")) {
        if (process.platform === "darwin") {
          command = 'open -a Terminal "{path}"';
        } else if (process.platform === "win32") {
          command = 'start cmd /K cd "{path}"';
        } else {
          const terminals = [
            "gnome-terminal",
            "konsole",
            "xfce4-terminal",
            "x-terminal-emulator",
            "xterm"
          ];
          const { execSync } = require("child_process");
          let found = "";
          for (const term of terminals) {
            try {
              execSync(`command -v ${term}`);
              found = term;
              break;
            } catch {
            }
          }
          if (found) {
            command = `${found} --working-directory="{path}" &`;
          } else {
            command = "xterm &";
          }
        }
      }
      command = command.replace("{path}", projectPath);
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);
      await execAsync(command);
      return createResponse(true, { opened: true }, void 0, requestId);
    } catch (error2) {
      log.error("Error opening terminal:", error2);
      return createResponse(false, void 0, { code: "INTERNAL_ERROR", message: `Failed to open terminal: ${error2.message}` }, requestId);
    }
  });
  electron.ipcMain.handle("action:open-remote", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { remoteUrl } = params;
      if (!remoteUrl) {
        return createResponse(
          false,
          void 0,
          { code: "INVALID_INPUT", message: "Remote URL is required" },
          requestId
        );
      }
      const { shell } = require("electron");
      let browserUrl = (remoteUrl || "").trim();
      const sshShortMatch = browserUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
      if (sshShortMatch) {
        const host = sshShortMatch[1];
        const repoPath = sshShortMatch[2].replace(/\.git$/, "");
        browserUrl = `https://${host}/${repoPath}`;
      }
      const sshUrlMatch = browserUrl.match(/^(?:git\+ssh:\/\/|ssh:\/\/)?(?:git@)?([^\/]+)\/(.+?)(?:\.git)?$/);
      if (sshUrlMatch && !browserUrl.startsWith("http")) {
        const host = sshUrlMatch[1];
        const repoPath = sshUrlMatch[2].replace(/\.git$/, "");
        browserUrl = `https://${host}/${repoPath}`;
      }
      if (browserUrl.startsWith("git://")) {
        browserUrl = browserUrl.replace(/^git:\/\//, "https://").replace(/\.git$/, "");
      }
      if (browserUrl.startsWith("http") && browserUrl.endsWith(".git")) {
        browserUrl = browserUrl.replace(/\.git$/, "");
      }
      await shell.openExternal(browserUrl);
      return createResponse(true, { opened: true }, void 0, requestId);
    } catch (error2) {
      log.error("Error opening remote:", error2);
      return createResponse(
        false,
        void 0,
        { code: "INTERNAL_ERROR", message: `Failed to open remote: ${error2.message}` },
        requestId
      );
    }
  });
  electron.ipcMain.handle("project:export", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const data = await store.export();
      const { dialog } = require("electron");
      const win = electron.BrowserWindow.getFocusedWindow();
      const result = await dialog.showSaveDialog(win, {
        title: "Export Projects",
        defaultPath: "projects.json",
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (result.canceled || !result.filePath) {
        return createResponse(
          false,
          void 0,
          { code: "CANCELLED", message: "Export cancelled" },
          requestId
        );
      }
      await fs__namespace.writeFile(result.filePath, JSON.stringify(data, null, 2), "utf-8");
      return createResponse(true, { path: result.filePath }, void 0, requestId);
    } catch (error2) {
      log.error("Error exporting projects:", error2);
      return createResponse(
        false,
        void 0,
        { code: "INTERNAL_ERROR", message: `Failed to export projects: ${error2.message}` },
        requestId
      );
    }
  });
  electron.ipcMain.handle("project:import", async (event, params) => {
    const requestId = (params == null ? void 0 : params.requestId) || "";
    try {
      const { dialog } = require("electron");
      const win = electron.BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(win, {
        title: "Import Projects",
        properties: ["openFile"],
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return createResponse(
          false,
          void 0,
          { code: "CANCELLED", message: "Import cancelled" },
          requestId
        );
      }
      const filePath = result.filePaths[0];
      const content = await fs__namespace.readFile(filePath, "utf-8");
      const parsed = JSON.parse(content);
      const mode2 = (params == null ? void 0 : params.mode) === "merge" ? "merge" : "replace";
      const onConflict = (params == null ? void 0 : params.onConflict) === "skip" ? "skip" : "overwrite";
      if (mode2 === "replace") {
        await store.import(parsed);
      } else {
        const incomingProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
        for (const p of incomingProjects) {
          if (!(p == null ? void 0 : p.id)) continue;
          const existing = await store.getProject(p.id);
          if (existing) {
            if (onConflict === "overwrite") {
              await store.upsertProject(p);
            } else {
            }
          } else {
            await store.upsertProject(p);
          }
        }
      }
      const searchIndex = getSearchIndex();
      const projects = await store.getAllProjects();
      searchIndex.buildIndex(projects);
      event.sender.send("projects:imported", { imported: true, count: projects.length, mode: mode2, onConflict });
      return createResponse(true, { imported: true, count: projects.length, mode: mode2, onConflict }, void 0, requestId);
    } catch (error2) {
      log.error("Error importing projects:", error2);
      return createResponse(
        false,
        void 0,
        { code: "INTERNAL_ERROR", message: `Failed to import projects: ${error2.message}` },
        requestId
      );
    }
  });
  electron.ipcMain.handle("project:preview-import", async (event) => {
    const requestId = "";
    try {
      const { dialog } = require("electron");
      const win = electron.BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(win, {
        title: "Preview Import Projects",
        properties: ["openFile"],
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return createResponse(false, void 0, { code: "CANCELLED", message: "Preview cancelled" }, requestId);
      }
      const filePath = result.filePaths[0];
      const content = await fs__namespace.readFile(filePath, "utf-8");
      const parsed = JSON.parse(content || "{}");
      const incoming = Array.isArray(parsed.projects) ? parsed.projects : [];
      const sample = incoming.slice(0, 10).map((p) => ({ id: p.id, name: p.name, path: p.path, provider: p.provider }));
      return createResponse(true, { filePath, count: incoming.length, sample }, void 0, requestId);
    } catch (error2) {
      log.error("Error previewing import:", error2);
      return createResponse(false, void 0, { code: "INTERNAL_ERROR", message: error2.message }, requestId);
    }
  });
  electron.ipcMain.handle("settings:get", async (event) => {
    try {
      const settings2 = await store.getSettings();
      return createResponse(true, { settings: settings2 });
    } catch (error2) {
      log.error("Error getting settings:", error2);
      return createResponse(false, void 0, { code: "INTERNAL_ERROR", message: error2.message });
    }
  });
  electron.ipcMain.handle("settings:set", async (event, params) => {
    try {
      const { settings: settings2 } = params;
      if (!settings2) {
        return createResponse(false, void 0, { code: "INVALID_INPUT", message: "Settings required" });
      }
      await store.setSettings(settings2);
      return createResponse(true, { saved: true });
    } catch (error2) {
      log.error("Error saving settings:", error2);
      return createResponse(false, void 0, { code: "INTERNAL_ERROR", message: error2.message });
    }
  });
  electron.ipcMain.handle("cache:clear", async (event) => {
    try {
      await store.clear();
      const allWindows = electron.BrowserWindow.getAllWindows();
      for (const window2 of allWindows) {
        window2.webContents.send("cache:cleared", { cleared: true });
      }
      return createResponse(true, { cleared: true });
    } catch (error2) {
      log.error("Error clearing cache:", error2);
      return createResponse(false, void 0, { code: "INTERNAL_ERROR", message: error2.message });
    }
  });
  log.info("IPC handlers registered");
}
async function buildFileTree(dirPath, maxDepth, currentDepth = 0) {
  const stats = await fs__namespace.stat(dirPath);
  const name = path__namespace.basename(dirPath);
  const node = {
    name,
    path: dirPath,
    type: stats.isDirectory() ? "directory" : "file",
    size: stats.size,
    children: []
  };
  if (!stats.isDirectory() || currentDepth >= maxDepth) {
    return node;
  }
  try {
    const entries = await fs__namespace.readdir(dirPath, { withFileTypes: true });
    const ignoredDirs = /* @__PURE__ */ new Set([
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      "target",
      ".venv",
      "__pycache__",
      ".cache",
      "coverage",
      ".idea",
      ".vscode"
    ]);
    const filteredEntries = entries.filter((entry2) => {
      if (entry2.name.startsWith(".") && entry2.name !== ".github") {
        return false;
      }
      if (entry2.isDirectory() && ignoredDirs.has(entry2.name)) {
        return false;
      }
      return true;
    });
    filteredEntries.sort((a2, b) => {
      if (a2.isDirectory() && !b.isDirectory()) return -1;
      if (!a2.isDirectory() && b.isDirectory()) return 1;
      return a2.name.localeCompare(b.name);
    });
    const childPromises = filteredEntries.map(async (entry2) => {
      const childPath = path__namespace.join(dirPath, entry2.name);
      return buildFileTree(childPath, maxDepth, currentDepth + 1);
    });
    node.children = await Promise.all(childPromises);
  } catch (error2) {
    log.error(`Error reading directory ${dirPath}:`, error2);
  }
  return node;
}
const __dirname$1 = path$e.dirname(node_url.fileURLToPath(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("main.js", document.baseURI).href));
log.transports.file.level = "info";
log.info("Application starting...");
let mainWindow = null;
const isDev = process.env.NODE_ENV === "development" || !electron.app.isPackaged;
const gotTheLock = electron.app.requestSingleInstanceLock();
if (!gotTheLock) {
  electron.app.quit();
} else {
  electron.app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: "Desktop Project Explorer",
    webPreferences: {
      preload: path$e.join(__dirname$1, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  if (isDev) {
    const port = process.env.VITE_DEV_SERVER_PORT || "5173";
    mainWindow.loadURL(`http://localhost:${port}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path$e.join(__dirname$1, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  log.info("Main window created");
}
async function initializeApp() {
  try {
    const store = getStore();
    await store.initialize();
    log.info("Store initialized successfully");
    const projects = await store.getAllProjects();
    const searchIndex = getSearchIndex();
    searchIndex.buildIndex(projects);
    log.info(`Search index built with ${projects.length} projects`);
    setupIPCHandlers();
  } catch (error2) {
    log.error("Failed to initialize app:", error2);
    throw error2;
  }
}
electron.app.whenReady().then(async () => {
  await initializeApp();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
process.on("uncaughtException", (error2) => {
  log.error("Uncaught exception:", error2);
});
process.on("unhandledRejection", (reason) => {
  log.error("Unhandled rejection:", reason);
});
