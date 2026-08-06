"""Monthly order plan for Peter.

Turns the Press Farm OS delivery year (cadence_data.py) into a plain
language planting guide: for each month, what the kitchens are expected
to order every week, in real counts where a conversion is known.

Run: python3 monthlyorders.py
"""

import shutil
import subprocess
import sys
from pathlib import Path

from cadence_data import MONTHLY


def find_chromium():
    for pattern in ("chromium-*/chrome-linux/chrome", "chromium/chrome"):
        for hit in sorted(Path("/opt/pw-browsers").glob(pattern)):
            if hit.is_file():
                return str(hit)
    return shutil.which("chromium") or shutil.which("chromium-browser")

HERE = Path(__file__).resolve().parent

# (html_name, pdf_name, title_suffix, [(month_index, page_label), ...])
EDITIONS = [
    ("monthly_orders.html", "Monthly Order Plan.pdf", "",
     None),
    ("monthly_orders_2026.html", "Monthly Order Plan Aug-Dec 2026.pdf",
     ", August to December 2026",
     [(7, "August 2026"), (8, "September 2026"), (9, "October 2026"),
      (10, "November 2026"), (11, "December 2026")]),
]

MONTH_FULL = ["January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"]
WEEKS_PER_MONTH = 4.33

# Crops that are not field planted. Everything else is Peter's to plant.
TREES_AND_VINES = {
    "Apple", "Bay Leaf", "Bergamot", "Blackberries", "Citrus", "Creeping Vine",
    "Evergreen Branches", "Fig Leaves", "Figs", "Grapes", "Green Walnuts",
    "Kumquat Branches", "Limes", "Nectarines", "Olive", "Olive Branches",
    "Passionfruit", "Peach Blossom Branches", "Peaches", "Pears", "Persimmon",
    "Plums", "Quince", "Red Wood Foliage", "Yuzu",
}
PERENNIALS = {
    "Aptenia", "Cardoon", "Columbine Flowers", "Hibiscus", "Ice Plant",
    "Lavender", "Lemon Balm", "Mint", "Oregano", "Purple Stardust",
    "Rose Geranium", "Rosemary", "Sage", "Society Garlic", "Star Jasmine",
    "Tarragon", "Thyme", "Verbena", "Wormwood", "Yarrow",
}
FORAGED = {
    "Chickweed", "Deadnettle", "Milkweed", "Miners Lettuce", "Oxalis",
    "Oxalis Flowers", "Peppercress", "Sharp-leaved Fluellen",
    "Three Cornered Leek", "Wild Cress",
}
ASSEMBLED = {"Flower Bouquet"}
NON_FIELD = TREES_AND_VINES | PERENNIALS | FORAGED | ASSEMBLED

# Pieces that fill one LG. The farm price list prices one EA at one fiftieth
# of an LG across the catalog, so 50 is the standard. Three SM count as one LG.
PIECES_PER_LG_DEFAULT = 50
PIECES_PER_LG = {"Gem Marigold": 100, "Puff Ball Marigold": 9}
SM_PER_LG = 3

# What one piece is called, by catalog category, unless PIECE_WORD names it.
CATEGORY_WORD = {"flowers": "blossoms", "herbs_leaves": "leaves",
                 "micros_leaves": "leaves", "kits": "leaves",
                 "fruit_veg": "pieces"}

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

UNIT_WORD = {"lg": "LG", "sm": "SM", "qt": "QT", "gb": "GB",
             "lbs": "LBS", "bx": "BX", "cs": "CS"}

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
    """({crop: {unit: [12 expected monthly quantities]}}, {crop: category}).
    Each calendar month is averaged over the years it was delivered."""
    crops, cats = {}, {}
    for item, unit, cat, monthly in MONTHLY:
        cats.setdefault(item, cat)
        slots = crops.setdefault(item, {}).setdefault(unit, [0.0] * 12)
        for mo, (total, years) in monthly.items():
            slots[mo - 1] += float(total) / max(int(years), 1)
    return crops, cats


def phrase_for_month(item, cat, units, mi):
    """Plain words for what to have ready in month index mi.
    Container amounts become EA pieces: 50 per LG, three SM to one LG."""
    parts = []
    per = PIECES_PER_LG.get(item, PIECES_PER_LG_DEFAULT)
    word = PIECE_WORD.get(item) or CATEGORY_WORD.get(cat, "pieces")
    ea_m = units.get("ea", [0.0] * 12)[mi]
    lg_m = (units.get("lg", [0.0] * 12)[mi]
            + units.get("sm", [0.0] * 12)[mi] / SM_PER_LG)
    if ea_m > 0 or lg_m > 0:
        pieces_w = (ea_m + lg_m * per) / WEEKS_PER_MONTH
        if lg_m > 0 and pieces_w <= per:
            parts.append(f"at least {friendly(per)} EA {word} a week")
        elif pieces_w < 1.5:
            parts.append(f"at least 1 EA {word.rstrip('s')} a week")
        else:
            parts.append(f"about {friendly(pieces_w)} EA {word} a week")
    for unit in ("qt", "gb", "lbs", "bx", "cs"):
        total = units.get(unit, [0.0] * 12)[mi]
        if total <= 0:
            continue
        w = total / WEEKS_PER_MONTH
        n = friendly(w)
        code = UNIT_WORD[unit]
        if n <= 1:
            parts.append(f"at least 1 {code} a week")
        else:
            parts.append(f"{n} {code} a week")
    return ", ".join(parts)


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


