# -*- coding: utf-8 -*-
"""代码与内容规模度量：页面数、体积、代码行数、字段类型分布。

用法：python scripts/collect_metrics.py --src ../company
输出：data/metrics-code.json
"""
import argparse
import glob
import json
import os
import subprocess
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def sh(cwd, cmd):
    try:
        return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True,
                              timeout=30).stdout.strip()
    except Exception:
        return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.join(os.path.dirname(ROOT), "company"))
    a = ap.parse_args()
    src = os.path.abspath(a.src)
    out = {}

    first = sh(src, ["git", "log", "--reverse", "--date=short",
                     "--pretty=%ad"]).splitlines()
    out["repo"] = {
        "commits": int(sh(src, ["git", "rev-list", "--count", "HEAD"]) or 0),
        "first_commit": first[0] if first else "",
        "last_commit": sh(src, ["git", "log", "-1", "--date=short", "--pretty=%ad"]),
    }

    pages = glob.glob(os.path.join(src, "*.html"))
    sizes = {os.path.basename(p): os.path.getsize(p) for p in pages}
    if sizes:
        out["pages"] = {
            "count": len(sizes),
            "total_bytes": sum(sizes.values()),
            "avg_bytes": int(sum(sizes.values()) / len(sizes)),
            "max": max(sizes.items(), key=lambda x: x[1]),
            "min": min(sizes.items(), key=lambda x: x[1]),
        }

    code_files = ["admin/server.py", "admin/static/app.js", "admin/static/admin.css",
                  "_build/common.py", "_build/pagebuild.py"]
    code_files += [os.path.relpath(p, src)
                   for p in glob.glob(os.path.join(src, "_build", "gen_*.py"))]
    code = {}
    for rel in code_files:
        p = os.path.join(src, rel)
        if os.path.isfile(p):
            with open(p, encoding="utf-8", errors="ignore") as f:
                code[rel.replace("\\", "/")] = sum(1 for _ in f)
    out["code_lines"] = code
    out["code_total"] = sum(code.values())

    for name, rel in (("css", "assets/r8c-style.css"), ("js_svc", "assets/r8c-svc.js")):
        p = os.path.join(src, rel)
        if os.path.isfile(p):
            out.setdefault("asset_bytes", {})[name] = os.path.getsize(p)

    # 字段类型分布（从 data/fields.json）
    fp = os.path.join(ROOT, "data", "fields.json")
    if os.path.isfile(fp):
        rows = json.load(open(fp, encoding="utf-8"))
        out["fields_total"] = len(rows)
        out["field_types"] = dict(Counter(r["type"] for r in rows))
        out["pages_with_fields"] = len(set(r["page"] for r in rows))

    json.dump(out, open(os.path.join(ROOT, "data", "metrics-code.json"), "w",
                        encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1)[:1200])


if __name__ == "__main__":
    main()
