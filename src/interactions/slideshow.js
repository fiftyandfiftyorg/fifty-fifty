import { attr, checkBreakpoints } from '../utilities';

export const slideshow = function (gsapContext) {
  const ANIMATION_ID = 'slideshow';
  const ATTRIBUTE = 'data-ix-slideshow';
  const WRAP = 'wrap';
  const SLIDE = 'slide';
  const CAPTION_EL = 'caption';
  const CAPTION_TEXT_EL = 'caption-text';
  const INTERVAL = 'data-ix-slideshow-interval';
  const FADE = 'data-ix-slideshow-fade';
  const CAPTION = 'data-ix-slideshow-caption';
  const RUN = 'data-ix-slideshow-run';

  const INTERVAL_DEFAULT = 6000;
  const FADE_DEFAULT = 800;
  const INTERVAL_MIN = 1500; // a typo should not produce a strobe
  const CAPTION_FADE = 0.25;
  const EASE = 'power1.inOut';

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
    // This script owns no styling and creates no elements. The caption is an
    // element authored in Webflow, marked data-ix-slideshow="caption"; all that
    // happens here is the text being swapped in step with the slide.
    const captions = slides.map((s) => s.getAttribute(CAPTION) || '');
    const hasCaptions = captions.some((c) => c !== '');

    let capEl = null;
    let capTxt = null;

    if (hasCaptions) {
      const root = wrap.parentElement;
      capEl = root ? root.querySelector('[' + ATTRIBUTE + '="' + CAPTION_EL + '"]') : null;
      // fail silent: no caption element authored means no caption, not an error
      if (capEl) {
        capTxt = capEl.querySelector('[' + ATTRIBUTE + '="' + CAPTION_TEXT_EL + '"]') || capEl;
      }
    }

    const paintCaption = function (index, animate) {
      if (!capEl || !capTxt) return;
      const text = captions[index] || '';
      const write = function () {
        capTxt.textContent = text;
        // a slide with no caption should show nothing, not the previous one
        capEl.style.visibility = text ? 'visible' : 'hidden';
      };
      if (!animate) {
        write();
        return;
      }
      gsap.to(capTxt, {
        opacity: 0,
        duration: CAPTION_FADE,
        ease: EASE,
        onComplete: function () {
          write();
          gsap.to(capTxt, { opacity: 1, duration: CAPTION_FADE, ease: EASE });
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
