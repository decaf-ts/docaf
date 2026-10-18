import path from "node:path";
import ts from "typescript";
import {
  DocComponentEventModel,
  DocComponentModel,
  DocComponentPropertyModel,
  DocsIds,
} from "../../models";
import { commonDirectory } from "../paths";
import type {
  ComponentExtraction,
  ComponentExtractor,
  DocsSourceContext,
  SourceLocation,
} from "../types";

function decoratorName(decorator: ts.Decorator): string {
  const expression = decorator.expression;
  const target = ts.isCallExpression(expression)
    ? expression.expression
    : expression;
  return target.getText().split(".").pop() ?? "";
}

function decoratorCall(
  declaration: ts.Declaration,
  name: string
): ts.CallExpression | undefined {
  const decorators = ts.canHaveDecorators(declaration)
    ? ts.getDecorators(declaration) ?? []
    : [];
  const decorator = decorators.find(
    (candidate) => decoratorName(candidate) === name
  );
  return decorator && ts.isCallExpression(decorator.expression)
    ? decorator.expression
    : undefined;
}

function propertyOf(
  node: ts.ObjectLiteralExpression | undefined,
  name: string
): ts.Expression | undefined {
  if (!node) return undefined;
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const key = property.name;
    const keyText =
      ts.isIdentifier(key) || ts.isStringLiteral(key) ? key.text : undefined;
    if (keyText === name) return property.initializer;
  }
  return undefined;
}

function stringOf(node: ts.Expression | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  return undefined;
}

function booleanOf(node: ts.Expression | undefined): boolean | undefined {
  if (!node) return undefined;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

function objectArgument(
  call: ts.CallExpression | undefined,
  position: number
): ts.ObjectLiteralExpression | undefined {
  if (!call) return undefined;
  const argument = call.arguments[position];
  return argument && ts.isObjectLiteralExpression(argument)
    ? argument
    : undefined;
}

function lastObjectArgument(
  call: ts.CallExpression | undefined
): ts.ObjectLiteralExpression | undefined {
  if (!call) return undefined;
  for (let index = call.arguments.length - 1; index >= 0; index -= 1) {
    const argument = call.arguments[index];
    if (ts.isObjectLiteralExpression(argument)) return argument;
  }
  return undefined;
}

function callName(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression))
    return expression.getText();
  return expression.getText();
}

function genericText(
  call: ts.CallExpression | undefined
): string | undefined {
  const argument = call?.typeArguments?.[0];
  return argument ? argument.getText() : undefined;
}

function payloadOf(
  typeText: string | undefined
): string | undefined {
  if (!typeText) return undefined;
  const match = typeText.match(/^(?:EventEmitter|output|Observable)<(.+)>$/);
  return match ? match[1] : undefined;
}

function getJsDoc(node: ts.Node): ts.NodeArray<ts.JSDoc> | undefined {
  return (node as unknown as { jsDoc?: ts.NodeArray<ts.JSDoc> }).jsDoc;
}

function jsDocDescription(node: ts.Node): string | undefined {
  const comment = getJsDoc(node)?.[0]?.comment;
  if (!comment) return undefined;
  if (typeof comment === "string") return comment.trim();
  return ts
    .getTextOfJSDocComment(comment as ts.NodeArray<ts.JSDocComment>)
    ?.trim();
}

function relativeFilename(context: DocsSourceContext): string {
  const root = commonDirectory(context.rootNames);
  return path
    .relative(root, path.resolve(context.filename))
    .split(path.sep)
    .join("/");
}

function locationOf(
  node: ts.Node,
  context: DocsSourceContext
): SourceLocation | undefined {
  const position = context.sourceFile.getLineAndCharacterOfPosition(
    node.getStart(context.sourceFile)
  );
  return {
    fileName: relativeFilename(context),
    line: position.line + 1,
    column: position.character + 1,
  };
}

interface AngularSignal extends ts.CallExpression {
  typeArguments?: ts.NodeArray<ts.TypeNode>;
}

/**
 * Angular metadata extractor built on the TypeScript AST and the shared
 * checker — no regular-expression scraping of Angular syntax.
 */
export class AngularComponentExtractor implements ComponentExtractor {
  readonly framework = "angular";

  supports(declaration: ts.Declaration): boolean {
    return (
      ts.isClassDeclaration(declaration) &&
      Boolean(decoratorCall(declaration, "Component")) &&
      Boolean(declaration.name)
    );
  }

