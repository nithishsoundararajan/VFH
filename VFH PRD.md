
# **Project Requirements Document (PRD)**

**Project Name:** n8n Workflow to Standalone Codebase Converter

**Prepared By:** \Nithish S
**Date:**25/08/2025
**Version:** 1.0

---

## **1. Project Overview**

**Objective:**
Enable users to convert an n8n workflow (exported in JSON format) into a fully functional, standalone codebase that can execute workflows without requiring the n8n runtime. This system will leverage the official n8n packages for node logic while maintaining modularity and compatibility with future updates.

**Background:**
n8n is a popular open-source workflow automation tool. Its workflows are exportable as JSON but typically require the n8n runtime to execute. Many developers want the ability to run these workflows independently for performance, integration, or deployment reasons. This project bridges that gap by generating a Node.js project from an n8n workflow JSON.

---

## **2. Scope**

**In Scope:**

* Parsing n8n workflow JSON.
* Identifying nodes, triggers, and their configuration.
* Mapping nodes to functions in n8n packages.
* Generating a standalone Node.js project with the correct execution flow.
* Supporting basic error handling, logging, and environment configuration.
* Providing attribution to n8n and used packages.

**Out of Scope:**

* Creating new nodes or triggers from scratch.
* Full integration of complex community nodes not available in n8n packages (optional future work).
* Advanced UI for workflow visualization.

---

## **3. Key Features**

1. **Workflow Import**

   * Input: JSON exported from n8n.
   * Parse all nodes, connections, triggers, and credentials.

2. **Node Mapping**

   * Identify the type of each node.
   * Map it to its corresponding implementation in n8n packages.
   * Support both standard and community nodes (when available).

3. **Standalone Code Generation**

   * Generate project folder structure:

     ```
     src/
       nodes/
       triggers/
       workflows/
     config.js
     main.js
     ```
   * Create modular Node.js scripts for each node.
   * Include a main entry point (`main.js`) that initializes triggers and executes workflows.

4. **Execution Engine**

   * Execute nodes in the correct order.
   * Pass data between nodes according to workflow connections.
   * Handle errors gracefully with logs.

5. **Configuration & Credentials**

   * Store environment variables securely (API keys, secrets).
   * Allow external configuration via `config.js` or `.env`.

6. **Logging & Monitoring**

   * Basic console logging of workflow progress.
   * Track execution status of each node.

7. **Attribution & Licensing**

   * Credit n8n in `README.md`.
   * Include licenses for all imported packages.

---

## **4. Technical Requirements**

**Platform:** Node.js (v20+)

**Dependencies:**

* `n8n-core`
* `n8n-workflow`
* Optional: `dotenv` for environment variables

**Architecture:**

1. **Workflow Parser Module:** Reads JSON, extracts nodes/triggers.
2. **Node Mapping Module:** Matches workflow nodes to Node.js modules.
3. **Workflow Executor:** Runs nodes in sequence, handles triggers, and manages data flow.
4. **Main Entry Point:** Initializes workflow execution and logging.

**Folder Structure Example:**

```
n8n-standalone/
├── src/
│   ├── nodes/           # Node modules
│   ├── triggers/        # Trigger implementations
│   ├── workflows/       # Workflow scripts
├── config.js            # API keys & environment variables
├── main.js              # Entry point
├── package.json
├── README.md
```

---

## **5. User Stories**

1. **As a developer,** I want to input an n8n workflow JSON so that I can generate a standalone Node.js project.
2. **As a developer,** I want the generated code to execute workflows correctly, passing data between nodes, so that I don’t need n8n runtime.
3. **As a developer,** I want to be able to configure credentials externally, so that sensitive data isn’t hardcoded.
4. **As a developer,** I want the generated project to include logging, so I can track workflow execution and debug errors.
5. **As a developer,** I want the generated code to import nodes from official n8n packages, so updates to n8n nodes are compatible.

---

## **6. Functional Requirements**

| ID  | Requirement                                        | Priority |
| --- | -------------------------------------------------- | -------- |
| FR1 | Accept n8n workflow JSON input                     | High     |
| FR2 | Parse nodes, triggers, and connections             | High     |
| FR3 | Map nodes to official n8n package functions        | High     |
| FR4 | Generate Node.js scripts for each node             | High     |
| FR5 | Generate a workflow executor to run nodes in order | High     |
| FR6 | Include configuration module for API keys          | Medium   |
| FR7 | Provide console logging for execution              | Medium   |
| FR8 | Include license and attribution to n8n             | High     |
| FR9 | Allow future expansion for custom/community nodes  | Low      |

---

## **7. Non-Functional Requirements**

* **Performance:** Generated code should run workflows efficiently without the n8n runtime overhead.
* **Maintainability:** Code should be modular for easy updates and additions.
* **Portability:** Generated project should work on any Node.js environment (Linux, Windows, Mac).
* **Security:** Credentials should not be hardcoded; environment variables recommended.

---

## **8. Constraints & Assumptions**

* Users provide valid n8n JSON workflows.
* Nodes used in workflows are either standard nodes or available in n8n packages.
* Generated code will rely on n8n packages for node execution, not fully independent node logic.
* The system will not initially support full n8n UI or visual workflow editor.

---

## **9. Deliverables**

1. **Updated PRD**
2. **Developer Guide / Step-by-Step Instructions**
3. **Sample Standalone Node.js Project** based on an example workflow JSON
4. **Documentation:** README, license attribution, configuration instructions

---

## **10. Success Metrics**

* Workflow JSONs are successfully converted into standalone Node.js projects.
* Workflows execute correctly with triggers and data passing.
* Nodes execute using official n8n packages without manual modification.
* Developers can easily add new workflows by placing JSON files in a folder.
* Proper attribution to n8n included in generated code.

---

## **11. Future Enhancements**

* Full integration of community/custom nodes.
* Support for advanced error handling and retry logic.
* Optional GUI for visualizing and managing workflows.
* Advanced logging and monitoring dashboards.

---

## **12. References**

* [n8n Official Repository](https://github.com/n8n-io/n8n)
* [n8n Node Documentation](https://docs.n8n.io/nodes/)
* Node.js official documentation

---

