# SupplyLoop backend contract

**Status: implemented and applied, including the approved judge registration extension.** All three migrations are installed in the approved `supplyloop-demo` project. Fixed judge accounts remain available, real demo signup and code-gated School A student enrollment work, and all 20 hosted API scenarios pass. Both categories previously completed the browser handoff workflow. See `verification.md` for remaining test limits. No migration or service change is authorized by this document alone. The lead owns the final contract and shared TypeScript types.

Prepared October 18, 2026, from the approved product choices, [architecture](../supplyloop-architecture.md), [working agreement](../AGENTS.md), and [implementation notes](implementation-notes.md). All data and accounts are fictional. Optional unmet needs are outside this core contract.

## Confirmed scope and environment

- One React/TypeScript/Vite frontend; Supabase Auth and PostgreSQL provide identity, reads, and transactional mutations.
- School A and School B; each has two member accounts and one manager account. Both use `Main office pickup` and `Demo term` as safe display labels.
- Clothing types: shirt, sweater, jacket, trousers, skirt. Letter sizes: XS, S, M, L, XL, XXL.
- Condition quality order: New > Like new > Good > Fair.
- Intake may contain incomplete drafts. Publication requires complete catalog data and manager inspection/approval.
- Managers enter color/variant. Optional measurements carry an explicit cm/in unit.
- Manager release reasons: uncollected, member request, stock issue. Retirement reasons: unsuitable, damaged, missing.
- Find displays available stock only. Personal pickups and manager queues/history still need authorized non-available item details.
- Sign-out affects the current Supabase session. Navigation stays within the page.
- Students use Find and My pickups. Managers open directly to Manager desk, with no personal Find/reservation/pickup screens. The database independently rejects manager reservation and receipt attempts.
- The SupplyLoop Educational/Free organization and healthy `supplyloop-demo` project exist in North Virginia (`us-east-1`), with the Data API enabled and automatic table exposure disabled. Approved email/password demo signup is enabled without email verification; school access requires the private enrollment code. Browser configuration, operator provisioning credentials, fixture passwords, and the enrollment code are stored separately in ignored local files.

The actual hosted PostgreSQL version is **17.11**, verified through `current_setting('server_version')` in the new project's SQL Editor on October 18, 2026. Its public schema initially has zero base tables. Use PostgreSQL 17 documentation for implementation. The retrieved stable PostgREST reference identifies version 16; verify actual transport behavior through integration tests rather than inferring it from that reference. Supabase JS 2.118.0 is pinned in the application manifest.

## Shared representations

UUID values are strings in the client. Timestamps are server-generated PostgreSQL `timestamptz` values, serialized as ISO 8601 strings. User-entered text is trimmed; blank optional text becomes null. Required text must be nonblank. The database must validate inputs independently of the interface.

| Concept | Stored/API values | Display or ordering |
| --- | --- | --- |
| Membership role | `member`, `manager` | `member` represents a student recipient; managers operate inventory and handoffs only |
| Category | `clothing`, `textbook` | Physical objects only |
| Item status | `intake`, `available`, `reserved`, `transferred`, `retired` | Controlled transitions below |
| Reservation status | `active`, `cancelled`, `completed` | One allocation and its outcome |
| Condition | `new`, `like_new`, `good`, `fair` | New > Like new > Good > Fair; never sort lexically |
| Garment type | `shirt`, `sweater`, `jacket`, `trousers`, `skirt` | Exact structured filter |
| Clothing size system | `letter` | Only the approved letter sizing system |
| Clothing size | `XS`, `S`, `M`, `L`, `XL`, `XXL` | Exact label match |
| Measurement unit | `cm`, `in` | Display the supplied unit; no fit inference |
| Manager release reason | `uncollected`, `member_request`, `stock_issue` | Human-readable labels in the interface |
| Retirement reason | `unsuitable`, `damaged`, `missing` | Manager-only action |
| Owner cancellation reason | `member_cancelled` | Server-selected; not a manager-release option |

The condition comparison accepts a candidate when its quality is at least the requested minimum. A minimum of `good` therefore includes `new`, `like_new`, and `good`, and excludes `fair`. A missing minimum does not introduce an additional condition restriction.

