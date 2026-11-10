#!/usr/bin/env node
/**
 * Runner fixo de verificação. Não é um executor de shell genérico:
 * apenas lê --filters e --fixtures, importa o módulo e compara com casos locais.
 */
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) {
    throw new Error(`argumento obrigatório ausente: ${name}`);
  }
  return process.argv[index + 1];
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

const filtersPath = arg("--filters");
const fixturesPath = arg("--fixtures");

const products = JSON.parse(await readFile(fixturesPath, "utf8"));
const mod = await import(pathToFileURL(filtersPath).href);
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
