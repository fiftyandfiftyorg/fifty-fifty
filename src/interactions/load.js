import { attr, checkBreakpoints, runSplit } from '../utilities';
/* CSS in PAGE Head

NOTE: this CSS lives in the Webflow page head, NOT in this file. Changing this
comment does nothing on its own - the site's custom code must be edited too.

`visibility: hidden` here means content is hidden BEFORE any JS runs, and is
only revealed when the load timeline reaches it. If the timeline never reaches
an element, that element stays invisible permanently - to visitors and to
crawlers alike. Using an opacity floor instead keeps the content rendered and
readable in every failure mode, while still allowing the fade-in.

CURRENT (hides content until JS succeeds):

[data-ix-load="wrap"]:not([data-ix-load-run="false"]) {
	visibility: hidden;
}
[data-ix-load="wrap"]:not([data-ix-load-run="false"]) :is([data-ix-load]:not([data-ix-load-run="false"]), [data-ix-load="stagger"]:not([data-ix-load-run="false"])  > *) {
	visibility: hidden;
}
html:is(.w-editor, .gsap-not-found) :is([data-ix-load-run], [data-ix-load]){visibility: visible;} 

RECOMMENDED (content always rendered; match the value to OPACITY_START_DEFAULT):

[data-ix-load="wrap"]:not([data-ix-load-run="false"]) {
	opacity: .35;
}
[data-ix-load="wrap"]:not([data-ix-load-run="false"]) :is([data-ix-load]:not([data-ix-load-run="false"]), [data-ix-load="stagger"]:not([data-ix-load-run="false"])  > *) {
	opacity: .35;
}
html:is(.w-editor, .gsap-not-found) :is([data-ix-load-run], [data-ix-load]){opacity: 1;} 
*/