## Proposed schema

Application tables are in `public`, with RLS enabled and explicit grants. Internal authorization and privileged implementation functions live in an unexposed `private` schema. A constrained non-login role owns the necessary application tables/functions; policy helpers use security-definer execution under that owner to avoid RLS recursion. Do not force RLS on these owned tables. Grant authenticated callers only private-schema usage and the exact required function execution signatures, never schema creation or blanket execution. UUIDs and school-local item codes are generated by trusted operations, never accepted as proof of authorization.

### `schools`

| Column | Type/nullability | Rules |
| --- | --- | --- |
| `id` | uuid, primary key | Stable school identity |
| `name` | text, not null | School A or School B in the demo |
| `slug` | text, not null, unique | Proposed seed values `school-a`, `school-b` |
| `enabled_categories` | text array, not null | Nonempty subset of the category values; both categories enabled in the demo |
| `pickup_label` | text, not null | `Main office pickup`; no private storage location |
| `term_label` | text, not null | `Demo term` |
| `created_at` | timestamptz, not null | Server timestamp |

### `memberships`

| Column | Type/nullability | Rules |
| --- | --- | --- |
| `school_id` | uuid, not null | References `schools.id` |
| `user_id` | uuid, not null | References `auth.users.id` |
| `role` | text, not null | `member` or `manager` |
| `active` | boolean, not null | Authorization checks require true |
| `display_label` | text, not null | Fictional school-local label; no email or private profile |
| `created_at` | timestamptz, not null | Server timestamp |

Primary key: `(school_id, user_id)`. Memberships are operator-provisioned; application callers cannot create, edit, or delete them. Retain referenced memberships rather than deleting historical actors. Deactivation removes application access without changing historical attribution.

### `items`

| Column | Type/nullability | Rules |
| --- | --- | --- |
| `id` | uuid, primary key | One physical copy/object |
| `school_id` | uuid, not null | References `schools.id`; immutable |
| `item_code` | text, not null | Generated, human-readable, unique within school; immutable |
| `category` | text, not null | Approved category; immutable after intake creation |
| `title` | text, nullable in intake | Required before publication |
| `condition` | text, nullable in intake | Approved condition; required before publication |
| `status` | text, not null | Starts `intake`; caller cannot set it |
| `garment_type` | text, nullable | Approved garment type; clothing only |
| `size_system` | text, nullable | `letter`; clothing only |
| `size_label` | text, nullable | Approved letter size; clothing only |
| `color_variant` | text, nullable | Manager-entered clothing description |
| `measurements` | text, nullable | Manager-entered measurement description; clothing only |
| `measurement_unit` | text, nullable | `cm` or `in`; paired with nonblank measurements |
| `isbn13` | text, nullable | Thirteen digits with a valid ISBN-13 checksum; textbook only |
| `edition` | text, nullable | Explicit edition label; textbook only |
| `book_format` | text, nullable | Manager-entered physical format; textbook only |
| `course_label` | text, nullable | Optional textbook label |
| `book_term_label` | text, nullable | Optional textbook term label, separate from school default |
| `requires_digital_code` | boolean, nullable | Textbook only; must be false before publication |
| `is_consumable` | boolean, nullable | Textbook only; must be false before publication |
| `approved_at` | timestamptz, nullable | Catalog-safe record of manual approval; set by publication |
| `created_at` | timestamptz, not null | Server timestamp |
| `updated_at` | timestamptz, not null | Server timestamp |
| `available_at` | timestamptz, nullable | Time current availability began; server sets on publication/release |

Additional unique key: `(school_id, id)`. All fields belonging to the other category must be null, including on drafts. The measurements field is descriptive catalog text paired with a unit, not an unrestricted metadata object; the prototype does not parse measurements or calculate fit.

All supplied draft values must already have valid types and vocabulary; incomplete means missing values, not invalid values. Book identifiers may be omitted in a draft, but a supplied ISBN must be valid. Category checks and measurement pairing are enforced in the database. Clothing and textbook data are persisted in explicit columns.

Publication checks:

