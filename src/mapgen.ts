import sharp, { OverlayOptions } from "sharp";

export async function mapTiles(tiles: Buffer[], tileWidth: number, tileHeight: number, tileCountX: number, tileCountY: number): Promise<Buffer> {
	const overlays: OverlayOptions[] = [];

	for (let x = 0; x < tileCountX; x++) {
		for (let y = 0; y < tileCountY; y++) {
			const tileBuf: Buffer | null = tiles[(y * tileCountY) + x] ?? null;
			if (tileBuf === null) continue;

			const posX = x * tileWidth;
			const posY = y * tileWidth;

			const tileSharp =
				sharp(tileBuf)
				.resize({
					width: tileWidth,
					height: tileHeight,
					position: 8,
					fit: "cover",
					kernel: "nearest"
				});

			overlays.push({
				input: await tileSharp.png().toBuffer(),
				top: posY,
				left: posX,
				// blend: "source",
				gravity: 8
			});
		}
	}

	const map =
		sharp({
			create: {
				width: tileWidth * tileCountX,
				height: tileHeight * tileCountY,
				channels: 4,
				background: "rgba(0, 0, 0, 0)"
			}
		})
		.composite(overlays);

	return map.png().toBuffer();
}
