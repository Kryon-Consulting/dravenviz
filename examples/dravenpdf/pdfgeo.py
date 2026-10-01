"""PDF geometry helpers over pypdfium2: links and destinations, tokens, stroked rectangles, text
objects with composed transforms, oriented quads and convex polygon clipping.

Coordinates are PDF user space in points with the origin at the bottom left.
"""

from __future__ import annotations

import ctypes
import math
import re
from dataclasses import dataclass

import pypdfium2 as pdfium
import pypdfium2.raw as raw

Rect = tuple[float, float, float, float]  # left, bottom, right, top
Point = tuple[float, float]
MM_PER_PT = 25.4 / 72


@dataclass(frozen=True)
class Link:
    page: int
    rect: Rect
    dest_page: int | None
    dest_x: float | None
    dest_y: float | None


@dataclass(frozen=True)
class Token:
    page: int
    text: str
    ns: str
    kind: str  # "T" (table caption), "TL" or "BR" (frame corner)
    box: Rect  # union of the loose character boxes


def page_links(pdf: pdfium.PdfDocument, index: int) -> list[Link]:
    page = pdf[index]
    out: list[Link] = []
    pos = ctypes.c_int(0)
    link = raw.FPDF_LINK()
    while raw.FPDFLink_Enumerate(page.raw, ctypes.byref(pos), ctypes.byref(link)):
        r = raw.FS_RECTF()
        if not raw.FPDFLink_GetAnnotRect(link, r):
            continue
        dest = raw.FPDFLink_GetDest(pdf.raw, link)
        if not dest:
            action = raw.FPDFLink_GetAction(link)
            dest = raw.FPDFAction_GetDest(pdf.raw, action) if action else None
        dest_page = dx = dy = None
        if dest:
            dest_page = int(raw.FPDFDest_GetDestPageIndex(pdf.raw, dest))
            has_x, has_y, has_z = raw.FPDF_BOOL(), raw.FPDF_BOOL(), raw.FPDF_BOOL()
            x, y, z = raw.FS_FLOAT(), raw.FS_FLOAT(), raw.FS_FLOAT()
            ok = raw.FPDFDest_GetLocationInPage(
                dest, ctypes.byref(has_x), ctypes.byref(has_y), ctypes.byref(has_z),
                ctypes.byref(x), ctypes.byref(y), ctypes.byref(z),
            )  # fmt: skip
            if ok and has_x.value and has_y.value:
                dx, dy = float(x.value), float(y.value)
        out.append(Link(index, (r.left, r.bottom, r.right, r.top), dest_page, dx, dy))
    return out


def _char_box_union(tp: pdfium.PdfTextPage, start: int, end: int) -> Rect:
    boxes = [tp.get_charbox(i, loose=True) for i in range(start, end)]
    return (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )


def page_tokens(pdf: pdfium.PdfDocument, index: int, namespaces: list[str]) -> list[Token]:
    """Every `DVT<ns>`, `DVF<ns>TL` and `DVF<ns>BR` on the page for the given namespaces."""
    tp = pdf[index].get_textpage()
    text = tp.get_text_range()
    out: list[Token] = []
    for ns in namespaces:
        for kind, literal in (("T", f"DVT{ns}"), ("TL", f"DVF{ns}TL"), ("BR", f"DVF{ns}BR")):
            for m in re.finditer(re.escape(literal), text):
                out.append(
                    Token(index, literal, ns, kind, _char_box_union(tp, m.start(), m.end()))
                )
    return out


def _matrix(obj: pdfium.PdfObject) -> tuple[float, float, float, float, float, float]:
    m = raw.FS_MATRIX()
    raw.FPDFPageObj_GetMatrix(obj.raw, m)
    return (m.a, m.b, m.c, m.d, m.e, m.f)


def stroked_rects(page: pdfium.PdfPage, rgb: tuple[int, int, int]) -> list[Rect]:
    """True rectangles of stroked path objects of one colour: bounds inset by half the stroke
    width (scaled by the object's matrix)."""
    out: list[Rect] = []
    for obj in page.get_objects(filter=[raw.FPDF_PAGEOBJ_PATH], max_depth=16):
        c = [ctypes.c_uint() for _ in range(4)]
        if not raw.FPDFPageObj_GetStrokeColor(obj.raw, *c):
            continue
        if (c[0].value, c[1].value, c[2].value) != rgb:
            continue
        fill, stroke = ctypes.c_int(), raw.FPDF_BOOL()
        raw.FPDFPath_GetDrawMode(obj.raw, ctypes.byref(fill), ctypes.byref(stroke))
        if not stroke.value:
            continue
        width = ctypes.c_float()
        raw.FPDFPageObj_GetStrokeWidth(obj.raw, ctypes.byref(width))
        a, b, cc, d, _, _ = _matrix(obj)
        half = width.value * math.sqrt(abs(a * d - b * cc)) / 2
        bl = [ctypes.c_float() for _ in range(4)]
        raw.FPDFPageObj_GetBounds(obj.raw, *bl)
        left, bottom, right, top = (v.value for v in bl)
        out.append((left + half, bottom + half, right - half, top - half))
    return out


