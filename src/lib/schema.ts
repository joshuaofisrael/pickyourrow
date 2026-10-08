/** Shared BreadcrumbList + ItemList JSON-LD, matching the best seats hubs. */

const SITE = 'https://pickyourrow.com';

export interface SchemaCrumb {
  name: string;
  path: string;
}

export interface SchemaListItem {
  name: string;
  path: string;
}

function absoluteUrl(path: string): string {
  return new URL(path, SITE).toString();
}

export function breadcrumbItemList(options: {
  crumbs: SchemaCrumb[];
  listName: string;
  items: SchemaListItem[];
}): Record<string, unknown>[] {
  const { crumbs, listName, items } = options;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: absoluteUrl(crumb.path),
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: listName,
      numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: absoluteUrl(item.path),
      })),
    },
  ];
}

/** The legal entity behind the site. Pick Your Row is its brand, not a separate company. */
export const PUBLISHER = {
  '@type': 'Organization',
  name: 'Joshua Israel Ventures LLC',
  url: 'https://pickyourrow.com/',
  brand: { '@type': 'Brand', name: 'Pick Your Row' },
};

/** Organization for the homepage, with the same identity as PUBLISHER. */
export const ORGANIZATION = {
  '@context': 'https://schema.org',
  ...PUBLISHER,
  legalName: 'Joshua Israel Ventures LLC',
  email: 'joshuaofisrael@gmail.com',
  description:
    'Joshua Israel Ventures LLC publishes Pick Your Row, original airline cabin schematics and editorial best seat guidance. Not affiliated with any airline.',
};
