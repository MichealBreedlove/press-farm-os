"""Harvest cadence document for Press Farm.

Reads cadence_data.py (pulled from Press Farm OS deliveries, the financial
source of truth) and writes an HTML file, then renders it to PDF with the
Playwright Chromium binary and verifies the PDF text with pypdf.

Run: python3 harvestcadence.py
"""

import shutil
import subprocess
import sys
from pathlib import Path

from cadence_data import MONTHLY, SPLIT_90D, MARIGOLD_HISTORY

HERE = Path(__file__).resolve().parent
OUT_HTML = HERE / "harvest_cadence.html"
OUT_PDF = HERE / "Harvest Cadence 2026.pdf"

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
WEEKS_PER_MONTH = 4.33

SECTIONS = [
    ("Edible flowers", {"flowers"}),
    ("Herbs, leaves and greens", {"herbs_leaves", "micros_leaves"}),
    ("Vegetables and fruit", {"fruit_veg"}),
    ("Salad mixes", {"kits"}),
]

UNIT_LABEL = {
    "ea": "EA", "lg": "LG", "sm": "SM", "qt": "QT",
    "gb": "GB", "lbs": "LBS", "bx": "BX", "cs": "CS",
}

# Notes shown on the crop rows that need them. Plain language.
CROP_NOTES = {
    "Marigold": "French type. About 50 blossoms fill one LG.",
    "Gem Marigold": "About 100 blossoms fill one LG.",
    "Lettuce": "Cut and come again by the leaf. About half a head fills one LG.",
    "Beans": "Picked for flowers, tips and pods 1 to 3 inches. Mixed varieties.",
    "Patty Pan Squash": "Picked at quarter size or smaller.",
    "Carrots": "Ox Hearts are PRESS fall and winter only. One November bulk harvest goes to the walk in and carries into late February.",
    "Nasturtium": "Counted by the leaf or flower. The back wall broadcast covers this.",
    "Cauliflower": "Harvested then pickled.",
    "Oxalis": "Wild sorrel, foraged rather than grown.",
    "Miners Lettuce": "Foraged in late winter.",
    "Squash Blossom": "Counted by the blossom.",
}


def month_qty(monthly):
    """Collapse {YYYY-MM: qty} into a 12 slot list indexed Jan to Dec."""
    out = [0.0] * 12
    for key, qty in monthly.items():
        out[int(key[5:7]) - 1] += float(qty)
    return out


def fmt_weekly(monthly_total):
    if monthly_total <= 0:
        return ""
    w = monthly_total / WEEKS_PER_MONTH
    if w >= 10:
        return f"{w:,.0f}"
    if w >= 1:
        r = round(w, 1)
        return f"{r:.0f}" if r == int(r) else f"{r:.1f}"
    return f"{max(round(w, 1), 0.1):.1f}"


def fmt_total(total):
    r = round(total, 1)
    return f"{r:,.0f}" if r == int(r) else f"{r:,.1f}"


CSS = """
@page { size: letter portrait; margin: 0.55in 0.5in; }
* { box-sizing: border-box; }
body { font-family: Georgia, 'Times New Roman', serif; color: #232a20;
       margin: 0; font-size: 10pt; }
h1 { font-size: 21pt; margin: 0 0 2px 0; letter-spacing: 0.5px; }
h2 { font-size: 13.5pt; margin: 0 0 6px 0; border-bottom: 2px solid #3d5a3c;
     padding-bottom: 3px; color: #2c4030; }
h3 { font-size: 11pt; margin: 14px 0 4px 0; color: #2c4030; }
.sub { color: #5c6657; font-size: 10pt; margin-bottom: 14px; }
.section { page-break-before: always; }
.first { page-break-before: avoid; }
p { line-height: 1.45; margin: 5px 0; }
table { border-collapse: collapse; width: 100%; margin: 6px 0 10px 0; }
th, td { border: 1px solid #c9cfc2; padding: 2.5px 4px; text-align: right;
         font-size: 7.6pt; font-family: Arial, Helvetica, sans-serif; }
th { background: #3d5a3c; color: #fff; font-weight: bold; text-align: center; }
td.crop { text-align: left; font-weight: bold; white-space: nowrap; }
td.unit { text-align: center; color: #5c6657; }
td.on { background: #eef3ea; }
td.peak { background: #d8e4d2; font-weight: bold; }
td.tot { background: #f4f1e8; font-weight: bold; }
tr:nth-child(even) td.crop { background: #fafbf8; }
.legend { font-size: 8.5pt; color: #5c6657; margin: 2px 0 8px 0;
          font-family: Arial, Helvetica, sans-serif; }
.card { border: 1px solid #c9cfc2; background: #fafbf8; padding: 8px 12px;
        margin: 8px 0; }
.note { font-size: 9pt; }
ul { margin: 4px 0 8px 18px; padding: 0; }
li { line-height: 1.4; margin-bottom: 3px; }
.wide th, .wide td { font-size: 8.6pt; padding: 3.5px 6px; }
"""