Use null-safe validation throughout: explicit non-null checks, inspection confirmation `IS TRUE`, and reusable-book flags `IS FALSE`. SQL NULL must never make an incomplete draft pass publication checks.

- Both categories: nonblank title, condition, category enabled for that school, nonblank staff storage code, passed inspection, and manual approval.
- Clothing: garment type, `letter` size system, size label, and nonblank color/variant. Measurements remain optional; a supplied measurement description requires a unit and vice versa.
- Textbook: ISBN-13, edition, physical format, `requires_digital_code = false`, and `is_consumable = false`. Publication is the manager's explicit approval that this physical copy is reusable and suitable; the app does not infer compatibility.

These completeness checks remain true while available/reserved/transferred. Intake and retired drafts may be incomplete. An available-item correction must satisfy publication validation without changing school, category, item code, or status. It records a manager correction to the approved physical object, not approval of a different object.

### `item_staff`

| Column | Type/nullability | Rules |
| --- | --- | --- |
| `school_id` | uuid, not null | Part of item reference |
| `item_id` | uuid, not null | Part of item reference |
| `storage_code` | text, nullable in intake | Exact private location; required before publication |
| `inspection_passed` | boolean, not null | Starts false; set by manager publication |
| `inspected_at` | timestamptz, nullable | Server-set with successful inspection/publication |
| `inspected_by` | uuid, nullable | Same-school membership reference |
| `received_by` | uuid, not null | Same-school membership reference derived from session |
| `received_at` | timestamptz, not null | Server timestamp |
| `updated_at` | timestamptz, not null | Server timestamp |

Primary key: `(school_id, item_id)`. Composite foreign key references `items(school_id, id)`. Actor references use `(school_id, user_id)` in memberships. No member-readable storage or inspection notes are added to `items`.

### `reservations`

| Column | Type/nullability | Rules |
| --- | --- | --- |
| `id` | uuid, primary key | Server-generated allocation identity |
| `school_id` | uuid, not null | Immutable school scope |
| `item_id` | uuid, not null | Composite item reference with school |
| `member_id` | uuid, not null | Composite membership reference with school; session actor |
| `status` | text, not null | Starts `active` |
| `created_at` | timestamptz, not null | Server timestamp |
| `cancelled_at` | timestamptz, nullable | Required only when cancelled |
| `cancelled_by` | uuid, nullable | Same-school actor; required when cancelled |
| `cancel_reason` | text, nullable | `member_cancelled` or approved manager-release reason |
| `completed_at` | timestamptz, nullable | Required only when completed |
| `completed_by` | uuid, nullable | Same-school manager; different from `member_id` |

Composite foreign keys bind `(school_id, item_id)` to items and all member/actor references to memberships. Add unique keys `(school_id, id)` and `(school_id, id, item_id)` for scoped event references. Status-dependent checks prevent cancellation and completion fields from being mixed.

A partial unique index permits one active reservation per physical item. A separate partial unique index permits at most one completed reservation per physical item. Historical cancelled allocations remain. State transitions also prevent transferred stock from being reserved again; indexes are additional safeguards.

### `item_events`

| Column | Type/nullability | Rules |
| --- | --- | --- |
| `id` | uuid, primary key | Server-generated |
| `school_id` | uuid, not null | Composite item/reservation/actor scope |
| `item_id` | uuid, not null | Composite item reference |
| `reservation_id` | uuid, nullable | Composite `(school_id, reservation_id, item_id)` reference |
| `action` | text, not null | `intake_received`, `published`, `details_updated`, `reserved`, `cancelled`, `released`, `pickup_completed`, `retired` |
| `actor_id` | uuid, not null | Same-school session actor |
| `reason` | text, nullable | Required/controlled for cancelled, released, and retired actions; null otherwise |
| `created_at` | timestamptz, not null | Server timestamp |

Reservation-related events require the matching reservation ID; intake/publication/detail/retirement events have no reservation ID. The app cannot insert, update, or delete events directly. Trusted mutations append an event in the same transaction as their business change. Explicit operator restoration may replace only the fictional dataset.

## Read authorization and screen queries

All application reads require an authenticated session and an active membership in the row's school. A client-supplied school selection is a filter, not permission. No signed-out table or mutation access is granted.

