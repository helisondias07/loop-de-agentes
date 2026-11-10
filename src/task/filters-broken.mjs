/** Implementação propositalmente incompleta: ignora inStock. */
export function applyFilters(products, query = {}) {
  return products.filter((product) => {
    if (query.category && product.category !== query.category) return false;
    if (query.minPrice != null && product.price < query.minPrice) return false;
    if (query.maxPrice != null && product.price > query.maxPrice) return false;
    if (query.tag && !product.tags.includes(query.tag)) return false;
    return true;
  });
}
