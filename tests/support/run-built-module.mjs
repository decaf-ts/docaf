import { pathToFileURL } from "node:url";

async function readRequest() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function serializeError(error) {
  return {
    name: error && error.name,
    message: error && error.message,
    code: error && error.code,
    diagnostics: error && Array.isArray(error.diagnostics) ? error.diagnostics : undefined,
  };
}

const request = await readRequest();

try {
  const loaded = await import(pathToFileURL(request.module).href);
  const fn = loaded[request.exportName];
  if (typeof fn !== "function") {
    throw new Error(
      `Built module ${request.module} does not export a function named "${request.exportName}"`
    );
  }
  const value = await fn(...(request.args ?? []));
  process.stdout.write(
    JSON.stringify({ ok: true, value: value === undefined ? null : value })
  );
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: serializeError(error) }));
  process.exitCode = 1;
}
