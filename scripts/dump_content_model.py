# -*- coding: utf-8 -*-
"""从真实系统导出行页面清单、字段字典、产品/基地注册表。

用法：python scripts/dump_content_model.py --src ../company
输出：data/pages.json / data/fields.json / data/products.json / data/bases.json /
      data/prototype-tree.json（供 build_prototype.py 使用）
"""
import argparse
import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

PAGE_NAMES = {
    "products": "产品超市", "solutions": "解决方案", "training": "校企实训",
    "ai_solutions": "AI 解决方案", "data_factory": "数据工厂",
    "model_factory": "模型工厂", "customer_base": "客服基地",
    "service_about": "关于中开服务", "group_about": "走进中开",
    "group_business": "业务板块", "group_bases": "园区基地",
}
SERVICE_PAGES = ["products", "solutions", "training", "ai_solutions",
                 "data_factory", "model_factory", "customer_base", "service_about"]


def walk_fields(node, path, page, out):
    if isinstance(node, dict):
        if "v" in node and "label" in node:
            out.append({
                "page": page, "path": path, "label": node.get("label"),
                "type": node.get("type"), "group": node.get("group"),
                "hint": node.get("hint", ""),
                "names": len(node.get("names") or []),
            })
            return
        for k, v in node.items():
            walk_fields(v, (path + "." + k).lstrip("."), page, out)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk_fields(v, "%s[%d]" % (path, i), page, out)


def tree_fields(node):
    """原型用：扁平化并保留可显示的样例值。"""
    out = []
    if isinstance(node, dict):
        if "v" in node and "label" in node:
            v = node.get("v")
            if isinstance(v, list) and all(isinstance(x, str) for x in v):
                v = [(x[:150] + "…") if len(x) > 150 else x for x in v]
            elif isinstance(v, (list, dict)):
                v = None
            elif isinstance(v, str) and len(v) > 200:
                v = v[:200] + "…"
            return [{"label": node.get("label"), "type": node.get("type"),
                     "hint": node.get("hint", ""),
                     "names": node.get("names") or [], "v": v}]
        for v in node.values():
            out += tree_fields(v)
    elif isinstance(node, list):
        for v in node:
            out += tree_fields(v)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.join(os.path.dirname(ROOT), "company"))
    a = ap.parse_args()
    src = os.path.abspath(a.src)
    content = json.load(open(os.path.join(src, "_build", "content.json"), encoding="utf-8"))
    outdir = os.path.join(ROOT, "data")
    os.makedirs(outdir, exist_ok=True)

    # 1) 页面清单（真实文件 + title）
    pages = []
    for f in sorted(glob.glob(os.path.join(src, "*.html"))):
        head = open(f, encoding="utf-8", errors="ignore").read(4000)
        m = re.search(r"<title>(.*?)</title>", head, re.S)
        pages.append({"file": os.path.basename(f),
                      "title": m.group(1).strip() if m else ""})
    json.dump(pages, open(os.path.join(outdir, "pages.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    # 2) 字段字典（218 行）
    rows = []
    walk_fields(content["site"], "site", "全站", rows)
    walk_fields(content["home_service"], "home_service", "index.html", rows)
    walk_fields(content["home_group"], "home_group", "group.html", rows)
    walk_fields(content["news_page"], "news_page", "group-news.html", rows)
    for k, v in content["bases"].items():
        walk_fields(v, "bases." + k, k + ".html", rows)
    for k, v in content["pages"].items():
        walk_fields(v, "pages." + k, k if k.endswith(".html") else k + ".html", rows)
    json.dump(rows, open(os.path.join(outdir, "fields.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    # 3) 注册表
    products = [{"slug": p["slug"], "name": p["name"], "sub": p.get("sub"),
                 "kind": p.get("kind"), "banner": p.get("banner", "")}
                for p in content["products"]]
    json.dump(products, open(os.path.join(outdir, "products.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    bases = []
    for k, v in content["bases"].items():
        g = lambda f: (v.get(f) or {}).get("v")
        bases.append({"slug": k, "name": g("name"), "prov": g("prov"),
                      "tags": g("tags"), "alias": g("alias"), "desc": g("desc")})
    json.dump(bases, open(os.path.join(outdir, "bases.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    # 4) 原型树
    tree = {"service": {"name": "服务官网 · 中开服务", "pages": []},
            "group": {"name": "集团官网 · 中开集团", "pages": []}}

    def add(site, name, node, fname=""):
        tree[site]["pages"].append({"name": name, "file": fname, "fields": tree_fields(node)})

    add("service", "全站通用信息", content["site"], "（全站引用）")
    add("service", "首页", content["home_service"], "index.html")
    for pid in SERVICE_PAGES:
        add("service", PAGE_NAMES[pid], content["pages"][pid], pid.replace("_", "-") + ".html")
    for p in content["products"]:
        if p["slug"] in content["pages"]:
            add("service", "产品 · " + p["name"], content["pages"][p["slug"]], p["slug"] + ".html")
    add("group", "首页", content["home_group"], "group.html")
    for pid in ["group_about", "group_business", "group_bases"]:
        add("group", PAGE_NAMES[pid], content["pages"][pid], pid.replace("_", "-") + ".html")
    for k, v in content["bases"].items():
        add("group", "基地 · " + v["name"]["v"], v, k + ".html")
    add("group", "中开资讯", content["news_page"], "group-news.html")
    json.dump(tree, open(os.path.join(outdir, "prototype-tree.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    print("pages=%d fields=%d products=%d bases=%d"
          % (len(pages), len(rows), len(products), len(bases)))


if __name__ == "__main__":
    main()
