// Render page 1 of a PDF to PNG at a given pixel width, on a white background, or keeping the page
// transparent when a fifth argument "transparent" is given.
// Usage: render_pdf <in.pdf> <out.png> <width> [transparent]
import AppKit
import PDFKit
let args = CommandLine.arguments
guard args.count >= 4, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])), let page = doc.page(at: 0) else { exit(1) }
let transparent = args.count > 4 && args[4] == "transparent"
let width = Double(args[3])!
let box = page.bounds(for: .cropBox)
let scale = width / Double(box.width)
let w = Int(width.rounded()), h = Int((Double(box.height) * scale).rounded())
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
let ctx = NSGraphicsContext(bitmapImageRep: rep)!
NSGraphicsContext.current = ctx
let cg = ctx.cgContext
if !transparent {
  cg.setFillColor(NSColor.white.cgColor)
  cg.fill(CGRect(x: 0, y: 0, width: w, height: h))
}
cg.interpolationQuality = .high
cg.scaleBy(x: CGFloat(scale), y: CGFloat(scale))
cg.translateBy(x: -box.origin.x, y: -box.origin.y)
page.draw(with: .cropBox, to: cg)
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[2]))