| Table | Ordinary member | Same-school manager |
| --- | --- | --- |
| `schools` | Existing active memberships only | Same |
| `memberships` | Own active membership rows only | School-local operational membership rows, including labels needed for pickup/history; no Auth emails |
| `items` | Approved same-school available/reserved catalog rows, plus items referenced by the caller's own active/completed reservations | All same-school statuses, including drafts and retired stock |
| `item_staff` | None | Same-school only |
| `reservations` | Own same-school reservations only | Same-school queue/history |
| `item_events` | None | Same-school history only |

The personal-item exception is essential: when a hold becomes reserved or a pickup becomes transferred, the member still reads their own item's catalog details. It exposes neither another member's allocation nor private staff fields. Transferred items without an owned completed reservation are not member-readable. Deactivated memberships cannot use either path.

Membership and item policies must avoid recursive RLS dependencies. Internal authorization helpers are private, derive `auth.uid()` themselves, and disclose only the narrow answer needed by a policy. A manager's backend access to operational labels is not a student-directory screen.

Screen query contract:

- **School selector:** own active memberships joined to readable schools; no membership creation.
- **Find:** explicitly filter active school, `status = available`, and `approved_at IS NOT NULL`, then category filters. Clothing uses exact type/size system/size, optional entered variant, and condition minimum. Textbooks use exact supplied ISBN and edition and any supplied course/term restriction; do not substitute editions. Order by `available_at` ascending, then `id` ascending. Normalize text by trimming, without fuzzy matching or hidden edition substitution.
- **My pickups:** query own reservations by active school and status; include item details through the authorized personal-item path. Active and completed sections are supported. Safe school pickup labels come from `schools`.
- **Manager inventory:** school-scoped items and staff records across relevant statuses. Do not reuse the available-only Find filter.
- **Manager queue:** school-local active reservations, matching items, and authorized membership display labels. Other-school joins must remain impossible through composite references and policies.
- **Manager history/counts:** query authorized events/current records and count completed reservations. Do not create a privileged aggregate view or editable statistics table.

Inventory and personal reads must be refetched after mutation and on returning to the screen. All cache keys and in-flight-result handling include user and school. Sign-out clears private state; a prior request must not repopulate it after a session change.

## RPC transport and validation

The browser calls named `public` security-invoker wrappers. Private, narrowly privileged implementations enforce actor/school/role/ownership/state checks, with an empty `search_path` and schema-qualified references. Revoke default/public/anonymous execution; grant only the required function signatures to `authenticated`. Non-exposed helper execution needed by wrappers must be explicitly granted and audited, rather than relying on defaults. No client receives a general SQL-execution function.

For compact transport, intake/correction accept a closed `p_details` JSON object. This is a fixed request schema, not a free-form metadata column. Reject unknown properties, unknown enum values, non-object payloads, incorrect scalar types, and fields belonging to the other category. Persist recognized values into the explicit columns above. The frontend uses a discriminated union; generated database types alone cannot validate the contents of a JSON argument.

Exact `p_details` shapes, with every listed property required and nullable for incomplete drafts:

| Category | Permitted keys and value types |
| --- | --- |
| Clothing | `title: string/null`, `condition: Condition/null`, `garment_type: GarmentType/null`, `size_system: 'letter'/null`, `size_label: ClothingSize/null`, `color_variant: string/null`, `measurements: string/null`, `measurement_unit: 'cm'/'in'/null` |
| Textbook | `title: string/null`, `condition: Condition/null`, `isbn13: string/null`, `edition: string/null`, `book_format: string/null`, `course_label: string/null`, `book_term_label: string/null`, `requires_digital_code: boolean/null`, `is_consumable: boolean/null` |

Correction is a full replacement of the editable category fields and storage code. The client supplies all keys from its current editable record; null explicitly clears a nullable field. Missing properties are rejected, avoiding ambiguous omitted-versus-cleared semantics. Stored school, category, item code, status, actors, and timestamps are never part of `p_details`.

Every successful RPC returns exactly one row. The adapter calls `.single()` and produces one `MutationResult` with these fields:

