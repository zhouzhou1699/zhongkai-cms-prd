# -*- coding: utf-8 -*-
"""构建性能基准：全量 / 单页 / 无变化，以及 Python 启动成本对比。

用法：python scripts/bench_build.py --src ../company
输出：data/metrics-build.json
注意：会在临时目录里构建，不覆盖 company/ 里的真实页面。
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.join(os.path.dirname(ROOT), "company"))
    a = ap.parse_args()
    src = os.path.abspath(a.src)
    tmp = tempfile.mkdtemp(prefix="zkbench-")
    try:
        # 站点根指到临时目录，assets 走软链/复制，避免污染真实站点
        assets = os.path.join(src, "assets")
        if os.path.isdir(assets):
            dst = os.path.join(tmp, "assets")
            try:
                os.symlink(assets, dst)
            except (OSError, NotImplementedError):
                shutil.copytree(assets, dst)
        os.environ["ZK_SITE_ROOT"] = tmp
        sys.path.insert(0, os.path.join(src, "_build"))
        import pagebuild  # noqa: E402

        res = {}
        t0 = time.time(); r = pagebuild.build(pagebuild.all_targets())
        res["full_first_s"] = round(time.time() - t0, 3)
        res["pages"] = len(r["built"])
        t0 = time.time(); pagebuild.build(pagebuild.all_targets())
        res["full_warm_s"] = round(time.time() - t0, 3)
        t0 = time.time(); r1 = pagebuild.build(["product-3d.html"])
        res["single_s"] = round(time.time() - t0, 3)
        ms = [b["ms"] for b in r1["built"]] or [0]
        res["per_page_ms_avg"] = round(sum(ms) / len(ms), 1)
        res["per_page_ms_max"] = max(ms)

        t0 = time.time()
        subprocess.run([sys.executable, "-c", "pass"], capture_output=True)
        res["python_start_s"] = round(time.time() - t0, 3)
        t0 = time.time()
        subprocess.run([sys.executable, "-c",
                        "import sys;sys.path.insert(0,%r);import common"
                        % os.path.join(src, "_build")], capture_output=True)
        res["python_import_common_s"] = round(time.time() - t0, 3)
        res["errors"] = len(r["errors"])

        out = os.path.join(ROOT, "data", "metrics-build.json")
        json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(json.dumps(res, ensure_ascii=False, indent=1))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
