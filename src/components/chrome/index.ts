/**
 * Site chrome — the persistent frame around every page. Re-exported from one
 * module so layouts and pages have a single import path.
 */

export { SiteHeader } from "./site-header";
export type { SiteHeaderProps } from "./site-header";

export { SiteFooter } from "./site-footer";
export type { SiteFooterProps } from "./site-footer";

export { PageHeader, PageShell } from "./page-shell";
export type { PageHeaderProps, PageShellProps, PageWidth } from "./page-shell";

export { Section } from "./section";
export type { SectionProps } from "./section";