def grid_table(rows):
    """rows: list of (item, unit, twelve_month_list)."""
    head = ["<tr><th style='text-align:left'>Crop</th><th>Unit</th>"]
    head += [f"<th>{m}</th>" for m in MONTH_NAMES]
    head.append("<th>Year</th></tr>")
    body = []
    for item, unit, months in rows:
        peak = max(months)
        cells = [f"<td class='crop'>{item}</td>",
                 f"<td class='unit'>{UNIT_LABEL.get(unit, unit.upper())}</td>"]
        for q in months:
            if q <= 0:
                cells.append("<td></td>")
            else:
                cls = "peak" if q == peak else "on"
                cells.append(f"<td class='{cls}'>{fmt_weekly(q)}</td>")
        cells.append(f"<td class='tot'>{fmt_total(sum(months))}</td>")
        body.append("<tr>" + "".join(cells) + "</tr>")
    return "<table>" + "".join(head) + "".join(body) + "</table>"


def build_html():
    parts = []
    parts.append("<style>" + CSS + "</style>")

    # Page 1: how to read this
    parts.append("""
<div class='first'>
<h1>Harvest Cadence</h1>
<div class='sub'>Press Farm, Yountville. Expected weekly yield per crop, built from one full year
of Press Farm OS delivery records, August 2025 through July 2026. Generated July 30, 2026.</div>

<h2>How to read this</h2>
<p>Each table shows one crop per row. The number in a month column is the average quantity
delivered per week during that month. A blank cell means nothing was delivered that month.
The shaded cell is the crop's strongest month. The Year column is the total delivered over
the whole year.</p>
<p>These numbers come from the delivery log, which records what actually left the farm for the
kitchens. That makes this a record of proven demand, not a guess. If a crop shows 2 LG per week
in June, the kitchens actually took that much last June, and planting to match it is safe.</p>

<h3>Units</h3>
<ul class='note'>
<li><b>EA</b> means each. Individual pieces, counted one by one. Used for nasturtium leaves,
radishes, turnips, squash blossoms, violas and stone fruit.</li>
<li><b>LG</b> means large container and <b>SM</b> means small container. Most herbs, flowers
and leaves move in these.</li>
<li><b>QT</b> means quart. Cilantro, radish flowers and some mustard flowers move by the quart.</li>
<li><b>GB</b> means green bin, the large harvest bin used for bulk items like branches,
cucumbers and salad heads.</li>
<li><b>LBS</b> is pounds, <b>BX</b> is box, <b>CS</b> is case. Bulk summer crops like tomatoes
and peppers move by weight.</li>
</ul>

<h3>Container counts</h3>
<ul class='note'>
<li>French marigold, about 50 blossoms per LG. Puff ball marigold, about 9 per LG.
Gem marigold, about 100 per LG.</li>
<li>Lettuce is cut and come again by the leaf, about half a head per LG.</li>
</ul>

<h3>Demand baseline</h3>
<p class='note'>PRESS covers 100 to 200 per day on weekends and 30 to 100 per day on weekdays.
This cross checks against the Ox Heart carrot rate of about 450 per week at half a carrot per
guest. Under-Study takes 150 to 300 pieces of tiny vegetables weekly. Deliveries run Thursday,
Saturday and Monday, ordered by the chefs the night before.</p>
</div>
""")

    # Category grids
    for title, cats in SECTIONS:
        rows = []
        for item, unit, cat, monthly in MONTHLY:
            if cat in cats:
                rows.append((item, unit, month_qty(monthly)))
        rows.sort(key=lambda r: (r[0].lower(), r[1]))
        parts.append(f"<div class='section'><h2>{title}</h2>")
        parts.append("<div class='legend'>Numbers are average quantity per week for that month. "
                     "Shaded cell is the peak month. Year column is the annual total.</div>")
        parts.append(grid_table(rows))
        notes = [(item, CROP_NOTES[item]) for item in
                 sorted({r[0] for r in rows} & set(CROP_NOTES))]
        if notes:
            parts.append("<h3>Notes</h3><ul class='note'>")
            for item, note in notes:
                parts.append(f"<li><b>{item}.</b> {note}</li>")
            parts.append("</ul>")
        parts.append("</div>")

    # Split page + marigold answer + open questions
    parts.append("""
<div class='section'>
<h2>Who takes what</h2>
<p>Split of notable crops by restaurant over the last 90 days. Quantity is per week in weeks
that restaurant took a delivery of the item.</p>
<table class='wide'><tr><th style='text-align:left'>Crop</th><th>Unit</th>
<th style='text-align:left'>Restaurant</th><th>Per week</th></tr>
""")
    for item, unit, rest, qty in SPLIT_90D:
        q = f"{qty:,.0f}" if qty == int(qty) else f"{qty:,.1f}"
        parts.append(f"<tr><td class='crop'>{item}</td>"
                     f"<td class='unit'>{UNIT_LABEL.get(unit, unit.upper())}</td>"
                     f"<td style='text-align:left'>{rest}</td><td>{q}</td></tr>")
    parts.append("</table>")

    parts.append("""
<h3>The marigold question, answered from the data</h3>
<div class='card note'>
<p>Press Farm OS tracks marigold types as separate items, so container counts are per type,
not a combined total. Over the last year the generic Marigold item, which is the French type,
peaked at about 5 LG plus 16 SM per week in September and runs 1 to 2 LG per week in early
summer. Gem Marigold is newer in the log and runs about 1 LG or a couple SM per week since
April 2026. Gem Marigold Leaf is its own item at 1 to 2 LG per week. Puff Ball Marigold was
added to the catalog in June 2026 and has no deliveries logged yet. So the working figure of
2 to 3 LG per week reads as per type at current pace, with the French type historically
capable of much more in September.</p>
</div>

<h3>Answered from Press Farm OS</h3>
<ul class='note'>
<li><b>How greens and herbs are counted.</b> Almost everything moves in LG and SM containers.
Cilantro and radish flowers go by the quart. Salad mixes go by LG or green bin. Piece counted
crops are nasturtium leaves, radishes, turnips, squash blossoms, violas and stone fruit.</li>
<li><b>Under-Study volume.</b> The tiny vegetable claim holds. Under-Study took radishes at
roughly 380 EA per delivery week and one 3,300 turnip flush in May, plus about 67 nasturtium
leaves per week and around 26 flower bouquets per week in summer.</li>
<li><b>Nasturtium scale.</b> The single biggest count crop. About 32,500 leaves per year,
running 500 to 1,100 EA per week most of the year, with PRESS taking most of it.</li>
</ul>

<h3>Still open, needs Micheal</h3>
<ul class='note'>
<li>Days each restaurant is open and which days count as weekend for the cover math.
Not recorded in the OS.</li>
<li>Physical size of the LG and SM containers. The OS treats them as labels only.</li>
<li>Which crops are plated components versus garnish. The data hints at it, piece counted
items read as plated and container items read as garnish, but the kitchens should confirm.</li>
<li>Logged carrot deliveries, about 4,200 EA over the season with 3,500 in January, sit below
the 8,500 bulk harvest figure. Walk in draws may not be fully logged. Worth reconciling
before planting to the log number.</li>
</ul>
</div>
""")
    return "".join(parts)