| Result field | Type |
| --- | --- |
| `school_id` | UUID string |
| `item_id` | UUID string |
| `item_status` | ItemStatus |
| `reservation_id` | UUID string or null |
| `reservation_status` | ReservationStatus or null |
| `completed_at` | ISO timestamp or null |
| `changed` | boolean |

Results identify confirmed state and trigger authorized refetches; they do not return staff details, another member's identity, or event history. RPC errors use the error channel, never a success row with a hidden failure flag.

| Function | Exact arguments | Authorization and behavior |
| --- | --- | --- |
| `intake_item` | `p_school_id uuid`, `p_category text`, `p_details jsonb`, `p_storage_code text/null` | Active same-school manager. Validate supplied fields, create item and staff row in intake, generate code, append receipt event. School is checked against authoritative membership. |
| `publish_item` | `p_item_id uuid`, `p_inspection_confirmed boolean` | Same-school manager; confirmation must be true. Lock intake item, validate complete category/storage data and reusable-book exclusions, record inspection/approval, set available time/status, append publication event. No client-selected status or approval actor. |
| `update_item_details` | `p_item_id uuid`, `p_details jsonb`, `p_storage_code text/null` | Same-school manager, intake or available only. Replace permitted fields, retain category/school/code/status, fully validate available stock, update timestamp and append correction event. |
| `reserve_item` | `p_item_id uuid` | Active same-school student (`member`) only; managers receive `SL002` on otherwise authorized targets. Actor becomes requester. Lock item, recheck role and approved/available state, create active reservation, set reserved, append event. No client member/school/status argument. |
| `cancel_reservation` | `p_reservation_id uuid`, `p_release_reason text/null` | Owner or same-school manager; active reservation only. Null reason means owner cancellation and requires ownership; set server reason `member_cancelled`. Non-null reason requires manager role and one approved manager-release reason. Lock item then reservation, cancel allocation, set available time/status, append cancelled or released event. |
| `complete_pickup` | `p_reservation_id uuid` | Same-school manager other than requester. Lock item then reservation; first completion requires a currently active student recipient (`member`). Complete active allocation, set transferred, record original server actor/time, append event. Authorized repeats of an already completed allocation preserve its historical recipient and return its original completion time with `changed = false`, even if that recipient's current role changed; never rewrite attribution or append another event. |
| `retire_item` | `p_item_id uuid`, `p_reason text` | Same-school manager; approved retirement reason. Lock intake/available item, retain history, set retired, append event. Reserved stock fails until a separate authorized release has completed. Transferred stock is terminal. |

All normal successful mutations return `changed = true`. Only authorized repeated pickup returns false. Item-only mutations return null reservation fields and null completion time; reservation mutations return the affected allocation. A failed or ambiguous network request does not authorize optimistic success: refetch authorized state before presenting an outcome or retrying.

## Failure contract

Proposed domain failures use dedicated five-character PostgreSQL SQLSTATE codes. SQLSTATE is the stable machine identifier; do not parse prose. The client maps database codes to the shared application names below and safe user-facing messages. Raise errors before writes where possible; an exception aborts the entire mutation, including any earlier item/reservation/event change in that call.

| SQLSTATE | Application code | Meaning |
| --- | --- | --- |
| `SL001` | `AUTH_REQUIRED` | No authenticated actor; anonymous execute grants are also absent |
| `SL002` | `NOT_AUTHORIZED` | Caller lacks a permitted action on an otherwise readable target, requests intake into an unauthorized school, or attempts self-confirmation |
| `SL003` | `NOT_FOUND` | Target is missing or outside the caller's permitted read/ownership scope; never distinguish these cases in code or message |
| `SL004` | `INVALID_INPUT` | Wrong shape/type/value, malformed identifier, incompatible category fields, or invalid reason |
| `SL005` | `INCOMPLETE_ITEM` | Publication or available-item correction fails required-field/inspection validation |
| `SL006` | `INVALID_STATE` | Requested transition is not allowed, including cancelled pickup or correction to reserved/transferred stock |
| `SL007` | `ITEM_UNAVAILABLE` | Reservation lost a race or item is no longer available |
| `SL008` | `CONFLICT` | A relevant uniqueness/state consistency guard prevented the operation |

