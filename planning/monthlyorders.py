"""Monthly order plan for Peter.

Turns the Press Farm OS delivery year (cadence_data.py) into a plain
language planting guide: for each month, what the kitchens are expected
to order every week, in real counts where a conversion is known.

Run: python3 monthlyorders.py
"""

import subprocess
import sys
from pathlib import Path

from cadence_data import MONTHLY
from harvestcadence import find_chromium

HERE = Path(__file__).resolve().parent
OUT_HTML = HERE / "monthly_orders.html"
OUT_PDF = HERE / "Monthly Order Plan.pdf"

MONTH_FULL = ["January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"]
WEEKS_PER_MONTH = 4.33

# Crops that are not field planted. Everything else is Peter's to plant.
TREES_AND_VINES = {
    "Apple", "Bay Leaf", "Blackberries", "Citrus", "Evergreen Branches",
    "Fig Leaves", "Figs", "Grapes", "Green Walnuts", "Kumquat Branches",
    "Limes", "Nectarines", "Olive", "Olive Branches", "Passionfruit",
    "Peaches", "Pears", "Persimmon", "Quince", "Yuzu",
}
PERENNIALS = {
    "Aptenia", "Ice Plant", "Lavender", "Lemon Balm", "Mint", "Purple Stardust",
    "Rose Geranium", "Rosemary", "Sage", "Society Garlic", "Star Jasmine",
    "Tarragon", "Thyme", "Wormwood", "Yarrow",
}
FORAGED = {
    "Chickweed", "Miners Lettuce", "Oxalis", "Oxalis Flowers", "Wild Cress",
}
ASSEMBLED = {"Flower Bouquet"}
NON_FIELD = TREES_AND_VINES | PERENNIALS | FORAGED | ASSEMBLED

# Blossoms that fill one large container. A small counts as half a large.
BLOSSOMS_PER_LG = {"Marigold": 50, "Gem Marigold": 100, "Puff Ball Marigold": 9}

# What one EA of a crop is, in plain words.
PIECE_WORD = {
    "Nasturtium": "leaves", "Nasturtium Flowers": "flowers",
    "Squash Blossom": "blossoms", "Violas": "flowers",
    "Pea Flowers": "flowers", "Fennel Flowers": "flower heads",
    "Radish": "radishes", "Turnip": "turnips", "Hikari Turnips": "turnips",
    "Carrots": "carrots", "Borage": "leaves", "Garlic Scapes": "scapes",
    "Aptenia": "leaves", "Miners Lettuce": "leaves", "Lavender": "stems",
    "Rosemary": "stems", "Cucumber Tendril": "tendrils",
    "Eggplant": "pieces", "Beans": "pieces", "Flower Bouquet": "bouquets",
    "Peaches": "peaches", "Nectarines": "nectarines", "Apple": "apples",
    "Limes": "limes", "Yuzu": "fruit", "Quince": "fruit",
    "Persimmon": "persimmons", "Passionfruit": "fruit",
}

UNIT_WORD = {"lg": ("large", "large"), "sm": ("small", "small"),
             "qt": ("quart", "quarts"), "gb": ("green bin", "green bins"),
             "lbs": ("pound", "pounds"), "bx": ("box", "boxes"),
             "cs": ("case", "cases")}

UNIT_ORDER = ["ea", "lg", "sm", "qt", "gb", "lbs", "bx", "cs"]


def friendly(x):
    if x >= 100:
        return int(round(x / 50) * 50)
    if x >= 50:
        return int(round(x / 10) * 10)
    if x >= 20:
        return int(round(x / 5) * 5)
    return max(1, int(round(x)))


def by_crop():
    """{crop: {unit: [12 monthly totals]}} for every crop in the data."""
    crops = {}
    for item, unit, _cat, monthly in MONTHLY:
        slots = crops.setdefault(item, {}).setdefault(unit, [0.0] * 12)
        for key, qty in monthly.items():
            slots[int(key[5:7]) - 1] += float(qty)
    return crops


