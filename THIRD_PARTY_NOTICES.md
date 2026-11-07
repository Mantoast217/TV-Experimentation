# Third-party notices

The three apps in this repository (Meeting Scheduler, Enhanced Meeting Scheduler and the Team
dashboard) include the following third-party icons, fonts and data. Code libraries installed
through npm carry their own licences in their packages and aren't listed here.

## Icons

| What | Where it's used | Source | Licence |
| --- | --- | --- | --- |
| Clock | Browser tab and home-screen icons (`public/favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) in all three apps | [Lucide](https://lucide.dev/icons/clock), derived from Feather | MIT (Feather), see below |
| Moon, warning triangle | Scheduler apps, `src/components/icons.tsx` | Lucide, derived from Feather | MIT (Feather), see below |
| Sun | Scheduler apps, `src/components/icons.tsx` | [Lucide](https://lucide.dev/icons/sun) | ISC (Lucide), see below |
| Calendar, chevron left, chevron right, external link | Scheduler apps, `src/components/icons.tsx` | [Feather](https://feathericons.com) | MIT (Feather), see below |
| Outlook logo | Scheduler apps, `src/components/icons.tsx` | [SuperTinyIcons](https://github.com/edent/SuperTinyIcons) | The Unlicense (no notice required) |
| Microsoft Teams logo | Scheduler apps, `src/components/icons.tsx` | [gilbarbara/logos](https://github.com/gilbarbara/logos) | CC0 1.0 (no notice required). This is the repository's licence as checked on 7 November 2026; the comment in `icons.tsx` says MIT |
| Google Meet logo | Scheduler apps, `src/components/icons.tsx` | [Simple Icons](https://simpleicons.org) | CC0 1.0 (no notice required) |

The Outlook, Teams and Google Meet logos are trademarks of Microsoft and Google. They're used
only to label the matching invite options, and the apps' terms of use say they aren't
affiliated with either company.

## Font

Inter, copyright 2016 The Inter Project Authors (https://github.com/rsms/inter), used through
the `@fontsource-variable/inter` package. Licensed under the SIL Open Font License 1.1
(https://openfontlicense.org). The full licence text ships with the package.

## Data

- City and country data: [GeoNames](https://www.geonames.org), licensed under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credited on the scheduler pages.
- Time zone rules: the [IANA time zone database](https://www.iana.org/time-zones), in the public
  domain.

## Licence texts

### Lucide (ISC)

ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

### Feather (MIT)

The MIT License (MIT)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
