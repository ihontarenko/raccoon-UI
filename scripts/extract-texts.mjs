#!/usr/bin/env node
/* ==========================================================================
   Writes the interface's text catalogue from the code that uses it.

     npm run texts:extract

   Reads every `t("key", "English")`, `translate(…)`, `declareText(…)`,
   `translateNodes(…)` and `plural("key", count, { one, other })` /
   `translatePlural(…)` under `src/`, and writes the server's
   `translations/en/interface.json` — the catalogue the administration screen
   lists and every other language translates.

   The catalogue is generated, never edited: a key and its English are written
   once, at the call. A hand-kept catalogue drifts from the screens within a week.

   It fails rather than guesses: one key with two English texts, a key that is
   not a literal, a fallback built at run time — each stops the script with the
   file and line.

   A counted text is written in all four forms — `.one`, `.few`, `.many`,
   `.other` — although English uses only two: the server accepts a translation
   only for a key the catalogue lists, and Ukrainian needs `few` and `many`.

   It then reports, per shipped language, how many catalogue keys it lacks and
   which of its keys the catalogue no longer lists.
   ========================================================================== */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const INTERFACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = join(INTERFACE_ROOT, "src");
const TRANSLATIONS_ROOT = resolve(INTERFACE_ROOT, "../BE/src/main/resources/translations");
const CATALOGUE = join(TRANSLATIONS_ROOT, "en/interface.json");

/** Calls whose arguments are `(key, fallback, values?)`. */
const TEXT_CALLS = new Set(["t", "translate", "declareText", "translateNodes"]);
/** Calls whose arguments are `(key, count, { one, other }, values?)`. */
const PLURAL_CALLS = new Set(["plural", "translatePlural"]);
const KEY_SHAPE = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/;
const PLURAL_FORMS = ["one", "few", "many", "other"];

/** Files that DEFINE the functions rather than calling them. */
const DEFINITIONS = new Set(["src/translations/translate.ts", "src/translations/TranslationProvider.tsx"]);

const catalogue = new Map();
const problems = [];

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
  });
}

function literal(node) {
  if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
    return node.text;
  }
  return null;
}

function where(file, node) {
  const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
  return `${relative(INTERFACE_ROOT, file.fileName).replaceAll("\\", "/")}:${line + 1}`;
}

function record(key, fallback, location) {
  if (!KEY_SHAPE.test(key)) {
    problems.push(`${location}  "${key}" is not a text key — keys look like area.name`);
    return;
  }
  const held = catalogue.get(key);
  if (held && held.fallback !== fallback) {
    problems.push(
      `${location}  "${key}" has two English texts:\n      "${held.fallback}"  (${held.location})\n      "${fallback}"`,
    );
    return;
  }
  if (!held) {
    catalogue.set(key, { fallback, location });
  }
}

function readTextCall(file, call, name) {
  const [keyNode, fallbackNode] = call.arguments;
  const key = literal(keyNode);
  const fallback = literal(fallbackNode);
  if (key === null || fallback === null) {
    problems.push(`${where(file, call)}  ${name}(…) needs a literal key and a literal English text`);
    return;
  }
  record(key, fallback, where(file, call));
}

function readPluralCall(file, call, name) {
  const [keyNode, , formsNode] = call.arguments;
  const key = literal(keyNode);
  if (key === null || !formsNode || !ts.isObjectLiteralExpression(formsNode)) {
    problems.push(`${where(file, call)}  ${name}(…) needs a literal key and a literal { one, other }`);
    return;
  }
  const forms = {};
  for (const property of formsNode.properties) {
    const formName = property.name && ts.isIdentifier(property.name) ? property.name.text : null;
    const value = ts.isPropertyAssignment(property) ? literal(property.initializer) : null;
    if (formName === null || value === null) {
      problems.push(`${where(file, call)}  ${name}(…) forms must be literal texts`);
      return;
    }
    forms[formName] = value;
  }
  if (forms.one === undefined || forms.other === undefined) {
    problems.push(`${where(file, call)}  ${name}(…) needs both "one" and "other"`);
    return;
  }
  for (const form of PLURAL_FORMS) {
    record(`${key}.${form}`, forms[form] ?? forms.other, where(file, call));
  }
}

for (const path of sourceFiles(SOURCE_ROOT)) {
  const relativePath = relative(INTERFACE_ROOT, path).replaceAll("\\", "/");
  if (DEFINITIONS.has(relativePath)) {
    continue;
  }
  const file = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      if (TEXT_CALLS.has(name)) {
        readTextCall(file, node, name);
      } else if (PLURAL_CALLS.has(name)) {
        readPluralCall(file, node, name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
}

if (problems.length > 0) {
  console.error(`The catalogue was NOT written — ${problems.length} problem(s):\n`);
  problems.forEach((problem) => console.error(`  ${problem}`));
  process.exit(1);
}

const sorted = Object.fromEntries(
  [...catalogue.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, { fallback }]) => [key, fallback]),
);
writeFileSync(CATALOGUE, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
console.log(`Wrote ${catalogue.size} keys to ${relative(process.cwd(), CATALOGUE)}`);

for (const language of readdirSync(TRANSLATIONS_ROOT)) {
  const directory = join(TRANSLATIONS_ROOT, language);
  if (language === "en" || !statSync(directory).isDirectory()) {
    continue;
  }
  const texts = {};
  for (const name of readdirSync(directory).filter((candidate) => candidate.endsWith(".json"))) {
    Object.assign(texts, JSON.parse(readFileSync(join(directory, name), "utf8")));
  }
  const missing = [...catalogue.keys()].filter((key) => !(key in texts));
  const stale = Object.keys(texts).filter((key) => !catalogue.has(key));
  console.log(`${language}: ${catalogue.size - missing.length}/${catalogue.size} translated, ${stale.length} stale`);
  // `--verbose` lists the gaps; `--area=search.` narrows the list to one area's keys.
  if (process.argv.includes("--verbose")) {
    const areaArgument = process.argv.find((argument) => argument.startsWith("--area="));
    const area = areaArgument === undefined ? "" : areaArgument.slice("--area=".length);
    missing.filter((key) => key.startsWith(area)).forEach((key) => console.log(`  missing ${key}`));
    stale.filter((key) => key.startsWith(area)).forEach((key) => console.log(`  stale   ${key}`));
  }
}
