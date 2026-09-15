/** DI tokens. Constructors always use @Inject(TOKEN): tsx/Vitest do not emit decorator type metadata. */
export const DATABASE = Symbol('Database');
export const APP_CONFIG = Symbol('AppConfig');

export interface AppConfig {
  /** Public origin of the web app, e.g. https://app.planix.vn — used for Origin checks and email links. */
  readonly appBaseUrl: string;
}
