/* ==========================================================================
   r8c-motion.js — 原生交互动效引擎（零依赖 / 无 CDN）
   配合 r8c-style.css 第 17 节使用。

   组件清单
     .r8c-reveal[data-reveal=up|down|left|right|zoom|fade]  滚动进场 + 自动错落
     .r8c-num[data-to]                                      数字滚动计数
     .r8c-tabs                                               Tab 切换（滑动指示条）
     .r8c-tl                                                横向时间轴轮播（箭头/拖拽/吸附）
     .r8c-expand                                            展开 / 收起
     .r8c-newsz__car                                        资讯区图片轮播（自动+圆点+悬停暂停）
     [data-newslist][data-per-page]                          资讯列表真实分页（按条数切片）
     .r8c-acc                                               方案手风琴（触屏点击切换；悬停展开由 CSS 负责）
     .r8c-hero-video                                        hero 视频加载失败兜底
     .r8c-progress                                          顶部阅读进度条
     .r8c-top-btn                                           回顶按钮（滚动出现）
     .r8c-bg-text / .r8c-parallax                           视差位移

   安全策略
     · 隐藏态只在 html.r8c-motion-ready 下生效 —— JS 未加载时内容照常可见
     · 每个组件独立 try/catch —— 单点异常不影响其余组件
     · 3 秒兜底：视口内仍未进场的元素强制显示
     · 尊重 prefers-reduced-motion
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var RM = false;
  try { RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function all(sel, ctx) {
    return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel));
  }
  /* 元素在文档中的布局位置（不受 transform 影响，避免视差反馈抖动） */
  function docTop(el) {
    var t = 0, n = el;
    while (n) { t += n.offsetTop; n = n.offsetParent; }
    return t;
  }
  function safe(fn) {
    try { fn(); } catch (e) {
      if (window.console && console.warn) console.warn('[r8c-motion]', e);
    }
  }

  /* 立刻开启隐藏态（放在最前，保证 CSS 的隐藏规则与 JS 同生共死） */
  root.className += ' r8c-motion-ready';

  /* ------------------------------------------------------------------ 1. 滚动进场 */
  var revealIO = null;                 /* 复用同一个观察器，避免每次调用都新建（泄漏） */
  var revealSeen = typeof WeakSet === 'function' ? new WeakSet() : null;

  function initReveal() {
    var els = all('.r8c-reveal');
    if (!els.length) return;

    /* 自动错落：容器声明 data-stagger="90" → 子项依次延迟 90ms */
    all('[data-stagger]').forEach(function (box) {
      var step = parseInt(box.getAttribute('data-stagger'), 10) || 90;
      all('.r8c-reveal', box).forEach(function (el, i) {
        if (!el.hasAttribute('data-delay')) el.setAttribute('data-delay', String(i * step));
      });
    });

    els.forEach(function (el) {
      var d = el.getAttribute('data-delay');
      var u = el.getAttribute('data-dur');
      if (d) el.style.transitionDelay = d + 'ms';
      if (u) el.style.transitionDuration = u + 'ms';
    });

    function show(el) { el.classList.add('is-in'); }

    if (RM || !('IntersectionObserver' in window)) { els.forEach(show); return; }

    if (!revealIO) {
      revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          show(e.target);
          revealIO.unobserve(e.target);
        });
      }, { threshold: 0, rootMargin: '0px 0px -60px 0px' });
    }

    els.forEach(function (el) {
      if (el.classList.contains('is-in')) return;
      if (revealSeen && revealSeen.has(el)) return;   /* 已登记过，别重复观察 */
      if (revealSeen) revealSeen.add(el);
      revealIO.observe(el);
    });

    /* 兜底扫查：IntersectionObserver 在「页面被截图/切到后台/由脚本瞬间
       scrollTo 跳过」这些场景下可能漏掉回调，漏一次元素就永久停在
       opacity:0（实测窄屏 + 截图后整块核心功能消失）。滚动时补一次视口
       检查，成本只有一次 getBoundingClientRect 批量遍历。 */
    var sweeping = false;
    function sweep() {
      sweeping = false;
      all('.r8c-reveal:not(.is-in)').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight - 20 && r.bottom > 0) el.classList.add('is-in');
      });
    }
    window.addEventListener('scroll', function () {
      if (!sweeping) { sweeping = true; requestAnimationFrame(sweep); }
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ 2. 数字滚动 */
  function fmt(v, dec) {
    if (dec) return v.toFixed(dec);
    return Math.round(v).toLocaleString('en-US');
  }

  function initCount() {
    var els = all('.r8c-num[data-to]');
    if (!els.length) return;

    function run(el) {
      var to = parseFloat(el.getAttribute('data-to')) || 0;
      var dec = parseInt(el.getAttribute('data-dec'), 10) || 0;
      var dur = parseInt(el.getAttribute('data-dur'), 10) || 1500;
      if (RM) { el.textContent = fmt(to, dec); return; }
      var t0 = 0;
      function frame(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 4);          /* easeOutQuart */
        el.textContent = fmt(to * eased, dec);
        if (p < 1) requestAnimationFrame(frame);
        else el.textContent = fmt(to, dec);
      }
      requestAnimationFrame(frame);
    }

    if (!('IntersectionObserver' in window)) { els.forEach(run); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        run(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------ 3. Tab 切换 */
  function initTabs() {
    var seq = 0;
    all('.r8c-tabs').forEach(function (box) {
      var btns = all('.r8c-tabs__btn', box);
      var panels = all('.r8c-tabs__panel', box);
      var ink = box.querySelector('.r8c-tabs__ink');
      if (!btns.length || !panels.length) return;

      /* 补全 ARIA 关联：按钮 aria-controls → 面板 id，面板 aria-labelledby → 按钮 id。
         用 JS 生成 id 而不是写进 HTML，这样同一页出现多组 Tab 也不会撞 id。 */
      var gid = 'r8c-tabs-' + (seq++);
      btns.forEach(function (b, i) { b.id = gid + '-t' + i; });
      panels.forEach(function (p, i) {
        p.id = gid + '-p' + i;
        p.setAttribute('role', 'tabpanel');
        p.setAttribute('aria-labelledby', gid + '-t' + i);
      });
      btns.forEach(function (b, i) { b.setAttribute('aria-controls', gid + '-p' + i); });

      function moveInk(btn) {
        if (!ink || !btn) return;
        ink.style.width = btn.offsetWidth + 'px';
        ink.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
      }
      function activate(i, initial) {
        btns.forEach(function (b, j) {
          var on = (i === j);
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
          if (on) b.removeAttribute('tabindex'); else b.setAttribute('tabindex', '-1');
        });
        panels.forEach(function (p, j) { p.classList.toggle('is-on', i === j); });
        moveInk(btns[i]);
        /* 新面板内的进场元素直接置为已进 —— 它们在 display:none 期间观察器不会触发，
           不主动置位就会一直隐身（空白面板）。
           但**首次初始化**不能置位，否则默认面板的卡片会在页面加载时就播完动画，
           滚动到时反而看不到错落进场。 */
        if (!initial) {
          all('.r8c-reveal', panels[i]).forEach(function (el) { el.classList.add('is-in'); });
        }
      }

      btns.forEach(function (btn, i) {
        btn.addEventListener('click', function () { activate(i); });
        btn.addEventListener('keydown', function (e) {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          var n = (i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length;
          btns[n].focus();
          activate(n);
        });
      });

      var start = btns.findIndex(function (b) { return b.classList.contains('is-on'); });
      activate(start < 0 ? 0 : start, true);

      window.addEventListener('resize', function () {
        var cur = box.querySelector('.r8c-tabs__btn.is-on');
        moveInk(cur);
      });
    });
  }

  /* ------------------------------------------------------------------ 3.5 吸顶锚点导航 */
  /* 产品详情页 .r8c-subnav：点击平滑滚动 + 滚动高亮 + ink 指示条跟随。
     sticky 偏移按实测主导航高度校正——独立站剥掉主导航后自动归零，
     不依赖 CSS 预判（media query 断点也自动跟随）。 */
  function initSubnav() {
    all('.r8c-subnav').forEach(function (box) {
      var links = all('.r8c-subnav__link', box);
      var ink = box.querySelector('.r8c-subnav__ink');
      var nav = doc.querySelector('.r8c-nav');
      if (!links.length) return;

      var navH = nav ? nav.offsetHeight : 0;
      box.style.top = navH + 'px';

      var targets = links.map(function (l) {
        var id = (l.getAttribute('href') || '').slice(1);
        return id ? doc.getElementById(id) : null;
      });

      /* 绝对文档位置：不用 offsetTop（受 offsetParent 定位影响，section 可能 relative） */
      function absTop(el) { return el.getBoundingClientRect().top + window.scrollY; }

      function moveInk(el) {
        if (!ink || !el) return;
        ink.style.width = el.offsetWidth + 'px';
        ink.style.transform = 'translateX(' + el.offsetLeft + 'px)';
      }
      /* 窄屏横滚态：把激活项滚进可视区。
         只滚子导航自己的溢出容器——绝不用 scrollIntoView：
         它会连页面滚动容器一起滚，和进行中的平滑滚动互相打架
         （实测锚点落点被搅偏 300px+）。 */
      function ensureVisible(l) {
        /* 链接区才是横向滚动容器；容器内含 CTA 时不能滚 .r8c-subnav__inner */
        var inner = box.querySelector('.r8c-subnav__links')
                 || box.querySelector('.r8c-subnav__inner');
        if (!inner || !l) return;
        var left = l.offsetLeft, right = left + l.offsetWidth;
        var vL = inner.scrollLeft, vR = vL + inner.clientWidth;
        if (left < vL + 8 || right > vR - 8) {
          inner.scrollTo({
            left: Math.max(0, left - (inner.clientWidth - l.offsetWidth) / 2),
            behavior: RM ? 'auto' : 'smooth'
          });
        }
      }
      function activate(i) {
        links.forEach(function (l, j) {
          var on = (i === j);
          l.classList.toggle('is-on', on);
          if (on) l.setAttribute('aria-current', 'true');
          else l.removeAttribute('aria-current');
        });
        moveInk(links[i]);
        ensureVisible(links[i]);
      }

      links.forEach(function (l, i) {
        l.addEventListener('click', function (e) {
          var t = targets[i];
          if (!t) return;
          e.preventDefault();
          var top = absTop(t) - (navH + box.offsetHeight + 16);
          window.scrollTo({ top: Math.max(0, top), behavior: RM ? 'auto' : 'smooth' });
          activate(i);
        });
      });

      /* scrollspy：滚动位置减去双条高度，最后一个越过偏移线的 section 胜出 */
      var cur = -1;
      function spy() {
        var offset = window.scrollY + navH + box.offsetHeight + 24;
        var idx = 0;
        for (var i = 0; i < targets.length; i++) {
          if (targets[i] && absTop(targets[i]) <= offset) idx = i;
        }
        if (idx !== cur) { cur = idx; activate(idx); }
      }
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(function () { spy(); ticking = false; });
        }
      }, { passive: true });
      window.addEventListener('resize', function () {
        navH = nav ? nav.offsetHeight : 0;
        box.style.top = navH + 'px';
        spy();
      });

      /* 初始激活：URL hash 命中则定位之，否则第一项 */
      var start = 0;
      if (location.hash) {
        for (var i = 0; i < links.length; i++) {
          if (links[i].getAttribute('href') === location.hash) { start = i; break; }
        }
      }
      activate(start);
    });
  }

  /* ------------------------------------------------------------------ 4. 横向时间轴 */
  function initTimeline() {
    all('.r8c-tl').forEach(function (box) {
      var track = box.querySelector('.r8c-tl__track');
      if (!track) return;
      var prev = box.querySelector('[data-tl-prev]');
      var next = box.querySelector('[data-tl-next]');

      function stepPx() {
        var it = track.querySelector('.r8c-tl__item');
        if (!it) return track.clientWidth * 0.8;
        var cs = getComputedStyle(track);
        var gap = parseFloat(cs.columnGap || cs.gap) || 24;
        return it.offsetWidth + gap;
      }
      function syncBtns() {
        var max = track.scrollWidth - track.clientWidth - 2;
        if (prev) prev.disabled = track.scrollLeft <= 2;
        if (next) next.disabled = track.scrollLeft >= max;
      }
      function go(dir) {
        track.scrollBy({ left: dir * stepPx(), behavior: RM ? 'auto' : 'smooth' });
      }

      if (prev) prev.addEventListener('click', function () { go(-1); });
      if (next) next.addEventListener('click', function () { go(1); });
      track.addEventListener('scroll', syncBtns, { passive: true });
      window.addEventListener('resize', syncBtns);

      /* 横向滚动区域必须可聚焦 —— 否则键盘用户完全无法浏览（WCAG 2.1 可操作）。
         聚焦后用方向键/Home/End 翻页。 */
      if (!track.hasAttribute('tabindex')) track.setAttribute('tabindex', '0');
      if (!track.getAttribute('role')) track.setAttribute('role', 'group');
      if (!track.getAttribute('aria-label')) {
        track.setAttribute('aria-label', '时间轴，可用左右方向键浏览');
      }
      track.addEventListener('keydown', function (e) {
        var k = e.key;
        if (k === 'ArrowRight') { e.preventDefault(); go(1); }
        else if (k === 'ArrowLeft') { e.preventDefault(); go(-1); }
        else if (k === 'Home') {
          e.preventDefault();
          track.scrollTo({ left: 0, behavior: RM ? 'auto' : 'smooth' });
        } else if (k === 'End') {
          e.preventDefault();
          track.scrollTo({ left: track.scrollWidth, behavior: RM ? 'auto' : 'smooth' });
        }
      });

      /* 指针拖拽（超过 6px 才算拖拽，避免误吞点击） */
      var down = false, sx = 0, sl = 0, moved = 0;
      track.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        down = true; moved = 0; sx = e.clientX; sl = track.scrollLeft;
        track.classList.add('is-dragging');
      });
      track.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - sx;
        moved = Math.max(moved, Math.abs(dx));
        if (moved > 6) { track.scrollLeft = sl - dx; }
      });
      function endDrag() {
        if (!down) return;
        down = false;
        track.classList.remove('is-dragging');
      }
      track.addEventListener('pointerup', endDrag);
      track.addEventListener('pointercancel', endDrag);
      track.addEventListener('pointerleave', endDrag);

      syncBtns();
    });
  }

  /* ------------------------------------------------------------------ 5. 展开 / 收起 */
  function initExpand() {
    all('.r8c-expand').forEach(function (box) {
      var body = box.querySelector('.r8c-expand__body');
      var btn = box.querySelector('.r8c-expand__more');
      if (!body || !btn) return;
      var collapsed = parseInt(box.getAttribute('data-collapsed'), 10) || 140;

      function apply(open) {
        box.classList.toggle('is-open', open);
        box.classList.toggle('is-closed', !open);
        body.style.maxHeight = (open ? body.scrollHeight : collapsed) + 'px';
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        var lbl = btn.querySelector('.r8c-expand__txt');
        if (lbl) lbl.textContent = open ? '收起' : '展开全文';
      }
      apply(false);

      btn.addEventListener('click', function () {
        var willOpen = !box.classList.contains('is-open');
        apply(willOpen);
        if (!willOpen) {
          var top = docTop(box) - 140;
          if (window.scrollY > top) window.scrollTo({ top: top, behavior: RM ? 'auto' : 'smooth' });
        }
      });
      window.addEventListener('resize', function () {
        body.style.maxHeight =
          (box.classList.contains('is-open') ? body.scrollHeight : collapsed) + 'px';
      });
    });
  }

  /* ------------------------------------------------------------------ 6. 顶部进度条 */
  function initProgress() {
    var bar = doc.querySelector('.r8c-progress');
    if (!bar) return;
    var ticking = false;
    function upd() {
      ticking = false;
      var h = root.scrollHeight - window.innerHeight;
      var p = h > 0 ? (window.scrollY / h) : 0;
      bar.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(2) + '%';
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(upd); }
    }, { passive: true });
    upd();
  }

  /* ------------------------------------------------------------------ 7. 回顶按钮 */
  function initTopBtn() {
    var b = doc.querySelector('.r8c-top-btn');
    if (!b) return;
    var on = null;
    function upd() {
      var s = window.scrollY > 400;
      if (s !== on) { on = s; b.classList.toggle('is-show', s); }
    }
    window.addEventListener('scroll', upd, { passive: true });
    upd();
    b.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
    });
  }

  /* ------------------------------------------------------------------ 8. 视差 */
  function initParallax() {
    if (RM) return;
    var els = all('.r8c-bg-text, .r8c-parallax');
    if (!els.length) return;
    els.forEach(function (el) {
      if (!el.hasAttribute('data-speed')) {
        el.setAttribute('data-speed', el.classList.contains('r8c-bg-text') ? '0.14' : '0.08');
      }
    });
    var ticking = false;
    function upd() {
      ticking = false;
      var vh = window.innerHeight, sy = window.scrollY;
      els.forEach(function (el) {
        var base = docTop(el);
        var h = el.offsetHeight;
        if (base + h < sy - vh * 0.5 || base > sy + vh * 1.5) return;
        var k = parseFloat(el.getAttribute('data-speed')) || 0.1;
        var py = (base + h / 2 - (sy + vh / 2)) * k;
        el.style.setProperty('--py', py.toFixed(1) + 'px');
      });
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(upd); }
    }, { passive: true });
    window.addEventListener('resize', upd);
    upd();
  }

  /* ------------------------------------------------------------------ 9. Hero 粒子网络
     在 .r8c-banner 内注入 canvas（z-index 1，沉在文字层下）：粒子缓慢漂移、
     邻近连线、鼠标靠近时轻微吸附。纯增强 —— 无 JS / RM 偏好时首屏与升级前一致。
     性能护栏：DPR ≤2、密度按面积折算、页面隐藏或 hero 滚出视口时暂停 rAF。 */
  function initParticles() {
    if (RM) return;
    all('.r8c-banner').forEach(function (banner) {
      var cv = doc.createElement('canvas');
      cv.className = 'r8c-particles';
      cv.setAttribute('aria-hidden', 'true');
      banner.insertBefore(cv, banner.firstChild);
      var ctx = cv.getContext && cv.getContext('2d');
      if (!ctx) { banner.removeChild(cv); return; }

      var DPR = Math.min(window.devicePixelRatio || 1, 2);
      var W = 0, H = 0, pts = [], raf = 0, running = false, visible = true;
      var mx = -9999, my = -9999;
      var LINK = 115, MOUSE = 160;

      function resize() {
        W = banner.clientWidth; H = banner.clientHeight;
        if (!W || !H) return;
        cv.width = Math.round(W * DPR);
        cv.height = Math.round(H * DPR);
        cv.style.width = W + 'px';
        cv.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        var n = Math.max(18, Math.min(90, Math.round(W * H / 26000)));
        pts = [];
        for (var i = 0; i < n; i++) {
          pts.push({
            x: Math.random() * W, y: Math.random() * H,
            vx: (Math.random() - .5) * .34, vy: (Math.random() - .5) * .34,
            r: Math.random() * 1.5 + .7
          });
        }
      }

      function frame() {
        raf = 0;
        if (!running) return;
        ctx.clearRect(0, 0, W, H);
        var i, j, p, q, dx, dy, d;
        for (i = 0; i < pts.length; i++) {
          p = pts[i];
          /* 鼠标轻微吸附 */
          dx = mx - p.x; dy = my - p.y; d = Math.sqrt(dx * dx + dy * dy);
          if (d < MOUSE && d > 0.01) { p.vx += dx / d * .012; p.vy += dy / d * .012; }
          /* 限速，防止吸附累积加速 */
          var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (sp > .55) { p.vx = p.vx / sp * .55; p.vy = p.vy / sp * .55; }
          p.x += p.vx; p.y += p.vy;
          if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
          if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
        }
        /* 连线（先线后点，点压在线端上更干净） */
        for (i = 0; i < pts.length; i++) {
          for (j = i + 1; j < pts.length; j++) {
            p = pts[i]; q = pts[j];
            dx = p.x - q.x; dy = p.y - q.y; d = dx * dx + dy * dy;
            if (d > LINK * LINK) continue;
            var a = (1 - Math.sqrt(d) / LINK) * .34;
            ctx.strokeStyle = 'rgba(110,180,255,' + a.toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        /* 鼠标与邻近粒子的亮连线 */
        if (mx > -999) {
          for (i = 0; i < pts.length; i++) {
            p = pts[i];
            dx = p.x - mx; dy = p.y - my; d = dx * dx + dy * dy;
            if (d > MOUSE * MOUSE) continue;
            var am = (1 - Math.sqrt(d) / MOUSE) * .45;
            ctx.strokeStyle = 'rgba(140,220,255,' + am.toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mx, my); ctx.stroke();
          }
        }
        /* 粒子本体 */
        for (i = 0; i < pts.length; i++) {
          p = pts[i];
          ctx.fillStyle = 'rgba(150,205,255,.75)';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
        }
        raf = requestAnimationFrame(frame);
      }

      function play() {
        if (running || doc.hidden || !visible) return;
        running = true;
        if (!raf) raf = requestAnimationFrame(frame);
      }
      function pause() { running = false; }

      banner.addEventListener('pointermove', function (e) {
        var r = banner.getBoundingClientRect();
        mx = e.clientX - r.left; my = e.clientY - r.top;
      });
      banner.addEventListener('pointerleave', function () { mx = my = -9999; });
      doc.addEventListener('visibilitychange', function () {
        if (doc.hidden) pause(); else play();
      });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) {
          visible = en[0].isIntersecting;
          if (visible) play(); else pause();
        }, { threshold: 0 }).observe(banner);
      }
      window.addEventListener('resize', function () { resize(); });

      resize();
      play();
    });
  }

  /* ------------------------------------------------------------------ 9. 资讯区轮播 */
  function initCarousel() {
    all('.r8c-newsz__car').forEach(function (car) {
      var slides = all('.r8c-newsz__slide', car),
          dotsBox = car.querySelector('.r8c-newsz__dots'),
          cur = 0, timer = null;
      if (slides.length < 2) return;
      slides.forEach(function (_, i) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', '第' + (i + 1) + '张');
        if (i === 0) b.className = 'is-on';
        b.addEventListener('click', function () { go(i); restart(); });
        if (dotsBox) dotsBox.appendChild(b);
      });
      var dots = dotsBox ? all('button', dotsBox) : [];
      function go(i) {
        slides[cur].classList.remove('is-on');
        if (dots[cur]) dots[cur].classList.remove('is-on');
        cur = (i + slides.length) % slides.length;
        slides[cur].classList.add('is-on');
        if (dots[cur]) dots[cur].classList.add('is-on');
      }
      function restart() {
        clearInterval(timer);
        if (RM) return;                       /* 降低动效偏好：不自动轮播，保留手动圆点 */
        timer = setInterval(function () { go(cur + 1); }, 2800);
      }
      restart();
      car.addEventListener('mouseenter', function () { clearInterval(timer); });
      car.addEventListener('mouseleave', restart);
    });
  }

  /* ------------------------------------------------------------------ 10. 方案手风琴 */
  /* 悬停展开走 CSS（@media hover:hover）；这里只补触屏/无悬停设备的点击切换。
     首卡 .on 由 HTML 自带 —— 无 JS 时第一张默认展开，内容不丢。 */
  function initAccordion() {
    all('.r8c-acc').forEach(function (acc) {
      var cards = all('.r8c-acc__card', acc);
      function activate(card) {
        cards.forEach(function (x) { x.classList.remove('on'); });
        card.classList.add('on');
      }
      /* 2026-10-20 评审 S2：深链落地（导航下拉 solutions.html#s3）时直接
         展开对应卡。缺了这层，用户落到一张收起卡——要点、案例、按钮全在
         隐藏面板里，锚点只跳了滚。hashchange 兼容页内改锚点。 */
      function syncHash() {
        var h = location.hash;
        if (!h) return;
        for (var i = 0; i < cards.length; i++) {
          if (cards[i].id && '#' + cards[i].id === h) { activate(cards[i]); return; }
        }
      }
      syncHash();
      window.addEventListener('hashchange', syncHash);
      cards.forEach(function (card) {
        card.addEventListener('click', function () {
          if (!card.classList.contains('on')) activate(card);
        });
        /* 鼠标悬停即切换展开卡（对齐 r8c.com：同时只有一张展开）。
           触屏的 pointerenter 同样会触发，用 pointerType 守卫让位给 click，
           否则「触摸按下切换 + click 又切回」会互相抵消。 */
        card.addEventListener('pointerenter', function (e) {
          if (e.pointerType && e.pointerType !== 'mouse') return;
          if (!card.classList.contains('on')) activate(card);
        });
      });
    });
  }

  /* ------------------------------------------------------------------ 11. hero 视频兜底 */
  /* 加载/解码失败时隐藏 video 元素，露出 section 自身的海报背景图 */
  function initHeroVideo() {
    all('.r8c-hero-video').forEach(function (v) {
      v.addEventListener('error', function () { v.style.display = 'none'; }, true);
      if (RM) return; /* 降低动效偏好：不自动播放，视频停在海报帧（poster 属性） */
      var p = v.play && v.play();
      if (p && p.catch) p.catch(function () { /* 自动播放被拦：海报仍在，不打扰用户 */ });
    });
  }

  /* ------------------------------------------------------------------ 12. 产品页 Hero 背景
     三件事：
       1) 鼠标柔光 —— 把指针位置写进 --mx/--my，遮罩上的 radial-gradient 跟手
          （纯 CSS 渲染，JS 只写两个自定义属性，离开时移除 is-live 淡出）
       2) 滚动视差 —— 背景外层 bgwrap 反向位移，营造"图在纸后面"的层次
       3) 首屏图解码兜底 —— 解码完成后加 is-ready，避免 kenburns 在空白上跑
     性能：滚动用 rAF 节流；hero 滚出视口直接跳过计算。 */
  function initPhero() {
    all('.r8c-phero').forEach(function (h) {
      var glow = h.querySelector('.r8c-phero__glow');
      var wrap = h.querySelector('.r8c-phero__bgwrap');
      var img = h.querySelector('.r8c-phero__bg');

      if (img) {
        if (img.complete) h.classList.add('is-ready');
        else img.addEventListener('load', function () { h.classList.add('is-ready'); });
      }

      if (glow && !RM) {
        h.addEventListener('pointermove', function (e) {
          var r = h.getBoundingClientRect();
          glow.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
          glow.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
          h.classList.add('is-live');
        }, { passive: true });
        h.addEventListener('pointerleave', function () { h.classList.remove('is-live'); });
      }

      if (!wrap || RM) return;
      var ticking = false;
      function upd() {
        ticking = false;
        var r = h.getBoundingClientRect();
        if (r.bottom < -80 || r.top > window.innerHeight + 80) return;
        /* 以 hero 中心相对视口中心的偏移量换算位移（±1 → ±16px）。
           幅度刻意压小：背景层没有额外出血余量，位移过大底部会露底。 */
        var k = (window.innerHeight / 2 - (r.top + r.height / 2)) / r.height;
        k = Math.max(-1, Math.min(1, k));
        wrap.style.transform = 'translate3d(0,' + (k * 16).toFixed(1) + 'px,0)';
      }
      window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(upd); }
      }, { passive: true });
      window.addEventListener('resize', upd);
      upd();
    });
  }

  /* -------------------------------------------------------- 资讯列表真实分页
     .r8c-newslist[data-newslist][data-per-page]  按真实条数切片 + 生成页码条
     条数装得下（1 页）时直接删掉页码条，不再出现写死的「1 2 3」。 */
  function initNewsPager() {
    all('[data-newslist]').forEach(function (list) {
      var per = parseInt(list.getAttribute('data-per-page'), 10) || 6;
      var items = Array.prototype.slice.call(list.children);
      var pages = Math.ceil(items.length / per);
      var box = list.parentNode.querySelector('[data-pager]');
      if (!box) return;
      if (pages <= 1) { if (box.parentNode) box.parentNode.removeChild(box); return; }

      var cur = 1;
      box.setAttribute('role', 'navigation');
      box.setAttribute('aria-label', '列表分页');

      function mkBtn(text, on, disabled) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'r8c-pager__item' + (on ? ' is-on' : '') + (disabled ? ' is-off' : '');
        b.textContent = text;
        if (disabled) b.disabled = true;
        return b;
      }

      function pageSeq(n, c) {
        var i, out = [];
        if (n <= 7) { for (i = 1; i <= n; i++) out.push(i); return out; }
        out.push(1);
        if (c > 3) out.push('…');
        for (i = Math.max(2, c - 1); i <= Math.min(n - 1, c + 1); i++) out.push(i);
        if (c < n - 2) out.push('…');
        out.push(n);
        return out;
      }

      function render() {
        items.forEach(function (el, i) {
          var show = i >= (cur - 1) * per && i < cur * per;
          el.classList.toggle('is-pagehide', !show);
          if (show) el.removeAttribute('hidden');
          else el.setAttribute('hidden', '');
        });
        box.innerHTML = '';
        var prev = mkBtn('上一页', false, cur === 1);
        prev.addEventListener('click', function () { go(cur - 1); });
        box.appendChild(prev);
        pageSeq(pages, cur).forEach(function (p) {
          if (p === '…') {
            var d = doc.createElement('span');
            d.className = 'r8c-pager__dots';
            d.textContent = '…';
            box.appendChild(d);
            return;
          }
          var b = mkBtn(String(p), p === cur, false);
          if (p === cur) b.setAttribute('aria-current', 'page');
          b.addEventListener('click', function () { go(p); });
          box.appendChild(b);
        });
        var next = mkBtn('下一页', false, cur === pages);
        next.addEventListener('click', function () { go(cur + 1); });
        box.appendChild(next);
      }

      function go(n) {
        if (n < 1 || n > pages || n === cur) return;
        cur = n;
        render();
        /* 翻页后把列表顶拉回视口（扣掉吸顶导航高度）；已经在看就不动，避免乱滚 */
        var top = list.getBoundingClientRect().top + window.pageYOffset - 120;
        if (window.pageYOffset > top + 40 || window.pageYOffset < top - 240) {
          try { window.scrollTo({ top: top, behavior: RM ? 'auto' : 'smooth' }); }
          catch (e) { window.scrollTo(0, top); }
        }
      }

      render();
    });
  }

  /* ------------------------------------------------------------------ 启动 */
  function boot() {
    safe(initReveal);
    safe(initCount);
    safe(initTabs);
    safe(initSubnav);
    safe(initTimeline);
    safe(initExpand);
    safe(initCarousel);
    safe(initAccordion);
    safe(initHeroVideo);
    safe(initProgress);
    safe(initTopBtn);
    safe(initParallax);
    safe(initParticles);
    safe(initPhero);
    safe(initNewsPager);

    /* 兜底：3 秒后仍在视口内却没进场的元素，直接显示 */
    setTimeout(function () {
      all('.r8c-reveal:not(.is-in)').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in');
      });
    }, 3000);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* 供后续动态插入的内容复用 */
  window.r8cMotion = { reveal: function () { safe(initReveal); }, count: function () { safe(initCount); },
    pager: function () { safe(initNewsPager); } };
})();
