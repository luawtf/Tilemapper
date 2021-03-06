#!/usr/bin/env node

/* src/cli.ts
	Command line interface for the tilemapper. */

import { promises as fs } from "fs";
import path from "path";
import ora, { Ora } from "ora";

import { args } from "./args";
import { logInfo, logFatal, logger, LogHandlerConfig } from "./log";
import { walkPaths, PathInfo, toPathInfo } from "./filewalker";
import { composite, OutputType, ResizeKernel, ResizeFit } from "./compositor";
import { LayoutMode } from "./index";
import {
	layoutList, layoutSequences, layoutAnimations,
	Layout, SequenceLayout, AnimationLayout,
	LayoutOptions, ListLayoutOptions, SequenceLayoutOptions, AnimationLayoutOptions
} from "./layouts";

/** src/cli.ts does not export anything. */
export = null;

// Load package info
const packageInfo: { name: string; version: string; description: string } = require("../package.json");
// Generate help and version text
const versionString = `${packageInfo.name} v${packageInfo.version}`;
const helpString =
`Usage:
    ${packageInfo.name} file/directory... [options]
Options:
    -h,-?,--help        Print this help message
    -V,--version        Print version information

    -v,--verbose        Output verbose logging information

    -e,--extensions     Comma-separated list of file extensions to match when
                        searching for input files, defaults to
                        "png,jpg,jpeg,gif,webp,tiff"

    -o,--output         Specify output file path. Defaults to "tilemap.png"
    -j,--output-json    Enable JSON information output and optionally provide a
                        file path to write the .json file to

    -t,--output-type    Specify output image data format, usually assumed from
                        output file extension. Valid values include: "png",
                        "jpg", "webp", and "tiff"

    -l,--l-list         Generate a tilemap layout in the simplest manner
                        possible, just put all input tiles in a continuous list
                        going from left to right, looping back to the next line
                        once "--l-list-length" is reached (default)
    -s,--l-sequence     Generate a tilemap layout that contains "sequences".
                        Each "sequence" is a continuous list of frames, usually
                        for an animation. Each folder in the inputted paths will
                        be treated as a new sequence
    -a,--l-animation    Advanced. Generate a tilemap layout that contains
                        "animations", where each animation has sub-sequences for
                        different angles. Please see online documentation for
                        more information about how this mode works

    -W,--width          Width of each tile in pixels. Defaults to 128
    -H,--height         Height of each tile in pixels. Defaults to 128

    -O,--overscan       Overscan to apply to each tile. Negative numbers are
                        supported. Defaults to 0. Please see online
                        documentation for more information.

    -X,--min-x          Minimum count of tiles across the X axis
    -Y,--min-y          Minimum count of tiles across the Y axis

    -x,--l-list-length  Count of tiles across the X axis in the list layout
                        mode. Defaults to 16

    -L,--long-names     Use long tile/sequence/animation names? This will take
                        paths like "Art/Player/Walk_Forward/90/0.png" and output
                        "Art/Player/Walk_Forward" instead of just "Walk_Forward"

    -f,--fit            Fit mode to use when resizing tiles, if a tile needs to
                        be resized. Valid values include: "contain", "cover",
                        "fill", "inside", and "outside". Defaults to "contain".
                        Please see online documentation for more information
    -k,--kernel         Kernel mode to use when resizing tiles, if a tile needs
                        to be resized. Valid values include: "nearest", "cubic",
                        "mitchell", "lancoz2", and "lancoz3". Defaults to
                        "nearest". Please see online documentation for more
                        information

Version:
    ${versionString}`;

// Print help/version text if requested
if (args.empty || args.boolean("h,?,help")) {
	console.error(helpString);
	process.exit(0);
}
if (args.boolean("V,version")) {
	console.error(versionString);
	process.exit(0);
}

/** LogSpinner provides an interface between an Ora CLI spinner and the Logger class. */
const spin = new class LogSpinner {
	/** Show verbose output? */
	verbose: boolean;
	/** Ora spinner instance. */
	readonly ora: Ora;

	/** Handler configuration for this LogSpinner */
	protected handlers: LogHandlerConfig;

	constructor() {
		// Check for verbose mode
		this.verbose = !!args.boolean("v,verbose");

		// Create the new Ora instance
		this.ora = ora({
			spinner: "triangle"
		});

		// Set and register handlers
		this.handlers = {
			onDebug:	(message) => this.onDebug(message),
			onInfo:		(message) => this.onInfo(message),
			onWarn:		(message) => this.onWarn(message),
			onFatal: 	(message) => this.onFatal(message),
		};
		logger.attachHandlers(this.handlers);
	}

	/** Start the spinner. */
	start(): void {
		this.ora.start("cli: Logging started");
	}
	/** Stop the spinner and clean up. */
	stop(): void {
		if (this.verbose)
			this.ora.info().stop();
		else
			this.ora.stop();
	}

	// Log message handlers
	protected onDebug(message: string): void {
		// if (!this.verbose) return;
		// this.ora.info().start(message);
		this.onInfo(message);
	}
	protected onInfo(message: string): void {
		if (this.verbose)
			this.ora.info().start(message);
		else
			this.ora.text = message;
	}
	protected onWarn(message: string): void {
		this.ora.warn(message).start();
	}
	protected onFatal(message: string): void {
		if (this.verbose)
			this.ora.info().start(message).fail();
		else
			this.ora.fail(message);
	}
}();

