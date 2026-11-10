#!/usr/bin/env node
/**
 * Runner fixo de verificação. Não é um executor de shell genérico:
 * --filters deve ser ficheiro regular dentro de --workspace;
 * --fixtures só o catálogo empacotado (ficheiro regular, realpath idêntico).
 */
import { lstatSync, realpathSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";

const here = dirname(fileURLToPath(import.meta.url));
export const EXPECTED_TEST_COUNT = 6;
export const PACKAGED_FIXTURES = join(here, "fixtures", "products.json");

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) {
    throw new Error(`argumento obrigatório ausente: ${name}`);
  }
  return process.argv[index + 1];
}

function assertRegular(abs) {
  let st;
  try {
    st = lstatSync(abs);
  } catch {
    throw new Error(`UNSAFE_PATH: inexistente ${abs}`);
  }
  if (st.isSymbolicLink()) {
    throw new Error("UNSAFE_PATH: symlink recusado");
  }
  if (!st.isFile()) {
    throw new Error("UNSAFE_PATH: não é ficheiro regular");
  }
  return realpathSync(abs);
}

function assertInside(realFile, rootDir) {
  const root = realpathSync(resolve(rootDir));
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (realFile !== root && !realFile.startsWith(prefix)) {
    throw new Error("UNSAFE_PATH: realpath fora do workspace");
  }
}

function ids(rows) {
  return rows.map((row) => row.id).sort();
}

function same(actual, expected, label) {
  const a = JSON.stringify(ids(actual));
  const e = JSON.stringify(ids(expected));
  if (a !== e) {
    throw new Error(`${label}: obtido ${a} esperado ${e}`);
  }
}

function referenceApply(products, query = {}) {
  return products.filter((product) => {
    if (query.category && product.category !== query.category) return false;
    if (query.minPrice != null && product.price < query.minPrice) return false;
    if (query.maxPrice != null && product.price > query.maxPrice) return false;
    if (query.inStock === true && product.inStock !== true) return false;
    if (query.tag && !product.tags.includes(query.tag)) return false;
    return true;
  });
}

const workspaceDir = arg("--workspace");
const filtersPath = arg("--filters");
const fixturesPath = arg("--fixtures");

const filtersReal = assertRegular(resolve(filtersPath));
assertInside(filtersReal, workspaceDir);

const fixturesReal = assertRegular(resolve(fixturesPath));
const packagedReal = assertRegular(PACKAGED_FIXTURES);
if (fixturesReal !== packagedReal) {
  throw new Error("UNSAFE_PATH: fixtures só o catálogo empacotado");
}

const products = JSON.parse(await readFile(fixturesReal, "utf8"));
const mod = await import(pathToFileURL(filtersReal).href);
if (typeof mod.applyFilters !== "function") {
  throw new Error("applyFilters não exportado");
}

const cases = [
  { name: "all", query: {} },
  { name: "category-roupa", query: { category: "roupa" } },
  { name: "price-40-90", query: { minPrice: 40, maxPrice: 90 } },
  { name: "in-stock", query: { inStock: true } },
  { name: "tag-cozinha", query: { tag: "cozinha" } },
  {
    name: "compose-eletronicos-in-stock",
    query: { category: "eletronicos", inStock: true },
  },
];

if (cases.length !== EXPECTED_TEST_COUNT) {
  throw new Error("EXPECTED_TEST_COUNT dessincronizado");
}

const results = [];
for (const testCase of cases) {
  const actual = mod.applyFilters(products, testCase.query);
  const expected = referenceApply(products, testCase.query);
  same(actual, expected, testCase.name);
  results.push({ name: testCase.name, ids: ids(actual) });
}

process.stdout.write(
  `${JSON.stringify({ ok: true, tested: results.length, results }, null, 2)}\n`,
);
