# Chapli buyer UI/UX plan

## Product position

Chapli is a discovery-led marketplace for original products from independent Iranian creators. Buyer copy should emphasize taste, humor, identity, rarity, discovery, and authenticity. “Print on demand,” production infrastructure, supplier economics, and seller tooling are never part of buyer-facing messaging.

Primary promise: **Find something that feels unmistakably you.**

## Audience and interaction principles

The primary audience is Gen Z. The experience should feel editorial and social without becoming noisy or manipulative.

- Use short, conversational Persian with confident humor. Avoid corporate claims and forced slang.
- Make imagery, creator identity, graphic style, and social proof visible before technical specifications.
- Alternate dense product grids with bold editorial breaks so browsing feels like a feed.
- Preserve fast scanning: one dominant headline, one CTA, and no more than three support points per section.
- Use honest urgency only for real limited drops or stock. Never fake countdowns or popularity.
- Keep price, returns, seller identity, and dispatch expectation close to purchase controls.
- Use URL-backed filters so every category, style, shop, and filtered result is shareable and browser-navigation-safe.
- Mobile controls use a bottom-sheet pattern; desktop filters stay in a right sidebar in RTL.
- Respect reduced motion, visible focus, semantic headings, and WCAG AA contrast.

## Visual direction

- Typography: IRANYekanX. Display headings use heavy weights and tight tracking; descriptions use regular/medium.
- Palette: ink `#182522`, warm coral `#ef5b4c`, creator green `#3d8b70`, editorial cream `#f6f3ec`, and cool mist `#eef6f2`.
- Shapes: 12–22px radii, asymmetrical brand mark, editorial cards, circular shop avatars.
- Photography: clean product images mixed with wide lifestyle/category crops.
- Motion: 160–240ms hover lift, image scale, filter chips, and add-to-cart confirmation. No autoplay carousels.
- Density: mobile shows two product columns; desktop shows four. Editorial banners interrupt every 1–2 product modules.

## Homepage

### Header

- Sticky after the promotion strip; logo returns home.
- Discovery navigation: products, categories, graphic styles, popular shops.
- Search opens the universal search route.
- Saved, account, and cart actions show state/count.
- “فروشنده شو” is visually secondary and links to the temporary seller landing page.
- UX hack: keep the cart count visible and preserve cart locally; recognition beats recall.

### Full-width promotion banners

- Data-backed fields: eyebrow, headline, body, desktop/mobile image, CTA label/link, theme, placement, dates, status, sort order.
- Admin can paste image URLs and links later without deployments.
- UX hack: each banner has one CTA and one idea. Use sequential banners as editorial chapters, not an auto-rotating carousel that users miss.

### Horizontal category images

- Wide image tiles with the category name permanently visible.
- Entire tile is a link to `/category/{slug}`.
- UX hack: include a tiny example list (“تی‌شرت، دورس، هودی”) to reduce category ambiguity.

### Subcategory shelves

- Each shelf has 4–8 products, a human title, and a deep link with the subcategory filter applied.
- UX hack: use intent titles (“برای استایل دانشگاه”) rather than database labels alone.

### Popular shops and new products

- Shop card exposes avatar/cover, short point of view, followers, and three newest products.
- UX hack: creator identity increases authenticity; link both the card and each product independently.

### Best sellers

- Mix categories and avoid repeating adjacent shop/category entries.
- UX hack: show verified rating and a factual badge; randomize only among a qualified bestseller pool so quality never feels random.

### Graphic-style discovery

- Treat visual language as a first-class taxonomy: Persian typography, funny type, urban graphics, colorful minimal, illustration.
- UX hack: shoppers often know the vibe before the object. Every style links to `/search?graphic={slug}`.

## Search, category, subcategory, and store template

One reusable browse template powers:

- `/search?q=…`
- `/category/{slug}`
- `/subcategory/{slug}`
- `/stores/{slug}`

Desktop filtering appears on the right. Mobile uses a prominent filter button and compact active-filter chips.

Filterable dimensions:

- Category and subcategory
- Shop
- Graphic style
- Price range
- Color
- Size
- Rating
- Discount
- New arrivals
- Availability/status
- Tags
- Sort: relevant, newest, best selling, rating, low/high price

UX hacks:

- Filters are query parameters and links, not hidden-only client state.
- Show result count before the grid.
- Active chips can be removed individually.
- “Clear all” appears only when a filter is active.
- Never show a dead end without related categories, style suggestions, and a reset action.
- Store pages keep a branded intro but reuse the exact product/filter interaction.

## Product page

- Gallery, seller identity, rating, honest badges, price, variants, dispatch message, and purchase CTA remain above the fold.
- Replace delivery promises with **ارسال حداکثر تا ۷۲ ساعت**.
- Trust badge row: Chapli quality guarantee, seven-day returns, original creator product, secure purchase, tracked dispatch.
- Detail navigation switches among structured specification pairs, long description, and reviews.
- Similarity modules contain 2–3 rows: same category, same graphic style, same subcategory, and “same vibe” intersections.
- UX hack: show why an item is recommended (“هم‌سبک با این طرح”) to make recommendations feel intentional.

## Cart and checkout

- Cart is the basket page; use one term consistently: “سبد خرید.”
- Keep editable quantity, variant snapshot, save-for-later, removal, promotion code, and totals.
- Use “ارسال تا ۷۲ ساعت” rather than calculated delivery dates.
- Show progress to free shipping only when the threshold is real.
- Checkout steps: address → shipping → review → payment.
- Payment remains an adapter boundary; never collect raw card data.
- UX hack: preserve cart and form progress locally to prevent accidental loss.

## Buyer account

Account overview includes:

- Active order/status card
- Saved/loved products
- Recently viewed products
- Addresses
- Reviews awaiting submission
- Support/messages
- Profile, privacy, sessions, and notification preferences

UX hack: the account homepage answers “where is my order?” first, then offers discovery.

## Confirmation and order status

- Thank-you page leads with success, order number, and what happens next.
- Timeline states: received, confirmed, preparing, dispatched, delivered.
- Explain that dispatch occurs within 72 hours.
- Provide order details, address snapshot, support link, and continue-shopping recommendations.
- UX hack: celebrate briefly, then reduce post-purchase anxiety with a visible timeline and one next action.

## Footer and SEO

The footer includes crawlable links to major categories, subcategories, graphic styles, popular shops, buyer help, order tracking, returns, seller landing, legal pages, and editorial discovery pages.

- Add a short natural-language marketplace description.
- Avoid keyword stuffing and duplicate anchors.
- Preserve one descriptive H1 per page, meaningful H2 hierarchy, metadata, canonical routing, and descriptive image alt text.
- Product/category/store pages use stable slugs.

## Implementation prompt

> Build a Persian RTL Gen-Z marketplace for original creator products. Use IRANYekanX, an editorial warm-neutral palette with coral and deep green accents, confident conversational Persian, large product imagery, creator identity, graphic-style discovery, and honest trust cues. Do not mention print-on-demand to buyers. Implement a data-driven homepage with full-width promotional banners, horizontal category imagery, subcategory product shelves, popular creator shops with new products, cross-category best sellers, and graphic-style collections. Create a reusable URL-filtered browse template for search, categories, subcategories, and stores with desktop filters on the right. Improve the product page with icon trust badges, 72-hour dispatch copy, switchable specifications/description/reviews, and multiple similarity rows. Complete cart, buyer account, saved and recent products, thank-you, and order-tracking views. Use semantic HTML, WCAG AA contrast, keyboard focus, responsive two-column mobile product grids, reduced motion support, stable URLs, SEO metadata, and a long structured footer.
