/* ==========================================================================
   oil-ui.js  —  「数据驱动渲染 + 交互补强」层（2026-10-22）
   --------------------------------------------------------------------------
   设计前提（与本项目既有约定一致）：
     页面 HTML 里**已经有完整内容**（生成器从 content.json 直出），所以
     没有 JS、JS 报错、或被搜索引擎抓取时，页面仍然是完整可读的一页。

   本文件做的是「动态渲染」：同一个生成器把同一份数据同时写成
       ① HTML 直出（上面说的兜底）
       ② <script type="application/json" data-oil-data="..."> 内联数据
   JS 在 DOM 就绪后读 ② 重建列表容器（[data-oil-list]），于是排序、筛选、
   计数、省略别名这类**由数据决定的表现**都发生在客户端：
       - 基地总览：卡片按省份筛（chip 计数随数据变）
       - 资讯页：公众号文章按日期排序，站内资讯按分类筛
       - 基地详情：指标/职能/业务方向的条数由数据决定，后台增删字段即生效
       - 联系我们：基地网络按省份聚合

   顺序约定：本文件必须在 assets/r8c-motion.js **之前**（page() 的 js_extra
   插在 motion 之前），这样重建出来的 .r8c-num 能被 motion 的计数动画接管。
   重建不挂 .r8c-reveal（那个靠 IntersectionObserver 一次性接管），改用
   .oil-enter 的一次性 CSS 动画，永远可见。
   ========================================================================== */
