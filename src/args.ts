/* src/args.ts
	Tools for parsing command line arguments. */

import minimist from "minimist";

/** Parsed option value type, includes strings, numbers, booleans, and nulls. */
export type OptionValue = string | number | boolean | null;
/** ArgumentList provides functions for parsing command line arguments and accessing their properties. */
export class ArgumentList {
	/** Array of tuples containing option key/value pairs. */
	options: [key: string, value: OptionValue][];
	/** Array of inputted file/directory paths. */
	files: string[];

	constructor() {
		this.options = [];
		this.files = [];
	}
	/** Reset the state of this argument list. */
	reset(): ArgumentList {
		this.options = [];
		this.files = [];
		return this;
	}

	/** Parse an input argument string (or process arguments). */
	parse(args: string[] = process.argv.slice(2)): ArgumentList {
		// Parse arguments with minimist
		const parsed = minimist(args, {});

		// Loop over generated minimist arguments object
		const parsedKeys = Object.keys(parsed);
		for (let i = 0; i < parsedKeys.length; i++) {
			const parsedKey = parsedKeys[i];
			const parsedValue = parsed[parsedKey];

			// Append files if provided
			if (parsedKey === "_") {
				this.files.push(...parsedValue);
				continue;
			}

			// Or get this option's value
			let value: OptionValue;
			switch (typeof parsedValue) {
				case "string":
					switch (parsedValue) {
						case "true":	value = true;	break;
						case "false":	value = false;	break;
						case "NaN":	value = NaN;	break;
						case "null":	value = null;	break;
						default: {
							const numberValue = Number(parsedValue);
							if (numberValue === numberValue)
								value = numberValue;
							else
								value = parsedValue;
						}
					}
					break;
				case "number":
				case "boolean":
					value = parsedValue;
					break;
				default:
					continue;
			}

			// And push it onto the options array
			this.options.push([parsedKey, value]);
		}

		return this;
	}

	/** Get the value of an option. */
	option(keys: string): OptionValue {
		const keyList: string[] = keys.split(",");
		for (let i = 0; i < this.options.length; i++) {
			const option = this.options[i];
			if (keyList.includes(option[0])) return option[1];
		}
		return null;
	}
	/** Get the string value of an option. */
	string(keys: string): string | null {
		const value = this.option(keys);
		if (typeof value === "string")
			return value;
		else
			return null;
	}
	/** Get the number value of an option. */
	number(keys: string): number | null {
		const value = this.option(keys);
		if (typeof value === "number")
			return value;
		else
			return null;
	}
	/** Get the boolean value of an option. */
	boolean(keys: string): boolean | null {
		const value = this.option(keys);
		if (typeof value === "boolean")
			return value;
		else
			return null;
	}

	/** No options provided? */
	get emptyOptions(): boolean {
		return this.options.length < 1;
	}
	/** No files provided? */
	get emptyFiles(): boolean {
		return this.files.length < 1;
	}
	/** No arguments provided? */
	get empty(): boolean {
		return this.emptyOptions && this.emptyFiles;
	}
}

/** Default argument list, contains parsed arguments from process.argv. */
export const args = new ArgumentList().parse();
