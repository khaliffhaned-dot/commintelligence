var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
if (!("__unenv__" in performance)) {
  const proto = Performance.prototype;
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key !== "constructor" && !(key in performance)) {
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (desc) {
        Object.defineProperty(performance, key, desc);
      }
    }
  }
}
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// ../../AppData/Roaming/npm/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert: assert2,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime3,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../../AppData/Roaming/npm/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// _lib/intel.js
var SECTORS = [
  "Banking & Finance",
  "Energy & Utilities",
  "Plantation & Agriculture",
  "Technology & Digital",
  "Telecom & Media",
  "Property & Construction",
  "Manufacturing & Trade",
  "Healthcare",
  "Education",
  "Transport & Logistics",
  "Retail & Consumer",
  "Tourism & Hospitality",
  "Environment & Climate",
  "Politics & Government",
  "Other"
];
var PARTIES = ["BN", "PH", "PN", "GPS", "GRS", "Other", "None"];
var SENTIMENTS = ["Positive", "Neutral", "Negative"];
var AUDIENCES = ["Government & Regulators", "Business & Industry", "Investors & Markets", "Consumers & Public", "Civil Society & NGOs", "Workforce & Unions", "General public interest"];
var METRICS = {
  volume: "Coverage volume (articles)",
  positive_share: "Positive share of coverage (%)",
  negative_share: "Negative share of coverage (%)",
  net_sentiment: "Net sentiment (-100 to +100)",
  share_of_voice: "Share of voice (%)"
};
var FEEDS = [
  { name: "Free Malaysia Today", url: "https://www.freemalaysiatoday.com/feed" },
  { name: "Free Malaysia Today", url: "https://www.freemalaysiatoday.com/category/nation/feed" },
  { name: "Free Malaysia Today", url: "https://www.freemalaysiatoday.com/category/business/feed" },
  { name: "Free Malaysia Today", url: "https://www.freemalaysiatoday.com/category/highlight/feed" },
  { name: "New Straits Times", url: "https://www.nst.com.my/feed" },
  { name: "Malaysiakini", url: "https://www.malaysiakini.com/rss/en/news.rss" }
];
var ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };
var decode = /* @__PURE__ */ __name((s) => s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m]), "decode");
var unwrap = /* @__PURE__ */ __name((s) => decode(s.replace(/^<!\[CDATA\[|\]\]>$/g, "").trim()), "unwrap");
var tag = /* @__PURE__ */ __name((block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? unwrap(m[1]) : "";
}, "tag");
function parseRss(xml, limit = 10, defaultSource = "Unknown") {
  const out = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const source = tag(block, "source");
    let title2 = tag(block, "title");
    if (source && title2.endsWith(` - ${source}`)) title2 = title2.slice(0, -(source.length + 3));
    const url = tag(block, "link");
    const published = Date.parse(tag(block, "pubDate"));
    if (!title2 || !url || Number.isNaN(published)) continue;
    out.push({ title: title2, url, source: source || defaultSource, publishedAt: Math.floor(published / 1e3) });
    if (out.length >= limit) break;
  }
  return out;
}
__name(parseRss, "parseRss");
async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256, "sha256");
function extractJson(text) {
  const cleaned = String(text || "").replace(/```(?:json)?/gi, "").trim();
  const s = cleaned.indexOf("{");
  const e = cleaned.lastIndexOf("}");
  if (s === -1 || e <= s) throw new Error("no JSON object");
  return JSON.parse(cleaned.slice(s, e + 1));
}
__name(extractJson, "extractJson");
var json = /* @__PURE__ */ __name((body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } }), "json");

// _lib/auth.js
var PBKDF2_ITERATIONS = 1e5;
var SESSION_DAYS = 30;
var COOKIE_NAME = "session";
var toHex = /* @__PURE__ */ __name((buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""), "toHex");
var fromHex = /* @__PURE__ */ __name((hex) => new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16))), "fromHex");
async function hashPassword(password, saltHex) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return { hash: toHex(bits), salt: toHex(salt) };
}
__name(hashPassword, "hashPassword");
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
__name(timingSafeEqual, "timingSafeEqual");
async function verifyPassword(password, user) {
  const { hash } = await hashPassword(password, user ? user.salt : "00".repeat(16));
  return !!user && timingSafeEqual(hash, user.password_hash);
}
__name(verifyPassword, "verifyPassword");
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(newToken, "newToken");
function sessionCookie(token, maxAgeSeconds) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}
__name(sessionCookie, "sessionCookie");
function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}
__name(readCookie, "readCookie");
async function createSession(env2, userId, orgId) {
  const token = newToken();
  const now = Math.floor(Date.now() / 1e3);
  await env2.DB.prepare("INSERT INTO sessions (token_hash, user_id, org_id, created_at, expires_at) VALUES (?,?,?,?,?)").bind(await sha256(token), userId, orgId, now, now + SESSION_DAYS * 86400).run();
  return token;
}
__name(createSession, "createSession");
async function getAuth(request, env2) {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;
  const row = await env2.DB.prepare(
    `SELECT u.id AS userId, u.email, u.name, o.id AS orgId, o.name AS orgName, m.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN orgs o ON o.id = s.org_id
         JOIN memberships m ON m.user_id = s.user_id AND m.org_id = s.org_id
         WHERE s.token_hash = ? AND s.expires_at > ?`
  ).bind(await sha256(token), Math.floor(Date.now() / 1e3)).first();
  if (!row) return null;
  return { user: { id: row.userId, email: row.email, name: row.name }, org: { id: row.orgId, name: row.orgName }, role: row.role };
}
__name(getAuth, "getAuth");
async function allowAttempt(env2, key, max, windowSeconds) {
  const now = Math.floor(Date.now() / 1e3);
  const { n } = await env2.DB.prepare("SELECT COUNT(*) AS n FROM auth_attempts WHERE key = ? AND ts > ?").bind(key, now - windowSeconds).first();
  if (n >= max) return false;
  await env2.DB.prepare("INSERT INTO auth_attempts (key, ts) VALUES (?, ?)").bind(key, now).run();
  return true;
}
__name(allowAttempt, "allowAttempt");
async function pruneExpired(env2) {
  const now = Math.floor(Date.now() / 1e3);
  await env2.DB.batch([
    env2.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    env2.DB.prepare("DELETE FROM auth_attempts WHERE ts <= ?").bind(now - 86400)
  ]);
}
__name(pruneExpired, "pruneExpired");
var clientIp = /* @__PURE__ */ __name((request) => request.headers.get("CF-Connecting-IP") || "unknown", "clientIp");
var validEmail = /* @__PURE__ */ __name((e) => typeof e === "string" && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e), "validEmail");

// api/auth/admin.js
var ADMIN_EMAIL = "admin@prvail.local";
async function onRequestPost({ request, env: env2 }) {
  if (!env2.ADMIN_PASSCODE) return json({ error: "Admin access is not enabled." }, 404);
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }
  const passcode = String(b.passcode || "");
  if (!passcode || passcode.length > 100) return json({ error: "Incorrect passcode." }, 401);
  if (!await allowAttempt(env2, `admin-ip:${clientIp(request)}`, 5, 900) || !await allowAttempt(env2, "admin-global", 30, 3600)) {
    return json({ error: "Too many attempts. Try again later." }, 429);
  }
  const [given, wanted] = await Promise.all([sha256(passcode), sha256(String(env2.ADMIN_PASSCODE))]);
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ wanted.charCodeAt(i);
  if (diff !== 0) return json({ error: "Incorrect passcode." }, 401);
  let user = await env2.DB.prepare("SELECT id FROM users WHERE email = ?").bind(ADMIN_EMAIL).first();
  let org;
  if (!user) {
    const now = Math.floor(Date.now() / 1e3);
    const userId = crypto.randomUUID(), orgId = crypto.randomUUID();
    const { hash, salt } = await hashPassword(crypto.randomUUID() + crypto.randomUUID());
    await env2.DB.batch([
      env2.DB.prepare("INSERT INTO users (id, email, name, password_hash, salt, created_at) VALUES (?,?,?,?,?,?)").bind(userId, ADMIN_EMAIL, "Admin", hash, salt, now),
      env2.DB.prepare("INSERT INTO orgs (id, name, created_at) VALUES (?,?,?)").bind(orgId, "Admin Workspace", now),
      env2.DB.prepare("INSERT INTO memberships (user_id, org_id, role) VALUES (?,?,'owner')").bind(userId, orgId)
    ]);
    user = { id: userId };
    org = { id: orgId, name: "Admin Workspace" };
  } else {
    org = await env2.DB.prepare("SELECT o.id, o.name FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY o.created_at LIMIT 1").bind(user.id).first();
  }
  const token = await createSession(env2, user.id, org.id);
  return json(
    { ok: true, user: { email: ADMIN_EMAIL, name: "Admin" }, org, role: "owner" },
    200,
    { "Set-Cookie": sessionCookie(token, SESSION_DAYS * 86400) }
  );
}
__name(onRequestPost, "onRequestPost");

// api/auth/login.js
async function onRequestPost2({ request, env: env2 }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  if (!validEmail(email) || !password || password.length > 200) return json({ error: "Incorrect email or password." }, 401);
  const ip = clientIp(request);
  if (!await allowAttempt(env2, `login-ip:${ip}`, 20, 900) || !await allowAttempt(env2, `login-email:${email}`, 8, 900)) {
    return json({ error: "Too many attempts. Wait 15 minutes and try again." }, 429);
  }
  const user = await env2.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  const ok = await verifyPassword(password, user);
  if (!ok) return json({ error: "Incorrect email or password." }, 401);
  const membership = await env2.DB.prepare(
    `SELECT o.id, o.name, m.role FROM memberships m JOIN orgs o ON o.id = m.org_id
         WHERE m.user_id = ? ORDER BY o.created_at LIMIT 1`
  ).bind(user.id).first();
  if (!membership) return json({ error: "This account has no organisation." }, 403);
  const token = await createSession(env2, user.id, membership.id);
  return json(
    { ok: true, user: { email: user.email, name: user.name }, org: { id: membership.id, name: membership.name }, role: membership.role },
    200,
    { "Set-Cookie": sessionCookie(token, SESSION_DAYS * 86400) }
  );
}
__name(onRequestPost2, "onRequestPost");

// api/auth/logout.js
async function onRequestPost3({ request, env: env2 }) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (m) await env2.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(m[1])).run();
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
}
__name(onRequestPost3, "onRequestPost");

// api/auth/me.js
async function onRequestGet({ request, env: env2 }) {
  const auth = await getAuth(request, env2);
  if (!auth) return json({ authenticated: false }, 200, { "Cache-Control": "no-store" });
  return json({ authenticated: true, ...auth }, 200, { "Cache-Control": "no-store" });
}
__name(onRequestGet, "onRequestGet");

// api/auth/signup.js
async function onRequestPost4({ request, env: env2 }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }
  if (env2.SIGNUP_CODE && b.code !== env2.SIGNUP_CODE) return json({ error: "A valid invite code is required to sign up." }, 403);
  if (!await allowAttempt(env2, `signup:${clientIp(request)}`, 5, 3600)) {
    return json({ error: "Too many sign-ups from this network. Try again later." }, 429);
  }
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  const name = String(b.name || "").trim().slice(0, 80);
  const orgName = String(b.orgName || "").trim().slice(0, 80);
  if (!validEmail(email)) return json({ error: "Enter a valid email address." }, 400);
  if (email.endsWith("@prvail.local")) return json({ error: "That email domain is reserved." }, 400);
  if (password.length < 10) return json({ error: "Password must be at least 10 characters." }, 400);
  if (password.length > 200) return json({ error: "Password is too long." }, 400);
  if (orgName.length < 2) return json({ error: "Enter your organisation name." }, 400);
  const existing = await env2.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return json({ error: "An account with this email already exists. Try signing in." }, 409);
  const now = Math.floor(Date.now() / 1e3);
  const userId = crypto.randomUUID(), orgId = crypto.randomUUID();
  const { hash, salt } = await hashPassword(password);
  await env2.DB.batch([
    env2.DB.prepare("INSERT INTO users (id, email, name, password_hash, salt, created_at) VALUES (?,?,?,?,?,?)").bind(userId, email, name, hash, salt, now),
    env2.DB.prepare("INSERT INTO orgs (id, name, created_at) VALUES (?,?,?)").bind(orgId, orgName, now),
    env2.DB.prepare("INSERT INTO memberships (user_id, org_id, role) VALUES (?,?,'owner')").bind(userId, orgId)
  ]);
  const token = await createSession(env2, userId, orgId);
  await pruneExpired(env2);
  return json(
    { ok: true, user: { email, name }, org: { id: orgId, name: orgName }, role: "owner" },
    200,
    { "Set-Cookie": sessionCookie(token, SESSION_DAYS * 86400) }
  );
}
__name(onRequestPost4, "onRequestPost");

// api/ai.js
var DEFAULT_TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
var DEFAULT_VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
var json2 = /* @__PURE__ */ __name((body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }), "json");
function extractJson2(text) {
  const cleaned = String(text || "").replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object");
  return JSON.parse(cleaned.slice(start, end + 1));
}
__name(extractJson2, "extractJson");
async function onRequestPost5({ request, env: env2 }) {
  if (!env2.AI) {
    return json2({ error: 'Workers AI is not bound. Deploy with wrangler.jsonc (ai.binding = "AI") or add a Workers AI binding named AI in the Pages dashboard.' }, 500);
  }
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json2({ error: "Request body must be JSON." }, 400);
  }
  const { prompt, imageParts } = payload || {};
  if (!prompt || typeof prompt !== "string") {
    return json2({ error: 'Missing or invalid "prompt" in request.' }, 400);
  }
  const messages = [
    { role: "system", content: "You are an analyst. Reply with a single valid JSON object only: no markdown, no commentary." },
    { role: "user", content: prompt }
  ];
  const isVision = Array.isArray(imageParts) && imageParts.length > 0;
  let out;
  try {
    if (isVision) {
      const img = imageParts[0];
      out = await env2.AI.run(env2.AI_VISION_MODEL || DEFAULT_VISION_MODEL, {
        messages,
        image: `data:${img.mimeType};base64,${img.data}`,
        max_tokens: 2048
      });
    } else {
      out = await env2.AI.run(env2.AI_TEXT_MODEL || DEFAULT_TEXT_MODEL, { messages, max_tokens: 2048 });
    }
  } catch (e) {
    console.error("Workers AI error", e && e.message);
    return json2({ error: "Workers AI request failed. See the function logs; the model may need its license accepted or the daily free allowance may be used up." }, 502);
  }
  const raw = out && out.response !== void 0 ? out.response : out;
  if (raw && typeof raw === "object") return json2({ result: raw });
  try {
    return json2({ result: extractJson2(raw) });
  } catch {
    return json2({ error: "The model did not return valid JSON.", raw: String(raw).slice(0, 500) }, 502);
  }
}
__name(onRequestPost5, "onRequestPost");

// api/feed.js
async function onRequestGet2({ request, env: env2 }) {
  if (!env2.DB) return json({ error: "Missing D1 (DB) binding." }, 500);
  const u = new URL(request.url);
  const where = [];
  const args = [];
  const sector = u.searchParams.get("sector");
  const party = u.searchParams.get("party");
  const sentiment = u.searchParams.get("sentiment");
  if (sector && SECTORS.includes(sector)) {
    where.push("sector = ?");
    args.push(sector);
  }
  if (party && PARTIES.includes(party)) {
    where.push("party = ?");
    args.push(party);
  }
  if (sentiment && SENTIMENTS.includes(sentiment)) {
    where.push("sentiment = ?");
    args.push(sentiment);
  }
  const audience = u.searchParams.get("audience");
  if (audience && AUDIENCES.includes(audience)) {
    where.push("audience = ?");
    args.push(audience);
  }
  const limit = Math.min(Math.max(parseInt(u.searchParams.get("limit") || "50", 10) || 50, 1), 200);
  const { results } = await env2.DB.prepare(
    `SELECT id, title, url, source, published_at AS publishedAt, sector, party, sentiment, audience, classified
         FROM items ${where.length ? "WHERE " + where.join(" AND ") : ""}
         ORDER BY published_at DESC LIMIT ?`
  ).bind(...args, limit).all();
  const last = await env2.DB.prepare("SELECT value FROM meta WHERE key = 'last_pull'").first();
  const total = await env2.DB.prepare("SELECT COUNT(*) AS n FROM items").first();
  return json({ items: results, lastPull: last ? Number(last.value) : null, total: total.n }, 200, { "Cache-Control": "no-store" });
}
__name(onRequestGet2, "onRequestGet");

// _lib/measure.js
var POLITICAL_PARTIES = ["BN", "PH", "PN", "GPS", "GRS"];
async function computeObjective(db, obj) {
  const since = Math.floor(Date.now() / 1e3) - obj.days * 86400;
  const where = ["published_at >= ?", "classified = 1"];
  const args = [since];
  if (obj.party) {
    where.push("party = ?");
    args.push(obj.party);
  }
  if (obj.sector) {
    where.push("sector = ?");
    args.push(obj.sector);
  }
  if (obj.audience) {
    where.push("audience = ?");
    args.push(obj.audience);
  }
  const row = await db.prepare(
    `SELECT COUNT(*) AS n,
                SUM(CASE WHEN sentiment = 'Positive' THEN 1 ELSE 0 END) AS pos,
                SUM(CASE WHEN sentiment = 'Negative' THEN 1 ELSE 0 END) AS neg
         FROM items WHERE ${where.join(" AND ")}`
  ).bind(...args).first();
  const n = row.n || 0, pos = row.pos || 0, neg = row.neg || 0;
  let denominator = n;
  if (obj.metric === "share_of_voice") {
    const scope = obj.party ? `AND party IN (${POLITICAL_PARTIES.map(() => "?").join(",")})` : "";
    const d = await db.prepare(`SELECT COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 ${scope}`).bind(since, ...obj.party ? POLITICAL_PARTIES : []).first();
    denominator = d.n || 0;
  }
  let value = null;
  if (obj.metric === "volume") value = n;
  else if (n > 0) {
    if (obj.metric === "positive_share") value = pos / n * 100;
    else if (obj.metric === "negative_share") value = neg / n * 100;
    else if (obj.metric === "net_sentiment") value = (pos - neg) / n * 100;
    else if (obj.metric === "share_of_voice") value = denominator ? n / denominator * 100 : null;
  }
  if (value !== null) value = Math.round(value * 10) / 10;
  return { value, sampleSize: n, status: statusFor(obj, value) };
}
__name(computeObjective, "computeObjective");
function statusFor(obj, value) {
  if (value === null) return "No data";
  const slack = Math.max(Math.abs(obj.target) * 0.3, 5);
  if (obj.comparator === "atleast") return value >= obj.target ? "Met" : value >= obj.target - slack ? "On track" : "Behind";
  return value <= obj.target ? "Met" : value <= obj.target + slack ? "On track" : "Behind";
}
__name(statusFor, "statusFor");

// api/objectives.js
var MAX_OBJECTIVES = 50;
async function onRequestGet3({ env: env2, data }) {
  if (!env2.DB) return json({ error: "Missing D1 (DB) binding." }, 500);
  const { results } = await env2.DB.prepare("SELECT * FROM objectives WHERE org_id = ? ORDER BY created_at DESC").bind(data.auth.org.id).all();
  const withValues = await Promise.all(results.map(async (o) => ({ ...o, ...await computeObjective(env2.DB, o) })));
  return json({ objectives: withValues }, 200, { "Cache-Control": "no-store" });
}
__name(onRequestGet3, "onRequestGet");
async function onRequestPost6({ request, env: env2, data }) {
  if (!env2.DB) return json({ error: "Missing D1 (DB) binding." }, 500);
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }
  const name = String(b.name || "").trim().slice(0, 120);
  const target = Number(b.target);
  const days = Math.round(Number(b.days));
  const party = b.party || null, sector = b.sector || null, audience = b.audience || null;
  if (!name) return json({ error: "Give the objective a name." }, 400);
  if (!Object.keys(METRICS).includes(b.metric)) return json({ error: "Unknown metric." }, 400);
  if (!["atleast", "atmost"].includes(b.comparator)) return json({ error: "Comparator must be atleast or atmost." }, 400);
  if (!Number.isFinite(target)) return json({ error: "Target must be a number." }, 400);
  if (!(days >= 1 && days <= 90)) return json({ error: "Window must be 1-90 days." }, 400);
  if (party && !PARTIES.includes(party)) return json({ error: "Unknown party." }, 400);
  if (sector && !SECTORS.includes(sector)) return json({ error: "Unknown sector." }, 400);
  if (audience && !AUDIENCES.includes(audience)) return json({ error: "Unknown audience." }, 400);
  const count3 = await env2.DB.prepare("SELECT COUNT(*) AS n FROM objectives WHERE org_id = ?").bind(data.auth.org.id).first();
  if (count3.n >= MAX_OBJECTIVES) return json({ error: `Limit of ${MAX_OBJECTIVES} objectives reached.` }, 400);
  const id = crypto.randomUUID();
  await env2.DB.prepare(
    "INSERT INTO objectives (id, org_id, name, metric, comparator, target, party, sector, audience, days, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(id, data.auth.org.id, name, b.metric, b.comparator, target, party, sector, audience, days, Math.floor(Date.now() / 1e3)).run();
  return json({ ok: true, id });
}
__name(onRequestPost6, "onRequestPost");
async function onRequestDelete({ request, env: env2, data }) {
  if (!env2.DB) return json({ error: "Missing D1 (DB) binding." }, 500);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "Missing id." }, 400);
  await env2.DB.prepare("DELETE FROM objectives WHERE id = ? AND org_id = ?").bind(id, data.auth.org.id).run();
  return json({ ok: true });
}
__name(onRequestDelete, "onRequestDelete");

// api/overview.js
async function onRequestGet4({ env: env2, data }) {
  const now = Math.floor(Date.now() / 1e3);
  const d1 = now - 86400, d2 = now - 2 * 86400, d7 = now - 7 * 86400, d14 = now - 14 * 86400;
  const one = /* @__PURE__ */ __name((sql, ...a) => env2.DB.prepare(sql).bind(...a).first(), "one");
  const all = /* @__PURE__ */ __name((sql, ...a) => env2.DB.prepare(sql).bind(...a).all().then((r) => r.results), "all");
  const since = await one("SELECT MIN(fetched_at) AS t FROM items");
  const [last24, prev24, mix, parties, trend, sectors, latest, sources, lastPull, quality, objectivesRaw] = await Promise.all([
    one("SELECT COUNT(*) AS n FROM items WHERE published_at >= ?", d1),
    one("SELECT COUNT(*) AS n FROM items WHERE published_at >= ? AND published_at < ?", d2, d1),
    all("SELECT sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 GROUP BY sentiment", d7),
    all("SELECT party, sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 AND party IN ('BN','PH','PN','GPS','GRS') GROUP BY party, sentiment", d7),
    all("SELECT date(published_at, 'unixepoch') AS day, COUNT(*) AS n, SUM(CASE WHEN sentiment='Positive' THEN 1 ELSE 0 END) AS pos, SUM(CASE WHEN sentiment='Negative' THEN 1 ELSE 0 END) AS neg FROM items WHERE published_at >= ? AND classified = 1 GROUP BY day ORDER BY day", d14),
    all("SELECT sector, sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 AND sector IS NOT NULL GROUP BY sector, sentiment", d7),
    all("SELECT title, url, source, published_at AS publishedAt, sector, party, sentiment FROM items ORDER BY published_at DESC LIMIT 8"),
    all("SELECT source, COUNT(*) AS n FROM items WHERE published_at >= ? GROUP BY source ORDER BY n DESC LIMIT 6", d7),
    one("SELECT value FROM meta WHERE key = 'last_pull'"),
    one("SELECT COUNT(*) AS total, SUM(classified) AS tagged FROM items WHERE published_at >= ?", d7),
    env2.DB.prepare("SELECT * FROM objectives WHERE org_id = ?").bind(data.auth.org.id).all().then((r) => r.results)
  ]);
  const objectives = await Promise.all(objectivesRaw.map(async (o) => ({ ...o, ...await computeObjective(env2.DB, o) })));
  return json({
    generatedAt: now,
    collectingSince: since && since.t ? since.t : null,
    articles24h: last24.n,
    articlesPrev24h: prev24.n,
    sentimentMix: Object.fromEntries(["Positive", "Neutral", "Negative"].map((s) => [s, (mix.find((r) => r.sentiment === s) || {}).n || 0])),
    parties,
    trend,
    sectors,
    latest,
    sources,
    lastPull: lastPull ? Number(lastPull.value) : null,
    quality: { total: quality.total, tagged: quality.tagged || 0 },
    objectives: { total: objectives.length, met: objectives.filter((o) => o.status === "Met").length, behind: objectives.filter((o) => o.status === "Behind").length }
  }, 200, { "Cache-Control": "no-store" });
}
__name(onRequestGet4, "onRequestGet");

// _lib/classify.js
var TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
async function classify(env2, batch, kind = "news headlines") {
  const list = batch.map((it, i) => `${i}. ${String(it.text).replace(/\s+/g, " ").slice(0, 300)}`).join("\n");
  const prompt = `Classify these Malaysian ${kind}. They may be in English, Malay, Chinese, Tamil or mixed ("rojak").
For each, return:
- "sector": one of ${JSON.stringify(SECTORS)}
- "party": the Malaysian political coalition the text is mainly about, one of ${JSON.stringify(PARTIES)} (BN, PH, PN, GPS, GRS, Other = another political party/figure, None = not political)
- "sentiment": tone toward the main subject, one of ${JSON.stringify(SENTIMENTS)}
- "audience": the stakeholder audience it chiefly concerns, one of ${JSON.stringify(AUDIENCES)}
Texts:
${list}
Return only JSON: {"results":[{"i":0,"sector":"...","party":"...","sentiment":"...","audience":"..."}]}`;
  const out = await env2.AI.run(env2.AI_TEXT_MODEL || TEXT_MODEL, {
    messages: [
      { role: "system", content: "You are a precise media analyst for Malaysia. Reply with one valid JSON object only." },
      { role: "user", content: prompt }
    ],
    max_tokens: 2048
  });
  const raw = out && out.response !== void 0 ? out.response : out;
  const parsed = raw && typeof raw === "object" ? raw : extractJson(raw);
  const results = Array.isArray(parsed.results) ? parsed.results : [];
  const byIndex = new Map(results.map((r) => [Number(r.i), r]));
  return batch.map((_, i) => {
    const r = byIndex.get(i) || {};
    return {
      sector: SECTORS.includes(r.sector) ? r.sector : null,
      party: PARTIES.includes(r.party) ? r.party : null,
      sentiment: SENTIMENTS.includes(r.sentiment) ? r.sentiment : null,
      audience: AUDIENCES.includes(r.audience) ? r.audience : null
    };
  });
}
__name(classify, "classify");

// _lib/gnews.js
var CALLS = [
  { country: "my", lang: "en", category: "general" },
  { country: "my", lang: "en", category: "business" },
  { country: "my", lang: "zh", category: "general" },
  { country: "my", lang: "ta", category: "general" }
];
var MY_OUTLETS = [
  "the star",
  "the edge",
  "new straits times",
  "free malaysia today",
  "malaysiakini",
  "malay mail",
  "bernama",
  "sinar",
  "the sun",
  "astro awani",
  "the vibes",
  "focus malaysia",
  "lowyat",
  "soyacincau",
  "paul tan",
  "berita harian",
  "harian metro",
  "utusan",
  "kosmo",
  "sin chew",
  "china press",
  "oriental daily",
  "nanban",
  "tamil nesan",
  "malaysian reserve",
  "theedgemalaysia",
  "thestar",
  "dailyexpress",
  "borneo post",
  "new sarawak tribune"
];
var MY_TERMS = /\b(malaysia|malaysian|malaysians|kuala lumpur|putrajaya|selangor|johor|penang|sarawak|sabah|kelantan|terengganu|perak|pahang|kedah|melaka|negeri sembilan|labuan|petaling jaya|anwar ibrahim|umno|pkr|bersatu|dewan rakyat|dewan negara|ringgit|bursa malaysia|petronas|tenaga nasional|maybank|cimb|khazanah|proton|perodua|mcmc|bank negara|madani)\b/i;
function isMalaysiaRelevant(article) {
  const source = String(article.source && article.source.name || "").toLowerCase();
  if (MY_OUTLETS.some((o) => source.includes(o))) return true;
  return MY_TERMS.test(`${article.title || ""} ${article.description || ""}`);
}
__name(isMalaysiaRelevant, "isMalaysiaRelevant");
var gnewsConfigured = /* @__PURE__ */ __name((env2) => !!env2.GNEWS_API_KEY, "gnewsConfigured");
async function fetchGNews(env2) {
  const out = { articles: [], errors: [], filteredOut: 0 };
  for (let i = 0; i < CALLS.length; i++) {
    if (i) await new Promise((r) => setTimeout(r, 1100));
    const qs = new URLSearchParams({ ...CALLS[i], max: "10" });
    try {
      const res = await fetch(`https://gnews.io/api/v4/top-headlines?${qs}`, { headers: { "X-Api-Key": env2.GNEWS_API_KEY } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const first = Array.isArray(body.errors) ? body.errors[0] : Object.values(body.errors || {})[0];
        out.errors.push(`HTTP ${res.status}: ${String(first || "request failed").slice(0, 120)}`);
        if ([400, 401, 403].includes(res.status)) break;
        continue;
      }
      for (const a of body.articles || []) {
        const published = Date.parse(a.publishedAt);
        if (!a.title || !a.url || Number.isNaN(published)) continue;
        if (!isMalaysiaRelevant(a)) {
          out.filteredOut++;
          continue;
        }
        out.articles.push({ title: a.title, url: a.url, source: a.source && a.source.name || "GNews", publishedAt: Math.floor(published / 1e3), feed: "gnews" });
      }
    } catch (e) {
      out.errors.push(`request failed: ${e.message}`);
    }
  }
  out.errors = [...new Set(out.errors)].slice(0, 3);
  return out;
}
__name(fetchGNews, "fetchGNews");