Wrong-school targets and another member's private reservations must not leak their existence through distinct API behavior. Resolve target access using authorized school/ownership context; return the same `SL003` code and safe message for missing and inaccessible objects. Only after establishing that the actor may read the target may an action-specific role/state failure be returned. QA must compare the direct API responses, not merely the interface presentation.

Malformed UUID transport failures may arrive as PostgreSQL `22P02`; map to `INVALID_INPUT`. Direct application-table writes or ungranted function calls normally fail with `42501` before domain code executes. A partial unique-index violation may surface as `23505`; mutations should translate expected allocation conflicts to the appropriate domain error without exposing constraint names. Deadlocks (`40P01`), serialization failures (`40001`), and lock timeouts (`55P03`) are transaction failures: present a retryable conflict, refetch, and never claim success. Unknown backend failures map to `SERVER_ERROR`; network failures map to `NETWORK_ERROR` in the adapter. Do not return internal SQL, stack traces, tokens, or private-row contents.

Custom SQLSTATEs normally arrive as HTTP 400 responses; inspect their machine-readable body `code`. Map `42501` to a permission failure, invalid/expired JWT responses to authentication failure, and `.single()` cardinality failures to a server/contract defect. Never display raw database details or hints. Verify these mappings against the deployed API during integration testing.

## Transactions, permissions, and invariants

- Create schema, constraints, policies, and grants together in versioned migrations. All client roles lose direct application-table writes. Only explicitly permitted reads and business function execution are restored.
- Keep privileged ownership constrained to the application objects it needs. Do not assume RLS still protects a privileged function, and do not give callers a privileged role or key.
- Use the item-first/reservation-second lock order everywhere. To locate a reservation's item, read only through authorized context; lock the item and then lock/recheck the reservation before mutating. Item/reservation identity fields are immutable.
- Lock and recheck before reserving. The item, allocation, and append-only event change in one transaction or none do. Do not hold a lock while awaiting a human.
- `intake → available → reserved → transferred`; `reserved → available` after cancellation/release; `intake/available → retired`. An active reservation corresponds to reserved stock; transferred stock has its single completed allocation. A reserved object is not retired in a separate frontend write.
- Only a manager different from the student requester confirms collection. Managers cannot create personal reservations, and first collection requires an active student recipient. Repeat completion preserves original `completed_by`, `completed_at`, and event/count totals without reinterpreting completed history under later role changes.
- Trusted operator tooling provisions the six confirmed fixture Auth users and manager memberships and restores only fictional data. The user subsequently approved the real judge registration demo described below. No browser platform-admin feature, public reset, manager appointment, or role-switching privilege is introduced.
- Passwords and tokens do not appear in schema, seed definitions, source control, logs, this contract, or browser environment variables. Operator secret access is distinct from the publishable browser client.

## Session and integration checks

Use `signInWithPassword` for fixed accounts and `signOut({ scope: 'local' })` for the approved sign-out behavior. Clearing the current session does not revoke school membership or end another independent session. Issued JWTs may remain valid until expiry; do not promise immediate global token invalidation. RLS and each mutation continue checking identity and active membership.

Before the lead marks this contract implemented:

1. Inspect actual server/SDK versions, key types, exposed schemas, Auth settings, grants, and access path. Keep anonymous signup disabled. The original closed fixture-account setup is extended only by the explicitly approved judge registration below.
2. Generate shared database types and verify wrapper/result signatures against deployed RPC behavior. Runtime-validate closed JSON inputs and returned result shape.
3. Test ordinary authenticated sessions for every allow/deny boundary, cross-school query/join, direct write denial, draft visibility, manager-only staff/history, and own active/completed item details.
4. Run competing reservations from two independent sessions and prove exactly one success. Verify cancellation release, terminal transfer, invalid transitions, and atomic rollback.
5. Repeat pickup and prove original attribution and event/count totals are unchanged. Verify the same behavior across refresh and another authorized session.
6. Verify local sign-out leaves another independent session usable and clears private UI/cache state without stale-response repopulation.

## Official sources checked October 18, 2026

These sources were retrieved and read during backend research; examples do not authorize sample public policies or additional features. Recheck when the actual version/environment differs.

