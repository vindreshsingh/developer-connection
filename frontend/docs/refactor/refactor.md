Frontend architecture redesign — enterprise folder structure
Context
The current frontend (frontend/src/) is a flat, page-centric React app: 8 page files (one of them, Profile.jsx, is 268 lines mixing form state, image upload, and JSX), 2 ad-hoc components, a single RTK Query api slice, and relative (../../) imports. This worked for Phase 1's scope, but Phase 2+ (chat, video, groups, AI assistant, payments) will multiply the page count and the current structure won't scale: business logic is entangled with JSX, there's no separation between "dumb" UI and page orchestration, no code-splitting, and no path for page-local state that doesn't belong in the API cache.

This plan migrates the entire existing frontend to the layered architecture you specified — components → widgets → containers → pages, centralized routes/, hooks/ encapsulating all data-fetching, dynamic reducer injection for page-local state, @-aliased imports, and SCSS-per-unit alongside Tailwind for layout utilities. Every existing page is migrated (none left in the old flat structure), establishing the template Phase 2 will follow.

Target structure
src/
  components/<Name>/<Name>.js + .scss        — small reusable, presentational UI atoms
  widgets/<Name>/<Name>.js + .scss           — compositions of components (still presentational)
  containers/<PageName>/
    index.js        — business logic, wires hooks + reducer + parser, renders widgets/components
    <PageName>.scss
    reducer.js      — RTK slice for page-local UI state (injected on mount, removed on unmount)
    parser.js       — normalizes API responses into widget/component-friendly shapes
  pages/<PageName>/<PageName>.js             — thin: renders <PageNameContainer/> only, lazy-loaded
  routes/index.js                             — central route config: path → lazy Page + guard
  hooks/<module>/use<Thing>.js                — wraps RTK Query hooks / derived state; the only place
                                                 components/containers touch the API layer
  store/
    index.js        — configureStore + injectReducer/asyncReducers (dynamic injection)
    api.js, baseQuery.js  — existing RTK Query setup (kept; it self-registers, no change needed)
  utils/<module>/...                          — module-specific helpers (e.g. utils/profile/formatExperienceDate.js)
  commonUtils/...                              — global helpers (classNames, formatDate, validators)
Path alias: @/... → src/ (Vite resolve.alias + jsconfig.json paths for editor support). All new/migrated files use @/... imports — no ../../../ chains.

