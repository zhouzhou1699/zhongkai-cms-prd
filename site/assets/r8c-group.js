/* ==========================================================================
   走进中开 / 业务板块 的段落动效（2026-10-21）
   --------------------------------------------------------------------------
   挂载方式：页面 </body> 前 <script src="assets/r8c-motion.js" defer></script>
   之后自动执行（r8c-motion.js 末尾调用 initGbiz / initGabout）。

   只用浏览器原生能力：IntersectionObserver 做滑动触发（一次性），
   scroll + 单个 rAF 做滑动驱动（严格按滚动位置计算，往回滚自然倒放）。
   不引入 GSAP —— 站点全部 38 个页面零依赖、无 CDN 构建，多一个 50KB
   运行时只为这两页不划算；这里需要的「段落一次进场」与「7 段 1:1 推进」
   都在原生能力范围内，代码总量不到 5KB。

   减少动态效果（prefers-reduced-motion: reduce）：
   业务板块直接切成纵向长排 .r8c-gbiz--static，所有内容一次到位、可读可点。
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function all(sel, ctx) {
    return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel));
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function safe(fn) {
    try { fn(); } catch (e) {
      if (window.console && console.warn) console.warn('[r8c-group]', e);
    }
  }

  /* ------------------------------------------------------------------ 1. 段落进场
     6 个 .r8c-gsec 各自独立观察；进到 -90px 时挂 .is-in，
     之后 CSS 里的描边序号、主轴、节点、徽章按各自的延迟落位（一次性，不回滚重播）。 */
  function initGsec() {
    var els = all('.r8c-gsec');
    if (!els.length) return;
    if (RM || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -90px 0px' });
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight - 90) { el.classList.add('is-in'); return; }
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------------ 2. 董事长致辞：引文随滚动亮起
     滑动驱动：段落中心越过视口 72% 线即点亮，往回滚会熄灭（可以倒读）。
     这是本页「至少一段滑动驱动的叙事」——主角是这段话本身。 */
  function initGquote() {
    var box = doc.querySelector('.r8c-gch__quote');
    if (!box) return;
    var ps = all('.r8c-gch__p', box);
    if (!ps.length) return;
    if (RM || !('IntersectionObserver' in window)) {
      ps.forEach(function (p) { p.classList.add('is-lit'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        en.target.classList.toggle('is-lit',
          en.isIntersecting || en.boundingClientRect.top < 0);
      });
    }, {
      /* 上下各收窄：只有真正读到的那一段才亮，前后的保持「未读」的暗 */
      rootMargin: '-18% 0px -12% 0px',
      threshold: 0
    });
    ps.forEach(function (p) { io.observe(p); });
  }

  /* ------------------------------------------------------------------ 3. 业务板块：固定舞台
     叙事设计：7 个板块是同一张「业务地图」的 7 个切面。
     外层 .r8c-gbiz 高 = 7 × step，舞台 sticky 钉住；进度 p = 已滚过的比例，
     每跨过 1/7 换一段：胶片横向推移 + 索引刻度 + 页码。
     任何一个滚动位置都只由 p 决定 —— 往回滚倒放，跳到中段刷新也立刻正确。 */
  function initGbiz() {
    var box = doc.querySelector('.r8c-gbiz');
    if (!box) return;

    var track = box.querySelector('.r8c-gbiz__track');
    var slides = all('.r8c-gbiz__slide', box);
    var items = all('.r8c-gbiz__item', box);
    var ticks = all('.r8c-gbiz__ticks i', box);
    var count = box.querySelector('.r8c-gbiz__count b');
    var prev = box.querySelector('.r8c-gbiz__btn[data-dir="-1"]');
    var next = box.querySelector('.r8c-gbiz__btn[data-dir="1"]');
    var glow = box.querySelector('.r8c-gbiz__bg');
    var n = slides.length;
    if (!n) return;

    /* 减少动态效果 / 不支持运行时：切成纵向长排，索引和舞台控制全部隐藏 */
    if (RM) {
      box.classList.add('r8c-gbiz--static');
      slides.forEach(function (s) { s.classList.add('is-cur'); });
      return;
    }

    var cur = -1;
    var raf = 0;
    var first = true;
    /* 地址带 #bN 时锁定：浏览器自己的锚点滚动会晚一帧把页面拉回「该 slide 顶部」，
       滚动监听若在这之前按错误位置算一次进度，就会把状态覆盖成别的段。
       锁定期间 setActive 只认初始锚点那一段；对齐完成后解除。 */
    var lockHi = -1;
    var lockT = 0;
    /* 离开舞台（上下都是普通区块）时，进度落在两端，不该再改写当前段：
       原来向上滚一屏就会把状态刷成第 1 段，等于把「已选的板块」冲掉。 */
    var inStage = false;
    /* 窄屏索引是横向单行——7 项比屏宽，必须让它跟着当前项横向滑到位，
       否则读者只看到前 3 项，后面的板块等于没有入口。宽屏是纵向一列，
       不会溢出，这里直接跳过（也不会产生横向抖动）。 */
    var list = box.querySelector('.r8c-gbiz__list');
    function scrollIndex(i) {
      if (!list || list.scrollWidth <= list.clientWidth + 2) return;
      var b = items[i];
      if (!b) return;
      var target = b.offsetLeft - (list.clientWidth - b.offsetWidth) / 2;
      var max = list.scrollWidth - list.clientWidth;
      list.scrollLeft = clamp(target, 0, max);
    }

    function setActive(i, initial) {
      if (!initial && !inStage) return;
      if (lockHi >= 0 && i !== lockHi && Date.now() < lockT) i = lockHi;
      if (i === cur) return;
      cur = i;
      if (first) {
        /* 首帧：横向位置直接给到位，不播切换动效（否则页面打开就横滑一下） */
        first = false;
        if (track) track.style.transition = 'none';
        if (glow) glow.style.transition = 'none';
      } else {
        if (track) track.style.transition = 'transform .72s cubic-bezier(.32, .72, 0, 1)';
        if (glow) glow.style.transition = 'transform .9s cubic-bezier(.32, .72, 0, 1)';
      }
      slides.forEach(function (s, k) { s.classList.toggle('is-cur', k === i); });
      items.forEach(function (b, k) {
        var on = k === i;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
      ticks.forEach(function (t, k) {
        t.classList.toggle('is-on', k === i);
        t.classList.toggle('is-past', k < i);
      });
      if (count) count.textContent = (i < 9 ? '0' : '') + (i + 1);
      if (prev) prev.disabled = i <= 0;
      if (next) next.disabled = i >= n - 1;
      scrollIndex(i);
      /* 胶片横移：每段宽 100%，用百分比避免量宽度受滚动条影响 */
      if (track) track.style.transform = 'translate3d(' + (-100 * i) + '%,0,0)';
      /* 光晕随进度横移（景深最慢的一层，位移比画面小很多） */
      if (glow) glow.style.transform = 'translate3d(' + (-2.4 * i) + '%,0,0)';
      if (initial && track) {
        void track.offsetWidth;
        track.style.transition = '';
        if (glow) glow.style.transition = '';
      }
    }

    function syncStage() {
      var rect = box.getBoundingClientRect();
      var vh = window.innerHeight;
      inStage = rect.top < vh * 0.5 && rect.bottom > vh * 0.5;
      return inStage;
    }

    function progress() {
      var h = box.offsetHeight - window.innerHeight;
      if (h <= 0) return 0;
      var top = box.getBoundingClientRect().top;
      return clamp(-top / h, 0, 1);
    }

    function update() {
      raf = 0;
      var rect = box.getBoundingClientRect();
      var vh = window.innerHeight;
      inStage = rect.top < vh * 0.5 && rect.bottom > vh * 0.5;
      if (!inStage) return;
      var p = progress();
      var i = Math.round(p * (n - 1));
      /* 最后 8% 停在本段，回滚时对称退出，不会出现「还剩一屏却已经翻完」 */
      setActive(clamp(i, 0, n - 1), false);
    }

    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    /* 首屏可能不在舞台里（直链/刷新在页面顶部），先把状态判对 */
    syncStage();

    /* 点索引 / 上一项下一项：平滑滚到该段对应的舞台进度（用户自己滚也一样） */
    function goto(i, smooth) {
      i = clamp(i, 0, n - 1);
      inStage = true;
      var h = box.offsetHeight - window.innerHeight;
      var y = box.getBoundingClientRect().top + window.pageYOffset
        + h * (n === 1 ? 0 : i / (n - 1));
      var behavior = smooth === false ? 'auto' : 'smooth';
      try { window.scrollTo({ top: y, behavior: RM ? 'auto' : behavior }); }
      catch (e) { window.scrollTo(0, y); }
    }

    items.forEach(function (b, k) {
      b.addEventListener('click', function () {
        /* 点自己已经是当前段：轻微滚到该段中心，给一次「到过」的回应 */
        goto(k);
      });
      b.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowRight' &&
            e.key !== 'ArrowUp' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        var d = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
        var t = clamp(k + d, 0, n - 1);
        items[t].focus();
        goto(t);
      });
    });
    if (prev) prev.addEventListener('click', function () { goto(cur - 1); });
    if (next) next.addEventListener('click', function () { goto(cur + 1); });

    /* 地址栏带 #b3 这类锚点时：换算成舞台进度，而不是滚到容器顶部 */
    /* 地址栏带 #b3 这类锚点时：换算成舞台进度，而不是滚到容器顶部。
       必须在 setActive 之前算 y —— 页面可能已经是 #b4，scrollTo 不会触发
       scroll 事件，先算后滚才不会把上一页的段落状态留在画面上。 */
    var hash = (location.hash || '').replace('#', '');
    var hi = -1;
    slides.forEach(function (s, k) { if (s.id === hash) hi = k; });
    if (hi > 0) {
      lockHi = hi;
      lockT = Date.now() + 1500;
      var h0 = box.offsetHeight - window.innerHeight;
      var y0 = box.getBoundingClientRect().top + window.pageYOffset
        + h0 * (hi / (n - 1));
      setActive(hi, true);
      window.scrollTo(0, y0);
      /* 浏览器对 #b4 的默认锚点滚动会把舞台钉到「该 slide 顶部」，
         和我们换算出的 y0 不一致（实测相差近一屏且不稳定）。
         加载完成后把锚点从地址栏抹掉，再由下一帧把位置对齐一次，
         用户看到的仍然是 …/#b4 之外的干净地址。 */
      if (window.history && history.replaceState) {
        try {
          history.replaceState(null, '',
            location.pathname + location.search);
        } catch (e) {}
      }
      var align = function () {
        syncStage();
        var t = box.getBoundingClientRect().top + window.pageYOffset
          + (box.offsetHeight - window.innerHeight) * (hi / (n - 1));
        if (Math.abs(window.pageYOffset - t) > 4) window.scrollTo(0, t);
        setActive(hi, false);
      };
      window.addEventListener('load', align);
      /* 图片/字体加载会改变页高，load 之后再对齐两次，然后放开锁定 */
      setTimeout(align, 60);
      setTimeout(align, 420);
      setTimeout(function () { align(); lockHi = -1; }, 900);
    } else {
      setActive(0, true);
    }
    update();
  }

  /* ------------------------------------------------------------------ 启动 */
  function boot() {
    safe(initGsec);
    safe(initGquote);
    safe(initGbiz);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
