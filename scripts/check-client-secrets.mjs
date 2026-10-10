import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sensitiveName =
  /(?:SECRET|API[_-]?KEY|(?:^|[_-])KEY(?:$|[_-])|TOKEN|PRIVATE[_-]?KEY|PASSWORD|DATABASE[_-]?URL|ACCESS[_-]?KEY|CREDENTIAL)/i;
const envFiles = (await readdir(root, { withFileTypes: true }))
  .filter(
    (entry) =>
      entry.isFile() && entry.name.startsWith(".env") && entry.name !== ".env.example",
  )
  .map((entry) => path.join(root, entry.name));
const environment = new Map();

function recordEnvironmentValue(name, value) {
  if (!value) return;
  let values = environment.get(name);
  if (!values) {
    values = new Set();
    environment.set(name, values);
  }
  values.add(value);
}

for (const [name, value] of Object.entries(process.env)) {
  recordEnvironmentValue(name, value);
}

for (const file of envFiles) {
  const contents = await readFile(file, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, name] = match;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    recordEnvironmentValue(name, value);
  }
}

const publicSecrets = [...environment.keys()].filter(
  (name) => name.startsWith("NEXT_PUBLIC_") && sensitiveName.test(name),
);
if (publicSecrets.length > 0) {
  console.error(
    `Refusing to start/build: sensitive environment variable(s) use the public NEXT_PUBLIC_ prefix: ${publicSecrets.join(", ")}. Move them to server-only variables.`,
  );
  process.exit(1);
}

if (process.argv.includes("--prebuild")) {
  console.log("Environment check passed: no sensitive NEXT_PUBLIC_ variables found.");
}

if (process.argv.includes("--scan")) {
  const staticRoot = path.join(root, ".next", "static");
  const secretValues = [...environment.entries()]
    .filter(([name]) => sensitiveName.test(name))
    .flatMap(([, values]) => [...values])
    .filter((value) => value.length >= 8);
  const files = [];

  async function collectFiles(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await collectFiles(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await collectFiles(staticRoot);
  for (const file of files) {
    const contents = await readFile(file);
    if (secretValues.some((value) => contents.includes(value))) {
      console.error(
        `A configured secret value was found in a browser-downloadable asset: ${path.relative(root, file)}. Remove the exposure before deploying.`,
      );
      process.exit(1);
    }
  }
  console.log(`Secret scan passed: checked ${files.length} browser assets.`);
}
