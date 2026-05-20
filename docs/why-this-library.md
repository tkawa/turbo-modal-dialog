# Why turbo-modal-dialog — value proposition notes

A long-form pitch / talk-prep document. Not bundled with the package
(see `files: ["dist/"]` in `package.json`); kept in the repo as a
living artifact for conference talks, blog posts, and design
discussion.

The README is reference documentation for developers using the library.
This document covers the *why* — what problem it solves, why the
problem is interesting, why the solution is non-obvious — at the depth
needed for a 20–30 minute talk.

---

## TL;DR — the one-paragraph pitch

**turbo-modal-dialog reframes a modal from "client-side UI state" into
"a URL routing decision."** Declare a URL pattern as modal in your
Path Configuration, write an ordinary Rails view at that URL, and the
library makes that URL behave as a modal — opened over the previous
screen when reached via in-app navigation, opened over a fallback page
when accessed directly, returned as plain HTML to crawlers and OGP
scrapers. Browser back/forward, sharing, refresh, deep linking, View
Transition animation, focus management, and in-modal navigation all
work out of the box. The same Path Configuration drives Hotwire Native
iOS/Android apps, so a single declaration covers web and native
identically. The cost of "making a URL behave as a modal" collapses to
a single JSON line — leaving the developer with the only question
that actually matters: **should this URL be a modal at all?**

## Why modals are interesting (and historically painful)

Modals occupy an awkward position in web UI. They are:

- A **mode** — they suspend the user's interaction with the underlying
  context, which has been criticized since Alan Kay and Larry Tesler's
  "Don't mode me in" work in the 1980s.
- A **screen** — visually distinct, structurally a separate "page,"
  often complex enough that users expect to navigate within it.
- A **transient overlay** — supposed to disappear cleanly and return
  the user to whatever they were doing before.

Implementing this trio is harder than it looks. The historical Rails /
web stack has accumulated several recurring pain points:

1. **State management is bespoke.** Every project rebuilds the modal
   stack, currently-open modal, intra-modal navigation, focus trap,
   ESC handling, backdrop dismissal — usually as ad-hoc JavaScript
   sitting outside the routing layer.

2. **URL and modal state diverge.** Browser back doesn't close the
   modal. Refreshing a page with an open modal closes it. Sharing the
   URL doesn't share the modal state. Bookmarks lose modal state. The
   modal is invisible to the browser.

3. **Modal content is a second-class view.** Either you maintain a
   separate "modal partial" structure (duplicating logic), or you teach
   your views to render in two modes (modal-aware partials), or you
   build a parallel "intercept route" system. None of these are free.

4. **Navigation inside modals is even worse.** Multi-step forms, nested
   detail pages, intra-modal navigation — each tends to be hand-rolled
   per project.

5. **Animation and accessibility are reinvented per app.** Focus
   trapping, ESC handling, ARIA, slide-up animations, backdrop fade —
   each project pays the same tax.

6. **Native and web diverge.** Apps that ship both Hotwire Native
   (iOS/Android) and a Rails web frontend have already adopted Path
   Configuration to drive native modal presentation. The web side
   typically has no equivalent — same URL, totally different
   experience.

These pains are not unique to Rails, but they bite Rails apps hardest
because Rails developers expect *URLs* to be the unit of design.
"Visit a URL → get a screen" is the framework's mental model.
Traditional modal libraries break that model: a modal is a UI state
laid over a URL, not a URL itself.

## The reframe — modal as a routing decision

turbo-modal-dialog inverts the historical position:

- A modal is not a UI component you imperatively open. It is a *URL*
  that you declare as "presented as a modal" in routing-level
  configuration (Path Configuration).
- The view at that URL is an ordinary Rails view. It has no awareness
  of being modal-presented. It is the same response sent to web
  browsers, search engine crawlers, OGP scrapers, and Hotwire Native
  apps.
- The library's job is to render that URL as a `<dialog>` overlay
  inside the user's current browsing context, while keeping browser
  history and URL state coherent.

Once you accept this reframe, several things fall out:

### Modals become first-class permalinks

Because the modal *is* its URL, every modal you open is naturally
deep-linkable. Bookmark it, share it, refresh it, hit it from a search
result — it all works. The library's direct-access detection notices
when the user lands on a modal URL "cold" (no prior page) and presents
the modal over a configurable fallback page. The same URL is
simultaneously:

- A page (to crawlers, OGP, link previews, sitemap)
- A modal (to in-app navigation)
- A deep link (to bookmarks, shared URLs)

No SEO or shareability tradeoff. No parallel "modal version" of any
route.

### Browser-native semantics are preserved

Open a modal from a link → URL changes (via `pushState`). Press
browser back → modal dismisses. Press browser forward → modal
re-presents. Refresh → modal reopens. Navigate intra-modal → URL
tracks the current modal page (via `replaceState`).

This is unusual for modals. The dominant web pattern is "the URL
doesn't reflect modal state." turbo-modal-dialog's pattern is "the URL
*is* the modal state."

### Hotwire Native parity comes for free

Path Configuration is a Hotwire convention: a JSON document declaring
URL patterns and their presentation properties (`context: "modal"`,
`modal_style: "form_sheet"`, etc.). Hotwire Native apps already
consume this to drive native iOS / Android modal presentation.

This library makes the *same JSON* drive the web equivalent. A single
declaration:

```json
{ "patterns": ["/new$"], "properties": { "context": "modal" } }
```

…now presents the URL as a modal across iOS (UIModalPresentationStyle),
Android (Bottom Sheet / Dialog), and Web (`<dialog>`). The cross-
platform story collapses to one config file.

### Developer experience: modal complexity vanishes

The Rails developer no longer writes:

- `openModal()` calls
- Modal stack state management
- Browser back integration for modals
- Focus trap / ESC handling
- Slide-up animation logic
- Multi-step modal navigation
- Modal-specific view partials

Instead, the developer:

- Writes a normal Rails action with a normal view
- Adds one line to `path-configuration.json`

That's it. The modal is now an URL that behaves as a modal.

## What makes this possible *now*

The library is, technically, an opinionated composition of recent web
platform features. None of these were practical to build on five years
ago. Worth naming explicitly:

- **`<dialog>` + `showModal()`** — standardized modal element with
  top-layer rendering, focus management, ESC handling, and backdrop.
  Eliminates a major source of historical modal-library complexity.
- **View Transitions API** — drives present/dismiss animations
  declaratively. Same animation works for every trigger (link click,
  popstate, form submit redirect) because VT is direction-agnostic.
- **CSS Nesting and `:has()`** — let library CSS scope itself under
  the custom element without specificity hacks, and let scroll lock
  track modal state declaratively.
- **Custom Elements (`<turbo-modal-dialog>`)** — configuration marker
  that participates in the DOM lifecycle (connectedCallback /
  disconnectedCallback handle Turbo body replacement gracefully).
- **`pushState` / `replaceState` / `popstate`** — make URLs the
  source of truth for modal state, integrated with browser back/
  forward.
- **Permissions Policy defaults** — `publickey-credentials-get` and
  `publickey-credentials-create` allowed in same-origin iframes by
  default, so WebAuthn just works inside modals.
- **`iframe` with same-origin Turbo** — isolation that doesn't
  pollute the parent's JS context or Turbo state, while still
  participating in the parent's URL via pushState.

This is a library that **could not have been written as cleanly in
2020**. It is a snapshot of what the modern web platform makes easy.

## The iframe inside the dialog — why and what it means

A key design choice: each modal is rendered as an `<iframe>` inside
the `<dialog>`. This deserves explanation.

**Why iframe instead of inline DOM injection:**

- **JS isolation.** The modal's view runs in its own browsing context.
  Stimulus controllers, Turbo, scripts, third-party SDKs (Stripe,
  WebAuthn flows) don't interfere with the parent.
- **CSS isolation.** Modal page styles can't leak into the parent and
  vice versa.
- **Independent `<head>`.** The modal can load its own stylesheets,
  meta tags, OGP, title — without modifying the parent.
- **It mirrors Hotwire Native semantics exactly.** Native modal stacks
  use a separate WebView for the modal. iframe is the web equivalent.
- **Server view stays agnostic.** The modal URL's view doesn't need
  to know it's inside a modal — it gets a fresh document to render
  into.

**What iframe gives up:**

