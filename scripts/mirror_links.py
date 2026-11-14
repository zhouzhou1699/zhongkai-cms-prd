# -*- coding: utf-8 -*-
"""把 site/ 镜像里的内网绝对地址改写成相对路径，让 GitHub Pages 上能正常点。

只改 href/src 里的主机名，不动任何其它字节。原始形态见 site/README.md 的缺陷表。

背景：线上生成的页面里，产品独立站链接是 http://127.0.0.1:4123/ 这种绝对地址
（来自 _build/domains.json 的 host，尚未切正式域名）。本机/线上能跑，静态托管点不动。

用法：python scripts/mirror_links.py --site site
"""
import argparse
import glob
import os
import re

# 产品独立站端口 → 主站里的同名页面
PORT_MAP = {
    "4123": "product-annotation.html",
    "4124": "product-3d.html",
    "4125": "product-model-train.html",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default="site")
    ap.add_argument("--check", action="store_true", help="只统计，不写盘")
    a = ap.parse_args()

    total = 0
    files = 0
    for path in sorted(glob.glob(os.path.join(a.site, "*.html"))):
        src = open(path, encoding="utf-8").read()
        out = src

        # 1) 产品独立站：http://127.0.0.1:PORT/ → 主站同名页面
        for port, page in PORT_MAP.items():
            out = out.replace("http://127.0.0.1:%s/" % port, page)
            out = out.replace("http://127.0.0.1:%s" % port, page)

        # 2) 主站绝对地址 → 相对文件名
        out = re.sub(r"http://127\.0\.0\.1:6993/([a-z0-9._-]+)", r"\1", out)
        out = out.replace("http://127.0.0.1:6993", "index.html")

        if out != src:
            files += 1
            total += sum(1 for x, y in zip(src.splitlines(), out.splitlines()) if x != y)
            if not a.check:
                open(path, "w", encoding="utf-8").write(out)

    print("%s: %d files, %d lines rewritten"
          % ("check" if a.check else "done", files, total))


if __name__ == "__main__":
    main()
