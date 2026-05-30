
# 📂 Settings Module Directory (`src/components/settings`)

This folder contains the complete, modularized settings ecosystem of the application. The system has been refactored into logical subunits to maintain a clean structure. Below is an exhaustive breakdown of what each file does and how they link with other parts of the application.

---

## 🛠️ Components & File Map

### 1. `Settings.tsx` (Core Orchestrator)

* **What it does:**

  Acts as the master controller and view. It fetches the business and integrations state from the server on mount, handles initialization/loading UI states, coordinates the main grid layout, and orchestrates user updates.
* **🔗 Inbound Links (Where is this imported?):**

  * `src/App.tsx` (Imports this file dynamically as a lazy loaded view to mount on the `/settings` navigation route).
* **🔗 Outbound Links (What does this file import?):**

  * `src/context/AuthContext.tsx` (Accesses `token`, current logged-in `user`, and `updateUser`).
  * `src/lib/api.ts` (Executes core REST integrations: connect, disconnect, and state updates).
  * `src/components/ui/Animations.tsx` (Wraps the dashboard panel inside `<PageTransition />`).
  * `src/components/conversations/SavedReplies.tsx` (Mounts `<SavedRepliesManager />` for quick reply config).
  * **Local Sub-components (within `src/components/settings/`):**

    * `./ProfileSection.tsx`
    * `./BusinessDetailsSection.tsx`
    * `./TelegramIntegration.tsx`
    * `./InstagramIntegration.tsx`
    * `./CommerceOnboardingSection.tsx`
    * `./AdvancedTuningSection.tsx`
    * `./MenuEditorSection.tsx`
    * `./AssignmentStrategyManager.tsx`
    * `./AutomationManager.tsx`
    * `./BotKnowledgeManager.tsx`

---

### 2. `ProfileSection.tsx`

* **What it does:**

  Displays current user info (email, role, name) and exposes a togglable switch to let agents pause or accept automatic incoming chat assignments in real-time.
* **🔗 Inbound Links:**

  * `Settings.tsx` (Instantiated and rendered as `<ProfileSection />`).
* **🔗 Outbound Links:**

  * `src/lib/api.ts` (Fires `PATCH /users/:id/availability` requests to edit availability).

---

### 3. `BusinessDetailsSection.tsx`

* **What it does:**

  Provides input forms for legal business name, physical business address, and registered GSTIN number. These values populate headers in generated invoices.
* **🔗 Inbound Links:**

  * `Settings.tsx` (Instantiated and rendered as `<BusinessDetailsSection />`).
* **🔗 Outbound Links:** None (Fully controlled component via props).

---

### 4. `TelegramIntegration.tsx`

* **What it does:**

  Enables linking the AI shop assistant directly to a Telegram bot token, with helpful hyperlinks guiding admins on using BotFather.
* **🔗 Inbound Links:**

  * `Settings.tsx` (Instantiated and rendered as `<TelegramIntegration />`).
* **🔗 Outbound Links:** None (Controlled component via state hooks/props).

---

### 5. `InstagramIntegration.tsx`

* **What it does:**

  Renders input forms for Meta page credentials (Access Token, Page ID ID) and displays instructions for copyproofing incoming Meta Webhook callback URLs.
* **🔗 Inbound Links:**

  * `Settings.tsx` (Instantiated and rendered as `<InstagramIntegration />`).
* **🔗 Outbound Links:** None (Controlled component via props).

---

### 6. `CommerceOnboardingSection.tsx`

* **What it does:**

  Integrates onboarding options to import catalogs. Features AI Smart Paste, a file attachment drag/drop drop-zone supporting CSV templates, and an extraction review panel.
* **🔗 Inbound Links:**

  * `Settings.tsx` (Instantiated and rendered as `<CommerceOnboardingSection />`).
* **🔗 Outbound Links:** None (Controlled component via props).

---

### 7. `AdvancedTuningSection.tsx`

* **What it does:**

  Provides text fields to adjust raw item descriptions and ground rules (delivery time, return restrictions) to train and tune the custom AI model.
* **🔗 Inbound Links:**

  * `Settings.tsx` (Instantiated and rendered as `<AdvancedTuningSection />`).
* **🔗 Outbound Links:** None (Controlled component via props).

---

### 8. `MenuEditorSection.tsx`

* **What it does:**

  Provides an interactive menu editor, letting you structure item categories, specify pricing in ₹ (INR), and delete/add catalogs seamlessly.
* **🔗 Inbound Links:**

  * `Settings.tsx` (Instantiated and rendered as `<MenuEditorSection />`).
* **🔗 Outbound Links:** None (Controlled via props).

---

### 9. `AssignmentStrategyManager.tsx`

* **What it does:**

  Manages custom inbound routing setups, letting admins toggle between Manual matching, round-robin queues, or workload/limit balancing schemes.
* **🔗 Inbound Links:**

  * `Settings.tsx` (Instantiated and rendered as `<AssignmentStrategyManager />`).
* **🔗 Outbound Links:**

  * `src/lib/api.ts` (Performs network state commits).
  * `src/context/SocketContext.tsx` (Provides live WebSockets events to view current workloads in real-time).

---

### 10. `AutomationManager.tsx`

* **What it does:**

  Allows admins to manage automated triggers, keyword responders, and delay thresholds.
* **🔗 Inbound Links:**

  * `Settings.tsx` (Instantiated and rendered as `<AutomationManager />`).
* **🔗 Outbound Links:**

  * `src/lib/api.ts` (API database storage network queries).
  * `src/context/SocketContext.tsx` (Refreshes rules via live socket events).

---

### 11. `BotKnowledgeManager.tsx`

* **What it does:**

  Controls uploaded knowledge files, document guides, and prompt logic templates for the AI assistant.
* **🔗 Inbound Links:**

  * `Settings.tsx` (Instantiated and rendered as `<BotKnowledgeManager />`).
* **🔗 Outbound Links:**

  * `src/lib/api.ts` (Uploads training knowledge updates to the backend catalog database).
  * `src/context/SocketContext.tsx` (Synchronizes updates across active client tabs).
