const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
} as const;

function timestamp(): string {
  return new Date().toLocaleTimeString('ru-RU', { hour12: false });
}

export const logger = {
  info(message: string, ...args: unknown[]): void {
    console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.green}INFO${colors.reset}  ${message}`, ...args);
  },
  warn(message: string, ...args: unknown[]): void {
    console.warn(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.yellow}WARN${colors.reset}  ${message}`, ...args);
  },
  error(message: string, ...args: unknown[]): void {
    console.error(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.red}ERROR${colors.reset} ${message}`, ...args);
  },
  ready(message: string, ...args: unknown[]): void {
    console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.cyan}READY${colors.reset} ${message}`, ...args);
  },
};
