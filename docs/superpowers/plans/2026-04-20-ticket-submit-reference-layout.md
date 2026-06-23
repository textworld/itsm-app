# Ticket Submit Reference Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the ticket submission page to match the provided reference image and add the requested business fields, rich text description, and broader attachment support.

**Architecture:** Keep the page in the existing route, add a reusable rich text editor and supporting constants, and extend detail rendering so submitted data remains visible downstream.

**Tech Stack:** React 18, Ant Design 5, Vite, browser `contentEditable`, localStorage

---

### Task 1: Add supporting constants and validation surface

**Files:**
- Modify: `src/constants/toolTypes.js`
- Create: `src/constants/priorities.js`
- Create: `src/constants/systems.js`
- Modify: `src/utils/fileUtils.js`

- [ ] **Step 1: Expand tool type options**
- [ ] **Step 2: Add priority options**
- [ ] **Step 3: Add mocked system options**
- [ ] **Step 4: Expand accepted attachment types**

### Task 2: Add rich text editor and upload support

**Files:**
- Create: `src/components/common/RichTextEditor.jsx`
- Modify: `src/components/common/FileUploader.jsx`

- [ ] **Step 1: Add lightweight rich text editor**
- [ ] **Step 2: Support inline image insertion**
- [ ] **Step 3: Update uploader labels and accepted formats**

### Task 3: Rebuild ticket submit page

**Files:**
- Modify: `src/pages/TicketSubmit/index.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Replace card form layout with reference-style layout**
- [ ] **Step 2: Add all required fields and conditional fields**
- [ ] **Step 3: Wire submit payload with new ticket fields**
- [ ] **Step 4: Match styling and spacing to the reference**

### Task 4: Surface new data in ticket detail

**Files:**
- Modify: `src/components/TicketDetail/TicketInfoCard.jsx`

- [ ] **Step 1: Show new business metadata**
- [ ] **Step 2: Render rich text description safely**
- [ ] **Step 3: Keep existing attachment and timeline views working**

### Task 5: Verify with build

**Files:**
- Verify: `src/pages/TicketSubmit/index.jsx`
- Verify: `src/components/common/RichTextEditor.jsx`
- Verify: `src/components/TicketDetail/TicketInfoCard.jsx`

- [ ] **Step 1: Run production build**
- [ ] **Step 2: Fix any compile issues**
- [ ] **Step 3: Re-run build**
