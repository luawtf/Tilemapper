/* src/index.ts
	Application entrypoint, parses args and runs functions */

import minimist from "minimist";

import { readSequences } from "./sequence";
import { compositeSequences, CompositeOptions, isValidFit, isValidKernel } from "./composite";
import { writeMap } from "./output";

/** Tilemapper options */
export interface Configuration {
	/** Output verbose logging messages? (default false) */
	verbose: boolean;

	/** Input directory (default ".") */
	inputDir: string;
	/** Output file (default "tilemap.png") */
	outputFile: string;

	/** Write a JPEG file instead of PNG? (default false) */
	useJPEG: boolean;

	/** Tile width (default 60) */
	width: number;
	/** Tile height (default 60) */
	height: number;
	/** Minimum tile count X (default 0) */
	minCountX: number;
	/** Minimum tile count Y (default 0) */
	minCountY: number;

	/** How to fit tiles (default "cover") */
	fit: CompositeOptions["tileFit"],
	/** Algorith used when resizing tiles (default "nearest") */
	kernel: CompositeOptions["tileKernel"]
}

/** Program binary */
const binary = "tilemapper";

/** Version message */
const version = `${binary} v2.0.2`;

/** Help message */
const help =
`Usage:
    ${binary} [options] <directory>

Options:
    -h,-?,--help        Print this help message
    -V,--version        Print version information

    -v,--verbose        Output verbose logging information

    -o,--output         Output file path (default "tilemap.png")

    -w,--width          Tile width in pixels (default 60)
    -h,--height         Tile height in pixels (default 60)

    --minimum-x         Minimum tilemap tile count on the X axis (default 0)
    --minimum-y         Minimum tilemap tile count on the Y axis (default 0)

    -f,--fit            Tile libvips fit mode
                            One of: "contain", "cover", "fill", "inside",
                            "outside"
    -k,--kernel         Tile libvips kernel format
                            One of: "nearest", "cubic", "mitchell", "lanczos2",
                            "lanczos3"

Version:
    ${version}`;


/** Get the message field of an error */
function errMessage(err: any): string {
	if (
		err instanceof Error ||
		(
			typeof err === "object" &&
			"message" in err &&
			typeof err.message === "string"
		)
	)
		return err.message;
	else
		return String(err);
}
// Handle program errors
process.on("uncaughtException", (err: any) => {
	console.error(errMessage(err));
	// console.error(err);
	process.exit(1);
});
process.on("unhandledRejection", (err: any, promise: Promise<any>) => {
	console.error(errMessage(err));
	// console.error(err);
	process.exit(1);
});

// Parse program arguments
const args = minimist(process.argv.slice(2));

/** Get a string argument */
function argString(keys: string[], defaultVal: string): string {
	for (const key of keys) {
		if (!(key in args)) continue;

		let val: any = args[key];
		if (typeof val === "string") {
			val = val.trim();
			if (val) return val;
		}
	}
	return defaultVal;
}
/** Get a number argument */
function argNumber(keys: string[], defaultVal: number): number {
	for (const key of keys) {
		if (!(key in args)) continue;

		let val: any = args[key];
		if (typeof val === "number" && isFinite(val)) return val;
		if (typeof val === "string") {
			const num = parseInt(val);
			if (isFinite(num)) return num;
		}
	}
	return defaultVal;
}
/** Get a boolean argument */
function argBoolean(keys: string[], defaultVal: boolean): boolean {
	for (const key of keys) {
		if (!(key in args)) continue;
		const val: any = args[key];
		if (typeof val === "boolean") return val;
	}
	return defaultVal;
}

// Output help message if requested
if (argBoolean(["h","?","help"], false)) {
	console.log(help);
	process.exit(0);
}
// Output version message if requested
if (argBoolean(["V", "version"], false)) {
	console.log(version);
	process.exit(0);
}

// Get input directory
const inputDir = ((): string => {
	if (args._.length > 1)
		throw new Error("Too many inputs specified");
	if (args._.length < 1 || !args._[0])
		throw new Error("Missing required argument 'directory'");
	return String(args._[0]);
})();
// Get output file
const outputFile = argString(["o", "output"], "tilemap.png");

/** Current configuration */
export const config: Configuration = {
	verbose: argBoolean(["v", "verbose"], false),
	inputDir, outputFile,
	useJPEG: /\.(jpg|jpeg)$/.test(outputFile),
	width: argNumber(["w", "width"], 60),
	height: argNumber(["h", "height"], 60),
	minCountX: argNumber(["minimum-x"], 0),
	minCountY: argNumber(["minimum-y"], 0),
	fit: argString(["f", "fit"], "cover") as CompositeOptions["tileFit"],
	kernel: argString(["k", "kernel"], "nearest") as CompositeOptions["tileKernel"]
};

// Check fit and kernel params
if (!isValidFit(config.fit))
	throw new Error("Invalid fit method '" + config.fit + "'");
if (!isValidKernel(config.kernel))
	throw new Error("Invalid kernel format '" + config.kernel + "'");

/** Running in verbose mode? */
export const verbose: boolean = config.verbose;

// Do this asynchronusly
(async () => {

	const sequences = await readSequences(config.inputDir);

	const map = await compositeSequences(sequences, {
		tileWidth: config.width,
		tileHeight: config.height,
		minTileCountX: config.minCountX,
		minTileCountY: config.minCountY,
		tileFit: config.fit,
		tileKernel: config.kernel
	});

	await writeMap(config.outputFile, config.useJPEG, map);

	if (verbose) console.log("Done!");

})();
