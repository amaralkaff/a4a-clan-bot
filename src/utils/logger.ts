type LogLevel = 'info' | 'error' | 'warn' | 'debug';

class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatError(error: any): string {
    if (error instanceof Error) {
      return `${error.message}\nStack: ${error.stack}`;
    }
    if (typeof error === 'object') {
      return JSON.stringify(error, null, 2);
    }
    return String(error);
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = this.getTimestamp();
    const formattedArgs = args.map(arg => {
      if (arg instanceof Error || (arg && typeof arg === 'object')) {
        return this.formatError(arg);
      }
      return String(arg);
    }).join(' ');

    return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs ? ' ' + formattedArgs : ''}`;
  }

  info(message: string, ...args: any[]): void {
    console.log(this.formatMessage('info', message, ...args));
  }

  error(message: string, ...args: any[]): void {
    console.error(this.formatMessage('error', message, ...args));
  }

  warn(message: string, ...args: any[]): void {
    console.warn(this.formatMessage('warn', message, ...args));
  }

  debug(message: string, ...args: any[]): void {
    console.debug(this.formatMessage('debug', message, ...args));
  }
}

export const logger = new Logger();