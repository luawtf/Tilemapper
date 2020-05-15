/* src/index.ts
	Application entrypoint */

import { promises as fs, read } from "fs";
import path from "path";

import { readSequences } from "./sequence";
import { compositeSequences } from "./composite";

import yargs from "yargs";

/** Set up yargs and its configuration */
const yargsConfig = yargs
	.command("[<options>] <directory>", "Generate a tilemap from multiple images")
	.version(((): string => {
		try {
			return require("../package.json").version;
		} catch (err) {
			console.warn("Failed to read version information from package.json");
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
	console.error(`Expected 1 input <directory> argument, got ${argv._.length} input argument(s)`);
	process.exit(1);
}

/** Current configuration */
export const settings = ((): {
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

// Say hi!
if (settings.verbose) console.log(`Converting sequences from "${settings.input}" to output tilemap "${settings.output}"`);

// Run everything asynchronously
(async () => {
	if (settings.verbose) console.log("Loading images from the disk...");

	// Read sequences
	const sequences = await readSequences(settings.input);

	if (settings.verbose) console.log("Generating tilemap composite information...");

	// Composite them into a map
	const sharpMap = await compositeSequences(sequences, settings.width, settings.height);

	if (settings.verbose) console.log(`Compiling output image as a ${settings.jpeg ? "JPEG" : "PNG"}...`);

	let outBuf: Buffer;
	if (settings.jpeg) {
		// Output a JPEG
		outBuf = await sharpMap
			.flatten({ background: { r: 255, g: 255, b: 255 } })
			.jpeg()
			.toBuffer();
	} else {
		// Output a PNG
		outBuf = await sharpMap.png().toBuffer();
	}

	if (settings.verbose) console.log("Writing finished tilemap image to the disk...");

	// Write it to the disk
	await fs.writeFile(settings.output, outBuf);

	if (settings.verbose) console.log("Done!");
})()
	.catch((err) => {
		console.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	});
