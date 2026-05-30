# Route Module: `routes/messaging`

Responsible for handling HTTP traffic regarding the **MESSAGING** domain context.

## Files and Responsibilities

### 📄 `broadcasts.routes.ts`

Enables merchants to compile specific marketing segments and blast promotions asynchronously across connected channels.

**Defined Endpoints:**

- `POST` `/` (Line 35)
- `GET` `/` (Line 112)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 21):

  ```typescript

  import broadcastsRoutes from "./routes/messaging/broadcasts.routes";

  ```

---

### 📄 `conversations.routes.ts`

Feeds full chat timelines, allows agents to inject manual text replies, and controls real-time manual takeover.

**Defined Endpoints:**

- `GET` `/` (Line 18)
- `GET` `/:id/messages` (Line 102)
- `POST` `/:id/send` (Line 179)
- `PATCH` `/:id/mode` (Line 268)
- `DELETE` `/:id/messages` (Line 328)
- `PATCH` `/:id/assign` (Line 371)
- `PATCH` `/:id/status` (Line 485)
- `POST` `/:id/voice-reply` (Line 533)
- `POST` `/:id/suggest-reply` (Line 584)
- `GET` `/:id/summary` (Line 622)
- `GET` `/:id/notes` (Line 663)
- `POST` `/:id/notes` (Line 677)
- `PATCH` `/:id/session-state` (Line 772)
- `DELETE` `/:convId/notes/:noteId` (Line 809)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 19):

  ```typescript

  import conversationRoutes from "./routes/messaging/conversations.routes";

  ```

---

### 📄 `instagram.routes.ts`

Webhooks parsing incoming DMs from Instagram pages and registering attachment media URL streams.

**Defined Endpoints:**

- `GET` `/webhook` (Line 11)
- `POST` `/webhook` (Line 26)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 20):

  ```typescript

  import instagramRoutes from "./routes/messaging/instagram.routes";

  ```

---
