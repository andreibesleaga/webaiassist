// SPDX-License-Identifier: Apache-2.0
// The schemas of the two messages that carry what was read from a site (site/file, site/page).
// Type-only imports, so that scripts/gen-validators.ts can load this file with Node's type stripping.
import type { JSONSchemaType } from 'ajv';
import type { SiteFileMessage, SiteOpenGraph, SitePageLink, SitePageMessage } from './messages';

const typed = <T extends string>(value: T) => ({ type: 'string', const: value }) as const;

const REQUIRED_ORIGIN = { type: 'string', pattern: '^https?://[^/]+$', maxLength: 2048 } as const;
const shortText = (limit: number) => ({ type: 'string', maxLength: limit }) as const;

export const siteFile: JSONSchemaType<SiteFileMessage> = {
  type: 'object',
  properties: {
    type: typed('site/file'),
    id: {
      type: 'string',
      enum: [
        'llms',
        'llms-full',
        'linkset',
        'api-catalog',
        'agent-card',
        'security',
        'robots',
        'tdmrep',
        'sustainability',
      ],
    },
    origin: REQUIRED_ORIGIN,
    status: { type: 'integer', minimum: 0, maximum: 599 },
    contentType: shortText(200),
    link: shortText(2000),
    // The largest file is robots.txt: 500 KiB (src/core/site-files.ts).
    text: shortText(512000),
    cut: { type: 'boolean' },
    failed: { type: 'string', enum: ['timeout', 'network'], nullable: true },
    sha256: { type: 'string', pattern: '^[A-Za-z0-9+/]{43}=$', nullable: true },
  },
  required: ['type', 'id', 'origin', 'status', 'contentType', 'link', 'text', 'cut'],
  additionalProperties: false,
};

const siteOpenGraph: JSONSchemaType<SiteOpenGraph> = {
  type: 'object',
  properties: {
    title: { ...shortText(500), nullable: true },
    description: { ...shortText(500), nullable: true },
    type: { ...shortText(100), nullable: true },
    siteName: { ...shortText(200), nullable: true },
  },
  required: [],
  additionalProperties: false,
};

const sitePageLink: JSONSchemaType<SitePageLink> = {
  type: 'object',
  properties: {
    rel: shortText(40),
    href: shortText(500),
    type: { ...shortText(100), nullable: true },
  },
  required: ['rel', 'href'],
  additionalProperties: false,
};

export const sitePage: JSONSchemaType<SitePageMessage> = {
  type: 'object',
  properties: {
    type: typed('site/page'),
    origin: REQUIRED_ORIGIN,
    title: shortText(1000),
    language: { ...shortText(35), nullable: true },
    description: { ...shortText(500), nullable: true },
    og: siteOpenGraph,
    jsonLd: { type: 'array', items: shortText(32768), maxItems: 5 },
    links: { type: 'array', items: sitePageLink, maxItems: 60 },
    tdm: { type: 'string', enum: ['0', '1'], nullable: true },
  },
  required: ['type', 'origin', 'title', 'og', 'jsonLd', 'links'],
  additionalProperties: false,
};
