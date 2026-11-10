export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  inStock: boolean;
  tags: string[];
}

export interface FilterQuery {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  tag?: string;
}

export const PRODUCTS: Product[] = [
  {
    id: "sku-101",
    name: "Camiseta algodão",
    category: "roupa",
    price: 49.9,
    inStock: true,
    tags: ["algodao", "basico"],
  },
  {
    id: "sku-102",
    name: "Camiseta dry-fit",
    category: "roupa",
    price: 89.0,
    inStock: false,
    tags: ["esporte"],
  },
  {
    id: "sku-201",
    name: "Caneca cerâmica",
    category: "casa",
    price: 32.5,
    inStock: true,
    tags: ["cozinha"],
  },
  {
    id: "sku-202",
    name: "Jarra vidro",
    category: "casa",
    price: 120.0,
    inStock: true,
    tags: ["cozinha", "vidro"],
  },
  {
    id: "sku-301",
    name: "Fone bluetooth",
    category: "eletronicos",
    price: 199.9,
    inStock: false,
    tags: ["audio"],
  },
  {
    id: "sku-302",
    name: "Mouse óptico",
    category: "eletronicos",
    price: 45.0,
    inStock: true,
    tags: ["periferico"],
  },
];

export const FILTER_CASES: { name: string; query: FilterQuery }[] = [
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

export const EXPECTED_TEST_COUNT = FILTER_CASES.length;

export function referenceApplyFilters(
  products: Product[],
  query: FilterQuery = {},
): Product[] {
  return products.filter((product) => {
    if (query.category && product.category !== query.category) return false;
    if (query.minPrice != null && product.price < query.minPrice) return false;
    if (query.maxPrice != null && product.price > query.maxPrice) return false;
    if (query.inStock === true && product.inStock !== true) return false;
    if (query.tag && !product.tags.includes(query.tag)) return false;
    return true;
  });
}

export type ApplyFiltersFn = (products: Product[], query?: FilterQuery) => Product[];

export function runCatalogChecks(applyFilters: ApplyFiltersFn): {
  ok: true;
  tested: number;
  results: { name: string; ids: string[] }[];
} {
  const results = [];
  for (const testCase of FILTER_CASES) {
    const actual = applyFilters(PRODUCTS, testCase.query);
    const expected = referenceApplyFilters(PRODUCTS, testCase.query);
    const a = JSON.stringify([...actual.map((row) => row.id)].sort());
    const e = JSON.stringify([...expected.map((row) => row.id)].sort());
    if (a !== e) {
      throw new Error(`${testCase.name}: obtido ${a} esperado ${e}`);
    }
    results.push({ name: testCase.name, ids: [...actual.map((row) => row.id)].sort() });
  }
  return { ok: true, tested: results.length, results };
}
