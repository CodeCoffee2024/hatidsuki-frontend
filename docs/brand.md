# Hatid Suki brand notes

## The name

*Hatid* is to deliver or bring over. *Suki* is the regular customer a shop looks after, the relationship of trust behind every sari-sari store. Together: orders delivered to your regulars.

## The mark

A location pin whose head is a **bilao**, the round woven tray used for shared food, with a **check** on it.

- The pin is *hatid*: an order going to a place, which matches the delivery locations in the app.
- The tray with its diamond weave (in the style of a *banig* mat) is the Filipino shared-meal image, a group order on one tray.
- The check is the *tsek* staff tick when a person's order is ready.

It deliberately avoids the flag's eight-ray sun and three stars. The Flag and Heraldic Code (Republic Act 8491) restricts commercial use of national symbols.

## Colours

| Name | Hex | Use |
|---|---|---|
| Terracotta | `#b93a14` | The pin, primary buttons, anything that needs action |
| Deep terracotta | `#8f2b0e` | The check, pressed states |
| Cream | `#fbf1e4` | The tray face, icon backgrounds |
| Ink | `#1b1915` | Text |
| Paper | `#f4f2ed` | Page background |

Measured contrast: terracotta on cream 5.1:1, deep terracotta on cream 7.5:1, white on terracotta 5.7:1, ink on paper 15.7:1. All pass for body text. Terracotta on ink is only 3.1:1, which is enough for a graphic but not for text, and it is why the pin turns cream on dark backgrounds.

## Files (`public/`)

| File | What it is |
|---|---|
| `logo-mark.svg` | The full mark with the woven pattern. Use at 64 px and larger. |
| `favicon.svg` | The simple mark for small sizes. Drops the weave so it stays clear at 16 px. |
| `favicon.ico` | 16, 32 and 48 px versions for older browsers and the taskbar. |
| `apple-touch-icon.png` | 180 px icon for iPhone and iPad home screens. |
| `icon-192.png`, `icon-512.png` | Icons for the installable web app. |
| `icon-maskable-512.png` | Same icon with extra margin, so Android can crop it to a circle or rounded square without cutting the pin. |
| `icon-tile.svg` | The square app icon as a vector. |
| `site.webmanifest` | Name, colours and icon list for installing the site as an app. |

In the interface use the `app-brand-mark` component, which draws the simple version in any colours.

## Rules

- Keep clear space around the mark of at least the width of the check stroke.
- Use the full mark at 64 px and up, and the simple one below that.
- On dark backgrounds use a cream pin with a terracotta face (as in the app icon), not the terracotta pin.
- Don't rotate, stretch, outline or add shadows to it.
- The wordmark is "Hatid Suki" in Public Sans, weight 700. Two words, capital H and S.
