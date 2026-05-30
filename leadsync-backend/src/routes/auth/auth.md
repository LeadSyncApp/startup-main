# Route Module: `routes/auth`

Responsible for handling HTTP traffic regarding the **AUTH** domain context.

## Files and Responsibilities

### 📄 `auth.routes.ts`

Handles secure credentials management, user authentication, password resets, and user profile fetching under standard tokens.

**Defined Endpoints:**

- `POST``/signup` (Line 37)
- `POST``/login` (Line 115)
- `POST``/forgot-password` (Line 184)
- `POST``/reset-password` (Line 287)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 8):

  ```typescript

  import authRoutes from"./routes/auth/auth.routes";

  ```
- **frontend: pages/Login.tsx** (Line 35):

  ```typescript

  (FrontendAPICall)const data =await api.post("/auth/login",{

  ```
- **frontend: pages/Login.tsx** (Line 56):

  ```typescript

  (FrontendAPICall)const data =await api.post("/auth/forgot-password",{ email });

  ```
- **frontend: pages/Login.tsx** (Line 82):

  ```typescript

  (FrontendAPICall)await api.post("/auth/reset-password",{

  ```
- **frontend: pages/Signup.tsx** (Line 25):

  ```typescript

  (FrontendAPICall)const data =await api.post("/auth/signup",{

  ```

---

### 📄 `public.routes.ts`

Exposes public access points like verifying codes, guest links, reset credentials, or non-auth invoice details.

**Defined Endpoints:**

- `POST``/leads` (Line 11)
- `GET``/orders/:id` (Line 66)
- `GET``/mock-payment/:id` (Line 103)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 9):

  ```typescript

  import publicRoutes from"./routes/auth/public.routes";

  ```

---

### 📄 `secure.routes.ts`

Allows testing token verification and querying details explicitly reserved for authenticated tenants.

**Defined Endpoints:**

- `GET``/secure` (Line 7)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 10):

  ```typescript

  import secureRoutes from"./routes/auth/secure.routes";

  ```

---
