# CLEMD normalized hourly subset

Source creators: Omar Al-Khadher, Azharudin Mukhtaruddin, Fakroul Ridzuan Hashim,
Muhammad Mokhzaini Azizan, and Hussin Mamat.

- Dataset: https://doi.org/10.6084/m9.figshare.c.6946581
- Paper: https://doi.org/10.1038/s41597-024-03433-7
- Licence: Creative Commons Attribution 4.0 International:
  https://creativecommons.org/licenses/by/4.0/

Modified by NEXORA: five publicly licensed incoming-supply CSV exports were
normalized to Malaysia time, invalid timestamp padding was excluded, and all
three real-power phases were integrated from watts at one-second intervals into
hourly kWh. Only hours containing exactly 3,600 valid samples were retained.
No missing readings were imputed. The packaged subset has 696 valid hours.

`clemd-provenance.json` records the input CSV hashes, audit results and normalized
CSV hash. `docs/clemd-source-manifest.json` retains publisher archive metadata.
Six named NEXORA facilities are synthetic derivatives, not six measured CLEMD
sites. The source is one institutional building at UPNM in Malaysia.
