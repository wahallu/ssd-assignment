# Business Logic, NoSQL Injection & Race Condition Defenses

**Author / Assignee:** Navod W D C (IT22049872)  
**Module:** SE4030 – Secure Software Development  
**System:** EventHub Microservices Architecture  

This document serves as the comprehensive technical documentation and viva defense guide for **Navod W D C**, covering the three critical vulnerability classes assigned in the group demonstration and assessment:
1. **Business Logic Tampering** (Price, Amount, and Status manipulation)
2. **NoSQL Operator Injection** (Query-operator bypass and recursive sanitization)
3. **Seat Inventory Race Condition** (TOCTOU overselling and atomic conditional reservation)

---

## 1. Business Logic Flaws & Remediation

### 1.1 The Vulnerability (CWE-840 / OWASP A04:2021 Insecure Design)

In the original application, trust boundaries between the client frontend and backend services were violated:
- In `ticketservice/src/controllers/ticketController.js`:
  ```javascript
  // BEFORE (VULNERABLE)
  const { eventId, userId, seatCount, price, status } = req.body;
  const ticket = await Ticket.create({ eventId, userId, seatCount, price, status });
  ```
  Any client could submit `price: 0` and `status: "booked"`. The backend trusted the client-supplied values and persisted a confirmed ticket for zero dollars.
- In `paymentservice/src/controllers/paymentController.js`:
  ```javascript
  // BEFORE (VULNERABLE)
  const { ticketId, userId, amount, status } = req.body;
  const payment = await Payment.create({ ticketId, userId, amount, status });
  ```
  Clients could submit `amount: 0.00` and `status: "completed"`. The system recorded a completed payment and marked the ticket confirmed without any money changing hands.

### 1.2 The Remediation

1. **Server-Authoritative Pricing:**
   - In `ticketservice/src/utils/pricing.js` and `ticketservice/src/controllers/ticketController.js`:
     The client is never permitted to set `price` or `status`.
     The price is computed strictly by multiplying the authoritative event price fetched from the Event Service by the validated seat count:
     $$\text{Ticket Price} = \text{Event Price} \times \text{seatCount}$$
     The ticket status is forcibly initialized to `"pending"`.
2. **Server-Authoritative Payment Processing:**
   - In `paymentservice/src/utils/paymentValidation.js` and `paymentservice/src/controllers/paymentController.js`:
     The payment amount is retrieved from the authoritative ticket record (`ticket.price`). Any client-supplied `amount` or `status` is discarded.
   - Ownership verification: The caller's identity (`req.auth.userId`) must match the ticket's owner (`ticket.userId`), preventing users from paying or tampering with others' bookings.
   - Duplicate prevention: If a payment with `status: "completed"` already exists for that `ticketId`, the service immediately returns `409 Conflict`.
   - Ticket confirmation: Only when the payment record is successfully persisted does the Payment Service call `PATCH /api/tickets/:id/confirm` over internal service communication.

---

## 2. NoSQL Operator Injection

### 2.1 The Vulnerability (CWE-943 / OWASP A03:2021 Injection)

In MongoDB / Mongoose, queries using raw request parameters can be abused if the client passes an object containing query operators instead of a primitive string:
```http
GET /api/tickets?userId[$ne]=000000000000000000000000
```
In the vulnerable application, the controller passed the query parameter directly into `Ticket.find(req.query)`.
Because `{"$ne": "..."}` means *"where userId is not equal to this dummy ID"*, MongoDB evaluated this as true for every single ticket in the database, disclosing every customer's booking information.

### 2.2 The Remediation

1. **Decoupled Identity Filtering:**
   List queries no longer rely on user-supplied query strings for authorization. Instead, the filter is derived from the cryptographically verified gateway token:
   ```javascript
   const filter = req.auth.role === "admin" ? {} : { userId: req.auth.userId };
   const tickets = await Ticket.find(filter);
   ```
2. **Recursive Operator Sanitization Middleware:**
   Implemented in `ticketservice/src/utils/sanitizer.js` and shared across microservices:
   ```javascript
   const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

   const scrub = (value) => {
       if (Array.isArray(value)) return value.map(scrub);
       if (value && typeof value === "object") {
           for (const key of Object.keys(value)) {
               if (key.startsWith("$") || key.includes(".") || FORBIDDEN_KEYS.has(key)) {
                   delete value[key];
               } else {
                   value[key] = scrub(value[key]);
               }
           }
       }
       return value;
   };
   ```
   This strips:
   - Any key starting with `$` (`$ne`, `$gt`, `$where`, `$regex`, `$expr`)
   - Any key containing a dot `.` to prevent nested document field manipulation
   - Prototype pollution vectors (`__proto__`, `constructor`, `prototype`)