(function () {
  'use strict';

  if (typeof document === 'undefined') return;

  /* ------------------------------------------------------------------ 工具 */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /* 只放行站内相对路径与 http(s)，其余（javascript: 等）一律丢弃 */
  function safeHref(h) {
    var s = String(h || '').trim();
    if (/^(https?:\/\/|\/)/i.test(s)) return s;
    if (/^[\w.\-]+\.html(#[\w.\-]+)?$/.test(s)) return s;
    if (/^mailto:[^\s"'<>]+$/i.test(s) || /^tel:[+0-9\-()\s]+$/i.test(s)) return s;
    if (/^assets\/[\w./\-]+$/.test(s)) return s;
    return '';
  }
  function imgUrl(p) {
    var s = String(p || '').trim().replace(/\\/g, '/');
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[\w./\-]+$/.test(s)) return s.indexOf('/') === -1 ? 'assets/uploads/' + s : s;
    return '';
  }
  function fmt(n) {
    n = parseFloat(n) || 0;
    return Math.round(n).toLocaleString('en-US');
  }
  function numHtml(x) {
    /* 与 common.num_span 同构：.r8c-num[data-to] 由 r8c-motion 补间到终值 */
    var n = parseFloat(x && x.num) || 0;
    var suffix = x && x.suffix ? '<em>' + esc(x.suffix) + '</em>' : '';
    return '<span class="r8c-num" data-to="' + n + '">' + fmt(n) + '</span>' + suffix;
  }
  function data(name) {
    var el = $('script[data-oil-data="' + name + '"]');
    if (!el) return null;
    try { return JSON.parse(el.textContent || '{}'); } catch (e) { return null; }
  }
  function fill(container, html) {
    if (!container) return false;
    container.innerHTML = html;
    container.classList.add('oil-enter');
    return true;
  }

  /* -------------------------------------------------------------- 复制联系方式 */
  function initCopy() {
    $$('[data-oil-copy]').forEach(function (btn) {
      if (btn.getAttribute('data-oil-bound')) return;
      btn.setAttribute('data-oil-bound', '1');
      btn.setAttribute('aria-live', 'polite');
      var raw = btn.getAttribute('data-oil-copy');
      var label = btn.getAttribute('data-oil-label') || '复制';
      btn.textContent = label;
      btn.addEventListener('click', function () {
        function done() {
          btn.classList.add('is-done');
          btn.textContent = '已复制';
          window.setTimeout(function () {
            btn.classList.remove('is-done');
            btn.textContent = label;
          }, 1800);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(raw).then(done, fallback);
        } else { fallback(); }
        function fallback() {
          /* file:// 或旧浏览器没有 clipboard API：用隐藏 textarea 走 execCommand */
          var ta = document.createElement('textarea');
          ta.value = raw;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.top = '-1000px';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); done(); } catch (e) {
            btn.textContent = '请手动复制';
            window.setTimeout(function () { btn.textContent = label; }, 1800);
          }
          document.body.removeChild(ta);
        }
      });
    });
  }

  /* ------------------------------------------------------------------ 基地网络 */
  function renderNet() {
    var box = $('[data-oil-list="net"]');
    var d = data('contact');
    if (!box || !d || !d.bases || !d.bases.length) return;
    var html = d.bases.map(function (b) {
      var href = safeHref(b.href || (b.slug + '.html'));
      if (!href) return '';
      return '<li class="oil-net__row"><a href="' + esc(href) + '">' +
        '<span class="oil-net__prov">' + esc(b.prov) + '</span>' +
        '<span class="oil-net__name">' + esc(b.name) + '</span>' +
        '<span class="oil-net__go" aria-hidden="true">&#8599;</span>' +
        '</a></li>';
    }).join('');
    fill(box, html);
  }

  /* -------------------------------------------------------------- 基地总览卡片 */
  function baseCard(b) {
    var href = safeHref(b.href || (b.slug + '.html'));
    if (!href) return '';
    var img = imgUrl(b.image);
    var figStyle = img
      ? ' style="background-image:url(' + esc(img) + '),linear-gradient(160deg,#123,#0f2d5c)"'
      : '';
    var nums = (b.nums || []).slice(0, 2).map(function (n) {
      return '<span class="oil-base__num"><b>' + numHtml(n) + '</b>' +
        '<span>' + esc(n.label) + '</span></span>';
    }).join('');
    var alias = b.alias && b.alias !== b.name
      ? '<p class="oil-base__alias">别名：' + esc(b.alias) + '</p>' : '';
    return '<a class="oil-base" href="' + esc(href) + '" data-prov="' + esc(b.prov) + '">' +
      '<figure class="oil-base__fig"' + figStyle + '>' +
        '<span class="oil-base__prov">' + esc(b.prov) + '</span>' +
      '</figure>' +
      '<div class="oil-base__body">' +
        '<h3 class="oil-base__name">' + esc(b.name) + '</h3>' +
        alias +
        '<p class="oil-base__desc">' + esc(b.desc) + '</p>' +
        (nums ? '<div class="oil-base__nums">' + nums + '</div>' : '') +
        '<span class="oil-base__go">查看基地 <span aria-hidden="true">&#8594;</span></span>' +
      '</div></a>';
  }

  function renderBases() {
    var d = data('bases');
    var list = $('[data-oil-list="bases"]');
    var stats = $('[data-oil-list="bases-stats"]');
    var chipsBox = $('[data-oil-filters="bases"]');
    if (!d) return;

    if (stats && d.stats) {
      fill(stats, d.stats.map(function (s) {
        return '<div class="oil-stat"><b class="oil-stat__v">' + numHtml(s) + '</b>' +
          '<span class="oil-stat__k">' + esc(s.label) + '</span></div>';
      }).join(''));
    }
    if (list && d.bases) fill(list, d.bases.map(baseCard).join(''));

    if (chipsBox && d.provs) {
      var total = d.bases ? d.bases.length : 0;
      var chips = '<button type="button" class="oil-chip" data-prov="*" aria-pressed="true">' +
        '全部 <em>' + total + '</em></button>' +
        d.provs.map(function (p) {
          return '<button type="button" class="oil-chip" data-prov="' + esc(p.name) + '" aria-pressed="false">' +
            esc(p.short || p.name) + ' <em>' + p.count + '</em></button>';
        }).join('');
      fill(chipsBox, chips);
    }
    initFilter('bases', '.oil-base');
  }

  /* ---------------------------------------------------------------- 基地详情块 */
  function renderBase() {
    var d = data('base');
    if (!d) return;

    var numsBox = $('[data-oil-list="base-nums"]');
    if (numsBox && d.nums && d.nums.length) {
      fill(numsBox, d.nums.map(function (n) {
        return '<div class="oil-metric"><b class="oil-metric__v">' + numHtml(n) + '</b>' +
          '<span class="oil-metric__k">' + esc(n.label) + '</span></div>';
      }).join(''));
    }

    var capsBox = $('[data-oil-list="base-caps"]');
    if (capsBox && d.caps && d.caps.length) {
      fill(capsBox, d.caps.map(function (c, i) {
        return '<article class="oil-cap">' +
          '<span class="oil-cap__no">' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</span>' +
          '<h3 class="oil-cap__tit">' + esc(c.tit) + '</h3>' +
          '<p class="oil-cap__desc">' + esc(c.desc) + '</p></article>';
      }).join(''));
    }

    var bizBox = $('[data-oil-list="base-biz"]');
    if (bizBox && d.biz && d.biz.length) {
      fill(bizBox, d.biz.map(function (p, i) {
        return '<li class="oil-bizitem"><span class="oil-bizitem__no">' +
          (i + 1 < 10 ? '0' : '') + (i + 1) + '</span><p>' + esc(p) + '</p></li>';
      }).join(''));
    }

    var relBox = $('[data-oil-list="base-related"]');
    if (relBox && d.related && d.related.length) {
      fill(relBox, d.related.map(baseCard).join(''));
    }
  }

  /* ------------------------------------------------------------------ 资讯渲染 */
  function renderNews() {
    var d = data('news');
    if (!d) return;

    var featBox = $('[data-oil-list="news-feature"]');
    var sideBox = $('[data-oil-list="news-featlist"]');
    var listBox = $('[data-oil-list="news-archive"]');
    var chipsBox = $('[data-oil-filters="news"]');

    var wechat = (d.wechat && d.wechat.items) || [];
    wechat = wechat.slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });

    if (featBox) {
      var top = wechat[0];
      var href = top && safeHref(top.url || top.href);
      if (top && href) {
        var bg = imgUrl(top.image);
        featBox.innerHTML = '<a class="oil-feat" href="' + esc(href) + '" target="_blank" rel="noopener"' +
          (bg ? ' style="background-image:url(' + esc(bg) + '),linear-gradient(160deg,#123,#0f2d5c)"' : '') + '>' +
          '<span class="oil-feat__src">公众号</span>' +
          '<span class="oil-feat__body">' +
            '<span class="oil-feat__tag">公众号文章 · ' + esc(top.date || '') + '</span>' +
            '<span class="oil-feat__tit">' + esc(top.title) + '</span>' +
            '<span class="oil-feat__go">阅读原文 <span aria-hidden="true">&#8599;</span></span>' +
          '</span></a>';
        featBox.classList.add('oil-enter');
      }
    }
    if (sideBox) {
      fill(sideBox, wechat.slice(1).map(function (it) {
        var href = safeHref(it.url || it.href);
        if (!href) return '';
        var bg = imgUrl(it.image);
        return '<li class="oil-featitem"><a href="' + esc(href) + '" target="_blank" rel="noopener">' +
          '<span class="oil-featitem__fig"' + (bg ? ' style="background-image:url(' + esc(bg) + ')"' : '') + '></span>' +
          '<span><span class="oil-featitem__tit">' + esc(it.title) + '</span>' +
          '<span class="oil-featitem__date">' + esc(it.date || '') + '</span></span>' +
          '</a></li>';
      }).join(''));
    }

    var cats = d.cats || [];
    if (listBox) {
      var rows = [];
      cats.forEach(function (c) {
        (c.items || []).forEach(function (it) {
          var href = safeHref(it.href || it.url);
          if (!href) return;
          var ext = !!it.external;
          rows.push({ cat: c, it: it, href: href, ext: ext });
        });
      });
      rows.sort(function (a, b) {
        return String(b.it.date || '').localeCompare(String(a.it.date || ''));
      });
      fill(listBox, rows.map(function (r) {
        var bg = (r.it.image || '').trim();
        return '<li class="oil-post" data-cat="' + esc(r.cat.id) + '"><a href="' + esc(r.href) + '"' +
          (r.ext ? ' target="_blank" rel="noopener"' : '') + '>' +
          '<span class="oil-post__fig"' + (bg ? ' style="background-image:url(' + esc(bg) + ')"' : '') + '></span>' +
          '<time class="oil-post__date" datetime="' + esc(r.it.date || '') + '">' + esc(r.it.date || '') + '</time>' +
          '<span class="oil-post__cat" aria-hidden="true">' + esc(r.cat.name) + '</span>' +
          '<span class="oil-post__tit">' + esc(r.it.title) + '</span>' +
          '<span class="oil-post__go">' + (r.ext ? '阅读原文 &#8599;' : '阅读 &#8594;') + '</span>' +
          '</a></li>';
      }).join(''));
    }
    if (chipsBox && cats.length) {
      var total = cats.reduce(function (n, c) { return n + (c.items || []).length; }, 0);
      fill(chipsBox, '<button type="button" class="oil-chip" data-cat="*" aria-pressed="true">' +
        '全部资讯 <em>' + total + '</em></button>' +
        cats.map(function (c) {
          return '<button type="button" class="oil-chip" data-cat="' + esc(c.id) + '" aria-pressed="false">' +
            esc(c.name) + ' <em>' + (c.items || []).length + '</em></button>';
        }).join(''));
    }
    initFilter('news', '.oil-post');
  }

  /* -------------------------------------------------------------- 分类 / 省份筛选 */
  function initFilter(kind, itemSel) {
    var box = $('[data-oil-filters="' + kind + '"]');
    if (!box) return;
    var scope = box.closest('.r8c-container') || document;
    var attr = kind === 'bases' ? 'prov' : 'cat';
    var chips = $$('.oil-chip', box);
    if (!chips.length) return;

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var want = chip.getAttribute('data-' + attr) || '*';
        chips.forEach(function (c) {
          c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
        });
        $$(itemSel, scope).forEach(function (item) {
          var v = item.getAttribute('data-' + attr);
          item.hidden = !(want === '*' || v === want);
        });
      });
    });
  }

  /* ------------------------------------------------------------------ 启动 */
  function boot() {
    renderNet();
    renderBases();
    renderBase();
    renderNews();
    initCopy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