- Joint session history involves both parent and iframe, with
  browser-divergent traversal semantics (Chrome/WebKit traverse joint
  history; Firefox traverses only the parent). The library works
  around this by intentionally keeping iframe history at length 1 —
  every intra-modal navigation uses `Turbo.visit(url, { action:
  "replace" })` inside the iframe — and managing modal navigation via
  a parent-side stack.
- An in-modal back button replaces browser back for intra-modal
  navigation. Browser back is reserved for "leave the modal entirely,"
  which is a single predictable meaning regardless of where the user
  is in the modal stack.

These tradeoffs are made explicit in the README's "Navigation model
inside a modal" section.

## What the library does *not* solve

A piece of intellectual honesty that should be in any talk on this
material:

### Modal is still a mode

Alan Kay, Larry Tesler, and Jef Raskin's critique of modal interfaces
applies regardless of how easy modals are to build. A modal forces the
user to track "I am currently in this modal" and prevents them from
freely interacting with the underlying context. The cognitive cost is
real.

**The library makes modal *implementation* cheap, but does not make
modal *use* free.** The cost has moved from the developer (writing
code) to the user (managing a mode). If anything, the library's
ease-of-use *amplifies* the design responsibility: when modals are
trivially easy to add, the temptation to overuse them grows.

The README's "Choosing a presentation" section frames this honestly:
*default to full page; reach for modal only when you have an active
reason*. The library should never be marketed as "use more modals."

### OAuth and other cross-origin redirects

X-Frame-Options: DENY from OAuth providers, Stripe legacy Checkout,
and similar full-page hosted UIs makes them un-embeddable. This is
intentional clickjacking prevention and won't change. The library
provides no workaround; the README is explicit about this.

### Comparing items side-by-side

When users want to compare two items (product specs, two photos, two
documents), modal presentation forces sequential viewing. For domains
where comparison is a primary user activity (shopping with reasoned
purchases, real estate, hardware specs), modal item-detail is the
wrong choice. The README's "Item detail browsed from a list" guidance
warns against this.

### Long-form content

Reading a long article, browsing reference documentation, exploring a
multi-screen dashboard — these tasks last long enough that the
cognitive cost of being "in a mode" exceeds the context-preservation
benefit. Full page wins for these.

## Comparison to adjacent solutions

### Next.js intercepting routes / parallel routes

Next.js shipped "intercepting routes" specifically for the modal-as-URL
problem. The mechanism is route-level:

- Define two routes: the modal view and the full-page view
- Use file naming conventions (`(.)photos/[id]`) to declare an
  interception
- Render the modal version when navigating from within the app

This is conceptually similar but practically more complex:

- Requires **two route files / two view definitions** for what is
  conceptually one URL
- Locked into Next.js's file-based routing model
- No equivalent of Path Configuration — no cross-platform parity story
- More machinery: the user has to understand "parallel routes,"
  "intercepting routes," and "loading.tsx" lifecycle

turbo-modal-dialog: **one URL, one view, one config line**. Achievable
on Rails because Rails routing already separates URL definition from
view rendering cleanly.

### Component-state modal libraries (Reach UI, Radix UI, Bootstrap, …)

These solve the *component* problem (focus trap, accessibility,
backdrop) but explicitly *not* the *routing* problem. Modal is still
client UI state, opened imperatively, URL-agnostic.

A complete solution requires composing such a library with a URL
state library, and reinventing the URL-modal mapping per project.
This library skips that composition by treating routing as the source
of truth from the start.

### Hand-rolled per-project modal infrastructure

The status quo for most Rails apps. Some StimulusController +
`turbo_stream.update("modal", partial: …)` + custom `data-turbo-frame`
trick + ad-hoc browser back integration. Often partially complete:
URL works for entry but not refresh; back works but not forward; etc.

turbo-modal-dialog replaces this with a library where the URL/history
integration is the *primary* feature, not an afterthought.

## Audience-specific value propositions

For talk preparation, here are different framings depending on
audience:

### To Rails developers (the primary audience)

"You know the pain of writing modal infrastructure. You've done it
multiple times. The result is always partially broken — back button,
share, refresh, focus, animation, intra-modal navigation. This library
makes that pain go away. Write a normal Rails action, list the URL in
JSON, done."

### To Hotwire Native users

