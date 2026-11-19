(() => {
  'use strict';

  const REPO = 'slipptech-tech/Chelp-AI-Website';
  const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
  const RELEASE_BASE = `https://github.com/${REPO}/releases/download`;

  const FALLBACK = {
    version: 'v1.0.0',
    setup: {
      href: `${RELEASE_BASE}/1.0.0/Chelp-AI-Setup-1.0.0.exe`,
      name: 'Chelp-AI-Setup-1.0.0.exe',
      bytes: 87931783
    },
    portable: {
      href: `${RELEASE_BASE}/1.0.0/Chelp-AI.1.0.0-portable.zip`,
      name: 'Chelp-AI.1.0.0-portable.zip',
      bytes: 125725150
    },
    linux: {
      href: 'downloads/Chelp-AI-1.0.2-x64.tar.gz',
      name: 'Chelp-AI-1.0.2-x64.tar.gz',
      bytes: 115662852
    }
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function formatSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return null;
    const mb = bytes / (1024 * 1024);
    return `${mb >= 100 ? Math.round(mb) : mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  }

  function prettyName(kind, version) {
    const bare = version.replace(/^v/, '');
    if (kind === 'setup') return `Chelp-AI-Setup-${bare}.exe`;
    if (kind === 'linux') return `Chelp-AI-${bare}-x64.tar.gz`;
    return `Chelp-AI.${bare}-portable.zip`;
  }

  function applyDownload(kind, data, version) {
    const button = $(`[data-download="${kind}"]`);
    if (!button) return;
    button.href = data.href;
    button.setAttribute('download', data.name || prettyName(kind, version));
    const size = $(`[data-size="${kind}"]`);
    if (size) size.textContent = formatSize(data.bytes) || size.textContent;
    const note = $(`[data-file-name="${kind}"]`);
    if (note) note.textContent = data.name || prettyName(kind, version);
  }

  function applyVersion(version, source) {
    $$('[data-release-version]').forEach((node) => {
      node.textContent = version;
    });
    const status = $('[data-release-status]');
    if (status) {
      status.textContent =
        source === 'github' ? `Latest release · ${version}` : `Direct download · ${version}`;
    }
  }

  function pickAsset(assets, kind) {
    if (kind === 'linux') {
      const linux = assets.filter((asset) => /\.(appimage|tar\.gz)$/i.test(asset.name || ''));
      const match =
        linux.find(
          (asset) => /\.appimage$/i.test(asset.name) && /x86_64|amd64|x64/i.test(asset.name)
        ) ||
        linux.find((asset) => /\.appimage$/i.test(asset.name)) ||
        linux.find((asset) => /\.tar\.gz$/i.test(asset.name));
      if (!match) return null;
      return { href: match.browser_download_url, name: match.name, bytes: match.size };
    }
    const pattern = kind === 'setup' ? /setup|installer/i : /portable/i;
    const extension = kind === 'setup' ? /\.exe$/i : /\.(zip|exe)$/i;
    const matches = assets.filter(
      (asset) => extension.test(asset.name || '') && pattern.test(asset.name || '')
    );
    const match =
      kind === 'portable'
        ? matches.find((asset) => /\.zip$/i.test(asset.name)) || matches[0]
        : matches[0];
    if (!match) return null;
    return {
      href: match.browser_download_url,
      name: match.name,
      bytes: match.size
    };
  }

  function loadRelease() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
      cache: 'no-store'
    })
      .then((response) => {
        if (!response.ok) throw new Error(`GitHub ${response.status}`);
        return response.json();
      })
      .then((release) => {
        if (!release || !Array.isArray(release.assets)) throw new Error('No release');
        const tag = release.tag_name || FALLBACK.version;
        const version = tag.startsWith('v') ? tag : `v${tag}`;
        const setup = pickAsset(release.assets, 'setup');
        const portable = pickAsset(release.assets, 'portable');
        const linux = pickAsset(release.assets, 'linux');
        if (!setup && !portable && !linux) throw new Error('No download assets');

        applyVersion(version, 'github');
        if (setup) applyDownload('setup', setup, version);
        if (portable) applyDownload('portable', portable, version);
        if (linux) applyDownload('linux', linux, version);

        const link = $('[data-release-link]');
        if (link) {
          link.href = release.html_url || link.href;
          const label = link.firstChild;
          if (label && label.nodeType === Node.TEXT_NODE) {
            label.textContent = 'Release notes on GitHub ';
          }
        }
      })
      .catch(() => {
        applyVersion(FALLBACK.version, 'local');
        applyDownload('setup', FALLBACK.setup, FALLBACK.version);
        applyDownload('portable', FALLBACK.portable, FALLBACK.version);
        applyDownload('linux', FALLBACK.linux, FALLBACK.version);
      })
      .finally(() => clearTimeout(timeout));
  }

  function initToTop() {
    const links = $$('a[href="#top"]');
    if (!links.length) return;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';

    links.forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior });
      });
    });
  }

  function initMenu() {
    const button = $('#menuBtn');
    const nav = $('#nav');
    if (!button || !nav) return;

    const close = () => {
      nav.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Open menu');
    };

    button.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });

    $$('a', nav).forEach((link) => link.addEventListener('click', close));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
    document.addEventListener('click', (event) => {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(event.target) || button.contains(event.target)) return;
      close();
    });
  }

  function initHeader() {
    const header = $('.site-header');
    if (!header) return;

    let ticking = false;
    const update = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 12);
      ticking = false;
    };

    update();
    window.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(update);
      },
      { passive: true }
    );
  }

  function initSpotlight() {
    const hero = $('.hero');
    if (!hero) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    hero.addEventListener(
      'pointermove',
      (event) => {
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          const rect = hero.getBoundingClientRect();
          hero.style.setProperty('--mx', `${event.clientX - rect.left}px`);
          hero.style.setProperty('--my', `${event.clientY - rect.top}px`);
          frame = 0;
        });
      },
      { passive: true }
    );
  }

  function initReveal() {
    const blocks = $$('.reveal');
    if (!blocks.length) return;

    if (!('IntersectionObserver' in window)) {
      blocks.forEach((block) => block.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );

    blocks.forEach((block) => observer.observe(block));
  }

  function initFaq() {
    const items = $$('.faq-list details');
    items.forEach((item) => {
      item.addEventListener('toggle', () => {
        if (!item.open) return;
        items.forEach((other) => {
          if (other !== item) other.open = false;
        });
      });
    });
  }

  function initYear() {
    const year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  loadRelease();
  initToTop();
  initMenu();
  initHeader();
  initSpotlight();
  initReveal();
  initFaq();
  initYear();
})();
