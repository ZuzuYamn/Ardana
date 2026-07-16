---
name: express-session explicit save required before response
description: When saveUninitialized:false, sessions set during a request are not reliably flushed to the store before the response ends; call session.save() explicitly in auth routes
---

## Rule
In auth routes (login, register), always call `req.session.save(callback)` and await it before sending the HTTP response.

**Why:** express-session auto-saves asynchronously after the response ends. With `saveUninitialized: false`, a newly-written session (e.g. setting `req.session.userId`) may not reach the store before the client makes the next request, causing the follow-up request to see an empty session and return 401.

**How to apply:**
```typescript
function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve()))
  );
}

// In login/register handler:
req.session.userId = user.id;
await saveSession(req);  // flush BEFORE res.json()
res.json({ ... });
```