// Start the spinner and print out a log message
spin.start();
logInfo("cli: Starting up");

// Parse the program arguments into a configuration
const config: {
	inputPaths: string[];
	extensions: string[] | null;

	outputPath: string | null;
	outputJSON: string | boolean;
	outputType: string | null;

	layoutMode: LayoutMode | null;

	width: number | null;
	height: number | null;

	overscan: number | null;

	minCountX: number | null;
	minCountY: number | null;

	listLength: number | null;

	longNames: boolean;

	fit: string | null;
	kernel: string | null;
} = {
	inputPaths:	[...args.files],
	extensions:	args.string("e,extensions")?.split(",") ?? null,
	outputPath:	args.string("o,output"),
	outputJSON:	args.string("j,output-json") ?? !!args.boolean("j,output-json"),
	outputType:	args.string("t,output-type"),
	width:		args.number("W,width"),
	height:		args.number("H,height"),
	overscan:	args.number("O,overscan"),
	minCountX:	args.number("X,min-x"),
	minCountY:	args.number("Y,min-y"),
	listLength:	args.number("x,l-list-length"),
	longNames:	!!args.boolean("L,long-names"),
	fit:		args.string("f,fit"),
	kernel:		args.string("k,kernel"),
	layoutMode: (
			args.boolean("l,l-list")	? LayoutMode.ListLayout
		:	args.boolean("s,l-sequence")	? LayoutMode.SequenceLayout
		:	args.boolean("a,l-animation")	? LayoutMode.AnimationLayout
		:	null
	)
};

/** Settings related to input. */
interface InputSettings {
	inputPaths: string[];
	extensions: string[] | null;
}
/** Settings related to output. */
interface OutputSettings {
	outputPath: string;
	outputJSON: string | null;
	outputType: OutputType;
}
/** Settings that influence the output of the tilemapper. */
interface TilemapperSettings {
	width: number | null;
	height: number | null;
	overscan: number | null;
	minCountX: number | null;
	minCountY: number | null;
	listLength: number | null;
	longNames: boolean;
}
/** Settings that influence the way the compositor resizes images. */
interface ResizeSettings {
	fit: ResizeFit | null;
	kernel: ResizeKernel | null;
}

// Create the InputSettings config
const inputSettings = ((): InputSettings => {
	const settings: InputSettings = {
		inputPaths: config.inputPaths,
		extensions: config.extensions
	};

	// Double-check that input paths were provided (sanity check)
	if (settings.inputPaths.length < 1) {
		throw logFatal("cli: No input paths specified");
	}
	// Reset extensions if none were provided (sanity check)
	if (!settings.extensions || settings.extensions.length < 1) {
		settings.extensions = null;
	}

	return settings;
})();
// Create the OutputSettings config
const outputSettings = ((): OutputSettings => {
	const settings: OutputSettings = {
		outputPath: "tilemap.png",
		outputJSON: null,
		outputType: OutputType.PNG
	};

	// Use the user provided output path if there is one
	if (config.outputPath) {
		settings.outputPath = config.outputPath;
	}
	// Parse the output path (for its extension)
	const outputPathInfo: PathInfo = toPathInfo(process.cwd(), settings.outputPath);

	// Generate an output JSON path if requested
	if (config.outputJSON) {
		if (typeof config.outputJSON === "string") {
			settings.outputJSON = config.outputJSON;
		} else {
			settings.outputJSON = path.join(outputPathInfo.dirname, outputPathInfo.basename + ".json");
		}
	}

	// Set the correct output type
	switch (config.outputType) {
		case "png":	settings.outputType = OutputType.PNG;	break;
		case "jpg":	settings.outputType = OutputType.JPEG;	break;
		case "webp":	settings.outputType = OutputType.WEBP;	break;
		case "tiff":	settings.outputType = OutputType.TIFF;	break;
		case null: {
			// Oops, no output type! Try and assume type based on output path extension
			switch (outputPathInfo.extnameLower) {
				default:
				case "png":	settings.outputType = OutputType.PNG;	break;
				case "jpg":
				case "jpeg":	settings.outputType = OutputType.JPEG;	break;
				case "webp":	settings.outputType = OutputType.WEBP;	break;
				case "tiff":	settings.outputType = OutputType.TIFF;	break;
			}
			break;
		}
		default: {
			throw logFatal(`cli: Invalid output-type "${config.outputType}"`);
			break;
		}
	}

	return settings;
})();
// TilemapperSettings can just re-use the already existing config
const tilemapperSettings = ((): TilemapperSettings => {
	return { ...config };
})();
// Create the ResizeSettings config
const resizeSettings = ((): ResizeSettings => {
	const settings: ResizeSettings = { fit: null, kernel: null };

	switch (config.fit) {
		case null:						break;
		case "contain":	settings.fit = ResizeFit.Contain;	break;
		case "cover":	settings.fit = ResizeFit.Cover;		break;
		case "fill":	settings.fit = ResizeFit.Fill;		break;
		case "inside":	settings.fit = ResizeFit.Inside;	break;
		case "outside":	settings.fit = ResizeFit.Outside;	break;
		default: {
			throw logFatal(`cli: Invalid fit "${config.fit}"`);
			break;
		}
	}
	switch (config.kernel) {
		case null:								break;
		case "nearest":		settings.kernel = ResizeKernel.Nearest;		break;
		case "cubic":		settings.kernel = ResizeKernel.Bicubic;		break;
		case "mitchell":	settings.kernel = ResizeKernel.Mitchell;	break;
		case "lancoz2":		settings.kernel = ResizeKernel.Lancoz2;		break;
		case "lancoz3":		settings.kernel = ResizeKernel.Lancoz3;		break;
		default: {
			throw logFatal(`cli: Invalid kernel "${config.kernel}"`);
			break;
		}
	}

	return settings;
})();

