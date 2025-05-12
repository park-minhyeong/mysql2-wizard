// Logger interface
export interface Logger {
  log: (message: string) => void;
  error: (message: string) => void;
  debug: (message: string) => void;
}
const template = (message: string) => `[MySQL2 Wizard] ${message}`;
export const logger: Logger = {
  log: (message: string) => console.log(template(message)),
  error: (message: string) => console.error(template(message)),
  debug: (message: string) => process.env.DEBUG === 'true' && console.debug(template(message))
};
