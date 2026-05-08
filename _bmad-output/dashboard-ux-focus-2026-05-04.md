# Problem Solving Session: Dashboard Section Visibility & Focus UX

**Date:** 2026-05-04
**Problem Solver:** LENOVO
**Problem Category:** UX/UI Dashboard Layout

---

## 🎯 PROBLEM DEFINITION

### Initial Problem Statement

Dashboard terlalu banyak section sehingga UX tidak fokus. User ingin bisa fokus pada CCTV (Live Cameras) dengan menyembunyikan section-section lain yang tidak sedang dibutuhkan.

### Refined Problem Statement

Pada pertama kali membuka dashboard, hanya Live Cameras (CCTV section) di RightPanel yang visible. Semua section lain di CenterPanel (Overview, System Control, Security Mode) dan Activity Log di RightPanel harus hidden (disembunyikan) secara default. User membutuhkan kemampuan untuk toggle (menampilkan/menyembunyikan) setiap section sehingga bisa fokus pada area yang sedang dimonitor.

### Problem Context

- Dashboard terdiri dari 3 panel: Sidebar, CenterPanel, RightPanel
- CenterPanel memiliki 3 section: Overview, System Control, Security Mode
- RightPanel memiliki 2 section: Live Cameras (CCTV), Activity Log
- Sidebar memiliki navigation dan system health (tidak perlu di-toggle)
- Information overload menyebabkan user kesulitan fokus

### Success Criteria

✅ Pertama kali buka dashboard: hanya Live Cameras visible, sisanya hidden
✅ Setiap section memiliki toggle button untuk show/hide
✅ Toggle berfungsi dengan smooth (tidak ada lag)
✅ State section dapat diingat (persistensi)
✅ UX jelas: user tahu section mana yang hidden vs visible
✅ **NEW: Ketika section lain di-hide, CCTV menjadi fullscreen (expand ke full width)**

---

## 🔍 DIAGNOSIS AND ROOT CAUSE ANALYSIS

### Problem Boundaries (Is/Is Not)

**WHERE does problem occur?**
- Di CenterPanel: semua 3 section terlalu banyak ditampilkan
- Di RightPanel: Activity Log menambah visual clutter

**WHERE doesn't problem occur?**
- Sidebar: tidak ada masalah, tetap perlu visible
- Navigation: fokus navigasi tidak terganggu

**WHEN does it occur?**
- Setiap kali halaman dashboard dibuka
- Ketika user ingin fokus di monitoring CCTV

**WHEN doesn't it occur?**
- Ketika user perlu melihat system health atau alerts

**WHO is affected?**
- Security operator/monitor yang fokus pada CCTV
- User yang ingin simplified view

**WHAT is the problem vs. what isn't?**
- **IS**: Terlalu banyak informasi menampilkan bersamaan menciptakan cognitive load
- **ISN'T**: Kualitas data atau informasi yang ditampilkan salah

---

### Root Cause Analysis

**Five Whys Drilling:**

1. **Why dashboard menampilkan semua section?**
   - Karena JSX merender semua section tanpa conditional logic

2. **Why tidak ada conditional logic?**
   - Karena state visibility sections tidak diimplementasikan

3. **Why state visibility tidak ada?**
   - Tidak ada toggle button di UI
   - Tidak ada state management untuk track visibility
   - Design awal tidak merencanakan collapsible sections

4. **Why visibility sections tidak direncanakan?**
   - Dashboard awalnya untuk menampilkan semua info sekaligus
   - Use case "fokus satu section" baru muncul post-launch
   - Tidak ada UX testing feedback loop

5. **Why belum difix sampai sekarang?**
   - Membutuhkan perubahan structural di state management
   - Membutuhkan UI design untuk toggle buttons
   - Needs koordinasi dengan UX team

**Root Cause Diagnosis:**
> **Arsitektur dashboard tidak punya visibility state management dan UI controls untuk section-level toggling. Ini adalah missing feature, bukan bug.**

### Contributing Factors

