# Autoconnecto branding (frozen)

**Locked mark:** C2A-4 ocean — hub + six equal arms, centre **A**, compact wifi above A. No black.

| File | Role |
|------|------|
| `c2a-4-ocean.svg` | Source favicon / app icon |
| `c2a-4-ocean-wordmark.svg` | Source header wordmark |
| `autoconnecto-mark.png` / `autoconnecto-wordmark.png` | Raster masters |
| `render_logo.py` | Regenerates PNG/ICO and installs into website + frontend |

Installed into:
- `website/public/favicon.png`, `favicon.ico`, `apple-touch-icon.png`
- `website/public/assets/images/app_logo.png`, `autoconnecto-logo-1777694039224.png`
- `frontend/public/favicon.svg`, `favicon.png`, `autoconnecto-logo.png`
- `frontend/src/assets/logo/autoconnecto-logo.png`
- `autoconnecto-mobile` assets, public favicons, Android launcher + splash (`install_mobile_logo.py`)

Colours: ocean `#115E59`, mint `#A7F3D0`, spokes `#6EE7B7`, word `#ECFDF5`.

Regenerate: `python branding/render_logo.py` then `python branding/install_mobile_logo.py`.