def phrase_for_month(item, units, mi):
    """Plain words for what to have ready in month index mi."""
    parts = []
    lg_w = sm_w = 0.0
    for unit in UNIT_ORDER:
        total = units.get(unit, [0.0] * 12)[mi]
        if total <= 0:
            continue
        w = total / WEEKS_PER_MONTH
        if unit == "lg":
            lg_w = w
        if unit == "sm":
            sm_w = w
        if unit == "ea":
            word = PIECE_WORD.get(item, "pieces")
            if w >= 5:
                parts.append(f"about {friendly(w)} {word} a week")
            else:
                parts.append(f"about {friendly(total)} {word} over the month")
        else:
            one, many = UNIT_WORD[unit]
            if w >= 0.7:
                n = friendly(w)
                parts.append(f"{n} {one if n == 1 else many} a week")
            else:
                n = friendly(total)
                parts.append(f"{n} {one if n == 1 else many} over the month")
    text = ", ".join(parts)
    per_lg = BLOSSOMS_PER_LG.get(item)
    if per_lg and (lg_w or sm_w):
        blossoms = lg_w * per_lg + sm_w * per_lg / 2
        if blossoms >= 5:
            text += f" (about {friendly(blossoms)} blossoms a week)"
    return text


CSS = """
@page { size: letter portrait; margin: 0.6in 0.55in; }
* { box-sizing: border-box; }
body { font-family: Georgia, 'Times New Roman', serif; color: #232a20;
       margin: 0; font-size: 10.5pt; }
h1 { font-size: 22pt; margin: 0 0 2px 0; }
h2 { font-size: 15pt; margin: 0 0 8px 0; border-bottom: 2px solid #3d5a3c;
     padding-bottom: 3px; color: #2c4030; }
h3 { font-size: 11.5pt; margin: 14px 0 4px 0; color: #2c4030; }
.sub { color: #5c6657; font-size: 10.5pt; margin-bottom: 14px; }
.section { page-break-before: always; }
.first { page-break-before: avoid; }
p { line-height: 1.5; margin: 6px 0; }
table { border-collapse: collapse; width: 100%; margin: 8px 0 12px 0; }
th, td { border: 1px solid #c9cfc2; padding: 5px 8px; text-align: left;
         font-size: 9.5pt; vertical-align: top; }
th { background: #3d5a3c; color: #fff; }
td.crop { font-weight: bold; white-space: nowrap; width: 32%; }
tr:nth-child(even) td { background: #fafbf8; }
ul { margin: 4px 0 8px 18px; padding: 0; }
li { line-height: 1.5; margin-bottom: 4px; }
.note { font-size: 9.5pt; }
.card { border: 1px solid #c9cfc2; background: #fafbf8; padding: 8px 12px;
        margin: 8px 0; }
"""


