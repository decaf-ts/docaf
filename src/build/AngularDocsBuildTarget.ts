import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type {
  DocComponentEventRecord,
  DocComponentPropertyRecord,
  DocsSnapshotV1,
} from "../snapshot/records";
import { DocsBuildError } from "../generator/diagnostics";
import { resolveDocafPackageRoot } from "../package-root";
import {
  DocsSnapshotValidationError,
  validateDocsSnapshot,
} from "../snapshot/validate";
import {
  DocsBuildContext,
  DocsBuildResult,
  DocsBuildTarget,
} from "./DocsBuildTarget";

const APP_DIRECTORY = ".docaf-angular-app";

const REQUIRED_PACKAGES = [
  "@angular/core",
  "@angular/common",
  "@angular/router",
  "@angular/compiler",
  "@angular/compiler-cli",
  "@angular/build",
  "@angular/cli",
  "@ionic/angular",
  "@decaf-ts/for-angular",
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeName(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const parts = cleaned.length ? cleaned.split(/\s+/) : ["Docs"];
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function pascal(value: string): string {
  const safe = safeName(value);
  return /^[0-9]/.test(safe) ? `Docs${safe}` : safe;
}

function explicitRelative(from: string, target: string): string {
  let relative = path.relative(from, target).split(path.sep).join("/");
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return relative.replace(/\.tsx?$/, "");
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return (
    relative.length === 0 ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

/**
 * @description Options for the Angular docs build target.
 * @summary Allows tuning the Angular CLI build configuration (production or development),
 * overriding the root of the docaf package used to locate assets and generated sources, and
 * setting the timeout applied to spawned build processes.
 */
export interface AngularDocsBuildTargetOptions {
  configuration?: "production" | "development";
  packageRoot?: string;
  installTimeoutMs?: number;
}

/**
 * @description Build target that renders the docs snapshot as a standalone Angular application.
 * @summary Implements the {@link DocsBuildTarget} lifecycle for the Angular renderer. During
 * validation it checks that the required Angular/Ionic/decaf packages are resolvable from the
 * project (falling back to the docaf install) and rejects cross-framework previews. During
 * preparation it reads the snapshot, scaffolds a throwaway Angular app under
 * `<output>/.docaf-angular-app` (angular.json, tsconfig, main.ts, root component, app config,
 * routes, index.html, styles, and a preview registry mapping component/preview keys to dynamic
 * loaders, with synthetic preview components generated for components that cannot be imported
 * directly), copies the snapshot and i18n assets into the app's public folder, and links
 * node_modules when possible. During the build it spawns the resolved `ng` binary, then copies
 * the produced `dist/browser` output back into the output directory, removing any stale files
 * except the app scaffold. Errors are reported as {@link DocsBuildError} diagnostics.
 * @class AngularDocsBuildTarget
 * @example
 * ```ts
 * const target = new AngularDocsBuildTarget({ configuration: "production" });
 * await target.validate(context);
 * await target.prepare(context);
 * const result = await target.build(context);
 * ```
 */
export class AngularDocsBuildTarget implements DocsBuildTarget {
  readonly id = "angular";
  readonly rendererFlavour = "angular";

  private readonly configuration: "production" | "development";
  private readonly packageRoot: string;
  private readonly installTimeoutMs: number;
  private snapshot?: DocsSnapshotV1;

  constructor(options: AngularDocsBuildTargetOptions = {}) {
    this.configuration = options.configuration ?? "production";
    this.packageRoot =
      options.packageRoot ?? resolveDocafPackageRoot(process.cwd());
    this.installTimeoutMs = options.installTimeoutMs ?? 15 * 60 * 1000;
  }

  async validate(context: DocsBuildContext): Promise<void> {
    await this.validateDependencies(context);
    await this.validatePreviews(context);
  }

  async prepare(context: DocsBuildContext): Promise<void> {
    this.snapshot = await this.readSnapshot(context);
    const appDir = path.join(context.outputDirectory, APP_DIRECTORY);
    const srcDir = path.join(appDir, "src");
    const appSourceDir = path.join(srcDir, "app");
    const previewDirectory = path.join(appSourceDir, "previews");
    await fs.mkdir(previewDirectory, { recursive: true });
    await fs.mkdir(path.join(appDir, "public", "assets", "docs"), {
      recursive: true,
    });
    await fs.mkdir(path.join(appDir, "public", "assets", "i18n"), {
      recursive: true,
    });

    await fs.copyFile(
      context.snapshotPath,
      path.join(appDir, "public", "assets", "docs", "snapshot.json")
    );
    const requireFromProject = createRequire(
      path.join(context.projectRoot, "package.json")
    );
    const requireFromPackage = createRequire(
      path.join(this.packageRoot, "package.json")
    );
    const forAngularRoot = path.dirname(
      this.resolveDependency(
        requireFromProject,
        requireFromPackage,
        "@decaf-ts/for-angular"
      )
    );
    await fs.copyFile(
      path.join(forAngularRoot, "assets", "i18n", "en.json"),
      path.join(appDir, "public", "assets", "i18n", "en.json")
    );

    await this.writeProjectFiles(context, appDir, srcDir, appSourceDir);
    await this.writePreviewModules(
      context,
      appSourceDir,
      previewDirectory
    );
    await this.ensureDependencies(appDir);
  }

  async build(context: DocsBuildContext): Promise<DocsBuildResult> {
    const started = Date.now();
    const appDir = path.join(context.outputDirectory, APP_DIRECTORY);
    const distDir = path.join(appDir, "dist", "browser");
    const ngBin = this.resolveNgBinary();
    const warnings: string[] = [];
    await this.run(ngBin, ["build", "--configuration", this.configuration], appDir, warnings);

    const files = await this.copyDist(distDir, context.outputDirectory);
    return {
      targetId: this.id,
      rendererFlavour: this.rendererFlavour,
      outputDirectory: context.outputDirectory,
      files,
      durationMs: Date.now() - started,
      warnings,
    };
  }

  private async validateDependencies(context: DocsBuildContext): Promise<void> {
    const requireFromProject = createRequire(
      path.join(context.projectRoot, "package.json")
    );
    const requireFromPackage = createRequire(
      path.join(this.packageRoot, "package.json")
    );
    const missing: string[] = [];
    for (const dependency of REQUIRED_PACKAGES) {
      try {
        requireFromProject.resolve(`${dependency}/package.json`);
        continue;
      } catch {
        // Fall back to the docaf install, which owns the Angular toolchain.
      }
      try {
        requireFromPackage.resolve(`${dependency}/package.json`);
      } catch {
        missing.push(dependency);
      }
    }
    if (missing.length) {
      throw new DocsBuildError(
        missing.map((dependency) => ({
          severity: "error" as const,
          code: "DOCS_ANGULAR_DEPENDENCY",
          message: `The Angular docs target requires "${dependency}" in ${context.projectRoot}. Install it before building.`,
        }))
      );
    }
  }

  private async validatePreviews(context: DocsBuildContext): Promise<void> {
    const snapshot = await this.readSnapshot(context);
    const unsupported = snapshot.tables.componentPreviews.filter(
      (preview) =>
        preview.framework &&
        preview.framework !== "angular" &&
        preview.framework !== "unknown"
    );
    if (unsupported.length) {
      throw new DocsBuildError(
        unsupported.map((preview) => ({
          severity: "error" as const,
          code: "DOCS_CROSS_FRAMEWORK_PREVIEW",
          message: `Preview "${preview.uid}" targets "${preview.framework}". The Angular target can only render Angular previews natively; configure an isolated preview runtime instead of silently skipping it.`,
        }))
      );
    }
  }

  private async readSnapshot(
    context: DocsBuildContext
  ): Promise<DocsSnapshotV1> {
    if (this.snapshot) return this.snapshot;
    let raw: string;
    try {
      raw = await fs.readFile(context.snapshotPath, "utf8");
    } catch (error) {
      throw new DocsBuildError([
        {
          severity: "error",
          code: "DOCS_SNAPSHOT_MISSING",
          message: `Cannot read docs snapshot at ${context.snapshotPath}: ${
            (error as Error).message
          }`,
        },
      ]);
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      validateDocsSnapshot(parsed);
      this.snapshot = parsed;
    } catch (error) {
      if (error instanceof DocsSnapshotValidationError) {
        throw new DocsBuildError([
          {
            severity: "error",
            code: "DOCS_SNAPSHOT_INVALID",
            message: `Docs snapshot at ${context.snapshotPath} failed validation: ${error.message}`,
          },
        ]);
      }
      throw new DocsBuildError([
        {
          severity: "error",
          code: "DOCS_SNAPSHOT_INVALID",
          message: `Docs snapshot at ${context.snapshotPath} is not valid JSON: ${
            (error as Error).message
          }`,
        },
      ]);
    }
    return this.snapshot;
  }

  private async writeProjectFiles(
    context: DocsBuildContext,
    appDir: string,
    srcDir: string,
    appSourceDir: string
  ): Promise<void> {
    const snapshot = await this.readSnapshot(context);
    const projectName =
      snapshot.project.name || context.config.project?.name || "Documentation";
    const baseHref = context.config.output?.baseHref ?? "/";
    const sourceRoot = path.join(this.packageRoot, "src");
    const hasSource = existsSync(path.join(sourceRoot, "index.ts"));
    const libraryRoot = hasSource
      ? sourceRoot
      : path.join(this.packageRoot, "lib", "esm");
    const extension = hasSource ? ".ts" : ".js";
    const paths = {
      "@decaf-ts/docaf": [
        explicitRelative(appDir, path.join(libraryRoot, `index${extension}`)),
      ],
      "@decaf-ts/docaf/ui": [
        explicitRelative(appDir, path.join(libraryRoot, "ui", `index${extension}`)),
      ],
      "@decaf-ts/docaf/for-angular": [
        explicitRelative(
          appDir,
          path.join(libraryRoot, "for-angular", `index${extension}`)
        ),
      ],
    };

    const angularJson = {
      version: 1,
      projects: {
        "docs-app": {
          projectType: "application",
          root: "",
          sourceRoot: "src",
          architect: {
            build: {
              builder: "@angular/build:application",
              options: {
                outputPath: "dist",
                index: "src/index.html",
                browser: "src/main.ts",
                polyfills: ["zone.js"],
                tsConfig: "tsconfig.app.json",
                inlineStyleLanguage: "css",
                assets: [{ glob: "**/*", input: "public" }],
                styles: ["src/styles.css"],
                scripts: [],
              },
              configurations: {
                production: {
                  budgets: [
                    {
                      type: "initial",
                      maximumWarning: "3mb",
                      maximumError: "8mb",
                    },
                  ],
                  outputHashing: "all",
                },
                development: {
                  optimization: false,
                  extractLicenses: false,
                  sourceMap: true,
                },
              },
              defaultConfiguration: "production",
            },
          },
        },
      },
    };
    await this.writeJson(path.join(appDir, "angular.json"), angularJson);

    const tsconfig = {
      compileOnSave: false,
      compilerOptions: {
        baseUrl: ".",
        outDir: "./out-tsc",
        strict: false,
        noImplicitAny: false,
        noImplicitOverride: false,
        skipLibCheck: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        useDefineForClassFields: false,
        target: "ES2022",
        module: "ES2022",
        moduleResolution: "bundler",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        paths,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        importHelpers: true,
      },
      angularCompilerOptions: {
        strictTemplates: false,
        strictInjectionParameters: false,
        fullTemplateTypeCheck: false,
      },
      include: ["src/**/*.ts"],
    };
    await this.writeJson(path.join(appDir, "tsconfig.app.json"), tsconfig);

    const packageJson = {
      name: "decaf-docs-angular-app",
      version: "0.0.0",
      private: true,
      type: "module",
      scripts: {
        build: "ng build",
      },
    };
    await this.writeJson(path.join(appDir, "package.json"), packageJson);

    const main = `import "zone.js";
import { bootstrapApplication } from "@angular/platform-browser";
import { DocsRootComponent } from "./app/docs-root.component";
import { appConfig } from "./app/app.config";

bootstrapApplication(DocsRootComponent, appConfig).catch((error) => {
  console.error(error);
});
`;
    await this.write(path.join(srcDir, "main.ts"), main);

    const rootComponent = `import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
  selector: "docs-root",
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class DocsRootComponent {}
`;
    await this.write(path.join(appSourceDir, "docs-root.component.ts"), rootComponent);

    const runtimeFile = `import { ApplicationConfig, provideZoneChangeDetection } from "@angular/core";
import {
  RouteReuseStrategy,
  provideRouter,
  withHashLocation,
  withInMemoryScrolling,
} from "@angular/router";
import { provideIonicAngular, IonicRouteStrategy } from "@ionic/angular/standalone";
import { provideDecafI18nConfig } from "@decaf-ts/for-angular";
import { DOCS_ANGULAR_PREVIEWS } from "@decaf-ts/docaf/for-angular";
import { routes } from "./app.routes";
import { DOCS_PREVIEWS } from "./preview-registry";

export const appConfig: ApplicationConfig = {
  providers: [
    provideIonicAngular({ mode: "md" }),
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(
      routes,
      withHashLocation(),
      withInMemoryScrolling({ anchorScrolling: "enabled" })
    ),
    provideDecafI18nConfig(
      { fallbackLang: "en", lang: "en" },
      [{ prefix: "./assets/i18n/", suffix: ".json" }],
      false,
      false
    ),
    { provide: DOCS_ANGULAR_PREVIEWS, useValue: DOCS_PREVIEWS },
  ],
};
`;
    await this.write(path.join(appSourceDir, "app.config.ts"), runtimeFile);

    const routesFile = `import { Routes } from "@angular/router";
import { DocsPageHostComponent } from "@decaf-ts/docaf/for-angular";

export const routes: Routes = [
  { path: "**", component: DocsPageHostComponent },
];
`;
    await this.write(path.join(appSourceDir, "app.routes.ts"), routesFile);

    const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(projectName)}</title>
    <base href="${escapeHtml(baseHref)}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="data:," />
    <meta name="description" content="${escapeHtml(
      projectName
    )} documentation" />
    <script>
      globalThis.process = globalThis.process || {
        env: { NODE_ENV: "production" },
      };
    </script>
  </head>
  <body>
    <docs-root></docs-root>
  </body>
</html>
`;
    await this.write(path.join(srcDir, "index.html"), indexHtml);
    await this.write(path.join(srcDir, "styles.css"), this.stylesheet());
  }

  private async writePreviewModules(
    context: DocsBuildContext,
    appSourceDir: string,
    previewDirectory: string
  ): Promise<void> {
    const snapshot = await this.readSnapshot(context);
    const components = snapshot.tables.components;
    const properties = snapshot.tables.componentProperties;
    const events = snapshot.tables.componentEvents;
    const previews = snapshot.tables.componentPreviews;
    const loaders = new Map<string, string>();
    const imports: string[] = [];

    for (const component of components) {
      const sourcePath = await this.componentSource(
        context,
        component.sourceFile
      );
      const componentSource = sourcePath
        ? await fs.readFile(sourcePath, "utf8")
        : undefined;
      const real =
        component.standalone !== false &&
        componentSource !== undefined &&
        /from\s+["']@angular\/core["']/.test(componentSource);
      let loader: string;
      if (real && component.exportName) {
        const relative = explicitRelative(appSourceDir, sourcePath as string);
        loader = `() => import(${JSON.stringify(relative)}).then((module) => module[${JSON.stringify(
          component.exportName
        )}])`;
      } else {
        const moduleName = `${pascal(component.name)}SyntheticPreview`;
        const fileName = `${safeName(component.name).toLowerCase() || "docs"}.preview.ts`;
        const componentProperties = properties.filter(
          (property) => property.componentUid === component.uid
        );
        const componentEvents = events.filter(
          (event) => event.componentUid === component.uid
        );
        await this.write(
          path.join(previewDirectory, fileName),
          this.syntheticPreview(
            moduleName,
            component.name,
            component.selector,
            componentProperties,
            componentEvents
          )
        );
        imports.push(
          `import { ${moduleName} } from "./previews/${fileName.replace(
            /\.ts$/,
            ""
          )}";`
        );
        loader = `() => Promise.resolve(${moduleName})`;
      }
      loaders.set(component.uid, loader);
      const componentPreviews = previews.filter(
        (preview) => preview.componentUid === component.uid
      );
      for (const preview of componentPreviews) {
        for (const key of [preview.entry, preview.uid]) {
          if (key) loaders.set(key, loader);
        }
      }
    }

    const lines = [
      ...imports,
      "",
      "export const DOCS_PREVIEWS: Record<string, () => Promise<unknown>> = {",
      ...[...loaders.entries()].map(
        ([key, loader]) => `  ${JSON.stringify(key)}: ${loader},`
      ),
      "};",
      "",
    ];
    await this.write(path.join(appSourceDir, "preview-registry.ts"), lines.join("\n"));
  }

  private async componentSource(
    context: DocsBuildContext,
    sourceFile: string | undefined
  ): Promise<string | undefined> {
    if (!sourceFile) return undefined;
    const candidates = [
      path.resolve(context.projectRoot, sourceFile),
      path.resolve(this.packageRoot, sourceFile),
    ].filter(
      (candidate) =>
        isInside(context.projectRoot, candidate) ||
        isInside(this.packageRoot, candidate)
    );
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    const found = await this.searchForFile(context.projectRoot, sourceFile);
    if (!found) return undefined;
    return isInside(context.projectRoot, found) ? found : undefined;
  }

  private async searchForFile(
    root: string,
    sourceFile: string
  ): Promise<string | undefined> {
    const normalized = sourceFile.split(path.sep).join("/");
    const target = path.basename(normalized);
    const skip = new Set([
      "node_modules",
      ".git",
      "lib",
      "dist",
      "coverage",
      ".docaf-angular-app",
    ]);
    const visit = async (directory: string): Promise<string | undefined> => {
      let entries;
      try {
        entries = await fs.readdir(directory, { withFileTypes: true });
      } catch {
        return undefined;
      }
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (skip.has(entry.name)) continue;
          const found = await visit(path.join(directory, entry.name));
          if (found) return found;
        } else if (entry.name === target) {
          const candidate = path.join(directory, entry.name);
          if (candidate.split(path.sep).join("/").endsWith(normalized))
            return candidate;
        }
      }
      return undefined;
    };
    return visit(root);
  }

  private syntheticPreview(
    className: string,
    componentName: string,
    selector: string | undefined,
    properties: DocComponentPropertyRecord[],
    events: DocComponentEventRecord[]
  ): string {
    const lines = [
      `import { Component, EventEmitter, Input, Output } from "@angular/core";`,
      "",
      "@Component({",
      `  selector: ${JSON.stringify(selector ?? `docs-preview-${safeName(componentName).toLowerCase()}`)},`,
      "  standalone: true,",
      "  template: `",
      `    <div class="docs-synthetic-preview">`,
      `      <p class="docs-synthetic-title">${escapeHtml(componentName)}</p>`,
      ...properties.map(
        (property) =>
          `      <p class="docs-synthetic-property"><span>${escapeHtml(
            property.name
          )}</span>: {{ ${property.name} }}</p>`
      ),
      ...events.map(
        (event) =>
          `      <button type="button" (click)="${event.name}.emit({})">Emit ${escapeHtml(
            event.name
          )}</button>`
      ),
      `      <p class="docs-synthetic-note">Synthetic Angular preview generated from the documented component contract.</p>`,
      `    </div>`,
      "  `,",
      "})",
      `export class ${className} {`,
      ...properties.map((property) =>
        property.alias
          ? `  @Input(${JSON.stringify(property.alias)}) ${property.name}: any;`
          : `  @Input() ${property.name}: any;`
      ),
      ...events.map(
        (event) => `  @Output() ${event.name} = new EventEmitter<any>();`
      ),
      "}",
      "",
    ];
    return lines.join("\n");
  }

  private async ensureDependencies(appDir: string): Promise<void> {
    const localModules = path.join(appDir, "node_modules");
    if (existsSync(localModules)) return;
    try {
      createRequire(path.join(appDir, "package.json")).resolve(
        "@angular/core/package.json"
      );
      return;
    } catch {
      // Fall through to a workspace link.
    }
    const projectModules = path.join(this.packageRoot, "node_modules");
    if (!existsSync(projectModules)) return;
    try {
      await fs.symlink(projectModules, localModules, "dir");
    } catch {
      // Resolution may still succeed through a parent node_modules directory.
    }
  }

  private resolveDependency(
    requireFromProject: NodeRequire,
    requireFromPackage: NodeRequire,
    dependency: string
  ): string {
    try {
      return requireFromProject.resolve(`${dependency}/package.json`);
    } catch {
      return requireFromPackage.resolve(`${dependency}/package.json`);
    }
  }

  private resolveNgBinary(): string {
    const requireFromProject = createRequire(
      path.join(this.packageRoot, "package.json")
    );
    try {
      return requireFromProject.resolve("@angular/cli/bin/ng.js");
    } catch {
      const cliPackage = requireFromProject.resolve("@angular/cli/package.json");
      return path.join(path.dirname(cliPackage), "bin", "ng.js");
    }
  }

  private run(
    executable: string,
    args: string[],
    cwd: string,
    warnings: string[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [executable, ...args], {
        cwd,
        env: {
          ...process.env,
          CI: "1",
          NG_CLI_ANALYTICS: "false",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
      }, this.installTimeoutMs);
      child.stdout?.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) {
          if (/warning/i.test(stdout + stderr))
            warnings.push((stdout + stderr).trim().slice(-4000));
          resolve();
          return;
        }
        reject(
          new DocsBuildError([
            {
              severity: "error",
              code: "DOCS_ANGULAR_BUILD_FAILED",
              message: `Angular application build failed with exit code ${code}.\n${(
                stderr || stdout
              )
                .trim()
                .slice(-6000)}`,
            },
          ])
        );
      });
    });
  }

  private async copyDist(
    distDir: string,
    outputDirectory: string
  ): Promise<string[]> {
    if (!existsSync(distDir)) {
      throw new DocsBuildError([
        {
          severity: "error",
          code: "DOCS_ANGULAR_OUTPUT_MISSING",
          message: `Angular build finished without producing ${distDir}.`,
        },
      ]);
    }
    await fs.mkdir(outputDirectory, { recursive: true });
    for (const entry of await fs.readdir(outputDirectory)) {
      if (entry === APP_DIRECTORY) continue;
      await fs.rm(path.join(outputDirectory, entry), {
        recursive: true,
        force: true,
      });
    }
    const files: string[] = [];
    const walk = async (directory: string, prefix: string): Promise<void> => {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const source = path.join(directory, entry.name);
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        const destination = path.join(outputDirectory, relative);
        if (entry.isDirectory()) {
          await fs.mkdir(destination, { recursive: true });
          await walk(source, relative);
        } else {
          await fs.mkdir(path.dirname(destination), { recursive: true });
          await fs.copyFile(source, destination);
          files.push(relative);
        }
      }
    };
    await walk(distDir, "");
    return files.sort();
  }

  private async write(file: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content, "utf8");
  }

  private async writeJson(file: string, value: unknown): Promise<void> {
    await this.write(file, `${JSON.stringify(value, null, 2)}\n`);
  }

  private stylesheet(): string {
    return `@import "@ionic/angular/css/core.css";
@import "@ionic/angular/css/normalize.css";
@import "@ionic/angular/css/structure.css";
@import "@ionic/angular/css/typography.css";
@import "@ionic/angular/css/display.css";

:root {
  color-scheme: light dark;
  --docs-border: #d7dbe0;
  --docs-muted: #5f6b7a;
  --docs-accent: #1f5fbf;
  --docs-surface: #f7f8fa;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}

html,
body {
  position: static;
  overflow: visible;
  height: auto;
}

body {
  margin: 0;
  line-height: 1.55;
  color: #16202b;
  background: #ffffff;
}

a {
  color: var(--docs-accent);
}

docs-root,
docs-page-host,
.dcf-layout-container {
  display: block;
  width: 100%;
}

.dcf-layout-row {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  gap: 1.5rem;
}

.dcf-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.dcf-grid-col {
  min-width: 0;
}

.dcf-layout-row:has(.docs-nav):has(.docs-toc) {
  grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr) minmax(10rem, 14rem);
  align-items: start;
  padding: 0 1.5rem;
}

.dcf-layout-row:has(.docs-nav):not(:has(.docs-toc)) {
  grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr);
  align-items: start;
  padding: 0 1.5rem;
}

.dcf-layout-row:has(.docs-nav):not(:has(.docs-toc)) > .dcf-grid-col:nth-child(3) {
  display: none;
}

.dcf-layout-row:has(.docs-brand),
.dcf-layout-row.docs-footer {
  padding: 0.75rem 1.5rem;
}

@media (max-width: 900px) {
  .dcf-layout-row:has(.docs-nav),
  .dcf-layout-row:has(.docs-nav):has(.docs-toc) {
    grid-template-columns: minmax(0, 1fr);
    padding: 0 1rem;
  }

  .dcf-layout-row:has(.docs-nav) > .dcf-grid-col {
    grid-column: 1 / -1;
  }
}

.dcf-grid-col[class*="dcf-child-1-1"] {
  grid-column: 1 / -1;
}

.dcf-grid-col[class*="dcf-child-1-2"] {
  grid-column: span 1;
}

.dcf-grid-col[class*="dcf-child-2-2"] {
  grid-column: span 1;
}

.dcf-grid-col[class*="dcf-child-1-3"] {
  grid-column: span 1;
}

.dcf-grid-col[class*="dcf-child-2-3"] {
  grid-column: span 1;
}

.dcf-grid-col[class*="dcf-child-3-3"] {
  grid-column: span 1;
}

.dcf-width-1-1 {
  width: 100%;
}

.docs-brand {
  font-weight: 700;
  font-size: 1.15rem;
  text-decoration: none;
}

.docs-heading {
  margin: 0.4em 0;
  line-height: 1.2;
}

.docs-nav,
.docs-toc,
.docs-related,
.docs-member-list,
.docs-search-results,
.docs-examples {
  list-style: none;
  margin: 0;
  padding: 0;
}

.docs-nav-nested {
  padding-inline-start: 1rem;
}

.docs-nav-item,
.docs-related li {
  margin: 0.25rem 0;
}

.docs-nav-group {
  font-weight: 600;
  color: var(--docs-muted);
}

.docs-toc a,
.docs-breadcrumbs a {
  text-decoration: none;
}

.docs-breadcrumb-separator {
  margin: 0 0.4rem;
  color: var(--docs-muted);
}

.docs-section {
  margin: 2rem 0;
}

.docs-code,
.docs-markdown {
  overflow: auto;
  padding: 0.85rem;
  border-radius: 6px;
  background: var(--docs-surface);
  border: 1px solid var(--docs-border);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.86rem;
  white-space: pre-wrap;
}

.docs-member {
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--docs-border);
}

.docs-member-name {
  font-weight: 600;
}

.docs-member-signature {
  margin-inline-start: 0.4rem;
  color: var(--docs-muted);
}

.docs-member-kind,
.docs-search-kind,
.docs-preview-framework {
  margin-inline-start: 0.4rem;
  color: var(--docs-muted);
  font-size: 0.82rem;
  text-transform: uppercase;
}

.docs-member-description,
.docs-search-summary {
  margin: 0.3rem 0 0;
  color: var(--docs-muted);
}

.docs-search {
  margin: 0 0 1rem;
}

.docs-search-input {
  width: 100%;
  max-width: 32rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--docs-border);
  border-radius: 6px;
}

.docs-search-results {
  margin-top: 0.5rem;
}

.docs-search-results li {
  margin: 0.3rem 0;
}

.docs-preview {
  border: 1px solid var(--docs-border);
  border-radius: 8px;
  padding: 1rem;
  margin: 1.5rem 0;
  background: var(--docs-surface);
}

.docs-preview-controls {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  margin: 1rem 0;
}

.docs-preview-control {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.9rem;
}

.docs-preview-control input[type="text"],
.docs-preview-control input[type="number"] {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--docs-border);
  border-radius: 4px;
}

.docs-preview-stage {
  background: #ffffff;
  border: 1px dashed var(--docs-border);
  border-radius: 6px;
  padding: 1rem;
}

.docs-synthetic-preview {
  border: 1px solid var(--docs-border);
  border-radius: 6px;
  padding: 0.75rem;
  background: #ffffff;
}

.docs-synthetic-title {
  font-weight: 700;
  margin: 0 0 0.5rem;
}

.docs-synthetic-property span {
  font-weight: 600;
  margin-inline-end: 0.35rem;
}

.docs-synthetic-note,
.docs-preview-fallback {
  color: var(--docs-muted);
  font-size: 0.85rem;
}

.docs-table {
  border-collapse: collapse;
  width: 100%;
}

.docs-table th,
.docs-table td {
  border: 1px solid var(--docs-border);
  padding: 0.4rem 0.55rem;
  text-align: start;
  vertical-align: top;
}

.docs-page-error,
.docs-page-loading {
  max-width: 60rem;
  margin: 2rem auto;
  padding: 0 1.5rem;
}

@media (max-width: 900px) {
  .dcf-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .dcf-grid-col[class*="dcf-child-"] {
    grid-column: 1 / -1;
  }
}
`;
  }
}
