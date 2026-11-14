/* ==========================================================================
   服务站五页的动效（2026-10-21）
   --------------------------------------------------------------------------
   挂载：页面 </body> 前 <script src="assets/r8c-motion.js" defer></script> 之后
        自动执行（common.py 的 page(js_extra=["r8c-svc.js"])）。

   与 r8c-group.js 同一套做法：只用浏览器原生能力。
   - 滑动触发（一次性）：IntersectionObserver 挂 .is-in，往回滚不重播。
   - 滑动驱动（1:1）：scroll + 单个 rAF，进度只由滚动位置决定，往回滚自然倒放，
     跳到中段刷新也立刻正确。
   不引入 GSAP：站点 38 页零依赖、无 CDN 构建，这两页需要的「按段推进 + 逐项点亮」
   原生足够（整份不到 6KB）。

   每页各有一个主角：
     产品超市  .r8c-catwalk  12 款软件沿四阶段横移过站
     解决方案  .r8c-axes     能力坐标上的游标随滚动走，对应行的柱子长起
     校企实训  .r8c-loop     闭环线随滚动生长，节点落位
     AI        .r8c-matrix / .r8c-edge  能力矩阵按滚动扫过点亮、端侧链路描出
     数据工厂  .r8c-line     流水带随滚动前进，当前工位放大
     模型工厂  .r8c-mloop    四段之间连接线依次描出
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function all(sel, ctx) {
    return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel));
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function safe(fn) {
    try { fn(); } catch (e) {
      if (window.console && console.warn) console.warn('[r8c-svc]', e);
    }
  }
  /* 元素中心是否已进入视口下半部分（滑动驱动用，和 .is-in 的触发线区分开） */
  function inView(el, ratio) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || doc.documentElement.clientHeight;
    return r.top < vh * (ratio || 0.72) && r.bottom > 0;
  }
  /* 阅读区间：一段内容「真正被读」的那段滚动距离。
     ------------------------------------------------------------------
     起点 = 段落顶滚到吸顶双条（主导航 63 + 子导航 52 = 115）下沿，
            这是读者开始读这一段的时刻；
     终点 = 段落底对齐视口底，这是段落读完、该往下走的时刻。
     ------------------------------------------------------------------
     ⚠ 不能再沿用 `-段落顶 / (段落高 − 视口高)`：
     那个公式把「段落顶贴住视口顶」当作进度 0。可段落顶贴住视口顶时，
     段落头（编号 + 标题 + 说明，约 200px）还在 115px 的吸顶条下面没露出来，
     读者根本没开始读 —— 这段滚动被白白算进叙事里，于是：
       · 产品超市前两格停在 01、
       · 解决方案前三格停在 pane0、
       · 模型工厂前三格全是 0.000。
     （2026-10-21 实测：这些页的行程只有 260~410px，段落头就吃掉一半。）
     改用阅读区间后，四段 / 四块 / 三条线的推进正好铺满「读者眼睛在内容上」
     的全部距离，段落读完时叙事也刚好走完。 */
  var STICKY_H = 115;
  function readRange(box) {
    var r = box.getBoundingClientRect();
    var vh = window.innerHeight;
    var top = r.top;                     /* 段落顶相对视口的偏移 */
    /* r.top <= STICKY_H 时起点已过：起点之后走过的距离 */
    var done = STICKY_H - top;
    /* 可走总长：段落顶贴到吸顶条下沿 → 段落底对齐视口底 */
    var span = Math.max(1, box.offsetHeight + STICKY_H - vh);
    return { done: done, span: span, p: clamp(done / span, 0, 1) };
  }
  /* 通用：给容器挂一次性 .is-in */
  function once(sel, cls) {
    var els = all(sel);
    if (!els.length) return;
    if (RM || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add(cls || 'is-in'); });
      return;
    }
    var c = cls || 'is-in';
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add(c);
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -70px 0px' });
    els.forEach(function (el) { io.observe(el); });
    /* 兜底：读者拖滚动条快速跳跃时，IO 可能错过 12% 那一瞬，
       卡片就停在 opacity:0 成了空白。每次滚动再补一次「已经在视口里就显示」，
       已显示的元素直接跳过，开销可以忽略。 */
    jobs.push(function () {
      var vh = window.innerHeight;
      els.forEach(function (el) {
        if (el.classList.contains(c)) return;
        var r = el.getBoundingClientRect();
        if (r.top < vh - 40 && r.bottom > 0) {
          el.classList.add(c);
          io.unobserve(el);
        }
      });
    });
  }
  /* 通用：一个 rAF 管住所有滚动驱动的更新 */
  var jobs = [];
  var raf = 0;
  function tick() {
    raf = 0;
    for (var i = 0; i < jobs.length; i++) safe(jobs[i]);
  }
  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------ 1. 产品超市
     12 款软件按「采集 → 标注 → 训练 → 应用」四段排在一条带上。
     滚动驱动：整段进入视口后，进度 p 决定停在哪个阶段，带子横移到该段首款。
     窄屏（<992px）不做横移 —— 手指横滑和页面纵滑会打架，CSS 已改回网格。 */
  function initCatwalk() {
    var box = doc.querySelector('.r8c-catwalk');
    if (!box) return;
    var track = box.querySelector('.r8c-catwalk__track');
    var stages = all('.r8c-catwalk__stage', box);
    var cards = all('.r8c-catwalk__card', box);
    var count = box.querySelector('.r8c-catwalk__count b');
    var bar = box.querySelector('.r8c-catwalk__bar i');
    var prev = box.querySelector('.r8c-catwalk__btn[data-dir="-1"]');
    var next = box.querySelector('.r8c-catwalk__btn[data-dir="1"]');
    var n = cards.length;
    if (!n || !track) return;

    /* 每段有几款：按 data-stage 分组，后端写的是采集/标注/训练/应用四段 */
    var groups = [];
    cards.forEach(function (c, i) {
      var s = parseInt(c.getAttribute('data-stage'), 10) || 0;
      if (!groups[s]) groups[s] = [];
      groups[s].push(i);
    });
    var segStart = groups.map(function (g) { return g && g.length ? g[0] : 0; });
    if (!segStart.length) segStart = [0];

    var perView = 3;
    var cur = -1;
    var mobile = false;

    function measure() {
      mobile = window.innerWidth < 992;
      perView = mobile ? 1 : (window.innerWidth < 1200 ? 2 : 3);
    }
    measure();

    function maxIndex() { return Math.max(0, n - perView); }

    function setAt(idx, smooth) {
      idx = clamp(idx, 0, maxIndex());
      if (idx === cur) return;
      cur = idx;
      if (track) {
        track.style.transition = smooth
          ? 'transform .72s cubic-bezier(.32,.72,0,1)' : 'none';
        track.style.transform = 'translate3d(' + (-idx * (100 / perView)) + '%,0,0)';
        if (!smooth) { void track.offsetWidth; track.style.transition = ''; }
      }
      /* count 指向 <b>，只覆盖数字本身；「第 / 款」在旁边的 small 里，不受影响 */
      if (count) count.textContent = (idx < 9 ? '0' : '') + (idx + 1);
      if (bar) bar.style.transform = 'translate3d(' + (idx * 100) + '%,0,0)';
      if (prev) prev.disabled = idx <= 0;
      if (next) next.disabled = idx >= maxIndex();
      /* 阶段高亮：当前停靠位置落在哪个阶段内 */
      var stage = 0;
      for (var s = 0; s < segStart.length; s++) if (idx >= segStart[s]) stage = s;
      stages.forEach(function (el, k) {
        el.classList.toggle('is-on', k === stage);
        el.classList.toggle('is-past', k < stage);
      });
    }

    /* 点击阶段轴：横移到该阶段首款 */
    stages.forEach(function (el, k) {
      el.addEventListener('click', function () { setAt(segStart[k] || 0, true); });
    });
    if (prev) prev.addEventListener('click', function () { setAt(cur - 1, true); });
    if (next) next.addEventListener('click', function () { setAt(cur + 1, true); });

    /* 滚动驱动：段落进度 p 映射到阶段（四段 → 四个停靠点），窄屏不接管。
       进度改用 readRange() 的阅读区间：从「段落顶停到吸顶条下沿」起算，
       而不是「段落顶贴住视口顶」—— 后者会把段落头那 200px 也算进叙事，
       于是前两格永远停在 01（2026-10-21 实测）。 */
    var stagewrap = box.querySelector('.r8c-catwalk__stagewrap');
    jobs.push(function () {
      if (mobile) return;
      var p = readRange(box).p;
      /* 四段各分 1/4 的滚动份额（「过站」的仪式感来自等分），
         段内再按卡片数均分 —— 这样一段有 1 张就停一下，有 6 张就走 6 步，
         不会像按整条带均分那样把 6 张挤在同一小段里跳号。 */
      var segs = stages.length || 4;
      var seg = Math.min(segs - 1, Math.floor(p * segs));
      var local = clamp(p * segs - seg, 0, 1);
      var start = segStart[seg] || 0;
      var end = (segStart[seg + 1] != null ? segStart[seg + 1] - 1 : n - 1);
      var span = Math.max(0, end - start);
      var idx = span > 0 ? start + Math.round(span * local) : start;
      idx = clamp(idx, start, Math.max(start, end));
      setAt(idx, false);
    });

    window.addEventListener('resize', function () {
      measure();
      cur = -1;
      setAt(0, false);
      onScroll();
    });
    /* 首帧：先给 0 号位（避免闪一下最后一张），再按当前滚动位置校正。
       顺序反过来会让 onScroll 里的进度覆盖成第 2 段、计数却还停在 01。 */
    setAt(0, false);
    onScroll();
  }

  /* ------------------------------------------------------------------ 1b. 硬件产品
     三张卡一次到位 + 一次很小的回震（机械件咔嗒落位），与软件的流淌手感区分。
     ⚠ 这三张卡的 CSS 初始是 opacity:0，必须由这里挂 is-in；
     改版时漏掉过这段，卡片一直是隐形的（截图里整片浅蓝空白）。 */
  function initHw() {
    var cards = all('.r8c-hw__card');
    if (!cards.length) return;
    if (RM) {
      cards.forEach(function (c) { c.classList.add('is-in'); });
      return;
    }
    once('.r8c-hw__card');
    /* 到位后用一次短回震收尾（.34s，与「咔嗒」手感表一致） */
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in', 'is-hit');
        io.unobserve(en.target);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -60px 0px' });
    cards.forEach(function (c) { io.observe(c); });
  }

  /* ------------------------------------------------------------------ 2. 解决方案：能力坐标
     左边坐标图四行 = 四条方案，右边四块详情叠在同一处。
     滚动驱动：滚动位置决定当前行；行高亮、柱子长起、右侧换页都由同一个 i 驱动。 */
  function initAxes() {
    var box = doc.querySelector('.r8c-axes');
    if (!box) return;
    var rows = all('.r8c-axes__row', box);
    var panes = all('.r8c-axes__pane', box);
    if (!rows.length || !panes.length) return;
    var cur = -1;
    var mobile = function () { return window.innerWidth < 992; };

    function setCur(i) {
      if (i === cur) return;
      cur = i;
      rows.forEach(function (r, k) {
        r.classList.toggle('is-on', k === i);
        r.classList.toggle('is-past', k < i);
        r.setAttribute('aria-selected', k === i ? 'true' : 'false');
      });
      panes.forEach(function (p, k) { p.classList.toggle('is-cur', k === i); });
    }

    rows.forEach(function (r, k) {
      r.addEventListener('click', function () {
        setCur(k);
        if (mobile()) return;
        /* 四块详情叠在同一舞台，pane 的 top 全都一样，不能拿它当目标。
           按「第 k 块对应的进度」反推段落该滚到哪：
           进度 p 落在 [k/n, (k+1)/n) 时显示第 k 块，取该区间中点最稳。
           ⚠ 反推公式必须与 readRange 同源：阅读区间的起点是「段落顶停到吸顶条下沿」，
           不是「段落顶贴视口顶」。用错公式会让点击第 1 行反而滚到第 2 行。 */
        var span = box.offsetHeight + STICKY_H - window.innerHeight;
        if (span <= 1) return;
        var p = (k + 0.5) / panes.length;
        var boxTop = box.getBoundingClientRect().top + window.pageYOffset;
        var top = boxTop - STICKY_H + span * p;
        try { window.scrollTo({ top: top, behavior: 'smooth' }); }
        catch (e) { window.scrollTo(0, top); }
      });
    });

    /* 窄屏：四块详情纵向排列，用 IntersectionObserver 跟着走 */
    if (mobile()) {
      setCur(0);
      if (!('IntersectionObserver' in window)) return;
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          var k = panes.indexOf(en.target);
          if (k >= 0) setCur(k);
        });
      }, { rootMargin: '-38% 0px -46% 0px', threshold: 0 });
      panes.forEach(function (p) { io.observe(p); });
      return;
    }

    jobs.push(function () {
      if (mobile()) return;
      /* ⚠ 不能用「哪块 pane 最靠近视口中线」来判定：四块详情用负外边距叠在同一个
         sticky 舞台上，getBoundingClientRect 几乎重合，永远选到同一块。
         正确做法按阅读区间（见 readRange）映射到 0..n-1。
         ⚠ 也别只认行程：段落比视口矮、或恰好压在视口底（还没进入行程）时
         进度会算不出，四块 pane 就全停在 opacity:0 —— 视口里一片空。
         这里用「阅读区间映射」与「段落头在视口里的位置」两条兜底，保证至少选中一块。 */
      var rg = readRange(box);
      var k;
      if (rg.span > 1) {
        k = Math.min(panes.length - 1, Math.floor(rg.p * panes.length));
      } else {
        /* 无行程：按区块在视口中的相对位置一把兜底（顶在 88% 处算 0，顶到 20% 处算 n-1） */
        var r = box.getBoundingClientRect();
        var vh = window.innerHeight;
        var q = clamp((vh * 0.88 - r.top) / Math.max(1, vh * 0.68), 0, 1);
        k = Math.min(panes.length - 1, Math.floor(q * panes.length));
      }
      setCur(k);
    });
    setCur(0);
    onScroll();
  }

  /* ------------------------------------------------------------------ 3. 闭环线（校企实训 / 模型工厂）
     线随滚动生长（scaleX/scaleY 由一个 CSS 变量驱动），节点一次性落位。 */
  function initLoop() {
    var box = doc.querySelector('.r8c-loop');
    if (!box) return;
    once('.r8c-loop__node');
    var stage = box.querySelector('.r8c-loop__stage');
    var line = box.querySelector('.r8c-loop__line i');
    if (!stage) return;
    if (RM) { stage.classList.add('is-in'); if (line) line.style.setProperty('--p', 1); return; }
    if (!('IntersectionObserver' in window)) {
      stage.classList.add('is-in');
      if (line) line.style.setProperty('--p', 1);
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) stage.classList.add('is-in');
      });
    }, { threshold: 0.1 });
    io.observe(stage);
    /* 滑动驱动：线跟着滚动生长。
       ⚠ 不能盯 grid 的 rect：stage 是 sticky 的，进视口后就钉住不动，
       rect.top 恒定 → 线永远长到同一个位置。
       ⚠⚠ 2026-10-21 也不能直接套 readRange：readRange 是给「比视口高的段落」设计的
       （区间 = 段落从吸顶条下沿滚到段落底对齐视口底）。这段的真实情况是：
         段落 927 > 视口 749，但真正的主角 —— 卡片组 —— 只有 441 高。
       用段落的阅读区间喂一条 441 高的卡片组，等于让它在「段落还没读完」
       的时候就慢慢长完，然后剩下大半段滚动只能干等（实测空滚 376~1100px，
       视口里有一半以上是空段落背景，读者以为页面卡住了）。
       正确做法：让线跟着**卡片组自己的行程**长 ——
       卡片组从「顶边进入吸顶条下沿」到「底边对齐视口底」，这段才是它的完整出场。
       公式与 readRange 同源（同一个 STICKY_H、同一个 clamp），只是把被测量的
       盒子从段落换成 stage */
    jobs.push(function () {
      if (window.innerWidth < 992) return;
      var vh = window.innerHeight;
      /* 卡片组自己的出场行程，只用「它顶部在哪」一个量：
           top = +vh  → 顶边刚碰到视口底（起点，p=0）
           top = −H   → 底边刚好离开视口顶（终点，p=1）
         行程 = vh + H。H 取 stage 的实际高度（537），
         于是 1440×749 档的行程 = 1286px，滚动全程每屏都在长、且能倒着缩。
         ⚠ 前两版用的「顶进吸顶条 → 底对齐视口底」只有 100px，
           线在一瞬间从 0 跳到 1（实测 y=650=0.000、y=750=1.000），等于没有叙事；
           原因就是卡片组高 537 几乎等于视口 749，那个区间被挤没了。
         ⚠ 这里读的是 stage 的 rect，但 stage 同时被下面的 translate 移动 ——
           所以 translate 之前先算 p，保证 p 只反映滚动、不被自己的位移污染。 */
      var H = stage.offsetHeight;
      var r = stage.getBoundingClientRect();
      var travel = Math.max(1, vh + H);
      var p = clamp((vh - r.top) / travel, 0, 1);
      if (line) line.style.setProperty('--p', p.toFixed(3));
      /* ② 离场：走完行程之后随滚动 1:1 上移，像普通文档流元素一样退场，
         不再让 sticky 把它钉在顶上占着视口（实测钉住时有 55% 的屏是空段落背景）。 */
      var over = (vh - r.top) - travel;
      stage.style.translate = over > 0 ? '0 ' + (-over) + 'px' : '';
    });
    onScroll();
  }

  /* ------------------------------------------------------------------ 4. AI：能力矩阵按滚动扫过点亮 */
  function initMatrix() {
    var box = doc.querySelector('.r8c-matrix');
    if (!box) return;
    var cells = all('.r8c-matrix__cell', box);
    if (!cells.length) return;
    if (RM) { cells.forEach(function (c) { c.classList.add('is-lit'); }); return; }
    /* 滑动驱动：矩阵按「行」被一条扫描线扫过 —— 扫到哪行，哪行（及之前的行）点亮。
       这是这页的主角动效：读者往下滚，能力带一行一行亮起来，倒着滚会退回去。
       不再用 IntersectionObserver：那是一次性出场，无法表达「扫到哪」。 */
    var grid = box.querySelector('.r8c-matrix__grid');
    var rows = Math.max(1, Math.round(cells.length / 3));
    function litRows(n) {
      cells.forEach(function (c, k) {
        c.classList.toggle('is-lit', Math.floor(k / 3) <= n);
      });
    }
    jobs.push(function () {
      if (!grid) return;
      var r = grid.getBoundingClientRect();
      var vh = window.innerHeight;
      /* 扫描区间：网格顶从视口 88% 抬到 52% —— 约 0.36 屏行程分给三行。
         矩阵段落已被压到 676px（< 一屏），若扫到 6% 就要读者滚到「整段快出屏」
         才全亮，等于白压高度、还留一段空滚。0.36 屏刚好「一进屏就开扫、抬头看全」。
         ⚠ 这一页是唯一一段「段落比视口矮」的主角区（676 < 749），
         不能用 readRange：段落顶停到吸顶条下沿时，段落底已经进了视口底，
         阅读区间只剩 40px，三行在一瞬间全亮，等于没有叙事。
         所以扫描线仍按「网格自身在视口里的位置」走，这是这段（一屏看全）的
         正确尺度：进屏开扫、抬头看全。 */
      var from = vh * 0.88;
      var to = vh * 0.52;
      var p = clamp((from - r.top) / Math.max(1, from - to), 0, 1);
      /* p=0 时第 1 行刚亮起，p=1 全亮 */
      var n = Math.max(1, rows);
      litRows(Math.min(n - 1, Math.floor(p * n)));
    });
    litRows(-1);

    /* 玻璃卡错落进场 */
    once('.r8c-aglass__card');
    /* 端侧链路：滚到时依次描出（每站间隔 90ms） */
    var chain = doc.querySelector('.r8c-edge__chain');
    if (chain && 'IntersectionObserver' in window) {
      var stops = all('.r8c-edge__stop', chain);
      var rail = chain.querySelector('.r8c-edge__rail i');
      /* 出场：五站先各自归位（一次性） */
      var io2 = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          stops.forEach(function (s, k) {
            setTimeout(function () { s.classList.add('is-in'); }, k * 90);
          });
          io2.disconnect();
        });
      }, { threshold: 0.24 });
      io2.observe(chain);
      /* 滑动驱动：轨道长度跟着滚动描出，五站在轨道经过时依次点亮。
         与上面的一次性出场不冲突 —— 出场管「出不出现」，这里管「走到哪」。 */
      if (rail) {
        jobs.push(function () {
          if (window.innerWidth < 768) return;
          var r = chain.getBoundingClientRect();
          var vh = window.innerHeight;
          /* 进入视口 78% 处开始，抬到 32% 处画完 */
          var p = clamp((vh * 0.78 - r.top) / (vh * 0.46), 0, 1);
          rail.style.setProperty('--p', p.toFixed(3));
          var n = stops.length;
          stops.forEach(function (s, k) {
            /* 第 k 站在轨道进度超过 k/(n-1) 时算「已通电」 */
            var th = n > 1 ? k / (n - 1) : 0;
            s.classList.toggle('is-live', p >= th - 0.02);
          });
        });
      }
    } else {
      all('.r8c-edge__stop').forEach(function (s) { s.classList.add('is-in'); });
    }
  }

  /* ------------------------------------------------------------------ 5. 数据工厂：工位流水线 */
  function initLine() {
    var box = doc.querySelector('.r8c-line');
    if (!box) return;
    once('.r8c-line__meters');
    var stations = all('.r8c-line__station', box);
    var rail = box.querySelector('.r8c-line__rail i');
    if (!stations.length) return;
    var cur = -1;

    function setOn(i) {
      if (i === cur) return;
      cur = i;
      stations.forEach(function (s, k) {
        s.classList.toggle('is-on', k === i);
        s.classList.toggle('is-past', k < i);
        s.setAttribute('aria-current', k === i ? 'step' : 'false');
      });
    }
    if (RM) { setOn(0); if (rail) rail.style.setProperty('--p', 1); return; }

    stations.forEach(function (s, k) {
      s.addEventListener('click', function () {
        /* 点击工位：滚到它自己（让读者停在这一站看） */
        var top = s.getBoundingClientRect().top + window.pageYOffset - window.innerHeight * 0.34;
        try { window.scrollTo({ top: top, behavior: 'smooth' }); }
        catch (e) { window.scrollTo(0, top); }
        setOn(k);
      });
    });

    jobs.push(function () {
      /* 当前工位：两种判据取「更靠后」的那个，保证最后一站一定能点到。
         ① 中心最接近视口 42% 线的工位（跟手，符合直觉）
         ② 段落滚动进度映射（兜底：段落滚到底时进度为 1，必然选中最后一站）
         只用 ① 的问题：段落底之后是 CTA，读者推不动了，
         而最后几站的中心还留在 42% 线下方，永远选不中。 */
      var line42 = window.innerHeight * 0.42;
      var best = 0, bestD = Infinity;
      stations.forEach(function (s, k) {
        var r = s.getBoundingClientRect();
        var d = Math.abs(r.top + r.height * 0.5 - line42);
        if (d < bestD) { bestD = d; best = k; }
      });
      var byProgress = 0;
      var rg = readRange(box);
      byProgress = Math.min(stations.length - 1, Math.floor(rg.p * stations.length));
      setOn(Math.max(best, byProgress));
      /* 轨道进度：从第一站中心到最后一站中心 */
      if (rail) {
        var first = stations[0].getBoundingClientRect();
        var last = stations[stations.length - 1].getBoundingClientRect();
        var span = (last.top + last.height * 0.5) - (first.top + first.height * 0.5);
        var p = span <= 0 ? 1 : clamp((line42 - (first.top + first.height * 0.5)) / span, 0, 1);
        /* 段落读完时轨道必须走满，否则最后一站看着像「没接上」 */
        p = Math.max(p, clamp((rg.p - 0.1) / 0.85, 0, 1));
        rail.style.setProperty('--p', p.toFixed(3));
      }
    });
    setOn(0);
    onScroll();
  }

  /* ------------------------------------------------------------------ 6. 模型工厂：四段连接线依次描出 */
  function initMloop() {
    var box = doc.querySelector('.r8c-mloop');
    if (!box) return;
    once('.r8c-mloop__card');
    var steps = all('.r8c-mloop__step', box);
    if (RM || !('IntersectionObserver' in window)) {
      steps.forEach(function (s) { s.classList.add('is-in'); });
      return;
    }
    if (!steps.length) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        var k = steps.indexOf(en.target);
        setTimeout(function () { en.target.classList.add('is-in'); }, Math.max(0, k) * 110);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -60px 0px' });
    steps.forEach(function (s) { io.observe(s); });

    /* 滑动驱动：四段之间的连接线按阅读区间依次被「充能」。
       CSS 里的 .is-in 只负责让线出现，真正的长度由 --p 决定 —— 这样倒着滚会收回，
       而不是一次性跳满（出场动画与叙事驱动是两件事）。
       修订（2026-10-21）：原来在 p 上再套一层 q=(p-0.12)/0.72 的「留余量」，
       阅读区间收紧后这段余量把三段线挤进了最后 60% 行程，前半段全停在 0.000。
       现在直接用阅读区间的 p，只在两端各留 4% 让线「从卡里钻出/收进去」有起点。 */
    jobs.push(function () {
      if (window.innerWidth < 768) return;
      var p = readRange(box).p;
      var q = clamp((p - 0.04) / 0.92, 0, 1);
      var n = steps.length - 1;
      steps.forEach(function (s, k) {
        if (!n) return;
        var local = clamp(q * n - k, 0, 1);
        var link = s.querySelector('.r8c-mloop__link');
        if (link) link.style.setProperty('--p', local.toFixed(3));
      });
    });
    onScroll();
  }

  /* ------------------------------------------------------------------ 启动 */
  function boot() {
    safe(initCatwalk);
    safe(initHw);
    safe(initAxes);
    safe(initLoop);
    safe(initMatrix);
    safe(initLine);
    safe(initMloop);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    if (RM) jobs.length = 0;
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
