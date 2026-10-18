const fs = require("fs");
const path = require("path");
const env = require("jsdoc/env");
const tutorial = require("jsdoc/tutorial");
const resolver = require("jsdoc/tutorial/resolver");

const SITE_DOCS = [
  { file: "CLI.md", name: "CLI" },
  { file: "DOCKER.md", name: "DOCKER" },
];

function siteDocHref(file) {
  return `./tutorial-${path.basename(file, ".md")}.html`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rewriteHtmlLinks(html) {
  return SITE_DOCS.reduce((out, { file }) => {
    const pattern = new RegExp(
      `href="\\./${escapeRegExp(file)}(#[^"]*)?"`,
      "g"
    );
    return out.replace(
      pattern,
      (_match, anchor = "") => `href="${siteDocHref(file)}${anchor}"`
    );
  }, html);
}

function rewriteMarkdownLinks(markdown) {
  return SITE_DOCS.reduce((out, { file }) => {
    const pattern = new RegExp(
      `\\]\\(\\./${escapeRegExp(file)}(#[^)]*)?\\)`,
      "g"
    );
    return out.replace(
      pattern,
      (_match, anchor = "") => `](${siteDocHref(file)}${anchor})`
    );
  }, markdown);
}

exports.handlers = {
  parseComplete() {
    SITE_DOCS.forEach(({ file, name }) => {
      const filePath = path.resolve(process.cwd(), file);
      if (!fs.existsSync(filePath)) {
        return;
      }
      const content = rewriteMarkdownLinks(
        fs.readFileSync(filePath, env.opts.encoding || "utf8")
      );
      resolver.addTutorial(
        new tutorial.Tutorial(name, content, tutorial.TYPES.MARKDOWN)
      );
    });

    if (env.opts.readme) {
      env.opts.readme = rewriteHtmlLinks(env.opts.readme);
    }
  },
};
