import { attr, checkBreakpoints } from '../utilities';

export const slideshow = function (gsapContext) {
  const ANIMATION_ID = 'slideshow';
  const ATTRIBUTE = 'data-ix-slideshow';
  const WRAP = 'wrap';
  const SLIDE = 'slide';
  const CAPTION_TARGET = 'caption';
  const INTERVAL = 'data-ix-slideshow-interval';
  const FADE = 'data-ix-slideshow-fade';
  const CAPTION = 'data-ix-slideshow-caption';
  const CAPTION_LINK = 'data-ix-slideshow-caption-link';
  const RUN = 'data-ix-slideshow-run';

  const INTERVAL_DEFAULT = 6000;
  const FADE_DEFAULT = 800;
  const INTERVAL_MIN = 1500; // a typo should not produce a strobe
  const CAPTION_FADE = 250;
  const EASE = 'power1.inOut';

  const CAPTION_CSS =
    '.ix-slideshow-cap{display:inline-flex;align-items:center;gap:.5rem;' +
    'font-size:.8125rem;line-height:1.2;letter-spacing:.02em;color:currentColor;' +
    'opacity:.8;text-decoration:none;white-space:nowrap;margin-left:1.25rem;' +
    'transition:opacity .25s ease}' +
    'a.ix-slideshow-cap:hover{opacity:1}' +
    'a.ix-slideshow-cap:hover .ix-slideshow-cap__txt{text-decoration:underline}' +
    '.ix-slideshow-cap__cam{width:15px;height:15px;flex:none;opacity:.75}' +
    '.ix-slideshow-cap__txt{transition:opacity ' + CAPTION_FADE + 'ms ease}' +
    '.ix-slideshow-cap.is-swapping .ix-slideshow-cap__txt{opacity:0}' +
    '@media (prefers-reduced-motion:reduce){.ix-slideshow-cap,' +
    '.ix-slideshow-cap__txt{transition:none}}';

  const CAMERA_SVG =
    '<svg class="ix-slideshow-cap__cam" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M3.2 8.9a1.6 1.6 0 0 1 1.6-1.6h1.9a1 1 0 0 0 .84-.46l.93-1.44a1 1 0 0 1 ' +
    '.84-.46h5.34a1 1 0 0 1 .84.46l.93 1.44a1 1 0 0 0 .84.46h1.9a1.6 1.6 0 0 1 1.6 1.6v8.6a1.6 ' +
    '1.6 0 0 1-1.6 1.6H4.8a1.6 1.6 0 0 1-1.6-1.6z"/><circle cx="12" cy="13.2" r="3.3"/></svg>';

  const injectCaptionCSS = function () {
    if (document.getElementById('ix-slideshow-cap-css')) return;
    const style = document.createElement('style');
    style.id = 'ix-slideshow-cap-css';
    style.textContent = CAPTION_CSS;
    document.head.appendChild(style);
  };

  const wraps = [...document.querySelectorAll('[' + ATTRIBUTE + '="' + WRAP + '"]')];
  if (wraps.length === 0) return;

  wraps.forEach((wrap) => {
    const runOnBreakpoint = checkBreakpoints(wrap, ANIMATION_ID, gsapContext);
    if (runOnBreakpoint === false) return;
    if (wrap.getAttribute(RUN) === 'false') return;

    // Only slides that are actually rendered and switched on.
    const slides = [...wrap.querySelectorAll('[' + ATTRIBUTE + '="' + SLIDE + '"]')].filter(
      (s) => s.getAttribute(RUN) !== 'false'
    );

    // A single slide is a static background, which is correct, not a failure.
    if (slides.length < 2) return;

    if (wrap.__ixSlideshowTimer) {
      clearInterval(wrap.__ixSlideshowTimer);
      wrap.__ixSlideshowTimer = null;
    }

    let interval = attr(INTERVAL_DEFAULT, wrap.getAttribute(INTERVAL));
    let fade = attr(FADE_DEFAULT, wrap.getAttribute(FADE));
    if (!Number.isFinite(interval) || interval < INTERVAL_MIN) interval = INTERVAL_DEFAULT;
    if (!Number.isFinite(fade) || fade < 0) fade = FADE_DEFAULT;
    if (fade > interval * 0.8) fade = interval * 0.8;
    const fadeSec = fade / 1000;

    // ---- caption ----------------------------------------------------------
    // The slides live in a layer behind the header content, and the content
    // itself sits in component slots this cannot author. So the caption is
    // placed into the header's own button row at runtime.
    const captions = slides.map((s) => s.getAttribute(CAPTION) || '');
    const links = slides.map((s) => s.getAttribute(CAPTION_LINK) || '');
    const hasCaptions = captions.some((c) => c !== '');

    let capEl = null;
    let capTxt = null;

    if (hasCaptions) {
      const root = wrap.parentElement;
      // An element authored in Webflow wins: it is real markup, in the page
      // source, styled by the design system. Only fall back to building one.
      const explicit = root
        ? root.querySelector('[' + ATTRIBUTE + '="' + CAPTION_TARGET + '"]')
        : null;

      if (explicit) {
        capEl = explicit;
        capTxt = explicit.querySelector('[' + ATTRIBUTE + '="caption-text"]') || explicit;
      } else {
        const target = root ? root.querySelector('.u-btn-group') : null;
        // fail silent: if the header markup changes, leave the page alone
        if (target) {
          injectCaptionCSS();
          const existing = target.querySelector('.ix-slideshow-cap');
          if (existing) existing.remove();

          capEl = document.createElement(links.some((l) => l !== '') ? 'a' : 'span');
          capEl.className = 'ix-slideshow-cap';
          capEl.setAttribute('aria-live', 'polite');
          capEl.innerHTML = CAMERA_SVG + '<span class="ix-slideshow-cap__txt"></span>';
          capTxt = capEl.querySelector('.ix-slideshow-cap__txt');
          target.appendChild(capEl);
          // The load-flicker rule hides children of a stagger group until the
          // load animation reveals them. This element is appended after that
          // animation has collected its targets, so it would never be revealed.
          capEl.style.visibility = 'visible';
        }
      }
    }

    const paintCaption = function (index, animate) {
      if (!capEl || !capTxt) return;
      const text = captions[index] || '';
      const href = links[index] || '';
      const write = function () {
        capTxt.textContent = text;
        if (capEl.tagName === 'A') {
          if (href) {
            capEl.setAttribute('href', href);
          } else {
            capEl.removeAttribute('href');
          }
        }
        // a slide with no caption should show nothing, not the previous one
        capEl.style.visibility = text ? 'visible' : 'hidden';
      };
      if (!animate) {
        write();
        return;
      }
      gsap.to(capTxt, {
        opacity: 0,
        duration: CAPTION_FADE / 1000,
        ease: EASE,
        onComplete: function () {
          write();
          gsap.to(capTxt, { opacity: 1, duration: CAPTION_FADE / 1000, ease: EASE });
        },
      });
    };

    // -----------------------------------------------------------------------

    // The outgoing slide stays fully opaque while the incoming one fades in above
    // it, so the stack is never partly transparent and nothing behind shows through.
    gsap.set(slides, { opacity: 0, zIndex: 0 });
    gsap.set(slides[0], { opacity: 1, zIndex: 1 });
    paintCaption(0, false);

    let current = 0;

    const go = function () {
      const from = current;
      const next = (from + 1) % slides.length;
      if (next === from) return;
      current = next;

      paintCaption(next, true);

      gsap.set(slides[next], { zIndex: 2, opacity: 0 });
      gsap.to(slides[next], {
        opacity: 1,
        duration: fadeSec,
        ease: EASE,
        onComplete: function () {
          // Only retire the old slide if it is still the one being replaced.
          if (current === next) {
            gsap.set(slides[from], { opacity: 0, zIndex: 0 });
            gsap.set(slides[next], { zIndex: 1 });
          }
        },
      });
    };

    const start = function () {
      if (!wrap.__ixSlideshowTimer) {
        wrap.__ixSlideshowTimer = setInterval(go, interval);
      }
    };
    const stop = function () {
      if (wrap.__ixSlideshowTimer) {
        clearInterval(wrap.__ixSlideshowTimer);
        wrap.__ixSlideshowTimer = null;
      }
    };

    start();

    // Background tabs throttle timers; restarting keeps the rotation honest.
    if (!wrap.__ixSlideshowBound) {
      wrap.__ixSlideshowBound = true;
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          stop();
        } else {
          start();
        }
      });
    }
  });
};
