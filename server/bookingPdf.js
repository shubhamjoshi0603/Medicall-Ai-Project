const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const run = promisify(execFile);

async function renderConfirmation(html) {
  const browsers = process.env.PDF_BROWSER_PATH ? [process.env.PDF_BROWSER_PATH] : process.platform === "win32"
    ? [path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
       path.join(process.env.ProgramFiles || "", "Google/Chrome/Application/chrome.exe")]
    : ["/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/chromium-browser"];
  const browser = (await Promise.all(browsers.map(async file => {
    try { await fs.access(file); return file; } catch { return null; }
  }))).find(Boolean);
  if (!browser) throw new Error("Set PDF_BROWSER_PATH to a Chrome or Edge executable.");
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "medicall-confirmation-"));
  try {
    const source = path.join(temp, "confirmation.html");
    const pdf = path.join(temp, "confirmation.pdf");
    await fs.writeFile(source, '<!doctype html><meta charset="utf-8"><style>@page {size:A4;margin:18mm} body{overflow-wrap:anywhere}</style>' + html);
    await run(browser, ["--headless", "--disable-gpu", "--disable-extensions", "--disable-background-networking",
      "--no-pdf-header-footer", "--user-data-dir=" + path.join(temp, "profile"), "--print-to-pdf=" + pdf, pathToFileURL(source).href],
      { windowsHide: true, timeout: 30000 });
    return await fs.readFile(pdf);
  } finally {
    await fs.rm(temp, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 });
  }
}
module.exports = { renderConfirmation };