// api/pull.js
var COOLDOWN_SECONDS = 60;
var MAX_CLASSIFY_PER_PULL = 72;
var BATCH = 12;
var GNEWS_COOLDOWN_SECONDS = 5400;
async function onRequestPost7({ env: env2 }) {
  if (!env2.DB || !env2.AI) return json({ error: "Missing D1 (DB) or Workers AI (AI) binding." }, 500);
  const now = Math.floor(Date.now() / 1e3);
  const last = await env2.DB.prepare("SELECT value FROM meta WHERE key = 'last_pull'").first();
  const age = last ? now - Number(last.value) : Infinity;
  if (age < COOLDOWN_SECONDS) {
    return json({ skipped: true, nextPullInSeconds: Math.ceil(COOLDOWN_SECONDS - age) });
  }
  await env2.DB.prepare("INSERT INTO meta (key, value) VALUES ('last_pull', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(now)).run();
  const fetched = await Promise.allSettled(FEEDS.map(async (f) => {
    const res = await fetch(f.url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; MalaysiaIntel/1.0)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseRss(await res.text(), 50, f.name).map((it) => ({ ...it, feed: f.url }));
  }));
  const failed = fetched.filter((r) => r.status === "rejected");
  const feedErrorSamples = [...new Set(failed.map((r) => String(r.reason && r.reason.message)))].slice(0, 3);
  const articles = fetched.flatMap((r) => r.status === "fulfilled" ? r.value : []);
  let gnews = { configured: false };
  if (gnewsConfigured(env2)) {
    const lg = await env2.DB.prepare("SELECT value FROM meta WHERE key = 'last_gnews'").first();
    if (lg && now - Number(lg.value) < GNEWS_COOLDOWN_SECONDS) {
      gnews = { configured: true, skipped: true, nextInSeconds: GNEWS_COOLDOWN_SECONDS - (now - Number(lg.value)) };
    } else {
      await env2.DB.prepare("INSERT INTO meta (key, value) VALUES ('last_gnews', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(now)).run();
      const g = await fetchGNews(env2);
      articles.push(...g.articles);
      gnews = { configured: true, found: g.articles.length, filteredOut: g.filteredOut, errors: g.errors };
    }
  }
  const unique = /* @__PURE__ */ new Map();
  for (const a of articles) {
    const id = await sha256(a.url);
    if (!unique.has(id)) unique.set(id, { ...a, id });
  }
  const ids = [...unique.keys()];
  const known = /* @__PURE__ */ new Set();
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const { results } = await env2.DB.prepare(`SELECT id FROM items WHERE id IN (${chunk.map(() => "?").join(",")})`).bind(...chunk).all();
    results.forEach((r) => known.add(r.id));
  }
  const fresh = [...unique.values()].filter((a) => !known.has(a.id));
  if (fresh.length) {
    const stmt = env2.DB.prepare(`INSERT OR IGNORE INTO items
            (id, title, url, source, published_at, fetched_at, query, classified) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`);
    for (let i = 0; i < fresh.length; i += 50) {
      await env2.DB.batch(fresh.slice(i, i + 50).map((a) => stmt.bind(a.id, a.title, a.url, a.source, a.publishedAt, now, a.feed)));
    }
  }
  const { results: pending } = await env2.DB.prepare(
    "SELECT id, title FROM items WHERE classified = 0 OR audience IS NULL ORDER BY published_at DESC LIMIT ?"
  ).bind(MAX_CLASSIFY_PER_PULL).all();
  let tagged = 0, aiFailures = 0;
  const update = env2.DB.prepare("UPDATE items SET sector = ?, party = ?, sentiment = ?, audience = ?, classified = 1 WHERE id = ?");
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    try {
      const tags = await classify(env2, batch.map((b) => ({ text: b.title })));
      await env2.DB.batch(batch.map((it, j) => update.bind(tags[j].sector, tags[j].party, tags[j].sentiment, tags[j].audience, it.id)));
      tagged += batch.length;
    } catch (e) {
      aiFailures++;
      console.error("classify failed", e && e.message);
    }
  }
  const left = await env2.DB.prepare("SELECT COUNT(*) AS n FROM items WHERE classified = 0 OR audience IS NULL").first();
  return json({
    ok: true,
    fetchedFeeds: FEEDS.length - failed.length,
    failedFeeds: failed.length,
    gnews,
    feedErrorSamples,
    newItems: fresh.length,
    tagged,
    untaggedRemaining: left.n,
    aiFailures
  });
}
__name(onRequestPost7, "onRequestPost");

