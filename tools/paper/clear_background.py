"""Make the white background around a figure transparent, keeping white areas inside the figure.

The white region connected to the image border is cleared; the pixels at its edge get an alpha from
how white they are, so anti-aliased outlines blend into any page background.
Usage: python3 clear_background.py <in.png> <out.webp>"""
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
rgb = Image.open(src).convert('RGB')
w, h = rgb.size
r, g, b = rgb.split()
low = ImageChops.darker(ImageChops.darker(r, g), b)            # the darkest channel of each pixel
near_white = low.point(lambda v: 255 if v >= 236 else 0)
for x in list(range(0, w, 40)) + [w - 1]:                      # flood from every white pixel on the border
    for y in (0, h - 1):
        if near_white.getpixel((x, y)) == 255:
            ImageDraw.floodfill(near_white, (x, y), 128)
for y in list(range(0, h, 40)) + [h - 1]:
    for x in (0, w - 1):
        if near_white.getpixel((x, y)) == 255:
            ImageDraw.floodfill(near_white, (x, y), 128)
outside = near_white.point(lambda v: 255 if v == 128 else 0)
edge = ImageChops.subtract(outside.filter(ImageFilter.MaxFilter(5)), outside)
# alpha: 0 outside; at the edge, the whiter the pixel the more transparent; 255 elsewhere
edge_alpha = low.point(lambda v: max(0, min(255, (255 - v) * 3)))
alpha = Image.new('L', (w, h), 255)
alpha.paste(0, mask=outside)
alpha.paste(edge_alpha, mask=edge)
out = rgb.copy()
out.putalpha(alpha)
out.save(dst, quality=88, alpha_quality=95, method=6)
print(dst, out.size, 'transparent %.0f%%' % (100 * alpha.histogram()[0] / (w * h)))