// Now that we're configured, run the rest of the app with async/await
(async () => {
	// Warn if we're in verbose mode
	if (spin.verbose) {
		logInfo("cli: Running in verbose mode");
	}

	// Find files using walkPaths
	logInfo("cli: Finding files");
	const pathInfos: PathInfo[] = await walkPaths(inputSettings.inputPaths, inputSettings.extensions ?? undefined);
	if (pathInfos.length < 1) {
		throw logFatal("cli: No input images found");
	}

	// Generate a generic configuration for all layout methods
	const layoutConfig: Partial<LayoutOptions & ListLayoutOptions & SequenceLayoutOptions & AnimationLayoutOptions> = {
		width:			tilemapperSettings.listLength ?? undefined,
		longTileNames:		tilemapperSettings.longNames,
		longSequenceNames:	tilemapperSettings.longNames,
		longAnimationNames:	tilemapperSettings.longNames
	};

	// Call the correct layout function
	let layout: Layout | SequenceLayout | AnimationLayout;
	switch (config.layoutMode) {
		case null:
		case LayoutMode.ListLayout:
			layout = layoutList(pathInfos, layoutConfig);
			break;
		case LayoutMode.SequenceLayout:
			layout = layoutSequences(pathInfos, layoutConfig);
			break;
		case LayoutMode.AnimationLayout:
			layout = layoutAnimations(pathInfos, layoutConfig);
			break;
		default: {
			throw logFatal("cli: Layout switch fallthrough");
			break;
		}
	}
	// Ensure a valid layout was generated
	if (layout.tileset.length < 1 || !layout.tileset[0] || layout.tileset[0].length < 1) {
		throw logFatal("cli: Generated layout contains no images");
	}

	// Composite this layout into an image
	const [data, info] = await composite(
		layout.tileset,
		outputSettings.outputType,
		tilemapperSettings.width	?? undefined,	tilemapperSettings.height	?? undefined,
		tilemapperSettings.overscan	?? undefined,	tilemapperSettings.overscan	?? undefined,
		resizeSettings.fit		?? undefined,	resizeSettings.kernel		?? undefined,
		tilemapperSettings.minCountX	?? undefined,	tilemapperSettings.minCountY	?? undefined
	);
	// Stringify the returned "info" from the compositor
	const jsonData = JSON.stringify({
		info, layout
	}, null, "\t") + "\n";

	// Write the output image
	logInfo("cli: Writing output image");
	await fs.writeFile(outputSettings.outputPath, data);

	// Write the JSON if requested
	if (outputSettings.outputJSON) {
		logInfo("cli: Writing output JSON");
		await fs.writeFile(outputSettings.outputJSON, jsonData, "utf-8");
	}

	// Done!
	logInfo("cli: Done");
	spin.stop();
})()
	// Handle any exceptions that get generated while running the tilemapper
	.catch((err: Error) => {
		let message: string;
		if (typeof err === "object" && err.message)
			message = String(err.message);
		else
			message = String(err);

		logFatal(`cli: (exception) ${message}`);
		process.exit(1);
	});