// _lib/social.js
var clean = /* @__PURE__ */ __name((s, n = 300) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim().slice(0, n), "clean");
var youtubeConfigured = /* @__PURE__ */ __name((env2) => !!(env2.YOUTUBE_API_KEY && (env2.YOUTUBE_CHANNEL_HANDLES || "").trim()), "youtubeConfigured");
var redditConfigured = /* @__PURE__ */ __name((env2) => !!(env2.REDDIT_CLIENT_ID && env2.REDDIT_CLIENT_SECRET), "redditConfigured");
async function yt(path, key) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${body.error && body.error.message || "request failed"}`.replace(key, "***"));
  return body;
}
__name(yt, "yt");
async function fetchYouTube(env2) {
  if (!youtubeConfigured(env2)) return { configured: false, posts: [], errors: [] };
  const key = env2.YOUTUBE_API_KEY;
  const handles = env2.YOUTUBE_CHANNEL_HANDLES.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8);
  const posts = [], errors = [];
  await Promise.all(handles.map(async (handle) => {
    try {
      const at = handle.startsWith("@") ? handle : `@${handle}`;
      const meta = /* @__PURE__ */ __name(async (k) => (await env2.DB.prepare("SELECT value FROM meta WHERE key = ?").bind(k).first())?.value, "meta");
      let uploads = await meta(`yt_uploads:${at}`), label = await meta(`yt_label:${at}`);
      if (!uploads) {
        const r = await yt(`channels?part=snippet,contentDetails&forHandle=${encodeURIComponent(at)}`, key);
        const ch = r.items && r.items[0];
        if (!ch) throw new Error("channel not found");
        uploads = ch.contentDetails.relatedPlaylists.uploads;
        label = ch.snippet.title;
        await env2.DB.batch([
          env2.DB.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").bind(`yt_uploads:${at}`, uploads),
          env2.DB.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").bind(`yt_label:${at}`, label)
        ]);
      }
      const vids = await yt(`playlistItems?part=snippet&maxResults=3&playlistId=${encodeURIComponent(uploads)}`, key);
      for (const v of vids.items || []) {
        const videoId = v.snippet && v.snippet.resourceId && v.snippet.resourceId.videoId;
        if (!videoId) continue;
        try {
          const c = await yt(`commentThreads?part=snippet&videoId=${encodeURIComponent(videoId)}&maxResults=20&order=time&textFormat=plainText`, key);
          for (const it of c.items || []) {
            const sn = it.snippet && it.snippet.topLevelComment && it.snippet.topLevelComment.snippet;
            if (!sn || !sn.textDisplay) continue;
            posts.push({
              id: `yt:${it.id}`,
              channel: "youtube",
              text: clean(sn.textDisplay),
              url: `https://www.youtube.com/watch?v=${videoId}&lc=${it.id}`,
              publishedAt: Math.floor(Date.parse(sn.publishedAt) / 1e3),
              label: `${label} \xB7 ${clean(v.snippet.title, 80)}`,
              score: sn.likeCount || 0
            });
          }
        } catch (e) {
          errors.push(`${at} video: ${e.message}`);
        }
      }
    } catch (e) {
      errors.push(`${handle}: ${e.message}`);
    }
  }));
  return { configured: true, posts, errors: [...new Set(errors)].slice(0, 4) };
}
__name(fetchYouTube, "fetchYouTube");
async function fetchReddit(env2) {
  if (!redditConfigured(env2)) return { configured: false, posts: [], errors: [] };
  const ua = env2.REDDIT_USER_AGENT || "web:commet-intel:1.0";
  const subs = (env2.REDDIT_SUBREDDITS || "malaysia").split(",").map((s) => s.trim().replace(/^r\//, "")).filter(Boolean).slice(0, 3);
  const posts = [], errors = [];
  try {
    const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${env2.REDDIT_CLIENT_ID}:${env2.REDDIT_CLIENT_SECRET}`)}`, "User-Agent": ua, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials"
    });
    const tok = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tok.access_token) throw new Error(`Reddit auth failed (${tokenRes.status})`);
    for (const sub of subs) {
      try {
        const res = await fetch(`https://oauth.reddit.com/r/${encodeURIComponent(sub)}/new?limit=50&raw_json=1`, { headers: { Authorization: `Bearer ${tok.access_token}`, "User-Agent": ua } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        for (const c of body.data && body.data.children || []) {
          const d = c.data;
          if (!d || d.over_18 || d.stickied) continue;
          posts.push({
            id: `rd:${d.id}`,
            channel: "reddit",
            text: clean(d.selftext ? `${d.title} \u2014 ${d.selftext}` : d.title, 400),
            url: `https://www.reddit.com${d.permalink}`,
            publishedAt: Math.floor(d.created_utc),
            label: `r/${sub}`,
            score: d.score || 0
          });
        }
      } catch (e) {
        errors.push(`r/${sub}: ${e.message}`);
      }
    }
  } catch (e) {
    errors.push(e.message);
  }
  return { configured: true, posts, errors: [...new Set(errors)].slice(0, 4) };
}
__name(fetchReddit, "fetchReddit");

// api/pull-social.js
var COOLDOWN_SECONDS2 = 120;
var RETENTION_DAYS = 14;
var MAX_CLASSIFY_PER_PULL2 = 48;
var BATCH2 = 12;
async function onRequestPost8({ env: env2 }) {
  if (!env2.AI) return json({ error: "Missing Workers AI binding." }, 500);
  const now = Math.floor(Date.now() / 1e3);
  const last = await env2.DB.prepare("SELECT value FROM meta WHERE key = 'last_pull_social'").first();
  const age = last ? now - Number(last.value) : Infinity;
  if (age < COOLDOWN_SECONDS2) return json({ skipped: true, nextPullInSeconds: Math.ceil(COOLDOWN_SECONDS2 - age) });
  await env2.DB.prepare("INSERT INTO meta (key, value) VALUES ('last_pull_social', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(now)).run();
  const [yt2, rd] = await Promise.all([fetchYouTube(env2), fetchReddit(env2)]);
  const status = { youtube: { configured: yt2.configured, found: yt2.posts.length, errors: yt2.errors }, reddit: { configured: rd.configured, found: rd.posts.length, errors: rd.errors } };
  if (!yt2.configured && !rd.configured) return json({ ok: true, configured: false, status, newPosts: 0 });
  const cutoff = now - RETENTION_DAYS * 86400;
  const unique = /* @__PURE__ */ new Map();
  for (const p of [...yt2.posts, ...rd.posts]) if (p.publishedAt >= cutoff && !unique.has(p.id)) unique.set(p.id, p);
  const posts = [...unique.values()];
  let newPosts = 0;
  if (posts.length) {
    const stmt = env2.DB.prepare(`INSERT OR IGNORE INTO social_posts (id, channel, text, url, label, published_at, fetched_at, score, classified) VALUES (?,?,?,?,?,?,?,?,0)`);
    for (let i = 0; i < posts.length; i += 50) {
      const res = await env2.DB.batch(posts.slice(i, i + 50).map((p) => stmt.bind(p.id, p.channel, p.text, p.url, p.label, p.publishedAt, now, p.score)));
      newPosts += res.reduce((n, r) => n + (r.meta && r.meta.changes ? r.meta.changes : 0), 0);
    }
  }
  if (posts.length) {
    const upd = env2.DB.prepare("UPDATE social_posts SET score = ? WHERE id = ?");
    for (let i = 0; i < posts.length; i += 50) await env2.DB.batch(posts.slice(i, i + 50).map((p) => upd.bind(p.score, p.id)));
  }
  const { results: pending } = await env2.DB.prepare("SELECT id, text FROM social_posts WHERE classified = 0 ORDER BY published_at DESC LIMIT ?").bind(MAX_CLASSIFY_PER_PULL2).all();
  let tagged = 0, aiFailures = 0;
  const update = env2.DB.prepare("UPDATE social_posts SET sector = ?, party = ?, sentiment = ?, audience = ?, classified = 1 WHERE id = ?");
  for (let i = 0; i < pending.length; i += BATCH2) {
    const batch = pending.slice(i, i + BATCH2);
    try {
      const tags = await classify(env2, batch, "social media comments and posts");
      await env2.DB.batch(batch.map((it, j) => update.bind(tags[j].sector, tags[j].party, tags[j].sentiment, tags[j].audience, it.id)));
      tagged += batch.length;
    } catch (e) {
      aiFailures++;
      console.error("social classify failed", e && e.message);
    }
  }
  await env2.DB.prepare("DELETE FROM social_posts WHERE published_at < ?").bind(cutoff).run();
  const left = await env2.DB.prepare("SELECT COUNT(*) AS n FROM social_posts WHERE classified = 0").first();
  return json({ ok: true, configured: true, status, newPosts, tagged, untaggedRemaining: left.n, aiFailures });
}
__name(onRequestPost8, "onRequestPost");

// api/report.js
async function onRequestGet5({ request, env: env2, data }) {
  if (!env2.DB) return json({ error: "Missing D1 (DB) binding." }, 500);
  const days = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get("days") || "30", 10) || 30, 1), 90);
  const since = Math.floor(Date.now() / 1e3) - days * 86400;
  const q = /* @__PURE__ */ __name((sql, ...a) => env2.DB.prepare(sql).bind(since, ...a).all().then((r) => r.results), "q");
  const [totals, bySource, bySentiment, byAudience, byParty, quality, objectivesRaw] = await Promise.all([
    q("SELECT COUNT(*) AS articles, COUNT(DISTINCT source) AS sources FROM items WHERE published_at >= ?"),
    q("SELECT source, COUNT(*) AS n FROM items WHERE published_at >= ? GROUP BY source ORDER BY n DESC"),
    q("SELECT sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 GROUP BY sentiment"),
    q("SELECT audience, sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 AND audience IS NOT NULL GROUP BY audience, sentiment"),
    q("SELECT party, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 AND party IN ('BN','PH','PN','GPS','GRS') GROUP BY party"),
    q("SELECT SUM(classified) AS tagged, COUNT(*) AS total, SUM(CASE WHEN audience IS NOT NULL THEN 1 ELSE 0 END) AS withAudience FROM items WHERE published_at >= ?"),
    env2.DB.prepare("SELECT * FROM objectives WHERE org_id = ? ORDER BY created_at DESC").bind(data.auth.org.id).all().then((r) => r.results)
  ]);
  const objectives = await Promise.all(objectivesRaw.map(async (o) => ({ ...o, ...await computeObjective(env2.DB, o) })));
  const social = await env2.DB.prepare("SELECT channel, COUNT(*) AS n FROM social_posts WHERE published_at >= ? GROUP BY channel").bind(since).all().then((x) => x.results);
  const channels = ["Online news", ...social.filter((s) => s.n > 0).map((s) => s.channel === "youtube" ? "YouTube comments" : "Reddit")];
  const mix = Object.fromEntries(["Positive", "Neutral", "Negative"].map((s) => [s, (bySentiment.find((r) => r.sentiment === s) || {}).n || 0]));
  const tagged = mix.Positive + mix.Neutral + mix.Negative;
  const audienceRows = AUDIENCES.map((a) => {
    const rows = byAudience.filter((r) => r.audience === a);
    const n = rows.reduce((s, r) => s + r.n, 0);
    const pos = rows.filter((r) => r.sentiment === "Positive").reduce((s, r) => s + r.n, 0);
    const neg = rows.filter((r) => r.sentiment === "Negative").reduce((s, r) => s + r.n, 0);
    return { audience: a, articles: n, netSentiment: n ? Math.round((pos - neg) / n * 100) : null };
  }).filter((r) => r.articles);
  return json({
    days,
    outputs: { articles: totals[0].articles, sources: totals[0].sources, bySource: bySource.slice(0, 8), channels },
    outcomes: {
      sentimentMix: mix,
      netSentiment: tagged ? Math.round((mix.Positive - mix.Negative) / tagged * 100) : null,
      byAudience: audienceRows,
      shareOfVoiceByParty: byParty
    },
    impact: {
      objectives,
      met: objectives.filter((o) => o.status === "Met").length,
      total: objectives.length
    },
    dataQuality: { total: quality[0].total, tagged: quality[0].tagged || 0, withAudience: quality[0].withAudience || 0 }
  }, 200, { "Cache-Control": "no-store" });
}
__name(onRequestGet5, "onRequestGet");