"You already use Path Configuration for native. Web has been the gap
— same URL, totally different experience. This library closes that
gap. Add one library, your existing Path Configuration JSON now drives
the web too."

### To web platform / standards-curious developers

"This is what a modal *should* look like on the modern web platform.
`<dialog>` + View Transitions + `:has()` + Custom Elements + History
API + Permissions Policy — composed to give modals first-class URL
semantics. A demonstration of what the platform makes possible."

### To UX-leaning developers

"Modals have always been awkward because the URL didn't reflect their
state. We accepted this as 'how the web works.' It isn't anymore.
Now: bookmarkable modals, shareable modals, refreshable modals — and
the design conversation moves to 'should this be a modal at all?'
where it always belonged."

## Where this could go

For talks ending on a forward-looking note:

### Native Turbo support for iframe presentation

The library currently treats itself as a polyfill for a hypothetical
future Turbo Drive API — `turbo:iframe-*` events shaped to anticipate
what Turbo itself might one day expose. If Turbo upstream adopts
iframe-as-modal as a native concept, much of this library's polyfill
layer could fold into Turbo itself, leaving only the `<dialog>` host
implementation.

### View Transitions Level 2 (cross-document)

Cross-document View Transitions, when fully shipped, let "navigate to
a new page" and "open a modal" share even more underlying machinery —
the boundary blurs further. The library's mental model ("modal is a
URL transition") aligns naturally with this direction.

### Native + Web design system convergence

As Path Configuration matures into a richer cross-platform
presentation declaration (modal styles, transitions, gesture
behaviors), the library can adopt new properties as they appear in
Hotwire Native. The single-config story strengthens over time.

### Accessibility audit

The library uses `<dialog>` so it inherits browser focus trap and ESC.
A formal accessibility audit (screen reader behavior with iframe
nesting, keyboard navigation through the in-modal back button, etc.)
would strengthen the value proposition for accessibility-conscious
teams. Not yet done.

## Suggested talk arc (20–25 minutes)

A possible structure:

1. **Hook (2 min)** — Show a typical Rails app with broken modal
   behavior: back button doesn't close, share link doesn't work,
   refresh loses state. Audience nods.

2. **The mental model shift (3 min)** — Modal is not UI state. Modal
   is a URL routing decision. Pause for this to land.

3. **Live demo (5 min)** — Hotwire Native demo app. Show:
   - Click link → modal opens, URL updates
   - Copy URL, open new tab → modal at the URL with fallback page
   - Browser back → dismisses; browser forward → re-presents
   - Intra-modal navigation → URL tracks; in-modal back button works
   - Same JSON drives iOS/Android — switch to native app, identical UX

4. **How it works (5 min)** — Quickly walk through the technical
   composition: `<dialog>`, iframe-for-isolation, pushState, View
   Transitions, custom element configuration. Don't go deep; show
   that it's an opinionated composition of platform features.

5. **The intellectual honesty section (3 min)** — Modal is still a
   mode. The library doesn't fix that — the design judgment remains.
   "Choosing a presentation" framing from the README.

6. **Comparison (3 min)** — Brief note on Next.js intercepting
   routes, component libraries, hand-rolled. Why this approach is
   cleaner on Rails.

7. **Call to action (2 min)** — Install, try it on a demo app, give
   feedback. The library is small, single-purpose, low commitment.

8. **Q&A** — Common questions to prepare:
   - Why iframe? (isolation, native parity)
   - What about cross-origin iframe content? (X-Frame-Options;
     OAuth doesn't work)
   - What about accessibility? (browser `<dialog>` handles it;
     formal audit pending)
   - What's the bundle size? (small — single ESM file, single CSS)
   - Will this work without Hotwire Native? (yes — Hotwire Native
     parity is a bonus, not a requirement)

## Closing line candidates

For talk endings:

- "We've spent twenty years apologizing for modals on the web. We
  don't have to anymore."
- "Modals weren't broken. The URL was. Now that we've fixed the URL,
  the modal can finally be honest."
- "One JSON line. Modal across web, iOS, Android. Browser back
  works. Share link works. The cost has collapsed — the design
  judgment is what's left."

(Choose based on audience tone; technical-leaning audiences will
respond to the second; UX-leaning ones to the first; pragmatic Rails
audiences to the third.)