Infrastructure changes (build first, foundation for the migration)
vite.config.js — add resolve: { alias: { '@': path.resolve(__dirname, 'src') } }.
jsconfig.json (new) — compilerOptions.paths: { "@/*": ["./src/*"] } + baseUrl so editors resolve @/.
Add sass devDependency — Vite compiles .scss out of the box once sass is installed; keep index.css's @import "tailwindcss" for utility classes.
store/index.js — rewrite with dynamic reducer injection:
const staticReducers = { [api.reducerPath]: api.reducer };
const createReducer = (asyncReducers) => combineReducers({ ...staticReducers, ...asyncReducers });
export const store = configureStore({ reducer: createReducer(), middleware: ... });
store.asyncReducers = {};
store.injectReducer = (key, reducer) => {
  if (store.asyncReducers[key]) return;
  store.asyncReducers[key] = reducer;
  store.replaceReducer(createReducer(store.asyncReducers));
};
Plus a commonUtils/useInjectReducer.js hook: useInjectReducer(key, reducer) calls store.injectReducer in a useEffect on mount (no removal — RTK doesn't cleanly support reducer removal and stale state is harmless; this is the standard pattern). Containers that need page-local state call this once.
routes/index.js — central config array [{ path, Page, guard: 'protected' | 'public-only' | 'open' }], each Page imported via React.lazy(() => import('@/pages/Feed/Feed')). App.jsx becomes a thin renderer: maps the config to <Route> elements wrapped in <Suspense> + the existing ProtectedRoute/PublicOnlyRoute guards (logic moves to routes/guards.js or stays in App.jsx — keep colocated since it's tiny and route-specific).
Migration pattern (applied to every page)
For each existing page X:

hooks/<module>/use<X>.js: wraps the relevant RTK Query hooks (e.g. useLoginMutation, useGetMyProfileQuery) plus any derived/local logic the page needs (e.g. useLogin returns { login, isLoading, error, needsVerification, resend }). Components/containers never import store/api directly — only hooks do.
containers/X/parser.js: pure functions that reshape raw API responses (e.g. turn experience[].startDate ISO strings into { display, value } for the date inputs, or normalize user into the shape ProfileForm expects). Exported as named functions, unit-testable in isolation.
containers/X/reducer.js: an RTK createSlice for page-local UI state that doesn't belong in the API cache (e.g. Profile's "which experience entry is expanded", Feed's "swipe direction animation state", Login's "show resend banner"). Injected via useInjectReducer('x', xReducer).
containers/X/index.js: the orchestrator — calls the hook(s), runs the parser on the data, reads/dispatches the injected slice, and renders widgets/components, passing down only data and callbacks (no JSX-embedded business logic).
containers/X/X.scss: container-level layout/structural styles (replacing the outer wrapper Tailwind classes where a named class is clearer).
pages/X/X.js: export default function XPage() { return <XContainer />; } — nothing else.
Concrete page-by-page breakdown
Page	New components	New widgets	Container notes
Login	FormInput, Button, Banner	AuthForm (email/password fields + submit, reused by Login/Signup)	reducer.js holds needsVerification/resendMessage UI state; hooks/auth/useLogin.js wraps useLoginMutation + useResendVerificationMutation
Signup	reuse FormInput, Button	reuse AuthForm	hooks/auth/useSignup.js wraps useSignupMutation
VerifyEmail	Spinner, StatusMessage	—	hooks/auth/useVerifyEmail.js wraps useVerifyEmailMutation + the existing useRef guard
Feed	Avatar, Tag	SwipeCard (move/refactor existing components/SwipeCard.jsx), SwipeDeck	reducer.js for swipe-animation/index state; hooks/feed/useFeed.js + hooks/feed/useSendRequest.js; parser.js normalizes feed pages into card-ready shape
Requests	Avatar, Button	RequestCard	hooks/requests/useRequests.js (useGetPendingRequestsQuery + useReviewRequestMutation); parser.js groups/shapes request list
Connections	Avatar	ConnectionCard	hooks/connections/useConnections.js wrapping useGetConnectionsQuery; parser.js shapes connection list
Profile	FormInput, Tag, ImagePreview, FileInput	ImageUploadPanel (photo+cover, replaces inline JSX), TechStackEditor, ExperienceEditor (the repeatable entries), ProfileForm (basic fields)	reducer.js holds image-upload status / which experience entry is open; parser.js normalizes user → form defaults (dates, arrays) and serializes form state → PATCH payload; hooks/profile/useProfile.js (useGetMyProfileQuery + useUpdateProfileMutation), hooks/profile/useImageUpload.js (useUploadProfilePhotoMutation + useUploadCoverImageMutation)
NavBar (shared)	NavLink (styled wrapper)	NavBar widget (composition of NavLinks + logout button)	Lives in widgets/, not tied to a single page; consumes hooks/auth/useCurrentUser.js (wraps useGetMyProfileQuery) and hooks/auth/useLogout.js
commonUtils/: classNames.js (simple class concatenation helper used across components), formatDate.js (used by Profile's experience display and any future date rendering).
utils/profile/: serializeProfilePayload.js / experience-date helpers specific to the Profile module (if not folded into parser.js).

Styling
Each component/widget/container gets a .scss file with a single root class (e.g. .swipeCard, .profileForm) imported as import styles from './SwipeCard.scss' → className={styles.swipeCard} (CSS Modules — Vite supports *.module.scss; we'll use the .scss + CSS-module convention Name.module.scss...

Adjustment to match your literal spec: you asked for ComponentName.scss (not .module.scss). To honor that exactly while avoiding global class collisions, each .scss file will scope its rules under a single uniquely-named root class matching the component (e.g. .dc-swipe-card { ... }), imported as a plain stylesheet (import './SwipeCard.scss') and referenced via that literal class name in JSX — combined with Tailwind utilities for layout/spacing as agreed.

Execution order
Infrastructure: alias config, jsconfig.json, sass install, new store/index.js + useInjectReducer, routes/index.js + lazy-loaded App.jsx.
commonUtils/ (classNames, formatDate) — needed by multiple migrations.
Shared pieces first: components/{FormInput,Button,Banner,Avatar,Tag,Spinner,StatusMessage,FileInput,ImagePreview}, widgets/NavBar.
Migrate pages in dependency order: Login & Signup (share AuthForm) → VerifyEmail → Feed → Requests → Connections → Profile (largest, most decomposition).
Delete old src/components/NavBar.jsx, SwipeCard.jsx, and the flat src/pages/*.jsx files once their replacements are wired into routes/index.js.
Update App.jsx/main.jsx to the new routing/store wiring.
Verification
npm run lint and npm run build (Vite build will fail loudly on broken imports/alias misconfig — a good smoke test given the preview-tooling Node-version limitation noted earlier in this session).
Manually start backend + frontend (nohup node src/server.js, nohup npx vite) as done previously, and curl/exercise each migrated route's API calls to confirm the hooks → RTK Query wiring still works end-to-end (login, signup, feed load, send/review request, connections list, profile view/edit/image-upload).
Visually sanity-check via preview_* tools if the harness Node-version issue has resolved; otherwise rely on the build passing + functional API verification (same limitation/workaround as Phase 1).
Confirm only one reducer is registered at startup (store.getState() shows just the api slice) and that visiting e.g. /profile injects profile into the store (store.asyncReducers).