| Faktor | Severity | Impact |
|--------|----------|--------|
| Tidak ada state management visibility | 🔴 CRITICAL | Tanpa ini tidak bisa toggle |
| Layout rigid tanpa collapse/expand logic | 🔴 CRITICAL | Semua section render unconditional |
| Tidak ada UI button/toggle | 🟠 HIGH | User tidak bisa trigger change |
| Tidak ada persistensi | 🟡 MEDIUM | User re-toggle setiap session |
| No initial visibility mapping | 🟡 MEDIUM | Default state ambiguous |

### System Dynamics

**Current Flow (Problematic):**
```
User Opens Dashboard
         ↓
    DashboardPage renders unconditionally
         ↓
    ALL sections visible (Overview, System Control, Security Mode, Live Cameras, Activity Log)
         ↓
    Cognitive Overload
         ↓
    User tidak fokus ke CCTV
```

**Desired Flow (After Fix):**
```
User Opens Dashboard
         ↓
    Check visibility state (from store/localStorage)
         ↓
    Render conditionally based on visibility
         ↓
    Only Live Cameras visible by default
         ↓
    User dapat toggle sections via buttons
         ↓
    State persisted untuk next session
```

---

## 📊 ANALYSIS

### Force Field Analysis

**Driving Forces (Supporting Solution):**
- ✅ **Clear UX benefit** (⭐⭐⭐⭐⭐) — Users langsung fokus ke CCTV
- ✅ **Technical feasibility** (⭐⭐⭐⭐⭐) — Zustand + conditional render sudah proven
- ✅ **Low complexity** (⭐⭐⭐⭐) — State + toggle buttons + localStorage
- ✅ **No backend changes** (⭐⭐⭐⭐) — Pure frontend feature
- ✅ **Existing UI patterns** (⭐⭐⭐⭐) — React/CSS standard, no new tech
- ✅ **User demand clear** (⭐⭐⭐⭐) — Requirements sudah spesifik

**Restraining Forces (Blocking Solution):**
- ❌ **Perubahan layout CSS** (⭐⭐) — Responsive design perlu adjust
- ❌ **Test coverage** (⭐⭐) — Toggle state perlu comprehensive testing
- ❌ **User education** (⭐⭐) — User perlu tahu ada toggle button (UX affordance)
- ❌ **Browser storage** (⭐) — localStorage aman untuk config kecil
- ❌ **Timeline** (?) — Tergantung sprint prioritas

**Strategy:**
> Driving forces significantly outweigh restraining forces. Solusi ini recommended untuk dijalankan. Start dengan MVP: basic toggle + localStorage persistence, iterate based on feedback.

### Constraint Identification

| Constraint | Type | Impact | Solution |
|-----------|------|--------|----------|
| Backward compatible | Business | Existing user prefs reset | Set default yang sensible, soft launch |
| Responsive design | Technical | Mobile view perlu smart | Plan mobile-first toggle placement |
| Performance | Technical | Heavy re-render? | Memo components jika needed |
| Accessibility (a11y) | Technical | Toggle harus accessible | Semantic HTML + ARIA labels |
| State persistence | Technical | localStorage vs zustand? | Zustand persist untuk cleaner code |

### Key Insights

🎯 **Critical Insights:**
1. **Solusi ini low-hanging fruit** — high value, low effort
2. **Technical risk minimal** — semua tech sudah tested
3. **UX affordance adalah key** — toggle button harus obvious, jangan hidden
4. **Persistensi penting** — user nggak mau re-toggle every session
5. **Mobile-first mindset** — dashboard juga diakses di mobile, design accordingly

---

## 💡 SOLUTION GENERATION

### Methods Used

1. **Morphological Analysis** — Explore kombinasi parameters (toggle placement, persistence method, default visibility, interaction style)
2. **Lateral Thinking** — Challenge assumptions, generate wild ideas (presets, waterfall layout, cloud sync)
3. **Reverse Brainstorming** — How to make worse? Then reverse insights for solutions

### Generated Solutions

**INCREMENTAL SOLUTIONS (Low Risk, Proven Patterns):**