def rect_edge_error(a: Rect, b: Rect) -> float:
    return max(abs(x - y) for x, y in zip(a, b, strict=True))


# ----------------------------------------------------------------------------- text objects


@dataclass(frozen=True)
class TextObj:
    text: str
    size_pt: float  # effective: font size x sqrt(|det| of the composed matrix)
    quad: list[Point]  # oriented bounds, 4 vertices
    order: int  # content order within the page


def _compose(m1: tuple, m2: tuple) -> tuple:
    """Row-vector convention (PDF): result = m1 x m2, i.e. apply m1 first, then m2."""
    a1, b1, c1, d1, e1, f1 = m1
    a2, b2, c2, d2, e2, f2 = m2
    return (
        a1 * a2 + b1 * c2,
        a1 * b2 + b1 * d2,
        c1 * a2 + d1 * c2,
        c1 * b2 + d1 * d2,
        e1 * a2 + f1 * c2 + e2,
        e1 * b2 + f1 * d2 + f2,
    )


def _text_of(obj: pdfium.PdfObject, textpage: pdfium.PdfTextPage) -> str:
    n = raw.FPDFTextObj_GetText(obj.raw, textpage.raw, None, 0)
    if n <= 0:
        return ""
    buf = (ctypes.c_ushort * n)()
    raw.FPDFTextObj_GetText(obj.raw, textpage.raw, buf, n)
    return bytes(memoryview(buf)).decode("utf-16-le").rstrip("\x00")


def text_objects(page: pdfium.PdfPage) -> list[TextObj]:
    """All text objects in content order, descending into form XObjects. The size is the font
    size times the square root of the absolute determinant of the object's matrix composed with
    every enclosing form object's matrix."""
    textpage = page.get_textpage()
    out: list[TextObj] = []
    for order, obj in enumerate(page.get_objects(filter=[raw.FPDF_PAGEOBJ_TEXT], max_depth=16)):
        size = ctypes.c_float()
        raw.FPDFTextObj_GetFontSize(obj.raw, ctypes.byref(size))
        mat = _matrix(obj)
        parent = obj.parent
        while isinstance(parent, pdfium.PdfObject):
            mat = _compose(mat, _matrix(parent))
            parent = parent.parent
        a, b, c, d, _, _ = mat
        scale = math.sqrt(abs(a * d - b * c))
        q = raw.FS_QUADPOINTSF()
        quad: list[Point] = []
        if raw.FPDFPageObj_GetRotatedBounds(obj.raw, q):
            quad = [(q.x1, q.y1), (q.x2, q.y2), (q.x3, q.y3), (q.x4, q.y4)]
        out.append(TextObj(_text_of(obj, textpage), size.value * scale, quad, order))
    return out


# ----------------------------------------------------------------------------- geometry


def point_in_rect(p: Point, r: Rect, eps: float = 0.0) -> bool:
    return r[0] - eps <= p[0] <= r[2] + eps and r[1] - eps <= p[1] <= r[3] + eps


def _area(poly: list[Point]) -> float:
    s = 0.0
    for i, (x1, y1) in enumerate(poly):
        x2, y2 = poly[(i + 1) % len(poly)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def _ccw(poly: list[Point]) -> list[Point]:
    s = sum(
        poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1]
        for i in range(len(poly))
    )
    return poly if s >= 0 else poly[::-1]


def clip_polygon(subject: list[Point], clipper: list[Point]) -> list[Point]:
    """Sutherland-Hodgman: `subject` clipped by the convex polygon `clipper`."""
    clipper = _ccw(clipper)
    out = _ccw(subject)
    for i, a in enumerate(clipper):
        b = clipper[(i + 1) % len(clipper)]
        if not out:
            break

        def inside(p: Point, a: Point = a, b: Point = b) -> bool:
            return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0

        def cross(p: Point, q: Point, a: Point = a, b: Point = b) -> Point:
            d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
            d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])
            t = d1 / (d1 - d2)
            return (p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]))

        src, out = out, []
        for j, cur in enumerate(src):
            prev = src[j - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(cross(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cross(prev, cur))
    return out


def intersection_area(p: list[Point], q: list[Point]) -> float:
    clipped = clip_polygon(p, q)
    return _area(clipped) if len(clipped) >= 3 else 0.0
