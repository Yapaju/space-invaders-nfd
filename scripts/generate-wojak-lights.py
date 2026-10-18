"""Generate green/red lighting overlays in both directions. Requires Pillow.

Run from any directory: python scripts/generate-wojak-lights.py
Optional: --preview PATH writes a labeled four-panel inspection composite.
Coordinates are hand-mapped to this exact source, not automatic segmentation.
Only the output contains new pixels; source artwork is read-only.
"""
import argparse
import hashlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/mini-boss/wojak/wojak-boss-spaceship-right.png'
SOURCE_SHA256 = '7413c6046de4cf81b236cefd24ab1ead3715ad6685f0b6d1cbb01b7c3500c5f0'
CANVAS_SIZE = (1536, 1024)
NEON_GREEN = (58, 255, 91)
SUPERSAMPLE = 4
# Manually inset strips inside the dark recesses, in original source pixels.
# Small inset margins preserve the black outlines and surrounding metal.
RECESSES = {
    'left_upper': [(165, 480), (176, 480), (281, 517), (278, 525), (164, 490)],
    'left_lower': [(158, 524), (248, 554), (247, 561), (156, 532)],
    'left_shoulder': [(262, 450), (339, 469), (345, 464), (267, 444)],
    'cockpit_rim': [(736, 488), (966, 511), (959, 520), (736, 499)],
    'screen_upper_left': [(621, 468), (673, 474), (677, 478), (621, 473)],
    'screen_upper_right': [(1022, 527), (1067, 533), (1069, 528), (1024, 523)],
    'left_vent_upper': [(384, 554), (432, 564), (432, 571), (382, 561)],
    'left_vent_lower': [(379, 577), (427, 587), (427, 594), (378, 584)],
    'right_vent_upper': [(1180, 639), (1223, 637), (1223, 631), (1182, 632)],
    'right_vent_lower': [(1176, 663), (1219, 661), (1221, 654), (1178, 655)],
    'right_upper': [(1325, 582), (1411, 571), (1422, 575), (1420, 584), (1321, 598)],
    'right_lower': [(1344, 640), (1428, 626), (1435, 630), (1432, 639), (1344, 654)],
}


SOURCE_LEFT = SOURCE.with_name('wojak-boss-spaceship-left.png')
SOURCE_LEFT_SHA256 = '49c6aad134a5e4486415cf1ebe3807fb6935ac7744da95530c975e9c750d491b'
PALETTES = {
    'green': (NEON_GREEN, (110, 255, 138)),
    'red': ((255, 42, 60), (255, 100, 112)),
}


def generate():
    originals = {path: path.read_bytes() for path in (SOURCE, SOURCE_LEFT)}
    for path, expected in ((SOURCE, SOURCE_SHA256), (SOURCE_LEFT, SOURCE_LEFT_SHA256)):
        if hashlib.sha256(originals[path]).hexdigest() != expected:
            raise ValueError('Source artwork changed: inspect/remap polygons before generating.')
    sources = {direction: Image.open(path).convert('RGBA')
               for direction, path in (('right', SOURCE), ('left', SOURCE_LEFT))}
    for source in sources.values():
        assert source.size == CANVAS_SIZE
    # Compare every visible RGBA byte and alpha. The supplied images have
    # different unused RGB values ONLY where alpha is exactly zero; canonicalize
    # those invisible pixels before checking exact rendered mirror equivalence.
    def visible_pixels(image):
        visible = image.getchannel('A').point(lambda alpha: 255 if alpha else 0)
        return Image.composite(image, Image.new('RGBA', image.size), visible).tobytes()
    if visible_pixels(sources['right'].transpose(Image.Transpose.FLIP_LEFT_RIGHT)) != visible_pixels(sources['left']):
        raise ValueError('Ships are not exact mirrors; map left-side polygons separately.')
    mask = Image.new('L', tuple(v * SUPERSAMPLE for v in CANVAS_SIZE), 0)
    draw = ImageDraw.Draw(mask)
    for points in RECESSES.values():
        draw.polygon([(x * SUPERSAMPLE, y * SUPERSAMPLE) for x, y in points], fill=255)
    mask = mask.resize(CANVAS_SIZE, Image.Resampling.LANCZOS)
    overlays = {}
    for direction, source in sources.items():
        directional_mask = mask if direction == 'right' else mask.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        for name, (glow_color, core_color) in PALETTES.items():
            overlay = Image.new('RGBA', CANVAS_SIZE)
            for radius, strength, color in [(8, 0.15, glow_color), (2.5, 0.35, glow_color),
                                             (0, 0.92, core_color)]:
                alpha = directional_mask.filter(ImageFilter.GaussianBlur(radius)) if radius else directional_mask
                alpha = alpha.point(lambda value: round(value * strength))
                alpha = ImageChops.multiply(alpha, source.getchannel('A'))
                layer = Image.new('RGBA', CANVAS_SIZE, color + (0,))
                layer.putalpha(alpha)
                overlay = Image.alpha_composite(overlay, layer)
            assert overlay.getchannel('A').getextrema()[0] == 0
            output = SOURCE.with_name(f'wojak-lights-{name}-{direction}.png')
            overlay.save(output)
            overlays[(name, direction)] = overlay
            print(f'Generated {output.name}: {overlay.size}, {overlay.mode}, alpha {overlay.getchannel("A").getextrema()}')
    assert all(path.read_bytes() == before for path, before in originals.items())
    return sources, overlays


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preview', type=Path, help='Optional four-panel inspection composite')
    args = parser.parse_args()
    sources, overlays = generate()
    if args.preview:
        preview = Image.new('RGBA', (1536, 1080), (22, 28, 38, 255))
        for row, name in enumerate(('green', 'red')):
            for column, direction in enumerate(('right', 'left')):
                composite = Image.new('RGBA', CANVAS_SIZE, (22, 28, 38, 255))
                composite.alpha_composite(sources[direction])
                composite.alpha_composite(overlays[(name, direction)])
                composite = composite.resize((768, 512), Image.Resampling.LANCZOS)
                x, y = column * 768, row * 540
                preview.alpha_composite(composite, (x, y + 28))
                ImageDraw.Draw(preview).text((x + 12, y + 8), f'{name.upper()} / {direction.upper()}', fill='white')
        preview.save(args.preview)
    print(f'Both source hashes unchanged; exact visible-pixel mirror verified; {len(RECESSES)} strips per overlay.')


if __name__ == '__main__':
    main()
