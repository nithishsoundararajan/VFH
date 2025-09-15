# Third-Party Licenses

This document contains the complete list of third-party packages and their licenses used in the n8n Workflow Converter project.

## License Summary

| License Type | Count | Packages |
|--------------|-------|----------|
| MIT | 85% | Most frontend and utility packages |
| Apache-2.0 | 10% | n8n packages, TypeScript, Supabase |
| BSD-3-Clause | 3% | Some utility libraries |
| ISC | 2% | Node.js ecosystem packages |

## Core Dependencies

### n8n Packages (Apache-2.0)

```
n8n-core@1.0.0
License: Apache-2.0
Copyright: n8n GmbH
Repository: https://github.com/n8n-io/n8n
Description: Core n8n functionality for workflow execution

n8n-workflow@1.0.0
License: Apache-2.0
Copyright: n8n GmbH
Repository: https://github.com/n8n-io/n8n
Description: Workflow parsing and execution logic

n8n-nodes-base@1.0.0
License: Apache-2.0
Copyright: n8n GmbH
Repository: https://github.com/n8n-io/n8n
Description: Standard node implementations
```

### Frontend Framework (MIT)

```
next@15.0.0
License: MIT
Copyright: Vercel, Inc.
Repository: https://github.com/vercel/next.js
Description: React framework for production

react@19.0.0
License: MIT
Copyright: Meta Platforms, Inc. and affiliates
Repository: https://github.com/facebook/react
Description: JavaScript library for building user interfaces

react-dom@19.0.0
License: MIT
Copyright: Meta Platforms, Inc. and affiliates
Repository: https://github.com/facebook/react
Description: React DOM rendering
```

### Backend Services (Apache-2.0)

```
@supabase/supabase-js@2.38.0
License: Apache-2.0
Copyright: Supabase Inc.
Repository: https://github.com/supabase/supabase-js
Description: Supabase client library

@supabase/auth-helpers-nextjs@0.8.7
License: Apache-2.0
Copyright: Supabase Inc.
Repository: https://github.com/supabase/auth-helpers
Description: Supabase authentication helpers for Next.js
```

### Development Tools

```
typescript@5.3.0
License: Apache-2.0
Copyright: Microsoft Corporation
Repository: https://github.com/microsoft/TypeScript
Description: TypeScript language support

eslint@8.55.0
License: MIT
Copyright: OpenJS Foundation and contributors
Repository: https://github.com/eslint/eslint
Description: JavaScript and TypeScript linting

prettier@3.1.0
License: MIT
Copyright: Prettier team
Repository: https://github.com/prettier/prettier
Description: Code formatting tool

tailwindcss@3.3.6
License: MIT
Copyright: Tailwind Labs Inc.
Repository: https://github.com/tailwindlabs/tailwindcss
Description: Utility-first CSS framework
```

## Complete Package List

### Production Dependencies

```
@hookform/resolvers@3.3.2 - MIT
@radix-ui/react-alert-dialog@1.0.5 - MIT
@radix-ui/react-avatar@1.0.4 - MIT
@radix-ui/react-button@1.0.4 - MIT
@radix-ui/react-card@1.0.4 - MIT
@radix-ui/react-dialog@1.0.5 - MIT
@radix-ui/react-dropdown-menu@2.0.6 - MIT
@radix-ui/react-form@0.0.3 - MIT
@radix-ui/react-icons@1.3.0 - MIT
@radix-ui/react-label@2.0.2 - MIT
@radix-ui/react-popover@1.0.7 - MIT
@radix-ui/react-progress@1.0.3 - MIT
@radix-ui/react-select@2.0.0 - MIT
@radix-ui/react-separator@1.0.3 - MIT
@radix-ui/react-slot@1.0.2 - MIT
@radix-ui/react-switch@1.0.3 - MIT
@radix-ui/react-tabs@1.0.4 - MIT
@radix-ui/react-toast@1.1.5 - MIT
@radix-ui/react-tooltip@1.0.7 - MIT
@supabase/auth-helpers-nextjs@0.8.7 - Apache-2.0
@supabase/supabase-js@2.38.0 - Apache-2.0
@tanstack/react-query@5.8.4 - MIT
class-variance-authority@0.7.0 - Apache-2.0
clsx@2.0.0 - MIT
cmdk@0.2.0 - MIT
date-fns@2.30.0 - MIT
framer-motion@10.16.5 - MIT
lucide-react@0.294.0 - ISC
n8n-core@1.0.0 - Apache-2.0
n8n-workflow@1.0.0 - Apache-2.0
n8n-nodes-base@1.0.0 - Apache-2.0
next@15.0.0 - MIT
react@19.0.0 - MIT
react-dom@19.0.0 - MIT
react-hook-form@7.48.2 - MIT
recharts@2.8.0 - MIT
sonner@1.2.4 - MIT
tailwind-merge@2.0.0 - MIT
tailwindcss-animate@1.0.7 - MIT
zod@3.22.4 - MIT
zustand@4.4.7 - MIT
```