// api/social.js
async function onRequestGet6({ request, env: env2 }) {
  const u = new URL(request.url);
  const where = [];
  const args = [];
  const channel2 = u.searchParams.get("channel");
  if (channel2 && ["youtube", "reddit"].includes(channel2)) {
    where.push("channel = ?");
    args.push(channel2);
  }
  for (const [param, list, col] of [["sector", SECTORS, "sector"], ["party", PARTIES, "party"], ["sentiment", SENTIMENTS, "sentiment"], ["audience", AUDIENCES, "audience"]]) {
    const v = u.searchParams.get(param);
    if (v && list.includes(v)) {
      where.push(`${col} = ?`);
      args.push(v);
    }
  }
  const limit = Math.min(Math.max(parseInt(u.searchParams.get("limit") || "50", 10) || 50, 1), 200);
  const { results } = await env2.DB.prepare(
    `SELECT id, channel, text, url, label, published_at AS publishedAt, score, sector, party, sentiment, audience, classified
         FROM social_posts ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY published_at DESC LIMIT ?`
  ).bind(...args, limit).all();
  const last = await env2.DB.prepare("SELECT value FROM meta WHERE key = 'last_pull_social'").first();
  const total = await env2.DB.prepare("SELECT COUNT(*) AS n FROM social_posts").first();
  return json({
    items: results,
    total: total.n,
    lastPull: last ? Number(last.value) : null,
    retentionDays: 14,
    configured: { youtube: youtubeConfigured(env2), reddit: redditConfigured(env2) }
  }, 200, { "Cache-Control": "no-store" });
}
__name(onRequestGet6, "onRequestGet");