1. **Toggle Buttons in Section Headers + localStorage**
   - Add toggle button (🔒/🔓 icon) di setiap section header
   - State di localStorage, persist across sessions
   - Default: CCTV visible, sisanya hidden
   - ✅ Simple, familiar interaction
   - ✅ Non-invasive, tidak ubah layout

2. **Collapse/Expand Icons + Zustand Persist**
   - Section headers punya collapse/expand icon (▼/▶)
   - State managed di Zustand store dengan persist plugin
   - Cleaner code than localStorage
   - ✅ Professional appearance
   - ✅ Easier to manage state globally

3. **Section Toggle Checkboxes in Sidebar**
   - Tambah section di Sidebar: "Dashboard Panels"
   - List checkboxes: Overview, System Control, Security Mode, Activity Log
   - Toggle dari sidebar, real-time update
   - ✅ Centralized control, jelas all options visible

4. **Accordion-Style Panels**
   - Convert CenterPanel sections jadi accordion
   - Hanya satu section terbuka sekaligus
   - Default: Live Cameras expanded, sisanya collapsed
   - ✅ Familiar UX pattern, save vertical space

**BREAKTHROUGH SOLUTIONS (More Creative):**

5. **Tab-Like Quick Access Bar**
   - Add horizontal toggle bar: "Overview | System Control | Security | CCTV | Activity"
   - Click toggle → swap main panel content (mutually exclusive)
   - Similar ke browser tab behavior
   - ✅ Familiar dari web apps, clean interface

6. **Role-Based Smart Defaults**
   - Detect user role (Security Operator vs Admin vs Viewer)
   - Different default visibility per role
   - Security Operator → CCTV only
   - Admin → All visible
   - ✅ Personalized per workflow
   - ⚠️ Need role management system

7. **Keyboard Shortcuts for Quick Toggle**
   - Press V → toggle Visibility panel
   - Press C → toggle CCTV
   - Press A → toggle Activity Log
   - ✅ Power-user friendly, no additional UI
   - ⚠️ Need onboarding/help

8. **Drag-to-Reorder Sections + Pinning**
   - Sections are draggable cards
   - Pin important sections to top
   - Drag less-used to bottom
   - ✅ Highly customizable, gamified
   - ⚠️ Higher complexity

9. **Two-Mode Dashboard View**
   - Mode 1: "Focus Mode" (CCTV only) — default
   - Mode 2: "Command Center Mode" (all sections)
   - Toggle in TopBar: "Focus Mode 🎯 | Command Center 📊"
   - ✅ Clear intent, named modes, easy communicate

10. **Floating Action Button (FAB) with Menu**
    - Floating button bottom-right with menu icon
    - Click → reveal sidebar menu: "Show: Overview, System Control, Activity Log"
    - Mobile-first design
    - ✅ Tidak intrude main content, mobile-friendly

11. **Dashboard Presets**
    - Pre-built profiles: "CCTV Operator", "Admin Dashboard", "Night Watch"
    - One-click switch between presets
    - Each preset remembers its visibility + arrangement
    - ✅ Business-friendly, easy communicate
    - ✅ Power-user advanced feature

12. **Waterfall Layout**
    - Sections flow vertically, user scrolls
    - Pin sections to top (CCTV pinned by default)
    - Unimportant sections pushed to bottom, collapsed
    - ✅ Natural scrolling behavior, minimal UI

---

### Creative Alternatives

**Most Promising Directions:**