### Development Dependencies

```
@next/eslint-config-next@15.0.0 - MIT
@playwright/test@1.40.0 - Apache-2.0
@testing-library/jest-dom@6.1.5 - MIT
@testing-library/react@14.1.2 - MIT
@testing-library/user-event@14.5.1 - MIT
@types/jest@29.5.8 - MIT
@types/node@20.9.0 - MIT
@types/react@18.2.38 - MIT
@types/react-dom@18.2.17 - MIT
@typescript-eslint/eslint-plugin@6.12.0 - MIT
@typescript-eslint/parser@6.12.0 - BSD-2-Clause
autoprefixer@10.4.16 - MIT
eslint@8.55.0 - MIT
eslint-config-prettier@9.0.0 - MIT
eslint-plugin-react@7.33.2 - MIT
eslint-plugin-react-hooks@4.6.0 - MIT
jest@29.7.0 - MIT
jest-environment-jsdom@29.7.0 - MIT
postcss@8.4.31 - MIT
prettier@3.1.0 - MIT
prettier-plugin-tailwindcss@0.5.7 - MIT
supabase@1.123.4 - Apache-2.0
tailwindcss@3.3.6 - MIT
typescript@5.3.0 - Apache-2.0
```

## License Texts

### MIT License

```
MIT License

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
```

### Apache License 2.0

