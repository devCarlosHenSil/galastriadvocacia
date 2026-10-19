/**
 * The configuration of the site (`src/data/site.json` — SPEC-DATA §3.4).
 *
 * It is the single source of truth of the navigation, of the taxonomies, of
 * the form and of the SEO.
 */
import raw from '../data/site.json';

export interface NavItem {
  label: string;
  href: string;
  menuOrder: number;
  wpId: number;
  kind: 'page' | 'anchor';
}

export interface Category {
  slug: string;
  name: string;
  wpTermId: number;
  postCount: number;
  href: string;
}

export interface FormField {
  name: string;
  type: 'text' | 'email' | 'tel' | 'textarea';
  label: string;
  placeholder: string;
  required: boolean;
  mask: string | null;
  autocomplete: string | null;
  maxlength?: number;
  minlength?: number;
}

export interface FormConfig {
  provider: string;
  endpoint: string;
  emailTo: string;
  subject: string;
  method: string;
  fields: FormField[];
  honeypot: { name: string; type: string };
  submitLabel: string;
  submittingLabel: string;
  successMessage: string;
  errorMessage: string;
  fieldErrors: Record<string, string>;
  whatsappCta: { label: string; href: string };
  privacyConsent: {
    required: boolean;
    label: string;
    link: string;
    helper: string;
    error: string;
  };
  colors: Record<string, string | number>;
  masks: Record<string, { pattern: string; placeholder: string }>;
}

export interface SiteConfig {
  site: {
    name: string;
    legalName: string;
    description: string;
    lang: string;
    url: string;
    timezone: string;
    email: string;
    whatsapp: string;
    whatsappUrl: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      country: string;
      mapsQuery: string;
    };
    socials: { instagram: string; whatsapp: string };
    formats: { date: string; time: string };
    logo: { url: string; alt: string };
    author: { name: string; slug: string; role: string; bio: string };
  };
  nav: NavItem[];
  categories: Category[];
  tags: Array<{ slug: string; name: string; wpTermId: number; postCount: number; href: null }>;
  theme: Record<string, any>;
  form: FormConfig;
  seo: {
    default: Record<string, any>;
    perUrl: Record<
      string,
      {
        title: string;
        description: string;
        status: string;
        /** the override of the `robots` (the 404 is `noindex`) */
        robots?: string;
        /** `null` removes the canonical link (the 404) */
        canonical?: string | null;
      }
    >;
    organization: Record<string, any>;
    article: Record<string, any>;
  };
  routes: Record<string, string | null>;
}

export const config = raw as unknown as SiteConfig;

export const site = config.site;
export const nav = config.nav;
export const categories = config.categories;
export const form = config.form;
export const seo = config.seo;

/**
 * The WhatsApp URL with the default message of the office.
 * @param {string} [message]
 * @returns {string}
 */
export function whatsappUrl(message?: string): string {
  const text = message ?? 'Olá! Gostaria de agendar uma reunião com a Galastri Advocacia.';
  return `${site.whatsappUrl}?text=${encodeURIComponent(text)}`;
}

/**
 * The Google Maps URL of the office.
 * @returns {string}
 */
export function mapsUrl(): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${site.address.street}, ${site.address.city}-${site.address.state}`,
  )}`;
}
