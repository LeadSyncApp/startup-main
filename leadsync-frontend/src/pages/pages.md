# Frontend Module: `src/pages`

Houses UI views, states interfaces, layout modules, and sub-components for the **PAGES** domain layer.

## Files and Responsibilities

### 📄 `Home.tsx`

Branded marketing page describing features with scroll anchors.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 10):

  ```typescript

  constHome          = lazy(()=>import("./pages/Home"));

  ```

---

### 📄 `Login.tsx`

Operator authentication credentials submission page.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 11):

  ```typescript

  constLogin         = lazy(()=>import("./pages/Login"));

  ```

---

### 📄 `OrderTracking.tsx`

Public customer-facing tracker tracking specific order codes.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 13):

  ```typescript

  constOrderTracking= lazy(()=>import("./pages/OrderTracking"));

  ```

---

### 📄 `Signup.tsx`

Tenant onboarding sheet building custom company name directories.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 12):

  ```typescript

  constSignup        = lazy(()=>import("./pages/Signup"));

  ```

---