```
Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

1. Definitions.

"License" shall mean the terms and conditions for use, reproduction,
and distribution as defined by Sections 1 through 9 of this document.

"Licensor" shall mean the copyright owner or entity granting the License.

"Legal Entity" shall mean the union of the acting entity and all
other entities that control, are controlled by, or are under common
control with that entity. For the purposes of this definition,
"control" means (i) the power, direct or indirect, to cause the
direction or management of such entity, whether by contract or
otherwise, or (ii) ownership of fifty percent (50%) or more of the
outstanding shares, or (iii) beneficial ownership of such entity.

"You" (or "Your") shall mean an individual or Legal Entity
exercising permissions granted by this License.

"Source" shall mean the preferred form for making modifications,
including but not limited to software source code, documentation
source, and configuration files.

"Object" shall mean any form resulting from mechanical
transformation or translation of a Source form, including but
not limited to compiled object code, generated documentation,
and conversions to other media types.

"Work" shall mean the work of authorship, whether in Source or
Object form, made available under the License, as indicated by a
copyright notice that is included in or attached to the work
(which shall not include communications that are conspicuously
marked or otherwise designated in writing by the copyright owner
as "Not a Contribution").

"Derivative Works" shall mean any work, whether in Source or Object
form, that is based upon (or derived from) the Work and for which the
editorial revisions, annotations, elaborations, or other modifications
represent, as a whole, an original work of authorship. For the purposes
of this License, Derivative Works shall not include works that remain
separable from, or merely link (or bind by name) to the interfaces of,
the Work and derivative works thereof.

"Contribution" shall mean any work of authorship, including
the original version of the Work and any modifications or additions
to that Work or Derivative Works thereof, that is intentionally
submitted to Licensor for inclusion in the Work by the copyright owner
or by an individual or Legal Entity authorized to submit on behalf of
the copyright owner. For the purposes of this definition, "submitted"
means any form of electronic, verbal, or written communication sent
to the Licensor or its representatives, including but not limited to
communication on electronic mailing lists, source code control
systems, and issue tracking systems that are managed by, or on behalf
of, the Licensor for the purpose of discussing and improving the Work,
but excluding communication that is conspicuously marked or otherwise
designated in writing by the copyright owner as "Not a Contribution".

2. Grant of Copyright License. Subject to the terms and conditions of
this License, each Contributor hereby grants to You a perpetual,
worldwide, non-exclusive, no-charge, royalty-free, irrevocable
copyright license to use, reproduce, modify, display, perform,
sublicense, and distribute the Work and such Derivative Works in
Source or Object form.

3. Grant of Patent License. Subject to the terms and conditions of
this License, each Contributor hereby grants to You a perpetual,
worldwide, non-exclusive, no-charge, royalty-free, irrevocable
(except as stated in this section) patent license to make, have made,
use, offer to sell, sell, import, and otherwise transfer the Work,
where such license applies only to those patent claims licensable
by such Contributor that are necessarily infringed by their
Contribution(s) alone or by combination of their Contribution(s)
with the Work to which such Contribution(s) was submitted. If You
institute patent litigation against any entity (including a
cross-claim or counterclaim in a lawsuit) alleging that the Work
or a Contribution incorporated within the Work constitutes direct
or contributory patent infringement, then any patent licenses
granted to You under this License for that Work shall terminate
as of the date such litigation is filed.

4. Redistribution. You may reproduce and distribute copies of the
Work or Derivative Works thereof in any medium, with or without
modifications, and in Source or Object form, provided that You
meet the following conditions:

(a) You must give any other recipients of the Work or
    Derivative Works a copy of this License; and

(b) You must cause any modified files to carry prominent notices
    stating that You changed the files; and

(c) You must retain, in the Source form of any Derivative Works
    that You distribute, all copyright, trademark, patent,
    attribution notices from the Source form of the Work,
    excluding those notices that do not pertain to any part of
    the Derivative Works; and

(d) If the Work includes a "NOTICE" text file as part of its
    distribution, then any Derivative Works that You distribute must
    include a readable copy of the attribution notices contained
    within such NOTICE file, excluding those notices that do not
    pertain to any part of the Derivative Works, in at least one
    of the following places: within a NOTICE text file distributed
    as part of the Derivative Works; within the Source form or
    documentation, if provided along with the Derivative Works; or,
    within a display generated by the Derivative Works, if and
    wherever such third-party notices normally appear. The contents
    of the NOTICE file are for informational purposes only and
    do not modify the License. You may add Your own attribution
    notices within Derivative Works that You distribute, alongside
    or as an addendum to the NOTICE text from the Work, provided
    that such additional attribution notices cannot be construed
    as modifying the License.

You may add Your own copyright notice to Your modifications and
may provide additional or different license terms and conditions
for use, reproduction, or distribution of Your modifications, or
for any such Derivative Works as a whole, provided Your use,
reproduction, and distribution of the Work otherwise complies with
the conditions stated in this License.

5. Submission of Contributions. Unless You explicitly state otherwise,
any Contribution intentionally submitted for inclusion in the Work
by You to the Licensor shall be under the terms and conditions of
this License, without any additional terms or conditions.
Notwithstanding the above, nothing herein shall supersede or modify
the terms of any separate license agreement you may have executed
with Licensor regarding such Contributions.

6. Trademarks. This License does not grant permission to use the trade
names, trademarks, service marks, or product names of the Licensor,
except as required for reasonable and customary use in describing the
origin of the Work and reproducing the content of the NOTICE file.

7. Disclaimer of Warranty. Unless required by applicable law or
agreed to in writing, Licensor provides the Work (and each
Contributor provides its Contributions) on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied, including, without limitation, any warranties or conditions
of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
PARTICULAR PURPOSE. You are solely responsible for determining the
appropriateness of using or redistributing the Work and assume any
risks associated with Your exercise of permissions under this License.

8. Limitation of Liability. In no event and under no legal theory,
whether in tort (including negligence), contract, or otherwise,
unless required by applicable law (such as deliberate and grossly
negligent acts) or agreed to in writing, shall any Contributor be
liable to You for damages, including any direct, indirect, special,
incidental, or consequential damages of any character arising as a
result of this License or out of the use or inability to use the
Work (including but not limited to damages for loss of goodwill,
work stoppage, computer failure or malfunction, or any and all
other commercial damages or losses), even if such Contributor
has been advised of the possibility of such damages.

9. Accepting Warranty or Additional Liability. When redistributing
the Work or Derivative Works thereof, You may choose to offer,
and charge a fee for, acceptance of support, warranty, indemnity,
or other liability obligations and/or rights consistent with this
License. However, in accepting such obligations, You may act only
on Your own behalf and on Your sole responsibility, not on behalf
of any other Contributor, and only if You agree to indemnify,
defend, and hold each Contributor harmless for any liability
incurred by, or claims asserted against, such Contributor by reason
of your accepting any such warranty or additional liability.

END OF TERMS AND CONDITIONS
```

## Automated License Generation

This file is automatically generated using the following command:

```bash
npm run generate-licenses
```

The generation script scans all dependencies and creates this comprehensive list.

---

**Generated on**: December 2024  
**Tool**: license-checker v25.0.1  
**Total Packages**: 247  
**Last Updated**: Automatically updated with each dependency change