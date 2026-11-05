#!/bin/sh
# Re-export the paper's figures shown on the page (macOS: PDFKit through Swift, then WebP through Pillow).
#   fig/roadmap.pdf -> assets/figures/roadmap.webp    (masthead)
#   fig/teaser.pdf  -> assets/figures/framework.webp  (start of §2)
# Usage: sh tools/paper/export_figures.sh   (PAPER_DIR defaults to ~/Desktop/code/proactive_survey)
set -e
here=$(cd "$(dirname "$0")" && pwd)
site=$(cd "$here/../.." && pwd)
paper=${PAPER_DIR:-$HOME/Desktop/code/proactive_survey}
tmp=$(mktemp -d)
swiftc -O "$here/render_pdf.swift" -o "$tmp/render"
# the roadmap sits on the page without a white card: its outer white background becomes transparent
"$tmp/render" "$paper/fig/roadmap.pdf" "$tmp/roadmap.png" 2200
python3 "$here/clear_background.py" "$tmp/roadmap.png" "$site/assets/figures/roadmap.webp"
"$tmp/render" "$paper/fig/teaser.pdf" "$tmp/framework.png" 2200
python3 -c "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').save(sys.argv[2], quality=86, method=6); print(sys.argv[2], Image.open(sys.argv[1]).size)" "$tmp/framework.png" "$site/assets/figures/framework.webp"
rm -rf "$tmp"
echo "Check the width and height attributes of both images in index.html if a figure changed shape."