// api/stats.js
async function onRequestGet7({ request, env: env2 }) {
  if (!env2.DB) return json({ error: "Missing D1 (DB) binding." }, 500);
  const days = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get("days") || "7", 10) || 7, 1), 90);
  const since = Math.floor(Date.now() / 1e3) - days * 86400;
  const q = /* @__PURE__ */ __name((sql) => env2.DB.prepare(sql).bind(since).all().then((r) => r.results), "q");
  const [byParty, bySector, partyDaily, topSources] = await Promise.all([
    q(`SELECT party, sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 AND party IN ('BN','PH','PN','GPS','GRS') GROUP BY party, sentiment`),
    q(`SELECT sector, sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 GROUP BY sector, sentiment`),
    q(`SELECT date(published_at, 'unixepoch') AS day, party, sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 AND party IN ('BN','PH','PN','GPS','GRS') GROUP BY day, party, sentiment ORDER BY day`),
    q(`SELECT source, COUNT(*) AS n FROM items WHERE published_at >= ? GROUP BY source ORDER BY n DESC LIMIT 10`)
  ]);
  return json({ days, byParty, bySector, partyDaily, topSources }, 200, { "Cache-Control": "no-store" });
}
__name(onRequestGet7, "onRequestGet");

// api/_middleware.js
async function onRequest(context2) {
  const { request, env: env2, next, data } = context2;
  const path = new URL(request.url).pathname;
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && request.headers.get("X-Requested-With") !== "fetch") {
    return json({ error: "Forbidden." }, 403);
  }
  if (!env2.DB) return json({ error: "Missing D1 (DB) binding." }, 500);
  if (path.startsWith("/api/auth/")) return next();
  const auth = await getAuth(request, env2);
  if (!auth) return json({ error: "Please sign in." }, 401);
  data.auth = auth;
  return next();
}
__name(onRequest, "onRequest");

