# CSS Flexbox & Grid Layout Patterns

A reference guide of reusable layout patterns for everyday use. Apply these techniques to solve common layout challenges without reinventing the wheel.

---

## Pattern 1: Isolating Items with Auto Margins (Flexbox)

**Problem:** You need one item separated from a group (e.g., a nav logo on the left, links on the right). `justify-content` values like `space-between` can't isolate a single item while keeping others grouped.

**Solution:** Use `margin-right: auto` or `margin-left: auto` on the item you want to isolate. In Flexbox, an auto margin absorbs all remaining space.

```css
/* Push the first item left, everything else right */
.nav-list li:first-child {
  margin-right: auto;
}
```

**Advanced use — center one item, push others to the sides:**

```css
/* The third item gets centered; others pushed to edges */
.nav-list li:nth-child(3) {
  margin-left: auto;
  margin-right: auto;
}
```

**When to use:** Whenever you need a layout that isn't achievable with `justify-content` alone — isolating, centering, or creating asymmetric spacing within a flex container.

---

## Pattern 2: Visual Layouts with `grid-template-areas`

**Problem:** Complex page layouts (nav, sidebar, main content) are hard to reason about with numbered grid lines.

**Solution:** Use `grid-template-areas` to define layouts with named strings that visually mirror the result.

```css
body {
  display: grid;
  /* Two columns: sidebar fixed, main flexible */
  grid-template-columns: 300px 1fr;
  /* Two rows: nav auto-height, content fills remaining */
  grid-template-rows: auto 1fr;
  /* Layout map — each string = one row, spaces = columns */
  grid-template-areas:
    "nav    nav"
    "sidebar main";
}

nav   { grid-area: nav; }
aside { grid-area: sidebar; }
main  { grid-area: main; }
```

**Key rules:**
- Each string = one row; spaces separate columns.
- Area names in the strings must match exactly what you assign via `grid-area`.
- Works for simple page shells all the way to complex dashboard/bento grids.

**Tip:** Sketch your layout on paper or in a design tool first. The CSS strings should mirror your sketch directly.

---

## Pattern 3: Expanding Clickable Area (Flexbox)

**Problem:** A clickable element (e.g., a `<label>`) inside a flex container only responds to clicks on the text itself, not the full row width.

**Solution:** Apply `flex: 1` to the clickable element so it expands to fill remaining space.

```css
.item-container {
  display: flex;
}

.item-container label {
  flex: 1; /* Label's hit area now fills the entire row */
}
```

**When to use:** Checkbox/radio lists, settings panels, any row where the clickable target should span the full width for better UX.

---

## Pattern 4: Stacking Elements with Grid (Replacing `position: absolute`)

**Problem:** You want to overlay text on an image. The traditional approach uses `position: relative` + `position: absolute` with awkward percentage calculations.

**Solution:** Use CSS Grid and place both elements in the same cell using `grid-area: 1 / 1`.

```css
.wrapper {
  display: grid;
}

.wrapper img,
.wrapper .text-overlay {
  grid-area: 1 / 1; /* Both occupy the single cell */
}
```

**Why this is better:**
- No need for `position: relative/absolute`.
- Alignment is trivial with grid properties instead of `top/left` + `transform` hacks:

```css
/* Center the overlay */
.wrapper { place-items: center; }

/* Or pin it to the bottom */
.wrapper { place-items: end; }
```

**When to use:** Image overlays, hero banners, badge positioning, any scenario where elements need to stack.

---

## Pattern 5: Even Columns

**Problem:** You need multiple items in a row, all the same width, filling the container, and adapting as items are added or removed.

### Flexbox approach

```css
.parent { display: flex; }
.parent > * { flex: 1; }
```

### Grid approach

```css
.parent {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
}
```

**Trade-offs:**
- **Flexbox:** Requires targeting child elements, but one less line overall.
- **Grid:** No need to target children — the parent handles everything.

---

## Pattern 6: Responsive Grid Without Media Queries

**Problem:** You need a product grid that adapts from 4 columns → 3 → 2 → 1 as the screen shrinks, without writing breakpoints.

**Solution:** Use `repeat(auto-fit, ...)` with `minmax()` on `grid-template-columns`.

### Fixed-width columns (centered)

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, 300px);
  justify-content: center;
}
```

### Fluid columns (fill leftover space)

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}
```

**How it works:**
- `auto-fit` = fit as many columns as the container allows.
- `minmax(300px, 1fr)` = each column is at least 300px but grows to fill remaining space.
- No breakpoints, no media queries. Columns drop/add automatically.

**This is the go-to responsive grid pattern for ~90% of use cases.**

---

## Pattern 7: Sticky Footer (Fixing the Floating Footer)

**Problem:** On short pages, the footer floats in the middle of the viewport because there isn't enough content to push it down. Fixed heights cause overflow issues.

**Solution:** Make the body a 3-row grid where the middle row expands.

```css
body {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}
```

**How it works:**
- Row 1 (`auto`): Header/navbar takes its natural height.
- Row 2 (`1fr`): Main content expands to fill all remaining viewport space.
- Row 3 (`auto`): Footer takes its natural height, always pinned to the bottom.

**This pattern belongs in every multi-page site.** It's a set-and-forget solution.

---

## Pattern 8: Aligning Buttons Across Cards

**Problem:** Cards with varying text lengths cause buttons to appear at different vertical positions.

### Option A — Flex grow on the text

```css
.card {
  display: flex;
  flex-direction: column;
}

.card p {
  flex: 1; /* Text area grows, pushing button down */
}
```

### Option B — Grid rows with `1fr`

```css
.card {
  display: grid;
  grid-template-rows: auto 1fr auto;
}
```

### Option C — Auto margin on the button (cleanest)

```css
.card {
  display: flex;
  flex-direction: column;
}

.card button {
  margin-top: auto; /* Margin absorbs leftover space */
}
```

**Option C is often the best choice** because it doesn't artificially expand the text container — only the margin grows.

---

## Quick Reference

| Pattern | Tool | Key Property |
|---|---|---|
| Isolate item in row | Flexbox | `margin-left/right: auto` |
| Visual page layout | Grid | `grid-template-areas` |
| Expand clickable area | Flexbox | `flex: 1` on the target |
| Stack/overlay elements | Grid | `grid-area: 1 / 1` on both |
| Even columns | Either | `flex: 1` or `grid-auto-columns: 1fr` |
| Responsive grid | Grid | `repeat(auto-fit, minmax(min, 1fr))` |
| Sticky footer | Grid | `grid-template-rows: auto 1fr auto` |
| Aligned card buttons | Either | `margin-top: auto` or `1fr` row |

---

## General Decision Guide: Flexbox vs. Grid

- **Flexbox** → Best for **one-dimensional** layouts (a single row or column of items).
- **Grid** → Best for **two-dimensional** layouts (rows and columns together).
- When in doubt, try Grid first — it handles more complex cases and often requires less code on child elements.

---

*Source: "8 Flexbox & Grid Techniques I Use in Every Project" by Fabian (Coding in Public)*