- **Two-Mode Views (#9)** — Clear mental model: "Focus" vs "Command Center", easy to understand
- **Tab-Like Quick Access (#5)** — Browser-familiar pattern, clean interface, intuitive
- **Dashboard Presets (#11)** — Business use-case friendly, scales for multiple teams
- **Keyboard Shortcuts (#7)** — Secondary feature, enhances power-user productivity

---

## ⚖️ SOLUTION EVALUATION

### Evaluation Criteria

| Criteria | Weight | Importance |
|----------|--------|-----------|
| **UX Quality** | 30% | Memastikan user experience intuitif dan satisfying |
| **Implementation Speed** | 25% | Seberapa cepat bisa di-deliver tanpa delay sprint |
| **Technical Complexity** | 20% | Minimize technical debt dan risk |
| **Maintainability** | 15% | Mudah di-maintain dan evolve di future |
| **Mobile Responsiveness** | 10% | Accessible di semua device sizes |

### Solution Analysis

**SELECTED SOLUTION: #3 - Section Toggle Checkboxes in Sidebar + Fullscreen CCTV**

**Evaluation Scores:**

| Criteria | Score | Comment |
|----------|-------|---------|
| **UX Quality** | ⭐⭐⭐⭐⭐ (9/10) | Centralized control, clear all options, fullscreen CCTV focus—excellent |
| **Implementation Speed** | ⭐⭐⭐⭐ (8/10) | Need Sidebar expansion + Layout conditional render, ~3-4 hours |
| **Technical Complexity** | ⭐⭐⭐⭐ (8/10) | State management + conditional rendering, no complex library needed |
| **Maintainability** | ⭐⭐⭐⭐ (8/10) | Clear separation of concerns, easy to add/remove sections |
| **Mobile Responsiveness** | ⭐⭐⭐ (7/10) | Sidebar checkboxes work on mobile, but fullscreen layout needs responsive tweaking |
| **Overall Score** | **8.2/10** | ✅ RECOMMENDED |

**Why This Solution Wins:**

1. ✅ **Centralized Control** — All toggles in one place (Sidebar), not scattered in section headers
2. ✅ **Clear Intent** — User sees exactly which sections are visible/hidden
3. ✅ **Fullscreen CCTV** — When other sections hidden, Live Cameras takes full width—exact focus user wants
4. ✅ **Quick Implementation** — Zustand state + conditional rendering, proven patterns
5. ✅ **Extensible** — Easy to add/remove sections in future

**Technical Breakdown:**

```
Layout Logic:
- When Overview, System Control, Security Mode ALL hidden:
  → RightPanel expands to full width
  → Live Cameras + Activity Log (if visible) take all available space
  
- When at least ONE section visible in CenterPanel:
  → Layout stays: Sidebar + CenterPanel + RightPanel (3-column)
  
CSS Grid/Flexbox adjustment:
- Track visibility state for CenterPanel
- If all CenterPanel sections hidden: RightPanel grid-column span full
- Media query: mobile layout unaffected (Sidebar collapses anyway)
```

### Recommended Solution

**Solution #3 Enhanced: Section Toggle Checkboxes in Sidebar + Responsive Fullscreen Layout**

**What will be delivered:**

1. **Sidebar Panel Controls**
   - New section in Sidebar: "📊 Dashboard Panels"
   - Checkboxes for: Overview, System Control, Security Mode, Activity Log
   - Live toggle: check/uncheck → immediate show/hide
   - Default state: Overview, System Control, Security Mode unchecked | Activity Log unchecked | CCTV checked

2. **Smart Layout**
   - CenterPanel sections: conditional render based on state
   - RightPanel: Live Cameras always visible (if CCTV enabled)
   - Fullscreen trigger: if ALL CenterPanel sections hidden → RightPanel expands to full width
   - CSS: smooth transition when layout changes

3. **State Persistence**
   - Store visibility state in Zustand + persist to localStorage
   - Restore on app reload
   - Reset option: "Restore Defaults" button in sidebar

4. **Visual Feedback**
   - Badge indicator: show count of hidden sections (e.g., "📊 3 hidden")
   - Icons: ✓ for visible, ○ for hidden
   - Smooth CSS transitions during show/hide

### Solution Rationale

> **Why this beats alternatives:**
> - **vs #1 (#2 Toggle buttons)**: Centralized is better than scattered; sidebar is natural place for controls
> - **vs #5 (Tab bar)**: This is more natural for "full panels" not just "swap content"
> - **vs #9 (Two-mode)**: This gives granular control per-section, not binary mode
> - **vs #11 (Presets)**: Start simple; presets can be added later as v2 enhancement
> 
> **Assumptions we're making:**
> - User wants granular control (per-section), not binary modes
> - Sidebar is always visible (or user familiar with toggling it)
> - Fullscreen layout when all other sections hidden is desired behavior
> 
> **Risks & Mitigations:**
> - Risk: Mobile Sidebar might be cramped with checkboxes
>   - Mitigation: Use compact checkbox UI, use icons + labels
> - Risk: User might not discover the controls
>   - Mitigation: Clear labeling, visual badge showing "X hidden"

---

## 🚀 IMPLEMENTATION PLAN

### Implementation Approach

**Strategy: MVP + Iterate**
- Phase 1 (MVP): Core functionality — Sidebar checkboxes + conditional render + fullscreen layout
- Phase 2 (Polish): Visual feedback, animations, mobile optimization
- Phase 3 (Advanced): Presets, keyboard shortcuts, advanced customization

**Execution Style:** Phased rollout within single sprint, with internal testing before user release

### Action Steps

**Phase 1: Core Implementation (~3-4 hours)**

1. **Update UI Store (ui.store.js)**
   - Add state: `sectionVisibility` object tracking each section
   ```javascript
   sectionVisibility: {
     overview: false,
     systemControl: false,
     securityMode: false,
     activityLog: false,
     liveCameras: true  // default visible
   }
   ```
   - Add actions: `toggleSection(sectionId)`, `setSectionVisibility(config)`
   - Add persist middleware (zustand/persist)

2. **Create Sidebar Panels Control Component**
   - New component: `SidebarPanelsControl.jsx`
   - List checkboxes: Overview, System Control, Security Mode, Activity Log
   - Display badge: show hidden count (e.g., "3 hidden")
   - Style: compact, mobile-friendly

3. **Modify CenterPanel.jsx**
   - Import visibility state from UI store
   - Wrap each section with conditional render:
     ```jsx
     {sectionVisibility.overview && <section>...</section>}
     {sectionVisibility.systemControl && <section>...</section>}
     {sectionVisibility.securityMode && <section>...</section>}
     ```

4. **Modify RightPanel.jsx**
   - Import visibility state
   - Add className based on fullscreen condition:
     ```jsx
     const isFullscreen = !Object.values(visibleCenterSections).some(v => v)
     <aside className={isFullscreen ? styles.fullscreen : ''}>
     ```

5. **CSS Updates**
   - Add `.fullscreen` class for RightPanel:
     ```css
     .fullscreen {
       grid-column: 1 / -1;  /* span full width */
       max-width: 100%;
     }
     ```
   - Add smooth transitions

6. **Test Basic Flow**
   - Toggle checkboxes → sections hide/show
   - All CenterPanel hidden → RightPanel fullscreen
   - Reload → state persists

**Phase 2: Polish & UX (~1-2 hours)**

7. **Visual Feedback Improvements**
   - Add icons to checkboxes (eye/eye-off)
   - Smooth CSS transitions
   - Highlight active section
   - Show "Restore Defaults" button

8. **Mobile Responsiveness**
   - Test on mobile viewport
   - Adjust sidebar checkbox sizing
   - Verify fullscreen layout works on small screens

9. **Accessibility**
   - ARIA labels on checkboxes
   - Keyboard navigation support
   - Focus management

**Phase 3: Future Enhancements**

10. **Dashboard Presets** (v2)
    - Add preset profiles: "CCTV Operator", "Admin", "Night Watch"
    - One-click apply preset

11. **Keyboard Shortcuts** (v2)
    - Ctrl+Shift+O → toggle Overview
    - Ctrl+Shift+C → toggle CCTV (but probably locked)
    - Etc.

### Timeline and Milestones

| Milestone | Timeline | Deliverable |
|-----------|----------|-------------|
| **Code Complete (Phase 1)** | ~2 hours | All core features implemented, ready for internal test |
| **Internal Testing** | ~30 mins | Edge cases, mobile, browser compatibility |
| **Code Review** | ~30 mins | Technical review, code quality check |
| **User Testing** | ~1 hour | Smoke test with actual user workflow |
| **Polish & Fixes (Phase 2)** | ~1-2 hours | Visual refinements, a11y, mobile tweaks |
| **TOTAL ESTIMATED TIME** | **~5-6 hours** | Ready for merge to main |

**Sprint Integration:**
- If sprint capacity allows: complete in 1 sprint (1 engineer)
- If capacity tight: deliver Phase 1 first, Phase 2 as follow-up

### Resource Requirements

| Resource | Quantity | Role |
|----------|----------|------|
| **Frontend Engineer** | 1 | Write code, test |
| **Designer** (optional) | 0.5 | Review UI, polish visual feedback |
| **QA/Tester** (optional) | 0.5 | Comprehensive testing |

**Required Existing Assets:**
- Zustand store (already in place)
- React & Vite setup (ready)
- CSS-in-JS or CSS modules (already used)
- Icons library (already available)

### Responsible Parties

| Task | Owner | Collaborator |
|------|-------|-------------|
| UI Store modifications | Frontend Engineer | - |
| Sidebar component creation | Frontend Engineer | Designer (optional) |
| CenterPanel/RightPanel modifications | Frontend Engineer | - |
| CSS layout adjustments | Frontend Engineer | Designer (optional) |
| Mobile testing | Frontend Engineer | QA |
| Accessibility review | Frontend Engineer | - |
| Internal test | Frontend Engineer + QA | - |
| Code review | Code Reviewer | - |

---

## 📈 MONITORING AND VALIDATION

### Success Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| **Toggle Functionality** | 100% success rate | All checkboxes toggle correctly |
| **State Persistence** | 100% | State restored after page reload |
| **Fullscreen Layout** | Works on all viewports | Mobile, tablet, desktop tested |
| **Performance** | No jank/lag | ~60fps during toggle |
| **Mobile Responsive** | No layout breaks | All screen sizes tested |
| **Accessibility Score** | WCAG AA compliant | a11y audit passes |
| **User Satisfaction** | >4/5 stars | Internal user feedback |

### Validation Plan

**Pre-Release Validation:**

1. **Manual Testing Checklist**
   - ✓ Toggle Overview: appears/disappears
   - ✓ Toggle System Control: appears/disappears
   - ✓ Toggle Security Mode: appears/disappears
   - ✓ Toggle Activity Log: appears/disappears
   - ✓ All CenterPanel hidden → RightPanel fullscreen
   - ✓ At least 1 CenterPanel visible → normal 3-column layout
   - ✓ Refresh page → visibility state persists
   - ✓ "Restore Defaults" button works
   - ✓ Mobile viewport: no layout breaks
   - ✓ Tab navigation works (a11y)

2. **Automated Test (e2e)**
   - Test toggle state changes
   - Test localStorage persistence
   - Test layout changes
   - Test mobile viewport

3. **Browser Compatibility**
   - Chrome (latest)
   - Firefox (latest)
   - Safari (latest)
   - Mobile browsers

4. **User Feedback Session**
   - Show to internal users
   - Collect feedback on:
     - Is checkbox control clear?
     - Is fullscreen CCTV behavior satisfying?
     - Any missing features?
   - Score: 1-5 stars

### Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Toggle state lost on reload** | 🟡 Medium | High | Use Zustand persist from start, test localStorage |
| **Mobile layout breaks** | 🟡 Medium | Medium | Responsive design first, test early on mobile |
| **Performance degradation** | 🟢 Low | Medium | Memo components if needed, CSS transitions (GPU) |
| **User doesn't find controls** | 🟡 Medium | Low | Clear labeling, badge count, onboarding tip |
| **Accessibility issues** | 🟡 Medium | Low | ARIA labels, keyboard nav, a11y audit before release |

### Adjustment Triggers

| Trigger | Action |
|---------|--------|
| **Toggle doesn't persist after reload** | Debug localStorage/Zustand persist, implement fix |
| **Fullscreen layout broken on mobile** | Adjust CSS media queries, use responsive units |
| **Lag during toggle** | Profile performance, add React.memo if needed |
| **User feedback: controls not obvious** | Add onboarding tooltip or reposition controls |
| **Accessibility audit fails** | Add ARIA labels, improve semantic HTML |

---

## 📝 LESSONS LEARNED

*To be completed after implementation & user validation in Phase 3*

---

_Generated using BMAD Creative Intelligence Suite - Problem Solving Workflow_