def build_html():
    crops = by_crop()
    field = {k: v for k, v in crops.items() if k not in NON_FIELD}
    parts = ["<style>" + CSS + "</style>"]

    parts.append("""
<div class='first'>
<h1>Monthly Order Plan</h1>
<div class='sub'>Press Farm, Yountville. What the kitchens are expected to order each month,
so planting can stay ahead of it. Built from a full year of actual orders and deliveries,
August 2025 through July 2026, out of Press Farm OS. Generated July 30, 2026.</div>

<h2>How to use this</h2>
<p>Find the month. The table lists every field crop the kitchens took that month last year
and how much they took every week. Example: marigolds in August means having about 450
blossoms ready every week that month.</p>
<p>These numbers are what the kitchens actually took, not a guess. <b>Plant more than the
number.</b> The field has to carry picking loss, weather and bad germination, so a third
extra on top of these numbers is a safe margin.</p>
<h3>Words used here</h3>
<ul class='note'>
<li><b>Large</b> and <b>small</b> are the two harvest containers we deliver in.</li>
<li>A <b>green bin</b> is the big harvest bin for bulky crops.</li>
<li>Marigold blossom counts: French marigold, about 50 blossoms fill a large. Gem marigold,
about 100 fill a large. Puff ball, about 9 fill a large. A small counts as half a large.</li>
<li>Lettuce is cut leaf by leaf and grows back. About half a head of leaves fills a large.</li>
<li>Where a crop is slow, the amount is given for the whole month instead of per week.</li>
</ul>
<h3>Kitchen timing</h3>
<p class='note'>Deliveries go out Thursday, Saturday and Monday. The menu changes eight times
a year: January 15, March 26, April 15, May 14, June 25, August 27, October 15 and
December 10. The kitchen wants samples about three weeks before each change and full picking
volume about one week before. Crops need to be ready ahead of those dates, not on them.</p>
</div>
""")

    for mi, month in enumerate(MONTH_FULL):
        rows = []
        for item in sorted(field, key=str.lower):
            if any(units[mi] > 0 for units in field[item].values()):
                rows.append((item, phrase_for_month(item, field[item], mi)))
        parts.append(f"<div class='section'><h2>{month}</h2>")
        parts.append("<table><tr><th>Crop</th><th>Have ready every week</th></tr>")
        for item, text in rows:
            parts.append(f"<tr><td class='crop'>{item}</td><td>{text}</td></tr>")
        parts.append("</table></div>")

    # Non field page
    parts.append("""
<div class='section'>
<h2>Not for planting</h2>
<p>These come off trees, vines, established perennials, planter boxes or foraging.
They are listed so the picture is complete, but Peter does not need to plant for them.</p>
""")
    groups = [("Trees and vines", TREES_AND_VINES),
              ("Perennials and planter boxes", PERENNIALS),
              ("Foraged", FORAGED),
              ("Assembled from field flowers", ASSEMBLED)]
    for title, names in groups:
        listed = []
        for item in sorted(names & set(crops), key=str.lower):
            months = sorted({mi for units in crops[item].values()
                             for mi, q in enumerate(units) if q > 0})
            span = ", ".join(MONTH_FULL[m][:3] for m in months)
            listed.append(f"<li><b>{item}</b>: {span}</li>")
        if listed:
            parts.append(f"<h3>{title}</h3><ul class='note'>" + "".join(listed) + "</ul>")
    parts.append("</div>")

    # Forward notes
    parts.append("""
<div class='section'>
<h2>Changes coming, plant for these</h2>
<ul>
<li><b>Borage up.</b> Chef Phil wants borage in volume for a wine cellar concept.
Last year it ran about 1 large a week in early summer. Plant well past that.</li>
<li><b>Alyssum down.</b> Chef Phil dislikes alyssum. Do not plant more for PRESS.
Under-Study still takes a little.</li>
<li><b>Puff ball marigold is new.</b> Added to the order list in June 2026, about 9 blossoms
fill a large. No order history yet, expect orders to start this season.</li>
<li><b>Ox Heart carrots.</b> PRESS fall and winter only, about 450 carrots a week. One bulk
harvest in November of about 8,500 carrots from Quadrant 4 goes into the walk in and
carries into late February. The carrot rows in the monthly tables are what the kitchen
drew, the planting target is the 8,500.</li>
<li><b>Corn stays in Quadrant 3.</b> Peter's standing call. Corn has no order history in
the system yet.</li>
<li><b>Egyptian star flower</b> dies in winter even under frost cloth. Replant each spring.</li>
<li><b>Beans</b> are picked for flowers, tips and pods 1 to 3 inches. Mix varieties for red,
pink, purple and peach flowers.</li>
<li><b>Patty pans</b> are picked at quarter size or smaller.</li>
</ul>
</div>
""")
    return "".join(parts)


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
    required = ["Monthly Order Plan", "How to use this"] + MONTH_FULL + [
        "Not for planting", "Changes coming", "blossoms a week",
        "Nasturtium", "Ox Heart"]
    missing = [r for r in required if r not in text]
    if missing:
        sys.exit(f"verification FAILED, missing: {missing}")
    print(f"OK: {len(reader.pages)} pages, all {len(required)} check strings found")


if __name__ == "__main__":
    OUT_HTML.write_text(build_html(), encoding="utf-8")
    render_pdf()
    verify_pdf()