def build_html(title_suffix="", months=None):
    if months is None:
        months = [(mi, name) for mi, name in enumerate(MONTH_FULL)]
    crops, cats = by_crop()
    field = {k: v for k, v in crops.items() if k not in NON_FIELD}
    parts = ["<style>" + CSS + "</style>"]

    parts.append(f"""
<div class='first'>
<h1>Monthly Order Plan{title_suffix}</h1>""")
    parts.append("""
<div class='sub'>Press Farm, Yountville. What the kitchens are expected to order each month,
so planting can stay ahead of it. Built from the complete order and delivery history in
Press Farm OS, July 2024 through July 2026. Generated July 30, 2026.</div>

<h2>How to use this</h2>
<p>Find the month. The table lists every field crop the kitchens have taken in that month
and how much they took every week, counted in pieces. Where a crop was delivered in the same
month in more than one year, the years are averaged. Example: marigolds in August reads about
350 EA blossoms a week, so have 350 blossoms ready every week that month.</p>
<p>These numbers are what the kitchens actually took, not a guess. They cover every delivery
ever logged: 418 to PRESS since July 2024, 32 to Under-Study since March 2026, 4 to the
Events team and 1 to Press Bar, 4,275 order lines in all. <b>Plant more than the number.</b>
The field has to carry picking loss, weather and bad germination, so a third extra on top of
these numbers is a safe margin.</p>
<h3>Units</h3>
<ul class='note'>
<li>Everything is counted in <b>EA</b>, meaning each single piece: a blossom, a leaf,
a radish, a carrot.</li>
<li>The kitchens order in LG and SM harvest containers. This plan converts them to pieces:
<b>one LG holds about 50 pieces</b> and three SM make one LG. The farm price list backs
this, one piece is priced at one fiftieth of an LG across the catalog.</li>
<li>Exceptions: gem marigold runs about 100 blossoms per LG and puff ball marigold about
9 per LG, so their lines use those counts.</li>
<li>A few bulk crops stay in their own units: <b>GB</b> is the big green harvest bin,
<b>QT</b> is a quart, <b>LBS</b> is pounds, <b>BX</b> is a box, <b>CS</b> is a case.</li>
<li>Lettuce is cut leaf by leaf and grows back. About half a head of leaves fills an LG.</li>
<li>Nothing drops below one LG worth per week. Where the kitchens historically took less,
the line says at least 50 EA a week, so there is always some on hand in season.</li>
</ul>
<h3>Kitchen timing</h3>
<p class='note'>Deliveries go out Thursday, Saturday and Monday. The menu changes eight times
a year: January 15, March 26, April 15, May 14, June 25, August 27, October 15 and
December 10. The kitchen wants samples about three weeks before each change and full picking
volume about one week before. Crops need to be ready ahead of those dates, not on them.</p>
</div>
""")

    for mi, month in months:
        rows = []
        for item in sorted(field, key=str.lower):
            if any(units[mi] > 0 for units in field[item].values()):
                rows.append((item, phrase_for_month(item, cats[item], field[item], mi)))
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
Last year it ran about 50 to 70 leaves a week in early summer. Plant well past that.</li>
<li><b>Alyssum.</b> Chef Phil does not want a full row at the farm dedicated to alyssum.
Keep it to partial row or edge plantings.</li>
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


def render_pdf(html_path, pdf_path):
    chrome = find_chromium()
    if not chrome:
        sys.exit("no chromium found")
    subprocess.run(
        [chrome, "--headless=new", "--no-sandbox", "--disable-gpu",
         "--no-pdf-header-footer", f"--print-to-pdf={pdf_path}",
         html_path.as_uri()],
        check=True, capture_output=True)


def verify_pdf(pdf_path, month_labels):
    from pypdf import PdfReader
    reader = PdfReader(str(pdf_path))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    required = ["Monthly Order Plan", "How to use this"] + month_labels + [
        "Not for planting", "Changes coming", "EA blossoms", "at least 50 EA",
        "Nasturtium", "Ox Heart"]
    missing = [r for r in required if r not in text]
    if missing:
        sys.exit(f"{pdf_path.name}: verification FAILED, missing: {missing}")
    print(f"OK: {pdf_path.name}, {len(reader.pages)} pages, "
          f"all {len(required)} check strings found")


if __name__ == "__main__":
    for html_name, pdf_name, suffix, months in EDITIONS:
        html_path, pdf_path = HERE / html_name, HERE / pdf_name
        html_path.write_text(build_html(suffix, months), encoding="utf-8")
        render_pdf(html_path, pdf_path)
        labels = [lbl for _, lbl in months] if months else list(MONTH_FULL)
        verify_pdf(pdf_path, labels)
