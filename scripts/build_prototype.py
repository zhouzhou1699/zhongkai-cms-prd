# -*- coding: utf-8 -*-
"""把真实系统的字段树注入原型，产出单文件可点原型（file:// 直接打开）。

用法：python scripts/build_prototype.py
输入：data/prototype-tree.json（由 dump_content_model.py 从 content.json 导出）
输出：prototype/index.html（自带数据、零依赖、离线可点）
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

tree = json.load(open(os.path.join(ROOT, "data", "prototype-tree.json"), encoding="utf-8"))
tpl = open(os.path.join(HERE, "prototype.tpl.html"), encoding="utf-8").read()
out = tpl.replace("/*__DATA__*/null", json.dumps(tree, ensure_ascii=False, separators=(",", ":")))
path = os.path.join(ROOT, "prototype", "index.html")
open(path, "w", encoding="utf-8").write(out)
print("wrote %s (%.1f KB)" % (path, os.path.getsize(path) / 1024))
