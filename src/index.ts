/* src/index.ts
	Application entrypoint */

import { promises as fs, read } from "fs";
import path from "path";

import { readSequences } from "./sequence";
import { compositeSequences } from "./composite";

import yargs from "yargs";

/** Set up yargs and its configuration */
const yargsConfig = yargs
	.command("tilemapper [<options>] <directory>", "Generate a tilemap from multiple images")
	.version(((): string => {
		try {
			return require("./package.json").version;
		} catch (err) {
			// TODO: Warn
			return "Unknown";
		}
	})())
	.nargs('input', 1)
	.option("verbose", {
		alias: "v",
		type: "boolean",
		description: "Enable debug output",
		default: false
	})
	.option("width", {
		alias: "w",
		type: "number",
		description: "Width of each tile",
		default: 120
	})
	.option("height", {
		alias: "h",
		type: "number",
		description: "Height of each tile",
		default: 120
	})
	.option("output", {
		alias: "o",
		type: "string",
		description: "Output file path",
		default: "out.png"
	})

/** Parsed command-line options */
const argv = yargsConfig.argv;

// Make sure we have a <directory>
if (argv._.length < 1) {
	yargs.showHelp();
	process.exit(1);
} else if (argv._.length > 1) {
	throw new Error(`Expected 1 input <directory> argument, got ${argv._.length} input argument(s)`);
}

/** Current configuration */
const settings = ((): {
	input: string,
	output: string,
	jpeg: boolean,
	width: number,
	height: number,
	verbose: boolean
} => {
	const useJPEG: boolean = ["jpg", "jpeg"].includes(path.extname(argv.output).replace(/^\./, ""));
	return {
		input: argv._[0],
		output: argv.output,
		jpeg: useJPEG,
		width: argv.width,
		height: argv.height,
		verbose: argv.verbose
	}
})();

// Run everything asynchronously
(async () => {
	// Read sequences
	const sequences = await readSequences(settings.input);

	// Composite them into a map
	const sharpMap = await compositeSequences(sequences, settings.width, settings.height);

	// Convert the map to a buffer
	let buf: Buffer;
	if (settings.jpeg) buf = await sharpMap.jpeg().toBuffer();
	else buf = await sharpMap.png().toBuffer();

	// Write it to the disk
	await fs.writeFile(settings.output, buf);
})();
