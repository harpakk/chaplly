import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const secureEnvironment = config({ path: path.join(root, ".envsecure") }).parsed || {};
const localEnvironment = config({ path: path.join(root, ".env"), override: true }).parsed || {};
const deploymentEnvironment = { ...secureEnvironment, ...localEnvironment };

const required = (name, aliases = []) => {
  const key = [name, ...aliases].find((candidate) => process.env[candidate]?.trim());
  if (!key) throw new Error(`Missing ${[name, ...aliases].join(" or ")} in .env/.envsecure`);
  return process.env[key].trim();
};

const username = required("CPANEL_USERNAME");
const token = required("CPANEL_API_TOKEN");
const appUrl = new URL(required("NEXT_PUBLIC_APP_URL"));
const appName = process.env.CPANEL_APP_NAME?.trim() || "chapli";
const appPath = "/public_html";
const remoteDir = "public_html";
const archiveName = `chapli-deploy-${Date.now()}.tar.gz`;
const cpanelUrl = new URL(required("CPANEL_URL", ["CPANNEL_URL"]));
cpanelUrl.pathname = "/";
cpanelUrl.search = "";
cpanelUrl.hash = "";
if (!cpanelUrl.port) cpanelUrl.port = "2083";

const authHeaders = { Authorization: `cpanel ${username}:${token}` };
const stage = path.join(root, ".cpanel-deploy");
const archive = path.join(root, archiveName);

function run(command, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const windowsCommandShim =
      process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: windowsCommandShim,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)),
    );
  });
}

function apiError(payload) {
  const result = payload?.result || payload?.cpanelresult;
  const errors = result?.errors || result?.error || payload?.errors || payload?.error;
  if (errors) return Array.isArray(errors) ? errors.join("; ") : String(errors);
  return payload ? JSON.stringify(payload).slice(0, 500) : "Invalid or empty cPanel response";
}

async function uapi(module, operation, entries = []) {
  const url = new URL(`execute/${module}/${operation}`, cpanelUrl);
  for (const [key, value] of entries) url.searchParams.append(key, String(value));
  const response = await fetch(url, { headers: authHeaders });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.result?.status !== 1)
    throw new Error(`${module}/${operation}: ${apiError(payload)}`);
  return payload.result.data;
}

async function api2FileOperation(entries) {
  const url = new URL("json-api/cpanel", cpanelUrl);
  const params = {
    cpanel_jsonapi_user: username,
    cpanel_jsonapi_apiversion: "2",
    cpanel_jsonapi_module: "Fileman",
    cpanel_jsonapi_func: "fileop",
    doubledecode: "1",
    ...entries,
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: authHeaders });
  const payload = await response.json().catch(() => null);
  const result = payload?.cpanelresult;
  const failed = !response.ok || result?.event?.result !== 1 || result?.data?.some((item) => item.result !== 1);
  if (failed) throw new Error(`Fileman/fileop: ${apiError(payload)}`);
  return result.data;
}

async function uploadArchive() {
  const form = new FormData();
  form.set("dir", remoteDir);
  form.set("file-1", new Blob([await fs.readFile(archive)]), archiveName);
  const response = await fetch(new URL("execute/Fileman/upload_files", cpanelUrl), {
    method: "POST",
    headers: authHeaders,
    body: form,
  });
  const payload = await response.json().catch(() => null);
  const status = payload?.result?.status ?? payload?.status;
  if (!response.ok || Number(status) !== 1)
    throw new Error(`File upload failed: ${apiError(payload)}`);
}

const excludedEnvironment = /^(CPANEL_|CPANNEL_|NODE_ENV$|PORT$|HOSTNAME$)/;
const applicationEnvironment = Object.entries(deploymentEnvironment)
  .filter(([name, value]) => value && !excludedEnvironment.test(name))
  .filter(([, value]) => /^[\x20-\x7E]{1,1024}$/.test(value));
applicationEnvironment.push(["NODE_ENV", "production"], ["DEPLOYMENT_ENV", "production"]);
const environmentEntries = applicationEnvironment.flatMap(([name, value]) => [
  ["envvar_name", name],
  ["envvar_value", value],
]);

async function configurePassenger() {
  const applications = await uapi("PassengerApps", "list_applications");
  const values = applications && typeof applications === "object" ? Object.values(applications) : [];
  const existing = values.find((app) => app?.name === appName || app?.path === appPath);
  if (existing) {
    await uapi("PassengerApps", "edit_application", [
      ["name", existing.name || appName],
      ["new_name", appName],
      ["path", appPath],
      ["domain", appUrl.hostname],
      ["deployment_mode", "production"],
      ["enabled", "1"],
      ["clear_envvars", "1"],
      ...environmentEntries,
    ]);
  } else {
    await uapi("PassengerApps", "register_application", [
      ["name", appName],
      ["path", appPath],
      ["domain", appUrl.hostname],
      ["base_uri", "/"],
      ["deployment_mode", "production"],
      ["enabled", "1"],
      ...environmentEntries,
    ]);
  }
}

async function main() {
  const resolvedStage = path.resolve(stage);
  if (path.dirname(resolvedStage) !== root || path.basename(resolvedStage) !== ".cpanel-deploy")
    throw new Error("Unsafe staging path");

  console.log("Building production application...");
  await run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"]);
  await fs.access(path.join(root, ".next", "standalone", "server.js"));

  console.log("Preparing standalone deployment...");
  await fs.rm(stage, { recursive: true, force: true });
  await fs.rm(archive, { force: true });
  await fs.mkdir(stage, { recursive: true });
  await fs.cp(path.join(root, ".next", "standalone"), stage, {
    recursive: true,
    filter: (source) => path.basename(source) !== "node_modules",
  });
  await fs.cp(path.join(root, "public"), path.join(stage, "public"), { recursive: true });
  await fs.cp(path.join(root, ".next", "static"), path.join(stage, ".next", "static"), { recursive: true });
  await fs.writeFile(path.join(stage, "app.js"), 'require("./server.js");\n', "utf8");
  await fs.mkdir(path.join(stage, "tmp"), { recursive: true });
  await fs.writeFile(path.join(stage, "tmp", "restart.txt"), new Date().toISOString(), "utf8");
  await run("tar", ["-czf", archive, "-C", stage, "."]);

  console.log(`Uploading release to ${cpanelUrl.hostname}:${cpanelUrl.port}/${remoteDir}...`);
  await uploadArchive();
  await api2FileOperation({
    op: "extract",
    sourcefiles: `${remoteDir}/${archiveName}`,
    metadata: "tar.gz",
  });

  console.log("Installing Linux dependencies through cPanel...");
  await uapi("PassengerApps", "ensure_deps", [["type", "npm"], ["app_path", appPath]]);
  await configurePassenger();
  await uapi("PassengerApps", "disable_application", [["name", appName]]).catch(() => undefined);
  await uapi("PassengerApps", "enable_application", [["name", appName]]);

  console.log("Waiting for health check...");
  const healthUrl = new URL("/api/health", appUrl);
  let lastStatus = "no response";
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 3_000 : 5_000));
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(15_000) });
      lastStatus = `${response.status} ${response.statusText}`;
      if (response.ok) {
        console.log(`Deployment complete: ${appUrl.origin}`);
        return;
      }
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`Deployment finished but health check failed: ${lastStatus}`);
}

try {
  await main();
} finally {
  await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined);
  await fs.rm(archive, { force: true }).catch(() => undefined);
}
