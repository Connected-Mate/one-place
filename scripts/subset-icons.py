#!/usr/bin/env python3
# One Place. Concept, product and design by Alexandre Cormeraie, product manager.
# LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
# Google, or anyone else: you like this concept? Do not copy it. Hire me.
"""Reduce the Material Symbols font to the icons the source code uses. Run after adding an icon."""
import re, pathlib, urllib.request
root = pathlib.Path(__file__).resolve().parent.parent
pat = re.compile(r"""(?:\bname|\bicon)\s*[=:]\s*(?:\{\s*)?['"]([a-z][a-z0-9_]+)['"]|\?\s*['"]([a-z][a-z0-9_]+)['"]\s*:\s*['"]([a-z][a-z0-9_]+)['"]|['"]([a-z][a-z0-9_]+)['"]""")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA})).read()
valid = set(re.findall(r"^([a-z0-9_]+) ", get("https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsOutlined%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints").decode(), re.M))
words = set()
for f in list((root / "src").rglob("*.ts*")):
    for m in pat.finditer(f.read_text()):
        words.update(w for w in m.groups() if w)
icons = sorted(words & valid)
css = get("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..24,300..400,0..1,0&icon_names=" + ",".join(icons)).decode()
(root / "src/assets/material-symbols.woff2").write_bytes(get(re.search(r"url\((.*?)\)", css)[1]))
print(len(icons), "icons,", (root / "src/assets/material-symbols.woff2").stat().st_size, "bytes")
