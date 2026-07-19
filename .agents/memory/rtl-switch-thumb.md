---
name: RTL toggle switch thumb
description: Radix Switch uses physical translate-x transforms; in RTL the thumb starts at the right edge, so checked must move left with a negative translate and unchecked stays at the right edge.
---

The shadcn/Radix Switch thumb animates with `translate-x-4` for checked and `translate-x-0` for unchecked. These are physical (not logical) CSS transforms. In an RTL layout, the flex item starts at the right edge, so:

- `translate-x-0` keeps the thumb on the right edge — that is the OFF position in RTL.
- `translate-x-4` in RTL moves the thumb further right, outside the track — wrong.
- `-translate-x-4` moves the thumb left by 16 px, landing on the left edge — that is the ON position in RTL.

**Why:** `translate-x-*` utilities apply physical transforms, not logical ones. Radix does not automatically mirror the switch for RTL, and `rtl:` Tailwind variants are unreliable if the `dir` attribute is only on a wrapper or if the Tailwind setup has limited variant support.

**How to apply:** Detect RTL in the Switch component (e.g. via the app's `LanguageContext`) and conditionally render the thumb transforms:

```css
LTR: data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0
RTL: data-[state=checked]:-translate-x-4 data-[state=unchecked]:translate-x-0
```

Apply the same fix to every Switch component in the project (including the mockup sandbox copy) so all toggles behave correctly in both LTR and Arabic.