// ../.wrangler/tmp/pages-fPF9r7/functionsRoutes-0.25847967405907746.mjs
var routes = [
  {
    routePath: "/api/auth/admin",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/auth/login",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/auth/logout",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/auth/me",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/auth/signup",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/ai",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/feed",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/objectives",
    mountPath: "/api",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/objectives",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/objectives",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/overview",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/pull",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost7]
  },
  {
    routePath: "/api/pull-social",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost8]
  },
  {
    routePath: "/api/report",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/social",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/stats",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/api",
    mountPath: "/api",
    method: "",
    middlewares: [onRequest],
    modules: []
  }
];

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count3 = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count3--;
          if (count3 === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count3++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count3)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode2 = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode2(value, key);
        });
      } else {
        params[key.name] = decode2(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function getOriginalPathPrefix(requestPath, normalizedPrefix) {
  let end = 0;
  for (let index = 0; index < normalizedPrefix.length; index++) {
    end++;
    if (normalizedPrefix[index] === "/") {
      while (requestPath[end] === "/") {
        end++;
      }
    }
  }
  return requestPath.slice(0, end);
}
__name(getOriginalPathPrefix, "getOriginalPathPrefix");
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  const normalizedRequestPath = requestPath.replace(/\/+/g, "/");
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath) || routeMatcher(normalizedRequestPath);
    const originalMountMatch = mountMatcher(requestPath);
    const mountMatchResult = originalMountMatch || mountMatcher(normalizedRequestPath);
    if (matchResult && mountMatchResult) {
      const path = originalMountMatch ? originalMountMatch.path : getOriginalPathPrefix(requestPath, mountMatchResult.path);
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env2, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context2 = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env: env2,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context2);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env2["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error3) {
      if (isFailOpen) {
        const response = await env2["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error3;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } catch (e) {
    const error3 = reduceError(e);
    const body = JSON.stringify(error3);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-xpixLJ/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-xpixLJ/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.3830821430672944.mjs.map