- [Password authentication](https://supabase.com/docs/guides/auth/passwords), [admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), and [Auth configuration](https://supabase.com/docs/guides/auth/general-configuration): fixed password accounts, confirmed operator provisioning, closed public signup.
- [Client initialization](https://supabase.com/docs/reference/javascript/initializing), [RPC](https://supabase.com/docs/reference/javascript/rpc), and [generated types](https://supabase.com/docs/guides/api/rest/generating-types): one typed browser client, named database functions, schema-derived TypeScript.
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [API security](https://supabase.com/docs/guides/api/securing-your-api), and [database function security](https://supabase.com/docs/guides/database/functions): explicit grants/policies, private privileged helpers, pinned search paths, authorization checks, and narrow execution rights. Verify changing platform defaults on the actual project.
- [API keys](https://supabase.com/docs/guides/getting-started/api-keys): publishable browser key and privileged operator-key separation.
- [Migrations](https://supabase.com/docs/guides/local-development/database-migrations), [seeding](https://supabase.com/docs/guides/local-development/seeding-your-database), [CLI setup](https://supabase.com/docs/guides/local-development/cli/getting-started), and [database testing](https://supabase.com/docs/guides/database/testing): reproducible SQL changes, data-only fictional seeds, environment/version checks, SQL tests plus authenticated API tests.
- [PostgreSQL 17 explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html) and [partial unique indexes](https://www.postgresql.org/docs/17/sql-createindex.html): row locks, consistent ordering, and conditional uniqueness, matched to the verified hosted server version 17.11.
- [PostgreSQL errors and messages](https://www.postgresql.org/docs/current/plpgsql-errors-and-messages.html) and [PostgREST error responses](https://docs.postgrest.org/en/stable/references/errors.html): custom five-character SQLSTATEs, transaction-aborting exceptions, and forwarded machine-readable codes. The retrieved stable PostgREST reference identifies version 16; verify actual API behavior rather than inferring it from the documentation version.
- [Supabase sign-out reference](https://supabase.com/docs/reference/javascript/auth-signout) and [sign-out scopes](https://supabase.com/docs/guides/auth/signout): explicit local scope and access-token expiry behavior.

## Approved judge registration extension

The user approved public GitHub Pages hosting and a real backend registration demonstration on October 18, 2026. The demo uses actual Supabase email/password accounts with email verification disabled, and clearly discloses that email ownership and school identity are unverified. Fixed judge accounts remain available. This policy is for the fictional dataset; real-school onboarding requires a separate decision.

Registration is two stages: `signUp` creates an Auth account; authenticated `join_demo_school(p_access_code text, p_display_label text)` enrolls it. Auth account creation alone grants no school access. The private access code controls school enrollment, and is never included in Auth metadata, source, browser configuration, or public judge instructions.

`join_demo_school` returns one `public.memberships` composite. It derives the actor from the verified session, checks a private SHA-256 code configuration, and inserts only an active `member` membership in fixed fictional School A. Its private constrained-owner implementation uses an empty search path, schema-qualified objects, actor serialization, and an atomic membership/enrollment-ledger write. The caller cannot supply a school, role, actor, or active state. Public table writes remain revoked.

A valid ledger-backed retry returns the original active student membership without changing its label or requiring the code again; this resolves lost-response retries after a rotation. Existing memberships, manager accounts, deactivated students, and later role changes cannot be rewritten or reactivated through registration. An absent or disabled configuration fails closed for new enrollment. `SL009` maps to the safe `DEMO_ACCESS_DENIED` message; raw SQL errors or access-code contents never appear in the interface.

The UI must distinguish account creation from enrollment. If the second step fails or the browser closes, the account can sign in again and retry joining. It must not falsely announce school access before authoritative membership loading succeeds. Registration never resets inventory or rewrites existing accounts. The existing restoration guard still refuses when additional memberships exist; registered accounts must not silently be treated as disposable fixtures.

Official signup, Auth configuration, SMTP, database-function security, RLS, and PostgreSQL 17 locking/hash documentation were checked for this extension. Hosted application and authorization verification must be recorded separately from preparation.
