async function readRequest() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function describeCommand(command) {
  return {
    name: command.name(),
    description: command.description(),
    commands: command.commands.map((child) => child.name()),
  };
}

const request = await readRequest();
const cliModule = await import(
  new URL("../../lib/esm/cli-module.js", import.meta.url).href
);
const commandModule = await import(
  new URL("../../lib/esm/cli/command.js", import.meta.url).href
);

if (request.op === "inspect") {
  const result = {
    fromModule: describeCommand(cliModule.default()),
    direct: describeCommand(commandModule.createDocsCommand()),
  };
  process.stdout.write(JSON.stringify(result));
} else if (request.op === "run") {
  const command = cliModule.default();
  try {
    await command.parseAsync(["node", "docs", ...(request.args ?? [])]);
  } catch (error) {
    process.stdout.write(
      JSON.stringify({
        harnessError: error instanceof Error ? error.message : String(error),
      })
    );
    process.exitCode = 2;
  }
} else {
  process.stdout.write(JSON.stringify({ harnessError: `unknown op ${request.op}` }));
  process.exitCode = 2;
}