def find_chromium():
    for pattern in ("chromium-*/chrome-linux/chrome", "chromium/chrome"):
        for hit in sorted(Path("/opt/pw-browsers").glob(pattern)):
            if hit.is_file():
                return str(hit)
    return shutil.which("chromium") or shutil.which("chromium-browser")


def render_pdf():
    chrome = find_chromium()
    if not chrome:
        sys.exit("no chromium found")
    subprocess.run(
        [chrome, "--headless=new", "--no-sandbox", "--disable-gpu",
         "--no-pdf-header-footer", f"--print-to-pdf={OUT_PDF}",
         OUT_HTML.as_uri()],
        check=True, capture_output=True)


def verify_pdf():
    from pypdf import PdfReader
    reader = PdfReader(str(OUT_PDF))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    required = ["Harvest Cadence", "Edible flowers", "Herbs, leaves and greens",
                "Vegetables and fruit", "Salad mixes", "Who takes what",
                "Nasturtium", "Gem Marigold", "Patty Pan Squash",
                "marigold question", "Still open"]
    missing = [r for r in required if r not in text]
    if missing:
        sys.exit(f"verification FAILED, missing: {missing}")
    print(f"OK: {len(reader.pages)} pages, all {len(required)} check strings found")


if __name__ == "__main__":
    OUT_HTML.write_text(build_html(), encoding="utf-8")
    render_pdf()
    verify_pdf()
