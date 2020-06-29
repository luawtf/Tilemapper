/* src/log.ts
	Logging facilities for tilemapper functions */

import { EventEmitter } from "events";
import { format } from "util";

/** Log level enumeration, debug is verbose, info is just normal output. */
export enum LogLevel { Debug, Info, Warn }
/** Log message structure, level and message contents. */
export interface LogMessage { level: LogLevel; message: string }

/** Callback that accepts a message, called when a log message is posted with a matching LogLevel. */
export type LogHandlerCallback = (message: string) => void;
/** Configuration of multiple LogHandlerCallbacks for different levels. */
export interface LogHandlerConfig {
	/** Callback that accepts a message, called when a log message is posted with LogLevel.Debug. */
	onDebug?: LogHandlerCallback,
	/** Callback that accepts a message, called when a log message is posted with LogLevel.Info. */
	onInfo?: LogHandlerCallback,
	/** Callback that accepts a message, called when a log message is posted with LogLevel.Warn. */
	onWarn?: LogHandlerCallback
}

/** Tilemapper logging class. */
export class Logger extends EventEmitter {
	constructor() {
		super();
		this.emit("ready");
	}

	/** Attach a LogHandlerConfig to this logger. */
	attachHandlers(config: LogHandlerConfig): void {
		if (config.onDebug)	this.on("debug", config.onDebug);
		if (config.onInfo)	this.on("info", config.onInfo);
		if (config.onWarn)	this.on("warn", config.onWarn);
	}
	/** Detach a LogHandlerConfig from this logger. */
	detachHandlers(config: LogHandlerConfig): void {
		if (config.onDebug)	this.off("debug", config.onDebug);
		if (config.onInfo)	this.off("info", config.onInfo);
		if (config.onWarn)	this.off("warn", config.onWarn);
	}

	/** Post a log message. */
	log(level: LogLevel, fmt: any, ...args: any[]): void {
		const str: string = format(fmt, ...args);
		const message: LogMessage = { level, message: str };
		this.emit("message", message);
		this.emit(
				level === LogLevel.Debug	? "debug"
			:	level === LogLevel.Info		? "info"
			:	level === LogLevel.Warn		? "warn"
			:	"unknown",
			str
		);
	}
	/** Make a function that posts a log message to a specific log level. */
	makeLogFn(level: LogLevel): (fmt: any, ...args: any[]) => void {
		return (fmt: any, ...args: any[]) => this.log(level, fmt, ...args);
	}
}

/** Global logger. */
export const logger	= new Logger();
/** Log a debug message. */
export const logDebug	= logger.makeLogFn(LogLevel.Debug);
/** Log a info message. */
export const logInfo	= logger.makeLogFn(LogLevel.Info);
/** Log a warning message. */
export const logWarn	= logger.makeLogFn(LogLevel.Warn);