  async extract(
    declaration: ts.Declaration,
    context: DocsSourceContext
  ): Promise<ComponentExtraction> {
    const classDeclaration = declaration as ts.ClassDeclaration;
    const name = classDeclaration.name?.text ?? "AnonymousComponent";
    const sourceFile = relativeFilename(context);
    const componentUid = DocsIds.component("angular", sourceFile, name);
    const metadata = objectArgument(decoratorCall(declaration, "Component"), 0);
    const selector = stringOf(propertyOf(metadata, "selector"));
    const standalone = booleanOf(propertyOf(metadata, "standalone"));
    const properties: DocComponentPropertyModel[] = [];
    const events: DocComponentEventModel[] = [];
    const propertyLocations: Record<string, SourceLocation> = {};
    const eventLocations: Record<string, SourceLocation> = {};
    const seen = new Set<string>();

    for (const member of classDeclaration.members) {
      if (!ts.isPropertyDeclaration(member) || !member.name) continue;
      const memberName = ts.isIdentifier(member.name)
        ? member.name.text
        : member.name.getText(context.sourceFile);
      if (seen.has(memberName)) continue;

      const initializer = member.initializer;
      const call =
        initializer && ts.isCallExpression(initializer)
          ? (initializer as AngularSignal)
          : undefined;
      const callee = call ? callName(call.expression) : "";
      const inputDecorator = decoratorCall(member, "Input");
      const outputDecorator = decoratorCall(member, "Output");
      const memberType =
        member.type?.getText(context.sourceFile) ??
        this.typeAt(member, context);
      const description = jsDocDescription(member);
      const location = locationOf(member, context);

      if (outputDecorator || ["output", "output.required"].includes(callee)) {
        const payload =
          genericText(call) ?? payloadOf(memberType) ?? memberType;
        const event = new DocComponentEventModel({
          uid: DocsIds.componentEvent(componentUid, memberName),
          componentUid,
          name: memberName,
          typeText: callee ? `${callee}<${payload}>` : memberType,
          payloadTypeText: payload,
          description,
        });
        events.push(event);
        if (location) eventLocations[memberName] = location;
        seen.add(memberName);
        continue;
      }

      const isSignalInput = ["input", "input.required", "model"].includes(
        callee
      );
      if (!inputDecorator && !isSignalInput) continue;

      const optionObject = isSignalInput
        ? lastObjectArgument(call)
        : objectArgument(inputDecorator, 0);
      const alias =
        stringOf(propertyOf(optionObject, "alias")) ??
        (isSignalInput ? undefined : stringOf(inputDecorator?.arguments[0]));
      const requiredFromOptions = booleanOf(
        propertyOf(optionObject, "required")
      );
      const required =
        callee === "input.required" ||
        requiredFromOptions === true ||
        (inputDecorator
          ? booleanOf(propertyOf(objectArgument(inputDecorator, 0), "required"))
          : undefined) === true;
      const signalDefault =
        isSignalInput && call && call.arguments.length
          ? call.arguments[0]
          : undefined;
      const defaultValue =
        callee === "model" && signalDefault
          ? signalDefault.getText(context.sourceFile)
          : callee === "input" && signalDefault && !ts.isObjectLiteralExpression(signalDefault)
            ? signalDefault.getText(context.sourceFile)
            : !isSignalInput && member.initializer
              ? member.initializer.getText(context.sourceFile)
              : undefined;
      const property = new DocComponentPropertyModel({
        uid: DocsIds.componentProperty(componentUid, memberName),
        componentUid,
        name: memberName,
        kind: "input",
        alias,
        typeText: genericText(call) ?? memberType,
        optional: !required,
        required,
        defaultValue,
        description,
      });
      properties.push(property);
      if (location) propertyLocations[memberName] = location;
      seen.add(memberName);
    }

    const component = new DocComponentModel({
      uid: componentUid,
      docletUid: "",
      framework: this.framework,
      name,
      exportName: name,
      sourceFile,
      selector,
      standalone,
      propertyUids: properties.map((property) => property.uid),
      eventUids: events.map((event) => event.uid),
      previewUids: [],
    });

    return {
      framework: this.framework,
      name,
      exportName: name,
      sourceFile,
      selector,
      standalone,
      properties,
      events,
      component,
      location: locationOf(classDeclaration, context),
      propertyLocations,
      eventLocations,
    };
  }

  private typeAt(
    node: ts.Node,
    context: DocsSourceContext
  ): string | undefined {
    try {
      return context.checker.typeToString(
        context.checker.getTypeAtLocation(node)
      );
    } catch {
      return undefined;
    }
  }
}
