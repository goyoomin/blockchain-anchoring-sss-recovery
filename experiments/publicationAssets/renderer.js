const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const EDGE_CANDIDATES = Object.freeze([
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
]);

function browserPath() {
  const found = EDGE_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("A Chromium-based browser is required for PNG/PDF publication rendering");
  return found;
}

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function setPngDpi(filePath, dpi = 300) {
  const input = fs.readFileSync(filePath);
  const signature = input.subarray(0, 8);
  const chunks = [];
  let offset = 8;
  let inserted = false;
  while (offset < input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.subarray(offset + 4, offset + 8).toString("ascii");
    const chunk = input.subarray(offset, offset + 12 + length);
    if (type !== "pHYs") chunks.push(chunk);
    if (type === "IHDR" && !inserted) {
      const pixelsPerMeter = Math.round(dpi / 0.0254);
      const data = Buffer.alloc(9);
      data.writeUInt32BE(pixelsPerMeter, 0);
      data.writeUInt32BE(pixelsPerMeter, 4);
      data.writeUInt8(1, 8);
      chunks.push(pngChunk("pHYs", data));
      inserted = true;
    }
    offset += 12 + length;
  }
  fs.writeFileSync(filePath, Buffer.concat([signature, ...chunks]));
}

function pngInfo(filePath) {
  const input = fs.readFileSync(filePath);
  if (input.subarray(1, 4).toString("ascii") !== "PNG") throw new Error(`invalid PNG: ${filePath}`);
  const width = input.readUInt32BE(16);
  const height = input.readUInt32BE(20);
  let dpi = null;
  let offset = 8;
  while (offset < input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "pHYs" && input.readUInt8(offset + 16) === 1) {
      dpi = input.readUInt32BE(offset + 8) * 0.0254;
      break;
    }
    offset += 12 + length;
  }
  return { width, height, dpi };
}

function waitForFile(filePath) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error(`browser did not create output: ${filePath}`);
}

function renderWithBrowser({ svg, width, height, pngPath, pdfPath }) {
  const executable = browserPath();
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "mdpi-publication-render-"));
  const htmlPath = path.join(temporary, "figure.html");
  const profilePng = path.join(temporary, "profile-png");
  const profilePdf = path.join(temporary, "profile-pdf");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>` +
    `@page{size:${width / 300}in ${height / 300}in;margin:0}` +
    `html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#fff}` +
    `svg{display:block;width:100%;height:100%}` +
    `</style></head><body>${svg.replace(/^<\?xml[^>]*>\s*/, "")}</body></html>`;
  fs.writeFileSync(htmlPath, html, "utf8");
  const url = pathToFileURL(htmlPath).href;
  fs.mkdirSync(path.dirname(pngPath), { recursive: true });
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  const common = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
    "--disable-extensions", "--disable-background-networking", "--allow-file-access-from-files"];
  childProcess.execFileSync(executable, [
    ...common,
    `--user-data-dir=${profilePng}`,
    "--force-device-scale-factor=1",
    `--window-size=${width},${height}`,
    `--screenshot=${path.resolve(pngPath)}`,
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=1000",
    url,
  ], { encoding: "utf8", windowsHide: true, timeout: 30000, stdio: "pipe" });
  waitForFile(pngPath);
  setPngDpi(pngPath, 300);
  childProcess.execFileSync(executable, [
    ...common,
    `--user-data-dir=${profilePdf}`,
    `--print-to-pdf=${path.resolve(pdfPath)}`,
    "--no-pdf-header-footer",
    "--print-to-pdf-no-header",
    url,
  ], { encoding: "utf8", windowsHide: true, timeout: 30000, stdio: "pipe" });
  waitForFile(pdfPath);
  try { fs.rmSync(temporary, { recursive: true, force: true }); } catch (_error) { /* OS temp cleanup is best-effort. */ }
}

function validatePdf(filePath) {
  const contents = fs.readFileSync(filePath);
  return contents.length > 1000 && contents.subarray(0, 5).toString("ascii") === "%PDF-";
}

module.exports = {
  browserPath,
  setPngDpi,
  pngInfo,
  renderWithBrowser,
  validatePdf,
};