export const load = function (gsapContext) {
  //animation ID
  const ANIMATION_ID = 'load';
  // hero animation attribute
  const ATTRIBUTE = 'data-ix-load';
  // starting opacity for the fade. 0 reproduces the historic behaviour and
  // hides the element outright (autoAlpha 0 also sets visibility:hidden).
  // Any value above 0 keeps it rendered if the timeline never reaches it.
  const OPACITY_START = 'data-ix-load-opacity-start';
  // hero animation selectors
  const WRAP = 'wrap';
  const HEADING = 'heading';
  const ITEM = 'item';
  const IMAGE = 'image';
  const LINE = 'line';
  const STAGGER = 'stagger';
  //tween options
  const POSITION = 'data-ix-load-position'; // sequential by default, use "<" to start tweens together
  const DEFAULT_STAGGER = '<0.2';
  //array of load section timelines
  let totalDuration = 0;
  let loadTimelines = [];
  //get sections
  const wraps = gsap.utils.toArray(`[${ATTRIBUTE}="${WRAP}"]`);
  wraps.forEach((wrap) => {
    //check breakpoints and exit if set to false
    let runOnBreakpoint = checkBreakpoints(wrap, ANIMATION_ID, gsapContext);
    if (runOnBreakpoint === false) return;

    // Site-wide floor. Set to e.g. 0.35 to make every load animation safe.
    // Must be kept in step with the page-head CSS documented above.
    const OPACITY_START_DEFAULT = 0;
    const getOpacityStart = function (el) {
      const raw = el && el.getAttribute ? el.getAttribute(OPACITY_START) : null;
      const parsed = parseFloat(raw);
      if (!Number.isFinite(parsed)) return OPACITY_START_DEFAULT;
      return Math.min(Math.max(parsed, 0), 1);
    };

    //get all items within the section
    const items = [...wrap.querySelectorAll(`[${ATTRIBUTE}]:not([${ATTRIBUTE}-run="false"])`)];
    if (items.length === 0) return;

    //create variables from GSAP context
    let { isMobile, isTablet, isDesktop, reduceMotion } = gsapContext.conditions;

    const tl = gsap.timeline({
      delay: totalDuration,
      paused: true,
      defaults: {
        ease: 'power1.out',
        duration: 0.8,
      },
    });
    tl.set(wrap, {
      clearProps: 'visibility', //chat gpt suggestion
      autoAlpha: 1,
    });
    //anything that needs to be set to start the interaction happens here

    //h1 load tween
    const loadHeading = function (item) {
      // read before the richtext reassignment below
      const opacityStart = getOpacityStart(item);
      //reset items autoAlpha
      gsap.set(item, { autoAlpha: 1 });
      //get timeline positions
      const position = attr(0, item.getAttribute(POSITION));
      //check if item is rich text and if it is find the first child and set it to be the heading
      if (item.classList.contains('w-richtext')) {
        item = item.children;
      }
      // split text and animate it
      SplitText.create(item, {
        type: 'lines',
        linesClass: 'line',
        // wordsClass: 'word',
        // charsClass: "char",
        // mask: 'lines',
        autoSplit: true,
        onSplit: (self) => {
          return tl.from(
            self.lines,
            {
              y: '50%',
              rotateX: 45,
              autoAlpha: opacityStart,
              stagger: 0.2,
            },
            position
          );
        },
      });
    };
    //images load tween
    const loadImage = function (item) {
      // get the position attribute or set defautl position
      const position = attr(DEFAULT_STAGGER, item.getAttribute(POSITION));
      tl.fromTo(item, { autoAlpha: getOpacityStart(item) }, { autoAlpha: 1 }, position);
    };
    //images load tween
    const loadLine = function (item) {
      // get the position attribute or set defautl position
      const position = attr(DEFAULT_STAGGER, item.getAttribute(POSITION));
      tl.fromTo(
        item,
        { clipPath: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)' },
        { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' },
        position
      );
    };
    //default load tween
    const loadItem = function (item) {
      // get the position attribute
      const position = attr(DEFAULT_STAGGER, item.getAttribute(POSITION));
      tl.fromTo(
        item,
        { autoAlpha: getOpacityStart(item), y: '2rem' },
        { autoAlpha: 1, y: '0rem' },
        position
      );
    };

    //add item tween to each element in this parent
    const loadStagger = function (item) {
      if (!item) return;
      // gsap.set(item, { autoAlpha: 1 });
      //set autoAlpha to 1
      // get the children of the item
      const children = gsap.utils.toArray(item.children);
      if (children.length === 0) return;
      children.forEach((child, index) => {
        //first item set parent autoAlpha to 1
        if (index === 0) {
          gsap.set(item, { autoAlpha: 1 });
        }
        loadItem(child);
      });
    };

    const loadSimple = function (item) {
      if (!item) return;
      tl.fromTo(
        item,
        {
          autoAlpha: getOpacityStart(item),
        },
        {
          autoAlpha: 1,
          ease: 'power1.out',
          duration: 1.2,
        },
        '<'
      );
    };

    //get all elements and apply animations
    items.forEach((item) => {
      if (!item) return;
      //find the type of the load animation
      const loadType = item.getAttribute(ATTRIBUTE);
      //if reduce motion is true or run animation is false but the run attribute is true use a simple fade in
      if (reduceMotion) {
        //simple animation
        if (loadType === STAGGER) {
          loadSimple(item.children);
        } else {
          loadSimple(item);
        }
      } else {
        //otherwise assign the correct animation to each element type
        if (loadType === HEADING) {
          if (isMobile) {
            loadItem(item);
          } else {
            loadHeading(item);
          }
        }
        if (loadType === IMAGE) {
          loadImage(item);
        }
        if (loadType === LINE) {
          loadLine(item);
        }
        if (loadType === ITEM) {
          loadItem(item);
        }
        if (loadType === STAGGER) {
          loadStagger(item);
        }
      }
    });
    //delay further sections with load based on the duration of the previous one
    totalDuration = totalDuration + tl.duration() - 0.4;

    //Play interaction on font load, or remove it from callback to play immediately
    tl.play();
    // was creating issues in firefox
    // document.fonts.ready.then(() => {
    //   tl.play(0);
    // });
    // push this sections load timeline into array of all load loadTimelines.
    loadTimelines.push(tl);
  });
  // Optionally retun array of load timelines
  // return loadTimelines
};