---

## 3. Concurrency & Seat Reservation Race Condition

### 3.1 The Vulnerability: Time-Of-Check to Time-Of-Use (TOCTOU)

In high-demand event ticketing, multiple users attempt to reserve the last available seats simultaneously.
In the original code:
```javascript
// BEFORE (VULNERABLE READ-THEN-WRITE)
const event = await Event.findById(eventId); // STEP 1: READ
if (event.availableSeats >= seatCount) {      // STEP 2: CHECK
    // Context switch / async delay occurs here!
    event.availableSeats -= seatCount;
    await event.save();                       // STEP 3: WRITE
}
```
**Exploit Scenario:**
- Event has 4 seats remaining.
- 10 users simultaneously send requests to book 2 seats each.
- Due to asynchronous execution in Node.js, all 10 requests execute Step 1 and read `availableSeats = 4`.
- All 10 requests pass the check in Step 2 (`4 >= 2`).
- All 10 decrement and save, leaving `availableSeats = -16`.
- **Result:** 20 seats are sold for a venue with only 4 seats (overselling disaster).

### 3.2 The Remediation: Atomic Conditional Decrement & Compensating Rollback

In `eventservice/src/utils/seatManager.js` and `eventservice/src/controllers/eventController.js`:

1. **Atomic Conditional Update:**
   We eliminate the gap between read and write by utilizing MongoDB's single-operation atomicity:
   ```javascript
   const event = await Event.findOneAndUpdate(
       { _id: eventId, availableSeats: { $gte: seatCount } }, // Condition
       { $inc: { availableSeats: -seatCount } },              // Atomic Decrement
       { new: true }
   );
   ```
   - If `availableSeats < seatCount`, MongoDB matches **0 documents**, returning `null`.
   - The service returns `409 Conflict: Insufficient seats available`.
   - No negative seat values can ever exist in the database.

2. **Compensating Rollback:**
   In `ticketservice/src/controllers/ticketController.js`:
   If seats are successfully reserved on the Event Service, but persisting the ticket fails (e.g. database network error), a compensation call immediately triggers:
   ```javascript
   await releaseSeats(req, eventId, seatCount).catch(() => {});
   ```
   This increments `availableSeats` back by `seatCount`, maintaining system-wide eventual consistency.

---

## 4. Viva Examination Preparation (Navod W D C)

### Q1: "Why can't we just validate the price on the client side in React?"
> **Answer:** "Client-side validation is solely for user experience, not security. An attacker does not use our React UI; they use tools like `curl`, Postman, or Burp Suite to send HTTP requests directly to the API Gateway. Any data coming from outside the server boundary is untrusted. Price and status must always be calculated and enforced by the server based on authoritative database state."

### Q2: "How does NoSQL injection differ from SQL injection?"
> **Answer:** "SQL injection typically exploits untrusted string concatenation into a SQL query string (e.g., `' OR '1'='1`). In NoSQL databases like MongoDB, APIs accept JSON objects. If the application passes an unvalidated request object into a Mongoose filter, an attacker can supply MongoDB query operators such as `{"$ne": 0}` or `{"$gt": ""}`. This manipulates query logic at the object level rather than via syntax errors."

### Q3: "Why did the original seat booking have a race condition if Node.js is single-threaded?"
> **Answer:** "Although the Node.js event loop runs JavaScript on a single thread, database I/O is asynchronous and non-blocking. When `await Event.findById()` is called, Node yields the thread to process incoming network requests. Ten concurrent requests can all complete their read operation before the first request finishes writing its updated seat count. This classic Time-of-Check to Time-of-Use (TOCTOU) race condition allows concurrent requests to oversell inventory."

### Q4: "How does your fix guarantee that seats are never oversold?"
> **Answer:** "We replaced the separate read and write operations with an atomic conditional update: `findOneAndUpdate({ _id: eventId, availableSeats: { $gte: seatCount } }, { $inc: { availableSeats: -seatCount } })`. In MongoDB, document-level operations are atomic. The check and the decrement happen in a single database step. If insufficient seats remain, the query criteria fails to match and returns null, allowing us to safely return a 409 Conflict."

### Q5: "What happens if the seat is reserved, but the ticket creation crashes?"
> **Answer:** "This is a distributed transaction challenge across microservices. We implemented a compensating transaction: if `Ticket.create()` throws an exception after `reserveSeats()` succeeds, the catch block catches the database error and immediately calls `releaseSeats()` to atomically increment the available seats back, preventing inventory leakage."
